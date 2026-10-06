import { z } from '@hono/zod-openapi'
import { UuidSchema, DateStringSchema } from './common'

export const CreateGoalBodySchema = z
  .object({
    name: z.string().min(1).max(80),
    target: z.number().int().positive(),
    deadline: DateStringSchema.optional(),
    owner: z.string().default('me'),
    opening_amount: z.number().int().min(0).default(0),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('CreateGoalBody')

export const UpdateGoalBodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    target: z.number().int().positive().optional(),
    current: z.number().int().min(0).optional().openapi({ description: 'Koreksi langsung progres (bukan setoran baru). Pakai POST .../contributions untuk mencatat setoran nyata.' }),
    deadline: DateStringSchema.nullable().optional(),
    owner: z.string().optional().openapi({ description: '"me", "joint", uuid member, atau nama/alias member — alihkan kepemilikan target (Fase 5 F5-T5).' }),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('UpdateGoalBody')

export const ContributeGoalBodySchema = z
  .object({
    amount: z.number().int().positive().optional(),
    amount_text: z.string().min(1).optional(),
    account_id: UuidSchema.nullable().optional(),
    account: z.string().nullable().optional(),
    date: DateStringSchema.optional(),
    note: z.string().optional(),
  })
  .openapi('ContributeGoalBody')
