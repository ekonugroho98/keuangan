import { z } from 'zod'

// Fase 1: hanya memvalidasi var yang benar-benar dipakai sekarang (health + CORS + OpenAPI servers[]),
// supaya `pnpm dev` jalan tanpa perlu seluruh secret produksi. Var lain (DATABASE_URL, SUPABASE_*,
// API_KEY_PEPPER, dst — lihat 02-monorepo.md §6.2) ditambahkan sebagai WAJIB begitu masing-masing
// dipakai nyata (Fase 3: DB & auth; Fase 6: api key).
// Prinsip tetap sama: env di-parse sekali saat boot, gagal cepat dengan pesan jelas kalau tidak valid.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  API_PUBLIC_URL: z.string().url().default('http://localhost:8787'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Fase 3: DB dan verifikasi JWT. DATABASE_URL wajib; SUPABASE_URL dan/atau SUPABASE_JWT_SECRET
  // minimal salah satu harus ada supaya verifySupabaseJwt() punya cara memverifikasi token
  // (dicek manual di bawah, bukan lewat zod, karena "salah satu dari dua" tidak linear di zod object).
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib sejak Fase 3 (koneksi ke Postgres sebagai role karaya_api).'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Fase 6: api key, idempotency, rate limit. API_KEY_PEPPER wajib sejak autentikasi api_key
  // dipakai nyata (hashApiKey di auth/api-key.ts) — tanpa ini siapa pun yang tahu key_hash di DB
  // bisa memverifikasi key (pepper mencegah itu dengan secret yang TIDAK pernah disimpan di DB).
  API_KEY_PEPPER: z.string().min(32, 'API_KEY_PEPPER wajib sejak Fase 6, minimal 32 karakter acak.'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(2000),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // Penyimpanan bukti foto struk/nota (services/storage.ts):
  // Default 'supabase' (gratis 1 GB, muat ~12.500 foto WebP ~80KB).
  // Jika sudah skala besar (>10.000 struk), tinggal ubah STORAGE_PROVIDER ke 'r2' (Cloudflare R2 10 GB gratis + $0 egress)
  // atau 'firebase' (Firebase Blaze 5 GB US region).
  STORAGE_PROVIDER: z.enum(['supabase', 'r2', 'firebase']).default('supabase'),
  R2_UPLOAD_WORKER_URL: z.string().url().optional(),
  R2_UPLOAD_TOKEN: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  // Saklar global penegakan fitur berbayar (services/entitlements.ts):
  // Default false = semua fitur terbuka (early-adopter / promo launch).
  // Ubah ke 'true' / '1' di env produksi saat mulai menegakkan pembatasan plan_tier = 'free'.
  ENFORCE_PAID_FEATURES: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  // Daftar Superadmin (services/admin.ts):
  // Default menyertakan household internal utama pemilik ('fb505774-619d-4352-be75-39598e01416b')
  // serta user ID test lokal ('00000000-0000-0000-0000-0000000000e0') agar langsung bekerja tanpa wajib
  // set env baru di Vercel, namun tetap bisa ditambah lewat SUPERADMIN_USER_IDS / SUPERADMIN_EMAILS.
  SUPERADMIN_USER_IDS: z
    .string()
    .optional()
    .default('00000000-0000-0000-0000-0000000000e0')
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean)),
  SUPERADMIN_EMAILS: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean)),
  SUPERADMIN_HOUSEHOLD_IDS: z
    .string()
    .optional()
    .default('fb505774-619d-4352-be75-39598e01416b')
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean)),
})

export type Env = z.infer<typeof EnvSchema>

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('[env] Konfigurasi environment tidak valid:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }
  if (!result.data.SUPABASE_URL && !result.data.SUPABASE_JWT_SECRET) {
    console.error('[env] Minimal salah satu dari SUPABASE_URL (JWKS) atau SUPABASE_JWT_SECRET (HS256) wajib diisi untuk verifikasi JWT.')
    process.exit(1)
  }
  return result.data
}

export const env = loadEnv()
