import { z } from '@hono/zod-openapi'
import { UuidSchema, DateStringSchema } from './common'

// ── F-D belanja (10-fitur-opsional-keluarga.md §6) ────────────────────────────────────────────
export const ShoppingStatusSchema = z.enum(['needed', 'bought', 'cancelled'])

export const ShoppingItemSchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    qty_text: z.string().nullable(),
    notes: z.string(),
    status: ShoppingStatusSchema,
    source: z.enum(['manual', 'suggested', 'receipt']),
    bought_transaction_id: UuidSchema.nullable(),
  })
  .openapi('ShoppingItem')

export const CreateShoppingItemBodySchema = z
  .object({ name: z.string().min(1).max(80), qty_text: z.string().optional(), notes: z.string().default('') })
  .openapi('CreateShoppingItemBody')

export const UpdateShoppingItemBodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    qty_text: z.string().nullable().optional(),
    notes: z.string().optional(),
    status: ShoppingStatusSchema.optional(),
    transaction_id: UuidSchema.optional().openapi({ description: 'Kalau status="bought", kaitkan ke transaksi yang sudah dicatat.' }),
  })
  .openapi('UpdateShoppingItemBody')

// ── F-D pantry (10-fitur-opsional-keluarga.md §6) ─────────────────────────────────────────────
export const PantryLocationSchema = z.enum(['fridge', 'freezer', 'shelf', 'other'])
export const PantryReasonSchema = z.enum(['purchase', 'consume', 'adjust', 'expired'])

/** Nama Indonesia -> enum DB, dipakai di query ?location= dan body POST/PATCH (10-fitur-opsional-keluarga.md §6.4). */
export const PANTRY_LOCATION_ALIASES: Record<string, 'fridge' | 'freezer' | 'shelf' | 'other'> = {
  fridge: 'fridge', kulkas: 'fridge',
  freezer: 'freezer',
  shelf: 'shelf', lemari: 'shelf', rak: 'shelf',
  other: 'other', lainnya: 'other',
}

export const PantryItemSchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    unit: z.string(),
    qty: z.number(),
    min_qty: z.number().nullable(),
    location: PantryLocationSchema,
    category: z.string().nullable(),
    expires_at: DateStringSchema.nullable(),
    expires_estimated: z.boolean(),
    aliases: z.array(z.string()),
  })
  .openapi('PantryItem')

export const CreatePantryItemBodySchema = z
  .object({
    name: z.string().min(1).max(80),
    unit: z.string().default('pcs'),
    qty: z.number().min(0).default(0),
    min_qty: z.number().min(0).optional(),
    location: z.string().optional().openapi({ description: 'kulkas/freezer/lemari/lainnya atau fridge/freezer/shelf/other.' }),
    category: z.string().optional(),
    expires_at: DateStringSchema.optional(),
    expires_estimated: z.boolean().default(false),
    aliases: z.array(z.string()).default([]),
  })
  .openapi('CreatePantryItemBody')

export const UpdatePantryItemBodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    unit: z.string().optional(),
    min_qty: z.number().min(0).nullable().optional(),
    location: z.string().optional(),
    category: z.string().nullable().optional(),
    expires_at: DateStringSchema.nullable().optional(),
    expires_estimated: z.boolean().optional(),
    aliases: z.array(z.string()).optional(),
  })
  .openapi('UpdatePantryItemBody')

export const PantryMovementBodySchema = z
  .object({ delta: z.number().refine((v) => v !== 0, 'delta tidak boleh 0'), reason: PantryReasonSchema, note: z.string().default('') })
  .openapi('PantryMovementBody')

// ── F-D alur struk (10-fitur-opsional-keluarga.md §6.3) ───────────────────────────────────────
export const ReceiptItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().positive().default(1),
  amount: z.number().int().positive(),
  category_id: UuidSchema.optional(),
  category: z.string().optional(),
  for: z.string().optional().openapi({ description: 'Alias beneficiary untuk item ini (F-A), diteruskan apa adanya.' }),
  titipan: z.string().max(80).optional().openapi({ description: 'Nama orang yang menitip (barang dibelikan untuk orang lain yang akan mengganti uangnya). Item masuk kategori Piutang + dibuatkan catatan piutang otomatis. Kata "titipan" di name juga dikenali.' }),
})

export const IngestReceiptBodySchema = z
  .object({
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    date: DateStringSchema.optional(),
    merchant: z.string().optional(),
    items: z.array(ReceiptItemSchema).min(1).max(100),
    total: z.number().int().positive().optional().openapi({ description: 'Kalau dikirim, divalidasi sum(items.amount) === total.' }),
    ref_no: z.string().optional(),
    shopping: z.boolean().default(true).openapi({ description: 'Coret item yang cocok di daftar belanja.' }),
    pantry: z.boolean().default(true).openapi({ description: 'Tambah stok untuk item yang cocok di pantry.' }),
  })
  .openapi('IngestReceiptBody')
