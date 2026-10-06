import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveOwnerMemberId } from './resolver'

export interface AccountOut {
  id: string
  name: string
  aliases: string[]
  type: string
  visibility: 'shared' | 'private'
  owner: { member_id: string; display_name: string } | null
  balance: number | null
  can_view: boolean
  can_post: boolean
  can_receive_transfer: boolean
  icon: string
  color: string
  tx_count: number | null
  last_tx_date: string | null
  needs_review: boolean
}

interface AccountRow {
  id: string
  name: string
  aliases: string[]
  type: string
  visibility: 'shared' | 'private'
  owner_member_id: string | null
  owner_display_name: string | null
  balance: string | null
  tx_count: string | null
  last_tx_date: string | null
  icon: string
  color: string
  needs_review: boolean
}

function mapRow(actor: Actor, r: AccountRow): AccountOut {
  const isOwnerSelf = r.owner_member_id === actor.memberId
  const canView = r.visibility === 'shared' || isOwnerSelf
  const canPost = canView && actor.role !== 'viewer'
  return {
    id: r.id,
    name: r.name,
    aliases: r.aliases,
    type: r.type,
    visibility: r.visibility,
    owner: r.owner_member_id ? { member_id: r.owner_member_id, display_name: r.owner_display_name! } : null,
    balance: canView && r.balance !== null ? Number(r.balance) : null,
    can_view: canView,
    can_post: canPost,
    can_receive_transfer: true,
    icon: r.icon,
    color: r.color,
    tx_count: canView && r.tx_count !== null ? Number(r.tx_count) : null,
    last_tx_date: canView ? r.last_tx_date : null,
    needs_review: r.needs_review,
  }
}

export async function listAccounts(actor: Actor, opts: { includeDeleted?: boolean } = {}) {
  return withActor(actor, async (tx) => {
    const rows = await tx<AccountRow[]>`
      select a.id, a.name, a.aliases, a.type, a.visibility, a.owner_member_id,
             m.display_name as owner_display_name, v.balance, v.tx_count, v.last_tx_date,
             a.icon, a.color, a.needs_review
      from accounts a
      left join household_members m on m.id = a.owner_member_id
      left join v_account_balances v on v.account_id = a.id
      where a.household_id = ${actor.householdId}
        ${opts.includeDeleted ? tx`` : tx`and a.deleted_at is null`}
      order by a.sort_order, a.created_at
    `
    const data = rows.map((r) => mapRow(actor, r))
    const visibleBalance = data.reduce((sum, a) => sum + (a.balance ?? 0), 0)
    const hiddenPrivateAccounts = data.filter((a) => !a.can_view).length
    return { data, totals: { visible_balance: visibleBalance, hidden_private_accounts: hiddenPrivateAccounts } }
  })
}

export async function getAccount(actor: Actor, id: string): Promise<AccountOut> {
  return withActor(actor, async (tx) => {
    const rows = await tx<AccountRow[]>`
      select a.id, a.name, a.aliases, a.type, a.visibility, a.owner_member_id,
             m.display_name as owner_display_name, v.balance, v.tx_count, v.last_tx_date,
             a.icon, a.color, a.needs_review
      from accounts a
      left join household_members m on m.id = a.owner_member_id
      left join v_account_balances v on v.account_id = a.id
      where a.household_id = ${actor.householdId} and a.id = ${id} and a.deleted_at is null
    `
    if (rows.length === 0) throw ApiError.fromCode('account_not_found')
    return mapRow(actor, rows[0]!)
  })
}

export interface CreateAccountInput {
  name: string
  type: string
  owner: string
  visibility?: 'shared' | 'private'
  opening_balance: number
  aliases: string[]
  icon?: string
  color?: string
}

const TYPE_ICONS: Record<string, string> = {
  bank: '🏦', ewallet: '📱', cash: '💵', crypto: '₿', investasi: '📈', tabungan: '🪙',
}

export async function createAccount(actor: Actor, input: CreateAccountInput): Promise<AccountOut> {
  if (actor.role !== 'owner' && actor.role !== 'member') throw ApiError.fromCode('insufficient_scope')

  return withActor(actor, async (tx) => {
    const ownerMemberId = await resolveOwnerMemberId(tx, actor, input.owner)
    if (ownerMemberId !== actor.memberId && actor.role !== 'owner') {
      throw ApiError.fromCode('forbidden_owner')
    }
    const visibility = input.visibility ?? (ownerMemberId === null ? 'shared' : 'shared')
    if (ownerMemberId === null && visibility === 'private') {
      throw ApiError.fromCode('private_requires_owner')
    }

    try {
      const [acc] = await tx<AccountRow[]>`
        insert into accounts (household_id, owner_member_id, name, type, visibility, opening_balance, aliases, icon, color)
        values (
          ${actor.householdId}, ${ownerMemberId}, ${input.name}, ${input.type}, ${visibility},
          ${input.opening_balance}, ${input.aliases},
          ${input.icon ?? TYPE_ICONS[input.type] ?? '💰'}, ${input.color ?? '#6366f1'}
        )
        returning id, name, aliases, type, visibility, owner_member_id, null::text as owner_display_name,
                  opening_balance::text as balance, 0::text as tx_count, null::date as last_tx_date, icon, color, needs_review
      `
      if (ownerMemberId) {
        const [m] = await tx<{ display_name: string }[]>`select display_name from household_members where id = ${ownerMemberId}`
        acc!.owner_display_name = m?.display_name ?? null
      }
      return mapRow(actor, acc!)
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.fromCode('duplicate_account_name')
      throw err
    }
  })
}

export interface UpdateAccountInput {
  name?: string
  aliases?: string[]
  type?: string
  visibility?: 'shared' | 'private'
  owner?: string
  icon?: string
  color?: string
  sort_order?: number
  restore?: boolean
}

export async function updateAccount(actor: Actor, id: string, input: UpdateAccountInput): Promise<AccountOut> {
  return withActor(actor, async (tx) => {
    const [current] = await tx<{ owner_member_id: string | null; deleted_at: string | null }[]>`
      select owner_member_id, deleted_at from accounts where id = ${id} and household_id = ${actor.householdId}
    `
    if (!current) throw ApiError.fromCode('account_not_found')
    if (current.deleted_at && !input.restore) throw ApiError.fromCode('account_not_found')

    if (actor.role !== 'owner' && current.owner_member_id !== actor.memberId) {
      throw ApiError.fromCode('forbidden')
    }

    let ownerMemberId = current.owner_member_id
    if (input.owner !== undefined) {
      if (actor.role !== 'owner') throw ApiError.fromCode('forbidden_owner')
      ownerMemberId = await resolveOwnerMemberId(tx, actor, input.owner)
    }

    try {
      const [row] = await tx<AccountRow[]>`
        update accounts set
          name = coalesce(${input.name ?? null}, name),
          aliases = coalesce(${input.aliases ?? null}, aliases),
          type = coalesce(${input.type ?? null}, type),
          visibility = coalesce(${input.visibility ?? null}, visibility),
          owner_member_id = ${ownerMemberId},
          icon = coalesce(${input.icon ?? null}, icon),
          color = coalesce(${input.color ?? null}, color),
          sort_order = coalesce(${input.sort_order ?? null}, sort_order),
          deleted_at = case when ${input.restore ?? false} then null else deleted_at end,
          updated_at = now()
        where id = ${id} and household_id = ${actor.householdId}
        returning id, name, aliases, type, visibility, owner_member_id, null::text as owner_display_name,
                  null::text as balance, null::text as tx_count, null::date as last_tx_date, icon, color, needs_review
      `
      const [v] = await tx<{ balance: string; tx_count: string; last_tx_date: string | null }[]>`
        select balance::text, tx_count::text, last_tx_date from v_account_balances where account_id = ${id}
      `
      row!.balance = v?.balance ?? '0'
      row!.tx_count = v?.tx_count ?? '0'
      row!.last_tx_date = v?.last_tx_date ?? null
      if (row!.owner_member_id) {
        const [m] = await tx<{ display_name: string }[]>`select display_name from household_members where id = ${row!.owner_member_id}`
        row!.owner_display_name = m?.display_name ?? null
      }
      return mapRow(actor, row!)
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.fromCode('duplicate_account_name')
      throw err
    }
  })
}

export async function deleteAccount(actor: Actor, id: string, forceArchive: boolean) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`select delete_account(${actor.householdId}, ${actor.memberId}, ${id}, ${forceArchive}) as id`
    return row
  })
}

export async function adjustBalance(actor: Actor, id: string, newBalance: number, date?: string, note?: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<[{ result: { account: unknown; transaction: unknown; diff: number } }]>`
      select adjust_balance(${actor.householdId}, ${actor.memberId}, ${id}, ${newBalance}, ${date ?? null}, ${note ?? null}) as result
    `
    return row!.result
  })
}

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === '23505'
}
