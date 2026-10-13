import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// refineAgentCategory (categorize.ts): kategori makanan umum dari AGENT dikoreksi ke kategori household yang
// lebih spesifik; pilihan user lewat web (JWT) tidak disentuh. Sumber transaksi agent = api_key.
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

describe.skipIf(!dbReachable || process.env.CI === 'true')('koreksi kategori agent (DB lokal)', () => {
  const txIds: string[] = []
  let keyId = ''
  let catId = ''
  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const h = { Authorization: `Bearer ${token}` }
    for (const id of txIds) await app.request(`/v1/transactions/${id}`, { method: 'DELETE', headers: h })
    if (catId) await app.request(`/v1/categories/${catId}`, { method: 'DELETE', headers: h })
    if (keyId) await app.request(`/v1/api-keys/${keyId}`, { method: 'DELETE', headers: h })
  })

  it('agent: "Makanan" untuk sempol → Makan Beli & Jajan (source api_key); web: tetap Makanan', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const jwtH = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const cat = await app.request('/v1/categories', { method: 'POST', headers: jwtH, body: JSON.stringify({ name: 'Makan Beli & Jajan', type: 'expense', aliases: ['jajan'] }) })
    expect(cat.status).toBe(201)
    catId = (await cat.json()).id
    const key = await app.request('/v1/api-keys', { method: 'POST', headers: jwtH, body: JSON.stringify({ name: 'agent-cat-test', scope: 'write' }) })
    const k = await key.json()
    keyId = k.api_key.id
    const agentH = { Authorization: `Bearer ${k.secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }

    const body = { type: 'expense', account: 'BCA suami', category: 'Makanan', amount: 15000, note: 'Sempol - Arofah kebab Malaka Sari' }
    const a = await app.request('/v1/transactions', { method: 'POST', headers: agentH, body: JSON.stringify(body) })
    expect(a.status).toBe(201)
    const at = (await a.json()).transaction
    txIds.push(at.id)
    expect(at.category.name).toBe('Makan Beli & Jajan')
    expect(at.source).toBe('api_key')

    const w = await app.request('/v1/transactions', { method: 'POST', headers: jwtH, body: JSON.stringify(body) })
    const wt = (await w.json()).transaction
    txIds.push(wt.id)
    expect(wt.category.name).toBe('Makanan')
    expect(wt.source).toBe('web')

    const b = await app.request('/v1/transactions/batch', {
      method: 'POST', headers: { ...agentH, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ account: 'BCA suami', items: [{ amount: 12000, category: 'Makanan', note: 'Cilok' }, { amount: 30000, category: 'Makanan', note: 'Beras 2kg' }] }),
    })
    expect(b.status).toBe(201)
    const bt = (await b.json()).transactions as Array<{ id: string; note: string; category: { name: string } }>
    for (const t of bt) txIds.push(t.id)
    expect(Object.fromEntries(bt.map((t) => [t.note, t.category.name]))).toEqual({ Cilok: 'Makan Beli & Jajan', 'Beras 2kg': 'Makanan' })
  })
})
