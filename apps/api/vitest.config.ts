import { defineConfig } from 'vitest/config'

// Env minimal supaya env.ts tidak process.exit(1) saat module di-import oleh test.
// Integration test yang BUTUH koneksi DB nyata mengecek process.env.DATABASE_URL sendiri
// dan di-skip (describe.skipIf) kalau tidak tersambung ke DB lokal sungguhan (02-monorepo.md §4).
process.env.API_PUBLIC_URL ??= 'http://localhost:8787'
process.env.CORS_ORIGINS ??= 'http://localhost:5173'
process.env.DATABASE_URL ??= 'postgres://karaya_api:localdevpassword@localhost:54329/postgres'
process.env.SUPABASE_JWT_SECRET ??= 'local-test-secret-do-not-use-in-production-min32chars'
process.env.API_KEY_PEPPER ??= 'local-test-pepper-do-not-use-in-production-min32'

export default defineConfig({
  test: {
    environment: 'node',
    // Semua test integrasi share SATU Postgres lokal persisten (bukan DB terisolasi per file) dan
    // beberapa file memutasi household seed "Keluarga Eko" yang SAMA (household.test.ts,
    // transactions.test.ts, features-beneficiaries.test.ts, reports.test.ts). Default vitest 2
    // menjalankan file test SECARA PARALEL (thread/proses beda) — ditemukan race nyata saat
    // menambah reports.test.ts (10-fitur-opsional-keluarga.md F-B): totals.expense dari dua request
    // HTTP berurutan beda angka karena file lain menyisipkan/menghapus transaksi di antaranya.
    // `fileParallelism: false` menjalankan file test berurutan (lebih lambat, tapi benar) — satu-
    // satunya cara aman tanpa membangun DB terisolasi per file test.
    fileParallelism: false,
  },
})
