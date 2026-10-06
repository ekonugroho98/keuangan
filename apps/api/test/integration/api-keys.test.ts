import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// Integration test Fase 6 (API key, idempotency, rate limit, audit log) — sama polanya dengan
// transactions.test.ts/household.test.ts. EKO (seed.sql) dipakai sebagai actor; API key yang
// dibuat dalam test ini dicabut lagi di afterAll supaya tidak menumpuk di DB lokal.
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
  console.warn('[integration] DATABASE_URL tidak terjangkau, test api-keys.test.ts dilewati.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('api keys, idempotency, rate limit, audit log (DB lokal)', () => {
  const createdKeyIds: string[] = []
  let createdTxId: string | undefined

  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    for (const id of createdKeyIds) {
      await app.request(`/v1/api-keys/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
    if (createdTxId) {
      await app.request(`/v1/transactions/${createdTxId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
  })

  it('membuat API key, memakainya untuk GET, lalu mencabutnya menolak pemakaian lanjutan', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)

    const createRes = await app.request('/v1/api-keys', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-key', scope: 'write' }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.secret).toMatch(/^kf_live_[0-9A-Za-z]{40}$/)
    createdKeyIds.push(created.api_key.id)

    const useRes = await app.request('/v1/accounts', { headers: { Authorization: `Bearer ${created.secret}` } })
    expect(useRes.status).toBe(200)
    expect(useRes.headers.get('x-ratelimit-limit-minute')).toBeTruthy()

    const jwtOnlyRes = await app.request('/v1/me', { headers: { Authorization: `Bearer ${created.secret}` } })
    expect(jwtOnlyRes.status).toBe(403)
    expect((await jwtOnlyRes.json()).error.code).toBe('jwt_required')

    const revokeRes = await app.request(`/v1/api-keys/${created.api_key.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    expect(revokeRes.status).toBe(200)

    const afterRevokeRes = await app.request('/v1/accounts', { headers: { Authorization: `Bearer ${created.secret}` } })
    expect(afterRevokeRes.status).toBe(401)
    expect((await afterRevokeRes.json()).error.code).toBe('api_key_revoked')
  })

  it('API key dengan scope read ditolak melakukan mutasi (insufficient_scope)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const createRes = await app.request('/v1/api-keys', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'read-only-key', scope: 'read' }),
    })
    const created = await createRes.json()
    createdKeyIds.push(created.api_key.id)

    const res = await app.request('/v1/transactions', {
      method: 'POST', headers: { Authorization: `Bearer ${created.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amount: 1, account: 'BCA suami', category: 'Makanan' }),
    })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('insufficient_scope')
  })

  it('Idempotency-Key: request kedua me-replay respons PERTAMA sebagai objek JSON asli (bukan string ganda-encoded)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const createRes = await app.request('/v1/api-keys', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'idem-key', scope: 'write' }),
    })
    const created = await createRes.json()
    createdKeyIds.push(created.api_key.id)

    const idemKey = crypto.randomUUID()
    const body = JSON.stringify({ type: 'expense', amount: 777, account: 'BCA suami', category: 'Makanan', note: 'idem-regression-test' })
    const headers = { Authorization: `Bearer ${created.secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': idemKey }

    const first = await app.request('/v1/transactions', { method: 'POST', headers, body })
    expect(first.status).toBe(201)
    const firstBody = await first.json()
    expect(firstBody.transaction.note).toBe('idem-regression-test')
    createdTxId = firstBody.transaction.id

    const second = await app.request('/v1/transactions', { method: 'POST', headers, body })
    expect(second.status).toBe(201)
    expect(second.headers.get('idempotent-replayed')).toBe('true')
    const secondBody = await second.json()
    // Regresi: sebelum fix sql.json(), response_body tersimpan sebagai jsonb STRING ganda-encoded,
    // jadi `second.json()` mengembalikan STRING (bukan object) dan properti ini tidak bisa diakses.
    expect(typeof secondBody).toBe('object')
    expect(secondBody.transaction.id).toBe(firstBody.transaction.id)
    expect(secondBody.transaction.note).toBe('idem-regression-test')

    // Body yang sama tapi Idempotency-Key berbeda HARUS membuat transaksi baru, bukan replay.
    const thirdKey = crypto.randomUUID()
    const third = await app.request('/v1/transactions', { method: 'POST', headers: { ...headers, 'Idempotency-Key': thirdKey }, body })
    expect(third.status).toBe(201)
    const thirdBody = await third.json()
    expect(thirdBody.transaction.id).not.toBe(firstBody.transaction.id)
    await app.request(`/v1/transactions/${thirdBody.transaction.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  })

  it('Idempotency-Key yang sama dengan body BERBEDA ditolak idempotency_key_reused', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const createRes = await app.request('/v1/api-keys', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'idem-reuse-key', scope: 'write' }),
    })
    const created = await createRes.json()
    createdKeyIds.push(created.api_key.id)

    const idemKey = crypto.randomUUID()
    const headers = { Authorization: `Bearer ${created.secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': idemKey }
    const first = await app.request('/v1/transactions', {
      method: 'POST', headers, body: JSON.stringify({ type: 'expense', amount: 1, account: 'BCA suami', category: 'Makanan' }),
    })
    expect(first.status).toBe(201)
    const firstTxId = (await first.json()).transaction.id
    await app.request(`/v1/transactions/${firstTxId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })

    const second = await app.request('/v1/transactions', {
      method: 'POST', headers, body: JSON.stringify({ type: 'expense', amount: 2, account: 'BCA suami', category: 'Makanan' }),
    })
    expect(second.status).toBe(422)
    expect((await second.json()).error.code).toBe('idempotency_key_reused')
  })

  it('PATCH /v1/transactions/{id} benar-benar mengubah data (regresi bug jsonb ganda-encoded di update_transaction)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const createRes = await app.request('/v1/transactions', {
      method: 'POST', headers, body: JSON.stringify({ type: 'expense', amount: 1000, account: 'BCA suami', category: 'Makanan', note: 'sebelum-edit' }),
    })
    const created = await createRes.json()
    createdTxId = created.transaction.id

    const patchRes = await app.request(`/v1/transactions/${createdTxId}`, {
      method: 'PATCH', headers, body: JSON.stringify({ note: 'setelah-edit', amount: 2500 }),
    })
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    // Regresi: sebelum fix, update_transaction() menerima jsonb STRING (bukan object), semua
    // `p_patch->>'key'` mengembalikan null, jadi PATCH selalu no-op diam-diam dan tetap 200.
    expect(patched.note).toBe('setelah-edit')
    expect(patched.amount).toBe(2500)

    const getRes = await app.request(`/v1/transactions/${createdTxId}`, { headers })
    const fetched = await getRes.json()
    expect(fetched.note).toBe('setelah-edit')
    expect(fetched.amount).toBe(2500)
  })

  it('GET /v1/audit-log mencatat aksi yang baru terjadi', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    await app.request('/v1/accounts', { headers: { Authorization: `Bearer ${token}` } })

    const res = await app.request('/v1/audit-log?limit=5', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    const rows = Array.isArray(body) ? body : body.data
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].action).toBeTruthy()
  })
})
