import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { parseAmountId, AmountParseError } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveAccountRef, resolveCategoryRef, resolveMemberRef, resolveBeneficiaryRef } from './resolver'
import { resolvePeriod, todayInTz } from './period'
import { assertBeneficiaryFieldAllowed } from './features'

// Gate fitur beneficiary ada di dalam resolveBeneficiaryRef (features.ts) — di sini hanya perlu
// tahu apakah field disentuh, untuk memutuskan apakah key `beneficiary_id` ikut ditulis.
function touchesBeneficiary(ref: { beneficiary_id?: string | null; beneficiary?: string }): boolean {
  return ref.beneficiary_id !== undefined || ref.beneficiary !== undefined
}

function parseAmount(input: { amount?: number; amount_text?: string }): number {
  try {
    if (input.amount !== undefined) return input.amount
    return parseAmountId(input.amount_text!)
  } catch (err) {
    if (err instanceof AmountParseError) {
      throw ApiError.fromCode('invalid_amount_text', { details: { input: err.input } })
    }
    throw err
  }
}

export interface TxRow {
  id: string
  type: string
  amount: string
  date: string
  note: string
  account_id: string
  account_name: string
  account_owner_member_id: string | null
  account_owner_display_name: string | null
  to_account_id: string | null
  to_account_name: string | null
  to_account_owner_member_id: string | null
  to_account_owner_display_name: string | null
  category_id: string
  category_name: string
  category_icon: string
  category_color: string
  beneficiary_id: string | null
  beneficiary_name: string | null
  beneficiary_kind: string | null
  recorded_by_member_id: string
  recorded_by_display_name: string
  source: string
  recurring_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function mapTx(r: TxRow) {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    date: r.date,
    note: r.note,
    account: { id: r.account_id, name: r.account_name, owner: r.account_owner_member_id ? { member_id: r.account_owner_member_id, display_name: r.account_owner_display_name } : null },
    to_account: r.to_account_id ? { id: r.to_account_id, name: r.to_account_name, owner: r.to_account_owner_member_id ? { member_id: r.to_account_owner_member_id, display_name: r.to_account_owner_display_name } : null } : null,
    category: { id: r.category_id, name: r.category_name, icon: r.category_icon, color: r.category_color },
    beneficiary: r.beneficiary_id ? { id: r.beneficiary_id, name: r.beneficiary_name!, kind: r.beneficiary_kind! } : null,
    recorded_by: { member_id: r.recorded_by_member_id, display_name: r.recorded_by_display_name },
    source: r.source,
    recurring_id: r.recurring_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted_at: r.deleted_at,
  }
}

export const TX_SELECT = `
  select t.id, t.type, t.amount::text, t.date::text, t.note,
         t.account_id, a.name as account_name, a.owner_member_id as account_owner_member_id, am.display_name as account_owner_display_name,
         t.to_account_id, ta.name as to_account_name, ta.owner_member_id as to_account_owner_member_id, tam.display_name as to_account_owner_display_name,
         t.category_id, c.name as category_name, c.icon as category_icon, c.color as category_color,
         t.beneficiary_id, coalesce(bm.display_name, b.name) as beneficiary_name, b.kind::text as beneficiary_kind,
         t.recorded_by_member_id, rm.display_name as recorded_by_display_name,
         t.source, t.recurring_id, t.created_at, t.updated_at, t.deleted_at
  from transactions t
  join accounts a on a.id = t.account_id
  left join household_members am on am.id = a.owner_member_id
  left join accounts ta on ta.id = t.to_account_id
  left join household_members tam on tam.id = ta.owner_member_id
  join categories c on c.id = t.category_id
  left join beneficiaries b on b.id = t.beneficiary_id
  left join household_members bm on bm.id = b.member_id and bm.deleted_at is null
  join household_members rm on rm.id = t.recorded_by_member_id
`

export interface TransactionListQuery {
  period?: string
  from?: string
  to?: string
  type?: string
  account_id?: string
  account?: string
  category_id?: string
  category?: string
  member_id?: string
  member?: string
  beneficiary_id?: string
  beneficiary?: string
  attribution: 'owner' | 'recorded_by'
  q?: string
  min_amount?: number
  max_amount?: number
  include_deleted: boolean
  limit: number
  cursor?: string
}

function decodeCursor(cursor?: string): { date: string; createdAt: string; id: string } | null {
  if (!cursor) return null
  try {
    const [date, createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    return { date: date!, createdAt: createdAt!, id: id! }
  } catch {
    throw ApiError.fromCode('invalid_cursor')
  }
}

function encodeCursor(date: string, createdAt: string, id: string): string {
  return Buffer.from(`${date}|${createdAt}|${id}`, 'utf8').toString('base64url')
}

/** Bangun klausa WHERE + array parameter secara dinamis, $N selalu sinkron dengan posisi di params. */
function buildTxFilter(
  actor: Actor,
  query: TransactionListQuery,
  resolved: { dateFrom?: string; dateTo?: string; accountId?: string; categoryId?: string; memberId?: string; beneficiaryId?: string | 'none' },
  cur: { date: string; createdAt: string; id: string } | null,
): { where: string; params: postgres.ParameterOrJSON<never>[] } {
  const params: postgres.ParameterOrJSON<never>[] = [actor.householdId]
  const clauses = ['t.household_id = $1']
  const push = (v: postgres.ParameterOrJSON<never>) => { params.push(v); return `$${params.length}` }

  if (!query.include_deleted) clauses.push('t.deleted_at is null')
  if (resolved.dateFrom) clauses.push(`t.date >= ${push(resolved.dateFrom)}`)
  if (resolved.dateTo) clauses.push(`t.date <= ${push(resolved.dateTo)}`)
  if (query.type) clauses.push(`t.type = ${push(query.type)}`)
  if (resolved.accountId) {
    const p = push(resolved.accountId)
    clauses.push(`(t.account_id = ${p} or t.to_account_id = ${p})`)
  }
  if (resolved.categoryId) clauses.push(`t.category_id = ${push(resolved.categoryId)}`)
  if (resolved.memberId) {
    const p = push(resolved.memberId)
    clauses.push(query.attribution === 'recorded_by' ? `t.recorded_by_member_id = ${p}` : `(a.owner_member_id = ${p} or ta.owner_member_id = ${p})`)
  }
  if (resolved.beneficiaryId === 'none') {
    clauses.push('t.beneficiary_id is null')
  } else if (resolved.beneficiaryId) {
    clauses.push(`t.beneficiary_id = ${push(resolved.beneficiaryId)}`)
  }
  if (query.q) clauses.push(`t.note ilike ${push(`%${query.q}%`)}`)
  if (query.min_amount !== undefined) clauses.push(`t.amount >= ${push(query.min_amount)}`)
  if (query.max_amount !== undefined) clauses.push(`t.amount <= ${push(query.max_amount)}`)
  if (cur) {
    const pd = push(cur.date)
    const pc = push(cur.createdAt)
    const pi = push(cur.id)
    clauses.push(`(t.date, t.created_at, t.id) < (${pd}, ${pc}, ${pi})`)
  }
  return { where: clauses.join(' and '), params }
}

export async function listTransactions(actor: Actor, query: TransactionListQuery, timezone: string) {
  return withActor(actor, async (tx) => {
    let dateFrom = query.from
    let dateTo = query.to
    if (query.period) {
      const p = resolvePeriod(query.period, timezone, query.from, query.to)
      dateFrom = p.from
      dateTo = p.to
    }

    const accountId = query.account_id || query.account ? await resolveAccountRef(tx, actor, query, 'account') : undefined
    const categoryId = query.category_id || query.category ? await resolveCategoryRef(tx, actor, query) : undefined
    const memberId = query.member_id || query.member ? await resolveMemberRef(tx, actor, query) : undefined
    let beneficiaryId: string | 'none' | undefined
    if (query.beneficiary === 'none') {
      await assertBeneficiaryFieldAllowed(tx, actor) // sentinel tidak lewat resolver, gate manual
      beneficiaryId = 'none'
    } else if (touchesBeneficiary(query)) {
      beneficiaryId = await resolveBeneficiaryRef(tx, actor, query)
    }
    const cur = decodeCursor(query.cursor)
    const resolved = { dateFrom, dateTo, accountId, categoryId, memberId, beneficiaryId }

    const { where, params } = buildTxFilter(actor, query, resolved, cur)
    const limitParam = params.length + 1
    const rows = await tx.unsafe<TxRow[]>(
      `${TX_SELECT} where ${where} order by t.date desc, t.created_at desc, t.id desc limit $${limitParam}`,
      [...params, query.limit + 1],
    )

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!.date, page[page.length - 1]!.created_at, page[page.length - 1]!.id) : null

    // Totals: hitung ulang filter TANPA klausa cursor (totals atas seluruh hasil filter, 05-api.md §4.5).
    const { where: totalsWhere, params: totalsParams } = buildTxFilter(actor, query, resolved, null)
    const [totalsRow] = await tx.unsafe<{ income: string; expense: string; transfer: string; count: string }[]>(
      `select
         coalesce(sum(case when t.type='income' then t.amount end),0)::text as income,
         coalesce(sum(case when t.type='expense' then t.amount end),0)::text as expense,
         coalesce(sum(case when t.type='transfer' then t.amount end),0)::text as transfer,
         count(*)::text as count
       from transactions t
       join accounts a on a.id = t.account_id
       left join accounts ta on ta.id = t.to_account_id
       where ${totalsWhere}`,
      totalsParams,
    )

    return {
      data: page.map(mapTx),
      next_cursor: nextCursor,
      has_more: hasMore,
      totals: {
        income: Number(totalsRow!.income), expense: Number(totalsRow!.expense),
        transfer: Number(totalsRow!.transfer), count: Number(totalsRow!.count),
      },
    }
  })
}

export async function getTransaction(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1 and t.household_id = $2 and t.deleted_at is null`, [id, actor.householdId])
    if (rows.length === 0) throw ApiError.fromCode('transaction_not_found')
    return mapTx(rows[0]!)
  })
}

export interface CreateTransactionInput {
  type: 'income' | 'expense'
  amount?: number
  amount_text?: string
  account_id?: string
  account?: string
  category_id?: string
  category?: string
  date?: string
  note?: string
  beneficiary_id?: string
  beneficiary?: string
}

export async function createTransaction(actor: Actor, input: CreateTransactionInput, timezone: string) {
  const amount = parseAmount(input)
  return withActor(actor, async (tx) => {
    const accountId = await resolveAccountRef(tx, actor, input)
    const categoryId = await resolveCategoryRef(tx, actor, input, input.type)
    const beneficiaryId = (await resolveBeneficiaryRef(tx, actor, input)) ?? null
    const [row] = await tx<{ id: string }[]>`
      select id from post_transaction(
        ${actor.householdId}, ${actor.memberId}, ${input.type}, ${accountId}, ${categoryId},
        ${amount}, ${input.date ?? todayInTz(timezone)}, ${input.note ?? ''}, 'web', null, ${beneficiaryId}
      )
    `
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [row!.id])
    const [accRow] = await tx<{ balance: string }[]>`select balance::text from v_account_balances where account_id = ${accountId}`
    return { transaction: mapTx(rows[0]!), account: { id: accountId, balance: Number(accRow!.balance) } }
  })
}

export async function createTransactionBatch(actor: Actor, input: { account_id?: string; account?: string; date?: string; items: Array<{ amount?: number; amount_text?: string; category_id?: string; category?: string; note?: string; beneficiary_id?: string; beneficiary?: string }> }, timezone: string) {
  return withActor(actor, async (tx) => {
    const accountId = await resolveAccountRef(tx, actor, input)
    const items = await Promise.all(
      input.items.map(async (item) => ({
        amount: parseAmount(item),
        category_id: await resolveCategoryRef(tx, actor, item, 'expense'),
        note: item.note ?? '',
        beneficiary_id: (await resolveBeneficiaryRef(tx, actor, item)) ?? null,
      })),
    )
    const date = input.date ?? todayInTz(timezone)
    // BUG NYATA ditemukan saat implementasi F-A (belum pernah ketahuan — tidak ada test yang
    // memanggil /v1/transactions/batch sebelumnya): `${JSON.stringify(items)}::jsonb` membuat
    // postgres.js men-stringify ULANG nilai yang sudah string karena melihat cast `::jsonb` di
    // tagged template, menghasilkan jsonb STRING SCALAR (bukan ARRAY) -> post_transactions_batch
    // akan gagal di `jsonb_array_length(p_items)`. `tx.json(items)` adalah satu-satunya cara aman
    // (pola sama dengan routes/me.ts).
    const createdRows = await tx<{ id: string }[]>`
      select id from post_transactions_batch(${actor.householdId}, ${actor.memberId}, ${accountId}, ${date}, ${tx.json(items as unknown as postgres.JSONValue)}, 'web')
    `
    const ids = createdRows.map((r) => r.id)
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = any($1::uuid[])`, [ids])
    const [accRow] = await tx<{ balance: string }[]>`select balance::text from v_account_balances where account_id = ${accountId}`
    return { transactions: rows.map(mapTx), account: { id: accountId, balance: Number(accRow!.balance) } }
  })
}

export interface UpdateTransactionInput {
  amount?: number
  amount_text?: string
  type?: 'income' | 'expense'
  account_id?: string
  account?: string
  category_id?: string
  category?: string
  date?: string
  note?: string
  beneficiary_id?: string | null
  beneficiary?: string
}

export async function updateTransaction(actor: Actor, id: string, input: UpdateTransactionInput) {
  return withActor(actor, async (tx) => {
    const patch: Record<string, unknown> = {}
    if (input.amount !== undefined || input.amount_text !== undefined) patch.amount = parseAmount(input)
    if (input.type !== undefined) patch.type = input.type
    if (input.account_id || input.account) patch.account_id = await resolveAccountRef(tx, actor, input)
    if (input.category_id || input.category) patch.category_id = await resolveCategoryRef(tx, actor, input)
    if (input.date !== undefined) patch.date = input.date
    if (input.note !== undefined) patch.note = input.note
    if (touchesBeneficiary(input)) {
      // null eksplisit di body -> resolveBeneficiaryRef mengembalikan undefined -> ?? null di sini
      // sengaja menulis KEY `beneficiary_id` dengan nilai jsonb null (bukan key dihilangkan) supaya
      // update_transaction (p_patch ? 'beneficiary_id') membedakan "tidak disentuh" vs "dikosongkan".
      patch.beneficiary_id = (await resolveBeneficiaryRef(tx, actor, input)) ?? null
    }

    await tx`select update_transaction(${actor.householdId}, ${actor.memberId}, ${id}, ${tx.json(patch as unknown as postgres.JSONValue)})`
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [id])
    return mapTx(rows[0]!)
  })
}

export async function deleteTransaction(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    await tx`select delete_transaction(${actor.householdId}, ${actor.memberId}, ${id})`
    // TX_SELECT tidak menyertakan filter deleted_at; baris yang baru di-soft-delete tetap terbaca di sini.
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [id])
    return mapTx(rows[0]!)
  })
}

export async function restoreTransaction(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    await tx`select restore_transaction(${actor.householdId}, ${actor.memberId}, ${id})`
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [id])
    return mapTx(rows[0]!)
  })
}
