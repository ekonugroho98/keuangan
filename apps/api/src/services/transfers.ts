import { ApiError } from '@karaya/shared/errors'
import { parseAmountId, AmountParseError } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveAccountRef, resolveEffectiveRecorder, resolveExplicitRecorder } from './resolver'
import { todayInTz } from './period'
import { txSource } from './transactions'

export interface CreateTransferInput {
  amount?: number
  amount_text?: string
  from_account_id?: string
  from_account?: string
  to_account_id?: string
  to_account?: string
  date?: string
  note?: string
  recorded_by_id?: string
  recorded_by?: string
}

export async function createTransfer(actor: Actor, input: CreateTransferInput, timezone: string) {
  let amount: number
  try {
    amount = input.amount ?? parseAmountId(input.amount_text!)
  } catch (err) {
    if (err instanceof AmountParseError) throw ApiError.fromCode('invalid_amount_text')
    throw err
  }

  return withActor(actor, async (tx) => {
    const explicitRecorderId = await resolveExplicitRecorder(tx, actor, input)
    const fromId = await resolveAccountRef(tx, actor, { account_id: input.from_account_id, account: input.from_account }, 'from_account', explicitRecorderId)
    const toId = await resolveAccountRef(tx, actor, { account_id: input.to_account_id, account: input.to_account }, 'to_account', explicitRecorderId)
    const recorderId = await resolveEffectiveRecorder(tx, actor, input, fromId, explicitRecorderId)

    const [txRow] = await tx<{ id: string }[]>`
      select id from post_transfer(${actor.householdId}, ${actor.memberId}, ${fromId}, ${toId}, ${amount}, ${input.date ?? todayInTz(timezone)}, ${input.note ?? null}, ${txSource(actor)})
    `
    if (recorderId !== actor.memberId) {
      await tx`update transactions set recorded_by_member_id = ${recorderId} where id = ${txRow!.id}`
    }
    const [full] = await tx<{ type: string; amount: string; date: string; note: string; created_at: string }[]>`
      select type, amount::text, date::text, note, created_at::text from transactions where id = ${txRow!.id}
    `
    const [fromAcc] = await tx<{ name: string; balance: string }[]>`
      select a.name, v.balance::text from accounts a join v_account_balances v on v.account_id = a.id where a.id = ${fromId}
    `
    const [toAcc] = await tx<{ name: string; balance: string }[]>`
      select a.name, v.balance::text from accounts a join v_account_balances v on v.account_id = a.id where a.id = ${toId}
    `
    return {
      transaction: { id: txRow!.id, type: full!.type, amount: Number(full!.amount), date: full!.date, note: full!.note, created_at: full!.created_at },
      from_account: { id: fromId, name: fromAcc!.name, balance: fromAcc!.balance !== null ? Number(fromAcc!.balance) : null },
      to_account: { id: toId, name: toAcc!.name, balance: toAcc!.balance !== null ? Number(toAcc!.balance) : null },
    }
  })
}
