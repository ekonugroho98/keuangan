import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { requireSql } from './client'
import type { Actor } from '../auth/actor'
import { mapDbError } from './errors'

/**
 * Bungkus satu request dalam transaksi DB: SET LOCAL ROLE authenticated + set klaim JWT, supaya
 * RLS dan auth.uid() di dalam fungsi plpgsql bekerja persis seperti dari Supabase langsung
 * (03-database.md §7.1). Error dari fungsi SQL (RAISE EXCEPTION ... MESSAGE='<code>') dipetakan
 * jadi ApiError lewat mapDbError sebelum dilempar ke caller.
 */
export async function withActor<T>(actor: Actor, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const sql = requireSql()
  try {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE authenticated')
      const claims = JSON.stringify({ sub: actor.userId, role: 'authenticated' })
      await tx`SELECT set_config('request.jwt.claims', ${claims}, true)`
      return fn(tx)
    })
    // postgres.js mengetik sql.begin() sebagai UnwrapPromiseArray<T> (untuk kasus callback
    // mengembalikan array of promises); T generik kita selalu nilai tunggal, jadi aman di-cast.
    return result as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw mapDbError(err)
  }
}

/**
 * Transaksi dengan klaim `sub` SAJA (belum tahu household/member/role) — dipakai auth middleware
 * untuk query awal "household mana milik user ini" sebelum Actor lengkap terbentuk. RLS tetap
 * berlaku normal: user hanya melihat household_members miliknya sendiri (is_household_member()
 * mengevaluasi auth.uid() yang sudah terisi dari klaim ini), jadi query tetap aman meski role
 * belum diketahui.
 */
export async function withUserClaims<T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const sql = requireSql()
  try {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE authenticated')
      const claims = JSON.stringify({ sub: userId, role: 'authenticated' })
      await tx`SELECT set_config('request.jwt.claims', ${claims}, true)`
      return fn(tx)
    })
    return result as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw mapDbError(err)
  }
}

/**
 * Tanpa JWT sama sekali (mis. GET /v1/invitations/{code} di halaman /join/:code sebelum login).
 * Hanya aman dipakai untuk memanggil fungsi `SECURITY DEFINER` yang tidak bergantung pada
 * auth.uid() (preview_invitation mengambil konteksnya dari kode undangan, bukan dari pemanggil).
 * Role tetap `authenticated` (karaya_api tidak di-grant membership `anon`) tapi TANPA
 * request.jwt.claims — auth.uid() di dalam DB akan null, yang tidak masalah untuk fungsi ini.
 */
export async function withAnon<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const sql = requireSql()
  try {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL ROLE authenticated')
      return fn(tx)
    })
    return result as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw mapDbError(err)
  }
}
