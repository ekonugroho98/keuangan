import { z } from '@hono/zod-openapi'
import { UuidSchema, DateStringSchema } from './common'

export const RecurringFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly'])

export const CreateRecurringBodySchema = z
  .object({
    name: z.string().min(1).max(80),
    type: z.enum(['income', 'expense']).default('expense'),
    amount: z.number().int().positive(),
    category_id: UuidSchema.optional(),
    category: z.string().optional(),
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    frequency: RecurringFrequencySchema,
    next_date: DateStringSchema,
    debt_id: UuidSchema.optional(),
    notes: z.string().default(''),
  })
  .openapi('CreateRecurringBody')

export const UpdateRecurringBodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    amount: z.number().int().positive().optional(),
    category_id: UuidSchema.optional(),
    category: z.string().optional(),
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    frequency: RecurringFrequencySchema.optional(),
    next_date: DateStringSchema.optional(),
    debt_id: UuidSchema.nullable().optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  })
  .openapi('UpdateRecurringBody')

export const RunRecurringsBodySchema = z.object({ today: DateStringSchema.optional() }).openapi('RunRecurringsBody')
