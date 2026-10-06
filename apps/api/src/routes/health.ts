import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { checkDbHealth } from '../db/client'

const HealthResponse = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
    db: z.enum(['ok', 'not_configured', 'error']),
  })
  .openapi('HealthResponse')

const healthRoute = createRoute({
  method: 'get',
  path: '/v1/health',
  summary: 'Status layanan',
  description: 'Tidak butuh autentikasi. db: ok kalau koneksi ke Postgres (role karaya_api) berhasil.',
  tags: ['system'],
  responses: {
    200: {
      content: { 'application/json': { schema: HealthResponse } },
      description: 'Layanan hidup',
    },
  },
})

export const healthApp = new OpenAPIHono()

healthApp.openapi(healthRoute, async (c) => {
  const db = await checkDbHealth()
  return c.json({ status: 'ok' as const, version: '0.1.0', db }, 200)
})
