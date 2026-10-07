import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { UuidSchema } from '@karaya/shared/schemas'

import { getSummary } from '../services/summary'

export const summaryApp = new OpenAPIHono()

const SummaryQuerySchema = z.object({
  period: z.string().default('this_month'),
  from: z.string().optional(),
  to: z.string().optional(),
  scope: z.enum(['household', 'member', 'account', 'beneficiary']).default('household'),
  member_id: UuidSchema.optional(),
  member: z.string().optional(),
  account_id: UuidSchema.optional(),
  account: z.string().optional(),
  beneficiary_id: UuidSchema.optional(),
  beneficiary: z.string().optional().openapi({ description: 'F-A (10-fitur-opsional-keluarga.md §3.4), hanya kalau feature beneficiary aktif.' }),
  attribution: z.enum(['owner', 'recorded_by']).default('owner'),
  compare: z.coerce.boolean().default(false),
})

summaryApp.openapi(
  createRoute({
    method: 'get', path: '/v1/summary', tags: ['summary'], summary: 'Ringkasan keuangan periode tertentu (untuk agent & dasbor)',
    security: [{ bearerJwt: [] }],
    request: { query: SummaryQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } },
  }),
  async (c) => {
    const q = c.req.valid('query')
    const result = await getSummary(c.get('actor'), {
      period: q.period, from: q.from, to: q.to, scope: q.scope, attribution: q.attribution, compare: q.compare,
      memberRef: q.member_id || q.member ? { member_id: q.member_id, member: q.member } : undefined,
      accountRef: q.account_id || q.account ? { account_id: q.account_id, account: q.account } : undefined,
      beneficiaryRef: q.beneficiary_id || q.beneficiary ? { beneficiary_id: q.beneficiary_id, beneficiary: q.beneficiary } : undefined,
    })
    return c.json(result, 200)
  },
)
