import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// GET /v1/insights/spending (insights.ts) — household seed "Keluarga Eko", rentang tanggal lampau supaya
// tidak bercampur dengan transaksi test lain.
const EKO_USER_ID = '00000000-0000-0000-0000-0000000000e0'

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
  return new SignJWT({ sub, aud: 'authenticated', role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret)
}
const dbReachable = await checkDb()

describe.skipIf(!dbReachable || process.env.CI === 'true')('analisa pengeluaran (DB lokal)', () => {
  const created: string[] = []
  const json = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })
  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    for (const id of created) await app.request(`/v1/transactions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  })

  it('rentang kustom + filter kategori: total, item berulang, pembanding periode sebelumnya', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const post = async (date: string, items: Array<{ amount: number; note: string }>) => {
      const res = await app.request('/v1/transactions/batch', { method: 'POST', headers: json(token), body: JSON.stringify({ account: 'BCA suami', date, items: items.map((i) => ({ ...i, category: 'Makanan' })) }) })
      expect(res.status).toBe(201)
      for (const t of (await res.json()).transactions) created.push(t.id)
    }
    await post('2025-01-03', [{ amount: 20000, note: 'ZZ Bakso (Warung Test)' }])
    await post('2025-01-10', [{ amount: 25000, note: 'ZZ Bakso (Warung Test)' }, { amount: 5000, note: 'ZZ Es teh' }])
    await post('2024-12-05', [{ amount: 10000, note: 'ZZ Bakso' }])

    const res = await app.request('/v1/insights/spending?from=2025-01-01&to=2025-01-10&category=Makanan&q=zz', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.filter).toMatchObject({ category: 'Makanan', q: 'zz' })
    expect(body.totals).toMatchObject({ total: 50000, count: 3, active_days: 2, per_day: 5000 })
    expect(body.top_items[0]).toMatchObject({ item: 'ZZ Bakso', count: 2, total: 45000, places: ['Warung Test'] })
    expect(body.top_days[0]).toMatchObject({ date: '2025-01-10', total: 30000 })
    // Rentang mulai tanggal 1 → dibanding tanggal yang sama bulan lalu (1–10 Des 2024).
    expect(body.comparison).toMatchObject({ from: '2024-12-01', to: '2024-12-10', total: 10000, change_pct: 400 })
    expect(body.transactions).toHaveLength(3)
    expect(body.budget).toBeNull()
  })

  it('periode tidak dikenal → 400', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/insights/spending?period=kemarin_lusa', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(400)
  })
})
