import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateInvitationBodySchema, AcceptInvitationBodySchema, UuidSchema } from '@karaya/shared/schemas'
import { requireUserId, assertScope } from '../auth/middleware'
import { requireEntitlement } from '../services/entitlements'
import * as invitations from '../services/invitations'

// ── Rute yang butuh household aktif (lihat/buat/revoke undangan) ────────────────────────────
// Semua endpoint di sini admin-only (05-api.md §3.3) — termasuk GET list, bukan cuma mutasi.
// assertScope() dipanggil per-handler, BUKAN .use('*', requireScope(...)) — wildcard kedua di
// satu sub-app ternyata bocor ke SEMUA sub-app lain yang di-mount ke root app (bug nyata Fase 6,
// lihat requireJwtOnly di auth/middleware.ts untuk detail).
export const invitationsApp = new OpenAPIHono()

invitationsApp.openapi(
  createRoute({ method: 'get', path: '/v1/invitations', tags: ['invitations'], summary: 'Daftar undangan pending', security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    return c.json(await invitations.listInvitations(c.get('actor')), 200)
  },
)

invitationsApp.openapi(
  createRoute({ method: 'post', path: '/v1/invitations', tags: ['invitations'], summary: 'Buat undangan', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateInvitationBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } } }),
  async (c) => {
    const actor = c.get('actor')
    assertScope(actor, 'admin')
    await requireEntitlement(actor, 'multi_member')
    return c.json(await invitations.createInvitation(actor, c.req.valid('json')), 201)
  },
)

invitationsApp.openapi(
  createRoute({ method: 'delete', path: '/v1/invitations/{id}', tags: ['invitations'], summary: 'Cabut undangan', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    return c.json(await invitations.revokeInvitation(c.get('actor'), c.req.valid('param').id), 200)
  },
)

// ── Rute publik/pra-login: preview + accept (JWT valid saja, belum tentu ada household) ─────
export const invitationsPublicApp = new OpenAPIHono()

invitationsPublicApp.openapi(
  createRoute({ method: 'get', path: '/v1/invitations/{code}', tags: ['invitations'], summary: 'Preview undangan (tanpa login)',
    request: { params: z.object({ code: z.string() }) },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => c.json(await invitations.previewInvitation(c.req.valid('param').code), 200),
)

invitationsPublicApp.openapi(
  createRoute({ method: 'post', path: '/v1/invitations/{code}/accept', tags: ['invitations'], summary: 'Terima undangan', security: [{ bearerJwt: [] }],
    request: { params: z.object({ code: z.string() }), body: { content: { 'application/json': { schema: AcceptInvitationBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => {
    const userId = await requireUserId(c)
    return c.json(await invitations.acceptInvitation(userId, c.req.valid('param').code, c.req.valid('json')), 201)
  },
)
