import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// F-D belanja & pantry (10-fitur-opsional-keluarga.md §6) — household seed "Keluarga Eko".
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
  console.warn('[integration] DATABASE_URL tidak terjangkau, test shopping-pantry.test.ts dilewati.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('F-D belanja & pantry (DB lokal)', () => {
  const createdTxIds: string[] = []

  afterAll(async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    for (const id of createdTxIds) {
      await app.request(`/v1/transactions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
    await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: { shopping_stock: { enabled: false } } }),
    })
  })

  it('menulis ke /v1/shopping saat flag mati -> 403 feature_disabled', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/shopping', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Telur' }),
    })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('feature_disabled')
  })

  it('owner menyalakan flag shopping_stock', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: { shopping_stock: { enabled: true } } }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).features.shopping_stock.enabled).toBe(true)
  })

  let shoppingId: string
  it('tambah item belanja manual "Pampers"', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/shopping', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pampers', notes: 'ukuran M' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.status).toBe('needed')
    shoppingId = body.id
  })

  let pantryId: string
  it('tambah item pantry "Telur" di Kulkas (nama Indonesia diterima)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/pantry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Telur', unit: 'butir', qty: 2, min_qty: 5, location: 'kulkas' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.location).toBe('fridge')
    pantryId = body.id
  })

  it('GET /v1/pantry?location=fridge memfilter benar', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/pantry?location=fridge', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.some((p: { id: string }) => p.id === pantryId)).toBe(true)
  })

  it('GET /v1/shopping/suggestions menyarankan "Telur" karena qty(2) <= min_qty(5)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/shopping/suggestions', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.some((s: { name: string }) => s.name === 'Telur')).toBe(true)
  })

  it('lokasi tidak dikenal -> validation_error', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/pantry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gula', location: 'gudang' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation_error')
  })

  it('POST /v1/receipts/ingest: satu struk mencatat transaksi + coret belanja "Pampers" + tambah stok "Telur"', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/receipts/ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: 'BCA suami',
        merchant: 'Indomaret',
        items: [
          { name: 'Pampers', qty: 1, amount: 48_500, category: 'Shopping' },
          { name: 'Telur', qty: 10, amount: 25_000, category: 'Makanan' },
        ],
        total: 73_500,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.transactions).toHaveLength(2)
    for (const t of body.transactions) createdTxIds.push(t.id)

    // "Telur" tidak ada di shopping list (hanya di pantry) -> unmatched di sisi shopping itu benar,
    // bukan bug (daftar belanja dan stok adalah dua hal berbeda yang kebetulan sama-sama dicek).
    expect(body.shopping.marked_bought.map((s: { name: string }) => s.name)).toContain('Pampers')
    expect(body.shopping.unmatched).toEqual(['Telur'])

    expect(body.pantry.updated.map((p: { name: string }) => p.name)).toContain('Telur')
    const telurUpdate = body.pantry.updated.find((p: { name: string }) => p.name === 'Telur')
    expect(telurUpdate.qty_before).toBe(2)
    expect(telurUpdate.qty_after).toBe(12)

    const shoppingCheck = await app.request('/v1/shopping?status=bought', { headers: { Authorization: `Bearer ${token}` } })
    const shoppingList = await shoppingCheck.json()
    expect(shoppingList.find((s: { id: string }) => s.id === shoppingId)?.status).toBe('bought')

    const pantryCheck = await app.request('/v1/pantry', { headers: { Authorization: `Bearer ${token}` } })
    const pantryList = await pantryCheck.json()
    expect(pantryList.find((p: { id: string }) => p.id === pantryId)?.qty).toBe(12)
  })

  it('note transaksi dari struk membawa merchant + [ref: ...] (bahan rekonsiliasi F-C)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/receipts/ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'BCA suami', merchant: 'Alfamart', ref_no: 'TIPB2610062015', items: [{ name: 'Garam', qty: 1, amount: 4000, category: 'Makanan' }], shopping: false, pantry: false }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    createdTxIds.push(body.transactions[0].id)
    expect(body.transactions[0].note).toBe('[Alfamart] Garam [ref: TIPB2610062015]')
    expect(body.shopping).toBeUndefined()
    expect(body.pantry).toBeUndefined()
  })

  it('items[].for saat fitur beneficiary MATI -> 400 validation_error (gate tidak bisa dilewati lewat struk)', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/receipts/ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'BCA suami', items: [{ name: 'Susu', qty: 1, amount: 15000, category: 'Makanan', for: 'anak' }] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('validation_error')
    expect(body.error.details.field).toBe('beneficiary')
  })

  it('PATCH /v1/shopping/{id} dengan transaction_id household lain -> 404, bukan diterima', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request(`/v1/shopping/${shoppingId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'bought', transaction_id: '11111111-1111-1111-1111-111111111111' }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('transaction_not_found')
  })

  it('PATCH /v1/pantry/{id}: bedakan "tidak dikirim" vs null (min_qty, expires_at); rename ke nama yang sudah ada -> 400', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const r1 = await app.request(`/v1/pantry/${pantryId}`, { method: 'PATCH', headers, body: JSON.stringify({ unit: 'biji' }) })
    expect(r1.status).toBe(200)
    const b1 = await r1.json()
    expect(b1.unit).toBe('biji')
    expect(b1.min_qty).toBe(5) // tidak dikirim -> tetap

    const r2 = await app.request(`/v1/pantry/${pantryId}`, { method: 'PATCH', headers, body: JSON.stringify({ min_qty: null, expires_at: '2030-01-01', location: 'freezer' }) })
    expect(r2.status).toBe(200)
    const b2 = await r2.json()
    expect(b2.min_qty).toBeNull()
    expect(b2.expires_at).toBe('2030-01-01')
    expect(b2.location).toBe('freezer')

    const r3 = await app.request(`/v1/pantry/${pantryId}`, { method: 'PATCH', headers, body: JSON.stringify({ expires_at: null, location: 'kulkas', min_qty: 5 }) })
    expect((await r3.json()).expires_at).toBeNull()

    const other = await app.request('/v1/pantry', { method: 'POST', headers, body: JSON.stringify({ name: 'Gula', location: 'shelf' }) })
    const gula = await other.json()
    const dup = await app.request(`/v1/pantry/${gula.id}`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'telur' }) })
    expect(dup.status).toBe(400)
    expect((await dup.json()).error.code).toBe('validation_error')
    await app.request(`/v1/pantry/${gula.id}`, { method: 'DELETE', headers })
  })

  it('receipt_total_mismatch kalau sum(items.amount) != total', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/receipts/ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'BCA suami', items: [{ name: 'Garam', qty: 1, amount: 5000, category: 'Makanan' }], total: 999 }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('receipt_total_mismatch')
  })

  it('movement manual: "abis telur 4" -> delta -4, qty berkurang', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request(`/v1/pantry/${pantryId}/movements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: -4, reason: 'consume', note: 'dipakai masak' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qty).toBe(8)
  })

  it('GET /v1/pantry/expiring: barang tanpa expires_at tidak muncul; dengan within_days pendek muncul', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const createRes = await app.request('/v1/pantry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Roti Tawar', location: 'shelf', qty: 1, expires_at: tomorrow, expires_estimated: true }),
    })
    const roti = await createRes.json()

    const res = await app.request('/v1/pantry/expiring?within_days=2', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.expiring.some((i: { id: string }) => i.id === roti.id)).toBe(true)
    expect(body.text_id.length).toBeGreaterThan(0)
    expect(body.text_id).toContain('Roti Tawar')

    // ack lalu panggil lagi dengan exclude_acked=true di HARI YANG SAMA -> tidak muncul lagi
    await app.request('/v1/pantry/expiring/ack', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [roti.id] }),
    })
    const afterAck = await app.request('/v1/pantry/expiring?within_days=2&exclude_acked=true', { headers: { Authorization: `Bearer ${token}` } })
    const afterAckBody = await afterAck.json()
    expect(afterAckBody.expiring.some((i: { id: string }) => i.id === roti.id)).toBe(false)

    // pertanyaan manual (tanpa exclude_acked) tetap melihat semua
    const manual = await app.request('/v1/pantry/expiring?within_days=2', { headers: { Authorization: `Bearer ${token}` } })
    const manualBody = await manual.json()
    expect(manualBody.expiring.some((i: { id: string }) => i.id === roti.id)).toBe(true)

    // Hari berikutnya (simulasi: ack kemarin), barang belum hari H -> tetap disembunyikan (bukan diingatkan ulang tiap hari)
    const admin = postgres(process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54322/postgres', { prepare: false, max: 1 })
    await admin`update pantry_items set expiry_notified_on = current_date - 1 where id = ${roti.id}`
    const nextDay = await app.request('/v1/pantry/expiring?within_days=2&exclude_acked=true', { headers: { Authorization: `Bearer ${token}` } })
    expect((await nextDay.json()).expiring.some((i: { id: string }) => i.id === roti.id)).toBe(false)

    // Hari H (expires_at = hari ini) dengan ack dari kemarin -> muncul SEKALI lagi
    await admin`update pantry_items set expires_at = current_date where id = ${roti.id}`
    const hariH = await app.request('/v1/pantry/expiring?within_days=2&exclude_acked=true', { headers: { Authorization: `Bearer ${token}` } })
    expect((await hariH.json()).expiring.some((i: { id: string }) => i.id === roti.id)).toBe(true)

    // Sudah lewat hari H dan pernah di-ack -> berhenti
    await admin`update pantry_items set expires_at = current_date - 1 where id = ${roti.id}`
    const lewat = await app.request('/v1/pantry/expiring?within_days=2&exclude_acked=true', { headers: { Authorization: `Bearer ${token}` } })
    const lewatBody = await lewat.json()
    expect([...lewatBody.expired, ...lewatBody.expiring].some((i: { id: string }) => i.id === roti.id)).toBe(false)
    await admin.end()

    await app.request(`/v1/pantry/${roti.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  })

  it('tidak ada barang kedaluwarsa -> text_id kosong', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const res = await app.request('/v1/pantry/expiring?within_days=0&include_expired=false', { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json()
    expect(body.text_id).toBe('')
  })

  it('DELETE item pantry & shopping', async () => {
    const app = buildApp()
    const token = await mintJwt(EKO_USER_ID)
    const r1 = await app.request(`/v1/pantry/${pantryId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    expect(r1.status).toBe(200)
    const r2 = await app.request(`/v1/shopping/${shoppingId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    expect(r2.status).toBe(200)
  })
})
