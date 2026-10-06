import { z } from '@hono/zod-openapi'
import { UuidSchema, DateStringSchema } from './common'
import { MemberSummarySchema } from './accounts'

export const TxTypeSchema = z.enum(['income', 'expense', 'transfer'])
export const TxSourceSchema = z.enum(['web', 'api_key', 'recurring', 'system', 'import', 'migration'])

export const TransactionAccountRefSchema = z
  .object({ id: UuidSchema, name: z.string(), owner: MemberSummarySchema })
  .nullable()

export const CategoryRefOutSchema = z.object({ id: UuidSchema, name: z.string(), icon: z.string(), color: z.string() })

export const TransactionSchema = z
  .object({
    id: UuidSchema,
    type: TxTypeSchema,
    amount: z.number().int(),
    date: DateStringSchema,
    note: z.string(),
    account: TransactionAccountRefSchema,
    to_account: TransactionAccountRefSchema,
    category: CategoryRefOutSchema,
    recorded_by: z.object({ member_id: UuidSchema, display_name: z.string() }),
    source: TxSourceSchema,
    recurring_id: UuidSchema.nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable(),
  })
  .openapi('Transaction')

export const CreateTransactionBodySchema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: z.number().int().positive().max(100_000_000_000).optional(),
    amount_text: z.string().min(1).optional(),
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    category_id: UuidSchema.optional(),
    category: z.string().optional(),
    date: DateStringSchema.optional(),
    note: z.string().max(500).optional(),
  })
  .openapi('CreateTransactionBody')

export const BatchItemSchema = z.object({
  amount: z.number().int().positive().optional(),
  amount_text: z.string().optional(),
  category_id: UuidSchema.optional(),
  category: z.string().optional(),
  note: z.string().optional(),
})

export const CreateTransactionBatchBodySchema = z
  .object({
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    date: DateStringSchema.optional(),
    items: z.array(BatchItemSchema).min(1).max(100),
  })
  .openapi('CreateTransactionBatchBody')

export const UpdateTransactionBodySchema = z
  .object({
    amount: z.number().int().positive().max(100_000_000_000).optional(),
    type: z.enum(['income', 'expense']).optional(),
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    category_id: UuidSchema.optional(),
    category: z.string().optional(),
    date: DateStringSchema.optional(),
    note: z.string().max(500).optional(),
  })
  .openapi('UpdateTransactionBody')

export const CreateTransferBodySchema = z
  .object({
    amount: z.number().int().positive().max(100_000_000_000).optional(),
    amount_text: z.string().min(1).optional(),
    from_account_id: UuidSchema.optional(),
    from_account: z.string().optional(),
    to_account_id: UuidSchema.optional(),
    to_account: z.string().optional(),
    date: DateStringSchema.optional(),
    note: z.string().max(500).optional(),
  })
  .openapi('CreateTransferBody')

export const TransactionListQuerySchema = z.object({
  period: z.string().optional(),
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
  type: TxTypeSchema.optional(),
  account_id: UuidSchema.optional(),
  account: z.string().optional(),
  category_id: UuidSchema.optional(),
  category: z.string().optional(),
  member_id: UuidSchema.optional(),
  member: z.string().optional(),
  attribution: z.enum(['owner', 'recorded_by']).default('owner'),
  q: z.string().optional(),
  min_amount: z.coerce.number().int().optional(),
  max_amount: z.coerce.number().int().optional(),
  include_deleted: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
})
