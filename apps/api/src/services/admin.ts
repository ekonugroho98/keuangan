import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import type {
  AdminCreateVouchersBody,
  AdminHouseholdTokensBody,
  AdminListHouseholdsQuery,
  AdminProvisionWalletBody,
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

// ── Token Gatekeeper Server-to-Server HTTP Client (Separate DB on VPS) ──────────────────────

export interface GatekeeperWalletItem {
  owner_id: string
  display_name: string
  token_balance: number
  lifetime_tokens_used: number
  lifetime_requests: number
  rpm_limit: number
  is_suspended: number | boolean
  keys_count?: number
  active_keys_count: number
  aliases: string[]
  key_prefixes: string[]
  created_at?: string
  updated_at: string
}

export interface GatekeeperSummaryStats {
  total_wallets: number
  active_wallets: number
  suspended_wallets: number
  total_balance_tokens: number
  total_used_tokens: number
  total_requests: number
  active_keys: number
  unclaimed_vouchers: number
}

export interface GatekeeperOverviewBlock {
  configured: boolean
  online: boolean
  base_url: string
  error: string | null
  summary: GatekeeperSummaryStats | null
  wallets: GatekeeperWalletItem[]
  vouchers: Array<Record<string, unknown>>
}

async function callGatekeeperApi<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const token = env.GATEKEEPER_ADMIN_TOKEN.trim()
  if (!token) {
    throw ApiError.fromCode('validation_error', {
      message: 'GATEKEEPER_ADMIN_TOKEN belum diset di environment server.',
    })
  }
  const url = `${env.GATEKEEPER_BASE_URL}${path}`
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(options.timeoutMs ?? 4500),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw ApiError.fromCode('upstream_ai_error', {
      message: data?.error || `Token Gatekeeper merespons HTTP ${res.status}`,
    })
  }
  return data
}

async function fetchGatekeeperOverviewSafe(): Promise<GatekeeperOverviewBlock> {
  const configured = env.GATEKEEPER_ADMIN_TOKEN.trim().length > 0
  if (!configured) {
    return {
      configured: false,
      online: false,
      base_url: env.GATEKEEPER_BASE_URL,
      error: null,
      summary: null,
      wallets: [],
      vouchers: [],
    }
  }
  try {
    const data = await callGatekeeperApi<{
      summary: GatekeeperSummaryStats
      wallets: GatekeeperWalletItem[]
      vouchers: Array<Record<string, unknown>>
    }>('/gatekeeper/api/overview', { method: 'GET', timeoutMs: 3000 })
    return {
      configured: true,
      online: true,
      base_url: env.GATEKEEPER_BASE_URL,
      error: null,
      summary: data.summary ?? null,
      wallets: data.wallets ?? [],
      vouchers: data.vouchers ?? [],
    }
  } catch (err) {
    return {
      configured: true,
      online: false,
      base_url: env.GATEKEEPER_BASE_URL,
      error: err instanceof Error ? err.message : 'Tidak dapat menghubungi Token Gatekeeper',
      summary: null,
      wallets: [],
      vouchers: [],
    }
  }
}

async function lookupGatekeeperWalletsSafe(
  items: Array<{ key: string; candidates: string[] }>,
): Promise<Record<string, GatekeeperWalletItem | null>> {
  if (!env.GATEKEEPER_ADMIN_TOKEN.trim() || items.length === 0) return {}
  try {
    const data = await callGatekeeperApi<{
      results: Record<string, GatekeeperWalletItem | null>
    }>('/gatekeeper/api/wallets/lookup', {
      method: 'POST',
      body: { items },
      timeoutMs: 3000,
    })
    return data.results ?? {}
  } catch {
    return {}
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
  token_gatekeeper: GatekeeperOverviewBlock
}

export async function getAdminOverview(actor: Actor): Promise<AdminOverviewOut> {
  await requireSuperadmin(actor)
  const [dbOverview, tokenGatekeeper] = await Promise.all([
    withActor(actor, async (tx) => {
      const [row] = await tx<[{ overview: Omit<AdminOverviewOut, 'runtime' | 'token_gatekeeper'> }]>`
        select public.admin_get_overview() as overview
      `
      return row!.overview
    }),
    fetchGatekeeperOverviewSafe(),
  ])

  return {
    ...dbOverview,
    runtime: {
      enforce_paid_features: env.ENFORCE_PAID_FEATURES,
      storage_provider: env.STORAGE_PROVIDER,
      rate_limit_per_minute: env.RATE_LIMIT_PER_MINUTE,
      rate_limit_per_day: env.RATE_LIMIT_PER_DAY,
    },
    token_gatekeeper: tokenGatekeeper,
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
  has_ai_key?: boolean
  ai_provider?: string | null
}

export interface AdminHouseholdAiConfigSummary {
  configured_members: number
  total_members: number
  provider: string | null
  model: string | null
  is_gatekeeper: boolean
  key_prefix: string | null
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
  ai_config_summary: AdminHouseholdAiConfigSummary
  token_wallet: GatekeeperWalletItem | null
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
            items: Array<
              Omit<AdminHouseholdItem, 'plan' | 'features' | 'token_wallet'> & {
                features: unknown
                ai_config_summary?: AdminHouseholdAiConfigSummary
              }
            >
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

  const rawItems = raw.items ?? []
  const lookupItems = rawItems.map((item) => {
    const memberEmails = (item.members ?? [])
      .map((m) => m.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e))
    const memberUserIds = (item.members ?? []).map((m) => `user:${m.user_id}`)
    return {
      key: item.id,
      candidates: [`hh:${item.id}`, item.id, ...memberEmails, ...memberUserIds],
    }
  })

  const walletsByHhId = await lookupGatekeeperWalletsSafe(lookupItems)

  const items: AdminHouseholdItem[] = rawItems.map((item) => ({
    ...item,
    features: parseHouseholdFeatures(item.features),
    plan: computeHouseholdPlanStatus({
      plan_tier: item.plan_tier,
      plan_expires_at: item.plan_expires_at,
      entitlements: item.entitlements_override,
    }),
    ai_config_summary: item.ai_config_summary ?? {
      configured_members: 0,
      total_members: item.members?.length ?? 0,
      provider: null,
      model: null,
      is_gatekeeper: false,
      key_prefix: null,
    },
    token_wallet: walletsByHhId[item.id] ?? null,
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

export async function provisionHouseholdTokens(
  actor: Actor,
  householdId: string,
  body: AdminHouseholdTokensBody,
) {
  await requireSuperadmin(actor)

  const ctx = await withActor(actor, async (tx) => {
    const [row] = await tx<
      [
        {
          result: {
            id: string
            name: string
            plan_tier: string
            member_count: number
            member_emails: string[]
            existing_gatekeeper_key: string | null
          }
        },
      ]
    >`
      select public.admin_get_household_ai_context(${householdId}) as result
    `
    return row!.result
  })

  const aliases = [`hh:${householdId}`, householdId, ...(ctx.member_emails ?? [])]
  const needFreshKey = Boolean(
    body.force_new_key || (body.auto_inject_key && !ctx.existing_gatekeeper_key),
  )

  const gkRes = await callGatekeeperApi<{
    ok: boolean
    wallet: GatekeeperWalletItem
    created_api_key: string | null
  }>('/gatekeeper/api/wallets/provision', {
    method: 'POST',
    body: {
      owner_id: `hh:${householdId}`,
      display_name: ctx.name,
      aliases,
      delta_tokens: body.delta_tokens ?? 0,
      set_balance: body.set_balance ?? null,
      create_key_if_missing: true,
      force_new_key: needFreshKey,
      key_name: `Keluarga ${ctx.name}`,
      reference_id: `karaya_admin:${actor.userId.slice(0, 8)}`,
    },
    timeoutMs: 6000,
  })

  const keyToInject = gkRes.created_api_key || ctx.existing_gatekeeper_key || null
  let injected: {
    household_id: string
    updated_members: number
    provider: string
    model: string
    key_prefix: string
  } | null = null

  if (body.auto_inject_key && keyToInject) {
    injected = await withActor(actor, async (tx) => {
      const [row] = await tx<
        [
          {
            result: {
              household_id: string
              updated_members: number
              provider: string
              model: string
              key_prefix: string
            }
          },
        ]
      >`
        select public.admin_set_household_ai_key(
          ${householdId},
          ${keyToInject},
          ${'gatekeeper'},
          ${body.model ?? 'kb-auto'}
        ) as result
      `
      return row!.result
    })
  }

  return {
    household_id: householdId,
    wallet: gkRes.wallet,
    created_api_key: gkRes.created_api_key,
    injected,
  }
}

export async function provisionStandaloneWallet(actor: Actor, body: AdminProvisionWalletBody) {
  await requireSuperadmin(actor)

  const gkRes = await callGatekeeperApi<{
    ok: boolean
    wallet: GatekeeperWalletItem
    created_api_key: string | null
  }>('/gatekeeper/api/wallets/provision', {
    method: 'POST',
    body: {
      owner_id: body.owner_id.trim(),
      display_name: body.display_name?.trim() || body.owner_id.trim(),
      aliases: body.aliases ?? [],
      delta_tokens: body.delta_tokens ?? 0,
      set_balance: body.set_balance ?? null,
      create_key_if_missing: body.create_key_if_missing ?? true,
      force_new_key: body.force_new_key ?? false,
      key_name: body.key_name ?? 'Karaya Key',
      reference_id: `karaya_admin:${actor.userId.slice(0, 8)}`,
    },
    timeoutMs: 6000,
  })

  return {
    wallet: gkRes.wallet,
    created_api_key: gkRes.created_api_key,
  }
}

export async function createGatekeeperVouchers(actor: Actor, body: AdminCreateVouchersBody) {
  await requireSuperadmin(actor)

  const gkRes = await callGatekeeperApi<{
    ok: boolean
    vouchers: Array<Record<string, unknown>>
  }>('/gatekeeper/api/vouchers', {
    method: 'POST',
    body: {
      token_amount: body.tokens,
      count: body.count ?? 1,
      batch_note: body.notes ?? '',
    },
    timeoutMs: 6000,
  })

  return {
    vouchers: gkRes.vouchers ?? [],
  }
}
