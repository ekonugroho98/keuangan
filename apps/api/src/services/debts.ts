import { ApiError } from '@karaya/shared/errors'
import { parseAmountId, AmountParseError } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveAccountRef, resolveOwnerMemberId } from './resolver'
import { todayInTz } from './period'

function parseAmt(i: { amount?: number; amount_text?: string }): number {
  try { return i.amount ?? parseAmountId(i.amount_text!) }
  catch (e) { if (e instanceof AmountParseError) throw ApiError.fromCode('invalid_amount_text'); throw e }
}

interface DebtRow {
  id: string; name: string; aliases: string[]; total: string; remaining: string; monthly: string
  due_date: string | null; notes: string; icon: string; color: string
  owner_member_id: string | null; owner_name: string | null
}

const DEBT_SELECT = `
  select d.id, d.name, d.aliases, d.total::text, v.remaining::text, d.monthly::text, d.due_date::text, d.notes,
         d.icon, d.color, d.owner_member_id, m.display_name as owner_name
  from v_debts v join debts d on d.id = v.id left join household_members m on m.id = d.owner_member_id
`

function mapDebt(r: DebtRow) {
  const total = Number(r.total)
  const remaining = Number(r.remaining)
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: r.id, name: r.name, aliases: r.aliases, total, remaining, paid: total - remaining, monthly: Number(r.monthly),
    due_date: r.due_date, is_overdue: !!r.due_date && r.due_date < today && remaining > 0,
    owner: r.owner_member_id ? { member_id: r.owner_member_id, display_name: r.owner_name } : null,
    notes: r.notes, icon: r.icon, color: r.color,
  }
}

export async function listDebts(actor: Actor, status: 'active' | 'settled' | 'all' = 'active') {
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<DebtRow[]>(`${DEBT_SELECT} where d.household_id = $1 and d.deleted_at is null order by d.created_at`, [actor.householdId])
    const mapped = rows.map(mapDebt)
    if (status === 'active') return mapped.filter((d) => d.remaining > 0)
    if (status === 'settled') return mapped.filter((d) => d.remaining <= 0)
    return mapped
  })
}

export async function createDebt(actor: Actor, input: { name: string; total: number; monthly: number; due_date?: string; owner: string; opening_paid: number; aliases: string[]; notes: string; icon?: string; color?: string }) {
  return withActor(actor, async (tx) => {
    const ownerMemberId = await resolveOwnerMemberId(tx, actor, input.owner)
    const [row] = await tx<{ id: string }[]>`
      insert into debts (household_id, owner_member_id, name, aliases, total, opening_paid, monthly, due_date, notes, icon, color)
      values (${actor.householdId}, ${ownerMemberId}, ${input.name}, ${input.aliases}, ${input.total}, ${input.opening_paid}, ${input.monthly}, ${input.due_date ?? null}, ${input.notes}, ${input.icon ?? '📋'}, ${input.color ?? '#ef4444'})
      returning id
    `
    const rows = await tx.unsafe<DebtRow[]>(`${DEBT_SELECT} where d.id = $1`, [row!.id])
    return mapDebt(rows[0]!)
  })
}

export async function updateDebt(actor: Actor, id: string, input: { name?: string; total?: number; remaining?: number; monthly?: number; due_date?: string | null; notes?: string; aliases?: string[]; owner?: string; icon?: string; color?: string }) {
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ total: string; opening_paid: string }[]>`select total::text, opening_paid::text from debts where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('debt_not_found')
    const ownerMemberId = input.owner !== undefined ? await resolveOwnerMemberId(tx, actor, input.owner) : undefined

    // total/remaining dikoreksi langsung (setara perilaku lama edit hutang) — bukan via pay_debt,
    // karena ini pembetulan data, bukan pembayaran baru. opening_paid dihitung ulang supaya
    // remaining derived (v_debts) sama dengan nilai yang diminta, tanpa mengganggu riwayat
    // debt_payments yang sudah ada: opening_paid_baru = total_baru - remaining_baru - sum(payments aktif).
    let newOpeningPaid: number | undefined
    if (input.total !== undefined || input.remaining !== undefined) {
      const [cur] = await tx<{ remaining: string }[]>`select remaining::text from v_debts where id = ${id}`
      const sumPayments = Number(existing.total) - Number(existing.opening_paid) - Number(cur!.remaining)
      const newTotal = input.total ?? Number(existing.total)
      const newRemaining = input.remaining ?? Number(cur!.remaining)
      newOpeningPaid = Math.max(0, newTotal - newRemaining - sumPayments)
    }

    await tx`
      update debts set
        name = coalesce(${input.name ?? null}, name), monthly = coalesce(${input.monthly ?? null}, monthly),
        total = coalesce(${input.total ?? null}, total),
        opening_paid = coalesce(${newOpeningPaid ?? null}, opening_paid),
        due_date = ${input.due_date === undefined ? tx`due_date` : input.due_date},
        notes = coalesce(${input.notes ?? null}, notes), aliases = coalesce(${input.aliases ?? null}, aliases),
        owner_member_id = ${ownerMemberId === undefined ? tx`owner_member_id` : ownerMemberId},
        icon = coalesce(${input.icon ?? null}, icon), color = coalesce(${input.color ?? null}, color), updated_at = now()
      where id = ${id}
    `
    const rows = await tx.unsafe<DebtRow[]>(`${DEBT_SELECT} where d.id = $1`, [id])
    return mapDebt(rows[0]!)
  })
}

export async function deleteDebt(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`update debts set deleted_at = now() where id = ${id} and household_id = ${actor.householdId} and deleted_at is null returning id`
    if (!row) throw ApiError.fromCode('debt_not_found')
    return { success: true }
  })
}

export async function payDebt(actor: Actor, id: string, input: { amount?: number; amount_text?: string; account_id?: string; account?: string; date?: string; note?: string; allow_overpay: boolean }, timezone: string) {
  const amount = parseAmt(input)
  return withActor(actor, async (tx) => {
    const accountId = await resolveAccountRef(tx, actor, input)
    const [row] = await tx<[{ result: unknown }]>`
      select pay_debt(${actor.householdId}, ${actor.memberId}, ${id}, ${accountId}, ${amount}, ${input.date ?? todayInTz(timezone)}, ${input.note ?? null}, ${input.allow_overpay}) as result
    `
    return row!.result
  })
}

export async function listDebtPayments(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const rows = await tx<{ id: string; amount: string; date: string; note: string; member_id: string; display_name: string }[]>`
      select p.id, p.amount::text, p.date::text, p.note, p.member_id, m.display_name
      from debt_payments p join household_members m on m.id = p.member_id
      where p.debt_id = ${id} order by p.date desc, p.created_at desc
    `
    return rows.map((r) => ({ id: r.id, amount: Number(r.amount), date: r.date, note: r.note, member: { member_id: r.member_id, display_name: r.display_name } }))
  })
}
