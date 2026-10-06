import { z } from '@hono/zod-openapi'
import { UuidSchema } from './common'
import { ACCOUNT_TYPES } from '../constants/categories'

export const AccountTypeSchema = z.enum(ACCOUNT_TYPES)
export const AccountVisibilitySchema = z.enum(['shared', 'private'])

export const MemberSummarySchema = z
  .object({ member_id: UuidSchema, display_name: z.string() })
  .nullable()
  .openapi('MemberSummary')

export const AccountSchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    aliases: z.array(z.string()),
    type: AccountTypeSchema,
    visibility: AccountVisibilitySchema,
    owner: MemberSummarySchema,
    balance: z.number().int().nullable().openapi({ description: 'null kalau akun privat milik orang lain' }),
    can_view: z.boolean(),
    can_post: z.boolean(),
    can_receive_transfer: z.boolean(),
    icon: z.string(),
    color: z.string(),
    tx_count: z.number().int().nullable(),
    last_tx_date: z.string().nullable(),
    needs_review: z.boolean(),
  })
  .openapi('Account')

export const AccountListResponseSchema = z
  .object({
    data: z.array(AccountSchema),
    totals: z.object({
      visible_balance: z.number().int(),
      hidden_private_accounts: z.number().int(),
    }),
  })
  .openapi('AccountListResponse')

export const CreateAccountBodySchema = z
  .object({
    name: z.string().min(1).max(60),
    type: AccountTypeSchema,
    owner: z.string().default('me').openapi({ description: '"me" | "joint" | member_id | nama member', example: 'me' }),
    visibility: AccountVisibilitySchema.optional(),
    opening_balance: z.number().int().min(0).max(100_000_000_000).default(0),
    aliases: z.array(z.string()).default([]),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('CreateAccountBody')

export const UpdateAccountBodySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    aliases: z.array(z.string()).optional(),
    type: AccountTypeSchema.optional(),
    visibility: AccountVisibilitySchema.optional(),
    owner: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    sort_order: z.number().int().optional(),
    restore: z.boolean().optional(),
  })
  .openapi('UpdateAccountBody')

export const AdjustBalanceBodySchema = z
  .object({
    new_balance: z.number().int().min(0).max(100_000_000_000),
    date: z.string().optional(),
    note: z.string().optional(),
  })
  .openapi('AdjustBalanceBody')
