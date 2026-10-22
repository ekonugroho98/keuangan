import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { UuidSchema } from '@karaya/shared/schemas'
import { getHouseholdTimezone } from '../services/households'
import * as reconciliation from '../services/reconciliation'

export const reconciliationApp = new OpenAPIHono()

reconciliationApp.openapi(
  createRoute({
    method: 'get',
    path: '/v1/reconciliation/imports',
    tags: ['reconciliation'],
    summary: 'Daftar riwayat impor mutasi bank (F-C)',
    security: [{ bearerJwt: [] }],
    request: {
      query: z.object({
        account_id: UuidSchema.optional(),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const q = c.req.valid('query')
    return c.json(await reconciliation.listStatementImports(c.get('actor'), q.account_id), 200)
  },
)

reconciliationApp.openapi(
  createRoute({
    method: 'get',
    path: '/v1/reconciliation/imports/{id}',
    tags: ['reconciliation'],
    summary: 'Detail hasil pencocokan mutasi bank & daftar baris (F-C)',
    security: [{ bearerJwt: [] }],
    request: {
      params: z.object({ id: UuidSchema }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    return c.json(await reconciliation.getStatementImportDetail(c.get('actor'), id), 200)
  },
)

reconciliationApp.post('/v1/reconciliation/imports', async (c) => {
  const actor = c.get('actor')
  const contentType = c.req.header('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.parseBody()
    const account = typeof form.account === 'string' ? form.account : undefined
    const account_id = typeof form.account_id === 'string' ? form.account_id : undefined
    const sourceRaw = typeof form.source === 'string' ? form.source : undefined
    const fileField = form.file
    let csv_text = typeof form.csv_text === 'string' ? form.csv_text : ''
    let filename = typeof form.filename === 'string' ? form.filename : undefined

    if (fileField && typeof fileField === 'object' && 'text' in fileField && typeof fileField.text === 'function') {
      csv_text = await fileField.text()
      if ('name' in fileField && typeof fileField.name === 'string') {
        filename = fileField.name
      }
    }

    const result = await reconciliation.importStatement(actor, {
      account,
      account_id,
      source: sourceRaw as reconciliation.StatementSource | undefined,
      filename,
      csv_text,
    })
    return c.json(result, 201)
  }

  const body = await c.req.json().catch(() => ({}))
  const result = await reconciliation.importStatement(actor, {
    account: typeof body.account === 'string' ? body.account : undefined,
    account_id: typeof body.account_id === 'string' ? body.account_id : undefined,
    source: body.source as reconciliation.StatementSource | undefined,
    filename: typeof body.filename === 'string' ? body.filename : undefined,
    csv_text: typeof body.csv_text === 'string' ? body.csv_text : undefined,
    lines: Array.isArray(body.lines) ? body.lines : undefined,
  })
  return c.json(result, 201)
})

reconciliationApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/reconciliation/scan',
    tags: ['reconciliation'],
    summary: 'Ekstrak baris mutasi bank dari screenshot m-Banking via AI Vision',
    security: [{ bearerJwt: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              image_base64: z.string().min(10),
              mime_type: z.string().default('image/jpeg'),
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const body = c.req.valid('json')
    return c.json(await reconciliation.scanStatementImage(c.get('actor'), body), 200)
  },
)

reconciliationApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/reconciliation/lines/{id}/confirm',
    tags: ['reconciliation'],
    summary: 'Konfirmasi pasangan baris mutasi bank dengan transaksi Karaya',
    security: [{ bearerJwt: [] }],
    request: {
      params: z.object({ id: UuidSchema }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              transaction_id: UuidSchema,
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const { transaction_id } = c.req.valid('json')
    return c.json(await reconciliation.confirmStatementLine(c.get('actor'), id, transaction_id), 200)
  },
)

reconciliationApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/reconciliation/lines/{id}/accept',
    tags: ['reconciliation'],
    summary: 'Terima baris mutasi belum tercatat menjadi transaksi baru (source=import)',
    security: [{ bearerJwt: [] }],
    request: {
      params: z.object({ id: UuidSchema }),
      body: {
        content: {
          'application/json': {
            schema: z
              .object({
                category_id: UuidSchema.optional(),
                category: z.string().optional(),
                note: z.string().optional(),
                beneficiary_id: UuidSchema.optional(),
                beneficiary: z.string().optional(),
              })
              .default({}),
          },
        },
        required: false,
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.any() } }, description: 'Transaksi dibuat' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    const { id } = c.req.valid('param')
    const body = await c.req.json().catch(() => ({}))
    const tz = await getHouseholdTimezone(actor)
    return c.json(await reconciliation.acceptStatementLine(actor, id, body ?? {}, tz), 201)
  },
)

reconciliationApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/reconciliation/lines/{id}/ignore',
    tags: ['reconciliation'],
    summary: 'Abaikan baris mutasi bank',
    security: [{ bearerJwt: [] }],
    request: {
      params: z.object({ id: UuidSchema }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    return c.json(await reconciliation.ignoreStatementLine(c.get('actor'), id), 200)
  },
)
