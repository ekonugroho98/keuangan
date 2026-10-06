import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateInvestmentBodySchema, UpdateInvestmentBodySchema, UuidSchema } from '@karaya/shared/schemas'

import * as investments from '../services/investments'

export const investmentsApp = new OpenAPIHono()

investmentsApp.openapi(
  createRoute({ method: 'get', path: '/v1/investments', tags: ['investments'], summary: 'Daftar investasi', security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await investments.listInvestments(c.get('actor')), 200),
)

investmentsApp.openapi(
  createRoute({ method: 'post', path: '/v1/investments', tags: ['investments'], summary: 'Tambah investasi', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateInvestmentBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } } }),
  async (c) => c.json(await investments.createInvestment(c.get('actor'), c.req.valid('json')), 201),
)

investmentsApp.openapi(
  createRoute({ method: 'patch', path: '/v1/investments/{id}', tags: ['investments'], summary: 'Ubah investasi', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateInvestmentBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => c.json(await investments.updateInvestment(c.get('actor'), c.req.valid('param').id, c.req.valid('json')), 200),
)

investmentsApp.openapi(
  createRoute({ method: 'delete', path: '/v1/investments/{id}', tags: ['investments'], summary: 'Hapus investasi', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => c.json(await investments.deleteInvestment(c.get('actor'), c.req.valid('param').id), 200),
)
