import { ApiError } from '@karaya/shared/errors'
import { parseAmountId, AmountParseError } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveAccountRef, resolveEffectiveRecorder, resolveExplicitRecorder } from './resolver'
import { todayInTz } from './period'
import { resolveReceiptUrl } from './storage'
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
  receipt_url?: string
  receipt_image_base64?: string
  receipt_mime_type?: string
}

export async function createTransfer(actor: Actor, input: CreateTransferInput, timezone: string) {
  let amount: number
  try {
    amount = input.amount ?? parseAmountId(input.amount_text!)
  } catch (err) {
    if (err instanceof AmountParseError) throw ApiError.fromCode('invalid_amount_text')
    throw err
  }

  const receiptUrl = await resolveReceiptUrl(actor, input)
  return withActor(actor, async (tx) => {
    const explicitRecorderId = await resolveExplicitRecorder(tx, actor, input)
    const fromId = await resolveAccountRef(tx, actor, { account_id: input.from_account_id, account: input.from_account }, 'from_account', explicitRecorderId)
    const toId = await resolveAccountRef(tx, actor, { account_id: input.to_account_id, account: input.to_account }, 'to_account', explicitRecorderId)
    const recorderId = await resolveEffectiveRecorder(tx, actor, input, fromId, explicitRecorderId)

    const [txRow] = await tx<{ id: string }[]>`
      select id from post_transfer(${actor.householdId}, ${actor.memberId}, ${fromId}, ${toId}, ${amount}, ${input.date ?? todayInTz(timezone)}, ${input.note ?? null}, ${txSource(actor)})
    `
    if (recorderId !== actor.memberId || receiptUrl) {
      await tx`
        update transactions
        set recorded_by_member_id = ${recorderId},
            receipt_url = coalesce(${receiptUrl ?? null}, receipt_url)
        where id = ${txRow!.id}
      `
    }
    const [full] = await tx<{
      type: string
      amount: string
      date: string
      note: string
      receipt_url: string | null
      recorded_by_member_id: string
      recorded_by_name: string
      created_at: string
    }[]>`
      select t.type, t.amount::text, t.date::text, t.note, t.receipt_url,
             t.recorded_by_member_id, m.display_name as recorded_by_name, t.created_at::text
      from transactions t
      join household_members m on m.id = t.recorded_by_member_id
      where t.id = ${txRow!.id}
    `
    const [fromAcc] = await tx<{ name: string; balance: string }[]>`
      select a.name, v.balance::text from accounts a join v_account_balances v on v.account_id = a.id where a.id = ${fromId}
    `
    const [toAcc] = await tx<{ name: string; balance: string }[]>`
      select a.name, v.balance::text from accounts a join v_account_balances v on v.account_id = a.id where a.id = ${toId}
    `
    return {
      transaction: {
        id: txRow!.id,
        type: full!.type,
        amount: Number(full!.amount),
        date: full!.date,
        note: full!.note,
        receipt_url: full!.receipt_url ?? null,
        recorded_by: {
          member_id: full!.recorded_by_member_id,
          display_name: full!.recorded_by_name,
        },
        created_at: full!.created_at,
      },
      from_account: { id: fromId, name: fromAcc!.name, balance: fromAcc!.balance !== null ? Number(fromAcc!.balance) : null },
      to_account: { id: toId, name: toAcc!.name, balance: toAcc!.balance !== null ? Number(toAcc!.balance) : null },
    }
  })
}
