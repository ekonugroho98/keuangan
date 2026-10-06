import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreatePiutangBodySchema, UpdatePiutangBodySchema, ReceivePiutangBodySchema, UuidSchema } from '@karaya/shared/schemas'

import { getHouseholdTimezone } from '../services/households'
import * as piutang from '../services/piutang'

export const piutangApp = new OpenAPIHono()

piutangApp.openapi(
  createRoute({ method: 'get', path: '/v1/piutang', tags: ['piutang'], summary: 'Daftar piutang', security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await piutang.listPiutang(c.get('actor')), 200),
)

piutangApp.openapi(
  createRoute({ method: 'post', path: '/v1/piutang', tags: ['piutang'], summary: 'Catat piutang baru', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreatePiutangBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } } }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    return c.json(await piutang.createPiutang(actor, c.req.valid('json'), tz), 201)
  },
)

piutangApp.openapi(
  createRoute({ method: 'patch', path: '/v1/piutang/{id}', tags: ['piutang'], summary: 'Ubah piutang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdatePiutangBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => c.json(await piutang.updatePiutang(c.get('actor'), c.req.valid('param').id, c.req.valid('json')), 200),
)

piutangApp.openapi(
  createRoute({ method: 'delete', path: '/v1/piutang/{id}', tags: ['piutang'], summary: 'Hapus piutang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => c.json(await piutang.deletePiutang(c.get('actor'), c.req.valid('param').id), 200),
)

piutangApp.openapi(
  createRoute({ method: 'post', path: '/v1/piutang/{id}/receipts', tags: ['piutang'], summary: 'Terima pembayaran piutang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: ReceivePiutangBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    return c.json(await piutang.receivePiutang(actor, c.req.valid('param').id, c.req.valid('json'), tz), 201)
  },
)

piutangApp.openapi(
  createRoute({ method: 'get', path: '/v1/piutang/{id}/receipts', tags: ['piutang'], summary: 'Riwayat penerimaan piutang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await piutang.listPiutangReceipts(c.get('actor'), c.req.valid('param').id), 200),
)
