import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { streamSSE } from 'hono/streaming'
import { ApiError } from '@karaya/shared/errors'
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

// Endpoint SSE streaming untuk web AI chat (12-ai-chat-ux.md §4.1, non-OpenAPI karena respons text/event-stream).
aiApp.post('/v1/ai/chat/stream', async (c) => {
  const actor = c.get('actor')
  requireJwtOnly(actor)

  let rawBody: unknown
  try {
    rawBody = await c.req.json()
  } catch {
    throw ApiError.fromCode('validation_error', { message: 'Body JSON tidak valid.' })
  }

  const parsed = AiChatBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    throw ApiError.fromCode('validation_error', {
      message: parsed.error.issues[0]?.message ?? 'Parameter permintaan tidak valid.',
    })
  }

  const { messages, allow_write } = parsed.data
  const startMs = Date.now()
  c.header('Cache-Control', 'no-cache')
  c.header('X-Accel-Buffering', 'no')

  return streamSSE(c, async (stream) => {
    const abortCtrl = new AbortController()
    c.req.raw.signal?.addEventListener('abort', () => abortCtrl.abort(), { once: true })
    stream.onAbort(() => abortCtrl.abort())

    const pingInterval = setInterval(() => {
      stream.write(': ping\n\n').catch(() => {})
    }, 10_000)

    try {
      const result = await chatWithAi(
        actor,
        messages,
        allow_write,
        async (ev) => {
          if (abortCtrl.signal.aborted) return
          if (ev.type === 'status') {
            await stream.writeSSE({
              event: 'status',
              data: JSON.stringify({
                step: ev.step,
                ...(ev.tool ? { tool: ev.tool } : {}),
                label: ev.label,
              }),
            })
          } else if (ev.type === 'token') {
            await stream.writeSSE({
              event: 'token',
              data: JSON.stringify({ text: ev.text }),
            })
          }
        },
        abortCtrl.signal,
      )

      if (!abortCtrl.signal.aborted) {
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({
            reply: result.reply,
            mutated: result.mutated,
            tools_used: result.tools_used,
            elapsed_ms: Date.now() - startMs,
          }),
        })
      }
    } catch (err) {
      if (abortCtrl.signal.aborted) return
      const code = err instanceof ApiError ? err.code : 'upstream_ai_error'
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada layanan AI'
      await stream
        .writeSSE({
          event: 'error',
          data: JSON.stringify({ code, message }),
        })
        .catch(() => {})
    } finally {
      clearInterval(pingInterval)
    }
  })
})

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
