import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'
import { parseReceiptNote } from '@karaya/shared/format'

// Gudang kata kunci kategori (03-database.md §3.20–3.21, migrasi 0024) — household seed "Keluarga Eko".
// User seed `ai_config` kosong → tidak ada pencarian web di sini (jalur itu best-effort & butuh BYOK),
// jadi yang diuji: normalisasi nama kategori agent, fallback "Lainnya", belajar dari PATCH/batch, dan
// keyword yang dipelajari mengalahkan tebakan agent pada ingest berikutnya.
const EKO_USER_ID = '00000000-0000-0000-0000-0000000000e0'
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54322/postgres'

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
  console.warn('[integration] DATABASE_URL tidak terjangkau, test category-keywords.test.ts dilewati.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('gudang kata kunci kategori (DB lokal)', () => {
  const createdTxIds: string[] = []
  const KEYWORDS = ['lfby bs 85g', 'token listrik 50rb', 'indomie goreng 85g', 'betadine 15ml']
  let lfbyTxId = ''

  const json = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    for (const id of createdTxIds) {
      await app.request(`/v1/transactions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
    await app.request('/v1/households/current', { method: 'PATCH', headers: json(token), body: JSON.stringify({ features: { shopping_stock: { enabled: false } } }) })
    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    await admin`delete from category_keywords where keyword = any(${KEYWORDS})`
    await admin.end()
  })

  it('ingest_receipt: kategori kosong/asing/nama lama tidak menggagalkan struk, dipetakan ke kategori household', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    await app.request('/v1/households/current', { method: 'PATCH', headers: json(token), body: JSON.stringify({ features: { shopping_stock: { enabled: true } } }) })

    const res = await app.request('/v1/receipts/ingest', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({
        account: 'BCA suami',
        merchant: 'Indomaret',
        shopping: false,
        pantry: false,
        items: [
          { name: 'LFBY BS 85G', amount: 4_500 },
          { name: 'Token Listrik 50rb', amount: 50_000, category: 'Tagihan' },
          { name: 'Indomie Goreng 85g', amount: 3_500, category: 'Makanan & Minuman' },
        ],
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    const byNote = Object.fromEntries(body.transactions.map((t: { id: string; note: string; category: { name: string } }) => [parseReceiptNote(t.note).name, t]))
    for (const t of body.transactions) createdTxIds.push(t.id)

    expect(byNote['LFBY BS 85G'].category.name).toBe('Lainnya') // tak dikenal, tanpa AI/web → Lainnya, bukan Makanan
    expect(byNote['Token Listrik 50rb'].category.name).toBe('Utilitas') // "Tagihan" asing → regex nama item
    expect(byNote['Indomie Goreng 85g'].category.name).toBe('Makanan') // nama taksonomi lama → Makanan
    lfbyTxId = byNote['LFBY BS 85G'].id
  })

  it('PATCH kategori = koreksi user → keyword dipelajari (source user)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request(`/v1/transactions/${lfbyTxId}`, { method: 'PATCH', headers: json(token), body: JSON.stringify({ category: 'Shopping' }) })
    expect(res.status).toBe(200)
    expect((await res.json()).category.name).toBe('Shopping')

    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    const rows = await admin<{ keyword: string; source: string; name: string }[]>`
      select ck.keyword, ck.source::text, c.name from category_keywords ck join categories c on c.id = ck.category_id where ck.keyword = 'lfby bs 85g'
    `
    await admin.end()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ keyword: 'lfby bs 85g', source: 'user', name: 'Shopping' })
  })

  it('ingest berikutnya: keyword yang dipelajari mengalahkan tebakan agent ("Makanan")', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/receipts/ingest', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({ account: 'BCA suami', shopping: false, pantry: false, items: [{ name: 'LFBY BS 85G x2', amount: 9_000, category: 'Makanan' }] }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    for (const t of body.transactions) createdTxIds.push(t.id)
    expect(body.transactions[0].category.name).toBe('Shopping')
  })

  it('POST /v1/transactions/batch lewat JWT (modal scan web) = konfirmasi user → dipelajari', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions/batch', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({ account: 'BCA suami', items: [{ amount: 12_000, category: 'Kesehatan', note: 'Betadine 15ml' }] }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    for (const t of body.transactions) createdTxIds.push(t.id)

    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    const rows = await admin<{ name: string }[]>`
      select c.name from category_keywords ck join categories c on c.id = ck.category_id where ck.keyword = 'betadine 15ml'
    `
    await admin.end()
    expect(rows.map((r) => r.name)).toEqual(['Kesehatan'])
  })
})
