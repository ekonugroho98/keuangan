import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateRecurringBodySchema, UpdateRecurringBodySchema, RunRecurringsBodySchema, UuidSchema } from '@karaya/shared/schemas'

import * as recurrings from '../services/recurrings'

export const recurringsApp = new OpenAPIHono()

recurringsApp.openapi(
  createRoute({ method: 'get', path: '/v1/recurrings', tags: ['recurrings'], summary: 'Daftar transaksi berulang', security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await recurrings.listRecurrings(c.get('actor')), 200),
)

recurringsApp.openapi(
  createRoute({ method: 'post', path: '/v1/recurrings', tags: ['recurrings'], summary: 'Buat transaksi berulang', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateRecurringBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } } }),
  async (c) => c.json(await recurrings.createRecurring(c.get('actor'), c.req.valid('json')), 201),
)

recurringsApp.openapi(
  createRoute({ method: 'patch', path: '/v1/recurrings/{id}', tags: ['recurrings'], summary: 'Ubah transaksi berulang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateRecurringBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => c.json(await recurrings.updateRecurring(c.get('actor'), c.req.valid('param').id, c.req.valid('json')), 200),
)

recurringsApp.openapi(
  createRoute({ method: 'delete', path: '/v1/recurrings/{id}', tags: ['recurrings'], summary: 'Hapus transaksi berulang', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => c.json(await recurrings.deleteRecurring(c.get('actor'), c.req.valid('param').id), 200),
)

recurringsApp.openapi(
  createRoute({ method: 'post', path: '/v1/recurrings/run', tags: ['recurrings'], summary: 'Jalankan transaksi berulang yang jatuh tempo', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: RunRecurringsBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ executed: z.number(), skipped: z.array(z.unknown()) }) } }, description: 'OK' } } }),
  async (c) => c.json(await recurrings.runRecurrings(c.get('actor'), c.req.valid('json').today), 200),
)
