import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { generateApiKeySecret, hashApiKey, keyPrefix } from '../auth/api-key'
import { resolveMemberRef } from './resolver'

interface ApiKeyRow {
  id: string; name: string; key_prefix: string; scope: 'read' | 'write' | 'admin'
  member_id: string; member_name: string; expires_at: string | null; last_used_at: string | null
  created_at: string; revoked_at: string | null
}

// Baca lewat v_api_keys (bukan tabel api_keys langsung) — key_hash sengaja di-REVOKE SELECT penuh
// dari role authenticated (migrasi 0010, bukan cuma RLS tapi privilege level-tabel); membaca
// api_keys langsung sebagai authenticated selalu 42501 "permission denied for table api_keys".
const API_KEY_SELECT = `
  select k.id, k.name, k.key_prefix, k.scope, k.member_id, m.display_name as member_name,
         k.expires_at::text, k.last_used_at::text, k.created_at::text, k.revoked_at::text
  from v_api_keys k join household_members m on m.id = k.member_id
`

function mapApiKey(r: ApiKeyRow) {
  return {
    id: r.id, name: r.name, key_prefix: r.key_prefix, scope: r.scope,
    member: { member_id: r.member_id, display_name: r.member_name },
    expires_at: r.expires_at, last_used_at: r.last_used_at, created_at: r.created_at, revoked_at: r.revoked_at,
  }
}

/** Non-owner hanya melihat miliknya sendiri (05-api.md §4: "non-owner hanya melihat miliknya"). */
export async function listApiKeys(actor: Actor) {
  return withActor(actor, async (tx) => {
    const ownOnly = actor.role !== 'owner'
    const rows = await tx.unsafe<ApiKeyRow[]>(
      `${API_KEY_SELECT} where k.household_id = $1 ${ownOnly ? 'and k.member_id = $2' : ''} order by k.created_at desc`,
      ownOnly ? [actor.householdId, actor.memberId] : [actor.householdId],
    )
    return rows.map(mapApiKey)
  })
}

export async function createApiKey(actor: Actor, input: { name: string; scope?: 'read' | 'write' | 'admin'; member?: string; expires_in_days?: number }) {
  return withActor(actor, async (tx) => {
    const targetMemberId = input.member && input.member !== 'me' ? await resolveMemberRef(tx, actor, { member: input.member }) ?? actor.memberId : actor.memberId
    const scope = input.scope ?? 'write'
    const secret = generateApiKeySecret()
    const expiresAt = input.expires_in_days ? new Date(Date.now() + input.expires_in_days * 86400_000).toISOString() : null

    const [row] = await tx<[{ result: unknown }]>`
      select to_jsonb(create_api_key(
        ${actor.householdId}, ${actor.memberId}, ${input.name}, ${targetMemberId},
        ${scope}, ${keyPrefix(secret)}, ${hashApiKey(secret)}, ${expiresAt}
      )) as result
    `
    const created = row!.result as { id: string }
    const rows = await tx.unsafe<ApiKeyRow[]>(`${API_KEY_SELECT} where k.id = $1`, [created.id])
    return { api_key: mapApiKey(rows[0]!), secret }
  })
}

export async function revokeApiKey(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    await tx`select revoke_api_key(${actor.householdId}, ${actor.memberId}, ${id})`
    return { success: true }
  })
}

export async function rotateApiKey(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<ApiKeyRow[]>(`${API_KEY_SELECT} where k.id = $1 and k.household_id = $2`, [id, actor.householdId])
    const existing = rows[0]
    if (!existing) throw ApiError.fromCode('not_found')

    const secret = generateApiKeySecret()
    const [row] = await tx<[{ result: unknown }]>`
      select to_jsonb(create_api_key(
        ${actor.householdId}, ${actor.memberId}, ${existing.name}, ${existing.member_id},
        ${existing.scope}, ${keyPrefix(secret)}, ${hashApiKey(secret)}, ${existing.expires_at}
      )) as result
    `
    await tx`select revoke_api_key(${actor.householdId}, ${actor.memberId}, ${id})`
    const created = row!.result as { id: string }
    const createdRows = await tx.unsafe<ApiKeyRow[]>(`${API_KEY_SELECT} where k.id = $1`, [created.id])
    return { api_key: mapApiKey(createdRows[0]!), secret }
  })
}
