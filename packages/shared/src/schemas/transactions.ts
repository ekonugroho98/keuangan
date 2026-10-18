import { z } from '@hono/zod-openapi'
import { UuidSchema, DateStringSchema } from './common'
import { MemberSummarySchema } from './accounts'

export const BeneficiaryRefOutSchema = z.object({ id: UuidSchema, name: z.string(), kind: z.string() }).nullable()

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
    qty: z.number().nullable().optional(),
    unit_price: z.number().nullable().optional(),
    discount: z.number().int().nonnegative().nullable().optional(),
    normal_unit_price: z.number().nullable().optional(),
    size_value: z.number().nullable().optional(),
    size_unit: z.enum(['g', 'ml', 'pcs']).nullable().optional(),
    total_size_label: z.string().nullable().optional(),
    canonical_name: z.string().nullable().optional(),
    account: TransactionAccountRefSchema,
    to_account: TransactionAccountRefSchema,
    category: CategoryRefOutSchema,
    beneficiary: BeneficiaryRefOutSchema,
    recorded_by: z.object({ member_id: UuidSchema, display_name: z.string() }),
    receipt_url: z.string().url().nullable().optional(),
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
    beneficiary_id: UuidSchema.optional(),
    beneficiary: z.string().optional().openapi({ description: 'F-A (10-fitur-opsional-keluarga.md §3), hanya berlaku kalau feature beneficiary aktif.' }),
    recorded_by_id: UuidSchema.optional(),
    recorded_by: z.string().max(80).optional().openapi({ description: 'Nama/alias anggota keluarga yang mencatat transaksi ini (mis. "Ibu", "Ayah"). Jika kosong pada panggilan API key, otomatis mengikuti pemilik akun pembayar (atau pemilik API key untuk akun bersama).' }),
    receipt_url: z.string().url().max(1000).optional().openapi({ description: 'URL foto bukti struk/nota (mis. dari POST /v1/receipts/upload atau /v1/ai/scan-receipt).' }),
    receipt_image_base64: z.string().optional().openapi({ description: 'Opsional: base64 foto struk/nota untuk langsung diunggah dan ditempelkan sebagai receipt_url.' }),
    receipt_mime_type: z.string().optional().openapi({ description: 'Tipe MIME foto (image/webp, image/jpeg, image/png).' }),
  })
  .openapi('CreateTransactionBody')

export const BatchItemSchema = z.object({
  amount: z.number().int().positive().optional(),
  amount_text: z.string().optional(),
  qty: z.number().positive().optional(),
  discount: z.number().int().nonnegative().optional(),
  category_id: UuidSchema.optional(),
  category: z.string().optional(),
  note: z.string().optional(),
  beneficiary_id: UuidSchema.optional(),
  beneficiary: z.string().optional(),
  titipan: z.string().max(80).optional().openapi({ description: 'Nama orang yang menitip → item masuk Piutang + catatan piutang otomatis. Kata "titipan" di note atau kategori "Piutang" juga dikenali.' }),
})

export const CreateTransactionBatchBodySchema = z
  .object({
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    date: DateStringSchema.optional(),
    recorded_by_id: UuidSchema.optional(),
    recorded_by: z.string().max(80).optional().openapi({ description: 'Nama/alias anggota keluarga yang mencatat batch ini (mis. "Ibu", "Ayah").' }),
    receipt_url: z.string().url().max(1000).optional().openapi({ description: 'URL foto struk yang berlaku untuk seluruh item pada batch ini.' }),
    receipt_image_base64: z.string().optional().openapi({ description: 'Opsional: base64 foto struk untuk langsung diunggah dan ditempelkan ke seluruh item batch ini.' }),
    receipt_mime_type: z.string().optional(),
    items: z.array(BatchItemSchema).min(1).max(100),
  })
  .openapi('CreateTransactionBatchBody')

export const UpdateTransactionBodySchema = z
  .object({
    amount: z.number().int().positive().max(100_000_000_000).optional(),
    amount_text: z.string().min(1).optional(),
    type: z.enum(['income', 'expense']).optional(),
    account_id: UuidSchema.optional(),
    account: z.string().optional(),
    category_id: UuidSchema.optional(),
    category: z.string().optional(),
    date: DateStringSchema.optional(),
    note: z.string().max(500).optional(),
    qty: z.number().positive().optional(),
    discount: z.number().int().nonnegative().optional(),
    beneficiary_id: UuidSchema.nullable().optional(),
    beneficiary: z.string().optional().openapi({ description: 'null eksplisit pada beneficiary_id = kembali ke bersama.' }),
    recorded_by_id: UuidSchema.optional(),
    recorded_by: z.string().max(80).optional().openapi({ description: 'Ubah atribut anggota keluarga pencatat transaksi ini (mis. "Ibu", "Ayah").' }),
    receipt_url: z.string().url().max(1000).nullable().optional().openapi({ description: 'URL bukti struk/nota (kirim null untuk menghapus lampiran struk).' }),
    receipt_image_base64: z.string().optional().openapi({ description: 'Opsional: base64 foto bukti struk baru untuk langsung diunggah.' }),
    receipt_mime_type: z.string().optional(),
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
    recorded_by_id: UuidSchema.optional(),
    recorded_by: z.string().max(80).optional().openapi({ description: 'Nama/alias anggota keluarga yang mencatat transfer ini.' }),
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
  beneficiary_id: UuidSchema.optional(),
  beneficiary: z.string().optional().openapi({ description: '"none" = hanya transaksi bersama (beneficiary_id null). Hanya berlaku kalau feature beneficiary aktif.' }),
  attribution: z.enum(['owner', 'recorded_by']).default('owner'),
  q: z.string().optional(),
  min_amount: z.coerce.number().int().optional(),
  max_amount: z.coerce.number().int().optional(),
  include_deleted: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
})
