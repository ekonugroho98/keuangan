import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { getMonthlyReport } from '../services/reports'

// F-B (10-fitur-opsional-keluarga.md §4). SELALU tersedia untuk kedua kredensial (pola sama
// dengan /v1/summary) — flag `features.monthly_report` hanya mengatur jadwal pengiriman OTOMATIS
// oleh Hermes, bukan akses ke endpoint ini sendiri.
export const reportsApp = new OpenAPIHono()

reportsApp.openapi(
  createRoute({
    method: 'get', path: '/v1/reports/monthly', tags: ['reports'], summary: 'Laporan bulanan siap-kirim (F-B, selalu tersedia)',
    security: [{ bearerJwt: [] }],
    request: { query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional().openapi({ description: 'YYYY-MM; default bulan sebelumnya.' }) }) },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
  }),
  async (c) => {
    const { month } = c.req.valid('query')
    const result = await getMonthlyReport(c.get('actor'), { month })
    return c.json(result, 200)
  },
)
