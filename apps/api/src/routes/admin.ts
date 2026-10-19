import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  AdminCleanupIdempotencyBodySchema,
  AdminCreateVouchersBodySchema,
  AdminHouseholdTokensBodySchema,
  AdminListHouseholdsQuerySchema,
  AdminProvisionWalletBodySchema,
  AdminUpdateHouseholdPlanBodySchema,
  UuidSchema,
} from '@karaya/shared/schemas'
import * as admin from '../services/admin'

const OkAny = {
  200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
}

export const adminApp = new OpenAPIHono()

adminApp.openapi(
  createRoute({
    method: 'get',
    path: '/v1/admin/overview',
    tags: ['admin'],
    summary: 'Ringkasan metrik Superadmin (pertumbuhan user, paket, transaksi, kuota struk, DB & Token Gatekeeper)',
    security: [{ bearerJwt: [] }],
    responses: OkAny,
  }),
  async (c) => c.json(await admin.getAdminOverview(c.get('actor'))),
)

adminApp.openapi(
  createRoute({
    method: 'get',
    path: '/v1/admin/households',
    tags: ['admin'],
    summary: 'Daftar seluruh household beserta anggota, paket, dompet token AI, dan statistik pemakaian (Superadmin)',
    security: [{ bearerJwt: [] }],
    request: { query: AdminListHouseholdsQuerySchema },
    responses: OkAny,
  }),
  async (c) => c.json(await admin.listAdminHouseholds(c.get('actor'), c.req.valid('query'))),
)

adminApp.openapi(
  createRoute({
    method: 'patch',
    path: '/v1/admin/households/{id}/plan',
    tags: ['admin'],
    summary: 'Ubah plan_tier, plan_expires_at, dan override entitlements household (Superadmin)',
    security: [{ bearerJwt: [] }],
    request: {
      params: z.object({ id: UuidSchema }),
      body: { content: { 'application/json': { schema: AdminUpdateHouseholdPlanBodySchema } } },
    },
    responses: OkAny,
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    return c.json(await admin.updateAdminHouseholdPlan(c.get('actor'), id, c.req.valid('json')))
  },
)

adminApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/admin/households/{id}/tokens',
    tags: ['admin'],
    summary: 'Top-up / atur kuota Token Gatekeeper household & auto-inject API key sk-kb-* ke semua anggota (Superadmin)',
    security: [{ bearerJwt: [] }],
    request: {
      params: z.object({ id: UuidSchema }),
      body: { content: { 'application/json': { schema: AdminHouseholdTokensBodySchema } } },
    },
    responses: OkAny,
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    return c.json(await admin.provisionHouseholdTokens(c.get('actor'), id, c.req.valid('json')))
  },
)

adminApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/admin/tokens/wallets/provision',
    tags: ['admin'],
    summary: 'Buat / top-up dompet Token Gatekeeper universal lintas produk (tg:, email:, ws:, hh:) (Superadmin)',
    security: [{ bearerJwt: [] }],
    request: {
      body: { content: { 'application/json': { schema: AdminProvisionWalletBodySchema } } },
    },
    responses: OkAny,
  }),
  async (c) => c.json(await admin.provisionStandaloneWallet(c.get('actor'), c.req.valid('json'))),
)

adminApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/admin/tokens/vouchers',
    tags: ['admin'],
    summary: 'Generate kode voucher Token Gatekeeper (Superadmin)',
    security: [{ bearerJwt: [] }],
    request: {
      body: { content: { 'application/json': { schema: AdminCreateVouchersBodySchema } } },
    },
    responses: OkAny,
  }),
  async (c) => c.json(await admin.createGatekeeperVouchers(c.get('actor'), c.req.valid('json'))),
)

adminApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/admin/maintenance/cleanup-idempotency',
    tags: ['admin'],
    summary: 'Bersihkan kunci idempotency yang sudah kedaluwarsa (Superadmin)',
    security: [{ bearerJwt: [] }],
    request: {
      body: {
        required: false,
        content: { 'application/json': { schema: AdminCleanupIdempotencyBodySchema } },
      },
    },
    responses: OkAny,
  }),
  async (c) => {
    let olderThanDays = 7
    try {
      const body = await c.req.json()
      if (body && typeof body.older_than_days === 'number') {
        olderThanDays = body.older_than_days
      }
    } catch {
      // body opsional
    }
    return c.json(await admin.cleanupExpiredIdempotency(c.get('actor'), olderThanDays))
  },
)
