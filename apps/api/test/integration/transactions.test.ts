import { SignJWT } from 'jose'
import postgres from 'postgres'
import { describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// Integration test: butuh Postgres lokal sungguhan (lihat 02-monorepo.md §4 "describe.skipIf").
// Jalankan `supabase/migrations/*.sql` + `supabase/seed.sql` ke DATABASE_URL di vitest.config.ts
// sebelum menjalankan file ini (lihat docs/spec/PROGRESS.md untuk cara setup DB test lokal).
const EKO_USER_ID = '00000000-0000-0000-0000-0000000000e0'
const BUDI_USER_ID = '00000000-0000-0000-0000-0000000000b0' // tidak ada household — menguji not_household_member

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

// Top-level await: describe.skipIf butuh kondisi SINKRON saat file di-collect, sebelum hook apa
// pun (beforeAll) sempat jalan — mengecek DB di dalam beforeAll tidak akan pernah mematikan skip.
const dbReachable = await checkDb()
if (!dbReachable) {
  console.warn('[integration] DATABASE_URL tidak terjangkau, test transactions.test.ts dilewati. Lihat PROGRESS.md untuk setup DB lokal.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('transactions integration (DB lokal)', () => {
  it('menolak request tanpa Authorization header', async () => {
    const app = buildApp()
    const res = await app.request('/v1/accounts')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('unauthorized')
  })

  it('user tanpa household mendapat not_household_member', async () => {
    const app = buildApp()
    const token = await mintJwt(BUDI_USER_ID)
    const res = await app.request('/v1/accounts', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('not_household_member')
  })

  it('mencatat expense kecil (paritas) lalu menolak expense yang melebihi saldo', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const createRes = await app.request('/v1/transactions', {
      method: 'POST', headers,
      body: JSON.stringify({ type: 'expense', amount: 1, account: 'BCA suami', category: 'Makanan', note: 'integration test' }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.transaction.id).toBeTruthy()
    expect(typeof created.account.balance).toBe('number')

    const overRes = await app.request('/v1/transactions', {
      method: 'POST', headers,
      body: JSON.stringify({ type: 'expense', amount: 9_999_999_999, account: 'BCA suami', category: 'Makanan' }),
    })
    expect(overRes.status).toBe(422)
    const overBody = await overRes.json()
    expect(overBody.error.code).toBe('insufficient_funds')
    expect(overBody.error.details.needed).toBe(9_999_999_999)
  })

  it('akun "BCA" tanpa pemilik menghasilkan 409 ambiguous_account dengan kandidat', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amount_text: '10rb', account: 'BCA', category: 'Makanan' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('ambiguous_account')
    expect(body.error.candidates).toHaveLength(2)
  })

  it('GET /v1/summary mengembalikan totals numerik untuk periode ini_bulan', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/summary?period=this_month', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.totals.income).toBe('number')
    expect(typeof body.totals.expense).toBe('number')
    expect(body.period.from).toMatch(/^\d{4}-\d{2}-01$/)
  })
})
