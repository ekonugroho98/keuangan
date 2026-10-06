import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { UuidSchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as auditLog from '../services/audit-log'

// assertScope dipanggil di handler (bukan .use('*', requireScope(...)) — lihat catatan di
// invitations.ts/auth/middleware.ts soal wildcard kedua yang bocor lintas sub-app).
export const auditLogApp = new OpenAPIHono()

auditLogApp.openapi(
  createRoute({
    method: 'get', path: '/v1/audit-log', tags: ['audit-log'], summary: 'Riwayat tindakan (admin)',
    security: [{ bearerJwt: [] }],
    request: {
      query: z.object({
        api_key_id: UuidSchema.optional(), member_id: UuidSchema.optional(), action: z.string().optional(),
        from: z.string().optional(), to: z.string().optional(), cursor: z.string().optional(),
        limit: z.coerce.number().int().positive().max(200).default(50),
      }),
    },
    responses: { 200: { content: { 'application/json': { schema: z.object({ data: z.array(z.unknown()), next_cursor: z.string().nullable(), has_more: z.boolean() }) } }, description: 'OK' } },
  }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    return c.json(await auditLog.listAuditLog(c.get('actor'), c.req.valid('query')), 200)
  },
)
