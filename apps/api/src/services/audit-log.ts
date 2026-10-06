import { withActor } from '../db/tx'
import type { Actor } from '../auth/actor'

interface AuditRow {
  id: string; created_at: string; actor_member_id: string | null; actor_name: string | null
  credential_type: string; api_key_id: string | null; api_key_name: string | null; api_key_prefix: string | null
  action: string; resource_type: string | null; resource_id: string | null
  http_status: number; payload: unknown; request_id: string
}

// v_api_keys (bukan api_keys langsung) — key_hash di-REVOKE SELECT penuh dari authenticated
// (migrasi 0010); dan withActor (bukan requireSql() mentah) supaya audit_log_select RLS policy
// (owner-only, migrasi 0010) benar-benar dievaluasi dengan auth.uid() yang terisi, bukan silcaan
// kosong yang membuat SEMUA baris tersaring tanpa error (bug nyata Fase 6 — lihat PROGRESS.md).
const AUDIT_SELECT = `
  select a.id::text, a.created_at::text, a.actor_member_id, m.display_name as actor_name,
         a.credential_type, a.api_key_id, k.name as api_key_name, k.key_prefix as api_key_prefix,
         a.action, a.resource_type, a.resource_id::text, a.http_status, a.payload, a.request_id
  from audit_log a
  left join household_members m on m.id = a.actor_member_id
  left join v_api_keys k on k.id = a.api_key_id
`

function mapRow(r: AuditRow) {
  return {
    id: r.id, created_at: r.created_at,
    actor: r.actor_member_id ? { member_id: r.actor_member_id, display_name: r.actor_name } : null,
    credential_type: r.credential_type,
    api_key: r.api_key_id ? { id: r.api_key_id, name: r.api_key_name, prefix: r.api_key_prefix } : null,
    action: r.action, resource_type: r.resource_type, resource_id: r.resource_id,
    http_status: r.http_status, payload: r.payload, request_id: r.request_id,
  }
}

export interface AuditLogQuery {
  api_key_id?: string; member_id?: string; action?: string; from?: string; to?: string
  cursor?: string; limit: number
}

function decodeCursor(cursor?: string): { createdAt: string; id: string } | null {
  if (!cursor) return null
  const [createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
  return { createdAt: createdAt!, id: id! }
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url')
}

export async function listAuditLog(actor: Actor, query: AuditLogQuery) {
  return withActor(actor, async (tx) => {
    const params: unknown[] = [actor.householdId]
    const clauses = ['a.household_id = $1']
    const push = (v: unknown) => { params.push(v); return `$${params.length}` }

    if (query.api_key_id) clauses.push(`a.api_key_id = ${push(query.api_key_id)}`)
    if (query.member_id) clauses.push(`a.actor_member_id = ${push(query.member_id)}`)
    if (query.action) clauses.push(`a.action ilike ${push(`%${query.action}%`)}`)
    if (query.from) clauses.push(`a.created_at >= ${push(query.from)}`)
    if (query.to) clauses.push(`a.created_at <= ${push(query.to)}`)
    const cur = decodeCursor(query.cursor)
    if (cur) clauses.push(`(a.created_at, a.id) < (${push(cur.createdAt)}, ${push(cur.id)})`)

    const limitParam = push(query.limit + 1)
    const rows = await tx.unsafe<AuditRow[]>(
      `${AUDIT_SELECT} where ${clauses.join(' and ')} order by a.created_at desc, a.id desc limit ${limitParam}`,
      params as never[],
    )
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!.created_at, page[page.length - 1]!.id) : null

    return { data: page.map(mapRow), next_cursor: nextCursor, has_more: hasMore }
  })
}
