import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { PantryItemSchema, CreatePantryItemBodySchema, UpdatePantryItemBodySchema, PantryMovementBodySchema, UuidSchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as pantry from '../services/pantry'

export const pantryApp = new OpenAPIHono()

pantryApp.openapi(
  createRoute({
    method: 'get', path: '/v1/pantry', tags: ['pantry'], summary: 'Daftar stok rumah (F-D, opsional)',
    security: [{ bearerJwt: [] }],
    request: { query: z.object({ location: z.string().optional() }) },
    responses: { 200: { content: { 'application/json': { schema: z.array(PantryItemSchema) } }, description: 'OK' } },
  }),
  async (c) => c.json(await pantry.listPantry(c.get('actor'), c.req.valid('query').location), 200),
)

// Didaftarkan SEBELUM /v1/pantry/{id} supaya "expiring" tidak pernah ditafsirkan sebagai :id oleh router.
pantryApp.openapi(
  createRoute({
    method: 'get', path: '/v1/pantry/expiring', tags: ['pantry'], summary: 'Barang hampir/sudah kedaluwarsa (§6.6)',
    security: [{ bearerJwt: [] }],
    request: {
      query: z.object({
        within_days: z.coerce.number().int().min(0).max(30).default(2),
        include_expired: z.coerce.boolean().default(true),
        exclude_acked: z.coerce.boolean().default(false).openapi({ description: 'Dipakai cron Hermes supaya tidak kirim dobel di hari yang sama — jangan dipakai untuk pertanyaan manual.' }),
      }),
    },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const q = c.req.valid('query')
    return c.json(await pantry.getExpiring(c.get('actor'), q.within_days, q.include_expired, q.exclude_acked), 200)
  },
)

pantryApp.openapi(
  createRoute({
    method: 'post', path: '/v1/pantry/expiring/ack', tags: ['pantry'], summary: 'Tandai sudah diingatkan hari ini',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: z.object({ ids: z.array(UuidSchema).min(1) }) } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    return c.json(await pantry.ackExpiring(c.get('actor'), c.req.valid('json').ids), 200)
  },
)

pantryApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/pantry/sync-purchases',
    tags: ['pantry'],
    summary: 'Sinkronkan transaksi belanja Bahan Makanan ke stok rumah (§6.9)',
    security: [{ bearerJwt: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              period: z.enum(['this_month', 'last_30_days']).default('this_month'),
            }).default({}),
          },
        },
        required: false,
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    let period: 'this_month' | 'last_30_days' = 'this_month'
    try {
      const body = await c.req.json().catch(() => ({}))
      if (body?.period === 'last_30_days') period = 'last_30_days'
    } catch {
      // default this_month
    }
    return c.json(await pantry.syncPurchasesForPeriod(c.get('actor'), period), 200)
  },
)

pantryApp.openapi(
  createRoute({
    method: 'post', path: '/v1/pantry', tags: ['pantry'], summary: 'Tambah item stok',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreatePantryItemBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: PantryItemSchema } }, description: 'Dibuat' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    return c.json(await pantry.createPantryItem(c.get('actor'), c.req.valid('json')), 201)
  },
)

pantryApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/pantry/{id}', tags: ['pantry'], summary: 'Ubah item stok',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdatePantryItemBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: PantryItemSchema } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    const { id } = c.req.valid('param')
    return c.json(await pantry.updatePantryItem(c.get('actor'), id, c.req.valid('json')), 200)
  },
)

pantryApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/pantry/{id}', tags: ['pantry'], summary: 'Hapus item stok',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    return c.json(await pantry.deletePantryItem(c.get('actor'), c.req.valid('param').id), 200)
  },
)

pantryApp.openapi(
  createRoute({
    method: 'post', path: '/v1/pantry/{id}/movements', tags: ['pantry'], summary: 'Catat perubahan qty manual (pakai/buang/koreksi)',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: PantryMovementBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: PantryItemSchema } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    const { id } = c.req.valid('param')
    return c.json(await pantry.addPantryMovement(c.get('actor'), id, c.req.valid('json')), 200)
  },
)
