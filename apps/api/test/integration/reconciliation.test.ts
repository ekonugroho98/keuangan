import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

const EKO_USER_ID = '00000000-0000-0000-0000-0000000000e0'
const TEST_ADMIN_DATABASE_URL =
  process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres'

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

describe.skipIf(!dbReachable || process.env.CI === 'true')(
  'F-C Rekonsiliasi Mutasi Bank & F-D Auto-Stok E2E (DB lokal)',
  () => {
    const createdTxIds: string[] = []
    const createdImportIds: string[] = []
    const createdPantryIds: string[] = []

    beforeAll(async () => {
      // Pastikan migrasi 0032 terpasang di DB test lokal menggunakan role admin
      const sql = postgres(TEST_ADMIN_DATABASE_URL, { prepare: false, max: 1 })
      try {
        const migPath = join(__dirname, '../../../../supabase/migrations/00000000000032_statement_reconciliation.sql')
        const ddl = readFileSync(migPath, 'utf8')
        await sql.unsafe(ddl)
      } finally {
        await sql.end()
      }
    })

    afterAll(async () => {
      const app = buildApp()
      const token = await mintJwt(EKO_USER_ID)
      for (const id of createdTxIds) {
        await app.request(`/v1/transactions/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      for (const id of createdPantryIds) {
        await app.request(`/v1/pantry/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      if (createdImportIds.length > 0) {
        const sql = postgres(TEST_ADMIN_DATABASE_URL, { prepare: false, max: 1 })
        try {
          await sql`delete from statement_imports where id = any(${createdImportIds})`
        } finally {
          await sql.end()
        }
      }
      await app.request('/v1/households/current', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            reconciliation: { enabled: false },
            shopping_stock: { enabled: false, auto_stock: { enabled: false } },
          },
        }),
      })
    })

    it('menolak akses /v1/reconciliation/imports saat flag reconciliation mati (403 feature_disabled)', async () => {
      const app = buildApp()
      const token = await mintJwt(EKO_USER_ID)
      await app.request('/v1/households/current', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: { reconciliation: { enabled: false } } }),
      })

      const res = await app.request('/v1/reconciliation/imports', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('feature_disabled')
    })

    it('owner mengaktifkan flag reconciliation, mencatat transaksi BCA, lalu mencocokkan CSV mutasi BCA secara deterministik & idempoten', async () => {
      const app = buildApp()
      const token = await mintJwt(EKO_USER_ID)

      // 1. Aktifkan fitur reconciliation
      const patchRes = await app.request('/v1/households/current', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: { reconciliation: { enabled: true } } }),
      })
      expect(patchRes.status).toBe(200)
      expect((await patchRes.json()).features.reconciliation.enabled).toBe(true)

      // 2. Buat 1 transaksi pengeluaran di akun BCA suami pada 2026-10-05
      const txRes = await app.request('/v1/transactions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          account: 'BCA suami',
          category: 'Lainnya',
          amount: 68500,
          date: '2026-10-05',
          note: 'Belanja dapur di Indomaret',
        }),
      })
      expect(txRes.status).toBe(201)
      const txBody = await txRes.json()
      createdTxIds.push(txBody.transaction.id)

      // 3. Impor CSV mutasi BCA dengan 3 baris:
      // - Baris 1 cocok otomatis dengan transaksi di atas (tanggal sama, nominal 68500, kata "indomaret")
      // - Baris 2 belum tercatat (45000)
      // - Baris 3 biaya admin (15000)
      const csvText = [
        'Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo',
        '2026-10-05,"QRIS INDOMARET BELANJA DAPUR",0000,"68,500.00 DB","4,850,000.00"',
        '2026-10-08,"TRSF E-BANKING DB WARUNG SAYUR BU YANI",0000,"45,000.00 DB","4,805,000.00"',
        '2026-10-12,"BIAYA ADM BANK BULANAN",0000,"15,000.00 DB","4,790,000.00"',
      ].join('\n')

      const impRes = await app.request('/v1/reconciliation/imports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: 'BCA suami',
          filename: 'mutasi-bca-okt.csv',
          csv_text: csvText,
        }),
      })
      expect(impRes.status).toBe(201)
      const impBody = await impRes.json()
      createdImportIds.push(impBody.import.id)

      expect(impBody.summary.matched).toBe(1)
      expect(impBody.summary.unmatched_statement).toBe(2)
      expect(impBody.lines).toHaveLength(3)

      const matchedLine = impBody.lines.find((l: { amount: number }) => l.amount === 68500)
      expect(matchedLine.match_status).toBe('matched')
      expect(matchedLine.matched_transaction.id).toBe(txBody.transaction.id)

      // 4. Terima (accept) baris yang lupa dicatat (45000) menjadi transaksi baru (source='import')
      const unmatchedWarung = impBody.lines.find((l: { amount: number }) => l.amount === 45000)
      const acceptRes = await app.request(`/v1/reconciliation/lines/${unmatchedWarung.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Lainnya',
          note: '[REKON] Warung Sayur Bu Yani',
        }),
      })
      expect(acceptRes.status).toBe(201)
      const acceptBody = await acceptRes.json()
      expect(acceptBody.match_status).toBe('created')
      expect(acceptBody.transaction.source).toBe('import')
      createdTxIds.push(acceptBody.transaction.id)

      // 5. Abaikan (ignore) baris biaya admin (15000)
      const unmatchedAdmin = impBody.lines.find((l: { amount: number }) => l.amount === 15000)
      const ignoreRes = await app.request(`/v1/reconciliation/lines/${unmatchedAdmin.id}/ignore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(ignoreRes.status).toBe(200)
      expect((await ignoreRes.json()).match_status).toBe('ignored')

      // 6. Impor ulang CSV yang sama -> idempoten (status created/matched tidak hilang & tidak menduplikasi statement_lines)
      const reImpRes = await app.request('/v1/reconciliation/imports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: 'BCA suami',
          filename: 'mutasi-bca-okt.csv',
          csv_text: csvText,
        }),
      })
      expect(reImpRes.status).toBe(201)
      const reImpBody = await reImpRes.json()
      createdImportIds.push(reImpBody.import.id)
      expect(reImpBody.lines).toHaveLength(3)
      expect(reImpBody.summary.matched).toBe(1)
      expect(reImpBody.summary.created).toBe(1)
      expect(reImpBody.summary.ignored).toBe(1)
      expect(reImpBody.summary.unmatched_statement).toBe(0)
    })

    it('Auto-Stok Belanja (auto_stock) otomatis membuat item kulkas/freezer dari transaksi Makanan dan mengurangi saat transaksi dihapus', async () => {
      const app = buildApp()
      const token = await mintJwt(EKO_USER_ID)

      // Aktifkan shopping_stock + auto_stock
      const patchRes = await app.request('/v1/households/current', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            shopping_stock: {
              enabled: true,
              auto_stock: { enabled: true, create_new_items: true },
            },
          },
        }),
      })
      expect(patchRes.status).toBe(200)
      expect((await patchRes.json()).features.shopping_stock.auto_stock.enabled).toBe(true)

      // Catat transaksi Makanan: "Ayam Kampung Segar 2 ekor"
      const txRes = await app.request('/v1/transactions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          account: 'BCA suami',
          category: 'Makanan',
          amount: 95000,
          date: '2026-10-20',
          note: 'Ayam Kampung Segar 2 ekor',
        }),
      })
      expect(txRes.status).toBe(201)
      const txId = (await txRes.json()).transaction.id

      // Cek daftar pantry -> harus otomatis ada "Ayam Kampung Segar" di freezer dengan qty 2 ekor
      const pantryRes = await app.request('/v1/pantry', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(pantryRes.status).toBe(200)
      const items = await pantryRes.json()
      const ayam = items.find((i: { name: string }) => /ayam kampung segar/i.test(i.name))
      expect(ayam).toBeTruthy()
      createdPantryIds.push(ayam.id)
      expect(ayam.qty).toBe(2)
      expect(ayam.unit).toBe('ekor')
      expect(ayam.location).toBe('freezer')

      // Hapus transaksi -> stok otomatis dikurangi kembali menjadi 0
      const delRes = await app.request(`/v1/transactions/${txId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(delRes.status).toBe(200)

      const pantryAfterDel = await (
        await app.request('/v1/pantry', { headers: { Authorization: `Bearer ${token}` } })
      ).json()
      const ayamAfter = pantryAfterDel.find((i: { id: string }) => i.id === ayam.id)
      expect(ayamAfter.qty).toBe(0)
    })
  },
)
