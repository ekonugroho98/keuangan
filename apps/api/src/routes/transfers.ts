import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateTransferBodySchema, ErrorResponseSchema } from '@karaya/shared/schemas'

import { createTransfer } from '../services/transfers'
import { getHouseholdTimezone } from '../services/households'

export const transfersApp = new OpenAPIHono()

transfersApp.openapi(
  createRoute({
    method: 'post', path: '/v1/transfers', tags: ['transfers'], summary: 'Pindah dana antar akun',
    security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateTransferBodySchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: z.any() } }, description: 'Transfer berhasil' },
      409: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Nama akun ambigu' },
      422: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Saldo tidak cukup / akun sama' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    const result = await createTransfer(actor, c.req.valid('json'), tz)
    return c.json(result, 201)
  },
)
