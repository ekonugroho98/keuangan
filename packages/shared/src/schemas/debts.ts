import { z } from '@hono/zod-openapi'
import { UuidSchema, DateStringSchema } from './common'

export const CreateDebtBodySchema = z
  .object({
    name: z.string().min(1).max(80),
    total: z.number().int().positive(),
    monthly: z.number().int().min(0).default(0),
    due_date: DateStringSchema.optional(),
    owner: z.string().default('me'),
    opening_paid: z.number().int().min(0).default(0),
    aliases: z.array(z.string()).default([]),
    notes: z.string().default(''),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('CreateDebtBody')

export const UpdateDebtBodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    total: z.number().int().positive().optional(),
    remaining: z.number().int().min(0).optional().openapi({ description: 'Koreksi langsung sisa hutang (bukan pembayaran baru). opening_paid dihitung ulang server-side agar remaining derived sama persis.' }),
    monthly: z.number().int().min(0).optional(),
    due_date: DateStringSchema.nullable().optional(),
    notes: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    owner: z.string().optional().openapi({ description: '"me", "joint", uuid member, atau nama/alias member — alihkan kepemilikan hutang (Fase 5 F5-T5).' }),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('UpdateDebtBody')

export const PayDebtBodySchema = z
  .object({
    amount: z.number().int().positive().optional(),
    amount_text: z.string().min(1).optional(),
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    date: DateStringSchema.optional(),
    note: z.string().optional(),
    allow_overpay: z.boolean().default(false),
  })
  .openapi('PayDebtBody')
