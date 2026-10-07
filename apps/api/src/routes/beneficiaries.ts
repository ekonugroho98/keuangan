import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { BeneficiarySchema, CreateBeneficiaryBodySchema, UpdateBeneficiaryBodySchema, UuidSchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as beneficiaries from '../services/beneficiaries'

// F-A (10-fitur-opsional-keluarga.md §3.4). requireFeature('beneficiary') dipanggil DI DALAM
// tiap fungsi service (features.ts), bukan middleware sub-app — pola yang sama dengan
// assertScope/requireJwtOnly, lihat catatan bug wildcard kumulatif di apps/api/src/app.ts.
export const beneficiariesApp = new OpenAPIHono()

beneficiariesApp.openapi(
  createRoute({
    method: 'get', path: '/v1/beneficiaries', tags: ['beneficiaries'], summary: 'Daftar "untuk siapa" (F-A, opsional)',
    security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(BeneficiarySchema) } }, description: 'OK' } },
  }),
  async (c) => c.json(await beneficiaries.listBeneficiaries(c.get('actor')), 200),
)

beneficiariesApp.openapi(
  createRoute({
    method: 'post', path: '/v1/beneficiaries', tags: ['beneficiaries'], summary: 'Buat "untuk siapa" baru',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateBeneficiaryBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: BeneficiarySchema } }, description: 'Dibuat' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    const result = await beneficiaries.createBeneficiary(c.get('actor'), c.req.valid('json'))
    return c.json(result, 201)
  },
)

beneficiariesApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/beneficiaries/{id}', tags: ['beneficiaries'], summary: 'Ubah "untuk siapa"',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateBeneficiaryBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: BeneficiarySchema } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    const { id } = c.req.valid('param')
    const result = await beneficiaries.updateBeneficiary(c.get('actor'), id, c.req.valid('json'))
    return c.json(result, 200)
  },
)

beneficiariesApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/beneficiaries/{id}', tags: ['beneficiaries'], summary: 'Hapus "untuk siapa" (soft delete)',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    const { id } = c.req.valid('param')
    return c.json(await beneficiaries.deleteBeneficiary(c.get('actor'), id), 200)
  },
)
