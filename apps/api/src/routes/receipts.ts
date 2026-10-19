import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { IngestReceiptBodySchema, UploadReceiptImageBodySchema, UploadReceiptImageResponseSchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import { requireEntitlement } from '../services/entitlements'
import { ingestReceipt } from '../services/receipts'
import { uploadReceiptImage } from '../services/storage'

// F-D alur struk (10-fitur-opsional-keluarga.md §6.3): satu endpoint yang MEMBUNGKUS
// post_transactions_batch (endpoint /v1/transactions/batch sendiri TIDAK berubah).
export const receiptsApp = new OpenAPIHono()

receiptsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/receipts/upload', tags: ['receipts'], summary: 'Unggah foto struk/nota ke storage dan dapatkan receipt_url',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: UploadReceiptImageBodySchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: UploadReceiptImageResponseSchema } }, description: 'Berhasil diunggah' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    assertScope(actor, 'write')
    await requireEntitlement(actor, 'receipt_storage')
    const result = await uploadReceiptImage(actor.householdId, c.req.valid('json'))
    return c.json(result, 201)
  },
)

receiptsApp.openapi(
  createRoute({
    method: 'post', path: '/v1/receipts/ingest', tags: ['receipts'], summary: 'Catat struk: transaksi + coret belanja + tambah stok sekaligus',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: IngestReceiptBodySchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: z.any() } }, description: 'Dibuat' },
      422: { content: { 'application/json': { schema: z.any() } }, description: 'receipt_total_mismatch / insufficient_funds' },
    },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'write')
    const result = await ingestReceipt(c.get('actor'), c.req.valid('json'))
    return c.json(result, 201)
  },
)

