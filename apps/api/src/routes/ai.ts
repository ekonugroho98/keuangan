import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { AiChatBodySchema, AiChatResponseSchema, ScanReceiptBodySchema, ScanReceiptResponseSchema } from '@karaya/shared/schemas'
import { requireJwtOnly } from '../auth/middleware'
import { chatWithAi } from '../services/ai/chat'
import { scanReceipt } from '../services/ai/scan-receipt'

// /v1/ai/* adalah "jwt saja" (05-api.md §3.3) — requireJwtOnly dipanggil per-handler, bukan
// .use('*', ...) kedua (lihat catatan di auth/middleware.ts soal wildcard yang bocor lintas sub-app).
export const aiApp = new OpenAPIHono()

aiApp.openapi(
  createRoute({
    method: 'post', path: '/v1/ai/chat', tags: ['ai'], summary: 'Chat dengan AI coach (BYOK, tool-calling atas data household)',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: AiChatBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: AiChatResponseSchema } }, description: 'OK' } },
  }),
  async (c) => {
    requireJwtOnly(c.get('actor'))
    const body = c.req.valid('json')
    return c.json(await chatWithAi(c.get('actor'), body.messages, body.allow_write), 200)
  },
)

aiApp.openapi(
  createRoute({
    method: 'post', path: '/v1/ai/scan-receipt', tags: ['ai'], summary: 'Ekstrak item dari foto struk atau teks OCR via AI (BYOK)',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: ScanReceiptBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: ScanReceiptResponseSchema } }, description: 'OK' } },
  }),
  async (c) => {
    requireJwtOnly(c.get('actor'))
    return c.json(await scanReceipt(c.get('actor'), c.req.valid('json')), 200)
  },
)
