import { z } from '@hono/zod-openapi'
import { UuidSchema } from './common'

// ── Split bills ──────────────────────────────────────────────────────────
export const SplitBillMemberInputSchema = z.object({ name: z.string().min(1), amount: z.number().int().positive() })

export const CreateSplitBillBodySchema = z
  .object({
    title: z.string().min(1),
    total_amount: z.number().int().positive(),
    date: z.string(),
    note: z.string().optional(),
    members: z.array(SplitBillMemberInputSchema).default([]),
  })
  .openapi('CreateSplitBillBody')

export const ToggleSplitBillMemberBodySchema = z.object({ paid: z.boolean() }).openapi('ToggleSplitBillMemberBody')

// ── Investments ──────────────────────────────────────────────────────────
export const InvestmentTypeSchema = z.enum(['emas', 'saham', 'reksa_dana', 'crypto', 'properti', 'lainnya'])

export const CreateInvestmentBodySchema = z
  .object({
    name: z.string().min(1),
    type: InvestmentTypeSchema,
    owner: z.string().default('me'),
    icon: z.string().optional(),
    color: z.string().optional(),
    brand: z.string().optional(),
    buy_price: z.number().int().min(0).default(0),
    current_value: z.number().int().min(0).default(0),
    quantity: z.number().optional(),
    unit: z.string().default('unit'),
    kode_saham: z.string().optional(),
    buy_date: z.string().optional(),
    notes: z.string().default(''),
  })
  .openapi('CreateInvestmentBody')

export const UpdateInvestmentBodySchema = CreateInvestmentBodySchema.partial().openapi('UpdateInvestmentBody')

// ── Resolve ──────────────────────────────────────────────────────────────
export const ResolveBodySchema = z
  .object({
    kind: z.enum(['account', 'category', 'member', 'debt', 'goal', 'piutang']),
    query: z.string().min(1),
    type: z.enum(['income', 'expense']).optional(),
  })
  .openapi('ResolveBody')

// ── Me / settings ────────────────────────────────────────────────────────
export const UpdateMeBodySchema = z.object({ full_name: z.string().min(1).optional() }).openapi('UpdateMeBody')
export const UpdatePasswordBodySchema = z.object({ new_password: z.string().min(8) }).openapi('UpdatePasswordBody')

export const AiConfigInputSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  api_key: z.string().optional(),
  disabled: z.boolean().optional(),
})

export const UpdateSettingsBodySchema = z
  .object({
    avatar_color: z.string().optional(),
    hidden_menus: z.array(z.string()).optional(),
    app_name: z.string().optional(),
    app_tagline: z.string().optional(),
    language: z.string().optional(),
    theme: z.string().optional(),
    active_household_id: UuidSchema.optional(),
    ai_config: AiConfigInputSchema.optional(),
  })
  .openapi('UpdateSettingsBody')

export const CreateHouseholdBodySchema = z
  .object({
    name: z.string().min(1).max(80),
    timezone: z.string().default('Asia/Jakarta'),
    display_name: z.string().min(1).max(60),
  })
  .openapi('CreateHouseholdBody')
