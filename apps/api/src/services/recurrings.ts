import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveAccountRef, resolveCategoryRef } from './resolver'

interface RecurringRow {
  id: string; name: string; type: string; amount: string; frequency: string; next_date: string
  active: boolean; last_run_at: string | null; last_error: string | null
  account_id: string; account_name: string; category_id: string; category_name: string
  debt_id: string | null; debt_name: string | null
}

const REC_SELECT = `
  select r.id, r.name, r.type, r.amount::text, r.frequency, r.next_date::text, r.active, r.last_run_at::text, r.last_error,
         r.account_id, a.name as account_name, r.category_id, c.name as category_name, r.debt_id, d.name as debt_name
  from recurring_transactions r join accounts a on a.id = r.account_id join categories c on c.id = r.category_id
  left join debts d on d.id = r.debt_id
`

function mapRecurring(r: RecurringRow) {
  const today = new Date().toISOString().slice(0, 10)
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  let status: string = 'scheduled'
  if (!r.active) status = 'paused'
  else if (r.next_date < today) status = 'overdue'
  else if (r.next_date <= soon) status = 'due_soon'
  return {
    id: r.id, name: r.name, type: r.type, amount: Number(r.amount),
    category: { id: r.category_id, name: r.category_name }, account: { id: r.account_id, name: r.account_name },
    frequency: r.frequency, next_date: r.next_date, status,
    debt: r.debt_id ? { id: r.debt_id, name: r.debt_name } : null,
    active: r.active, last_run_at: r.last_run_at, last_error: r.last_error,
  }
}

export async function listRecurrings(actor: Actor) {
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<RecurringRow[]>(`${REC_SELECT} where r.household_id = $1 and r.deleted_at is null order by r.next_date`, [actor.householdId])
    return rows.map(mapRecurring)
  })
}

export async function createRecurring(actor: Actor, input: { name: string; type: 'income' | 'expense'; amount: number; category_id?: string; category?: string; account_id?: string; account?: string; frequency: string; next_date: string; debt_id?: string; notes: string }) {
  return withActor(actor, async (tx) => {
    const accountId = await resolveAccountRef(tx, actor, input)
    const categoryId = await resolveCategoryRef(tx, actor, input, input.type)
    const [row] = await tx<{ id: string }[]>`
      insert into recurring_transactions (household_id, member_id, name, type, amount, category_id, account_id, frequency, next_date, debt_id, notes)
      values (${actor.householdId}, ${actor.memberId}, ${input.name}, ${input.type}, ${input.amount}, ${categoryId}, ${accountId}, ${input.frequency}, ${input.next_date}, ${input.debt_id ?? null}, ${input.notes})
      returning id
    `
    const rows = await tx.unsafe<RecurringRow[]>(`${REC_SELECT} where r.id = $1`, [row!.id])
    return mapRecurring(rows[0]!)
  })
}

export async function updateRecurring(actor: Actor, id: string, input: { name?: string; amount?: number; category_id?: string; category?: string; account_id?: string; account?: string; frequency?: string; next_date?: string; debt_id?: string | null; notes?: string; active?: boolean }) {
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from recurring_transactions where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('recurring_not_found')
    const categoryId = input.category_id || input.category ? await resolveCategoryRef(tx, actor, input) : null
    const accountId = input.account_id || input.account ? await resolveAccountRef(tx, actor, input) : null
    await tx`
      update recurring_transactions set
        name = coalesce(${input.name ?? null}, name), amount = coalesce(${input.amount ?? null}, amount),
        category_id = coalesce(${categoryId}, category_id), account_id = coalesce(${accountId}, account_id),
        frequency = coalesce(${input.frequency ?? null}, frequency),
        next_date = coalesce(${input.next_date ?? null}, next_date),
        debt_id = ${input.debt_id === undefined ? tx`debt_id` : input.debt_id},
        notes = coalesce(${input.notes ?? null}, notes),
        active = coalesce(${input.active ?? null}, active), updated_at = now()
      where id = ${id}
    `
    const rows = await tx.unsafe<RecurringRow[]>(`${REC_SELECT} where r.id = $1`, [id])
    return mapRecurring(rows[0]!)
  })
}

export async function deleteRecurring(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`update recurring_transactions set deleted_at = now() where id = ${id} and household_id = ${actor.householdId} and deleted_at is null returning id`
    if (!row) throw ApiError.fromCode('recurring_not_found')
    return { success: true }
  })
}

export async function runRecurrings(actor: Actor, today?: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<[{ result: { executed: number; skipped: unknown[] } }]>`
      select run_due_recurrings(${actor.householdId}, ${today ?? null}) as result
    `
    return row!.result
  })
}
