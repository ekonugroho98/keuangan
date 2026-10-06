import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'

export async function listSplitBills(actor: Actor) {
  return withActor(actor, async (tx) => {
    const bills = await tx<{ id: string; title: string; total_amount: string; date: string; note: string }[]>`
      select id, title, total_amount::text, date::text, note from split_bills
      where household_id = ${actor.householdId} and deleted_at is null order by date desc, created_at desc
    `
    const members = await tx<{ bill_id: string; id: string; name: string; amount: string; paid_at: string | null }[]>`
      select sm.bill_id, sm.id, sm.name, sm.amount::text, sm.paid_at::text
      from split_bill_members sm join split_bills sb on sb.id = sm.bill_id
      where sb.household_id = ${actor.householdId}
    `
    return bills.map((b) => ({
      id: b.id, title: b.title, total_amount: Number(b.total_amount), date: b.date, note: b.note,
      members: members.filter((m) => m.bill_id === b.id).map((m) => ({ id: m.id, name: m.name, amount: Number(m.amount), paid: !!m.paid_at })),
    }))
  })
}

export async function createSplitBill(actor: Actor, input: { title: string; total_amount: number; date: string; note?: string; members: { name: string; amount: number }[] }) {
  return withActor(actor, async (tx) => {
    const [bill] = await tx<{ id: string }[]>`
      insert into split_bills (household_id, created_by_member_id, title, total_amount, date, note)
      values (${actor.householdId}, ${actor.memberId}, ${input.title}, ${input.total_amount}, ${input.date}, ${input.note ?? ''})
      returning id
    `
    const insertedMembers = []
    for (const m of input.members) {
      const [row] = await tx<{ id: string; name: string; amount: string }[]>`
        insert into split_bill_members (bill_id, name, amount) values (${bill!.id}, ${m.name}, ${m.amount}) returning id, name, amount::text
      `
      insertedMembers.push({ id: row!.id, name: row!.name, amount: Number(row!.amount), paid: false })
    }
    return { id: bill!.id, title: input.title, total_amount: input.total_amount, date: input.date, note: input.note ?? '', members: insertedMembers }
  })
}

export async function deleteSplitBill(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`update split_bills set deleted_at = now() where id = ${id} and household_id = ${actor.householdId} and deleted_at is null returning id`
    if (!row) throw ApiError.fromCode('not_found')
    return { success: true }
  })
}

export async function toggleSplitBillMember(actor: Actor, billId: string, memberId: string, paid: boolean) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update split_bill_members sm set paid_at = ${paid ? tx`now()` : null}
      from split_bills sb where sb.id = sm.bill_id and sm.id = ${memberId} and sm.bill_id = ${billId} and sb.household_id = ${actor.householdId}
      returning sm.id
    `
    if (!row) throw ApiError.fromCode('not_found')
    return { success: true }
  })
}
