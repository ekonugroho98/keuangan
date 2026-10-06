import { z } from '@hono/zod-openapi'
import { UuidSchema } from './common'

export const MonthStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .openapi({ example: '2026-10' })

export const CreateBudgetBodySchema = z
  .object({
    category_id: UuidSchema.optional(),
    category: z.string().optional(),
    amount: z.number().int().positive().max(100_000_000_000),
    month: MonthStringSchema,
    member_id: UuidSchema.optional(),
    member: z.string().optional(),
  })
  .openapi('CreateBudgetBody')

export const UpdateBudgetBodySchema = z.object({ amount: z.number().int().positive().max(100_000_000_000) })

export const CopyBudgetBodySchema = z
  .object({
    from_month: MonthStringSchema,
    to_month: MonthStringSchema,
    overwrite: z.boolean().default(false),
  })
  .openapi('CopyBudgetBody')
