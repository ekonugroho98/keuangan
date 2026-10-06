import postgres from 'postgres'
import { env } from '../env'

/**
 * Koneksi ke Supabase Postgres lewat pooler Supavisor (transaction mode) sebagai role `karaya_api`
 * (03-database.md §7.4). `prepare: false` wajib untuk pooler transaction mode (tidak mendukung
 * prepared statement lintas koneksi). Otorisasi sesungguhnya terjadi per-transaksi lewat
 * `withActor()` (db/tx.ts): SET LOCAL ROLE authenticated + klaim JWT, bukan lewat role `karaya_api`
 * itu sendiri (yang hanya pintu masuk, RLS tetap ditegakkan sebagai `authenticated`).
 */
export const sql = env.DATABASE_URL
  ? postgres(env.DATABASE_URL, { prepare: false, max: 10, idle_timeout: 20 })
  : null

export function requireSql(): postgres.Sql {
  if (!sql) {
    throw new Error('DATABASE_URL belum diatur. Lihat apps/api/.env.example.')
  }
  return sql
}

export async function checkDbHealth(): Promise<'ok' | 'not_configured' | 'error'> {
  if (!sql) return 'not_configured'
  try {
    await sql`select 1`
    return 'ok'
  } catch (err) {
    console.error('[db] health check failed', err)
    return 'error'
  }
}
