import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'

export type ResolveKind = 'account' | 'category' | 'member' | 'debt' | 'goal' | 'piutang'

/**
 * Dipakai route POST /v1/resolve DAN tool `resolve_name` di registry (06-agent-integration.md §2,
 * §4) — satu sumber logika, bukan diduplikasi. account/category/member lewat fungsi SQL
 * resolve_*; debt/goal/piutang belum ada fungsi SQL khusus (Q-09), masih LIKE sederhana.
 */
export async function resolveName(actor: Actor, input: { kind: ResolveKind; query: string; type?: 'income' | 'expense' }) {
  return withActor(actor, async (tx) => {
    const { kind, query, type } = input
    if (kind === 'account') {
      const [row] = await tx<[{ result: unknown }]>`select resolve_account(${actor.householdId}, ${actor.memberId}, ${query}, false) as result`
      return row!.result
    }
    if (kind === 'category') {
      const [row] = await tx<[{ result: unknown }]>`select resolve_category(${actor.householdId}, ${query}, ${type ?? null}) as result`
      return row!.result
    }
    if (kind === 'member') {
      const [row] = await tx<[{ result: unknown }]>`select resolve_member(${actor.householdId}, ${query}) as result`
      return row!.result
    }
    const table = kind === 'debt' ? 'debts' : kind === 'goal' ? 'goals' : 'piutang'
    const nameCol = kind === 'piutang' ? 'borrower_name' : 'name'
    const rows = await tx.unsafe<{ id: string; name: string }[]>(
      `select id, ${nameCol} as name from ${table} where household_id = $1 and deleted_at is null and lower(${nameCol}) like $2`,
      [actor.householdId, `%${query.toLowerCase()}%`],
    )
    if (rows.length === 1) return { status: 'ok', match: rows[0] }
    if (rows.length === 0) return { status: 'not_found', candidates: [] }
    return { status: 'ambiguous', candidates: rows }
  })
}
