import type { Context } from 'hono'
import { ApiError } from '@karaya/shared/errors'
import { requireSql } from '../db/client'
import { env } from '../env'
import type { Actor } from '../auth/actor'

/**
 * 05-api.md §8: rate limit HANYA untuk credential api_key (JWT dibatasi Supabase Auth + UI).
 * Dipanggil dari requireAuth() setelah actor api_key terbentuk — bukan middleware `.use('*')`
 * terpisah, karena perlu tahu apakah ini api_key SEBELUM memutuskan apakah perlu membatasi.
 * Header kuota diset lewat `c.header()` langsung (bukan field di ApiError) supaya tetap terpasang
 * baik request berhasil maupun ditolak 429 — Hono menggabungkan header context ke respons akhir
 * apa pun jalurnya (app.onError sekalipun), karena sama-sama context `c` yang sama.
 */
export async function checkRateLimit(c: Context, actor: Actor): Promise<void> {
  if (actor.credential !== 'api_key' || !actor.apiKeyId) return

  const sql = requireSql()
  const [row] = await sql<{ allowed: boolean; remaining_minute: number; remaining_day: number; reset_at: string }[]>`
    select * from bump_rate_limit(${actor.apiKeyId}, ${env.RATE_LIMIT_PER_MINUTE}, ${env.RATE_LIMIT_PER_DAY})
  `
  c.header('X-RateLimit-Limit-Minute', String(env.RATE_LIMIT_PER_MINUTE))
  c.header('X-RateLimit-Remaining-Minute', String(row!.remaining_minute))

  if (!row!.allowed) {
    const resetSeconds = Math.max(1, Math.ceil((new Date(row!.reset_at).getTime() - Date.now()) / 1000))
    c.header('Retry-After', String(resetSeconds))
    throw ApiError.fromCode('rate_limited')
  }
}
