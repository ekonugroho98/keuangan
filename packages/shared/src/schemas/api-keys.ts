import { z } from '@hono/zod-openapi'

export const ApiKeyScopeSchema = z.enum(['read', 'write', 'admin'])

export const CreateApiKeyBodySchema = z
  .object({
    name: z.string().min(1).max(60),
    scope: ApiKeyScopeSchema.default('write'),
    member: z.string().optional().openapi({ description: '"me" (default) atau nama/alias/uuid member lain (owner saja).' }),
    expires_in_days: z.number().int().positive().optional(),
  })
  .openapi('CreateApiKeyBody')
