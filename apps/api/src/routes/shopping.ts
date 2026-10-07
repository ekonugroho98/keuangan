import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ShoppingItemSchema, CreateShoppingItemBodySchema, UpdateShoppingItemBodySchema, ShoppingStatusSchema, UuidSchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as shopping from '../services/shopping'

// F-D (10-fitur-opsional-keluarga.md §6). requireFeature('shopping_stock') dipanggil DI DALAM
// tiap fungsi service, bukan middleware sub-app (pola yang sama dengan beneficiaries.ts).
export const shoppingApp = new OpenAPIHono()

shoppingApp.openapi(
  createRoute({
    method: 'get', path: '/v1/shopping', tags: ['shopping'], summary: 'Daftar belanja (F-D, opsional)',
    security: [{ bearerJwt: [] }],
    request: { query: z.object({ status: ShoppingStatusSchema.default('needed') }) },
    responses: { 200: { content: { 'application/json': { schema: z.array(ShoppingItemSchema) } }, description: 'OK' } },
  }),
  async (c) => c.json(await shopping.listShopping(c.get('actor'), c.req.valid('query').status), 200),
)

shoppingApp.openapi(
  createRoute({
    method: 'get', path: '/v1/shopping/suggestions', tags: ['shopping'], summary: 'Saran belanja dari stok menipis',
    security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: 'OK' } },
  }),
  async (c) => c.json(await shopping.listShoppingSuggestions(c.get('actor')), 200),
)

shoppingApp.openapi(
  createRoute({
    method: 'post', path: '/v1/shopping', tags: ['shopping'], summary: 'Tambah item belanja',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateShoppingItemBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: ShoppingItemSchema } }, description: 'Dibuat' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    return c.json(await shopping.createShoppingItem(c.get('actor'), c.req.valid('json')), 201)
  },
)

shoppingApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/shopping/{id}', tags: ['shopping'], summary: 'Ubah item belanja (mis. tandai dibeli)',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateShoppingItemBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: ShoppingItemSchema } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    const { id } = c.req.valid('param')
    return c.json(await shopping.updateShoppingItem(c.get('actor'), id, c.req.valid('json')), 200)
  },
)

shoppingApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/shopping/{id}', tags: ['shopping'], summary: 'Hapus item belanja',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    return c.json(await shopping.deleteShoppingItem(c.get('actor'), c.req.valid('param').id), 200)
  },
)
