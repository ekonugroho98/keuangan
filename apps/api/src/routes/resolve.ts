import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ResolveBodySchema } from '@karaya/shared/schemas'
import { resolveName } from '../services/resolve'

export const resolveApp = new OpenAPIHono()

resolveApp.openapi(
  createRoute({
    method: 'post', path: '/v1/resolve', tags: ['resolve'], summary: 'Cocokkan nama manusia ke entitas (untuk agent)',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: ResolveBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Selalu 200 — ini pertanyaan, bukan perintah.' } },
  }),
  async (c) => c.json(await resolveName(c.get('actor'), c.req.valid('json'))),
)
