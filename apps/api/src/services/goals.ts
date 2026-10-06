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

const GOAL_SELECT = `
  select g.id, g.name, g.target::text, v.current::text, g.deadline::text, g.icon, g.color,
         g.owner_member_id, m.display_name as owner_name
  from v_goals_full v join goals g on g.id = v.id left join household_members m on m.id = g.owner_member_id
`

interface GoalRow {
  id: string; name: string; target: string; current: string; deadline: string | null
  icon: string; color: string; owner_member_id: string | null; owner_name: string | null
}

function mapGoal(r: GoalRow) {
  const target = Number(r.target)
  const current = Number(r.current)
  return {
    id: r.id, name: r.name, target, current, pct: target > 0 ? Math.round((current / target) * 1000) / 10 : 0,
    reached: current >= target, deadline: r.deadline,
    owner: r.owner_member_id ? { member_id: r.owner_member_id, display_name: r.owner_name } : null,
    icon: r.icon, color: r.color,
  }
}

export async function listGoals(actor: Actor) {
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<GoalRow[]>(`${GOAL_SELECT} where g.household_id = $1 and g.deleted_at is null order by g.created_at`, [actor.householdId])
    return rows.map(mapGoal)
  })
}

export async function createGoal(actor: Actor, input: { name: string; target: number; deadline?: string; owner: string; opening_amount: number; icon?: string; color?: string }) {
  return withActor(actor, async (tx) => {
    const ownerMemberId = await resolveOwnerMemberId(tx, actor, input.owner)
    const [row] = await tx<{ id: string }[]>`
      insert into goals (household_id, owner_member_id, name, target, opening_amount, deadline, icon, color)
      values (${actor.householdId}, ${ownerMemberId}, ${input.name}, ${input.target}, ${input.opening_amount}, ${input.deadline ?? null}, ${input.icon ?? '🎯'}, ${input.color ?? '#6366f1'})
      returning id
    `
    const rows = await tx.unsafe<GoalRow[]>(`${GOAL_SELECT} where g.id = $1`, [row!.id])
    return mapGoal(rows[0]!)
  })
}

export async function updateGoal(actor: Actor, id: string, input: { name?: string; target?: number; current?: number; deadline?: string | null; owner?: string; icon?: string; color?: string }) {
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ opening_amount: string }[]>`select opening_amount::text from goals where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('goal_not_found')

    // current dikoreksi langsung (setara perilaku lama edit goal) — opening_amount dihitung ulang
    // supaya current derived (v_goals_full) jadi sesuai, tanpa mengubah riwayat goal_contributions.
    let newOpeningAmount: number | undefined
    if (input.current !== undefined) {
      const [cur] = await tx<{ current: string }[]>`select current::text from v_goals_full where id = ${id}`
      const sumContributions = Number(cur!.current) - Number(existing.opening_amount)
      newOpeningAmount = Math.max(0, input.current - sumContributions)
    }

    const ownerMemberId = input.owner !== undefined ? await resolveOwnerMemberId(tx, actor, input.owner) : undefined

    await tx`
      update goals set
        name = coalesce(${input.name ?? null}, name), target = coalesce(${input.target ?? null}, target),
        opening_amount = coalesce(${newOpeningAmount ?? null}, opening_amount),
        deadline = ${input.deadline === undefined ? tx`deadline` : input.deadline},
        owner_member_id = ${ownerMemberId === undefined ? tx`owner_member_id` : ownerMemberId},
        icon = coalesce(${input.icon ?? null}, icon), color = coalesce(${input.color ?? null}, color), updated_at = now()
      where id = ${id}
    `
    const rows = await tx.unsafe<GoalRow[]>(`${GOAL_SELECT} where g.id = $1`, [id])
    return mapGoal(rows[0]!)
  })
}

export async function deleteGoal(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`update goals set deleted_at = now() where id = ${id} and household_id = ${actor.householdId} and deleted_at is null returning id`
    if (!row) throw ApiError.fromCode('goal_not_found')
    return { success: true }
  })
}

export async function contributeGoal(actor: Actor, id: string, input: { amount?: number; amount_text?: string; account_id?: string | null; account?: string | null; date?: string; note?: string }, timezone: string) {
  const amount = parseAmt(input)
  return withActor(actor, async (tx) => {
    const accountId = input.account_id || input.account ? await resolveAccountRef(tx, actor, { account_id: input.account_id ?? undefined, account: input.account ?? undefined }) : null
    const [row] = await tx<[{ result: unknown }]>`
      select topup_goal(${actor.householdId}, ${actor.memberId}, ${id}, ${accountId}, ${amount}, ${input.date ?? todayInTz(timezone)}, ${input.note ?? null}) as result
    `
    return row!.result
  })
}

export async function listGoalContributions(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const rows = await tx<{ id: string; amount: string; date: string; note: string; member_id: string; display_name: string }[]>`
      select c.id, c.amount::text, c.date::text, c.note, c.member_id, m.display_name
      from goal_contributions c join household_members m on m.id = c.member_id
      where c.goal_id = ${id} order by c.date desc, c.created_at desc
    `
    return rows.map((r) => ({ id: r.id, amount: Number(r.amount), date: r.date, note: r.note, member: { member_id: r.member_id, display_name: r.display_name } }))
  })
}
