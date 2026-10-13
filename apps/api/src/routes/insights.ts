import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { DateStringSchema } from '@karaya/shared/schemas'
import * as insights from '../services/insights'

// Analisa pengeluaran siap pakai untuk agent (05-api.md §4.15). Read-only, tidak digate feature flag.
export const insightsApp = new OpenAPIHono()

insightsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/insights/spending', tags: ['insights'], summary: 'Analisa pengeluaran (angka matang untuk agent)',
    security: [{ bearerJwt: [] }],
    request: {
      query: z.object({
        period: z.string().optional().openapi({ description: 'this_month (default), last_month, this_week, last_week, today, yesterday, this_year, YYYY-MM, YYYY' }),
        from: DateStringSchema.optional(),
        to: DateStringSchema.optional(),
        category: z.string().optional(),
        account: z.string().optional(),
        beneficiary: z.string().optional(),
        q: z.string().optional().openapi({ description: 'Cari di catatan, mis. "bakso"' }),
        compare: z.enum(['true', 'false']).optional(),
      }),
    },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const q = c.req.valid('query')
    return c.json(await insights.analyzeSpending(c.get('actor'), { ...q, compare: q.compare !== 'false' }), 200)
  },
)
