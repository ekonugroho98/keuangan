// Kelompok produk generik lintas household (enum product_group di DB, migrasi 0024). Dipetakan ke
// kategori household lewat daftar kandidat nama/alias — urutan = prioritas.
export type ProductGroup = 'food' | 'household' | 'health' | 'utility' | 'transport' | 'education' | 'entertainment' | 'other'

export const PRODUCT_GROUPS: ProductGroup[] = ['food', 'household', 'health', 'utility', 'transport', 'education', 'entertainment', 'other']

export const GROUP_CANDIDATES: Record<ProductGroup, string[]> = {
  food: ['makanan', 'makanan & minuman', 'makan', 'dapur'],
  household: ['rumah tangga', 'kebersihan', 'shopping', 'belanja'],
  health: ['kesehatan'],
  utility: ['utilitas', 'tagihan'],
  transport: ['transport', 'transportasi'],
  education: ['pendidikan'],
  entertainment: ['hiburan'],
  other: ['lainnya'],
}

export const GROUP_LABEL_ID: Record<ProductGroup, string> = {
  food: 'makanan, minuman, bahan masak, snack',
  household: 'sabun, deterjen, tisu, popok, pembalut, alat rumah tangga, pakaian',
  health: 'obat, vitamin, masker, alat kesehatan',
  utility: 'pulsa, paket data, token listrik, tagihan',
  transport: 'bensin, parkir, tol, ongkos perjalanan',
  education: 'buku, alat tulis, perlengkapan sekolah',
  entertainment: 'hiburan, mainan, langganan streaming',
  other: 'tidak termasuk kelompok lain / tidak yakin',
}

export function isProductGroup(v: unknown): v is ProductGroup {
  return typeof v === 'string' && (PRODUCT_GROUPS as string[]).includes(v)
}
