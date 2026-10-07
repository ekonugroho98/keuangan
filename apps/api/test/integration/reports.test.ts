import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// F-B (10-fitur-opsional-keluarga.md §4) — endpoint SELALU tersedia (tidak digate feature flag).
const EKO_USER_ID = '00000000-0000-0000-0000-0000000000e0'
// Bulan TETAP di masa lalu (bukan "bulan ini") supaya tidak rawan race dengan test file lain yang
// mencatat transaksi bertanggal "hari ini" (todayInTz default) ke household seed yang sama —
// ditemukan nyata: totals.expense antara dua request berurutan bisa beda beberapa ribu rupiah
// kalau keduanya memakai bulan berjalan, bahkan dengan `fileParallelism: false`.
const FIXED_MONTH = '2023-06'
const FIXED_DATE = '2023-06-10'

async function checkDb(): Promise<boolean> {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 })
    await sql`select 1`
    await sql.end()
    return true
  } catch {
    return false
  }
}

async function mintJwt(sub: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
  return new SignJWT({ sub, aud: 'authenticated', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

const dbReachable = await checkDb()
if (!dbReachable) {
  console.warn('[integration] DATABASE_URL tidak terjangkau, test reports.test.ts dilewati.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('F-B laporan bulanan (DB lokal)', () => {
  const createdTxIds: string[] = []

  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    for (const id of createdTxIds) {
      await app.request(`/v1/transactions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
  })

  it('setup: catat 2 expense di bulan TETAP 2023-06 (tidak diganggu test lain)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    for (const amount of [7000, 3000]) {
      const res = await app.request('/v1/transactions', {
        method: 'POST', headers,
        body: JSON.stringify({ type: 'expense', amount, account: 'BCA suami', category: 'Makanan', date: FIXED_DATE, note: `reports-test-${amount}` }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      createdTxIds.push(body.transaction.id)
    }
  })

  it('GET /v1/reports/monthly?month=2023-06 mengembalikan text_id ringkas dan totals numerik yang benar', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request(`/v1/reports/monthly?month=${FIXED_MONTH}`, { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.text_id).toBe('string')
    expect(body.text_id.length).toBeLessThanOrEqual(1300)
    expect(body.text_id).toContain('📊')
    expect(body.totals.expense).toBe(10_000)
    expect(Array.isArray(body.accounts)).toBe(true)
    expect(Array.isArray(body.largest_transactions)).toBe(true)
    expect(body.largest_transactions[0].amount).toBe(7000)
  })

  it('angka totals.expense IDENTIK dengan GET /v1/summary untuk periode yang sama (kriteria selesai §8)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const reportRes = await app.request(`/v1/reports/monthly?month=${FIXED_MONTH}`, { headers: { Authorization: `Bearer ${token}` } })
    const summaryRes = await app.request(`/v1/summary?period=${FIXED_MONTH}`, { headers: { Authorization: `Bearer ${token}` } })
    const report = await reportRes.json()
    const summary = await summaryRes.json()
    expect(report.totals.expense).toBe(summary.totals.expense)
    expect(report.totals.income).toBe(summary.totals.income)
    expect(report.totals.expense).toBe(10_000)
  })

  it('tanpa ?month -> default bulan sebelumnya, tidak error', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/reports/monthly', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.period.month).toMatch(/^\d{4}-\d{2}$/)
  })
})
