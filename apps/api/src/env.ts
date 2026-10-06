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
