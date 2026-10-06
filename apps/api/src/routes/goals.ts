import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { CreateGoalBodySchema, UpdateGoalBodySchema, ContributeGoalBodySchema, UuidSchema } from '@karaya/shared/schemas'

import { getHouseholdTimezone } from '../services/households'
import * as goals from '../services/goals'

export const goalsApp = new OpenAPIHono()

goalsApp.openapi(
  createRoute({ method: 'get', path: '/v1/goals', tags: ['goals'], summary: 'Daftar target finansial', security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await goals.listGoals(c.get('actor')), 200),
)

goalsApp.openapi(
  createRoute({ method: 'post', path: '/v1/goals', tags: ['goals'], summary: 'Buat target', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: CreateGoalBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'Dibuat' } } }),
  async (c) => c.json(await goals.createGoal(c.get('actor'), c.req.valid('json')), 201),
)

goalsApp.openapi(
  createRoute({ method: 'patch', path: '/v1/goals/{id}', tags: ['goals'], summary: 'Ubah target', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: UpdateGoalBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => c.json(await goals.updateGoal(c.get('actor'), c.req.valid('param').id, c.req.valid('json')), 200),
)

goalsApp.openapi(
  createRoute({ method: 'delete', path: '/v1/goals/{id}', tags: ['goals'], summary: 'Hapus target', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } } }),
  async (c) => c.json(await goals.deleteGoal(c.get('actor'), c.req.valid('param').id), 200),
)

goalsApp.openapi(
  createRoute({ method: 'post', path: '/v1/goals/{id}/contributions', tags: ['goals'], summary: 'Tabung ke target', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }), body: { content: { 'application/json': { schema: ContributeGoalBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.unknown() } }, description: 'OK' } } }),
  async (c) => {
    const actor = c.get('actor')
    const tz = await getHouseholdTimezone(actor)
    return c.json(await goals.contributeGoal(actor, c.req.valid('param').id, c.req.valid('json'), tz), 201)
  },
)

goalsApp.openapi(
  createRoute({ method: 'get', path: '/v1/goals/{id}/contributions', tags: ['goals'], summary: 'Riwayat tabungan target', security: [{ bearerJwt: [] }],
    request: { params: z.object({ id: UuidSchema }) },
    responses: { 200: { content: { 'application/json': { schema: z.array(z.unknown()) } }, description: 'OK' } } }),
  async (c) => c.json(await goals.listGoalContributions(c.get('actor'), c.req.valid('param').id), 200),
)
