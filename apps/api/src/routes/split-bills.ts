import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateSplitBillBodySchema, ToggleSplitBillMemberBodySchema, UuidSchema } from '@karaya/shared/schemas'

import * as splitBills from '../services/split-bills'

export const splitBillsApp = new OpenAPIHono()

splitBillsApp.openapi(
  createRoute({ method: 'get', path: '/v1/split-bills', tags: ['split-bills'], summary: 'Daftar tagihan bersama', security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await splitBills.listSplitBills(c.get('actor')), 200),
)

splitBillsApp.openapi(
  createRoute({ method: 'post', path: '/v1/split-bills', tags: ['split-bills'], summary: 'Buat tagihan bersama', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateSplitBillBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } } }),
  async (c) => c.json(await splitBills.createSplitBill(c.get('actor'), c.req.valid('json')), 201),
)

splitBillsApp.openapi(
  createRoute({ method: 'delete', path: '/v1/split-bills/{id}', tags: ['split-bills'], summary: 'Hapus tagihan', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => c.json(await splitBills.deleteSplitBill(c.get('actor'), c.req.valid('param').id), 200),
)

splitBillsApp.openapi(
  createRoute({ method: 'patch', path: '/v1/split-bills/{id}/members/{member_id}', tags: ['split-bills'], summary: 'Tandai lunas/belum', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema, member_id: UuidSchema }), body: { content: { 'application/json': { schema: ToggleSplitBillMemberBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => {
    const { id, member_id } = c.req.valid('param')
    const result = await splitBills.toggleSplitBillMember(c.get('actor'), id, member_id, c.req.valid('json').paid)
    return c.json(result, 200)
  },
)
