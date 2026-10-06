import type { Context, Next } from 'hono'
import { ApiError } from '@karaya/shared/errors'
import { withActor } from '../db/tx'

const REDACT_KEYS = new Set(['api_key', 'secret', 'password', 'new_password', 'authorization', 'api_key_pepper'])

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v)]),
    )
  }
  return value
}

function resourceTypeFromPath(path: string): string | null {
  const m = path.match(/^\/v1\/([a-z-]+)/)
  return m ? m[1]! : null
}

function extractResourceId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.id === 'string') return b.id
  const nested = (b.data ?? b.api_key ?? b.transaction ?? b.account) as Record<string, unknown> | undefined
  return nested && typeof nested.id === 'string' ? nested.id : null
}

/**
 * Audit log (03-database.md §3.19, 05-api.md §4): middleware GLOBAL (app.use('*', ...), didaftarkan
 * paling awal di app.ts) karena kode SETELAH `await next()` berjalan setelah seluruh rantai
 * middleware/handler di bawahnya selesai (termasuk requireAuth() yang mengisi `actor` ke context
 * YANG SAMA) — pola onion Hono membuat ini valid walau actor belum ada saat middleware ini
 * didaftarkan. Request ke endpoint publik (actor belum ter-set) dilewati; tidak ada household
 * untuk diaudit. Kegagalan menulis log TIDAK BOLEH menggagalkan request asli (best-effort).
 */
export function auditMiddleware() {
  return async (c: Context, next: Next) => {
    const path = new URL(c.req.url).pathname
    const bodyText = c.req.method === 'GET' || c.req.method === 'DELETE' ? '' : await c.req.raw.clone().text().catch(() => '')

    // next() yang throw (ApiError dari requireAuth/handler) melompat langsung ke app.onError,
    // melewati kode setelah await next() di bawah — tanpa try/catch ini, request yang DITOLAK
    // (403/404/422/dst.) tidak pernah tercatat, padahal itu justru yang paling penting diaudit.
    let thrown: unknown
    try {
      await next()
    } catch (err) {
      thrown = err
    }

    const actor = c.get('actor')
    if (!actor) {
      if (thrown) throw thrown
      return
    }

    try {
      const status = thrown instanceof ApiError ? thrown.status : thrown ? 500 : c.res.status
      let responseBody: unknown = null
      if (!thrown && c.res.headers.get('content-type')?.includes('application/json')) {
        responseBody = await c.res.clone().json().catch(() => null)
      }
      const payload = bodyText ? redact(JSON.parse(bodyText || '{}')) : null

      // audit_log_insert RLS policy (with check is_household_member) butuh role authenticated +
      // klaim jwt aktif — withActor, bukan requireSql() langsung (role karaya_api dasar tunduk RLS
      // juga, grant table-level saja tidak cukup; lihat riwayat perubahan 03-database.md Fase 6).
      await withActor(actor, (tx) => tx`
        insert into audit_log (
          household_id, actor_member_id, credential_type, api_key_id, request_id, idempotency_key,
          action, resource_type, resource_id, http_status, payload, ip, user_agent
        ) values (
          ${actor.householdId}, ${actor.memberId}, ${actor.credential}, ${actor.apiKeyId ?? null},
          ${c.get('requestId') ?? ''}, ${c.req.header('Idempotency-Key') ?? null},
          ${`${c.req.method} ${path}`}, ${resourceTypeFromPath(path)}, ${extractResourceId(responseBody)},
          ${status}, ${payload ? JSON.stringify(payload) : null}::jsonb,
          ${c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null}, ${c.req.header('user-agent') ?? null}
        )
      `)
    } catch (err) {
      console.error('[audit] gagal menulis audit_log', err)
    }

    if (thrown) throw thrown
  }
}
