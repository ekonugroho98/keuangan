import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { HouseholdFeaturesSchema, type UpdateHouseholdFeaturesBodySchema } from '@karaya/shared/schemas'
import type { z } from '@hono/zod-openapi'
import type { Actor } from '../auth/actor'
import { withActor, withUserClaims } from '../db/tx'
import { parseHouseholdFeatures, invalidateFeaturesCache } from './features'
import { computeHouseholdPlanStatus, invalidateEntitlementsCache, requireEntitlementInTx } from './entitlements'
import { isSuperadminActor, isSuperadminIdentity } from './admin'


interface HouseholdRow {
  id: string
  name: string
  timezone: string
  default_account_visibility: string
  owners_can_view_private_totals: boolean
  features: unknown
  plan_tier: string
  plan_expires_at: string | null
  entitlements: unknown
  member_count: string
}

type FeaturesPatch = z.infer<typeof UpdateHouseholdFeaturesBodySchema>

/**
 * Merge PARTIAL per-fitur (10-fitur-opsional-keluarga.md §2.2: `{"beneficiary":{"enabled":true}}`
 * tidak mereset fitur lain) di atas nilai yang sudah tervalidasi penuh. Tiap level di-strict-kan
 * ulang lewat HouseholdFeaturesSchema.parse supaya hasil merge tidak pernah lolos tanpa validasi.
 */
function mergeFeatures(current: ReturnType<typeof parseHouseholdFeatures>, patch?: FeaturesPatch) {
  if (!patch) return current
  const next = {
    beneficiary: { ...current.beneficiary, ...(patch.beneficiary ?? {}) },
    monthly_report: { ...current.monthly_report, ...(patch.monthly_report ?? {}) },
    reconciliation: { ...current.reconciliation, ...(patch.reconciliation ?? {}) },
    shopping_stock: {
      ...current.shopping_stock,
      ...(patch.shopping_stock ?? {}),
      auto_stock: { ...current.shopping_stock.auto_stock, ...(patch.shopping_stock?.auto_stock ?? {}) },
      expiry_reminder: { ...current.shopping_stock.expiry_reminder, ...(patch.shopping_stock?.expiry_reminder ?? {}) },
    },
  }
  return HouseholdFeaturesSchema.parse(next)
}

// Cache in-memory ringan per proses: timezone jarang berubah, dipanggil di hampir setiap request
// (listTransactions, summary, dll.) untuk resolvePeriod. TTL pendek supaya perubahan timezone
// household tetap terlihat tanpa restart proses.
const tzCache = new Map<string, { tz: string; expiresAt: number }>()

export async function getHouseholdTimezone(actor: Actor): Promise<string> {
  const cached = tzCache.get(actor.householdId)
  if (cached && cached.expiresAt > Date.now()) return cached.tz

  return withActor(actor, async (tx) => {
    const [row] = await tx<{ timezone: string }[]>`select timezone from households where id = ${actor.householdId}`
    const tz = row?.timezone ?? 'Asia/Jakarta'
    tzCache.set(actor.householdId, { tz, expiresAt: Date.now() + 60_000 })
    return tz
  })
}

/**
 * Query dipisah dari getCurrentHousehold supaya updateHousehold bisa membaca baris TERBARU lewat
 * transaksi `tx` yang SAMA dengan UPDATE-nya. Bug nyata ditemukan Fase 5: updateHousehold tadinya
 * memanggil getCurrentHousehold(actor), yang lewat withActor membuka TRANSAKSI/KONEKSI BARU dari
 * pool — koneksi baru itu belum bisa melihat UPDATE yang belum commit di transaksi pertama, jadi
 * response selalu mengembalikan nilai LAMA meski UPDATE di DB sudah benar (diverifikasi langsung
 * lewat psql). Kemungkinan sudah ada sejak household PATCH pertama kali dibuat (Fase 3/4), baru
 * ketahuan sekarang karena `settings` baru benar-benar diuji manual di Fase 5.
 */
async function selectCurrentHousehold(tx: postgres.TransactionSql, householdId: string, isSuperadmin = false) {
  const [row] = await tx<HouseholdRow[]>`
    select h.id, h.name, h.timezone, h.default_account_visibility::text, h.owners_can_view_private_totals, h.features,
           h.plan_tier, h.plan_expires_at::text, h.entitlements,
           (select count(*) from household_members m where m.household_id = h.id and m.deleted_at is null)::text as member_count
    from households h where h.id = ${householdId}
  `
  if (!row) throw ApiError.fromCode('not_found')
  return {
    id: row.id, name: row.name, timezone: row.timezone,
    settings: { default_account_visibility: row.default_account_visibility, owners_can_view_private_totals: row.owners_can_view_private_totals },
    features: parseHouseholdFeatures(row.features),
    plan: computeHouseholdPlanStatus({
      plan_tier: row.plan_tier,
      plan_expires_at: row.plan_expires_at,
      entitlements: row.entitlements,
    }),
    member_count: Number(row.member_count),
    is_superadmin: isSuperadmin,
  }
}

export async function getCurrentHousehold(actor: Actor) {
  const isSuperadmin = await isSuperadminActor(actor)
  return withActor(actor, (tx) => selectCurrentHousehold(tx, actor.householdId, isSuperadmin))
}

export async function updateHousehold(actor: Actor, patch: { name?: string; timezone?: string; settings?: { default_account_visibility?: 'shared' | 'private'; owners_can_view_private_totals?: boolean }; features?: FeaturesPatch }) {
  if (actor.role !== 'owner') throw ApiError.fromCode('insufficient_scope')
  const isSuperadmin = await isSuperadminActor(actor)
  return withActor(actor, async (tx) => {
    // Selalu baca+tulis `features` (bukan coalesce dengan jsonb null) — postgres.js men-DOBEL
    // encode JS string yang diikuti `::jsonb` di tagged template (bug nyata ditemukan saat
    // menguji F-0: `${JSON.stringify(x)}::jsonb` menghasilkan jsonb STRING SCALAR berisi teks
    // JSON, bukan OBJECT, karena postgres.js men-stringify ULANG nilai yang sudah string begitu
    // melihat cast `::jsonb`). `tx.json(obj)` adalah satu-satunya cara aman mengirim jsonb lewat
    // postgres.js (pola yang sama dipakai `routes/me.ts` untuk `hidden_menus`/`ai_config`).
    // `for update`: read-modify-write features harus di-lock, kalau tidak dua PATCH owner bersamaan
    // (A toggle fitur, B ganti nama) bisa saling menimpa — B membaca features lama lalu menulisnya
    // kembali. Kolom features HANYA ditulis kalau patch memang menyentuhnya (PATCH nama saja tidak
    // boleh ikut menulis ulang features).
    const [current] = await tx<{ features: unknown }[]>`select features from households where id = ${actor.householdId} for update`
    const currentFeatures = parseHouseholdFeatures(current?.features)
    const nextFeatures = patch.features ? mergeFeatures(currentFeatures, patch.features) : null
    if (patch.features?.beneficiary?.enabled === true) {
      await requireEntitlementInTx(tx, actor.householdId, 'beneficiary')
    }
    if (patch.features?.shopping_stock?.enabled === true) {
      await requireEntitlementInTx(tx, actor.householdId, 'shopping_stock')
    }
    const justEnabledBeneficiary = !!nextFeatures && !currentFeatures.beneficiary.enabled && nextFeatures.beneficiary.enabled

    await tx`
      update households set
        name = coalesce(${patch.name ?? null}, name),
        timezone = coalesce(${patch.timezone ?? null}, timezone),
        default_account_visibility = coalesce(${patch.settings?.default_account_visibility ?? null}, default_account_visibility),
        owners_can_view_private_totals = coalesce(${patch.settings?.owners_can_view_private_totals ?? null}, owners_can_view_private_totals)
      where id = ${actor.householdId}
    `
    if (nextFeatures) {
      await tx`update households set features = ${tx.json(nextFeatures as unknown as postgres.JSONValue)} where id = ${actor.householdId}`
    }
    // Seeding satu kali saat beneficiary PERTAMA KALI dinyalakan (10-fitur-opsional-keluarga.md
    // §3.2) — dipanggil setelah UPDATE supaya enable_beneficiary_feature (SECURITY DEFINER) tidak
    // bergantung pada urutan transaksi yang belum commit.
    if (justEnabledBeneficiary) {
      await tx`select enable_beneficiary_feature(${actor.householdId})`
    }
    tzCache.delete(actor.householdId)
    invalidateFeaturesCache(actor.householdId)
    invalidateEntitlementsCache(actor.householdId)
    return selectCurrentHousehold(tx, actor.householdId, isSuperadmin)
  })
}

export interface MemberOut {
  id: string
  display_name: string
  role: string
  aliases: string[]
  color: string
  is_me: boolean
  joined_at: string
}

export async function listMembers(actor: Actor): Promise<MemberOut[]> {
  return withActor(actor, async (tx) => {
    const rows = await tx<MemberOut[]>`
      select id, display_name, role, aliases, color, (user_id = ${actor.userId}) as is_me, joined_at::text
      from household_members
      where household_id = ${actor.householdId} and deleted_at is null
      order by joined_at
    `
    return rows
  })
}

/** Ubah diri sendiri: bebas. Ubah member lain (termasuk role): hanya owner (ditegakkan di SQL untuk role). */
export async function updateMember(actor: Actor, memberId: string, patch: { display_name?: string; aliases?: string[]; color?: string; role?: 'owner' | 'member' | 'viewer' }) {
  return withActor(actor, async (tx) => {
    if (memberId !== actor.memberId && actor.role !== 'owner') throw ApiError.fromCode('forbidden')

    if (patch.role !== undefined) {
      await tx<[{ result: unknown }]>`select to_jsonb(change_member_role(${actor.householdId}, ${actor.memberId}, ${memberId}, ${patch.role})) as result`
    }
    if (patch.display_name !== undefined || patch.aliases !== undefined || patch.color !== undefined) {
      const [row] = await tx<{ id: string }[]>`
        update household_members set
          display_name = coalesce(${patch.display_name ?? null}, display_name),
          aliases = coalesce(${patch.aliases ?? null}, aliases),
          color = coalesce(${patch.color ?? null}, color),
          updated_at = now()
        where id = ${memberId} and household_id = ${actor.householdId} and deleted_at is null
        returning id
      `
      if (!row) throw ApiError.fromCode('member_not_found')
    }
    const rows = await tx<MemberOut[]>`
      select id, display_name, role, aliases, color, (user_id = ${actor.userId}) as is_me, joined_at::text
      from household_members where id = ${memberId} and household_id = ${actor.householdId}
    `
    return rows[0]
  })
}

const JOINT_SENTINEL = '00000000-0000-0000-0000-000000000000'

/** DELETE /v1/members/{id} — hapus ANGGOTA LAIN, owner-only (ditegakkan di SQL). Target diri sendiri ditolak di sini; pakai leaveHousehold. */
export async function removeMember(actor: Actor, memberId: string, reassignToMemberId?: string) {
  if (memberId === actor.memberId) throw ApiError.fromCode('cannot_remove_self')
  return withActor(actor, async (tx) => {
    await tx`select remove_member(${actor.householdId}, ${actor.memberId}, ${memberId}, ${reassignToMemberId === 'joint' ? JOINT_SENTINEL : (reassignToMemberId ?? null)})`
    return { success: true }
  })
}

/** POST /v1/members/me/leave — keluar sendiri, aturan sama (last_owner, reassign_required) tapi tanpa syarat role owner untuk actor. */
export async function leaveHousehold(actor: Actor, reassignToMemberId?: string) {
  return withActor(actor, async (tx) => {
    await tx`select remove_member(${actor.householdId}, ${actor.memberId}, ${actor.memberId}, ${reassignToMemberId === 'joint' ? JOINT_SENTINEL : (reassignToMemberId ?? null)})`
    return { success: true }
  })
}

export async function getMe(userId: string, email?: string) {
  return withUserClaims(userId, async (tx) => {
    // h.deleted_at is null: household yang sudah di-merge (merge_household_into, Fase 5) tidak
    // boleh muncul sebagai membership aktif meski baris household_members lamanya masih ada.
    const memberships = await tx<{ household_id: string; household_name: string; member_id: string; role: string }[]>`
      select hm.household_id, h.name as household_name, hm.id as member_id, hm.role
      from household_members hm join households h on h.id = hm.household_id
      where hm.user_id = ${userId} and hm.deleted_at is null and h.deleted_at is null
      order by hm.joined_at
    `
    const [settings] = await tx<{ active_household_id: string | null }[]>`
      select active_household_id from user_settings where user_id = ${userId}
    `
    const isSuperadmin = isSuperadminIdentity({ userId, email, memberships })
    return {
      memberships,
      active_household_id: settings?.active_household_id ?? null,
      is_superadmin: isSuperadmin,
    }
  })
}

export async function createHousehold(userId: string, input: { name: string; timezone: string; display_name: string }) {
  return withUserClaims(userId, async (tx) => {
    const [row] = await tx<[{ result: { household: unknown; member: unknown } }]>`
      select create_household(${input.name}, ${input.timezone}, ${input.display_name}, ${userId}) as result
    `
    return row!.result
  })
}

/**
 * "Hapus akun" di Sidebar (F4-T5). Household beranggota >1 belum punya alur keluar/transfer
 * kepemilikan (itu Fase 5), jadi untuk sekarang hanya didukung kalau actor satu-satunya anggota —
 * households_delete RLS policy (owner only) + cascade household_id menghapus semua data domain.
 * Catatan: ini TIDAK menghapus baris auth.users (butuh SUPABASE_SERVICE_ROLE_KEY yang belum
 * dikonfigurasi); frontend memanggil supabase.auth.signOut() sesudahnya.
 */
export async function deleteMyAccount(actor: Actor) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ member_count: string }[]>`
      select count(*)::text as member_count from household_members where household_id = ${actor.householdId} and deleted_at is null
    `
    if (Number(row!.member_count) > 1) throw ApiError.fromCode('last_owner_with_members')
    await tx`delete from households where id = ${actor.householdId}`
    return { success: true }
  })
}
