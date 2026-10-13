import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ComparePricesQuerySchema, ComparePricesResponseSchema, ProductAliasBodySchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as prices from '../services/prices'

// Perbandingan harga antar toko (10-fitur-opsional-keluarga.md §6.8). Tidak digate feature flag:
// riwayat harga terisi dari struk mana pun (ingest_receipt maupun simpan scan web).
export const pricesApp = new OpenAPIHono()

pricesApp.openapi(
  createRoute({
    method: 'get', path: '/v1/prices/compare', tags: ['prices'], summary: 'Bandingkan harga produk antar toko (per satuan)',
    security: [{ bearerJwt: [] }],
    request: { query: ComparePricesQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: ComparePricesResponseSchema } }, description: 'OK' } },
  }),
  async (c) => c.json(await prices.comparePrices(c.get('actor'), c.req.valid('query')), 200),
)

pricesApp.openapi(
  createRoute({
    method: 'post', path: '/v1/prices/aliases', tags: ['prices'], summary: 'Samakan item struk dengan produk lain (koreksi manual)',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: ProductAliasBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ keyword: z.string(), canonical_name: z.string() }) } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    return c.json(await prices.setProductAlias(c.get('actor'), c.req.valid('json')), 200)
  },
)
