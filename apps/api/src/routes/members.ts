import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ApiError } from '@karaya/shared/errors'
import { UpdateMemberBodySchema, RemoveMemberQuerySchema, UuidSchema } from '@karaya/shared/schemas'
import { assertScope } from '../auth/middleware'
import * as households from '../services/households'

export const membersApp = new OpenAPIHono()

membersApp.openapi(
  createRoute({ method: 'patch', path: '/v1/members/{id}', tags: ['members'], summary: 'Ubah anggota (diri sendiri bebas, orang lain: owner saja)', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateMemberBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => {
    const actor = c.get('actor')
    const { id } = c.req.valid('param')
    // 05-api.md §3.3: ubah diri sendiri cukup scope write; ubah anggota lain butuh admin.
    assertScope(actor, id === actor.memberId ? 'write' : 'admin')
    return c.json(await households.updateMember(actor, id, c.req.valid('json')), 200)
  },
)

membersApp.openapi(
  createRoute({ method: 'delete', path: '/v1/members/{id}', tags: ['members'], summary: 'Hapus anggota lain (owner)', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), query: RemoveMemberQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    const { id } = c.req.valid('param')
    const { reassign_to_member_id } = c.req.valid('query')
    return c.json(await households.removeMember(c.get('actor'), id, reassign_to_member_id), 200)
  },
)

membersApp.openapi(
  createRoute({ method: 'post', path: '/v1/members/me/leave', tags: ['members'], summary: 'Keluar dari household', security: [{ bearerJwt: [] }],
    request: { query: RemoveMemberQuerySchema },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => {
    const actor = c.get('actor')
    if (actor.credential !== 'jwt') throw ApiError.fromCode('jwt_required')
    const { reassign_to_member_id } = c.req.valid('query')
    return c.json(await households.leaveHousehold(actor, reassign_to_member_id), 200)
  },
)
