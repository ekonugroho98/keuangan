import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveOwnerMemberId } from './resolver'

export interface InvestmentInput {
  name: string; type: string; owner?: string; icon?: string; color?: string; brand?: string
  buy_price?: number; current_value?: number; quantity?: number; unit?: string; kode_saham?: string
  buy_date?: string; notes?: string
}

export async function listInvestments(actor: Actor) {
  return withActor(actor, async (tx) => {
    const rows = await tx<Record<string, unknown>[]>`
      select i.*, m.display_name as owner_display_name from investments i
      left join household_members m on m.id = i.owner_member_id
      where i.household_id = ${actor.householdId} and i.deleted_at is null order by i.created_at
    `
    return rows
  })
}

export async function createInvestment(actor: Actor, input: InvestmentInput) {
  return withActor(actor, async (tx) => {
    const ownerMemberId = await resolveOwnerMemberId(tx, actor, input.owner)
    const [row] = await tx<{ id: string }[]>`
      insert into investments (household_id, owner_member_id, name, type, icon, color, brand, buy_price, current_value, quantity, unit, kode_saham, buy_date, notes)
      values (${actor.householdId}, ${ownerMemberId}, ${input.name}, ${input.type}, ${input.icon ?? null}, ${input.color ?? null}, ${input.brand ?? null},
              ${input.buy_price ?? 0}, ${input.current_value ?? 0}, ${input.quantity ?? null}, ${input.unit ?? 'unit'}, ${input.kode_saham ?? null}, ${input.buy_date ?? null}, ${input.notes ?? ''})
      returning id
    `
    const [full] = await tx<Record<string, unknown>[]>`select * from investments where id = ${row!.id}`
    return full
  })
}

export async function updateInvestment(actor: Actor, id: string, input: Partial<InvestmentInput>) {
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from investments where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('not_found')
    await tx`
      update investments set
        name = coalesce(${input.name ?? null}, name), current_value = coalesce(${input.current_value ?? null}, current_value),
        quantity = coalesce(${input.quantity ?? null}, quantity), notes = coalesce(${input.notes ?? null}, notes), updated_at = now()
      where id = ${id}
    `
    const [full] = await tx<Record<string, unknown>[]>`select * from investments where id = ${id}`
    return full
  })
}

export async function deleteInvestment(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`update investments set deleted_at = now() where id = ${id} and household_id = ${actor.householdId} and deleted_at is null returning id`
    if (!row) throw ApiError.fromCode('not_found')
    return { success: true }
  })
}
