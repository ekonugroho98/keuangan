import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import type {
  AdminListHouseholdsQuery,
  AdminUpdateHouseholdPlanBody,
  HouseholdPlanStatus,
  PaidFeatureKey,
} from '@karaya/shared/schemas'
import type { Actor } from '../auth/actor'
import { requireJwtOnly } from '../auth/middleware'
import { withActor, withUserClaims } from '../db/tx'
import { env } from '../env'
import { computeHouseholdPlanStatus, invalidateEntitlementsCache } from './entitlements'
import { parseHouseholdFeatures } from './features'

const superadminCache = new Map<string, { isSuperadmin: boolean; expiresAt: number }>()

export function invalidateSuperadminCache(userId?: string) {
  if (userId) superadminCache.delete(userId)
  else superadminCache.clear()
}

export function isSuperadminIdentity(params: {
  userId: string
  email?: string
  activeHouseholdId?: string
  activeRole?: string
  memberships?: { household_id: string; role: string }[]
}): boolean {
  if (env.SUPERADMIN_USER_IDS.includes(params.userId)) return true
  if (params.email && env.SUPERADMIN_EMAILS.includes(params.email.trim().toLowerCase())) return true
  if (
    params.activeHouseholdId &&
    params.activeRole === 'owner' &&
    env.SUPERADMIN_HOUSEHOLD_IDS.includes(params.activeHouseholdId)
  ) {
    return true
  }
  if (
    params.memberships?.some(
      (m) => m.role === 'owner' && env.SUPERADMIN_HOUSEHOLD_IDS.includes(m.household_id),
    )
  ) {
    return true
  }
  return false
}

export async function isSuperadminActor(actor: Actor): Promise<boolean> {
  if (actor.credential !== 'jwt') return false
  if (
    isSuperadminIdentity({
      userId: actor.userId,
      email: actor.email,
      activeHouseholdId: actor.householdId,
      activeRole: actor.role,
    })
  ) {
    return true
  }

  if (env.SUPERADMIN_HOUSEHOLD_IDS.length === 0) return false

  const cached = superadminCache.get(actor.userId)
  if (cached && cached.expiresAt > Date.now()) return cached.isSuperadmin

  const isOwnerOfSuperadminHh = await withUserClaims(actor.userId, async (tx) => {
    const rows = await tx<{ household_id: string; role: string }[]>`
      select hm.household_id, hm.role
      from household_members hm
      join households h on h.id = hm.household_id
      where hm.user_id = ${actor.userId}
        and hm.deleted_at is null
        and h.deleted_at is null
    `
    return rows.some((r) => r.role === 'owner' && env.SUPERADMIN_HOUSEHOLD_IDS.includes(r.household_id))
  })

  superadminCache.set(actor.userId, { isSuperadmin: isOwnerOfSuperadminHh, expiresAt: Date.now() + 60_000 })
  return isOwnerOfSuperadminHh
}

export async function requireSuperadmin(actor: Actor): Promise<void> {
  requireJwtOnly(actor)
  const allowed = await isSuperadminActor(actor)
  if (!allowed) {
    throw ApiError.fromCode('forbidden', {
      message: 'Hanya Superadmin yang dapat mengakses halaman ini.',
    })
  }
}

export interface AdminOverviewOut {
  households: {
    total: number
    new_7d: number
    new_30d: number
    active_7d: number
    multi_member_count: number
  }
  members: {
    total_active: number
    unique_users: number
  }
  plans: {
    free_total: number
    pro_active: number
    pro_expiring_7d: number
    pro_expired: number
    lifetime_total: number
    custom_entitlements_count: number
  }
  transactions: {
    total: number
    today: number
    last_7d: number
    last_30d: number
    by_source: {
      web: number
      api_key: number
      recurring: number
      other: number
    }
  }
  storage_and_db: {
    receipt_count: number
    receipt_count_7d: number
    estimated_receipt_kb: number
    quota_limit_kb: number
    table_rows: {
      transactions: number
      product_prices: number
      product_knowledge: number
      idempotency_keys: number
      expired_idempotency_keys: number
      audit_log: number
      api_keys_active: number
    }
  }
  runtime: {
    enforce_paid_features: boolean
    storage_provider: 'supabase' | 'r2' | 'firebase'
    rate_limit_per_minute: number
    rate_limit_per_day: number
  }
}

export async function getAdminOverview(actor: Actor): Promise<AdminOverviewOut> {
  await requireSuperadmin(actor)
  const dbOverview = await withActor(actor, async (tx) => {
    const [row] = await tx<[{ overview: Omit<AdminOverviewOut, 'runtime'> }]>`
      select public.admin_get_overview() as overview
    `
    return row!.overview
  })

  return {
    ...dbOverview,
    runtime: {
      enforce_paid_features: env.ENFORCE_PAID_FEATURES,
      storage_provider: env.STORAGE_PROVIDER,
      rate_limit_per_minute: env.RATE_LIMIT_PER_MINUTE,
      rate_limit_per_day: env.RATE_LIMIT_PER_DAY,
    },
  }
}

export interface AdminHouseholdMemberItem {
  id: string
  user_id: string
  display_name: string
  email: string | null
  role: 'owner' | 'member' | 'viewer'
  color: string
  joined_at: string
}

export interface AdminHouseholdItem {
  id: string
  name: string
  timezone: string
  plan_tier: 'free' | 'pro' | 'lifetime'
  plan_expires_at: string | null
  entitlements_override: Partial<Record<PaidFeatureKey, boolean>>
  plan: HouseholdPlanStatus
  features: ReturnType<typeof parseHouseholdFeatures>
  created_at: string
  updated_at: string
  members: AdminHouseholdMemberItem[]
  stats: {
    tx_total: number
    tx_web: number
    tx_api_key: number
    tx_recurring: number
    tx_7d: number
    receipt_count: number
    last_tx_at: string | null
    active_api_keys: number
    last_api_key_used_at: string | null
  }
}

export async function listAdminHouseholds(
  actor: Actor,
  query: AdminListHouseholdsQuery,
): Promise<{ total: number; items: AdminHouseholdItem[] }> {
  await requireSuperadmin(actor)

  const raw = await withActor(actor, async (tx) => {
    const [row] = await tx<
      [
        {
          result: {
            total: number
            items: Array<Omit<AdminHouseholdItem, 'plan' | 'features'> & { features: unknown }>
          }
        },
      ]
    >`
      select public.admin_list_households(
        ${query.q ?? null},
        ${query.plan_tier ?? 'all'},
        ${query.limit ?? 100},
        ${query.offset ?? 0}
      ) as result
    `
    return row!.result
  })

  const items: AdminHouseholdItem[] = (raw.items ?? []).map((item) => ({
    ...item,
    features: parseHouseholdFeatures(item.features),
    plan: computeHouseholdPlanStatus({
      plan_tier: item.plan_tier,
      plan_expires_at: item.plan_expires_at,
      entitlements: item.entitlements_override,
    }),
  }))

  return {
    total: Number(raw.total ?? items.length),
    items,
  }
}

export async function updateAdminHouseholdPlan(
  actor: Actor,
  householdId: string,
  body: AdminUpdateHouseholdPlanBody,
) {
  await requireSuperadmin(actor)

  let normalizedExpiresAt: string | null = null
  let clearExpiresAt = false

  if (body.plan_expires_at === null || body.plan_expires_at === '') {
    clearExpiresAt = true
  } else if (typeof body.plan_expires_at === 'string') {
    const parsedMs = Date.parse(body.plan_expires_at)
    if (!Number.isFinite(parsedMs)) {
      throw ApiError.fromCode('validation_error', {
        message: 'Format tanggal kedaluwarsa (plan_expires_at) tidak valid.',
        details: { field: 'plan_expires_at' },
      })
    }
    normalizedExpiresAt = new Date(parsedMs).toISOString()
  }

  const updated = await withActor(actor, async (tx) => {
    const entitlementsParam =
      body.entitlements_override !== undefined
        ? tx.json(body.entitlements_override as unknown as postgres.JSONValue)
        : null

    const [row] = await tx<
      [
        {
          result: {
            id: string
            name: string
            plan_tier: 'free' | 'pro' | 'lifetime'
            plan_expires_at: string | null
            entitlements_override: Partial<Record<PaidFeatureKey, boolean>>
            updated_at: string
          }
        },
      ]
    >`
      select public.admin_update_household_plan(
        ${householdId},
        ${body.plan_tier ?? null},
        ${normalizedExpiresAt},
        ${clearExpiresAt},
        ${entitlementsParam}
      ) as result
    `
    return row!.result
  })

  invalidateEntitlementsCache(householdId)

  return {
    ...updated,
    plan: computeHouseholdPlanStatus({
      plan_tier: updated.plan_tier,
      plan_expires_at: updated.plan_expires_at,
      entitlements: updated.entitlements_override,
    }),
  }
}

export async function cleanupExpiredIdempotency(actor: Actor, olderThanDays = 7) {
  await requireSuperadmin(actor)
  const days = Math.max(1, Math.min(365, Math.floor(olderThanDays)))

  const deletedCount = await withActor(actor, async (tx) => {
    const [row] = await tx<[{ deleted: number }]>`
      select public.cleanup_expired_idempotency_keys((${days} || ' days')::interval) as deleted
    `
    return Number(row?.deleted ?? 0)
  })

  return {
    deleted_count: deletedCount,
    older_than_days: days,
  }
}
