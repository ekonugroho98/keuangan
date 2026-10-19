import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import {
  PAID_FEATURE_KEYS,
  PlanTierSchema,
  HouseholdEntitlementsOverrideSchema,
  type HouseholdEntitlements,
  type HouseholdPlanStatus,
  type PaidFeatureKey,
  type PlanTier,
} from '@karaya/shared/schemas'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { env } from '../env'

const FEATURE_LABELS: Record<PaidFeatureKey, string> = {
  api_access: 'Integrasi Bot AI Telegram/WhatsApp (API Key)',
  receipt_storage: 'Penyimpanan Cloud Bukti Struk (WebP)',
  price_compare: 'Banding Harga & Promo Antar Toko',
  multi_member: 'Kolaborasi Pasangan & Akun Shared/Privat',
  shopping_stock: 'Daftar Belanja & Stok Kulkas/Dapur',
  beneficiary: 'Penerima Manfaat ("Untuk Siapa")',
  excel_export: 'Export Laporan Profesional Excel (.xlsx 4-Sheet)',
}

const entitlementsCache = new Map<string, { status: HouseholdPlanStatus; expiresAt: number }>()

export function invalidateEntitlementsCache(householdId: string) {
  entitlementsCache.delete(householdId)
}

/**
 * Fungsi murni penghitung status paket & hak akses fitur per household:
 * 1. Jika saklar global `enforcePaidFeatures === false` (default saat masa promo/akuisisi),
 *    maka semua 7 fitur bernilai `true` (terbuka 100%).
 * 2. Jika `enforcePaidFeatures === true`:
 *    - `lifetime` selalu aktif (`effective_tier = 'lifetime'`).
 *    - `pro` aktif selama `plan_expires_at` NULL atau belum lewat (`effective_tier = 'pro'`),
 *      jika sudah kedaluwarsa otomatis turun ke `effective_tier = 'free'`.
 *    - Setiap fitur di `entitlements` JSONB bisa meng-override status tier (memungkinkan
 *      unlock add-on satuan untuk household `free`).
 */
export function computeHouseholdPlanStatus(
  raw: {
    plan_tier?: unknown
    plan_expires_at?: unknown
    entitlements?: unknown
  },
  enforcePaidFeatures: boolean = env.ENFORCE_PAID_FEATURES,
): HouseholdPlanStatus {
  const tierParsed = PlanTierSchema.safeParse(raw.plan_tier)
  const tier: PlanTier = tierParsed.success ? tierParsed.data : 'pro'

  const expiresAt =
    typeof raw.plan_expires_at === 'string' && raw.plan_expires_at.trim()
      ? raw.plan_expires_at
      : raw.plan_expires_at instanceof Date
        ? raw.plan_expires_at.toISOString()
        : null

  const isExpired =
    tier === 'pro' && expiresAt !== null && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now()

  const effectiveTier: PlanTier = tier === 'lifetime' ? 'lifetime' : tier === 'pro' && !isExpired ? 'pro' : 'free'
  const isActive = effectiveTier === 'lifetime' || effectiveTier === 'pro'

  const overridesParsed = HouseholdEntitlementsOverrideSchema.safeParse(raw.entitlements ?? {})
  const overrides = overridesParsed.success ? overridesParsed.data : {}

  const entitlements = {} as HouseholdEntitlements
  for (const key of PAID_FEATURE_KEYS) {
    if (!enforcePaidFeatures) {
      entitlements[key] = true
    } else if (typeof overrides[key] === 'boolean') {
      entitlements[key] = overrides[key]!
    } else {
      entitlements[key] = isActive
    }
  }

  return {
    tier,
    effective_tier: effectiveTier,
    expires_at: expiresAt,
    is_active: isActive,
    enforce_paid_features: enforcePaidFeatures,
    entitlements,
  }
}

export async function getHouseholdPlanStatusInTx(
  tx: postgres.TransactionSql,
  householdId: string,
): Promise<HouseholdPlanStatus> {
  const [row] = await tx<{
    plan_tier: string
    plan_expires_at: string | null
    entitlements: unknown
  }[]>`
    select plan_tier, plan_expires_at::text, entitlements
    from households
    where id = ${householdId}
  `
  return computeHouseholdPlanStatus(row ?? {})
}

export async function getHouseholdPlanStatus(actor: Actor): Promise<HouseholdPlanStatus> {
  const cached = entitlementsCache.get(actor.householdId)
  if (cached && cached.expiresAt > Date.now()) return cached.status

  return withActor(actor, async (tx) => {
    const status = await getHouseholdPlanStatusInTx(tx, actor.householdId)
    entitlementsCache.set(actor.householdId, { status, expiresAt: Date.now() + 30_000 })
    return status
  })
}

export async function requireEntitlement(actor: Actor, feature: PaidFeatureKey): Promise<void> {
  if (!env.ENFORCE_PAID_FEATURES) return
  const status = await getHouseholdPlanStatus(actor)
  if (!status.entitlements[feature]) {
    const label = FEATURE_LABELS[feature] ?? feature
    throw ApiError.fromCode('plan_upgrade_required', {
      message: `Fitur "${label}" memerlukan paket Keluarga Berkembang Pro.`,
      hint: 'Upgrade paket keluarga ke Pro atau aktifkan add-on fitur ini.',
      details: {
        feature,
        tier: status.tier,
        effective_tier: status.effective_tier,
        expires_at: status.expires_at,
      },
    })
  }
}

export async function requireEntitlementInTx(
  tx: postgres.TransactionSql,
  householdId: string,
  feature: PaidFeatureKey,
): Promise<void> {
  if (!env.ENFORCE_PAID_FEATURES) return
  const status = await getHouseholdPlanStatusInTx(tx, householdId)
  if (!status.entitlements[feature]) {
    const label = FEATURE_LABELS[feature] ?? feature
    throw ApiError.fromCode('plan_upgrade_required', {
      message: `Fitur "${label}" memerlukan paket Keluarga Berkembang Pro.`,
      hint: 'Upgrade paket keluarga ke Pro atau aktifkan add-on fitur ini.',
      details: {
        feature,
        tier: status.tier,
        effective_tier: status.effective_tier,
        expires_at: status.expires_at,
      },
    })
  }
}
