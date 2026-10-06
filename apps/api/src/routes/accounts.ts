import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  CreateAccountBodySchema, UpdateAccountBodySchema,
  AdjustBalanceBodySchema, ErrorResponseSchema, UuidSchema,
} from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as accounts from '../services/accounts'

export const accountsApp = new OpenAPIHono()

accountsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/accounts', tags: ['accounts'], summary: 'Daftar akun household',
    security: [{ bearerJwt: [] }],
    request: { query: z.object({ include_deleted: z.coerce.boolean().default(false) }) },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const { include_deleted } = c.req.valid('query')
    const result = await accounts.listAccounts(c.get('actor'), { includeDeleted: include_deleted })
    return c.json(result, 200)
  },
)

accountsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/accounts', tags: ['accounts'], summary: 'Buat akun baru',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateAccountBodySchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: z.any() } }, description: 'Dibuat' },
      409: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Nama duplikat' },
    },
  }),
  async (c) => {
    const body = c.req.valid('json')
    const result = await accounts.createAccount(c.get('actor'), body)
    return c.json(result, 201)
  },
)

accountsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/accounts/{id}', tags: ['accounts'], summary: 'Detail akun',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
      404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Tidak ditemukan' },
    },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const result = await accounts.getAccount(c.get('actor'), id)
    return c.json(result, 200)
  },
)

accountsApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/accounts/{id}', tags: ['accounts'], summary: 'Ubah akun',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateAccountBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const result = await accounts.updateAccount(c.get('actor'), id, body)
    return c.json(result, 200)
  },
)

accountsApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/accounts/{id}', tags: ['accounts'], summary: 'Hapus akun (soft)',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), query: z.object({ force_archive: z.coerce.boolean().default(false) }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.literal(true), deleted_id: UuidSchema }) } }, description: 'OK' },
      422: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Masih punya saldo/transaksi' },
    },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    const { id } = c.req.valid('param')
    const { force_archive } = c.req.valid('query')
    await accounts.deleteAccount(c.get('actor'), id, force_archive)
    return c.json({ success: true as const, deleted_id: id }, 200)
  },
)

accountsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/accounts/{id}/adjust-balance', tags: ['accounts'], summary: 'Koreksi saldo',
    security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: AdjustBalanceBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const result = await accounts.adjustBalance(c.get('actor'), id, body.new_balance, body.date, body.note)
    return c.json(result, 200)
  },
)
