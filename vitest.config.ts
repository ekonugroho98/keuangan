import { defineConfig } from 'vitest/config'

// Opsi ROOT, berlaku untuk `pnpm test` (vitest.workspace.ts). `fileParallelism` adalah opsi level
// root — menaruhnya di apps/api/vitest.config.ts saja TIDAK berlaku saat dijalankan lewat workspace
// (ditemukan 2026-10-07: test F-D masih kebagian race dengan features-beneficiaries.test.ts padahal
// apps/api sudah set fileParallelism:false). Semua test integrasi apps/api share satu Postgres
// lokal dan household seed yang sama, jadi file test HARUS berjalan berurutan.
export default defineConfig({
  test: { fileParallelism: false },
})
