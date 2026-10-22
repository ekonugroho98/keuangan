import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ApiError } from '@karaya/shared/errors'
import { assertScope } from '../auth/middleware'

export const whatsappApp = new OpenAPIHono()

const WA_GATEKEEPER_BASE = process.env.WA_GATEKEEPER_URL || 'https://9router.cortex-ai.my.id'
const WA_INTERNAL_TOKEN = process.env.WA_BRIDGE_INTERNAL_TOKEN || 'kb-wa-bridge-internal-2026-v1'

async function callWaBridge(path: string, method: 'GET' | 'POST', householdId: string, body?: Record<string, unknown>, query?: Record<string, string | undefined>) {
  const url = new URL(path, WA_GATEKEEPER_BASE)
  url.searchParams.set('household_id', householdId)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-WA-Internal-Token': WA_INTERNAL_TOKEN,
      'X-Household-Id': householdId,
    },
    ...(method === 'POST'
      ? {
          body: JSON.stringify({
            household_id: householdId,
            ...(body ?? {}),
          }),
        }
      : {}),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw ApiError.fromCode('validation_error', {
      message: (data as { error?: string })?.error || `Gagal menghubungi WhatsApp Bridge (${res.status})`,
    })
  }
  return data
}

whatsappApp.openapi(
  createRoute({
    method: 'get',
    path: '/v1/whatsapp/status',
    tags: ['whatsapp'],
    summary: 'Status koneksi WhatsApp Hermes, daftar grup, dan QR pairing aktif',
    security: [{ bearerJwt: [] }],
    request: {
      query: z.object({
        target: z.string().optional(),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    const { target } = c.req.valid('query')
    const data = await callWaBridge('/v1/whatsapp/status', 'GET', actor.householdId, undefined, { target })
    return c.json(data, 200)
  },
)

whatsappApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/whatsapp/pair/start',
    tags: ['whatsapp'],
    summary: 'Mulai sesi pairing WhatsApp baru dan generate QR Code',
    security: [{ bearerJwt: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ target: z.string().optional() }).default({}),
          },
        },
        required: false,
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    assertScope(actor, 'write')
    const body = await c.req.json().catch(() => ({}))
    const data = await callWaBridge('/v1/whatsapp/pair/start', 'POST', actor.householdId, body)
    return c.json(data, 200)
  },
)

whatsappApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/whatsapp/pair/cancel',
    tags: ['whatsapp'],
    summary: 'Batalkan proses scan QR yang sedang berjalan',
    security: [{ bearerJwt: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ target: z.string().optional() }).default({}),
          },
        },
        required: false,
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    assertScope(actor, 'write')
    const body = await c.req.json().catch(() => ({}))
    const data = await callWaBridge('/v1/whatsapp/pair/cancel', 'POST', actor.householdId, body)
    return c.json(data, 200)
  },
)

whatsappApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/whatsapp/groups',
    tags: ['whatsapp'],
    summary: 'Simpan daftar Grup WhatsApp keluarga yang diizinkan',
    security: [{ bearerJwt: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              allowed_groups: z.array(z.string()).default([]),
              require_mention: z.boolean().default(false),
              target: z.string().optional(),
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
    const actor = c.get('actor')
    assertScope(actor, 'write')
    const body = c.req.valid('json')
    const data = await callWaBridge('/v1/whatsapp/groups', 'POST', actor.householdId, body)
    return c.json(data, 200)
  },
)

whatsappApp.openapi(
  createRoute({
    method: 'post',
    path: '/v1/whatsapp/disconnect',
    tags: ['whatsapp'],
    summary: 'Putuskan tautan nomor WhatsApp dari bot Hermes',
    security: [{ bearerJwt: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ target: z.string().optional() }).default({}),
          },
        },
        required: false,
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' },
    },
  }),
  async (c) => {
    const actor = c.get('actor')
    assertScope(actor, 'write')
    const body = await c.req.json().catch(() => ({}))
    const data = await callWaBridge('/v1/whatsapp/disconnect', 'POST', actor.householdId, body)
    return c.json(data, 200)
  },
)
