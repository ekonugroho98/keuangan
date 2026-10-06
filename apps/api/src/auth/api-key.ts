import { createHash, randomBytes } from 'node:crypto'
import { ApiError } from '@karaya/shared/errors'
import { env } from '../env'
import { requireSql } from '../db/client'
import type { Actor } from './actor'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const SCOPE_RANK: Record<'read' | 'write' | 'admin', number> = { read: 1, write: 2, admin: 3 }

export function roleToScope(role: 'owner' | 'member' | 'viewer'): 'read' | 'write' | 'admin' {
  return role === 'owner' ? 'admin' : role === 'member' ? 'write' : 'read'
}

/** `kf_live_` + 40 karakter base62 acak (05-api.md §3.2). */
export function generateApiKeySecret(): string {
  const bytes = randomBytes(40)
  let out = ''
  for (let i = 0; i < 40; i++) out += BASE62[bytes[i]! % 62]
  return `kf_live_${out}`
}

export function hashApiKey(secret: string): Buffer {
  return createHash('sha256').update(env.API_KEY_PEPPER + secret).digest()
}

/** Bagian yang aman ditampilkan di UI/daftar key (bukan rahasia, sekadar bantu user mengenali key mana). */
export function keyPrefix(secret: string): string {
  return secret.slice(0, 15)
}

interface ApiKeyLookupRow {
  id: string; household_id: string; member_id: string; user_id: string
  scope: 'read' | 'write' | 'admin'; expires_at: string | null; revoked_at: string | null
  member_deleted_at: string | null; member_role: 'owner' | 'member' | 'viewer'
}

/**
 * Lookup hash SEBELUM `SET LOCAL ROLE authenticated` (03-database.md §7.4) — query ini berjalan
 * sebagai role `karaya_api` langsung, BUKAN lewat withActor/withUserClaims (Actor belum terbentuk
 * sama sekali di titik ini). JOIN ke household_members butuh fungsi SECURITY DEFINER
 * (`resolve_api_key`, migrasi 0019) karena household_members punya RLS yang butuh auth.uid() —
 * yang belum ada SEBELUM kita tahu siapa pemilik key ini (bug nyata: grant kolom sempit saja
 * TIDAK CUKUP, RLS tetap menyaring semua baris tanpa auth.uid()).
 */
export async function resolveApiKeyActor(token: string, ip?: string): Promise<Actor> {
  const sql = requireSql()
  const hash = hashApiKey(token)
  const rows = await sql<ApiKeyLookupRow[]>`
    select id, household_id, member_id, user_id, scope, expires_at::text, revoked_at::text,
           member_deleted_at::text, member_role
    from resolve_api_key(${hash})
  `
  const row = rows[0]
  if (!row) throw ApiError.fromCode('invalid_api_key')
  if (row.revoked_at) throw ApiError.fromCode('api_key_revoked')
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw ApiError.fromCode('api_key_expired')
  if (row.member_deleted_at) throw ApiError.fromCode('api_key_member_removed')

  const roleScope = roleToScope(row.member_role)
  const effectiveScope = SCOPE_RANK[row.scope] <= SCOPE_RANK[roleScope] ? row.scope : roleScope

  touchLastUsed(row.id, ip).catch((err) => console.error('[api-key] gagal update last_used_at', err))

  return {
    userId: row.user_id,
    householdId: row.household_id,
    memberId: row.member_id,
    role: row.member_role,
    credential: 'api_key',
    scope: effectiveScope,
    apiKeyId: row.id,
  }
}

// `last_used_at` di-update maksimal sekali per menit per key (05-api.md §3.2: "hemat tulis") —
// cache in-memory ringan per proses, cukup untuk mengurangi write tanpa butuh tabel tambahan.
const lastTouchCache = new Map<string, number>()

async function touchLastUsed(apiKeyId: string, ip?: string): Promise<void> {
  const now = Date.now()
  const last = lastTouchCache.get(apiKeyId)
  if (last && now - last < 60_000) return
  lastTouchCache.set(apiKeyId, now)
  const sql = requireSql()
  await sql`select touch_api_key_last_used(${apiKeyId}, ${ip ?? null})`
}
