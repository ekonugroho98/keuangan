import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// Titipan → Piutang (apps/api/src/services/titipan.ts) + format note "[Toko] Nama item" — household seed "Keluarga Eko".
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
  console.warn('[integration] DATABASE_URL tidak terjangkau, test titipan.test.ts dilewati.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('titipan → Piutang + note [Toko] (DB lokal)', () => {
  const createdTxIds: string[] = []
  const createdPiutangIds: string[] = []
  const json = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    // piutang dulu (lend_transaction_id → transactions), lalu transaksi, lalu keyword yang mungkin terpelajari.
    await admin`delete from piutang where id = any(${createdPiutangIds}::uuid[])`
    for (const id of createdTxIds) {
      await app.request(`/v1/transactions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
    await admin`delete from category_keywords where keyword = any(${['sabun lifebuoy 85g', 'pulsa 50rb', 'teh kotak']})`
    await app.request('/v1/households/current', { method: 'PATCH', headers: json(token), body: JSON.stringify({ features: { shopping_stock: { enabled: false } } }) })
    await admin.end()
  })

  it('ingest_receipt: item titipan (field + kata "titipan") → kategori Piutang, satu catatan piutang per orang, note "[Toko] …"', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    await app.request('/v1/households/current', { method: 'PATCH', headers: json(token), body: JSON.stringify({ features: { shopping_stock: { enabled: true } } }) })

    const res = await app.request('/v1/receipts/ingest', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({
        account: 'BCA suami',
        merchant: 'Indomaret',
        ref_no: 'R-TTP-1',
        shopping: false,
        pantry: false,
        items: [
          { name: 'Sabun Lifebuoy 85g', amount: 4_500, category: 'Shopping', titipan: 'bu ani' },
          { name: 'Indomie Goreng titipan Bu Ani', amount: 3_500, category: 'Makanan' },
          { name: 'Teh Kotak', amount: 4_000, category: 'Makanan' },
        ],
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    for (const t of body.transactions) createdTxIds.push(t.id)
    const byNote = Object.fromEntries(body.transactions.map((t: { note: string; category: { name: string } }) => [t.note, t]))

    expect(byNote['[Indomaret] Sabun Lifebuoy 85g (titipan Bu Ani) [ref: R-TTP-1]'].category.name).toBe('Piutang')
    expect(byNote['[Indomaret] Indomie Goreng titipan Bu Ani [ref: R-TTP-1]'].category.name).toBe('Piutang')
    expect(byNote['[Indomaret] Teh Kotak [ref: R-TTP-1]'].category.name).toBe('Makanan')

    expect(body.piutang).toHaveLength(1)
    expect(body.piutang[0]).toMatchObject({ borrower_name: 'Bu Ani', total: 8_000, items: ['Sabun Lifebuoy 85g', 'Indomie Goreng titipan Bu Ani'] })
    createdPiutangIds.push(body.piutang[0].id)

    const list = await app.request('/v1/piutang', { headers: { Authorization: `Bearer ${token}` } })
    const piutang: Array<{ id: string }> = await list.json()
    const row = piutang.find((p) => p.id === body.piutang[0].id)
    expect(row).toMatchObject({ borrower_name: 'Bu Ani', total: 8_000, remaining: 8_000 })
  })

  it('POST /v1/transactions/batch (modal web): "titipan" di note → Piutang + piutang tertaut ke transaksinya; TIDAK dipelajari', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions/batch', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({ account: 'BCA suami', items: [{ amount: 52_000, category: 'Utilitas', note: '[Alfamart] Pulsa 50rb titipan Dedi' }] }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    for (const t of body.transactions) createdTxIds.push(t.id)
    expect(body.transactions[0].category.name).toBe('Piutang')
    expect(body.piutang).toHaveLength(1)
    expect(body.piutang[0]).toMatchObject({ borrower_name: 'Dedi', total: 52_000 })
    createdPiutangIds.push(body.piutang[0].id)

    const admin = postgres(ADMIN_URL, { prepare: false, max: 1 })
    const [p] = await admin<{ lend_transaction_id: string | null; from_account_id: string | null }[]>`select lend_transaction_id, from_account_id from piutang where id = ${body.piutang[0].id}`
    expect(p!.lend_transaction_id).toBe(body.transactions[0].id)
    expect(p!.from_account_id).toBe(body.account.id)
    const learned = await admin<{ keyword: string }[]>`select keyword from category_keywords where keyword like 'pulsa 50rb%'`
    await admin.end()
    expect(learned).toHaveLength(0)
  })

  it('batch: kategori dipilih "Piutang" tanpa nama → piutang atas nama "Titipan"', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/transactions/batch', {
      method: 'POST',
      headers: json(token),
      body: JSON.stringify({ account: 'BCA suami', items: [{ amount: 10_000, category: 'Piutang', note: 'Teh Kotak' }] }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    for (const t of body.transactions) createdTxIds.push(t.id)
    expect(body.piutang[0]).toMatchObject({ borrower_name: 'Titipan', total: 10_000 })
    createdPiutangIds.push(body.piutang[0].id)
  })
})
