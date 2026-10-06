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

interface PiutangRow {
  id: string; borrower_name: string; total: string; remaining: string; due_date: string | null
  from_account_id: string | null; notes: string; icon: string; color: string
  owner_member_id: string | null; owner_name: string | null
}

const PIUTANG_SELECT = `
  select p.id, p.borrower_name, p.total::text, v.remaining::text, p.due_date::text, p.from_account_id, p.notes,
         p.icon, p.color, p.owner_member_id, m.display_name as owner_name
  from v_piutang v join piutang p on p.id = v.id left join household_members m on m.id = p.owner_member_id
`

function mapPiutang(r: PiutangRow) {
  const total = Number(r.total)
  const remaining = Number(r.remaining)
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: r.id, borrower_name: r.borrower_name, total, remaining, received: total - remaining,
    due_date: r.due_date, is_overdue: !!r.due_date && r.due_date < today && remaining > 0,
    from_account_id: r.from_account_id,
    owner: r.owner_member_id ? { member_id: r.owner_member_id, display_name: r.owner_name } : null,
    notes: r.notes, icon: r.icon, color: r.color,
  }
}

export async function listPiutang(actor: Actor) {
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<PiutangRow[]>(`${PIUTANG_SELECT} where p.household_id = $1 and p.deleted_at is null order by p.created_at`, [actor.householdId])
    return rows.map(mapPiutang)
  })
}

export async function createPiutang(actor: Actor, input: { borrower_name: string; total: number; opening_received?: number; from_account_id?: string; from_account?: string; owner: string; due_date?: string; notes: string; date?: string; icon?: string; color?: string }, timezone: string) {
  return withActor(actor, async (tx) => {
    const ownerMemberId = await resolveOwnerMemberId(tx, actor, input.owner)
    const fromAccountId = input.from_account_id || input.from_account ? await resolveAccountRef(tx, actor, { account_id: input.from_account_id, account: input.from_account }, 'from_account') : null
    const [row] = await tx<[{ result: unknown }]>`
      select lend_piutang(${actor.householdId}, ${actor.memberId}, ${input.borrower_name}, ${input.total}, ${fromAccountId}, ${ownerMemberId}, ${input.due_date ?? null}, ${input.notes}, ${input.date ?? todayInTz(timezone)}, ${input.opening_received ?? 0}, ${input.icon ?? null}, ${input.color ?? null}) as result
    `
    return row!.result
  })
}

export async function updatePiutang(actor: Actor, id: string, input: { borrower_name?: string; total?: number; remaining?: number; due_date?: string | null; notes?: string; owner?: string; icon?: string; color?: string }) {
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ total: string; opening_received: string }[]>`select total::text, opening_received::text from piutang where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('piutang_not_found')
    const ownerMemberId = input.owner !== undefined ? await resolveOwnerMemberId(tx, actor, input.owner) : undefined

    let newOpeningReceived: number | undefined
    if (input.total !== undefined || input.remaining !== undefined) {
      const [cur] = await tx<{ remaining: string }[]>`select remaining::text from v_piutang where id = ${id}`
      const sumReceipts = Number(existing.total) - Number(existing.opening_received) - Number(cur!.remaining)
      const newTotal = input.total ?? Number(existing.total)
      const newRemaining = input.remaining ?? Number(cur!.remaining)
      newOpeningReceived = Math.max(0, newTotal - newRemaining - sumReceipts)
    }

    await tx`
      update piutang set
        borrower_name = coalesce(${input.borrower_name ?? null}, borrower_name),
        total = coalesce(${input.total ?? null}, total),
        opening_received = coalesce(${newOpeningReceived ?? null}, opening_received),
        due_date = ${input.due_date === undefined ? tx`due_date` : input.due_date},
        notes = coalesce(${input.notes ?? null}, notes),
        owner_member_id = ${ownerMemberId === undefined ? tx`owner_member_id` : ownerMemberId},
        icon = coalesce(${input.icon ?? null}, icon), color = coalesce(${input.color ?? null}, color), updated_at = now()
      where id = ${id}
    `
    const rows = await tx.unsafe<PiutangRow[]>(`${PIUTANG_SELECT} where p.id = $1`, [id])
    return mapPiutang(rows[0]!)
  })
}

export async function deletePiutang(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`update piutang set deleted_at = now() where id = ${id} and household_id = ${actor.householdId} and deleted_at is null returning id`
    if (!row) throw ApiError.fromCode('piutang_not_found')
    return { success: true }
  })
}

export async function receivePiutang(actor: Actor, id: string, input: { amount?: number; amount_text?: string; account_id?: string; account?: string; date?: string; note?: string; allow_overpay: boolean }, timezone: string) {
  const amount = parseAmt(input)
  return withActor(actor, async (tx) => {
    const accountId = await resolveAccountRef(tx, actor, input)
    const [row] = await tx<[{ result: unknown }]>`
      select receive_piutang(${actor.householdId}, ${actor.memberId}, ${id}, ${accountId}, ${amount}, ${input.date ?? todayInTz(timezone)}, ${input.note ?? null}, ${input.allow_overpay}) as result
    `
    return row!.result
  })
}

export async function listPiutangReceipts(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const rows = await tx<{ id: string; amount: string; date: string; note: string; member_id: string; display_name: string }[]>`
      select r.id, r.amount::text, r.date::text, r.note, r.member_id, m.display_name
      from piutang_receipts r join household_members m on m.id = r.member_id
      where r.piutang_id = ${id} order by r.date desc, r.created_at desc
    `
    return rows.map((r) => ({ id: r.id, amount: Number(r.amount), date: r.date, note: r.note, member: { member_id: r.member_id, display_name: r.display_name } }))
  })
}
