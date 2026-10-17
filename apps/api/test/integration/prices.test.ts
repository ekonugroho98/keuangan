import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// Perbandingan harga antar toko (migrasi 0025, prices.ts) — household seed "Keluarga Eko". User seed tanpa
// BYOK → tidak ada kanonikalisasi AI; nama kanonik diisi langsung ke product_knowledge untuk mensimulasikannya.
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
if (!dbReachable) console.warn('[integration] DATABASE_URL tidak terjangkau, test prices.test.ts dilewati.')

describe.skipIf(!dbReachable || process.env.CI === 'true')('perbandingan harga antar toko (DB lokal)', () => {
  const createdTxIds: string[] = []
  const KW = ['lfby bs 85g', 'lifebuoy sabun 110gr', 'zz sabun kw 85g']
  const json = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    for (const id of createdTxIds) await app.request(`/v1/transactions/${id}`, { method: 'DELETE', headers: auth(token) })
    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    await admin`delete from product_prices where transaction_id = any(${createdTxIds}::uuid[])`
    await admin`delete from product_aliases where keyword = any(${KW})`
    await admin`delete from product_knowledge where keyword = any(${KW})`
    await admin`delete from category_keywords where keyword = any(${[...KW, 'lifebuoy sabun 110gr']})`
    await admin`delete from shopping_items where name = 'Sabun Lifebuoy TEST'`
    await app.request('/v1/households/current', { method: 'PATCH', headers: json(token), body: JSON.stringify({ features: { shopping_stock: { enabled: false } } }) })
    await admin.end()
  })

  it('parse_item_size / item_keyword / product_key / merchant_key', async () => {
    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    const rows = await admin<{ base_name: string; size_value: string | null; size_unit: string | null; multiplier: number }[]>`
      select (p).base_name, (p).size_value::text, (p).size_unit, (p).multiplier
      from (select parse_item_size(n) as p from unnest(${['LFBY BS 85G x2', 'Minyak Bimoli 2L', 'Beras 5 KG', 'Indomie Goreng', 'Sabun 1,5kg']}::text[]) with ordinality as u(n, i) order by i) s
    `
    const [k] = await admin<{ kw: string; pk: string; mk: string; mk2: string }[]>`
      select item_keyword('LFBY BS 85G x2') as kw, product_key('Sabun Lifebuoy Batang 85g') as pk, merchant_key('INDOMARET Jatikramat') as mk, merchant_key('Toko Bu Siti') as mk2
    `
    await admin.end()
    expect(rows.map((r) => [r.base_name, r.size_value === null ? null : Number(r.size_value), r.size_unit, r.multiplier])).toEqual([
      ['lfby bs', 85, 'g', 2],
      ['minyak bimoli', 2000, 'ml', 1],
      ['beras', 5000, 'g', 1],
      ['indomie goreng', null, null, 1],
      ['sabun', 1500, 'g', 1],
    ])
    expect(k).toEqual({ kw: 'lfby bs 85g', pk: 'batang lifebuoy sabun', mk: 'indomaret', mk2: 'toko bu siti' })
  })

  it('ingest_receipt mencatat harga per toko; nama kasir beda bertemu lewat nama kanonik; banding per 100 g', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    await app.request('/v1/households/current', { method: 'PATCH', headers: json(token), body: JSON.stringify({ features: { shopping_stock: { enabled: true } } }) })
    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    await admin`select learn_product_knowledge('lfby bs 85g', 'household', 'Lifebuoy sabun batang 85g', 'web', 'lifebuoy sabun batang')`
    await admin`select learn_product_knowledge('lifebuoy sabun 110gr', 'household', 'Lifebuoy sabun 110g', 'web', 'sabun lifebuoy batang')`
    await admin.end()

    const ingest = async (merchant: string, name: string, amount: number, qty = 1) => {
      const res = await app.request('/v1/receipts/ingest', {
        method: 'POST',
        headers: json(token),
        body: JSON.stringify({ account: 'BCA suami', merchant, shopping: false, pantry: false, items: [{ name, amount, qty, category: 'Shopping' }] }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      for (const t of body.transactions) createdTxIds.push(t.id)
      return body
    }
    const a = await ingest('Indomaret Jatikramat', 'LFBY BS 85G x2', 9_000)
    expect(a.prices_recorded).toBe(1)
    await ingest('ALFAMART Cibubur', 'LIFEBUOY SABUN 110GR', 5_200)

    const res = await app.request('/v1/prices/compare?q=sabun%20lifebuoy', { headers: auth(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    const p = body.products[0]
    expect(p.product_name).toBe('lifebuoy sabun batang')
    expect(p.compare_basis).toBe('per 100 g')
    // Alfamart 5200/110g = 4727/100g; Indomaret 9000/2 = 4500 per 85g = 5294/100g
    expect(p.stores.map((s: { merchant: string; per_unit_price: number; price: number }) => [s.merchant, s.per_unit_price, s.price])).toEqual([
      ['ALFAMART Cibubur', 4727, 5200],
      ['Indomaret Jatikramat', 5294, 4500],
    ])
    expect(p.savings_pct).toBe(11)
  })

  it('daftar belanja menampilkan toko termurah; tanpa riwayat → cheapest null', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    await app.request('/v1/shopping', { method: 'POST', headers: json(token), body: JSON.stringify({ name: 'Sabun Lifebuoy TEST' }) })
    const res = await app.request('/v1/shopping', { headers: auth(token) })
    const list = await res.json()
    const item = list.find((i: { name: string }) => i.name === 'Sabun Lifebuoy TEST')
    expect(item.cheapest).toMatchObject({ merchant: 'ALFAMART Cibubur', compare_basis: 'per 100 g', per_unit_price: 4727, stores: 2 })
  })

  it('batch web dengan note "[Toko] item" juga tercatat; alias manual menyatukan item yang belum dikenal', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions/batch', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({ account: 'BCA suami', items: [{ amount: 3_000, category: 'Shopping', note: '[Warung Bu Siti] ZZ SABUN KW 85G' }] }),
    })
    expect(res.status).toBe(201)
    for (const t of (await res.json()).transactions) createdTxIds.push(t.id)

    // Sebelum alias: produk terpisah ("sabun kw zz").
    const before = await (await app.request('/v1/prices/compare?q=zz%20sabun', { headers: auth(token) })).json()
    expect(before.products[0].product_name).toBe('zz sabun kw')

    const alias = await app.request('/v1/prices/aliases', { method: 'POST', headers: json(token), body: JSON.stringify({ item: 'ZZ SABUN KW 85G', same_as: 'LFBY BS 85G' }) })
    expect(alias.status).toBe(200)
    expect(await alias.json()).toEqual({ keyword: 'zz sabun kw 85g', canonical_name: 'lifebuoy sabun batang' })

    // Pastikan alias juga memperkaya product_knowledge global untuk keluarga lain
    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    const [pkRow] = await admin<{ canonical_name: string }[]>`select canonical_name from product_knowledge where keyword = 'zz sabun kw 85g'`
    await admin.end()
    expect(pkRow?.canonical_name).toBe('lifebuoy sabun batang')

    const after = await (await app.request('/v1/prices/compare?q=lifebuoy', { headers: auth(token) })).json()
    expect(after.products[0].stores[0]).toMatchObject({ merchant: 'Warung Bu Siti', per_unit_price: 3529 })
    expect(after.products[0].stores).toHaveLength(3)
  })

  it('mode katalog (tanpa q) mengembalikan daftar produk; transaksi satuan manual & PATCH ikut tersinkron', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)

    // Transaksi pengeluaran manual satuan dengan "[Toko] Nama Barang"
    const txRes = await app.request('/v1/transactions', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({
        type: 'expense',
        account: 'BCA suami',
        category: 'Shopping',
        amount: 4_800,
        note: '[Superindo] LFBY BS 85G',
      }),
    })
    expect(txRes.status).toBe(201)
    const txId = (await txRes.json()).transaction.id
    createdTxIds.push(txId)

    // Edit harga lewat PATCH → product_prices ikut ter-update
    const patchRes = await app.request(`/v1/transactions/${txId}`, {
      method: 'PATCH',
      headers: json(token),
      body: JSON.stringify({ amount: 3_400 }),
    })
    expect(patchRes.status).toBe(200)

    // Mode katalog tanpa parameter q
    const catalogRes = await app.request('/v1/prices/compare', { headers: auth(token) })
    expect(catalogRes.status).toBe(200)
    const catalog = await catalogRes.json()
    expect(catalog.query).toBe('')
    const lifebuoy = catalog.products.find((p: { product_name: string }) => p.product_name === 'lifebuoy sabun batang')
    expect(lifebuoy).toBeTruthy()
    const superindo = lifebuoy.stores.find((s: { merchant: string }) => s.merchant === 'Superindo')
    expect(superindo).toMatchObject({ price: 3400, per_unit_price: 4000 })

    // Hapus transaksi manual tadi supaya test berikutnya tetap konsisten
    await app.request(`/v1/transactions/${txId}`, { method: 'DELETE', headers: auth(token) })
    createdTxIds.pop()
  })

  it('transaksi dihapus tidak ikut dibandingkan', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const last = createdTxIds[createdTxIds.length - 1]!
    await app.request(`/v1/transactions/${last}`, { method: 'DELETE', headers: auth(token) })
    const after = await (await app.request('/v1/prices/compare?q=lifebuoy', { headers: auth(token) })).json()
    expect(after.products[0].stores.map((s: { merchant: string }) => s.merchant)).not.toContain('Warung Bu Siti')
  })

  it('q terlalu pendek → 400', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/prices/compare?q=a', { headers: auth(token) })
    expect(res.status).toBe(400)
  })
})
