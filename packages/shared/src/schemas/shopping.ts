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
    cheapest: z
      .object({
        merchant: z.string(),
        price: z.number(),
        size: z.string().nullable(),
        per_unit_price: z.number(),
        compare_basis: z.string(),
        last_date: z.string(),
        stores: z.number(),
      })
      .nullable()
      .optional()
      .openapi({ description: 'Toko termurah dari riwayat struk household (perbandingan per satuan). Hanya untuk status needed.' }),
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
  discount: z.number().int().nonnegative().optional().openapi({ description: 'Total potongan diskon baris struk ini (Rp). amount tetap harga bersih yang dibayar setelah diskon.' }),
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
    recorded_by_id: UuidSchema.optional(),
    recorded_by: z.string().max(80).optional().openapi({ description: 'Nama/alias anggota keluarga yang mencatat struk ini (mis. "Ibu", "Ayah"). Jika kosong, otomatis mengikuti pemilik akun pembayar.' }),
    receipt_url: z.string().url().max(1000).optional().openapi({ description: 'URL foto struk yang akan ditempelkan ke seluruh transaksi hasil ingest ini.' }),
    receipt_image_base64: z.string().optional().openapi({ description: 'Opsional: base64 foto struk (WebP/JPEG/PNG) untuk langsung diunggah ke storage dan ditempelkan ke seluruh transaksi struk ini.' }),
    receipt_mime_type: z.string().optional().openapi({ description: 'Tipe MIME foto struk (image/webp, image/jpeg, image/png).' }),
    items: z.array(ReceiptItemSchema).min(1).max(100),
    total: z.number().int().positive().optional().openapi({ description: 'Kalau dikirim, divalidasi sum(items.amount) === total.' }),
    ref_no: z.string().optional(),
    shopping: z.boolean().default(true).openapi({ description: 'Coret item yang cocok di daftar belanja.' }),
    pantry: z.boolean().default(true).openapi({ description: 'Tambah stok untuk item yang cocok di pantry.' }),
  })
  .openapi('IngestReceiptBody')

export const UploadReceiptImageBodySchema = z
  .object({
    image_base64: z.string().min(16).openapi({ description: 'Base64 foto struk/nota (disarankan WebP max 1080px, <= 5 MB).' }),
    mime_type: z.string().optional().openapi({ description: 'image/webp | image/jpeg | image/png (otomatis dideteksi dari magic bytes jika kosong).' }),
  })
  .openapi('UploadReceiptImageBody')

export const UploadReceiptImageResponseSchema = z
  .object({
    receipt_url: z.string().url(),
    provider: z.enum(['supabase', 'r2', 'firebase']),
    size_bytes: z.number().int(),
    mime_type: z.string(),
  })
  .openapi('UploadReceiptImageResponse')

// ── Perbandingan harga antar toko (10-fitur-opsional-keluarga.md §6.8) ──────────────────────
export const ComparePricesQuerySchema = z.object({
  q: z.string().optional().openapi({ description: 'Nama produk, mis. "sabun lifebuoy", "minyak goreng". Kosongkan untuk katalog semua produk yang tercatat.' }),
  days: z.coerce.number().int().min(1).max(730).default(180),
})

export const StorePriceSchema = z.object({
  merchant: z.string(),
  last_date: z.string(),
  price: z.number().openapi({ description: 'Harga satu kemasan terakhir (setelah diskon)' }),
  normal_price: z.number().nullable().optional().openapi({ description: 'Harga satu kemasan asli sebelum diskon (null bila tidak diskon)' }),
  discount: z.number().optional().openapi({ description: 'Potongan diskon per kemasan pada transaksi terakhir (Rp, 0 bila tidak diskon)' }),
  promo_count: z.number().optional().openapi({ description: 'Berapa kali toko ini memberi diskon pada riwayat produk ini' }),
  total_discount_saved: z.number().optional().openapi({ description: 'Total rupiah diskon yang dihemat untuk produk ini di toko ini' }),
  size: z.string().nullable(),
  per_unit_price: z.number().openapi({ description: 'Harga terakhir per satuan banding (compare_basis)' }),
  lowest_per_unit_price: z.number(),
  observations: z.number(),
})

export const ProductComparisonSchema = z
  .object({
    product_name: z.string(),
    unit: z.enum(['g', 'ml', 'pcs']).nullable(),
    compare_basis: z.string().openapi({ description: '"per 100 g" | "per 100 ml" | "per pcs" | "per kemasan"' }),
    stores: z.array(StorePriceSchema).openapi({ description: 'Urut dari termurah per satuan' }),
    cheapest: z.object({ merchant: z.string(), per_unit_price: z.number(), last_date: z.string() }).nullable(),
    savings_pct: z.number().nullable(),
    summary: z.string().openapi({ description: 'Ringkasan siap kirim (Bahasa Indonesia)' }),
  })
  .openapi('ProductComparison')

export const ComparePricesResponseSchema = z
  .object({ query: z.string(), days: z.number(), products: z.array(ProductComparisonSchema) })
  .openapi('ComparePricesResponse')

export const ProductAliasBodySchema = z
  .object({
    item: z.string().min(2).openapi({ description: 'Nama item seperti di struk, mis. "LFBY BS 85G"' }),
    same_as: z.string().min(2).openapi({ description: 'Nama produk atau nama item struk lain yang sama barangnya, mis. "LIFEBUOY SABUN 85GR"' }),
  })
  .openapi('ProductAliasBody')
