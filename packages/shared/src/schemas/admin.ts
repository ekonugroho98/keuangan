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

export const AdminHouseholdTokensBodySchema = z
  .object({
    delta_tokens: z.number().int().min(-100_000_000).max(100_000_000).optional().default(0),
    set_balance: z.number().int().min(0).max(100_000_000).nullable().optional(),
    auto_inject_key: z.boolean().optional().default(true),
    force_new_key: z.boolean().optional().default(false),
    model: z.string().min(1).max(60).optional().default('kb-auto'),
  })
  .strict()
  .openapi('AdminHouseholdTokensBody')

export type AdminHouseholdTokensBody = z.infer<typeof AdminHouseholdTokensBodySchema>

export const AdminProvisionWalletBodySchema = z
  .object({
    owner_id: z.string().min(1).max(120),
    display_name: z.string().max(120).optional(),
    aliases: z.array(z.string().min(1).max(120)).max(30).optional().default([]),
    delta_tokens: z.number().int().min(-100_000_000).max(100_000_000).optional().default(0),
    set_balance: z.number().int().min(0).max(100_000_000).nullable().optional(),
    create_key_if_missing: z.boolean().optional().default(true),
    force_new_key: z.boolean().optional().default(false),
    key_name: z.string().max(80).optional().default('Karaya Key'),
  })
  .strict()
  .openapi('AdminProvisionWalletBody')

export type AdminProvisionWalletBody = z.infer<typeof AdminProvisionWalletBodySchema>

export const AdminCreateVouchersBodySchema = z
  .object({
    tokens: z.number().int().min(1000).max(100_000_000),
    count: z.number().int().min(1).max(50).optional().default(1),
    prefix: z.string().min(1).max(20).optional().default('KB'),
    notes: z.string().max(120).optional().default(''),
  })
  .strict()
  .openapi('AdminCreateVouchersBody')

export type AdminCreateVouchersBody = z.infer<typeof AdminCreateVouchersBodySchema>
