import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateDebtBodySchema, UpdateDebtBodySchema, PayDebtBodySchema, UuidSchema } from '@karaya/shared/schemas'

import { getHouseholdTimezone } from '../services/households'
import * as debts from '../services/debts'

export const debtsApp = new OpenAPIHono()

debtsApp.openapi(
  createRoute({ method: 'get', path: '/v1/debts', tags: ['debts'], summary: 'Daftar hutang', security: [{ bearerJwt: [] }],
    request: { query: z.object({ status: z.enum(['active', 'settled', 'all']).default('active') }) },
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await debts.listDebts(c.get('actor'), c.req.valid('query').status), 200),
)

debtsApp.openapi(
  createRoute({ method: 'post', path: '/v1/debts', tags: ['debts'], summary: 'Catat hutang baru', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateDebtBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } } }),
  async (c) => c.json(await debts.createDebt(c.get('actor'), c.req.valid('json')), 201),
)

debtsApp.openapi(
  createRoute({ method: 'patch', path: '/v1/debts/{id}', tags: ['debts'], summary: 'Ubah hutang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateDebtBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => c.json(await debts.updateDebt(c.get('actor'), c.req.valid('param').id, c.req.valid('json')), 200),
)

debtsApp.openapi(
  createRoute({ method: 'delete', path: '/v1/debts/{id}', tags: ['debts'], summary: 'Hapus hutang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => c.json(await debts.deleteDebt(c.get('actor'), c.req.valid('param').id), 200),
)

debtsApp.openapi(
  createRoute({ method: 'post', path: '/v1/debts/{id}/payments', tags: ['debts'], summary: 'Bayar cicilan', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: PayDebtBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    return c.json(await debts.payDebt(actor, c.req.valid('param').id, c.req.valid('json'), tz), 201)
  },
)

debtsApp.openapi(
  createRoute({ method: 'get', path: '/v1/debts/{id}/payments', tags: ['debts'], summary: 'Riwayat cicilan', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await debts.listDebtPayments(c.get('actor'), c.req.valid('param').id), 200),
)
