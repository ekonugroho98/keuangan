import type { Context, Next } from 'hono'
import { ApiError } from '@karaya/shared/errors'
import { verifySupabaseJwt } from './jwt'
import { withUserClaims } from '../db/tx'
import { resolveApiKeyActor } from './api-key'
import { withIdempotency } from '../middleware/idempotency'
import { checkRateLimit } from '../middleware/rate-limit'
import type { Actor } from './actor'

declare module 'hono' {
  interface ContextVariableMap {
    actor: Actor
    userId: string
    requestId: string
  }
}

interface MemberRow {
  household_id: string
  member_id: string
  role: 'owner' | 'member' | 'viewer'
}

/**
 * Tentukan household aktif untuk user ini (05-api.md §3.1):
 * X-Household-Id header (kalau user memang anggota household itu) > active_household_id di
 * user_settings > household pertama yang dia ikuti (joined_at paling awal). Tidak ada household
 * sama sekali -> not_household_member (endpoint onboarding POST /v1/households tidak lewat
 * middleware ini).
 */
async function resolveMembership(userId: string, requestedHouseholdId?: string): Promise<MemberRow> {
  return withUserClaims(userId, async (tx) => {
    // join households dan saring h.deleted_at: merge_household_into (Fase 5) soft-delete baris
    // households sumber tapi TIDAK menghapus household_members lama milik user yang di-merge —
    // tanpa filter ini, membership ke household yang sudah di-merge masih bisa lolos resolve.
    const rows = await tx<MemberRow[]>`
      select hm.household_id, hm.id as member_id, hm.role
      from household_members hm join households h on h.id = hm.household_id
      where hm.user_id = ${userId} and hm.deleted_at is null and h.deleted_at is null
      order by hm.joined_at asc
    `
    if (rows.length === 0) throw ApiError.fromCode('not_household_member')

    if (requestedHouseholdId) {
      const match = rows.find((r) => r.household_id === requestedHouseholdId)
      if (!match) throw ApiError.fromCode('not_household_member', { message: 'Kamu bukan anggota household yang diminta di X-Household-Id.' })
      return match
    }

    const settingsRows = await tx<{ active_household_id: string | null }[]>`
      select active_household_id from user_settings where user_id = ${userId}
    `
    const active = settingsRows[0]?.active_household_id
    if (active) {
      const match = rows.find((r) => r.household_id === active)
      if (match) return match
    }

    return rows[0]!
  })
}

const SCOPE_RANK: Record<'read' | 'write' | 'admin', number> = { read: 1, write: 2, admin: 3 }

/**
 * Scope minimum per HTTP method (05-api.md §3.3 matriks baris pertama & kedua: GET = read,
 * POST/PATCH/DELETE = write secara default). Operasi admin-only (accounts DELETE, categories
 * mutasi, members, invitations, api-keys, households PATCH, audit-log — baris ketiga matriks)
 * butuh `assertScope(actor, 'admin')` TAMBAHAN, dipanggil di DALAM handler masing-masing route —
 * BUKAN middleware `.use('*', ...)` tambahan di sub-app (lihat requireJwtOnly di bawah).
 */
function defaultScopeForMethod(method: string): 'read' | 'write' {
  return method === 'GET' ? 'read' : 'write'
}

/** Dipakai juga langsung di service/route layer untuk pengecekan kondisional (mis. PATCH
 * /v1/members/{id}: "write" cukup untuk ubah diri sendiri, "admin" untuk ubah anggota lain). */
export function assertScope(actor: Actor, min: 'read' | 'write' | 'admin') {
  if (SCOPE_RANK[actor.scope] < SCOPE_RANK[min]) {
    throw ApiError.fromCode('insufficient_scope')
  }
}

/**
 * Dipanggil di DALAM route handler (bukan `.use('*', ...)` di level sub-app!) untuk endpoint
 * "jwt saja" (/v1/me/*, /v1/ai/*, /v1/api-keys/*, POST /v1/members/me/leave). Bug nyata Fase 6:
 * middleware wildcard tambahan yang didaftarkan di SATU sub-app (mis. apiKeysApp.use('*', ...))
 * ternyata ikut berlaku untuk SEMUA sub-app lain yang di-mount ke root app lewat app.route('/', …)
 * — bukan cuma untuk route-route di dalam sub-app itu sendiri. Pola aman: taruh pengecekan di
 * dalam handler masing-masing (seperti assertScope di atas), jangan pernah pasang wildcard kedua
 * di atas requireAuth() pada sub-app manapun.
 */
export function requireJwtOnly(actor: Actor) {
  if (actor.credential !== 'jwt') throw ApiError.fromCode('jwt_required')
}

/** Middleware: wajib JWT valid + member household. Dipasang di semua route `/v1/*` kecuali publik. */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw ApiError.fromCode('unauthorized')
    }
    const token = authHeader.slice('Bearer '.length).trim()

    if (token.startsWith('kf_live_')) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      const actor = await resolveApiKeyActor(token, ip)
      assertScope(actor, defaultScopeForMethod(c.req.method))
      await checkRateLimit(c, actor)
      c.set('actor', actor)
      c.set('userId', actor.userId)
      await withIdempotency(c, actor, next)
      return
    }

    const payload = await verifySupabaseJwt(token)
    const requestedHousehold = c.req.header('X-Household-Id') ?? undefined
    const membership = await resolveMembership(payload.sub, requestedHousehold)

    const actor: Actor = {
      userId: payload.sub,
      householdId: membership.household_id,
      memberId: membership.member_id,
      role: membership.role,
      credential: 'jwt',
      scope: 'admin', // JWT = pengguna manusia lewat web; scope efektif dari role, dicek di service layer.
    }
    c.set('actor', actor)
    c.set('userId', payload.sub)
    await withIdempotency(c, actor, next)
  }
}

/**
 * Dipanggil langsung di tiap handler meApp (BUKAN `.use('*', requireUser())` lagi — lihat bug
 * besar di bawah) untuk endpoint jwt-only yang belum tentu sudah punya household (/v1/me,
 * POST /v1/households, /v1/me/settings). Mengembalikan userId, melempar unauthorized/jwt_required
 * seperti sebelumnya.
 *
 * BUG ARSITEKTUR NYATA ditemukan Fase 6 (lihat requireJwtOnly di bawah untuk kasus serupa):
 * `.route('/', subApp)` di Hono/zod-openapi TERNYATA menggabungkan middleware wildcard SEMUA
 * sub-app yang mount di prefix yang sama ('/') menjadi SATU rantai yang berjalan untuk SETIAP
 * route di SELURUH app — bukan cuma route milik sub-app itu sendiri — TERLEPAS dari urutan mount
 * ATAU apakah sub-app itu cuma punya SATU wildcard. requireUser() yang MELEMPAR jwt_required untuk
 * token kf_live_ dulu dipasang sebagai meApp.use('*', requireUser()) — akibatnya, SETIAP request
 * api_key ke endpoint APAPUN (termasuk GET /v1/accounts dari accountsApp yang sama sekali bukan
 * bagian dari meApp) ikut ditolak jwt_required, karena requireUser() ini AKTIF untuk rute itu juga.
 * Dibuktikan dengan console.error langsung di dalam requireUser() yang ternyata terpanggil untuk
 * request ke /v1/accounts. requireAuth() aman dipakai sebagai wildcard di banyak sub-app karena
 * perilakunya SAMA/idempoten untuk kredensial apa pun (redundant tapi tidak salah); requireUser()
 * TIDAK aman karena punya perilaku MENOLAK yang berbeda untuk api_key — pelajaran: middleware
 * wildcard apa pun yang punya logika penolakan spesifik-resource tidak boleh dipasang sebagai
 * `.use('*', ...)` di sub-app manapun, harus dipanggil langsung di handler (pola assertScope/
 * requireJwtOnly).
 */
export async function requireUserId(c: Context): Promise<string> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.fromCode('unauthorized')
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (token.startsWith('kf_live_')) {
    throw ApiError.fromCode('jwt_required')
  }
  const payload = await verifySupabaseJwt(token)
  c.set('userId', payload.sub)
  return payload.sub
}
