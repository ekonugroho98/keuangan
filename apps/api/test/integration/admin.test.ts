import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

const EKO_USER_ID = '00000000-0000-0000-0000-0000000000e0'
const RINA_USER_ID = '00000000-0000-0000-0000-0000000000e1'
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

async function mintJwt(sub: string, email?: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
  return new SignJWT({ sub, ...(email ? { email } : {}), aud: 'authenticated', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

const dbReachable = await checkDb()

describe.skipIf(!dbReachable || process.env.CI === 'true')(
  'Superadmin Dashboard API (/v1/admin/*) & RBAC integration (DB lokal)',
  () => {
    const admin = postgres(TEST_ADMIN_DATABASE_URL, { prepare: false, max: 1 })

    afterAll(async () => {
      await admin.end()
    })

    it('GET /v1/me, /v1/households/current, dan /v1/bootstrap mengembalikan is_superadmin yang akurat', async () => {
      const app = buildApp()
      const superToken = await mintJwt(EKO_USER_ID, 'eko@example.test')
      const regularToken = await mintJwt(RINA_USER_ID, 'rina@example.test')

      const meSuperRes = await app.request('/v1/me', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      expect(meSuperRes.status).toBe(200)
      const meSuper = await meSuperRes.json()
      expect(meSuper.is_superadmin).toBe(true)

      const hhSuperRes = await app.request('/v1/households/current', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      expect(hhSuperRes.status).toBe(200)
      const hhSuper = await hhSuperRes.json()
      expect(hhSuper.is_superadmin).toBe(true)

      const bootSuperRes = await app.request('/v1/bootstrap', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      expect(bootSuperRes.status).toBe(200)
      const bootSuper = await bootSuperRes.json()
      expect(bootSuper.is_superadmin).toBe(true)

      const meRegularRes = await app.request('/v1/me', {
        headers: { Authorization: `Bearer ${regularToken}` },
      })
      expect(meRegularRes.status).toBe(200)
      const meRegular = await meRegularRes.json()
      expect(meRegular.is_superadmin).toBe(false)
    })

    it('menolak user non-superadmin dengan 403 forbidden di seluruh endpoint /v1/admin/*, kecuali diizinkan lewat SUPERADMIN_EMAILS', async () => {
      const { env } = await import('../../src/env')
      const app = buildApp()
      const regularToken = await mintJwt(RINA_USER_ID, 'rina@example.test')

      const overviewForbidden = await app.request('/v1/admin/overview', {
        headers: { Authorization: `Bearer ${regularToken}` },
      })
      expect(overviewForbidden.status).toBe(403)
      const errBody = await overviewForbidden.json()
      expect(errBody.error.code).toBe('forbidden')

      const hhListForbidden = await app.request('/v1/admin/households', {
        headers: { Authorization: `Bearer ${regularToken}` },
      })
      expect(hhListForbidden.status).toBe(403)

      const cleanupForbidden = await app.request('/v1/admin/maintenance/cleanup-idempotency', {
        method: 'POST',
        headers: { Authorization: `Bearer ${regularToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ older_than_days: 7 }),
      })
      expect(cleanupForbidden.status).toBe(403)

      // Verifikasi dukungan SUPERADMIN_EMAILS
      try {
        env.SUPERADMIN_EMAILS.push('rina@example.test')
        const allowedRes = await app.request('/v1/admin/overview', {
          headers: { Authorization: `Bearer ${regularToken}` },
        })
        expect(allowedRes.status).toBe(200)
      } finally {
        const idx = env.SUPERADMIN_EMAILS.indexOf('rina@example.test')
        if (idx >= 0) env.SUPERADMIN_EMAILS.splice(idx, 1)
      }
    })

    it('GET /v1/admin/overview mengembalikan metrik lengkap (households, members, plans, transactions, storage_and_db, runtime)', async () => {
      const app = buildApp()
      const superToken = await mintJwt(EKO_USER_ID)

      const res = await app.request('/v1/admin/overview', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.households.total).toBeGreaterThanOrEqual(1)
      expect(data.members.total_active).toBeGreaterThanOrEqual(1)
      expect(data.plans).toHaveProperty('lifetime_total')
      expect(data.plans).toHaveProperty('pro_active')
      expect(data.plans).toHaveProperty('free_total')
      expect(data.transactions).toHaveProperty('total')
      expect(data.transactions.by_source).toHaveProperty('web')
      expect(data.transactions.by_source).toHaveProperty('api_key')
      expect(data.storage_and_db).toHaveProperty('receipt_count')
      expect(data.storage_and_db.quota_limit_kb).toBe(1048576)
      expect(data.storage_and_db.table_rows).toHaveProperty('transactions')
      expect(data.storage_and_db.table_rows).toHaveProperty('idempotency_keys')
      expect(data.runtime).toHaveProperty('enforce_paid_features')
      expect(data.runtime).toHaveProperty('storage_provider')
    })

    it('GET /v1/admin/households mendukung pencarian (nama/email) dan filter plan_tier', async () => {
      const app = buildApp()
      const superToken = await mintJwt(EKO_USER_ID)

      const allRes = await app.request('/v1/admin/households', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      expect(allRes.status).toBe(200)
      const allData = await allRes.json()
      expect(allData.total).toBeGreaterThanOrEqual(1)
      expect(allData.items.length).toBeGreaterThanOrEqual(1)

      const first = allData.items[0]
      expect(first).toHaveProperty('id')
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('plan')
      expect(Array.isArray(first.members)).toBe(true)
      expect(first.members.some((m: { email: string }) => m.email === 'rina@example.test')).toBe(true)

      // Cari berdasarkan email anggota
      const searchEmailRes = await app.request('/v1/admin/households?q=rina%40example.test', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      expect(searchEmailRes.status).toBe(200)
      const searchEmailData = await searchEmailRes.json()
      expect(searchEmailData.total).toBeGreaterThanOrEqual(1)

      // Cari string yang tidak ada
      const emptyRes = await app.request('/v1/admin/households?q=tidak-ada-household-xyz-999', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      expect(emptyRes.status).toBe(200)
      const emptyData = await emptyRes.json()
      expect(emptyData.total).toBe(0)
      expect(emptyData.items).toEqual([])
    })

    it('PATCH /v1/admin/households/{id}/plan mengubah tier & override add-on serta langsung meng-invalidate cache entitlements', async () => {
      const { env } = await import('../../src/env')
      const app = buildApp()
      const superToken = await mintJwt(EKO_USER_ID)

      // Buat household uji terisolasi supaya household bersama (Keluarga Eko) tetap 'lifetime' saat test paralel berjalan
      const createHhRes = await app.request('/v1/households', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Keluarga Uji Admin Plan',
          timezone: 'Asia/Jakarta',
          display_name: 'Eko Admin Test',
        }),
      })
      expect(createHhRes.status).toBe(201)
      const createdHh = await createHhRes.json()
      const hhId = createdHh.household.id as string

      // Kembalikan active_household_id user_settings ke household pertama agar test lain tidak pindah household
      const meRes = await app.request('/v1/me', {
        headers: { Authorization: `Bearer ${superToken}` },
      })
      const meData = await meRes.json()
      const primaryHhId = meData.memberships[0].household_id as string
      await admin`update user_settings set active_household_id = ${primaryHhId} where user_id = ${EKO_USER_ID}`

      try {
        ;(env as { ENFORCE_PAID_FEATURES: boolean }).ENFORCE_PAID_FEATURES = true

        // 1. Turunkan temp household ke tier 'free' tapi beri add-on satuan price_compare: true
        const patchFreeRes = await app.request(`/v1/admin/households/${hhId}/plan`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_tier: 'free',
            plan_expires_at: null,
            entitlements_override: {
              price_compare: true,
              api_access: false,
            },
          }),
        })
        expect(patchFreeRes.status).toBe(200)
        const patchedFree = await patchFreeRes.json()
        expect(patchedFree.plan_tier).toBe('free')
        expect(patchedFree.entitlements_override).toEqual({
          price_compare: true,
          api_access: false,
        })
        expect(patchedFree.plan.effective_tier).toBe('free')
        expect(patchedFree.plan.entitlements.price_compare).toBe(true)
        expect(patchedFree.plan.entitlements.beneficiary).toBe(false)

        // Karena add-on price_compare aktif pada hhId, endpoint compare harga dengan X-Household-Id lolos 200
        const compareAllowed = await app.request('/v1/prices/compare?q=sabun', {
          headers: {
            Authorization: `Bearer ${superToken}`,
            'X-Household-Id': hhId,
          },
        })
        expect(compareAllowed.status).toBe(200)

        // 2. Cabut override price_compare (set ke null -> jsonb_strip_nulls menghapus key)
        const stripOverrideRes = await app.request(`/v1/admin/households/${hhId}/plan`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entitlements_override: {
              price_compare: null,
              api_access: null,
            },
          }),
        })
        expect(stripOverrideRes.status).toBe(200)
        const stripped = await stripOverrideRes.json()
        expect(stripped.entitlements_override).toEqual({})
        expect(stripped.plan.entitlements.price_compare).toBe(false)

        // Cache entitlements wajib langsung ter-invalidate -> /v1/prices/compare langsung 403!
        const compareBlocked = await app.request('/v1/prices/compare?q=sabun', {
          headers: {
            Authorization: `Bearer ${superToken}`,
            'X-Household-Id': hhId,
          },
        })
        expect(compareBlocked.status).toBe(403)
        const blockedBody = await compareBlocked.json()
        expect(blockedBody.error.code).toBe('plan_upgrade_required')
      } finally {
        ;(env as { ENFORCE_PAID_FEATURES: boolean }).ENFORCE_PAID_FEATURES = false
        await admin`delete from households where id = ${hhId}`
      }
    })

    it('POST /v1/admin/maintenance/cleanup-idempotency membersihkan kunci idempotency kedaluwarsa', async () => {
      const app = buildApp()
      const superToken = await mintJwt(EKO_USER_ID)
      const [member] = await admin<{ id: string }[]>`select id from household_members limit 1`
      const expiredKey = `admin-cleanup-test-${Date.now()}`

      await admin`
        insert into idempotency_keys (credential_type, credential_id, key, request_hash, status, response_status, response_body, created_at)
        values ('jwt', ${member.id}, ${expiredKey}, decode('01', 'hex'), 'completed', 201, '{}'::jsonb, now() - interval '10 days')
      `

      const res = await app.request('/v1/admin/maintenance/cleanup-idempotency', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ older_than_days: 7 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deleted_count).toBeGreaterThanOrEqual(1)
      expect(body.older_than_days).toBe(7)
    })
  },
)
