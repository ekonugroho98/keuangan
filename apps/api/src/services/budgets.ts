import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveCategoryRef, resolveMemberRef } from './resolver'

export async function listBudgets(actor: Actor, month: string, scope: 'household' | 'member', memberRef?: { member_id?: string; member?: string }) {
  return withActor(actor, async (tx) => {
    const periodStart = `${month}-01`
    const memberId = scope === 'member' ? (await resolveMemberRef(tx, actor, memberRef ?? {})) ?? actor.memberId : null
    const rows = await tx<{ id: string; category_id: string; category_name: string; member_id: string | null; member_name: string | null; period_start: string; amount: string }[]>`
      select b.id, c.id as category_id, c.name as category_name, m.id as member_id, m.display_name as member_name,
             b.period_start::text, b.amount::text
      from budgets b join categories c on c.id = b.category_id left join household_members m on m.id = b.member_id
      where b.household_id = ${actor.householdId} and b.period_start = ${periodStart} and b.deleted_at is null
        ${scope === 'household' ? tx`and b.member_id is null` : tx`and b.member_id = ${memberId}`}
      order by c.sort_order
    `
    return rows.map((r) => ({
      id: r.id,
      category: { id: r.category_id, name: r.category_name },
      member: r.member_id ? { member_id: r.member_id, display_name: r.member_name } : null,
      period_start: r.period_start,
      amount: Number(r.amount),
    }))
  })
}

export async function getBudgetStatus(actor: Actor, month: string, scope: 'household' | 'member', memberRef?: { member_id?: string; member?: string }) {
  return withActor(actor, async (tx) => {
    const periodStart = `${month}-01`
    const memberId = scope === 'member' ? (await resolveMemberRef(tx, actor, memberRef ?? {})) ?? actor.memberId : null

    const rows = await tx<{ budget_id: string; category_id: string; category_name: string; category_icon: string; amount: string; spent: string }[]>`
      select b.id as budget_id, c.id as category_id, c.name as category_name, c.icon as category_icon, b.amount::text,
        coalesce((
          select sum(t.amount) from transactions t
          where t.household_id = ${actor.householdId} and t.type = 'expense' and t.deleted_at is null
            and t.category_id = c.id and t.date >= b.period_start and t.date < (b.period_start + interval '1 month')
            ${scope === 'member' ? tx`and t.account_id in (select id from accounts where owner_member_id = ${memberId})` : tx``}
        ), 0)::text as spent
      from budgets b join categories c on c.id = b.category_id
      where b.household_id = ${actor.householdId} and b.period_start = ${periodStart} and b.deleted_at is null
        ${scope === 'household' ? tx`and b.member_id is null` : tx`and b.member_id = ${memberId}`}
      order by c.sort_order
    `
    const items = rows.map((r) => {
      const amount = Number(r.amount)
      const spent = Number(r.spent)
      const pct = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0
      return {
        budget_id: r.budget_id,
        category: { id: r.category_id, name: r.category_name, icon: r.category_icon },
        amount, spent, remaining: amount - spent, pct,
        status: spent >= amount ? 'over' : pct >= 80 ? 'warning' : 'ok',
      }
    })
    const totals = items.reduce((acc, i) => ({ budgeted: acc.budgeted + i.amount, spent: acc.spent + i.spent, remaining: acc.remaining + i.remaining }), { budgeted: 0, spent: 0, remaining: 0 })
    return { period: { month, period_start: periodStart }, items, totals }
  })
}

export async function createBudget(actor: Actor, input: { category_id?: string; category?: string; amount: number; month: string; member_id?: string; member?: string }) {
  return withActor(actor, async (tx) => {
    const categoryId = await resolveCategoryRef(tx, actor, input)
    const memberId = await resolveMemberRef(tx, actor, input)
    try {
      const [row] = await tx<{ id: string }[]>`
        insert into budgets (household_id, category_id, member_id, period_start, amount)
        values (${actor.householdId}, ${categoryId}, ${memberId ?? null}, ${`${input.month}-01`}, ${input.amount})
        returning id
      `
      return { id: row!.id, category_id: categoryId, member_id: memberId ?? null, period_start: `${input.month}-01`, amount: input.amount }
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') throw ApiError.fromCode('duplicate_budget')
      throw err
    }
  })
}

export async function updateBudget(actor: Actor, id: string, amount: number) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update budgets set amount = ${amount}, updated_at = now()
      where id = ${id} and household_id = ${actor.householdId} and deleted_at is null
      returning id
    `
    if (!row) throw ApiError.fromCode('budget_not_found')
    return { id: row.id, amount }
  })
}

export async function deleteBudget(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update budgets set deleted_at = now() where id = ${id} and household_id = ${actor.householdId} and deleted_at is null returning id
    `
    if (!row) throw ApiError.fromCode('budget_not_found')
    return { success: true }
  })
}

export async function copyBudgets(actor: Actor, fromMonth: string, toMonth: string, overwrite: boolean) {
  return withActor(actor, async (tx) => {
    const source = await tx<{ category_id: string; member_id: string | null; amount: string }[]>`
      select category_id, member_id, amount::text from budgets
      where household_id = ${actor.householdId} and period_start = ${`${fromMonth}-01`} and deleted_at is null
    `
    let copied = 0
    let skipped = 0
    for (const b of source) {
      if (overwrite) {
        await tx`
          insert into budgets (household_id, category_id, member_id, period_start, amount)
          values (${actor.householdId}, ${b.category_id}, ${b.member_id}, ${`${toMonth}-01`}, ${b.amount})
          on conflict (household_id, category_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start)
          do update set amount = excluded.amount, deleted_at = null
        `
        copied++
      } else {
        const [existing] = await tx<{ id: string }[]>`
          select id from budgets where household_id = ${actor.householdId} and category_id = ${b.category_id}
            and coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${b.member_id}, '00000000-0000-0000-0000-000000000000'::uuid)
            and period_start = ${`${toMonth}-01`} and deleted_at is null
        `
        if (existing) { skipped++; continue }
        await tx`
          insert into budgets (household_id, category_id, member_id, period_start, amount)
          values (${actor.householdId}, ${b.category_id}, ${b.member_id}, ${`${toMonth}-01`}, ${b.amount})
        `
        copied++
      }
    }
    return { copied, skipped }
  })
}
