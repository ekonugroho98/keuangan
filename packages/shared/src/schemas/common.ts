import { z } from '@hono/zod-openapi'

export const UuidSchema = z.string().uuid().openapi({ example: '11111111-1111-1111-1111-111111111111' })

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .openapi({ example: '2026-10-04' })

export const AmountSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(100_000_000_000)
  .openapi({ example: 45000 })

/** amount ATAU amount_text — dipakai di body create transaction/transfer/dll (05-api.md §2.7). */
export const AmountInputSchema = z
  .object({
    amount: AmountSchema.optional(),
    amount_text: z.string().min(1).optional().openapi({ example: '45rb' }),
  })
  .refine((v) => v.amount !== undefined || v.amount_text !== undefined, {
    message: 'amount atau amount_text wajib diisi',
  })

/** Referensi akun: account_id (UUID) ATAU account (nama manusia). */
export const AccountRefSchema = z
  .object({
    account_id: UuidSchema.optional(),
    account: z.string().min(1).optional(),
  })
  .refine((v) => v.account_id !== undefined || v.account !== undefined, {
    message: 'account_id atau account wajib diisi',
  })

export const CategoryRefSchema = z
  .object({
    category_id: UuidSchema.optional(),
    category: z.string().min(1).optional(),
  })
  .refine((v) => v.category_id !== undefined || v.category !== undefined, {
    message: 'category_id atau category wajib diisi',
  })

export const MemberRefSchema = z.object({
  member_id: UuidSchema.optional(),
  member: z.string().min(1).optional(),
})

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      hint: z.string().optional(),
      candidates: z.array(z.unknown()).optional(),
      details: z.record(z.unknown()).optional(),
      request_id: z.string().optional(),
    }),
  })
  .openapi('ErrorResponse')

export const PeriodQuerySchema = z.object({
  period: z.string().default('this_month').openapi({ example: 'this_month' }),
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
})

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
})

export function openApiRef<T extends z.ZodTypeAny>(schema: T, name: string) {
  return schema.openapi(name)
}
