import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// Integration test F-0 + F-A (10-fitur-opsional-keluarga.md §2, §3) — butuh Postgres lokal
// sungguhan, pola sama dengan transactions.test.ts/household.test.ts. Memakai household seed
// "Keluarga Eko" (Eko + Rina, 2 owner) — tes men-TOGGLE flag beneficiary household ini ON lalu
// mengembalikannya ke OFF di afterAll supaya tidak mengganggu test file lain yang share DB yang sama.
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
  return new SignJWT({ sub, aud: 'authenticated', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

const dbReachable = await checkDb()
if (!dbReachable) {
  console.warn('[integration] DATABASE_URL tidak terjangkau, test features-beneficiaries.test.ts dilewati.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('F-0 feature flag + F-A beneficiary (DB lokal)', () => {
  let anakId: string | undefined

  afterAll(async () => {
    // Kembalikan flag ke mati supaya test file lain (yang share household "Keluarga Eko" yang
    // sama) tidak terpengaruh kalau dijalankan berurutan lagi di sesi lain.
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: { beneficiary: { enabled: false } } }),
    })
  })

  it('household baru/belum disentuh: features semua enabled:false, tidak pernah 403', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/households/current', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.features.beneficiary.enabled).toBe(false)
    expect(body.features.monthly_report.enabled).toBe(false)
    expect(body.features.reconciliation.enabled).toBe(false)
    expect(body.features.shopping_stock.enabled).toBe(false)
  })

  it('menulis ke /v1/beneficiaries saat flag mati -> 403 feature_disabled', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/beneficiaries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anak', kind: 'child' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('feature_disabled')
    expect(body.error.details.feature).toBe('beneficiary')
  })

  it('field beneficiary di POST /v1/transactions saat flag mati -> 400 validation_error (bukan diam-diam diabaikan)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amount: 1000, account: 'BCA suami', category: 'Makanan', beneficiary: 'Anak' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation_error')
    expect(body.error.details.field).toBe('beneficiary')
  })

  it('owner menyalakan flag beneficiary -> partial merge tidak mereset fitur lain, seeding 2 member berjalan', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const patchRes = await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: { beneficiary: { enabled: true } } }),
    })
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.features.beneficiary.enabled).toBe(true)
    expect(patched.features.monthly_report.enabled).toBe(false) // tidak ikut ter-reset

    const listRes = await app.request('/v1/beneficiaries', { headers: { Authorization: `Bearer ${token}` } })
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.length).toBeGreaterThanOrEqual(2) // Eko + Rina ter-seed otomatis
    const names = list.map((b: { name: string }) => b.name)
    expect(names).toContain('Eko')
    expect(names).toContain('Rina')
  })

  it('owner bisa buat beneficiary baru non-member ("Anak")', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/beneficiaries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anak', kind: 'child', aliases: ['anak-anak', 'bocah'] }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Anak')
    expect(body.kind).toBe('child')
    anakId = body.id
  })

  it('POST /v1/transactions dengan beneficiary:"Anak" (nama) ter-resolve dan muncul di respons', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amount: 48_500, account: 'BCA suami', category: 'Kesehatan', note: 'pampers', beneficiary: 'Anak' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.transaction.beneficiary).not.toBeNull()
    expect(body.transaction.beneficiary.id).toBe(anakId)
    expect(body.transaction.beneficiary.name).toBe('Anak')
  })

  it('GET /v1/summary?scope=beneficiary&beneficiary=Anak menghitung expense yang baru dicatat', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/summary?period=this_month&scope=beneficiary&beneficiary=Anak', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totals.expense).toBeGreaterThanOrEqual(48_500)
    expect(Array.isArray(body.by_beneficiary)).toBe(true)
    expect(body.by_beneficiary.some((b: { beneficiary: string }) => b.beneficiary === 'Anak')).toBe(true)
  })

  it('GET /v1/summary?scope=beneficiary: beneficiary=none = bersama saja; tanpa referensi -> 400', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const none = await app.request('/v1/summary?period=this_month&scope=beneficiary&beneficiary=none', { headers: { Authorization: `Bearer ${token}` } })
    expect(none.status).toBe(200)
    expect(typeof (await none.json()).totals.expense).toBe('number')
    const missing = await app.request('/v1/summary?period=this_month&scope=beneficiary', { headers: { Authorization: `Bearer ${token}` } })
    expect(missing.status).toBe(400)
    expect((await missing.json()).error.details.field).toBe('beneficiary')
  })

  it('PATCH /v1/beneficiaries/{id} rename ke nama yang sudah ada -> 400, bukan 500', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request(`/v1/beneficiaries/${anakId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'eko' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation_error')
  })

  it('PATCH nama household saja TIDAK menulis ulang features (flag yang sudah ON tetap ON)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Keluarga Eko' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).features.beneficiary.enabled).toBe(true)
  })

  it('GET /v1/transactions?beneficiary=Anak memfilter hanya transaksi "Anak"', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions?beneficiary=Anak', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.length).toBeGreaterThanOrEqual(1)
    for (const tx of body.data) expect(tx.beneficiary?.name).toBe('Anak')
  })

  it('PATCH /v1/transactions/{id} dengan beneficiary_id:null mengembalikan ke bersama', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const createRes = await app.request('/v1/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amount: 5000, account: 'BCA suami', category: 'Makanan', beneficiary_id: anakId }),
    })
    const created = await createRes.json()
    expect(created.transaction.beneficiary.id).toBe(anakId)

    const patchRes = await app.request(`/v1/transactions/${created.transaction.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ beneficiary_id: null }),
    })
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.beneficiary).toBeNull()
  })

  it('nama beneficiary yang tidak ada -> 404 beneficiary_not_found dengan candidates', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amount: 1000, account: 'BCA suami', category: 'Makanan', beneficiary: 'Tidak Ada Orang Ini' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('beneficiary_not_found')
  })

  it('DELETE /v1/beneficiaries/{id} soft-delete, transaksi lama tetap simpan nama via riwayat', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request(`/v1/beneficiaries/${anakId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const listRes = await app.request('/v1/beneficiaries', { headers: { Authorization: `Bearer ${token}` } })
    const list = await listRes.json()
    expect(list.find((b: { id: string }) => b.id === anakId)).toBeUndefined()
  })

  it('owner mematikan flag lagi -> GET /v1/beneficiaries ikut 403 (baca pun ditolak, bukan array kosong)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: { beneficiary: { enabled: false } } }),
    })
    const res = await app.request('/v1/beneficiaries', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('feature_disabled')
  })
})
