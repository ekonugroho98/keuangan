import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateApiKeyBodySchema, UuidSchema } from '@karaya/shared/schemas'
import { requireJwtOnly } from '../auth/middleware'
import * as apiKeys from '../services/api-keys'

// Seluruh resource ini "jwt" saja di matriks (05-api.md §4) — API key tidak boleh dipakai untuk
// membuat/mencabut/rotate API key lain (mencegah key write bocor dipakai mencetak key admin).
// requireJwtOnly() dipanggil per-handler, BUKAN sebagai .use('*', ...) kedua di sub-app ini —
// lihat komentar requireJwtOnly di auth/middleware.ts soal kenapa.
export const apiKeysApp = new OpenAPIHono()

apiKeysApp.openapi(
  createRoute({ method: 'get', path: '/v1/api-keys', tags: ['api-keys'], summary: 'Daftar API key (milik sendiri; owner lihat semua)', security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => {
    requireJwtOnly(c.get('actor'))
    return c.json(await apiKeys.listApiKeys(c.get('actor')), 200)
  },
)

apiKeysApp.openapi(
  createRoute({ method: 'post', path: '/v1/api-keys', tags: ['api-keys'], summary: 'Buat API key', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateApiKeyBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.any() } }, description: 'Dibuat — secret HANYA muncul di respons ini' } } }),
  async (c) => {
    requireJwtOnly(c.get('actor'))
    // Diri sendiri vs member lain, dan scope <= role target, ditegakkan di create_api_key() (SQL)
    // lewat forbidden_owner/scope_exceeds_role — semua pemanggil di sini sudah pasti credential
    // jwt (scope selalu 'admin'), jadi pengecekan scope di layer HTTP tidak berarti apa-apa;
    // otorisasi nyata adalah actor.role, yang sudah dicek fungsi SQL.
    const result = await apiKeys.createApiKey(c.get('actor'), c.req.valid('json'))
    return c.json(result, 201)
  },
)

apiKeysApp.openapi(
  createRoute({ method: 'delete', path: '/v1/api-keys/{id}', tags: ['api-keys'], summary: 'Cabut API key', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => {
    requireJwtOnly(c.get('actor'))
    // Milik sendiri vs milik orang lain ditegakkan di revoke_api_key() (SQL) lewat forbidden_owner.
    const result = await apiKeys.revokeApiKey(c.get('actor'), c.req.valid('param').id)
    return c.json(result, 200)
  },
)

apiKeysApp.openapi(
  createRoute({ method: 'post', path: '/v1/api-keys/{id}/rotate', tags: ['api-keys'], summary: 'Rotate API key', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } } }),
  async (c) => {
    requireJwtOnly(c.get('actor'))
    const result = await apiKeys.rotateApiKey(c.get('actor'), c.req.valid('param').id)
    return c.json(result, 200)
  },
)
