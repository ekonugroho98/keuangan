import { z } from '@hono/zod-openapi'
import { PlanTierSchema } from './household'

export const AdminEntitlementsOverridePatchSchema = z
  .object({
    api_access: z.boolean().nullable().optional(),
    receipt_storage: z.boolean().nullable().optional(),
    price_compare: z.boolean().nullable().optional(),
    multi_member: z.boolean().nullable().optional(),
    shopping_stock: z.boolean().nullable().optional(),
    beneficiary: z.boolean().nullable().optional(),
    excel_export: z.boolean().nullable().optional(),
  })
  .strict()
  .openapi('AdminEntitlementsOverridePatch')

export type AdminEntitlementsOverridePatch = z.infer<typeof AdminEntitlementsOverridePatchSchema>

export const AdminListHouseholdsQuerySchema = z
  .object({
    q: z.string().max(120).optional(),
    plan_tier: z.enum(['all', 'free', 'pro', 'lifetime', 'expired']).optional().default('all'),
    limit: z.coerce.number().int().min(1).max(250).optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .openapi('AdminListHouseholdsQuery')

export type AdminListHouseholdsQuery = z.infer<typeof AdminListHouseholdsQuerySchema>

export const AdminUpdateHouseholdPlanBodySchema = z
  .object({
    plan_tier: PlanTierSchema.optional(),
    plan_expires_at: z.string().nullable().optional(),
    entitlements_override: AdminEntitlementsOverridePatchSchema.optional(),
  })
  .strict()
  .openapi('AdminUpdateHouseholdPlanBody')

export type AdminUpdateHouseholdPlanBody = z.infer<typeof AdminUpdateHouseholdPlanBodySchema>

export const AdminCleanupIdempotencyBodySchema = z
  .object({
    older_than_days: z.number().int().min(1).max(365).optional().default(7),
  })
  .strict()
  .openapi('AdminCleanupIdempotencyBody')

export type AdminCleanupIdempotencyBody = z.infer<typeof AdminCleanupIdempotencyBodySchema>
