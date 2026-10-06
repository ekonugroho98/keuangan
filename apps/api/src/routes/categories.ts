import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CategorySchema, CreateCategoryBodySchema, UpdateCategoryBodySchema, UuidSchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as categories from '../services/categories'

export const categoriesApp = new OpenAPIHono()

categoriesApp.openapi(
  createRoute({
    method: 'get', path: '/v1/categories', tags: ['categories'], summary: 'Daftar kategori household',
    security: [{ bearerJwt: [] }],
    request: { query: z.object({ type: z.enum(['income', 'expense', 'all']).default('all') }) },
    responses: { 200: { content: { 'application/json': { schema: z.array(CategorySchema) } }, description: 'OK' } },
  }),
  async (c) => {
    const { type } = c.req.valid('query')
    const result = await categories.listCategories(c.get('actor'), type)
    return c.json(result, 200)
  },
)

categoriesApp.openapi(
  createRoute({
    method: 'post', path: '/v1/categories', tags: ['categories'], summary: 'Buat kategori (owner)',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateCategoryBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: CategorySchema } }, description: 'Dibuat' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    const result = await categories.createCategory(c.get('actor'), c.req.valid('json'))
    return c.json(result, 201)
  },
)

categoriesApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/categories/{id}', tags: ['categories'], summary: 'Ubah kategori (owner)',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateCategoryBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: CategorySchema } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    const { id } = c.req.valid('param')
    const result = await categories.updateCategory(c.get('actor'), id, c.req.valid('json'))
    return c.json(result, 200)
  },
)

categoriesApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/categories/{id}', tags: ['categories'], summary: 'Hapus kategori (owner)',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), query: z.object({ merge_into_category_id: UuidSchema.optional() }) },
    responses: { 200: { content: { 'application/json': { schema: CategorySchema } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    const { id } = c.req.valid('param')
    const { merge_into_category_id } = c.req.valid('query')
    const result = await categories.deleteCategory(c.get('actor'), id, merge_into_category_id)
    return c.json(result, 200)
  },
)
