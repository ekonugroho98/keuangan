import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
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
  'entitlements, idempotency cleanup, source_name & receipt_url integration (DB lokal)',
  () => {
    const admin = postgres(TEST_ADMIN_DATABASE_URL, { prepare: false, max: 1 })
    const createdTxIds: string[] = []

    afterAll(async () => {
      if (createdTxIds.length > 0) {
        await admin`delete from transactions where id in ${admin(createdTxIds)}`
      }
      await admin.end()
    })

    it('GET /v1/households/current & GET /v1/bootstrap menyertakan status paket (plan & entitlements)', async () => {
      const app = buildApp()
      const token = await mintJwt(EKO_USER_ID)

      const hhRes = await app.request('/v1/households/current', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(hhRes.status).toBe(200)
      const hh = await hhRes.json()
      expect(hh.plan).toBeDefined()
      expect(['free', 'pro', 'lifetime']).toContain(hh.plan.tier)
      expect(hh.plan.entitlements).toEqual({
        api_access: true,
        receipt_storage: true,
        price_compare: true,
        multi_member: true,
        shopping_stock: true,
        beneficiary: true,
        excel_export: true,
      })

      const bootRes = await app.request('/v1/bootstrap', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(bootRes.status).toBe(200)
      const boot = await bootRes.json()
      expect(boot.household.plan).toBeDefined()
      expect(boot.household.plan.entitlements.receipt_storage).toBe(true)
    })

    it('cleanup_expired_idempotency_keys menghapus kunci > 7 hari dan mempertahankan kunci baru', async () => {
      const [member] = await admin<{ id: string }[]>`select id from household_members limit 1`
      const oldKey = `test-old-idem-${Date.now()}`
      const freshKey = `test-fresh-idem-${Date.now()}`

      await admin`
        insert into idempotency_keys (credential_type, credential_id, key, request_hash, status, response_status, response_body, created_at)
        values
          ('jwt', ${member.id}, ${oldKey}, decode('01', 'hex'), 'completed', 201, '{}'::jsonb, now() - interval '8 days'),
          ('jwt', ${member.id}, ${freshKey}, decode('02', 'hex'), 'completed', 201, '{}'::jsonb, now() - interval '1 hour')
      `

      const [res] = await admin<{ deleted: number }[]>`
        select public.cleanup_expired_idempotency_keys('7 days'::interval) as deleted
      `
      expect(res.deleted).toBeGreaterThanOrEqual(1)

      const remaining = await admin<{ key: string }[]>`
        select key from idempotency_keys where key in (${oldKey}, ${freshKey})
      `
      expect(remaining.map((r) => r.key)).toEqual([freshKey])

      await admin`delete from idempotency_keys where key = ${freshKey}`
    })

    it('POST & GET /v1/transactions menyimpan dan mengembalikan recorded_by + receipt_url', async () => {
      const app = buildApp()
      const token = await mintJwt(EKO_USER_ID)

      const createRes = await app.request('/v1/transactions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          account: 'BCA suami',
          category: 'Makanan',
          amount: 100,
          date: '2026-10-19',
          note: 'Test Struk & Source E2E',
          recorded_by: 'Rina',
          receipt_url: 'https://twcrflhvxzatpfrjmqzi.supabase.co/storage/v1/object/public/receipts/test-e2e.webp',
        }),
      })
      expect(createRes.status).toBe(201)
      const created = await createRes.json()
      createdTxIds.push(created.transaction.id)
      expect(created.transaction.recorded_by.display_name).toBe('Rina')
      expect(created.transaction.receipt_url).toBe(
        'https://twcrflhvxzatpfrjmqzi.supabase.co/storage/v1/object/public/receipts/test-e2e.webp',
      )

      const listRes = await app.request(`/v1/transactions?q=Test+Struk`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(listRes.status).toBe(200)
      const listed = await listRes.json()
      const found = listed.data.find((t: { id: string }) => t.id === created.transaction.id)
      expect(found).toBeDefined()
      expect(found.recorded_by.display_name).toBe('Rina')
      expect(found.receipt_url).toBe(
        'https://twcrflhvxzatpfrjmqzi.supabase.co/storage/v1/object/public/receipts/test-e2e.webp',
      )
    })

    it('saat ENFORCE_PAID_FEATURES=true, household free ditolak 403 plan_upgrade_required kecuali di-override add-on', async () => {
      const { env } = await import('../../src/env')
      const { invalidateEntitlementsCache } = await import('../../src/services/entitlements')
      const app = buildApp()
      const token = await mintJwt(EKO_USER_ID)

      const hhRes = await app.request('/v1/households/current', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const hh = await hhRes.json()
      const hhId = hh.id as string

      try {
        await admin`update households set plan_tier = 'free', entitlements = '{}'::jsonb where id = ${hhId}`
        invalidateEntitlementsCache(hhId)
        ;(env as { ENFORCE_PAID_FEATURES: boolean }).ENFORCE_PAID_FEATURES = true

        const blockedRes = await app.request('/v1/prices/compare?q=sabun', {
          headers: { Authorization: `Bearer ${token}` },
        })
        expect(blockedRes.status).toBe(403)
        const blockedBody = await blockedRes.json()
        expect(blockedBody.error.code).toBe('plan_upgrade_required')
        expect(blockedBody.error.details.feature).toBe('price_compare')

        // Aktifkan add-on price_compare di JSONB entitlements walau tier tetap free
        await admin`update households set entitlements = '{"price_compare": true}'::jsonb where id = ${hhId}`
        invalidateEntitlementsCache(hhId)

        const allowedRes = await app.request('/v1/prices/compare?q=sabun', {
          headers: { Authorization: `Bearer ${token}` },
        })
        expect(allowedRes.status).toBe(200)
      } finally {
        ;(env as { ENFORCE_PAID_FEATURES: boolean }).ENFORCE_PAID_FEATURES = false
        await admin`update households set plan_tier = 'lifetime', entitlements = '{}'::jsonb where id = ${hhId}`
        invalidateEntitlementsCache(hhId)
      }
    })
  },
)
