import type postgres from 'postgres'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolvePeriod } from './period'
import { resolveAccountRef, resolveMemberRef } from './resolver'

interface ScopeFilter {
  accountClause: string
  params: postgres.ParameterOrJSON<never>[]
}

function buildScopeFilter(scope: string, accountId?: string, memberId?: string, attribution: 'owner' | 'recorded_by' = 'owner'): ScopeFilter {
  const params: postgres.ParameterOrJSON<never>[] = []
  if (scope === 'account' && accountId) {
    params.push(accountId)
    return { accountClause: `and (t.account_id = $${params.length} or t.to_account_id = $${params.length})`, params }
  }
  if (scope === 'member' && memberId) {
    params.push(memberId)
    const clause = attribution === 'recorded_by' ? `t.recorded_by_member_id = $${params.length}` : `(a.owner_member_id = $${params.length} or ta.owner_member_id = $${params.length})`
    return { accountClause: `and ${clause}`, params }
  }
  return { accountClause: '', params: [] }
}

export async function getSummary(
  actor: Actor,
  opts: { period: string; from?: string; to?: string; scope: 'household' | 'member' | 'account'; memberRef?: { member_id?: string; member?: string }; accountRef?: { account_id?: string; account?: string }; attribution: 'owner' | 'recorded_by'; compare: boolean },
) {
  return withActor(actor, async (tx) => {
    const [hh] = await tx<{ timezone: string }[]>`select timezone from households where id = ${actor.householdId}`
    const timezone = hh?.timezone ?? 'Asia/Jakarta'
    const period = resolvePeriod(opts.period, timezone, opts.from, opts.to)

    let accountId: string | undefined
    let memberId: string | undefined
    if (opts.scope === 'account' && opts.accountRef) accountId = await resolveAccountRef(tx, actor, opts.accountRef)
    if (opts.scope === 'member' && opts.memberRef) memberId = (await resolveMemberRef(tx, actor, opts.memberRef)) ?? actor.memberId
    if (opts.scope === 'member' && !opts.memberRef) memberId = actor.memberId

    const totals = await computeTotals(tx, actor.householdId, period.from, period.to, opts.scope, accountId, memberId, opts.attribution)

    let compare: { income_delta_pct: number | null; expense_delta_pct: number | null } | undefined
    if (opts.compare) {
      const spanDays = (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86400000 + 1
      const prevTo = new Date(new Date(period.from).getTime() - 86400000).toISOString().slice(0, 10)
      const prevFrom = new Date(new Date(prevTo).getTime() - (spanDays - 1) * 86400000).toISOString().slice(0, 10)
      const prevTotals = await computeTotals(tx, actor.householdId, prevFrom, prevTo, opts.scope, accountId, memberId, opts.attribution)
      compare = {
        income_delta_pct: pctDelta(prevTotals.income, totals.income),
        expense_delta_pct: pctDelta(prevTotals.expense, totals.expense),
      }
    }

    const topCategories = await tx<{ category: string; icon: string; spent: string }[]>`
      select c.name as category, c.icon, sum(t.amount)::text as spent
      from transactions t join categories c on c.id = t.category_id
      left join accounts a on a.id = t.account_id left join accounts ta on ta.id = t.to_account_id
      where t.household_id = ${actor.householdId} and t.type = 'expense' and t.deleted_at is null
        and t.date between ${period.from} and ${period.to}
      group by c.name, c.icon order by sum(t.amount) desc limit 8
    `
    const totalExpenseForPct = topCategories.reduce((s, r) => s + Number(r.spent), 0)

    const byMember = await tx<{ member: string | null; income: string; expense: string }[]>`
      select m.display_name as member,
        sum(case when t.type='income' then t.amount else 0 end)::text as income,
        sum(case when t.type='expense' then t.amount else 0 end)::text as expense
      from transactions t join accounts a on a.id = t.account_id left join household_members m on m.id = a.owner_member_id
      where t.household_id = ${actor.householdId} and t.deleted_at is null and t.date between ${period.from} and ${period.to}
      group by m.display_name
    `

    const [balanceRow] = await tx<{ total: string; hidden: string }[]>`
      select coalesce(sum(v.balance) filter (where v.balance is not null), 0)::text as total,
             count(*) filter (where v.balance is null)::text as hidden
      from accounts a join v_account_balances v on v.account_id = a.id
      where a.household_id = ${actor.householdId} and a.deleted_at is null
    `

    const [budgetRow] = await tx<{ over: string; warning: string; total: string }[]>`
      select
        count(*) filter (where spent >= b.amount)::text as over,
        count(*) filter (where spent < b.amount and spent >= b.amount * 0.8)::text as warning,
        count(*)::text as total
      from budgets b
      cross join lateral (
        select coalesce(sum(t.amount), 0) as spent from transactions t
        where t.category_id = b.category_id and t.household_id = ${actor.householdId} and t.type = 'expense' and t.deleted_at is null
          and t.date >= b.period_start and t.date < b.period_start + interval '1 month'
      ) s
      where b.household_id = ${actor.householdId} and b.deleted_at is null and b.period_start = date_trunc('month', ${period.to}::date)::date
    `

    const [goalsRow] = await tx<{ active: string; reached: string }[]>`
      select count(*) filter (where current < target)::text as active, count(*) filter (where current >= target)::text as reached
      from v_goals_full where household_id = ${actor.householdId} and deleted_at is null
    `

    const [debtsRow] = await tx<{ active: string; total_remaining: string; overdue: string }[]>`
      select count(*) filter (where remaining > 0)::text as active, coalesce(sum(remaining) filter (where remaining > 0), 0)::text as total_remaining,
             count(*) filter (where remaining > 0 and due_date < current_date)::text as overdue
      from v_debts where household_id = ${actor.householdId} and deleted_at is null
    `

    const recent = await tx<{ id: string; type: string; amount: string; note: string; date: string }[]>`
      select id, type, amount::text, note, date::text from transactions
      where household_id = ${actor.householdId} and deleted_at is null order by date desc, created_at desc limit 5
    `

    return {
      period: { label: period.label, from: period.from, to: period.to },
      scope: opts.scope,
      totals: {
        income: totals.income, expense: totals.expense, net: totals.income - totals.expense,
        transfer_volume: totals.transfer,
        saving_rate_pct: totals.income > 0 ? Math.round(((totals.income - totals.expense) / totals.income) * 1000) / 10 : 0,
      },
      ...(compare ? { compare } : {}),
      balance: { total_visible: Number(balanceRow!.total), hidden_private_accounts: Number(balanceRow!.hidden) },
      top_categories: topCategories.map((r) => ({ category: r.category, icon: r.icon, spent: Number(r.spent), pct: totalExpenseForPct > 0 ? Math.round((Number(r.spent) / totalExpenseForPct) * 1000) / 10 : 0 })),
      by_member: byMember.map((r) => ({ member: r.member ?? 'Bersama', income: Number(r.income), expense: Number(r.expense) })),
      budgets: { over: Number(budgetRow?.over ?? 0), warning: Number(budgetRow?.warning ?? 0), total: Number(budgetRow?.total ?? 0) },
      goals: { active: Number(goalsRow?.active ?? 0), reached: Number(goalsRow?.reached ?? 0) },
      debts: { active: Number(debtsRow?.active ?? 0), total_remaining: Number(debtsRow?.total_remaining ?? 0), overdue: Number(debtsRow?.overdue ?? 0) },
      recent_transactions: recent.map((r) => ({ id: r.id, type: r.type, amount: Number(r.amount), note: r.note, date: r.date })),
    }
  })
}

async function computeTotals(tx: postgres.TransactionSql, householdId: string, from: string, to: string, scope: string, accountId: string | undefined, memberId: string | undefined, attribution: 'owner' | 'recorded_by') {
  const { accountClause, params } = buildScopeFilter(scope, accountId, memberId, attribution)
  const [row] = await tx.unsafe<{ income: string; expense: string; transfer: string }[]>(
    `select
       coalesce(sum(case when t.type='income' then t.amount end),0)::text as income,
       coalesce(sum(case when t.type='expense' then t.amount end),0)::text as expense,
       coalesce(sum(case when t.type='transfer' then t.amount end),0)::text as transfer
     from transactions t
     join accounts a on a.id = t.account_id left join accounts ta on ta.id = t.to_account_id
     where t.household_id = $${params.length + 1} and t.deleted_at is null and t.date between $${params.length + 2} and $${params.length + 3}
       ${accountClause}`,
    [...params, householdId, from, to],
  )
  return { income: Number(row!.income), expense: Number(row!.expense), transfer: Number(row!.transfer) }
}

function pctDelta(prev: number, cur: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 1000) / 10
}
