// Kategori default per household (03-database.md §3.5). Dipakai oleh seed_household_categories()
// di DB dan oleh apps/web untuk fallback tampilan sebelum data household dimuat.
// SUMBER KEBENARAN tetap fungsi SQL seed_household_categories(); daftar ini harus tetap sinkron
// dengannya secara manual (tidak ada codegen dua arah DB <-> TS di v1).

export type CategoryType = 'income' | 'expense' | 'both'

export interface DefaultCategory {
  name: string
  type: CategoryType
  icon: string
  aliases: string[]
  isSystem: boolean
  systemKey?: SystemCategoryKey
}

export type SystemCategoryKey = 'transfer' | 'balance_adjustment' | 'debt_payment' | 'goal_saving' | 'piutang'

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Makanan', type: 'expense', icon: '🍔', aliases: ['makan', 'jajan', 'kuliner', 'minum', 'sayur', 'belanja dapur'], isSystem: false },
  { name: 'Transport', type: 'expense', icon: '🚗', aliases: ['bensin', 'ojek', 'grab', 'gojek', 'parkir', 'tol'], isSystem: false },
  { name: 'Kos/Sewa', type: 'expense', icon: '🏠', aliases: ['sewa', 'kontrakan', 'kos'], isSystem: false },
  { name: 'Hiburan', type: 'expense', icon: '🎬', aliases: ['nonton', 'game', 'langganan'], isSystem: false },
  { name: 'Shopping', type: 'expense', icon: '🛍️', aliases: ['belanja', 'baju'], isSystem: false },
  { name: 'Utilitas', type: 'expense', icon: '⚡', aliases: ['listrik', 'air', 'internet', 'pulsa', 'wifi'], isSystem: false },
  { name: 'Kesehatan', type: 'expense', icon: '💊', aliases: ['obat', 'dokter', 'rs'], isSystem: false },
  { name: 'Pendidikan', type: 'expense', icon: '📚', aliases: ['sekolah', 'kursus', 'buku'], isSystem: false },
  { name: 'Donasi', type: 'expense', icon: '❤️', aliases: ['sedekah', 'zakat', 'infak'], isSystem: false },
  { name: 'Lainnya', type: 'both', icon: '📦', aliases: [], isSystem: false },
  { name: 'Gaji', type: 'income', icon: '💰', aliases: ['gajian', 'salary'], isSystem: false },
  { name: 'Freelance', type: 'income', icon: '💼', aliases: ['project', 'sampingan'], isSystem: false },
  { name: 'Bisnis', type: 'income', icon: '📊', aliases: ['usaha', 'jualan'], isSystem: false },
  { name: 'Investasi', type: 'income', icon: '📈', aliases: ['dividen', 'cuan'], isSystem: false },
  { name: 'Transfer', type: 'both', icon: '🔄', aliases: [], isSystem: true, systemKey: 'transfer' },
  { name: 'Koreksi Saldo', type: 'both', icon: '⚖️', aliases: [], isSystem: true, systemKey: 'balance_adjustment' },
  { name: 'Hutang & Cicilan', type: 'expense', icon: '📋', aliases: ['cicilan', 'angsuran', 'hutang'], isSystem: true, systemKey: 'debt_payment' },
  { name: 'Tabungan & Goal', type: 'expense', icon: '🎯', aliases: ['nabung', 'tabungan'], isSystem: true, systemKey: 'goal_saving' },
  { name: 'Piutang', type: 'both', icon: '🤝', aliases: [], isSystem: true, systemKey: 'piutang' },
]

export const ACCOUNT_TYPES = ['bank', 'ewallet', 'cash', 'crypto', 'investasi', 'tabungan'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const MEMBER_ROLES = ['owner', 'member', 'viewer'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export const API_KEY_SCOPES = ['read', 'write', 'admin'] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
