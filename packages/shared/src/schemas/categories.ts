import { z } from '@hono/zod-openapi'
import { UuidSchema } from './common'

export const CategoryTypeSchema = z.enum(['income', 'expense', 'both'])

export const CategorySchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    aliases: z.array(z.string()),
    type: CategoryTypeSchema,
    icon: z.string(),
    color: z.string(),
    is_system: z.boolean(),
    system_key: z.string().nullable(),
  })
  .openapi('Category')

export const CreateCategoryBodySchema = z
  .object({
    name: z.string().min(1).max(40),
    type: CategoryTypeSchema,
    icon: z.string().optional(),
    color: z.string().optional(),
    aliases: z.array(z.string()).default([]),
  })
  .openapi('CreateCategoryBody')

export const UpdateCategoryBodySchema = z
  .object({
    name: z.string().min(1).max(40).optional(),
    aliases: z.array(z.string()).optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('UpdateCategoryBody')
