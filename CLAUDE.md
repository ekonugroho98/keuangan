# CLAUDE.md — Karaya Finance (karaya-keuangan)

Platform keuangan rumah tangga, sedang direvamp dari aplikasi pencatatan pribadi. Monorepo pnpm: `apps/web` (React + Vite, UI), `apps/api` (Hono, backend baru), `packages/shared` (tipe/konstanta/format bersama), `supabase/` (migrations + seed). Bahasa UI dan komentar kode: Indonesia. Nama identifier: Inggris.

Repo: `github.com/ekonugroho98/keuangan`, branch `main`. Supabase project ref: `twcrflhvxzatpfrjmqzi` (nama "keuangan", region Singapore, free tier).

## Status project: revamp sedang berjalan

**Aturan wajib saat revamp berjalan:**
1. Sesi baru: baca `docs/spec/PROGRESS.md` dulu (fase aktif + tugas selesai), lalu file spec yang relevan dengan fase aktif. Jangan mulai dari nol, jangan melompat fase.
2. Spec (`docs/spec/00` s.d. `09`) adalah sumber kebenaran. Kalau implementasi menemukan spec salah atau tidak lengkap, perbaiki spec dulu (tambah baris di tabel riwayat perubahan di bagian atas file spec terkait), baru ubah kode.
3. Setiap tugas selesai, update `docs/spec/PROGRESS.md` (status, tanggal, hasil verifikasi).
4. Jangan kerjakan fase berikutnya sebelum kriteria selesai fase aktif terpenuhi dan terverifikasi dengan perintah nyata (bukan hanya baca kode).

Fase yang sudah selesai sejauh ini: **F0** (audit + wipe DB produksi) dan **F2** (skema database baru lengkap, teruji, dan live di produksi — lihat `docs/spec/PROGRESS.md` untuk detail). **F1** (scaffold monorepo ini) sedang berjalan.

## Perintah

```bash
pnpm install              # sekali, dari root
pnpm dev                  # web (:5173) + api (:8787) sekaligus
pnpm --filter @karaya/web dev
pnpm --filter @karaya/api dev
pnpm lint / typecheck / test / build   # dari root, jalan di semua paket (pnpm -r)

# Database (butuh Docker untuk supabase start; CLI harus ter-link ke twcrflhvxzatpfrjmqzi)
supabase start             # Postgres lokal + Auth + Studio
supabase db reset          # jalankan supabase/migrations/*.sql + supabase/seed.sql
psql "$DATABASE_URL" -f supabase/migrations/<file>.sql   # apply satu migrasi manual kalau perlu

# Edge function LAMA (masih dipakai frontend sampai Fase 4 cutover; akan dihapus)
supabase functions deploy <nama-function>
supabase functions list
```

Tooling: pnpm workspaces, ESLint 9 flat config (`eslint.config.js`, satu file untuk semua paket), Prettier, Vitest (`vitest.workspace.ts`), TypeScript (`tsconfig.base.json` + per-paket). `apps/web` masih mayoritas `.jsx` tanpa type checking ketat (`allowJs`, ADR-14 di spec) — file baru ditulis `.tsx`, file lama dibiarkan sampai disentuh signifikan.

## Environment

- `apps/web/.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (auth saja), `VITE_API_BASE_URL` (apps/api, Fase 4+), `VITE_PRICES_API_BASE_URL` (karaya-api, harga emas/saham).
- `apps/api/.env.local` — Fase 1 cukup `API_PUBLIC_URL`, `CORS_ORIGINS`, `PORT`. Var untuk DB/auth/webhook ditambahkan bertahap sesuai fase (lihat komentar di `apps/api/.env.example`).
- Jangan pernah commit `.env`/`.env.local`, anon key, service role key, access token Supabase, `FUNCTION_SECRET`, atau password database ke file yang di-commit atau ke CLAUDE.md.

## Struktur kode (reality Fase 1 — lihat `docs/spec/02-monorepo.md` untuk target lengkap)

```
apps/web/src/
  App.jsx                 routing manual: landing / dashboard / reset-password berdasarkan session
  pages/                  LandingPage, Dashboard, ResetPasswordPage
  components/dashboard/   views per menu, Sidebar, AddTransactionModal, AddAccountModal, PricingModal
  components/landing/     section landing page + modal auth
  components/ui/          komponen generik
  hooks/                  use<Entitas>.js — MASIH akses Supabase langsung / edge function lama
                          (belum dipindah ke apps/api; itu pekerjaan Fase 4)
  services/               api.js (callEdge), goldPrice.js, stockPrice.js (→ karaya-api)
  constants/, i18n/, config/, utils/, lib/supabase.js

apps/api/src/
  app.ts                  Hono app: CORS, error handler, /v1/health, /v1/openapi.json, /v1/docs
  env.ts                  validasi env dengan zod, fail-fast saat boot
  server.ts               entry dev lokal (@hono/node-server)
  routes/health.ts         satu-satunya route nyata di Fase 1
  routes/, services/, db/, auth/, middleware/   kerangka kosong, diisi Fase 3+
api/index.ts               entry Vercel (hono/vercel)

packages/shared/src/
  constants/categories.ts  kategori default (harus sinkron manual dengan seed_household_categories() di DB)
  format/index.ts          fmtRp, fmtDate, toLocalDateStr, parseAmountId (+ test)
  errors.ts                ErrorCode union + ApiError + peta HTTP status (sumber: 05-api.md §7)
  schemas/, api-client/     stub kosong, diisi Fase 3–4

supabase/
  migrations/*.sql          SUMBER KEBENARAN skema (16 tabel domain, api_keys/idempotency/rate-limit/
                             audit_log, 7 view saldo, 78 fungsi plpgsql, 38 RLS policy, 4 cron job).
                             SUDAH diterapkan ke produksi — lihat docs/spec/PROGRESS.md.
  seed.sql                   household demo "Keluarga Eko"+"Rina" untuk dev lokal. JANGAN jalankan
                             di produksi.
  functions/                 edge function LAMA (transactions, financial-ops, auto-recurrings, ai-chat,
                             payment-webhook, update-subscription) — masih dipakai apps/web sampai
                             Fase 4, dihapus setelahnya.

docs/
  spec/                     spesifikasi lengkap (00–09) + PROGRESS.md
  reference/                dump skema lama & baru untuk audit, legacy-sql/ (SQL yang sudah digantikan)
  panduan-assets/            screenshot untuk PANDUAN.md
```

**Penting**: `apps/web` di Fase 1 **belum** memanggil `apps/api` sama sekali — masih 100% berjalan di atas edge function Supabase lama dan `supabase.from(...)` langsung, identik perilakunya dengan sebelum monorepo. Database di baliknya **sudah** skema baru (household, dll), tapi edge function lama menulis ke tabel yang **sudah tidak ada lagi** sejak F2 — artinya fitur mutasi di `apps/web` (tambah transaksi dkk.) **tidak akan berfungsi** sampai Fase 3 (apps/api) dan Fase 4 (cutover) selesai. Ini adalah trade-off yang disengaja dari keputusan greenfield (ADR-19 di `docs/spec/00-ringkasan.md`): tidak ada migrasi data lama untuk dilindungi, jadi urutan fase dipercepat dengan konsekuensi app lama nonfungsional sementara.

## Konvensi

- **Uang**: BIGINT rupiah, tidak ada desimal/float. `packages/shared` → `fmtRp()`. DB: semua kolom nominal `BIGINT`.
- **Tanggal transaksi**: `DATE` di DB, string lokal `YYYY-MM-DD` di kode via `toLocalDateStr()` (bukan `toISOString().slice(0,10)`, itu bug zona waktu).
- **Nominal bahasa manusia** ("45rb", "1,2 juta"): `parseAmountId()` di `packages/shared/src/format`.
- **Error API**: `ApiError` dari `packages/shared/src/errors.ts`, code dari `ERROR_CODES`. Jangan buat code baru tanpa menambah ke `docs/spec/05-api.md` §7 dan ke union ini sekaligus.
- **i18n** (apps/web): semua teks lewat `t("key")` dari `LanguageContext`, 6 bahasa di `translations.js`.
- **Styling** (apps/web): inline style + CSS variables, tidak ada Tailwind/CSS modules.

## Database (lihat `docs/spec/03-database.md` untuk desain lengkap)

Skema household: `households` → `household_members` → `accounts`/`transactions`/dst, semua dengan `household_id`. Saldo akun **derived** dari transaksi (`v_account_balances`, `account_balance()`), bukan kolom yang di-update. Semua mutasi multi-tabel lewat fungsi plpgsql atomik (`post_transaction`, `post_transfer`, `pay_debt`, dst — daftar lengkap di `03-database.md` §8.2), dipanggil nanti oleh `apps/api` (Fase 3), **bukan** ditulis ulang di application layer.

RLS aktif di semua tabel. Role `karaya_api` dipakai backend untuk `SET LOCAL ROLE authenticated` + klaim JWT per request (lihat `03-database.md` §7.4) — jangan pernah pakai `service_role` untuk jalur data domain.

## Hal yang sering menjebak

1. **Supabase free tier pause** setelah ~7 hari tanpa aktivitas. Gejala: REST 503, auth 521. Solusi: Resume di dashboard, tunggu 1–3 menit. Setelah pg_cron aktif (sudah, 4 job terjadwal) ini jarang terjadi.
2. **Tabel lama sudah tidak ada.** Kalau mencari `accounts.balance`, `transactions.account_name`, `transactions.category` (TEXT) — itu skema LAMA, sudah di-drop total saat wipe produksi (lihat PROGRESS.md). Skema sekarang pakai FK (`account_id`, `category_id`) dan saldo derived.
3. **Edge function lama (`supabase/functions/`) menulis ke tabel yang sudah tidak ada** → akan error di produksi kalau dipanggil. Jangan andalkan sampai Fase 3/4 selesai.
4. **`.env` per app**, bukan satu `.env` di root lagi. `apps/web/.env` untuk frontend, `apps/api/.env.local` untuk backend.
5. **`dist_*/`** folder snapshot build lama sudah dihapus (Fase 1 cleanup). Kalau menemukan referensi ke folder itu di dokumen lama, itu sudah basi.
6. **Password database dan role `karaya_api`** pernah lewat beberapa kali di riwayat sesi kerja — jangan pernah menaruhnya di file yang di-commit; simpan di secret manager saat Fase 3 benar-benar menyambungkan `apps/api` ke DB.

## Project terkait

- `../karaya-api` — API harga emas dan saham IDX (Vercel serverless, repo terpisah, tidak berubah). Dikonsumsi `apps/web/src/services/goldPrice.js` dan `stockPrice.js` lewat `VITE_PRICES_API_BASE_URL`.
- Hermes Agent (konsumen API `/v1` untuk AI agent) — lihat `docs/spec/06-agent-integration.md`.

## Git

- Commit message Bahasa Indonesia, prefix conventional: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- Jangan commit `.env`/`.env.local`, `node_modules`, `dist`, `.vercel/`, `supabase/.temp/`, `backups/` (sudah di `.gitignore`).
- Push hanya kalau diminta.
