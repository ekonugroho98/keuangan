import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateBudgetBodySchema, MonthStringSchema, CopyBudgetBodySchema, UuidSchema } from '@karaya/shared/schemas'

import * as budgets from '../services/budgets'

export const budgetsApp = new OpenAPIHono()

const ScopeQuerySchema = z.object({
  month: MonthStringSchema.optional(),
  scope: z.enum(['household', 'member']).default('household'),
  member_id: UuidSchema.optional(),
  member: z.string().optional(),
})

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

budgetsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/budgets', tags: ['budgets'], summary: 'Daftar anggaran',
    security: [{ bearerJwt: [] }], request: { query: ScopeQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } },
  }),
  async (c) => {
    const q = c.req.valid('query')
    const result = await budgets.listBudgets(c.get('actor'), q.month ?? currentMonth(), q.scope, q)
    return c.json(result, 200)
  },
)

budgetsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/budgets/status', tags: ['budgets'], summary: 'Sisa anggaran per kategori',
    security: [{ bearerJwt: [] }], request: { query: ScopeQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } },
  }),
  async (c) => {
    const q = c.req.valid('query')
    const result = await budgets.getBudgetStatus(c.get('actor'), q.month ?? currentMonth(), q.scope, q)
    return c.json(result, 200)
  },
)

budgetsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/budgets', tags: ['budgets'], summary: 'Buat anggaran',
    security: [{ bearerJwt: [] }], request: { body: { content: { 'application/json': { schema: CreateBudgetBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } },
  }),
  async (c) => {
    const result = await budgets.createBudget(c.get('actor'), c.req.valid('json'))
    return c.json(result, 201)
  },
)

budgetsApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/budgets/{id}', tags: ['budgets'], summary: 'Ubah nominal anggaran',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: z.object({ amount: z.number().int().positive() }) } } } },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const result = await budgets.updateBudget(c.get('actor'), id, c.req.valid('json').amount)
    return c.json(result, 200)
  },
)

budgetsApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/budgets/{id}', tags: ['budgets'], summary: 'Hapus anggaran',
    security: [{ bearerJwt: [] }], request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } },
  }),
  async (c) => {
    const result = await budgets.deleteBudget(c.get('actor'), c.req.valid('param').id)
    return c.json(result, 200)
  },
)

budgetsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/budgets/copy', tags: ['budgets'], summary: 'Salin anggaran ke bulan lain',
    security: [{ bearerJwt: [] }], request: { body: { content: { 'application/json': { schema: CopyBudgetBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ copied: z.number(), skipped: z.number() }) } }, description: 'OK' } },
  }),
  async (c) => {
    const body = c.req.valid('json')
    const result = await budgets.copyBudgets(c.get('actor'), body.from_month, body.to_month, body.overwrite)
    return c.json(result, 200)
  },
)
