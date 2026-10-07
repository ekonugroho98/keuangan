import { z } from '@hono/zod-openapi'
import { UuidSchema } from './common'

export const MemberRoleSchema = z.enum(['owner', 'member', 'viewer'])

// ── Fitur opsional "kelola keluarga" per household (10-fitur-opsional-keluarga.md §2) ────────
// Dua kontrak berbeda, sengaja:
//  - Skema PENYIMPANAN (HouseholdFeaturesSchema & bagian-bagiannya di bawah) TIDAK strict — kunci
//    yang tidak dikenal di-strip, bukan ditolak. Kolom jsonb di DB harus bisa dibaca oleh versi
//    kode yang lebih lama/baru (rollback deploy, kunci fitur dihapus, edit manual di Studio) tanpa
//    membuat SEMUA endpoint yang membaca features (summary, households/current, bootstrap) jadi 500.
//  - Skema BODY PATCH (UpdateHouseholdFeaturesBodySchema) STRICT — salah ketik kunci dari klien
//    (mis. "benificiary") ditolak 400, bukan diam-diam diabaikan.
export const BeneficiaryFeatureSchema = z.object({ enabled: z.boolean().default(false) })

export const MonthlyReportFeatureSchema = z
  .object({
    enabled: z.boolean().default(false),
    day: z.number().int().min(1).max(28).default(1),
    hour: z.number().int().min(0).max(23).default(8),
    channel: z.enum(['telegram', 'whatsapp', 'both']).default('both'),
    recipients: z.union([z.literal('all'), z.array(UuidSchema)]).default('all'),
  })

export const ReconciliationFeatureSchema = z.object({ enabled: z.boolean().default(false) })

export const ExpiryReminderSchema = z
  .object({
    enabled: z.boolean().default(false),
    hour: z.number().int().min(0).max(23).default(7),
    days_before: z.number().int().min(0).max(7).default(2),
    recipients: z.union([z.literal('all'), z.array(UuidSchema)]).default('all'),
  })

export const ShoppingStockFeatureSchema = z
  .object({
    enabled: z.boolean().default(false),
    expiry_reminder: ExpiryReminderSchema.default({}),
  })

export const HouseholdFeaturesSchema = z
  .object({
    beneficiary: BeneficiaryFeatureSchema.default({}),
    monthly_report: MonthlyReportFeatureSchema.default({}),
    reconciliation: ReconciliationFeatureSchema.default({}),
    shopping_stock: ShoppingStockFeatureSchema.default({}),
  })
  .openapi('HouseholdFeatures')

export type HouseholdFeatures = z.infer<typeof HouseholdFeaturesSchema>

/** Body PATCH: tiap fitur opsional dan PARTIAL (merge per-fitur di service layer, bukan replace total). */
export const UpdateHouseholdFeaturesBodySchema = z
  .object({
    beneficiary: BeneficiaryFeatureSchema.partial().strict().optional(),
    monthly_report: MonthlyReportFeatureSchema.partial().strict().optional(),
    reconciliation: ReconciliationFeatureSchema.partial().strict().optional(),
    shopping_stock: z
      .object({
        enabled: z.boolean().optional(),
        expiry_reminder: ExpiryReminderSchema.partial().strict().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .openapi('UpdateHouseholdFeaturesBody')

export const CreateInvitationBodySchema = z
  .object({
    email: z.string().email().optional(),
    role: MemberRoleSchema.default('owner'),
    display_name_suggestion: z.string().min(1).max(60).optional(),
  })
  .openapi('CreateInvitationBody')

export const AcceptInvitationBodySchema = z
  .object({
    display_name: z.string().min(1).max(60),
    mode: z.enum(['fresh', 'merge']),
  })
  .openapi('AcceptInvitationBody')

export const UpdateMemberBodySchema = z
  .object({
    display_name: z.string().min(1).max(60).optional(),
    aliases: z.array(z.string()).optional(),
    color: z.string().optional(),
    role: MemberRoleSchema.optional(),
  })
  .openapi('UpdateMemberBody')

export const UpdateHouseholdSettingsBodySchema = z
  .object({
    default_account_visibility: z.enum(['shared', 'private']).optional(),
    owners_can_view_private_totals: z.boolean().optional(),
  })
  .openapi('UpdateHouseholdSettingsBody')

export const UpdateHouseholdBodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    timezone: z.string().optional(),
    settings: UpdateHouseholdSettingsBodySchema.optional(),
    features: UpdateHouseholdFeaturesBodySchema.optional(),
  })
  .openapi('UpdateHouseholdBody')

export const RemoveMemberQuerySchema = z.object({
  reassign_to_member_id: z.union([UuidSchema, z.literal('joint')]).optional(),
})
