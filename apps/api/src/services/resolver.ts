import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { assertBeneficiaryFieldAllowed } from './features'

interface ResolveResult {
  status: 'ok' | 'ambiguous' | 'not_found'
  match?: { id: string; [k: string]: unknown }
  candidates?: unknown[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `account`/`category`/`member` (dan to_account/from_account) dideklarasikan sebagai "nama ATAU
 * UUID, API menentukan dari bentuknya" (06-agent-integration.md §2) — field tunggal yang dipakai
 * tool registry/Hermes setelah resolve_name mengembalikan id. Tanpa sniffing ini, mengirim UUID
 * lewat field nama (bukan field `*_id` terpisah) akan dicoba cocokkan sebagai TEKS NAMA ke
 * resolve_account/resolve_category/resolve_member dan nyaris pasti not_found.
 */
function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(s)
}

/**
 * Wrapper TS atas resolve_account/resolve_category/resolve_member (03-database.md §8.3,
 * 06-agent-integration.md §4). Dipakai di semua service yang menerima `*_id` ATAU nama manusia
 * (05-api.md §2.6): kalau `*_id` dikirim, dipakai langsung tanpa query resolve; kalau hanya nama,
 * panggil fungsi DB dan lempar 409 ambiguous_* / 404 *_not_found dengan candidates kalau perlu.
 */
export async function resolveAccountRef(
  tx: postgres.TransactionSql,
  actor: Actor,
  ref: { account_id?: string; account?: string },
  field = 'account',
  pronounMemberId?: string,
): Promise<string> {
  if (ref.account_id) return ref.account_id
  if (!ref.account) throw ApiError.fromCode('validation_error', { message: `${field} wajib diisi.`, details: { field } })
  if (looksLikeUuid(ref.account)) return ref.account

  const [row] = await tx<[{ result: ResolveResult }]>`
    select resolve_account(${actor.householdId}, ${pronounMemberId ?? actor.memberId}, ${ref.account}, false) as result
  `
  const result = row!.result
  if (result.status === 'ok') return result.match!.id as string
  if (result.status === 'ambiguous') {
    throw ApiError.fromCode('ambiguous_account', { candidates: result.candidates, details: { field } })
  }
  throw ApiError.fromCode('account_not_found', { candidates: result.candidates, details: { field, query: ref.account } })
}

export async function resolveCategoryRef(
  tx: postgres.TransactionSql,
  actor: Actor,
  ref: { category_id?: string; category?: string },
  type?: 'income' | 'expense',
): Promise<string> {
  if (ref.category_id) return ref.category_id
  if (!ref.category) throw ApiError.fromCode('validation_error', { message: 'category wajib diisi.', details: { field: 'category' } })
  if (looksLikeUuid(ref.category)) return ref.category

  const [row] = await tx<[{ result: ResolveResult }]>`
    select resolve_category(${actor.householdId}, ${ref.category}, ${type ?? null}) as result
  `
  const result = row!.result
  if (result.status === 'ok') return result.match!.id as string
  if (result.status === 'ambiguous') {
    throw ApiError.fromCode('ambiguous_category', { candidates: result.candidates })
  }
  throw ApiError.fromCode('category_not_found', { candidates: result.candidates, details: { query: ref.category } })
}

export async function resolveMemberRef(
  tx: postgres.TransactionSql,
  actor: Actor,
  ref: { member_id?: string; member?: string },
): Promise<string | undefined> {
  if (ref.member_id) return ref.member_id
  if (!ref.member) return undefined
  if (looksLikeUuid(ref.member)) return ref.member

  const [row] = await tx<[{ result: ResolveResult }]>`
    select resolve_member(${actor.householdId}, ${ref.member}) as result
  `
  const result = row!.result
  if (result.status === 'ok') return result.match!.id as string
  if (result.status === 'ambiguous') throw ApiError.fromCode('ambiguous_member', { candidates: result.candidates })

  const q = ref.member.trim()
  if (q.length >= 2) {
    const partialMembers = await tx<{ id: string }[]>`
      select id from household_members
      where household_id = ${actor.householdId} and deleted_at is null
        and display_name ilike ${'%' + q + '%'}
    `
    if (partialMembers.length === 1) return partialMembers[0]!.id

    const ownerAccounts = await tx<{ owner_member_id: string }[]>`
      select distinct owner_member_id from accounts
      where household_id = ${actor.householdId} and deleted_at is null
        and owner_member_id is not null
        and (name ilike ${'%' + q + '%'} or exists (select 1 from unnest(aliases) a where a ilike ${'%' + q + '%'}))
    `
    if (ownerAccounts.length === 1) return ownerAccounts[0]!.owner_member_id
  }

  throw ApiError.fromCode('member_not_found', { candidates: result.candidates })
}

/**
 * Resolusi `recorded_by` eksplisit secara aman (best-effort untuk skala produksi):
 * Kalau tenant belum mengundang pasangan ke household (baru 1 member) tapi tetap mengirim
 * `recorded_by: "Ibu"`, jangan gagalkan pencatatan transaksi dengan 404 — kembalikan `undefined`
 * supaya fallback ke pemilik akun (`account.owner_member_id`) atau pemilik API key (`actor.memberId`).
 */
export async function resolveExplicitRecorder(
  tx: postgres.TransactionSql,
  actor: Actor,
  ref: { recorded_by_id?: string; recorded_by?: string },
): Promise<string | undefined> {
  if (!ref.recorded_by_id && !ref.recorded_by) return undefined
  try {
    return await resolveMemberRef(tx, actor, { member_id: ref.recorded_by_id, member: ref.recorded_by })
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'member_not_found' || err.code === 'ambiguous_member')) {
      return undefined
    }
    throw err
  }
}

/**
 * Resolusi atribusi pencatat (1 API Key per Household):
 * 1. Kalau caller mengirim `recorded_by_id` atau `recorded_by` eksplisit (mis. "Ibu", "Ayah"),
 *    resolve ke `household_members.id`.
 * 2. Kalau tidak diisi (atau member belum terdaftar) dan request berasal dari `api_key`, otomatis
 *    ikut `owner_member_id` dari akun yang dipakai membayar (`accountId`) jika akun itu milik salah
 *    satu member (mis. BRI Ibu -> Ibu).
 * 3. Fallback ke `actor.memberId` (pemilik API key / user JWT).
 */
export async function resolveEffectiveRecorder(
  tx: postgres.TransactionSql,
  actor: Actor,
  ref: { recorded_by_id?: string; recorded_by?: string },
  accountId?: string,
  preResolvedExplicitId?: string,
): Promise<string> {
  if (preResolvedExplicitId) return preResolvedExplicitId
  const explicit = await resolveExplicitRecorder(tx, actor, ref)
  if (explicit) return explicit
  if (actor.credential === 'api_key' && accountId) {
    const [acc] = await tx<{ owner_member_id: string | null }[]>`
      select owner_member_id from accounts where id = ${accountId} and household_id = ${actor.householdId}
    `
    if (acc?.owner_member_id) return acc.owner_member_id
  }
  return actor.memberId
}

/**
 * Resolusi "owner" pada body create (account/goal/debt/piutang/investment): "me" -> actor.memberId,
 * "joint" -> null (bersama), member_id langsung, atau nama -> resolve_member.
 */
export async function resolveOwnerMemberId(tx: postgres.TransactionSql, actor: Actor, owner?: string): Promise<string | null> {
  if (!owner || owner === 'me') return actor.memberId
  if (owner === 'joint') return null
  if (looksLikeUuid(owner)) return owner
  const resolved = await resolveMemberRef(tx, actor, { member: owner })
  if (!resolved) throw ApiError.fromCode('member_not_found', { details: { query: owner } })
  return resolved
}

/**
 * Kata yang berarti "TIDAK untuk siapa-siapa tertentu" sebagai nilai `beneficiary` (nama) — satu
 * tempat untuk semua pemanggil (create/update/filter/summary), supaya sinonim & trim tidak pernah
 * beda antar entry point (review 2026-10-08: tiga salinan regex sempat saling menyimpang). "none"
 * = sentinel query lama (05-api.md), "bersama"/"keluarga" = kata manusia, pola sama dengan kata
 * kunci akun joint di resolve_account (0009). Nama-nama ini DILARANG dipakai sebagai nama
 * beneficiary sungguhan (lihat services/beneficiaries.ts).
 */
export function isNoBeneficiarySentinel(name: string | undefined | null): boolean {
  return typeof name === 'string' && /^(none|bersama|keluarga)$/i.test(name.trim())
}

/**
 * F-A (10-fitur-opsional-keluarga.md §3.3): resolve_beneficiary mengikuti pola resolve_member
 * (exact match nama/alias, tanpa fuzzy trgm). TIGA hasil yang berbeda arti:
 *   - `undefined` : field TIDAK disentuh sama sekali (tidak ada gate, tidak ada query) — pemanggil
 *                   yang menulis memperlakukannya "biarkan apa adanya", yang memfilter "tanpa filter".
 *   - `null`      : EKSPLISIT "tidak untuk siapa-siapa" — lewat `beneficiary_id: null` atau kata
 *                   sentinel (isNoBeneficiarySentinel). Pemanggil yang menulis -> kosongkan ke
 *                   bersama; yang memfilter -> hanya transaksi dengan beneficiary_id IS NULL.
 *   - string      : uuid beneficiary.
 * Gate fitur dipanggil begitu field disentuh (termasuk null/sentinel) — satu tempat, lihat features.ts.
 */
export async function resolveBeneficiaryRef(
  tx: postgres.TransactionSql,
  actor: Actor,
  ref: { beneficiary_id?: string | null; beneficiary?: string },
): Promise<string | null | undefined> {
  if (ref.beneficiary_id === undefined && ref.beneficiary === undefined) return undefined
  await assertBeneficiaryFieldAllowed(tx, actor)
  if (ref.beneficiary_id === null) return null
  if (ref.beneficiary_id) return ref.beneficiary_id
  if (!ref.beneficiary) return undefined
  if (isNoBeneficiarySentinel(ref.beneficiary)) return null
  if (looksLikeUuid(ref.beneficiary)) return ref.beneficiary

  const [row] = await tx<[{ result: ResolveResult }]>`
    select resolve_beneficiary(${actor.householdId}, ${ref.beneficiary}) as result
  `
  const result = row!.result
  if (result.status === 'ok') return result.match!.id as string
  if (result.status === 'ambiguous') throw ApiError.fromCode('ambiguous_beneficiary', { candidates: result.candidates })
  throw ApiError.fromCode('beneficiary_not_found', { candidates: result.candidates, details: { query: ref.beneficiary } })
}
