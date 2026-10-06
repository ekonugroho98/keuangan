import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  CreateTransactionBodySchema, CreateTransactionBatchBodySchema,
  UpdateTransactionBodySchema, TransactionListQuerySchema, UuidSchema, ErrorResponseSchema,
} from '@karaya/shared/schemas'

import { getHouseholdTimezone } from '../services/households'
import * as transactions from '../services/transactions'

export const transactionsApp = new OpenAPIHono()

const TransactionListResponseSchema = z.object({
  data: z.array(z.any()),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  totals: z.object({ income: z.number(), expense: z.number(), transfer: z.number(), count: z.number() }),
})

transactionsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/transactions', tags: ['transactions'], summary: 'Cari transaksi',
    security: [{ bearerJwt: [] }],
    request: { query: TransactionListQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: TransactionListResponseSchema } }, description: 'OK' } },
  }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    const result = await transactions.listTransactions(actor, c.req.valid('query'), tz)
    return c.json(result, 200)
  },
)

transactionsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/transactions', tags: ['transactions'], summary: 'Catat pemasukan/pengeluaran',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateTransactionBodySchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: z.any() } }, description: 'Dibuat' },
      404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Akun/kategori tidak ditemukan' },
      409: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Nama akun/kategori ambigu' },
      422: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Saldo tidak cukup' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    const result = await transactions.createTransaction(actor, c.req.valid('json'), tz)
    return c.json(result, 201)
  },
)

transactionsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/transactions/batch', tags: ['transactions'], summary: 'Catat beberapa pengeluaran sekaligus',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateTransactionBatchBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.object({ transactions: z.array(z.any()), account: z.object({ id: UuidSchema, balance: z.number() }) }) } }, description: 'Dibuat' } },
  }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    const result = await transactions.createTransactionBatch(actor, c.req.valid('json'), tz)
    return c.json(result, 201)
  },
)

transactionsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/transactions/{id}', tags: ['transactions'], summary: 'Detail transaksi',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const result = await transactions.getTransaction(c.get('actor'), c.req.valid('param').id)
    return c.json(result, 200)
  },
)

transactionsApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/transactions/{id}', tags: ['transactions'], summary: 'Ubah transaksi',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateTransactionBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const result = await transactions.updateTransaction(c.get('actor'), id, c.req.valid('json'))
    return c.json(result, 200)
  },
)

transactionsApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/transactions/{id}', tags: ['transactions'], summary: 'Hapus transaksi (soft)',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const result = await transactions.deleteTransaction(c.get('actor'), c.req.valid('param').id)
    return c.json(result, 200)
  },
)

transactionsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/transactions/{id}/restore', tags: ['transactions'], summary: 'Pulihkan transaksi terhapus',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const result = await transactions.restoreTransaction(c.get('actor'), c.req.valid('param').id)
    return c.json(result, 200)
  },
)
