import { z } from '@hono/zod-openapi'
import { UuidSchema, DateStringSchema } from './common'

export const CreatePiutangBodySchema = z
  .object({
    borrower_name: z.string().min(1).max(80),
    total: z.number().int().positive(),
    opening_received: z.number().int().min(0).default(0).openapi({ description: 'Bagian yang sudah diterima SEBELUM dicatat di app (jarang, biasanya 0).' }),
    from_account_id: UuidSchema.optional(),
    from_account: z.string().optional(),
    owner: z.string().default('me'),
    due_date: DateStringSchema.optional(),
    notes: z.string().default(''),
    date: DateStringSchema.optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('CreatePiutangBody')

export const UpdatePiutangBodySchema = z
  .object({
    borrower_name: z.string().min(1).max(80).optional(),
    total: z.number().int().positive().optional(),
    remaining: z.number().int().min(0).optional().openapi({ description: 'Koreksi langsung sisa piutang (bukan penerimaan baru).' }),
    due_date: DateStringSchema.nullable().optional(),
    notes: z.string().optional(),
    owner: z.string().optional().openapi({ description: '"me", "joint", uuid member, atau nama/alias member — alihkan kepemilikan piutang (Fase 5 F5-T5).' }),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('UpdatePiutangBody')

export const ReceivePiutangBodySchema = z
  .object({
    amount: z.number().int().positive().optional(),
    amount_text: z.string().min(1).optional(),
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    date: DateStringSchema.optional(),
    note: z.string().optional(),
    allow_overpay: z.boolean().default(false),
  })
  .openapi('ReceivePiutangBody')
