import { createHash } from 'node:crypto'
import type { Context, Next } from 'hono'
import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { requireSql } from '../db/client'
import type { Actor } from '../auth/actor'

const MAX_STORED_BODY_BYTES = 64 * 1024

function extractResourceId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.id === 'string') return b.id
  const data = b.data as Record<string, unknown> | undefined
  if (data && typeof data.id === 'string') return data.id
  return null
}

/**
 * Idempotency per 05-api.md §6. Dipanggil dari dalam requireAuth() (bukan middleware `.use('*')`
 * terpisah) karena butuh `actor` (credential_type/credential_id) yang baru terbentuk di titik itu,
 * dan karena harus bisa SHORT-CIRCUIT (replay) sebelum handler/route jalan sama sekali.
 */
export async function withIdempotency(c: Context, actor: Actor, next: Next): Promise<void> {
  const key = c.req.header('Idempotency-Key')
  if (!key || c.req.method === 'GET') {
    await next()
    return
  }

  const sql = requireSql()
  const credentialType = actor.credential
  const credentialId = actor.credential === 'api_key' ? actor.apiKeyId! : actor.memberId
  const bodyText = await c.req.raw.clone().text()
  const requestHash = createHash('sha256').update(`${c.req.method}:${new URL(c.req.url).pathname}:${bodyText}`).digest()

  const won = await sql<{ id: number }[]>`
    insert into idempotency_keys (credential_type, credential_id, key, request_hash, status)
    values (${credentialType}, ${credentialId}, ${key}, ${requestHash}, 'in_progress')
    on conflict (credential_type, credential_id, key) do nothing
    returning 1 as id
  `

  if (won.length === 0) {
    const [existing] = await sql<{ status: string; request_hash: Buffer; response_status: number | null; response_body: unknown }[]>`
      select status, request_hash, response_status, response_body
      from idempotency_keys where credential_type = ${credentialType} and credential_id = ${credentialId} and key = ${key}
    `
    if (!existing || !existing.request_hash.equals(requestHash)) {
      throw ApiError.fromCode('idempotency_key_reused')
    }
    if (existing.status === 'in_progress') {
      c.header('Retry-After', '2')
      throw ApiError.fromCode('idempotency_in_progress')
    }
    c.res = Response.json(existing.response_body, { status: existing.response_status ?? 200, headers: { 'Idempotent-Replayed': 'true' } })
    return
  }

  try {
    await next()
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500
    if (status >= 500) {
      await sql`delete from idempotency_keys where credential_type = ${credentialType} and credential_id = ${credentialId} and key = ${key}`
    } else {
      const body = err instanceof ApiError ? err.toBody(c.get('requestId')) : { error: { code: 'internal_error', message: 'Terjadi kesalahan pada server.' } }
      await sql`
        update idempotency_keys set status = 'completed', response_status = ${status}, response_body = ${sql.json(body as unknown as postgres.JSONValue)}
        where credential_type = ${credentialType} and credential_id = ${credentialId} and key = ${key}
      `
    }
    throw err
  }

  const status = c.res.status
  if (status >= 500) {
    await sql`delete from idempotency_keys where credential_type = ${credentialType} and credential_id = ${credentialId} and key = ${key}`
    return
  }

  const resClone = c.res.clone()
  let bodyJson: unknown = null
  try {
    bodyJson = await resClone.json()
  } catch {
    bodyJson = null
  }
  const serialized = JSON.stringify(bodyJson ?? {})
  const stored = Buffer.byteLength(serialized) > MAX_STORED_BODY_BYTES
    ? { replayed_truncated: true, resource_id: extractResourceId(bodyJson) }
    : bodyJson

  await sql`
    update idempotency_keys set status = 'completed', response_status = ${status}, response_body = ${sql.json((stored ?? null) as unknown as postgres.JSONValue)}
    where credential_type = ${credentialType} and credential_id = ${credentialId} and key = ${key}
  `
}
