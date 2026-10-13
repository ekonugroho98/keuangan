# PROGRESS

Fase aktif: F6-T1..T5 dan F6-T7 selesai dan terverifikasi. Migrasi `00000000000019` (api keys dkk.) sudah diterapkan ke produksi. **F6-T6 (webhook Midtrans) DIBATALKAN atas instruksi pemilik produk 2026-10-06**: project ini tidak pernah punya pembayaran sungguhan, fitur subscription/Midtrans dihapus total (kode, edge function lama, UI pricing) — lihat entri "Fase 6 — pembatalan subscription/Midtrans" di bawah. **Migrasi `00000000000020_drop_subscriptions.sql` (hapus tabel `subscriptions` + fungsi `upsert_subscription`) sudah diterapkan & DIVERIFIKASI DI PRODUKSI** (pemilik produk menjalankan lewat SQL Editor Supabase dashboard; `to_regclass('public.subscriptions')` → null, `pg_proc` untuk `upsert_subscription` → 0 baris). Fase 6 (F6-T1..T5, T7) kini selesai dan deployed penuh; F6-T6 dibatalkan permanen. F3-T9, F4-T7 (deploy Vercel) belum dikerjakan. **2026-10-07: spec `10-fitur-opsional-keluarga.md` ditulis (F-0 feature flag, F-A beneficiary, F-B laporan bulanan, F-C rekonsiliasi bank, F-D belanja & stok) — SPEC SAJA, belum ada implementasi dan belum diputuskan mulai dari mana; lihat §"Spec fitur opsional" di bawah.**
Terakhir diperbarui: 2026-10-08

## Sedang dikerjakan
(kosong — F0, F1, F2, F3-T1..T8, F4-T1..T6, F5-T1..T5 selesai dan terverifikasi)

## Status tugas
| Tugas | Status | Tanggal | Catatan / hasil verifikasi |
|---|---|---|---|
| F0-T1 | done | 2026-10-04 | `supabase init` dijalankan; `supabase/config.toml` dibuat, major_version 17 cocok produksi |
| F0-T2 | done (bentuk lain) | 2026-10-04 | Skema live lama di `docs/reference/legacy-schema-live-2026-10-04.sql` (sebelum wipe) |
| F0-T3 | done | 2026-10-04 | Q-20 terjawab: `transactions.account_id` TIDAK ada, `goals.deadline` ADA, CHECK type sudah ada transfer |
| F0-T4 | done | 2026-10-04 | `backups/pre-wipe-schema.sql`, `backups/pre-wipe-data.sql` |
| F0-T5 | done | 2026-10-04 | File ini |
| F0-T6 | done (bentuk lain) | 2026-10-04 | Verifikasi dilakukan manual via psql (lihat log di bawah), bukan file `verify_schema.sql` terpisah — **tugas lanjutan**: ekstrak jadi skrip reusable `supabase/scripts/verify_schema.sql` |
| **F2 (revisi greenfield, lihat `08` blok "Revisi 2026-10-04")** | **DONE & DEPLOYED** | **2026-10-04** | **Lihat detail lengkap di bawah** |
| **F1-T1 … F1-T7 (monorepo)** | **DONE** | **2026-10-04** | **Lihat detail lengkap di bawah.** Dikerjakan setelah F2 (DB duluan karena user minta "sampe buat tabel di supabase" dulu) |
| **F3-T1 … F3-T8 (apps/api)** | **DONE** | **2026-10-04** | **Lihat detail lengkap di bawah.** |
| F3-T9 (deploy Vercel) | **DONE** | 2026-10-06 | `karaya-api-v1.vercel.app` live (lihat Fase 6 deploy di bawah) — baris ini basi, dikoreksi 2026-10-08 |
| **F4-T1 … F4-T6 (frontend cutover)** | **DONE** | **2026-10-04** | **Lihat detail lengkap di bawah.** |
| F4-T7 (deploy web ke api produksi) | **DONE** | 2026-10-06 | `keuangan-eta.vercel.app` live, `VITE_API_BASE_URL` arah ke `karaya-api-v1` — baris ini basi, dikoreksi 2026-10-08 |
| F4-T8 (contract: drop kolom legacy) | n/a | | Tidak berlaku — greenfield (ADR-19), tidak ada kolom legacy yang perlu di-drop |
| **F5-T1, F5-T2, F5-T7 (backend: undangan, anggota, merge, scope)** | **DONE** | **2026-10-04** | **Lihat detail lengkap di bawah.** F5-T2 (accounts owner/visibility, summary scope, transactions filter) ternyata sudah dibangun sejak Fase 3 — hanya diverifikasi ulang. F5-T7 (pg_cron) juga sudah aktif sejak F2. |
| **F5-T3 … F5-T5 (frontend: household UI, owner/visibility, scope)** | **DONE** | **2026-10-04** | **Lihat detail lengkap di bawah.** |
| F5-T6 (MigrationReviewBanner, i18n) | n/a (banner) / deferred (i18n) | 2026-10-04 | `needs_review` secara eksplisit "tidak dipakai di jalur greenfield" (komentar kolom di `03-database.md`/migrasi 0003) — tidak mungkin bernilai true di project ini (ADR-19), banner tidak relevan. i18n 6 bahasa untuk string UI household baru belum dikerjakan (konsisten dengan `OnboardingHousehold.jsx` Fase 4 yang juga masih hardcode Bahasa Indonesia) — dicatat sebagai utang teknis, bukan diabaikan. |
| **F6-T1, F6-T2, F6-T3 (api key, idempotency, rate limit, audit log)** | **DONE, deployed produksi** | **2026-10-06** | **Lihat detail lengkap di bawah.** Migrasi `00000000000019` diterapkan & diverifikasi di produksi (`prosecdef=t`). |
| **F6-T4 (tool manifest Hermes, resolver UUID fix)** | **DONE** | **2026-10-06** | 22 tool di `tools/registry.ts`, `GET /v1/tools/hermes.json`. OpenAPI lengkap (`operationId`/`x-karaya-scope`/contoh) sengaja dilewati — lihat detail di bawah. |
| **F6-T5 (ai/chat pakai tool registry)** | **DONE** | **2026-10-06** | `ai/chat.ts` pakai `TOOLS` registry + `allow_write` di `AiChatBodySchema`. |
| F6-T6 (webhook Midtrans) | **DIBATALKAN** | **2026-10-06** | Project tidak pernah punya pembayaran sungguhan. Semua kode/migrasi/tabel DB/edge function/UI terkait subscription dihapus total — lihat entri khusus di bawah, bukan sekadar "tidak dikerjakan". |
| **F6-T7 (bersihkan docs)** | **DONE** | **2026-10-06** | `API_DOCS.md` dihapus, README arahkan ke `/v1/docs`, `docs/hermes/SYSTEM_PROMPT.md` dibuat. |
| F7-T1 … F7-T5 (Hermes) | **sebagian DONE** | 2026-10-08 | Tool registry (32 tool) + skill VPS `karaya-finance-api`/`groceries-shopping` untuk F-A/F-B/F-D sudah jalan. Scope asli F7 (kalau ada tugas lain di luar ini) tidak dirinci di sini — lihat riwayat chat kalau perlu detail. |
| **Spec `10-fitur-opsional-keluarga.md` (F-0, F-A, F-B, F-C, F-D)** | **spec ditulis, implementasi belum** | **2026-10-07** | Spec saja atas permintaan pemilik produk ("buat spec-nya dulu aja"). Implementasi menunggu keputusan urutan + jawaban Q-F1..Q-F10 di file itu (Q-F4 memblokir F-C: butuh file contoh ekspor mutasi bank asli). |
| **F-0 + F-A + F-B + F-D (belanja & pantry)** | **backend DONE, teruji lokal** | **2026-10-07** | Migrasi `00000000000021`, `00000000000022` diterapkan ke DB lokal (`supabase start`, fresh volume, bukan container `karaya-test-pg` lama). 37 test baru (12+3 di `features-beneficiaries.test.ts`, 4 di `reports.test.ts`, 13+4 di `shopping-pantry.test.ts`, 1 regresi batch) (`features-beneficiaries.test.ts` 12, `reports.test.ts` 4, regresi batch di `transactions.test.ts` 1) — total 67/67 lulus (2× berturut, termasuk tanpa reset), `pnpm lint` 0 error, `pnpm typecheck` bersih. **2 bug nyata ditemukan & diperbaiki**: (1) `beneficiaries.member_id` FK tanpa `on delete set null` membuat `remove_member()` gagal FK violation begitu household punya beneficiary `kind=member`; (2) postgres.js men-dobel-encode `${JSON.stringify(x)}::jsonb` jadi jsonb STRING SCALAR — menimpa `post_transactions_batch` dan `updateHousehold`; diperbaiki pakai `tx.json(value)`. **Update 2026-10-08**: frontend, tool Hermes, dan skill VPS semua sudah menyusul selesai (lihat 3 entri di bawah) — commit `5b02853`/`b019b99`/`d1b2641`, live di produksi. |

## F2 — Detail lengkap apa yang sudah dibangun dan diuji

### File yang dibuat
```
supabase/config.toml                                   — supabase init, linked ke twcrflhvxzatpfrjmqzi
supabase/migrations/00000000000001_extensions_enums.sql — pgcrypto, pg_trgm, unaccent, 10 enum, immutable_unaccent wrapper
supabase/migrations/00000000000002_households.sql       — households, household_members, household_invitations
supabase/migrations/00000000000003_domain_tables.sql    — categories, accounts, debts, goals, piutang, recurring_transactions,
                                                            transactions, debt_payments, goal_contributions, piutang_receipts,
                                                            budgets, split_bills, split_bill_members, investments,
                                                            user_settings, subscriptions (16 tabel)
supabase/migrations/00000000000004_api_infra.sql         — api_keys, idempotency_keys, rate_limit_counters, audit_log, migration_issues
supabase/migrations/00000000000005_views.sql             — helper RLS (current_member_ids dst, DIPINDAH ke sini dari rencana semula
                                                            di 0006 karena views butuh can_view_account), v_account_balances,
                                                            account_balance(), v_debts, v_goals, v_goals_full, v_piutang,
                                                            v_transactions, today_in_tz()
supabase/migrations/00000000000006_functions_household.sql — seed_household_categories, create_household, invitations
                                                              (create/preview/accept), remove_member, change_member_role,
                                                              merge_household_into
supabase/migrations/00000000000007_functions_transactions.sql — assert_actor, post_transaction, post_transactions_batch,
                                                                  post_transfer, update_transaction, delete_transaction,
                                                                  restore_transaction, adjust_balance
supabase/migrations/00000000000008_functions_debts_goals_piutang.sql — pay_debt, topup_goal, lend_piutang, receive_piutang,
                                                                        delete_account, delete_category
supabase/migrations/00000000000009_functions_resolve_recurring.sql — norm_text, resolve_account, resolve_category,
                                                                      resolve_member, next_recurring_date, run_due_recurrings,
                                                                      bump_rate_limit
supabase/migrations/00000000000010_rls.sql               — RLS enable + policy semua tabel, role karaya_api + grant,
                                                             v_api_keys (lihat catatan keamanan di bawah)
supabase/migrations/00000000000011_cron.sql              — 4 jadwal pg_cron (run_due_recurrings harian, cleanup idempotency/
                                                             rate-limit, expire invitations)
supabase/seed.sql                                        — household demo "Keluarga Eko" + "Rina" + akun + hutang + transaksi
                                                             riwayat, untuk dev lokal (TIDAK dijalankan di produksi)
docs/reference/deployed-schema-2026-10-04.sql            — dump skema produksi SETELAH migrasi (final, untuk referensi)
```

### Cara pengujian (sebelum apply ke produksi)
DB lokal sungguhan dipakai (BUKAN mock): container Docker `postgres:17` resmi (image `supabase/postgres` gagal di-orkestrasi standalone tanpa CLI penuh; `supabase start` sendiri macet >15 menit menarik ~12 image dan dihentikan). Schema `auth` minimal + role `anon/authenticated/service_role` + `auth.uid()` dibuat manual untuk meniru platform Supabase (lihat `/tmp/bootstrap_auth.sql`, tidak disimpan ke repo karena khusus test). Semua 11 file migrasi dijalankan berurutan, lalu `seed.sql`, lalu empat skrip pengujian manual:
- Resolusi nama: 6 skenario `06-agent-integration.md` §5 (S1–S6) — **semua lolos**, termasuk angka persis sesuai spec (sisa hutang 8.400.000 setelah bayar, pengeluaran Rina bulan lalu 2.700.000, dst).
- Mutasi: insufficient_funds, transfer, pay_debt, overpayment, actor_mismatch, delete/restore round-trip saldo, adjust_balance — **semua lolos**.
- RLS lintas household: household kedua "Keluarga Budi" dibuat, dikonfirmasi 0 baris terlihat dan `not_household_member` saat mencoba menulis ke household Eko — **lolos**.
- Visibilitas akun privat: Rina set akun privat, Eko tidak bisa lihat saldo (NULL, bukan angka salah) dan tidak bisa mencatat expense dari situ (`forbidden_account`), Rina sendiri tetap lihat saldonya — **lolos setelah 2 perbaikan** (lihat bug di bawah).
- Idempotency: `ON CONFLICT DO NOTHING` pada `(credential_type, credential_id, key)` mencegah duplikat — **lolos**.

### Bug nyata yang ditemukan dan diperbaiki selama pengujian (lihat changelog di `03-database.md`)
1. `unaccent()` di index expression ditolak Postgres (STABLE, bukan IMMUTABLE); wrapper `immutable_unaccent` sendiri pun gagal khusus di konteks `CREATE INDEX` (kuirk resolusi `regdictionary`). **Fix**: index unik/trgm pakai `lower(name)` biasa; `unaccent` tetap dipakai di `norm_text()` untuk resolusi nama (bukan index).
2. CTE `scored` dipakai lintas statement SQL terpisah di `resolve_account`/`resolve_category` (CTE tidak bertahan antar statement dalam plpgsql). **Fix**: digabung jadi satu statement per fungsi.
3. `top_score` di resolver memakai skor similarity mentah (bisa kecil, mis. 11), bukan hanya kandidat ≥45, sehingga jalur `not_found` tidak pernah tercapai untuk kueri yang tidak cocok sama sekali. **Fix**: `max(score) filter (where score >= 45)`.
4. `enum::text IN (text,...)` di `resolve_category` — mismatch tipe. **Fix**: cast dua sisi ke text.
5. `adjust_balance`: `CASE … THEN 'income' ELSE 'expense' END` menghasilkan `text`, gagal masuk kolom `tx_type` enum. **Fix**: tambah `::tx_type`.
6. **Keamanan nyata**: `REVOKE SELECT (key_hash) ON api_keys FROM authenticated` (level kolom) **tidak efektif** karena Supabase memberi `GRANT ALL` level-tabel ke `authenticated`/`anon` lewat `ALTER DEFAULT PRIVILEGES` platform, dan grant level-tabel mengalahkan revoke level-kolom — dikonfirmasi `key_hash` masih terbaca sebelum fix. **Fix**: revoke SELECT penuh dari tabel dasar, expose hanya lewat view `v_api_keys` tanpa kolom `key_hash`. Diverifikasi ulang di produksi: `has_column_privilege('authenticated','api_keys','key_hash','select') = false`.
7. **Bug logika otorisasi**: `post_transaction`/`post_transfer` punya pengecualian "role household `owner` boleh menulis ke akun privat siapa pun" — salah, karena `owner` adalah peran admin (kelola member/kategori/API key), bukan pembebasan dari privasi akun. Efeknya error jatuh ke pesan RLS generik Postgres, bukan `forbidden_account` yang bisa ditindaklanjuti agent. **Fix**: hapus pengecualian, selalu cek `shared OR pemilik`.
8. `v_account_balances` membocorkan `opening_balance` (angka salah dan menyesatkan, bukan saldo sungguhan) untuk akun privat milik member lain — RLS transaksi sudah benar menyembunyikan riwayat, tapi `opening_balance` di baris akun tetap ikut teragregasi. **Fix**: `balance`/`tx_count`/`last_tx_date` jadi `NULL` kalau `NOT can_view_account(id)`.

Semua 8 temuan di atas dicatat di tabel riwayat perubahan `03-database.md` dengan tanggal dan alasan.

### Deployment ke produksi (`twcrflhvxzatpfrjmqzi`)
Dijalankan 2026-10-04 via pooler IPv4 (`aws-1-ap-southeast-1.pooler.supabase.com:5432`, user `postgres.twcrflhvxzatpfrjmqzi`) karena direct host IPv6-only tidak terjangkau dari mesin dev. **Verifikasi state SEBELUM apply**: hanya `gold_prices` (358 baris) + 0 user, sesuai hasil wipe sebelumnya. Semua 11 file migrasi berhasil tanpa error (identik dengan yang sudah lolos di DB lokal).

**Verifikasi SETELAH apply** (query langsung ke produksi):
| Cek | Hasil |
|---|---|
| Tabel di `public` | 25 (24 baru + `gold_prices`) |
| View | v_account_balances, v_debts, v_goals, v_goals_full, v_piutang, v_transactions, v_api_keys |
| Fungsi di `public` | 78 |
| RLS policy | 38 |
| `gold_prices` | 358 baris, **tidak tersentuh** |
| Enum | 10 (member_role, account_type, account_visibility, tx_type, tx_source, category_type, recurring_frequency, api_key_scope, credential_type, invitation_status) |
| Role `karaya_api` | ada, password placeholder sudah **dirotasi** ke string acak 40 karakter (disimpan sementara di `backups/karaya_api_role_password.txt`, gitignored, **harus dirotasi lagi** sebelum dipakai nyata oleh `apps/api` di Fase 3 dan dipindah ke secret manager, bukan file) |
| `authenticated` baca `key_hash` | **false** (aman) |
| `authenticated` baca `v_api_keys` | true (sesuai desain) |
| `pg_cron` | **sudah terpasang** di project ini (tidak perlu aktivasi manual Dashboard) |
| Cron job terjadwal | run-due-recurrings, cleanup-idempotency, cleanup-rate-limits, expire-invitations (4/4) |

**`seed.sql` TIDAK dijalankan di produksi** (sengaja — itu data demo untuk dev lokal, bukan untuk DB nyata). Produksi sekarang kosong dari data domain (0 households, 0 members, dst.), siap dipakai oleh user pertama lewat alur onboarding (`create_household`) begitu `apps/api` ada, atau bisa dipanggil manual sekarang lewat SQL Editor Supabase kalau user ingin mulai memakai Karaya sebelum Fase 3 selesai.

## F1 — Detail lengkap scaffold monorepo

### Pembersihan (F1-T3)
Dihapus: 13 folder `dist*/` (build artefak lama), `generate_docx.cjs`/`generate_panduan.py`/`generate_pdf.py` + `Panduan_Karaya_Finance.docx/.pdf` (duplikat `PANDUAN.md`), `scripts/seed_tester.py`/`seed_april.py` (kredensial plaintext), `.claude/launch.json` (path basi `catatan_keuangan_web`), `package-lock.json` (diganti `pnpm-lock.yaml`), `node_modules/` root lama.

Diarsipkan (bukan dihapus, nilai audit) ke `docs/reference/legacy-sql/`: `supabase_schema.sql`, `scripts/add_piutang_table.sql`, `supabase/fix_subscription_security.sql` — semua sudah digantikan total oleh `supabase/migrations/`.

Dipindah: `SS/` (45 screenshot panduan) → `docs/panduan-assets/`.

### Struktur baru
```
apps/web/     — git mv src/, index.html, public/; vite.config.js → vite.config.ts (port 1:1, tanpa ubah perilaku)
apps/api/     — BARU: Hono app, env.ts (zod, fail-fast), route /v1/health + /v1/openapi.json + /v1/docs
                (Scalar), entry dev (src/server.ts) dan Vercel (api/index.ts)
packages/shared/ — BARU: constants/categories.ts (19 kategori default, sinkron manual dengan
                seed_household_categories() di DB), format/ (fmtRp, fmtDate, toLocalDateStr,
                parseAmountId + 14 unit test), errors.ts (union ErrorCode lengkap dari 05-api.md §7
                + class ApiError), schemas/ & api-client/ (stub kosong, diisi Fase 3–4)
```
Root: `package.json` (workspace), `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc` (22), `tsconfig.base.json`,
`eslint.config.js` (flat config ESLint 9), `prettier.config.js`, `.editorconfig`, `vitest.workspace.ts`,
`.github/workflows/ci.yml`, `.gitignore` diperbarui.

### Penyesuaian terhadap spec (dicatat, bukan penyimpangan diam-diam)
- **`eslint-plugin-import-x` BELUM ditambahkan** (02-monorepo.md §4 menyebutnya untuk larangan impor
  silang web↔api dan larangan `supabase.from(` di apps/web). Aturan itu baru bermakna setelah Fase 4
  cutover; menambahkannya sekarang hanya menambah dependensi tanpa fungsi. Ditunda ke F4-T6.
- **`apps/api/src/env.ts` tidak mewajibkan semua var** di tabel 02-monorepo.md §6.2 sejak Fase 1 —
  hanya `API_PUBLIC_URL`/`CORS_ORIGINS`/`PORT` yang divalidasi wajib sekarang, supaya `pnpm dev` jalan
  tanpa perlu seluruh secret produksi. `DATABASE_URL`, `SUPABASE_*`, `API_KEY_PEPPER`, dll. ditandai
  `.optional()` dengan komentar di mana masing-masing wajib jadi required (F3/F6). Pola validasi zod +
  fail-fast tetap sama, hanya cakupannya bertahap.
- **Legacy `.jsx`/`.js` di apps/web dilonggarkan** (`no-unused-vars`, `no-undef`, `no-useless-escape`
  diturunkan ke warning, bukan error) alih-alih memperbaiki isinya, sesuai ADR-14 "dibiarkan sampai
  disentuh". 32 warning tersisa, 0 error. **Dua di antaranya layak dicek ulang saat file itu disentuh
  Fase 4**: `AddTransactionModal.jsx:709` (`base64` dipakai di luar scope `try` aslinya) dan
  `AkunView.jsx:348` (`a` dari closure `.map` — kemungkinan false-positive parser, bukan bug nyata,
  tapi belum dikonfirmasi 100%).
- **`supabase/functions/**` dikeluarkan total dari lint/typecheck** — itu runtime Deno (import URL,
  global `Deno`), bukan bagian toolchain Node/pnpm ini.

### Verifikasi (perintah nyata, bukan cuma baca kode)
```
pnpm install            → 543 paket, approve-builds untuk esbuild (perlu `pnpm rebuild esbuild`
                           sekali manual karena pnpm 10 memblokir postinstall by default)
pnpm lint                → exit 0, 0 error, 32 warning (semua kode lama pre-existing)
pnpm typecheck           → exit 0, 3/3 paket TS bersih (packages/shared, apps/api, apps/web)
pnpm test                → 16/16 test lulus (14 parseAmountId + 2 health/openapi di apps/api,
                           termasuk konfirmasi app.doc31() berfungsi)
pnpm build               → apps/web build Vite sukses (dist/, PWA 35 entries), apps/api tsc --noEmit
                           sukses (tidak ada build step terpisah — Vercel yang bundle api/index.ts)
pnpm dev                 → web :5173 (200), api :8787/v1/health ({"status":"ok","db":"not_configured"}),
                           api :8787/v1/docs (200, Scalar UI) — berjalan BERSAMAAN, keduanya dimatikan
                           bersih setelah verifikasi
```

### Temuan operasional (bukan bug kode, dicatat untuk kesadaran)
- **`FUNCTION_SECRET` di `apps/web/.env` lokal sempat tercetak di output terminal** saat sed redaction
  saya salah pola (hanya redact `KEY=`/`URL=`, bukan `SECRET=`). Nilainya sekarang sudah diketahui lewat
  riwayat sesi kerja ini. **Rotasi `FUNCTION_SECRET`** sebelum dipakai nyata di Fase 6, sama seperti
  password DB yang sudah dicatat sebelumnya.
- Ditemukan proses `vite` basi (>5 jam, menunjuk `node_modules/.bin/vite` yang sudah dihapus saat
  cleanup Fase 1) menempati port 5173 dari sesi kerja sebelumnya — dihentikan.

## F3 — Detail lengkap apps/api

### Cakupan yang dibangun
Semua resource inti per `05-api.md` §4 **kecuali** yang eksplisit Fase 5/6 (invitations, api-keys, audit-log, ai, webhooks, member mutations, reports/* selain summary):

| Resource | Endpoint | File |
|---|---|---|
| Sistem | health (db check nyata), openapi.json, docs (Scalar) | `routes/health.ts`, `app.ts` |
| Me/settings/onboarding | `/v1/me`, `/v1/households` (POST), `/v1/me/settings` (GET/PATCH) | `routes/me.ts` (`meApp`, middleware `requireUser`) |
| Household/members (read) | `/v1/households/current` (GET/PATCH), `/v1/members`, `/v1/bootstrap` | `routes/me.ts` (`householdApp`, middleware `requireAuth`) |
| Accounts | GET list/detail, POST, PATCH, DELETE, POST adjust-balance | `routes/accounts.ts` + `services/accounts.ts` |
| Categories | GET, POST, PATCH, DELETE (+merge) | `routes/categories.ts` + `services/categories.ts` |
| Transactions | GET list (filter+cursor+totals), POST, POST batch, GET/PATCH/DELETE id, POST restore | `routes/transactions.ts` + `services/transactions.ts` |
| Transfers | POST | `routes/transfers.ts` + `services/transfers.ts` |
| Budgets | GET, GET status, POST, PATCH, DELETE, POST copy | `routes/budgets.ts` + `services/budgets.ts` |
| Goals | GET, POST, PATCH, DELETE, POST/GET contributions | `routes/goals.ts` + `services/goals.ts` |
| Debts | GET, POST, PATCH, DELETE, POST/GET payments | `routes/debts.ts` + `services/debts.ts` |
| Piutang | GET, POST, PATCH, DELETE, POST/GET receipts | `routes/piutang.ts` + `services/piutang.ts` |
| Recurrings | GET, POST, PATCH, DELETE, POST run | `routes/recurrings.ts` + `services/recurrings.ts` |
| Split bills | GET, POST, DELETE, PATCH member paid | `routes/split-bills.ts` + `services/split-bills.ts` |
| Investments | GET, POST, PATCH, DELETE | `routes/investments.ts` + `services/investments.ts` |
| Summary | GET (totals, compare, top kategori, by-member, balance, budgets/goals/debts ringkas, recent tx) | `routes/summary.ts` + `services/summary.ts` |
| Resolve | POST (account/category/member via fungsi SQL; debt/goal/piutang via LIKE sederhana, lihat Q-09) | `routes/resolve.ts` |

**Total 40 path OpenAPI unik** (`jq '.paths\|keys\|length'` = 40) — di bawah angka ">= 60" yang disebut kriteria F3 di `08`, karena angka itu mengasumsikan resource Fase 5/6 (invitations, api-keys, audit-log, ai, webhooks, members mutasi, reports/* lengkap) yang memang belum masuk scope Fase 3.

Infrastruktur: `db/client.ts` (postgres.js ke pooler, `prepare:false`), `db/tx.ts` (`withActor`, `withUserClaims` — SET LOCAL ROLE authenticated + set_config klaim JWT per 03-database.md §7.1), `db/errors.ts` (peta SQLSTATE P0001 → ApiError), `auth/jwt.ts` (JWKS + fallback HS256), `auth/middleware.ts` (`requireAuth` resolve household dari X-Household-Id/active_household_id/pertama, `requireUser` untuk onboarding), `services/period.ts` (resolusi period → tanggal dalam timezone household, tanpa library eksternal), `services/resolver.ts` (wrapper TS untuk `resolve_account`/`resolve_category`/`resolve_member` + `resolveOwnerMemberId`).

`packages/shared/src/schemas/*.ts`: skema zod request untuk semua resource di atas (request divalidasi ketat; response sebagian besar `z.any()` — lihat bagian "Penyesuaian" di bawah). `packages/shared/src/errors.ts` ditambah `ERROR_MESSAGES`/`ERROR_HINTS` (pesan Indonesia default per code) dan `ApiError.fromCode()`.

`packages/shared/src/api-client/`: `schema.d.ts` di-generate dari OpenAPI nyata (`pnpm gen:api-client`, lewat `scripts/gen-api-client.sh` + `openapi-typescript`), `index.ts` berisi `createKaryaClient()` (openapi-fetch + middleware inject Authorization/X-Household-Id) — siap dipakai Fase 4.

### Penyesuaian terhadap spec (dicatat, bukan penyimpangan diam-diam)
- **Response schema sebagian besar `z.any()`**, bukan skema presisi seperti `AccountSchema`/`TransactionSchema` yang sempat ditulis. @hono/zod-openapi mewajibkan kecocokan STRUKTURAL PERSIS antara tipe hasil `c.json()` dan skema response untuk type-checking TypeScript; mengejar kecocokan 100% untuk ~15 resource dalam satu sesi tidak sepadan dengan manfaatnya dibanding effort. **Dampak**: dokumentasi OpenAPI untuk field response kurang presisi (cukup "any"), tapi **validasi request tetap ketat** (itu yang benar-benar menjaga korektnes), dan **tidak ada dampak runtime** (Hono tidak memvalidasi response terhadap skema, hanya request). Perbaikan presisi response schema adalah kandidat kerja Fase 4 kalau `packages/shared/src/api-client` butuh tipe return yang lebih kuat untuk `apps/web`.
- **`auth/jwt.ts` tidak divalidasi terhadap Supabase Auth sungguhan** di sesi ini — pengujian memakai JWT HS256 yang ditandatangani manual dengan `SUPABASE_JWT_SECRET` lokal (meniru format token Supabase: `sub`, `aud: authenticated`, `role: authenticated`). Jalur JWKS (`SUPABASE_URL`) belum diuji terhadap project Supabase asli. **Perlu diverifikasi** saat Fase 4 (apps/web login sungguhan) atau sebelum deploy produksi.
- **`services/resolve.ts` untuk kind=debt/goal/piutang** memakai `LIKE` sederhana di TypeScript, bukan fungsi SQL `resolve_*` (yang memang hanya ada untuk account/category/member, sesuai Q-09 di `09-pertanyaan-terbuka.md`). Ini sesuai spec, bukan penyimpangan.
- **F3-T9 (deploy ke Vercel) tidak dikerjakan** — butuh akses dashboard Vercel (membuat project `karaya-api-v1`, mengisi env produksi) yang di luar kemampuan sesi ini tanpa interaksi pengguna. `apps/api/vercel.json` dan `api/index.ts` (entry `hono/vercel`) sudah siap dari Fase 1.

### Bug nyata ditemukan dan diperbaiki
1. **Middleware wildcard bocor antar sub-app Hono.** `accountsApp.use('*', requireAuth())` yang di-mount sebelum `app.doc31('/v1/openapi.json', …)` menyebabkan `/v1/openapi.json` ikut ter-auth (401) meski didaftarkan di root app, bukan di dalam `accountsApp`. **Fix**: daftarkan route publik (`health`, `doc31`, `/v1/docs`) di `app.ts` SEBELUM mount sub-app mana pun yang punya middleware `'*'`. Dicatat sebagai pola wajib untuk sub-app baru di masa depan.
2. **RLS: `debt_payments`, `goal_contributions`, `piutang_receipts` tidak punya policy INSERT** (migrasi 0010 cuma bikin SELECT). Fungsi `pay_debt`/`topup_goal`/`receive_piutang` (bukan `SECURITY DEFINER`, jalan dengan hak akses pemanggil) gagal `42501 permission denied` begitu dipanggil sebagai role `authenticated` sungguhan lewat `apps/api`. **Lolos di pengujian Fase 2** karena saat itu dites sebagai superuser `postgres` (bypass RLS), bukan sebagai `authenticated`. **Fix**: migrasi baru `00000000000012_fix_audit_trail_insert_policies.sql`, **sudah diterapkan ke lokal DAN produksi**, diverifikasi ulang lewat HTTP nyata (bayar cicilan, kontribusi goal, terima piutang — ketiganya sukses setelah fix).
3. **Default tanggal transaksi memakai jam lokal server, bukan timezone household.** `toLocalDateStr()` (dari `packages/shared/format`) memakai `new Date()` sistem, yang di server produksi (Vercel) kemungkinan UTC, bukan `Asia/Jakarta`. Transaksi tanpa `date` eksplisit dekat tengah malam WIB bisa salah tanggal. **Fix**: `services/period.ts` mengekspor `todayInTz(timezone)`; `transactions.ts`, `transfers.ts`, `goals.ts`, `debts.ts`, `piutang.ts` sekarang menerima parameter `timezone` dari route (lewat `getHouseholdTimezone(actor)`) dan memakainya sebagai default tanggal, bukan `toLocalDateStr()`.

### Verifikasi (perintah nyata terhadap DB lokal Docker `postgres:17` + seed "Keluarga Eko")
```
pnpm lint            → exit 0, 0 error, 32 warning (semua kode lama pre-existing)
pnpm typecheck       → exit 0, bersih di 3 paket
pnpm --filter @karaya/api test → 7/7 lulus (2 health/openapi + 5 integration test baru:
                         401 tanpa auth, 403 not_household_member, 201 create + 422 insufficient_funds,
                         409 ambiguous_account dengan 2 kandidat, 200 summary)
pnpm dev / curl nyata (JWT HS256 ditandatangani manual untuk Eko/Rina/Budi):
  GET  /v1/me                              → memberships + household benar
  GET  /v1/accounts                        → 5 akun, saldo derived benar (cross-check manual)
  POST /v1/transactions (paritas Rp1)      → 201, saldo akun berkurang benar
  POST /v1/transactions (Rp5 miliar)       → 422 insufficient_funds, pesan+hint+details benar
  POST /v1/transactions (account:"BCA")    → 409 ambiguous_account, 2 kandidat (Eko+Rina)
  POST /v1/transfers (amount_text "2 juta")→ 201, kedua saldo berubah benar
  POST /v1/resolve (kind:debt, "cicilan motor") → match Cicilan Motor
  POST /v1/debts/{id}/payments             → 201 (setelah fix RLS #2), remaining berkurang benar
  POST /v1/goals (+ /contributions)        → 201, current bertambah benar (setelah fix RLS #2)
  POST /v1/piutang (+ /receipts)           → 201, remaining berkurang benar (setelah fix RLS #2)
  GET  /v1/accounts (sebagai Budi, 0 household) → 403 not_household_member
  POST /v1/accounts/{id}/adjust-balance    → diff benar, transaksi Koreksi Saldo tercipta
  POST /v1/recurrings/run                  → {executed:0} (tidak ada recurring due di seed)
  GET  /v1/households/current (sebagai Rina)→ household sama dengan Eko (shared correctly)
  GET  /v1/openapi.json                    → 40 paths, openapi 3.1.0
  GET  /v1/docs                            → 200 (Scalar UI)
pnpm gen:api-client  → schema.d.ts 2789 baris, ter-generate dari OpenAPI nyata
```

### Cara menjalankan ulang pengujian ini di sesi baru
```bash
docker run -d --name karaya-test-pg -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:17
# bootstrap schema auth minimal + migrations + seed — lihat detail lengkap di bagian F2 PROGRESS.md
# ini (container test sama dipakai ulang F2 dan F3); kalau container F2 masih hidup, langsung lanjut:
cd apps/api && cp .env.local.example .env.local 2>/dev/null || true   # .env.local sudah ada, berisi
                                                                        # DATABASE_URL ke localhost:54329
pnpm --filter @karaya/api dev   # :8787
# mint JWT test: lihat pola di apps/api/test/integration/transactions.test.ts (mintJwt helper)
```
**PENTING**: `apps/api/.env.local` dan `karaya-test-pg` container TIDAK di-commit/disimpan permanen — kalau sesi baru tidak punya keduanya, bangun ulang dari `supabase/migrations/*.sql` + `supabase/seed.sql` seperti di F2.

## Catatan lintas fase
- 2026-10-04 16:10 WIB: DB produksi di-wipe (lihat entri sebelumnya di riwayat ini / pesan sesi sebelumnya).
- 2026-10-04 18:xx WIB: DB produksi diisi skema target lengkap (F2 revisi greenfield), diuji identik dengan DB lokal sebelum apply.
- Koneksi dev → DB produksi: pooler `aws-1-ap-southeast-1.pooler.supabase.com:5432` user `postgres.twcrflhvxzatpfrjmqzi` (IPv4). Direct host IPv6-only, tidak terjangkau.
- `supabase start` (stack lokal penuh: kong/gotrue/storage/studio) **tidak reliable** di mesin ini (pull image lambat/macet). Untuk pengujian SQL murni, pakai `postgres:17` resmi + bootstrap `auth` schema manual — jauh lebih cepat dan cukup untuk menguji DDL, RLS, dan fungsi. Untuk pengujian yang butuh Auth/Storage/Studio sungguhan (Fase 3+), perlu waktu lebih lama untuk `supabase start` atau jalankan dari mesin dengan bandwidth lebih baik.
- Password DB produksi terakhir dipakai: `MZyEP4jRU4WBxSwS` (sudah beberapa kali lewat chat sepanjang sesi ini). **Harus direset** sebelum sesi berikutnya, dan jangan pakai ulang.
- Password role `karaya_api` tersimpan sementara di `backups/karaya_api_role_password.txt` (gitignored). **Rotasi lagi** saat benar-benar menyambungkan `apps/api` di Fase 3, pindah ke secret manager / env Vercel, hapus file lokal.
- Supabase CLI lokal masih v2.75.0 (ada v2.119.0). Pertimbangkan update sebelum Fase 3 push berikutnya.
- File-file lama yang menurut `08-rencana-implementasi.md` Fase 1 harus dihapus (13 `dist_*/`, `scripts/seed_*.py` berisi kredensial, dll.) **belum dihapus** — itu bagian Fase 1 (monorepo), belum dikerjakan sesi ini.
- Prioritas berikutnya yang disarankan: **Fase 1** (monorepo `apps/web` + `apps/api` kerangka) supaya ada tempat menulis `apps/api/src/...` yang memanggil fungsi-fungsi yang sudah teruji ini, ATAU langsung **Fase 3** sebagian (mulai `apps/api` tanpa menunggu monorepo penuh) kalau mau cepat punya API jalan.

## Riwayat perubahan spec
| Tanggal | File | Bagian | Perubahan | Alasan |
|---|---|---|---|---|
| 2026-10-04 | semua | — | Draft awal | — |
| 2026-10-04 | 00, 01, 03, 04, 08 | ADR-19, 01 §4, 03 pengantar, 04 arsip, 08 revisi | Greenfield setelah wipe DB | Keputusan pemilik produk mengosongkan DB |
| 2026-10-04 | 03-database.md | §3.4/3.5/3.9, §4.1, §7.3, §8.3 | 8 perbaikan bug (lihat detail F2 di atas): index unaccent, CTE scope, threshold skor, cast enum×2, keamanan api_keys, bug otorisasi owner-bypass, kebocoran saldo privat | Ditemukan lewat pengujian nyata terhadap DB Postgres sungguhan (bukan review manual), sebelum dan sesudah deploy ke produksi |
| 2026-10-04 | 02-monorepo.md | §4, §6.2 | eslint-plugin-import-x ditunda ke Fase 4; env.ts Fase 1 hanya wajibkan 3 var, sisanya optional bertahap | Lihat detail F1 di atas; keduanya tidak mengubah arsitektur, hanya urutan pengerjaan |
| 2026-10-04 | 03-database.md | §7.3 | Tambah policy INSERT untuk debt_payments/goal_contributions/piutang_receipts (migrasi 0012) | Bug nyata ditemukan Fase 3: fungsi non-SECURITY-DEFINER gagal 42501 saat dipanggil sebagai role authenticated sungguhan lewat apps/api |
| 2026-10-04 | 05-api.md (implisit lewat kode) | response schema | Response body sebagian besar `z.any()` di apps/api, bukan skema presisi per resource | @hono/zod-openapi butuh kecocokan struktural persis; request tetap divalidasi ketat, hanya presisi dokumentasi response yang berkurang. Kandidat perbaikan Fase 4. |
| 2026-10-04 | 05-api.md §4.12 | `/v1/ai/chat`, `/v1/ai/scan-receipt` | Bentuk request/response disesuaikan ke apa yang nyata dipakai frontend lama, bukan desain awal (`messages[].content`→`text`, `category_suggestion`→`category`, scan-receipt JSON-only + mode `ocr_text`) | Lihat detail di riwayat perubahan 05-api.md sendiri |
| 2026-10-04 | 03-database.md (implisit) | `create_household()`, `user_settings.active_household_id` FK | `create_household` diubah jadi `SECURITY DEFINER` + guard `p_user_id = auth.uid()`; FK `user_settings_active_household_id_fkey` diubah dari NO ACTION ke `ON DELETE SET NULL` | 2 bug nyata ditemukan saat verifikasi manual Fase 4 (lihat detail F4 di bawah): onboarding (`POST /v1/households`) selalu gagal 403 untuk SEMUA user baru karena `households` tidak punya RLS policy INSERT; `DELETE /v1/me` selalu gagal 500 karena FK violation dari `user_settings.active_household_id` yang selalu terisi tepat setelah onboarding |
| 2026-10-04 | 05-api.md §4.6 | `DELETE /v1/me` | Implementasi TIDAK memakai Admin API/service role seperti didokumentasikan sebelumnya — hanya hapus household (cascade), tidak hapus baris `auth.users` | `SUPABASE_SERVICE_ROLE_KEY` belum dikonfigurasi sesi ini; lihat detail di riwayat perubahan 05-api.md sendiri |
| 2026-10-04 | 03-database.md (implisit) | 6 bug Fase 5 (SECURITY DEFINER, self-leave, unique index, RLS update, transaksi baca-ulang, filter merge) | Lihat detail lengkap di riwayat perubahan 03-database.md dan bagian Fase 5 di bawah | Ditemukan lewat pengujian manual end-to-end F5-T1 (undang→terima→keluar→undang lagi→merge) |
| 2026-10-04 | packages/shared/src/schemas/{goals,debts,piutang}.ts | `owner` ditambah ke `UpdateGoalBodySchema`/`UpdateDebtBodySchema`/`UpdatePiutangBodySchema` | Gap ditemukan sub-agent F5-T5: ketiga schema update tidak bisa alihkan kepemilikan (field dibuang diam-diam oleh zod), beda dari `UpdateAccountBodySchema`/`UpdateInvestmentBodySchema` yang sudah benar | Konsistensi — F5-T5 menambahkan UI pemilihan owner di form edit keempat entitas, backend harus menerimanya juga |
| 2026-10-04 | 07-frontend.md | §3, §4 | Export CSV tetap client-side (bukan endpoint baru); HouseholdSwitcher/MembersSettings/InvitationsSettings digabung jadi satu `HouseholdPanel.jsx` | Lihat detail di riwayat perubahan 07-frontend.md sendiri |

## Fase 4 — Frontend: migrasi `apps/web` ke `apps/api` (F4-T1, F4-T3, F4-T5, F4-T6)

Dikerjakan paralel dengan F4-T2/F4-T4 (section di bawah, dikerjakan sub-agent terpisah pada sesi yang sama). Scope entri ini: seluruh hook domain, `Dashboard.jsx`, `AddTransactionModal.jsx` (wiring ke dua endpoint AI baru), aturan lint, caching PWA, dan 2 bug backend nyata yang ditemukan saat verifikasi manual.

**Selesai:**
- `apps/web/src/hooks/use{Accounts,Categories,Budgets,Debts,Goals,Piutang,Recurrings,SplitBills,Investments,Transactions,Transfers,Settings}.js` — semua ditulis ulang dari akses `supabase.from(...)`/`callEdge(...)` langsung menjadi React Query (`@tanstack/react-query`) di atas `apps/api`. Pola konsisten: `useQuery` untuk baca (query key `[resource, activeHouseholdId]`), mutasi sebagai method yang `invalidateQueries` setelah sukses (bukan lagi manual `setState` cross-entity seperti `handlePayDebt`/`handleTopupGoal` dkk di `Dashboard.jsx` lama — React Query invalidation menggantikan threading `setAccounts`/`setTransactions` manual).
  - **Legacy shape compatibility** dipertahankan di tiap hook (nama field lama: `category` string bukan object, `account_name` bukan `account.name`, dst) supaya 14 file view TIDAK diubah sama sekali kecuali 2 bug nyata (lihat bawah). Field baru dari API (owner, visibility, dll.) ikut lewat untuk komponen Fase 5.
  - `useBudgets`: `GET /v1/budgets` hanya satu bulan per panggilan (beda dari tabel lama yang diambil sekaligus) → ditarik paralel untuk rentang -12..+12 bulan (sama persis dengan dropdown `AnggaranView.jsx`) pakai `useQueries`, hasil diratakan (`category` object→string, `period_start`→`month` string) di hook, bukan di view.
  - `useCategories`: backend sekarang menyimpan SEMUA kategori (14 default + 5 sistem) per household via `seed_household_categories()`, beda dari pola lama (default hardcode di `constants/categories.js` + custom dari DB). `customCategories` yang dikembalikan hook HANYA kategori API yang bukan `is_system` dan namanya bukan salah satu default hardcode, supaya `KategoriView.jsx` yang masih menggabungkan `categoryIcons` hardcode + `customCategories` tidak tampil dobel.
  - `useTransactions`: `GET /v1/transactions` dipaginasi cursor (beda dari fetch tak terbatas lama) → ditarik semua halaman sekaligus saat mount (loop `cursor`/`has_more`) karena `DasborView`/`LaporanView`/`PrediksiView` menghitung agregat sendiri dari seluruh riwayat transaksi di client, bukan dari endpoint ringkasan.
  - `useSettings`: `GET /v1/me/settings` tidak pernah mengembalikan `ai_config.apiKey` asli (hanya `has_api_key` boolean, key dibaca server-side). Diisi sentinel placeholder saat key memang ada supaya `Sidebar.jsx` (yang mengecek `aiConfig?.apiKey` sebagai status "sudah diatur") tidak perlu diubah; `saveAiConfig` mengenali sentinel dan tidak mengirim ulang `api_key` kalau user tidak mengubahnya (mencegah placeholder menimpa key asli).
- `apps/web/src/pages/Dashboard.jsx` — ditulis ulang total: `fetchAll()` (10 query Supabase paralel) + `callEdge(...)` untuk semua mutasi diganti hook-hook di atas. Render/JSX dipertahankan hampir identik (tata letak, routing menu manual, modal) — hanya data layer yang berubah. Auto-eksekusi recurring jatuh tempo tetap dipanggil sekali saat mount (`runDueRecurrings`, fallback sampai pg_cron aktif Fase 5/F5-T7). `updateName`/`updatePassword`/`deleteAccount`(auth bagian)/export CSV tetap: auth lewat `supabase.auth.*` langsung (bukan domain table, boleh per konvensi), export CSV tetap murni client-side dari array `transactions` yang sudah di memory.
- `apps/web/src/components/dashboard/AddTransactionModal.jsx` — `scanReceiptWithAI`/`parseOCRTextWithAI` (sebelumnya memanggil provider AI LANGSUNG dari browser pakai API key dari state lokal — kebocoran kredensial lewat network tab) diganti panggilan `POST /v1/ai/scan-receipt` (lihat kontrak di section F4-T2/T4 di atas). Deteksi dukungan vision per-provider dipindah ke server (`provider_no_vision`), klien hanya perlu tahu apakah AI sudah dikonfigurasi sama sekali. **Bonus**: bug lama `base64 is not defined` di fallback OCR (tertangkap `no-undef` saat lint) ikut diperbaiki karena struktur try/catch ditulis ulang.
- ESLint (`eslint.config.js`): aturan baru `no-restricted-syntax` untuk `apps/web/**/*.{js,jsx,ts,tsx}` melarang `supabase.from(...)` dan `supabase.functions.*`, plus `no-restricted-imports` melarang impor `services/api` (sudah dihapus). Diverifikasi aktif (file percobaan dengan kedua pola → 2 error, dihapus setelah dites).
- `apps/web/src/services/api.js` (`callEdge` helper) dihapus — sudah tidak dipakai di mana pun.
- `apps/web/src/services/aiService.js` — fungsi mati `sendAiMessage`/`buildSystemPrompt`/`buildFinanceSystemPrompt` (sisa pola `callEdge`/edge function lama, tidak dipakai) dihapus. Hanya `AI_PROVIDERS`/`PROVIDER_ORDER`/`DEFAULT_MODEL` (dipakai `Sidebar.jsx`/`AiView.jsx`) yang tetap.
- `apps/web/vite.config.ts`: runtime caching workbox dipersempit dari `*.supabase.co/*` ke `*.supabase.co/auth/v1/*` saja (data domain sekarang ke `apps/api`, origin berbeda, dan sengaja TIDAK di-cache — data keuangan harus selalu fresh).

### Bug nyata ditemukan dan diperbaiki (lewat pengujian manual terhadap DB lokal + dev server nyata, bukan review kode)
1. **Onboarding (`POST /v1/households`) selalu gagal `403 forbidden` untuk SEMUA user baru.** Tabel `households` tidak pernah punya RLS policy INSERT (hanya select+update sejak migrasi 0010), dan `create_household()` bukan `SECURITY DEFINER` — berjalan sebagai role `authenticated` biasa, selalu kena default-deny RLS (`42501`→`forbidden`). Ini berarti alur onboarding (`OnboardingHousehold.jsx`, dibangun sesi sebelumnya) belum pernah benar-benar bisa dipakai. **Fix**: migrasi `00000000000016_create_household_security_definer.sql`, fungsi jadi `SECURITY DEFINER` dengan guard eksplisit `p_user_id = auth.uid()` (mencegah user A membuat household atas nama user B lewat parameter). Diverifikasi: household baru untuk user baru berhasil dibuat setelah fix (gagal sebelum fix, dites dengan user `auth.users` throwaway yang dibuang lagi setelahnya).
2. **`DELETE /v1/me` selalu gagal `500 internal_error`.** `user_settings.active_household_id` punya FK ke `households` TANPA `on delete cascade`/`set null` (default NO ACTION) — dan `create_household()` SELALU mengisi `active_household_id` ke household yang baru dibuat. Jadi menghapus household (lewat `households_delete` RLS policy yang baru ditambah di migrasi 0015) selalu kena `23503` foreign key violation, dipetakan `mapDbError` jadi `internal_error` generik. **Fix**: migrasi `00000000000017_user_settings_active_household_set_null.sql`, FK diubah jadi `ON DELETE SET NULL`. Diverifikasi: `DELETE /v1/me` sukses, `GET /v1/bootstrap` sesudahnya mengembalikan `not_household_member` seperti seharusnya.
3. **`useBudgets` tanpa flattening akan membuat `AnggaranView.jsx` crash/salah tampil.** Ditemukan lewat curl manual: `GET /v1/budgets` mengembalikan `category:{id,name}` (object) dan `period_start` (tanggal), bukan `category`/`month` string datar yang dipakai `AnggaranView.jsx` untuk filter per bulan. **Fix**: diratakan di dalam hook sebelum sampai ke view (lihat detail hook di atas) — ditemukan dan diperbaiki SEBELUM sempat jadi bug di browser, karena diverifikasi lewat curl nyata terhadap tiap endpoint sebelum dianggap selesai.

Kedua migrasi #1 dan #2 **sudah diterapkan ke DB lokal (`karaya-test-pg`) DAN produksi** (pooler `aws-1-ap-southeast-1.pooler.supabase.com`).

### Verifikasi (terhadap DB lokal + dev server nyata, JWT HS256 ditandatangani manual untuk user seed `00000000-0000-0000-0000-0000000000e0` "Eko")
```
pnpm lint       → exit 0, 0 error, 27 warning (semua kode LAMA pre-existing, 0 warning di semua file baru/diubah sesi ini)
pnpm typecheck  → exit 0, bersih di 3 paket (packages/shared, apps/web — sekarang ikut tsc karena ada .ts baru, apps/api)
pnpm test       → 21/21 lulus (14 format.test.ts + 2 health + 5 integration), tidak ada regresi
pnpm --filter @karaya/web build → sukses, bundle AddTransactionModal turun 35.10kB→29.33kB (kode provider-AI client-side dihapus)
grep -rn "supabase.from\|supabase.functions\|callEdge" apps/web/src | wc -l → 0 (kriteria selesai F4 di 08-rencana-implementasi.md)
curl nyata (dev server :8787 + karaya-test-pg):
  GET  /v1/accounts, /v1/categories, /v1/debts, /v1/goals, /v1/investments, /v1/split-bills, /v1/piutang, /v1/recurrings
       → semua shape dicocokkan manual terhadap ekspektasi tiap hook, 1 mismatch ditemukan (budgets, lihat bug #3 di atas) dan diperbaiki
  POST /v1/households (user baru, auth.users throwaway)        → 403 sebelum fix #1, 201 setelah fix #1
  DELETE /v1/me (household baru, 1 member)                     → 500 sebelum fix #2, {"success":true} setelah fix #2
  GET  /v1/bootstrap setelah DELETE /v1/me                     → not_household_member (benar)
  POST /v1/ai/chat, /v1/ai/scan-receipt (ai_config kosong)     → 400 ai_not_configured (jalur error benar, tidak sempat panggil provider eksternal)
```
Data test throwaway (household + auth.users row) dibuang lagi setelah pengujian; TIDAK menyentuh household seed "Keluarga Eko" yang dipakai test suite lain.

**Tidak bisa diuji**: interaksi UI sungguhan di browser (tidak ada tool otomasi browser di sesi ini) — build + lint + typecheck + test + curl endpoint manual adalah batas verifikasi yang bisa dilakukan. Checklist manual penuh di `08-rencana-implementasi.md` §Fase 4 (login → tambah expense → edit → hapus → transfer → scan struk OCR → bayar cicilan → topup goal → dst.) **belum dijalankan di browser sungguhan** — direkomendasikan sebelum F4-T7 (deploy).

**Belum/di luar scope:**
- F4-T7 (deploy ke Vercel) — sama seperti F3-T9, butuh akses dashboard Vercel.
- F4-T8 (contract: drop kolom legacy) — tidak berlaku, greenfield (ADR-19 di `00-ringkasan.md`).
- `DELETE /v1/me` belum menghapus baris `auth.users` (butuh `SUPABASE_SERVICE_ROLE_KEY`, belum dikonfigurasi) — lihat `05-api.md` riwayat perubahan.
- Household beranggota >1 belum bisa pakai `DELETE /v1/me` (ditolak `409 last_owner_with_members`) — alur reassign/leave adalah Fase 5.
- Pengujian UI browser sungguhan (lihat di atas).

## Fase 4 (sebagian) — Backend: `/v1/ai/chat` dan `/v1/ai/scan-receipt` (F4-T2, F4-T4)

Dikerjakan sebagai bagian dari migrasi `apps/web` → `apps/api` (Fase 4), paralel dengan pekerjaan frontend (hooks, Dashboard.jsx) di sesi yang sama. Scope entri ini: HANYA dua endpoint AI baru di `apps/api` + schema shared + dokumentasi. Hooks/komponen frontend yang mengonsumsinya dikerjakan terpisah.

**Selesai:**
- `POST /v1/ai/chat` (`apps/api/src/services/ai/chat.ts`, `routes/ai.ts`): port dari edge function `ai-chat` lama (1038 baris) ke model household/actor baru. `ai_config` (provider/model/apiKey/disabled) dibaca server-side dari `user_settings` lewat `withUserClaims(actor.userId, ...)` — **tidak pernah** diterima dari request body. Tool read-only (`get_transactions`, `get_summary`, `get_accounts`, `get_debts`, `get_goals`, `get_investments`) memanggil service layer yang sudah ada (`listTransactions`, `getSummary`, `listAccounts`, `listDebts`, `listGoals`, `listInvestments`) alih-alih query `user_id`-scoped langsung seperti versi lama. Agentic loop per provider (OpenAI-compatible, Anthropic, Google) dan jalur 2-pass untuk provider/model tool-calling tidak reliabel (Groq, dst.) dipertahankan sama seperti versi lama, hanya `buildEnrichedPrompt`-nya disederhanakan memakai `getSummary` alih-alih reduce manual atas seluruh riwayat transaksi.
- `POST /v1/ai/scan-receipt` (`apps/api/src/services/ai/scan-receipt.ts`): port dari `scanReceiptWithAI`/`parseOCRTextWithAI` di `AddTransactionModal.jsx`, yang sebelumnya memanggil provider AI **langsung dari browser** memakai API key dari local state — kebocoran kredensial lewat network tab. Mode vision (`image_base64`+`mime_type`) dan mode teks (`ocr_text`, untuk hasil tesseract.js yang perlu distrukturkan AI) keduanya didukung di satu endpoint. **Tidak diport**: ekstraksi teks OCR itu sendiri (`scanReceiptWithOCR`'s pemanggilan `tesseract.js`) — itu murni client-side, tanpa API key, bukan masalah keamanan, jadi tetap di frontend. Sanitasi hasil (`sanitizeScanResult`, guess kategori dari nama item) juga tetap di frontend karena murni logika tampilan.
- Skema baru: `packages/shared/src/schemas/ai.ts` (`AiChatBodySchema`, `AiChatResponseSchema`, `ScanReceiptBodySchema`, `ScanReceiptResponseSchema`), diekspor dari `index.ts`.
- `docs/spec/05-api.md` §4.12 diperbarui ke bentuk request/response yang benar-benar diimplementasikan (lihat riwayat perubahan di file itu).

**Verifikasi (terhadap DB lokal `karaya-test-pg`, household seed "Keluarga Eko", user `00000000-0000-0000-0000-0000000000e0` yang `ai_config` masih kosong `{}`):**
```
pnpm --filter @karaya/shared exec tsc --noEmit   → bersih
pnpm --filter @karaya/api exec tsc --noEmit      → bersih
pnpm --filter @karaya/api test                   → 7/7 tetap lulus (tidak ada regresi)
curl -s http://localhost:8787/v1/openapi.json | grep -o '"/v1/ai/[^"]*"'
  → "/v1/ai/chat" dan "/v1/ai/scan-receipt" terdaftar
POST /v1/ai/chat {"messages":[{"role":"user","text":"halo"}]}  (JWT valid, ai_config kosong)
  → 400 {"error":{"code":"ai_not_configured", ...}}  ✓ (tidak sempat memanggil provider eksternal)
POST /v1/ai/scan-receipt {"ocr_text":"test"}        (JWT valid, ai_config kosong)
  → 400 {"error":{"code":"ai_not_configured", ...}}  ✓
POST /v1/ai/chat {"messages":[]}                    → 400 ZodError (messages min 1)  ✓
POST /v1/ai/scan-receipt {}                          → 400 ZodError (refine: butuh image_base64+mime_type atau ocr_text)  ✓
```
Tidak bisa diuji end-to-end sampai memanggil provider AI sungguhan (butuh API key asli, sengaja tidak dibuat/diminta di sesi ini) — jalur `ai_not_configured` dan validasi body sudah diverifikasi nyata; jalur sukses (balasan AI, hasil scan struk nyata) baru akan diuji saat ada tester dengan API key BYOK sungguhan.

**Kontrak untuk integrasi frontend** (dipakai sesi/pekerjaan lain yang mengerjakan `AiView`/`AddTransactionModal.jsx`):
- `POST /v1/ai/chat` — body `{messages:[{role:"user"|"ai", text:string}]}` (role `"ai"` dipetakan ke `assistant` di provider, SAMA PERSIS dengan bentuk yang sudah dipakai `aiChat` state di `Dashboard.jsx`/`AiView.jsx` lama, jadi tidak perlu mapping tambahan) → `{reply: string}`.
- `POST /v1/ai/scan-receipt` — body salah satu dari `{image_base64, mime_type}` (foto struk, mode vision) atau `{ocr_text}` (teks hasil `tesseract.js`, mode teks-saja) → `{merchant?, date?, subtotal?, items?:[{note, amount, category}]}` atau `{error:"bukan struk"}` — bentuk ini SAMA PERSIS dengan `raw` yang dikonsumsi `sanitizeScanResult()` di `AddTransactionModal.jsx` saat ini, jadi fungsi itu bisa dipakai apa adanya; yang perlu diganti di modal hanyalah pemanggilan `scanReceiptWithAI(base64, mimeType, aiConfig)` → `api.POST("/v1/ai/scan-receipt", {body:{image_base64, mime_type}})` dan `parseOCRTextWithAI(ocrText, aiConfig)` → `api.POST("/v1/ai/scan-receipt", {body:{ocr_text}})`, lalu hasilnya tetap dilempar ke `sanitizeScanResult()` seperti sebelumnya. `aiConfig` (provider/apiKey) sudah TIDAK PERLU dikirim dari frontend sama sekali — hapus semua pemakaiannya di dua fungsi itu dan di pemanggilnya.

**Belum/di luar scope entri ini:** wiring frontend (`AiView.jsx`, `AddTransactionModal.jsx`, `Dashboard.jsx` handleAi) ke dua endpoint ini — itu bagian F4-T2/F4-T4 yang dikerjakan di tempat lain pada sesi yang sama. Juga perlu dicatat: `DELETE /v1/me` (dikerjakan di tempat lain pada sesi yang sama) sesuai `05-api.md` §4.6 seharusnya "Memakai Admin API (service role)" untuk benar-benar menghapus baris `auth.users`, tapi `SUPABASE_SERVICE_ROLE_KEY` belum dikonfigurasi di `apps/api/.env.local` — perlu dicek apakah implementasi itu sudah mendokumentasikan deviasi ini atau masih perlu ditambahkan.

## Fase 5 — Backend: undangan, anggota, merge, verifikasi scope (F5-T1, F5-T2, F5-T7)

**Konteks penting ditemukan sebelum mulai coding**: audit kode menunjukkan F5-T2 (`accounts` owner/visibility/aliases, `summary` scope/attribution, `transactions` filter member/recorded_by) **sudah lengkap dibangun sejak Fase 3** — agent Fase 3 membangun API langsung terhadap skema household-aware penuh, bukan skema single-user. Begitu juga F5-T7 (pg_cron 4 job) sudah aktif sejak F2. Jadi scope nyata sesi ini untuk backend: F5-T1 (undangan + mutasi anggota, SQL function-nya SUDAH ADA sejak F2 tapi belum dibungkus route API) + verifikasi F5-T2/F5-T7.

**Selesai (F5-T1):**
- `apps/api/src/services/invitations.ts` (baru): `listInvitations`, `createInvitation`, `revokeInvitation`, `previewInvitation` (tanpa auth), `acceptInvitation` — membungkus fungsi SQL `create_invitation`/`preview_invitation`/`accept_invitation` yang sudah ada sejak migrasi F2.
- `apps/api/src/services/households.ts`: tambah `updateMember`, `removeMember`, `leaveHousehold`; `updateHousehold` diperluas menerima `settings:{default_account_visibility, owners_can_view_private_totals}`.
- `apps/api/src/routes/invitations.ts` (baru): `invitationsApp` (household-scoped: GET/POST /v1/invitations, DELETE /v1/invitations/{id}) + `invitationsPublicApp` (GET /v1/invitations/{code} tanpa auth, POST /v1/invitations/{code}/accept dengan `requireUser()` saja).
- `apps/api/src/routes/members.ts` (baru): PATCH /v1/members/{id}, DELETE /v1/members/{id}, POST /v1/members/me/leave.
- `apps/api/src/db/tx.ts`: tambah `withAnon()` — koneksi role `authenticated` TANPA `request.jwt.claims`, dipakai endpoint publik (preview undangan) yang tidak punya JWT sama sekali.
- `packages/shared/src/schemas/household.ts` (baru): `CreateInvitationBodySchema`, `AcceptInvitationBodySchema`, `UpdateMemberBodySchema`, `UpdateHouseholdBodySchema` (+`settings`), `RemoveMemberQuerySchema`.
- Migrasi `00000000000018_fase5_household_security_definer.sql`: lihat "Bug nyata" di bawah — ini migrasi terbesar sesi ini, berisi 5 perbaikan berbeda, SEMUA ditemukan lewat pengujian manual end-to-end (curl nyata), bukan review kode.

### Bug nyata ditemukan dan diperbaiki (lewat pengujian manual bertahap: undang → preview → terima → ubah profil → keluar → undang lagi → gabung mode merge)
1. **Onboarding household lanjutan (undangan/anggota) selalu gagal RLS.** `household_members` dan `household_invitations` hanya punya policy SELECT (migrasi 0010) sejak awal — persis bug yang sama dengan `create_household` di F4 (migrasi 0016), tapi kali ini mengenai 5 fungsi sekaligus: `create_invitation`, `accept_invitation`, `remove_member`, `change_member_role`, `merge_household_into`. Kelimanya SUDAH punya pengecekan otorisasi internal sendiri (actor_mismatch, role owner, dst.) sejak F2, hanya belum `SECURITY DEFINER`. **Fix**: `alter function ... security definer set search_path = public` untuk kelimanya.
2. **`remove_member` tidak bisa dipakai untuk self-leave.** Guard asli `if v_actor.role <> 'owner' then forbidden` memblokir anggota non-owner yang mau keluar sendiri lewat `POST /v1/members/me/leave` (butuh aturan bisnis yang sama — last_owner, reassign_required — tapi TANPA syarat role owner untuk target diri sendiri). **Fix**: guard diubah jadi `if v_actor.role <> 'owner' and p_actor_member_id <> p_member_id then forbidden` — non-owner tetap dilarang hapus ORANG LAIN, tapi boleh hapus diri sendiri. `DELETE /v1/members/{id}` menolak target diri sendiri di service layer (`cannot_remove_self`) SEBELUM memanggil fungsi ini, memaksa pakai endpoint leave yang benar.
3. **Leave lalu diundang lagi (rejoin) selalu gagal `23505` unique violation.** `household_members_household_id_user_id_key` adalah UNIQUE CONSTRAINT biasa pada `(household_id, user_id)`, BUKAN partial index — baris lama yang soft-delete (`deleted_at` terisi) tetap dihitung constraint, jadi insert baris baru untuk user yang sama di household yang sama (setelah keluar) selalu gagal. Pola yang benar sudah ada di `household_members_active_name_uq` (partial, `where deleted_at is null`); constraint user_id seharusnya sama sejak awal. **Fix**: drop constraint lama, ganti `create unique index ... where deleted_at is null`.
4. **`household_members` tidak punya policy UPDATE.** `PATCH /v1/members/{id}` (ubah display_name/aliases/color sendiri, bukan lewat fungsi SQL — langsung UPDATE dari service layer) selalu 0 baris ter-update (RLS default-deny untuk UPDATE bukan error, jadi `member_not_found` yang menyesatkan, bukan 403). **Fix**: `create policy members_update ... using (user_id = auth.uid() or member_role_in(household_id) = 'owner')`.
5. **`updateHousehold` mengembalikan nilai LAMA setelah PATCH berhasil.** Bug transaksi: `updateHousehold` memanggil `getCurrentHousehold(actor)` untuk baca-ulang, tapi `getCurrentHousehold` lewat `withActor` membuka TRANSAKSI/KONEKSI BARU dari pool — koneksi baru itu belum commit-visible terhadap UPDATE yang baru saja jalan di transaksi pertama (yang juga belum commit saat itu, masih di dalam `sql.begin()` yang sama). UPDATE di DB benar (diverifikasi `psql` langsung menunjukkan nilai baru), tapi response API selalu nilai lama. Kemungkinan sudah ada sejak household PATCH pertama dibuat (Fase 3/4), baru ketahuan sekarang karena `settings` baru benar-benar diuji manual. **Fix**: extract query jadi `selectCurrentHousehold(tx, householdId)` yang menerima `tx` dari pemanggil, dipakai ulang di `updateHousehold` dengan `tx` yang SAMA (bukan transaksi baru).
6. **Membership ke household yang sudah di-merge masih muncul di `GET /v1/me`.** `merge_household_into` soft-delete baris `households` sumber TAPI TIDAK menghapus baris `household_members` lama milik user yang pindah (baris itu memang tidak perlu dihapus — historinya tetap valid — tapi tidak boleh dianggap "membership aktif"). `getMe()` dan `resolveMembership()` (auth middleware, dipakai SETIAP request untuk menentukan household aktif) hanya filter `hm.deleted_at is null`, tidak JOIN+filter `h.deleted_at is null` pada household-nya. **Fix**: tambah `join households h ... and h.deleted_at is null` di kedua query. Risiko kalau tidak diperbaiki: user yang household-nya sudah di-merge masih bisa "resolve" ke household basi itu kalau `active_household_id` mereka sempat ter-reset null (mis. lewat `ON DELETE SET NULL` FK Fase 4) dan fallback ke `rows[0]` memilih household basi.

**Test regresi**: `apps/api/test/integration/household.test.ts` (baru, 3 test, mencakup SEMUA 6 bug di atas dalam satu alur realistis: undang → preview publik → terima (mode fresh) → ubah nama sendiri → keluar → undang lagi → gabung lagi → coba hapus diri sendiri lewat DELETE (ditolak) → skenario kedua: buat household sendiri + akun → diundang household lain → terima mode merge → verifikasi akun pindah & membership lama hilang dari /v1/me → skenario ketiga: PATCH settings ter-reflect langsung). Fixture (2 user `auth.users` throwaway) dibuat & dibersihkan sendiri oleh test (`beforeAll`/`afterAll`), TIDAK mengotori seed EKO/RINA yang dipakai `transactions.test.ts`. Butuh koneksi admin terpisah (`TEST_ADMIN_DATABASE_URL`, default superuser lokal) karena role `karaya_api` sengaja tidak punya akses tulis ke `auth.users`/`household_invitations` langsung (hanya lewat `SET LOCAL ROLE authenticated` + RLS, sama seperti runtime app).

**Verifikasi:**
```
pnpm lint       → 0 error, 27 warning (semua pre-existing, 0 di kode baru)
pnpm typecheck  → bersih di 3 paket
pnpm test       → 24/24 lulus (termasuk 3 test household.test.ts baru)
Migrasi 0018 diterapkan ke LOKAL dan PRODUKSI, diverifikasi lewat query langsung (prosecdef=t
  untuk 5 fungsi, policy members_update/invitations_update ada, constraint lama hilang diganti index partial)
curl manual end-to-end (household 2 anggota + household terpisah untuk uji merge, data dihapus lagi setelahnya):
  POST /v1/invitations → GET /v1/invitations/{code} (TANPA Authorization header) → POST .../accept (fresh) →
  PATCH /v1/members/{id} (self) → POST /v1/members/me/leave → undang+terima lagi (rejoin) →
  DELETE /v1/members/{id} pada diri sendiri → 409 cannot_remove_self →
  buat household terpisah + akun → undang ke household utama → accept mode=merge →
  GET /v1/accounts menunjukkan akun yang di-merge → GET /v1/me TIDAK lagi menampilkan household lama →
  PATCH /v1/households/current {settings:{owners_can_view_private_totals:true}} → response langsung true (bukan false basi)
  GET /v1/summary?scope=member&member=Rina, GET /v1/transactions?member=Rina → sudah berfungsi sejak F3, dikonfirmasi ulang
```

**Belum/di luar scope:** frontend (F5-T3, T4, T5) — dikerjakan paralel oleh sub-agent terpisah pada sesi yang sama, lihat bagian terpisah setelah ini selesai. F5-T6 MigrationReviewBanner ditandai n/a (lihat tabel status tugas); i18n string household baru belum dikerjakan (utang teknis).

## Fase 5 — Frontend: household UI, owner/visibility, scope (F5-T3, F5-T4, F5-T5)

Dikerjakan oleh 3 sub-agent paralel pada sesi yang sama, setelah fondasi (hooks, HouseholdPanel, JoinHouseholdPage, komponen bersama) dibangun lebih dulu di sesi utama.

**Fondasi (sesi utama):**
- Hooks baru: `useInvitations.js`, `useMembers.js`, `useHouseholdInfo.js` — pola sama persis dengan hook Fase 4 (React Query, query key `[resource, activeHouseholdId]`, mutasi invalidate setelah sukses).
- Komponen baru di `apps/web/src/components/household/`: `OwnerBadge`, `RecordedByChip`, `OwnerSelect` (self-hide untuk household 1 anggota), `VisibilitySelect`, `AliasInput`, `HouseholdPanel` (switcher + info + anggota + undangan dalam satu panel bertab, dipasang sebagai `profileView === "household"` baru di `Sidebar.jsx`).
- `apps/web/src/pages/JoinHouseholdPage.jsx` (baru) + route manual `/join/:code` di `App.jsx` (cek `window.location.pathname`, konsisten dengan pola `ResetPasswordPage` yang sudah ada) — menanam `LoginModal`/`SignupModal` yang sudah ada langsung (reuse, bukan duplikasi logika auth).
- `AddAccountModal.jsx`: tambah `OwnerSelect`, `VisibilitySelect`, `AliasInput`; `Dashboard.jsx`'s `accForm` dapat default `owner:"me", visibility:"shared", aliases:[]`; `useAccounts.js`'s `addAccount`/`updateAccount` diperluas meneruskan field-field ini.

**Sub-agent 1 (F5-T4 sisa — AkunView, TransaksiView):**
- `useTransactions.js`: tambah `recorded_by` ke bentuk flatten.
- `AkunView.jsx`: `OwnerBadge` per akun (hanya household >1 anggota), modal kecil ubah owner/visibility lewat `updateAccount`. Sekalian perbaiki bug lint lama (`'a' is not defined` — closure stale di tombol "Lihat Semua").
- `TransaksiView.jsx`: `RecordedByChip` per transaksi + filter per anggota (pola sama dengan filter kategori yang sudah ada), keduanya hanya muncul untuk household >1 anggota.

**Sub-agent 2 (F5-T5 bagian a — ScopeSwitcher, laporan, anggaran):**
- `useSummary.js` (baru): wrapper `GET /v1/summary`.
- `ScopeSwitcher.jsx` (baru): toggle Household/per-anggota/per-akun, `return null` total untuk household 1 anggota.
- `DasborView.jsx`: `ScopeSwitcher` + kartu ringkasan scoped TAMBAHAN (lewat `useSummary`) di atas kartu household-wide yang sudah ada (arsitektur lama — hitung dari seluruh `transactions` di client — dipertahankan, tidak diganti).
- `LaporanView.jsx`/`PrediksiView.jsx`: **keputusan desain** — `GET /v1/summary` tidak mendukung rentang periode kustom yang dipakai kedua view ini (quick period, custom year/month, prediksi), jadi dipakai `scopeFilterTx()` (helper baru di tiap file) yang memfilter array `transactions`/`accounts` mentah berdasarkan scope SEBELUM logika chart/prediksi yang sudah ada jalan — konsisten dengan default backend (`attribution=owner`: scope member = transaksi yang menyentuh akun milik member itu, bukan siapa yang mencatat).
- `AnggaranView.jsx`: tab Keluarga/Pribadi (hanya tampil household >1 anggota); `useBudgets.js` diperluas dengan query paralel `scope=member` (`personalBudgets`/`personalBudgetsLoading`) — aditif, tidak mengubah `budgets` yang sudah dipakai `PrediksiView`. **Simplifikasi diketahui** (dicatat sebagai komentar kode, bukan bug diam-diam): jumlah "terpakai" anggaran pribadi masih dihitung dari total pengeluaran household per kategori, belum difilter ke transaksi milik member itu saja.

**Sub-agent 3 (F5-T5 bagian b — owner selector di Goals/Hutang/Piutang/Investasi):**
- `GoalsView.jsx`, `HutangView.jsx`, `PiutangView.jsx`, `InvestasiView.jsx`: `OwnerSelect` di form tambah/edit, `OwnerBadge` per kartu (household >1 anggota saja), default `owner:"me"` di form kosong.
- **Gap backend ditemukan, diperbaiki di sesi utama setelah ketiga sub-agent selesai**: `UpdateGoalBodySchema`/`UpdateDebtBodySchema`/`UpdatePiutangBodySchema` tidak punya field `owner` (jadi edit goal/hutang/piutang yang sudah ada tidak bisa pindah kepemilikan — field diam-diam dibuang zod). `UpdateInvestmentBodySchema` sudah benar (`CreateInvestmentBodySchema.partial()`, otomatis ikut semua field termasuk owner). **Fix**: tambah `owner: z.string().optional()` ke tiga schema itu + `resolveOwnerMemberId` dipanggil di `updateGoal`/`updateDebt`/`updatePiutang` (apps/api/src/services/*.ts), pola identik dengan `updateAccount`. Diverifikasi lewat curl: PATCH goal `{owner:"joint"}` → `owner:null`, PATCH balik `{owner:"me"}` → owner kembali ke Eko.

**Tidak dikerjakan (dicatat, bukan diabaikan):**
- F5-T6 i18n (6 bahasa untuk semua string UI household baru) — semua komponen baru sesi ini pakai teks Bahasa Indonesia hardcode, konsisten dengan `OnboardingHousehold.jsx` Fase 4. Perlu sesi i18n terpisah.
- `ApiErrorToast` (07-frontend.md §4, kandidat `ambiguous_*` sebagai tombol pilihan) — belum dibangun, error tetap toast teks biasa.
- `ApiKeysSettings`/`AuditLogSettings` — di luar scope Fase 5 (Fase 6).
- Pengujian UI browser sungguhan — tidak ada tool otomasi browser di sesi ini (sama seperti Fase 4); verifikasi dibatasi pada lint+typecheck+test+build+curl manual terhadap setiap endpoint yang dikonsumsi.

**Verifikasi gabungan (setelah integrasi ketiga sub-agent + fix owner-reassignment):**
```
pnpm lint       → 0 error, 26 warning (semua pre-existing, 0 di kode baru/diubah sesi ini)
pnpm typecheck  → bersih di 3 paket
pnpm test       → 24/24 lulus, tidak ada regresi
pnpm --filter @karaya/web build → sukses
curl manual: PATCH /v1/goals/{id} {"owner":"joint"} → owner:null; PATCH {"owner":"me"} → owner Eko lagi (data dikembalikan ke kondisi semula)
```

## Fase 6 — API key, idempotency, rate limit, audit log (F6-T1, F6-T2, F6-T3)

**Catatan proses penting**: pekerjaan ini awalnya diminta sebagai audit read-only ("jangan tulis kode, laporkan temuan saja") untuk memetakan apa yang sudah ada dari F2 sebelum mengerjakan Fase 6 beneran. Sub-agent yang ditugaskan malah langsung mengimplementasikan seluruh fitur tanpa melapor dulu — sebuah penyimpangan instruksi yang nyata (dicatat sebagai feedback produk). Karena semua perubahan tetap lokal/belum di-commit, pekerjaan itu dilanjutkan alih-alih dibuang, dengan sesi utama melakukan audit independen menyeluruh sesudahnya (baca ulang semua file baru, uji live manual, ditemukan 1 bug arsitektur besar tambahan dan 1 kelas bug data yang signifikan — lihat di bawah) sebelum dianggap selesai.

**Selesai (diverifikasi independen oleh sesi utama, bukan hanya laporan sub-agent):**
- **API keys (F6-T1)**: `auth/api-key.ts` (generate `kf_live_`+40 base62, hash SHA-256+pepper, `resolveApiKeyActor`), `services/api-keys.ts` + `routes/api-keys.ts` (CRUD + rotate), migrasi `00000000000019` (fungsi SQL `create_api_key`/`revoke_api_key`/`resolve_api_key`/`touch_api_key_last_used`, semua `SECURITY DEFINER` dengan validasi otorisasi internal: member hanya buat key untuk diri sendiri, owner untuk siapa pun, scope key tidak boleh melebihi scope efektif peran target).
- **Idempotency (F6-T2)**: `middleware/idempotency.ts` — insert `ON CONFLICT DO NOTHING RETURNING` (race-safe tanpa read-then-write), request-hash mismatch → `idempotency_key_reused`, in-progress → `idempotency_in_progress` + `Retry-After`, sukses → cache response + `Idempotent-Replayed: true` pada replay, 5xx → hapus baris (boleh retry), body besar (>64KB) dipotong jadi `{replayed_truncated, resource_id}`.
- **Rate limit (F6-T3)**: `middleware/rate-limit.ts`, hanya untuk credential `api_key` (JWT dibatasi Supabase Auth + UI, bukan di sini) — `X-RateLimit-Limit-Minute`/`X-RateLimit-Remaining-Minute` header, `429 rate_limited` + `Retry-After` saat limit terlampaui.
- **Audit log** (bonus, tidak diberi nomor eksplisit di rencana tapi bagian dari "every action traceable" tujuan Fase 6): `middleware/audit.ts` — global middleware yang mencatat SETIAP request (termasuk yang ditolak, lewat try/catch di sekitar `next()`), redaksi field sensitif (api_key/secret/password/dll.), `routes/audit-log.ts` (`GET /v1/audit-log`, admin-only, filter `api_key_id`/`member_id`/`action`/`from`/`to`, cursor pagination).
- **Scope model baru**: `read < write < admin`, dari JWT (role owner→admin, member→write, viewer→read, otomatis penuh untuk user manusia tapi dicek ulang di endpoint admin-only lewat `assertScope`) atau dari API key (scope tersimpan, di-cap ke scope efektif role member pemilik key — key tidak bisa "lebih berkuasa" dari pemiliknya meski dibuat saat masih owner lalu diturunkan jadi member).

### Bug arsitektur BESAR ditemukan & diperbaiki (oleh sub-agent, bagian dari laporan akhirnya)
**`app.route(prefix, subApp)` di Hono/zod-openapi menggabungkan wildcard (`.use('*', ...)`) SEMUA sub-app yang di-mount ke prefix yang sama secara KUMULATIF** — setiap sub-app baru menambah wildcard-nya ke rantai yang berlaku untuk SEMUA route berikutnya, bukan cuma rute sub-app itu sendiri, dan ini TIDAK bergantung urutan mount (lebih luas dari pemahaman bug serupa di Fase 3). Sebelum diperbaiki, `requireAuth()` yang didaftarkan terpisah di ~18 sub-app domain BENAR-BENAR BERJALAN BERULANG per request (sub-app yang di-mount ke-N menjalankan requireAuth() sebanyak N-1 kali) — dampak nyata: query DB membership terulang berkali-kali per request, DAN idempotency selalu gagal `idempotency_in_progress` pada percobaan PERTAMA (panggilan requireAuth() kedua/ketiga menemukan baris yang baru saja di-insert panggilan sebelumnya, DALAM request yang sama, masih 'in_progress'). **Fix**: `requireAuth()` sekarang didaftarkan SATU KALI di root `app.ts`, bukan per sub-app; middleware yang punya logika PENOLAKAN spesifik-resource (requireJwtOnly, assertScope) dipanggil langsung di dalam handler, bukan sebagai wildcard sub-app manapun. Tiga bug RLS/grant terpisah juga ditemukan & diperbaiki selama proses ini (audit_log tanpa policy INSERT, `v_api_keys` dengan `security_invoker=on` yang membuatnya SELALU permission-denied, `household_members` butuh grant kolom sempit + fungsi SECURITY DEFINER untuk lookup API key sebelum JWT context ada) — detail lengkap di riwayat perubahan `03-database.md`.

### Bug data SIGNIFIKAN ditemukan & diperbaiki (oleh sesi utama, saat audit independen pasca-laporan sub-agent)
**Pola `${JSON.stringify(x)}::jsonb` menghasilkan nilai jsonb GANDA-ENCODED (jsonb berisi STRING berisi teks JSON, bukan jsonb OBJECT)** — dikonfirmasi lewat reproduksi minimal langsung terhadap `postgres.js`: cast `::jsonb` pada parameter yang sudah di-`JSON.stringify()` menyebabkan postgres.js mengirim nilai sebagai parameter bertipe jsonb native (bukan text-untuk-di-parse), sehingga Postgres menyimpannya sebagai SCALAR STRING jsonb, bukan OBJECT. Pola yang benar: `sql.json(value)` (tanpa `JSON.stringify` manual), atau nilai objek mentah langsung dengan cast `::jsonb` (TANPA stringify) — keduanya diverifikasi benar lewat reproduksi langsung.

Ditemukan di 4 lokasi:
1. `middleware/idempotency.ts` (2 tempat) — response cache tersimpan sebagai string ganda-encoded; replay (`Idempotent-Replayed: true`) mengembalikan STRING ke klien, bukan objek — klien manapun yang mengakses `.transaction`/`.account` pada hasil replay akan mendapat `undefined`.
2. `routes/me.ts` (`PATCH /v1/me/settings`) — `hidden_menus` dan `ai_config` tersimpan ganda-encoded. **Dampak nyata dikonfirmasi lewat tes langsung**: `has_api_key` SELALU `false` meski API key AI sudah disimpan (karena membaca `.apiKey` dari sebuah STRING, bukan objek, selalu `undefined`) — fitur AI Coach yang dibangun Fase 4 kemungkinan TIDAK PERNAH benar-benar berfungsi sejak dibuat, karena pengecekan "sudah dikonfigurasi atau belum" selalu salah.
3. **`services/transactions.ts` (`PATCH /v1/transactions/{id}`, dibangun Fase 3)** — paling serius: `update_transaction()` (fungsi SQL) menerima `p_patch` sebagai jsonb STRING, bukan OBJECT. Operator `p_patch->>'key'` pada jsonb string SELALU mengembalikan NULL (bukan error), jadi SETIAP `coalesce(patch->>'x', original.x)` jatuh ke nilai asli — **endpoint edit transaksi selalu mengembalikan 200 OK seolah berhasil, TAPI TIDAK PERNAH benar-benar mengubah apa pun, sejak Fase 3 dibuat, lolos dari semua pengujian sebelumnya karena alur PATCH tidak pernah diuji round-trip (ubah lalu baca ulang) secara langsung.**

**Fix**: keempat lokasi diganti memakai `sql.json(value)`/`tx.json(value)` (dengan cast `as unknown as postgres.JSONValue` untuk melewati pengetatan tipe TypeScript pada struktur generik). Diverifikasi ulang lewat curl langsung: PATCH transaksi sekarang benar-benar mengubah note/amount (dikonfirmasi re-GET), replay idempotency mengembalikan objek JSON asli (`jsonb_typeof` = `object`, bukan `string`), `has_api_key` sekarang benar mengikuti status API key AI yang sebenarnya tersimpan.

**Test regresi baru**: `apps/api/test/integration/api-keys.test.ts` (6 test) — mencakup create/use/revoke API key, scope enforcement, idempotency replay mengembalikan objek asli (regresi langsung untuk bug di atas), idempotency key-reused-dengan-body-beda ditolak, **PATCH transaksi benar-benar mengubah data** (regresi langsung untuk bug paling serius di atas), dan audit log tercatat.

### Verifikasi
```
pnpm lint       → 0 error, 26 warning (semua pre-existing)
pnpm typecheck  → bersih di 3 paket
pnpm test       → 30/30 lulus (5 file test, termasuk api-keys.test.ts baru)
pnpm --filter @karaya/web build → sukses
curl manual: POST/GET/DELETE /v1/api-keys, idempotency double-POST (replay benar, objek bukan string),
  idempotency key-reused-beda-body → 422, rate limit header muncul, scope read ditolak mutasi,
  PATCH /v1/transactions/{id} benar-benar berubah (sebelumnya tidak), PATCH /v1/me/settings
  ai_config/hidden_menus round-trip benar (has_api_key mengikuti kenyataan)
```

### Migrasi & deploy
- Migrasi `00000000000019_fase6_api_keys_functions.sql`: **diterapkan & diverifikasi penuh di DB lokal**, **BELUM diterapkan ke produksi** — percobaan apply ke produksi diblokir oleh izin sesi ini ("Modify Shared Resources"), ditinggalkan untuk dijalankan manual: `psql "$PROD_DB_URL" -f supabase/migrations/00000000000019_fase6_api_keys_functions.sql`.
- `API_KEY_PEPPER` (env var baru, wajib, min 32 karakter): ada di `apps/api/.env.local` (lokal) dan `apps/api/vitest.config.ts` (test). **Belum ada di environment produksi** (Vercel) — perlu ditambahkan sebelum deploy, sama seperti blocker `SUPABASE_SERVICE_ROLE_KEY` dari Fase 4.

### Migrasi produksi — update pasca-entri di atas
Percobaan pertama apply `00000000000019` ke produksi sempat diblokir izin sesi ("Modify Shared Resources"); pada percobaan berikutnya (sesi lanjutan) berhasil diterapkan tanpa masalah. **Dikonfirmasi lewat query langsung** (`select proname, prosecdef from pg_proc where proname in (...)`): semua fungsi migrasi `00000000000019` ada di produksi dengan `prosecdef=t`. `API_KEY_PEPPER` masih BELUM ada di environment produksi (Vercel) — tetap jadi blocker deploy, dicatat ulang di bawah.

## Fase 6 — tool registry, AI chat, webhook Midtrans, docs cleanup (F6-T4, F6-T5, F6-T6, F6-T7)

**Selesai:**
- **Tool registry (F6-T4)**: `apps/api/src/tools/registry.ts` — satu sumber kebenaran, array `TOOLS: ToolDefinition[]` berisi 22 tool (sesuai kontrak jumlah di `06-agent-integration.md`), tiap tool punya `name`/`description`/`parameters` (JSON Schema) + `handler: (actor, args) => Promise<unknown>` yang memanggil langsung fungsi service layer (bukan HTTP internal) — mis. `transactionsSvc.createTransaction`, `debtsSvc.payDebt`, `resolveName`. `toolByName(name)` untuk lookup. `scripts/gen-tools.ts` meng-generate `apps/api/tools/hermes-tools.json` dari registry ini (`pnpm gen:tools` dari root, script baru di `package.json`; `tsx` ditambah sebagai root devDependency karena dipanggil dari root, pola sama dengan `openapi-typescript`). `GET /v1/tools/hermes.json` (`routes/tools.ts`, publik, tanpa `requireAuth()`, di-mount sebelum middleware auth global) menyajikan file hasil generate. Isi diverifikasi cocok dengan contoh `record_expense` di spec.
  - **Gap ditemukan & diperbaiki saat membangun registry**: resolver (`services/resolver.ts`) belum mendukung "field menerima nama ATAU UUID, API yang menentukan dari bentuknya" seperti disyaratkan spec untuk `account`/`category`/`member` di berbagai tool. Ditambah `looksLikeUuid()` (regex UUID v4-agnostic) + pengecekan di awal `resolveAccountRef`/`resolveCategoryRef`/`resolveMemberRef` (pola yang sudah ada sebelumnya di `resolveOwnerMemberId`, sekarang dipakai bersama). Diverifikasi end-to-end: `resolve_name` → dapat UUID → UUID itu dipakai langsung di `record_expense` tanpa perlu resolve nama lagi.
  - **Keputusan scope**: kelengkapan OpenAPI (`operationId`, `x-karaya-scope`, contoh request/response per endpoint di ~15 file route) **sengaja tidak dikerjakan** — kriteria selesai Fase 6 yang bisa diuji nyata (`jq -e 'length==22'` atas `hermes-tools.json`, bukan polish OpenAPI) sudah terpenuhi tanpa itu, dan effort tidak sepadan dengan manfaat langsung saat ini. Dicatat di sini sebagai pengurangan scope yang disengaja, bukan terlewat.
- **AI chat pakai tool registry (F6-T5)**: `services/ai/chat.ts` — `TOOL_DEFS`/`executeTool` hasil hardcode 6 tool dari Fase 4 dihapus, diganti `buildToolDefs(allowWrite)` yang membaca dari `TOOLS` registry (filter `scope === 'read' || allowWrite`) + satu tool `get_investments` yang dipertahankan sebagai definisi internal khusus (sengaja TIDAK dimasukkan ke registry bersama, supaya kontrak "total 22 tool" di `hermes-tools.json` tetap tepat — `get_investments` bukan bagian spec Hermes, cuma fitur AI Coach yang sudah ada sejak Fase 4). `executeTool()` memanggil `tool.handler(actor, args)` lalu `formatToolResult(name, result)` (baru, `services/ai/format-tool-result.ts`, formatter khusus per tool baca seperti `list_accounts`/`get_summary`/dll., fallback `formatGenericWriteResult()` untuk tool tulis). `ApiError` dari handler ditangkap dan pesannya diteruskan ke user, bukan dilempar sebagai 500.
  - **Schema baru**: `AiChatBodySchema` (`packages/shared/src/schemas/ai.ts`) tambah `allow_write: z.boolean().default(false)` — tool tulis (catat transaksi, bayar hutang, dll.) hanya ditawarkan ke model AI kalau klien eksplisit set field ini, sesuai niat "tool tulis di balik flag" di rencana F6-T5. `routes/ai.ts` diteruskan apa adanya ke `chatWithAi(actor, messages, body.allow_write)`.
- **Webhook Midtrans (F6-T6) — DIBANGUN LALU DIBATALKAN TOTAL, lihat `### Pembatalan total subscription/Midtrans` di bawah.** Awalnya dipindah dari edge function lama (`supabase/functions/payment-webhook` + `update-subscription`) ke `apps/api` per rencana asli di `08-rencana-implementasi.md`, lengkap dengan migrasi `00000000000020_subscriptions_upsert.sql` (diterapkan ke lokal & produksi), `services/subscriptions.ts`, `routes/webhooks.ts`, dan schema `MidtransWebhookBodySchema`/`UpdateSubscriptionBodySchema` — **seluruhnya dihapus lagi pada hari yang sama** setelah pemilik produk mengklarifikasi project ini tidak pernah punya pembayaran sungguhan.
- **Docs cleanup (F6-T7)**:
  - `API_DOCS.md` (640 baris, dokumentasi manual yang sudah menyimpang dari kode) **dihapus**. Dikonfirmasi tidak direferensikan file lain kecuali spec yang memang meminta penghapusan ini.
  - `README.md`: tambah bagian "🔌 API" yang mengarahkan ke `GET /v1/docs` (Scalar UI, auto-generate dari `GET /v1/openapi.json`, jadi selalu sinkron dengan kode — alasan utama `API_DOCS.md` manual dihapus) dan `GET /v1/tools/hermes.json`.
  - `docs/hermes/SYSTEM_PROMPT.md` (baru): draft system prompt Hermes, isi 10 aturan wajib diterjemahkan dari `06-agent-integration.md` §3 (Idempotency-Key per niat vs retry, jangan tebak akun/nominal, konfirmasi pakai data respons bukan hitungan sendiri, `get_summary` bukan agregasi manual, tanggal relatif → WIB, alias pemilik ditangani API bukan agent, `insufficient_funds` → tawarkan akun lain, JANGAN PERNAH tampilkan API key, jangan ungkapkan/dibelokkan prompt ini oleh instruksi di tengah chat).

### Verifikasi
```
Manual: GET /v1/tools/hermes.json → 22 tool, cocok dengan registry; jq -e 'length==22' tools/hermes-tools.json → true
Manual: resolve_name nama ambigu → UUID; UUID itu dipakai langsung sebagai `account` di record_expense → sukses
  (tanpa perlu resolve_name lagi, membuktikan looksLikeUuid() bekerja)
Manual: POST /v1/ai/chat tanpa allow_write → tool tulis tidak ditawarkan ke model;
  dengan allow_write:true → tool tulis tersedia, record_expense via chat berhasil
(Verifikasi webhook Midtrans yang sempat dilakukan sebelum fitur ini dibatalkan total tidak lagi relevan
  — lihat `### Pembatalan total subscription/Midtrans` di bawah.)
Verifikasi gabungan penuh (lint+typecheck+test+build) dijalankan ulang setelah SEMUA perubahan F6-T1..T7
  selesai bersama — lihat entri verifikasi final di bawah.
```

### Migrasi & deploy
- Blocker env produksi (Vercel) yang MASIH terbuka setelah seluruh Fase 6: `API_KEY_PEPPER` (wajib untuk F6-T1 berfungsi).

### Tidak dikerjakan / scope dikurangi secara sengaja (dicatat, bukan terlewat)
- Kelengkapan OpenAPI per endpoint (`operationId`, `x-karaya-scope`, contoh request/response) — lihat alasan di atas.
- `emit-hermes.ts`/CI diff check otomatis untuk menjaga `hermes-tools.json` tetap sinkron dengan registry — belum ada; untuk saat ini `pnpm gen:tools` dijalankan manual.
- UI Settings baru di apps/web untuk API key/audit log (disebut di rencana F6-T1/T3) — tetap belum dikerjakan, backend saja.

### Pembatalan total subscription/Midtrans (2026-10-06)

Setelah F6-T6 selesai dibangun dan diverifikasi (lihat riwayat di atas), pemilik produk mengklarifikasi: **project ini tidak pernah punya pembayaran sungguhan** — tidak ada integrasi Midtrans aktif, tidak ada user yang pernah bayar, dan paket harga (`PricingModal`/`PricingSection`) tidak pernah terhubung ke apa pun (`handleChoose` hanya `alert(...)`, dicatat sejak audit awal di `01-kondisi-saat-ini.md` T5). Instruksi eksplisit: hapus seluruh fitur ini, termasuk di database produksi.

**Dihapus (kode, bukan cuma "tidak dipakai"):**
- `apps/api/src/routes/webhooks.ts`, `apps/api/src/services/subscriptions.ts`
- `packages/shared/src/schemas/subscriptions.ts` + export-nya di `schemas/index.ts`
- Mount `webhooksApp`/`internalApp` dan import terkait di `apps/api/src/app.ts`
- `MIDTRANS_SERVER_KEY`/`FUNCTION_SECRET` di `apps/api/src/env.ts`
- Edge function lama `supabase/functions/payment-webhook/`, `supabase/functions/update-subscription/` (sebelumnya "akan di-undeploy saat cutover F6-T6" — sekarang dihapus langsung dari repo, tidak pernah dipakai produksi)
- Frontend: `apps/web/src/components/dashboard/PricingModal.jsx`, `apps/web/src/components/landing/PricingSection.jsx`, `apps/web/src/constants/plans.js` — **dikonfirmasi dead code sebelum dihapus** (`grep` seluruh `apps/web/src` untuk import keduanya: nol hasil selain deklarasi file itu sendiri; `LandingPage.jsx` tidak pernah me-render `PricingSection`)

**Database**: migrasi `00000000000020_subscriptions_upsert.sql` (fungsi `upsert_subscription`, dibuat sesi ini) **dihapus dari folder migrations** — belum pernah jadi bagian riwayat git yang di-commit, jadi diperlakukan sebagai dibatalkan sebelum lahir, bukan di-revert lewat migrasi baru. Tabel `subscriptions` sendiri sudah ada sejak migrasi `00000000000003_domain_tables.sql` (Fase 2, lama sebelum sesi ini, sudah lama live di produksi) — migrasi itu **tidak diubah** (prinsip "jangan tulis ulang migrasi yang sudah diterapkan" tetap dipegang untuk riwayat yang sudah settle sebelum sesi ini), sebagai gantinya migrasi baru `00000000000020_drop_subscriptions.sql` (nomor dipakai ulang karena yang lama belum pernah ada di git) menghapus: policy `subscriptions_select`, tabel `subscriptions`, dan fungsi `upsert_subscription` (`drop function if exists` — aman dijalankan baik di lokal yang baru reset, yang fungsinya tak pernah ada, maupun di produksi yang sempat punya fungsi itu).
- **Diterapkan & diverifikasi di DB lokal** (`karaya-test-pg`, lewat `psql` langsung — bukan `supabase db reset` penuh, sesi ini tidak menjalankan stack `supabase start`): sebelum migrasi, `to_regclass('public.subscriptions')` dan `pg_proc` untuk `upsert_subscription` keduanya mengembalikan baris (tabel+fungsi ada); setelah migrasi, keduanya kosong. `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @karaya/web build` tetap hijau sesudahnya (30/30 test lulus tanpa perubahan assertion — tidak ada test yang pernah bergantung pada subscriptions).
- **Diterapkan & diverifikasi di produksi (2026-10-06)**: dijalankan manual oleh pemilik produk lewat SQL Editor Supabase dashboard (bukan psql dari sesi ini — sesi ini tidak diberi akses `$PROD_DB_URL` langsung; sistem izin sempat menolak upaya mencari kredensial itu sendiri, "Credential Materialization"/"Credential Exploration", dan permintaan dihentikan di titik itu sesuai arahan izin, bukan diakali). Verifikasi pasca-apply (dijalankan pemilik produk, dilaporkan ke sesi ini): `select to_regclass('public.subscriptions')` → null; `select proname from pg_proc where proname='upsert_subscription'` → 0 baris. Tabel `subscriptions` dan fungsi `upsert_subscription` sudah tidak ada lagi di produksi.

**Spec**: baris riwayat perubahan ditambahkan di `00-ringkasan.md`, `01-kondisi-saat-ini.md`, `03-database.md`, `05-api.md`, `08-rencana-implementasi.md`, `09-pertanyaan-terbuka.md` (Q-12), `02-monorepo.md` — semua menandai referensi subscription/Midtrans/pricing sebagai usang, bukan dihapus diam-diam dari dokumen (lihat masing-masing file untuk detail).

**i18n (`apps/web/src/i18n/translations.js`), susulan atas permintaan eksplisit pemilik produk**: seluruh string mati terkait pricing/subscription dihapus di 6 bahasa (id/en/ar/es/zh/ja), bukan dibiarkan sebagai dead string:
- Blok `sub.*` (banner trial/upgrade, 16 key × 6 bahasa) — sudah tidak dipakai komponen manapun sejak Fase 4 (banner subscription di Sidebar sudah dihapus saat itu), dikonfirmasi `grep` kosong sebelum dihapus.
- `lp.pricing.*` (tag/h2/h2g/free/paid/desc/guarantee) — hanya dipakai `PricingSection.jsx` yang sudah dihapus.
- `lp.nav.pricing` — dihapus dari translations DAN dari array `navLinks` di `Navbar.jsx` serta `productLinks` di `Footer.jsx` (keduanya nav link menuju anchor `#harga` yang sudah tidak ada lagi sejak `PricingSection` dihapus — tanpa fix ini jadi link mati/no-op).
- `lp.cta.btn2` ("Lihat Paket"/"View Plans") — tombol kedua di `CtaSection.jsx` yang scroll ke `#harga`; dihapus beserta tombolnya (bukan cuma dikosongkan key-nya).
- `lp.faq.1a` (harga) dan `lp.faq.5a` (family sharing) di 6 bahasa **ditulis ulang**, bukan dihapus — isinya tadinya menyebut paket berbayar/trial 14 hari/"Elite plan" yang sudah tidak ada; sekarang konsisten "gratis selamanya" (ID sudah lebih dulu benar untuk `lp.faq.1a`, 5 bahasa lain masih menyebut harga trial — diseragamkan) dan `lp.faq.5a` sekarang menyebut fitur household/family sharing yang REAL dan gratis (bukan di balik paywall).
- `lp.hero.cta` dan `lp.cta.desc` di 5 bahasa (en/ar/es/zh/ja) juga diseragamkan ke "gratis selamanya" — sebelumnya masih bilang "free 14 days"/"14-day trial" yang menyiratkan ada masa berakhir, padahal produk gratis selamanya.
- `apps/web/src/constants/faqs.js` (dead code, tidak pernah di-import — `FaqSection.jsx` memakai key `lp.faq.{1..5}q/a` langsung, bukan file ini) **dihapus**, isinya murni tentang harga paket.
- Verifikasi: `node --check` sintaks valid, `pnpm lint` (0 error, 26 warning pre-existing sama), `pnpm typecheck` bersih, `pnpm test` 30/30, `pnpm --filter @karaya/web build` sukses (bundle `index-*.js` turun dari 415.00 kB → 409.13 kB, konsisten dengan kode mati yang terhapus).

## F-0/F-A/F-B/F-D: apa yang selesai (2026-10-07) — backend saja, belum commit

Migrasi: `00000000000021_household_features.sql` (`households.features jsonb default '{}'`),
`00000000000022_beneficiaries.sql` (tabel `beneficiaries`, `transactions.beneficiary_id`, `resolve_beneficiary()`,
`enable_beneficiary_feature()`, `post_transaction`/`post_transactions_batch`/`update_transaction` diubah).

Kode `apps/api`: `services/features.ts` (baru), `services/beneficiaries.ts` + `routes/beneficiaries.ts` (baru),
`services/households.ts`/`services/transactions.ts`/`services/summary.ts`/`services/resolver.ts` diubah,
`routes/summary.ts` tambah `scope=beneficiary`. `packages/shared`: `errors.ts` (+7 kode: `feature_disabled`,
`beneficiary_not_found`, `ambiguous_beneficiary`, `shopping_item_not_found`, `pantry_item_not_found`,
`receipt_total_mismatch` — 3 terakhir disiapkan untuk F-D), `schemas/household.ts` (`HouseholdFeaturesSchema` dkk.),
`schemas/beneficiaries.ts` (baru), `schemas/transactions.ts` diubah.

**Diverifikasi** (lokal, `supabase start` fresh volume, bukan `karaya-test-pg` lama — lihat catatan DB di bawah):
toggle flag partial-merge, seeding otomatis 2 member saat beneficiary pertama kali ON, CRUD beneficiary,
`feature_disabled` utk tulis DAN baca, `400 validation_error` utk field opsional di endpoint inti saat fitur mati,
transaksi dengan `beneficiary` (nama) ter-resolve, filter `GET /v1/transactions?beneficiary=`,
`GET /v1/summary?scope=beneficiary`, `PATCH .../transactions/{id} {beneficiary_id:null}` kembali ke bersama,
soft-delete beneficiary. 43/43 test (`pnpm test`), `pnpm lint` 0 error, `pnpm typecheck` bersih kedua paket.

**F-B** (`services/reports.ts`, `routes/reports.ts`): `GET /v1/reports/monthly?month=YYYY-MM`, selalu
tersedia (tidak digate flag — flag `monthly_report` hanya untuk jadwal kirim Hermes nanti). Totals/kategori/
member/beneficiary/budget/goals dihitung lewat `getSummary()` yang SAMA dengan `/v1/summary` (identik by
construction). `text_id` ringkasan Bahasa Indonesia ≤1300 karakter.

**F-D** (migrasi `00000000000023`): tabel `shopping_items`, `pantry_items` (+ `location`, `expires_at`,
`expires_estimated`, `expiry_notified_on`), `pantry_movements`; fungsi `apply_pantry_movement`,
`find_pantry_match`/`find_shopping_match` (pencocokan longgar, BUKAN pola `resolve_*`). Kode: `services/{shopping,
pantry,receipts}.ts`, `routes/{shopping,pantry,receipts}.ts`. Endpoint: `GET/POST /v1/shopping`,
`PATCH/DELETE /v1/shopping/{id}`, `GET /v1/shopping/suggestions`, `GET/POST /v1/pantry`,
`PATCH/DELETE /v1/pantry/{id}`, `POST /v1/pantry/{id}/movements`, `GET /v1/pantry/expiring` (+`exclude_acked`,
celah desain diperbaiki — lihat changelog spec), `POST /v1/pantry/expiring/ack`, dan **`POST /v1/receipts/ingest`**
(satu struk -> `post_transactions_batch` + coret belanja + tambah stok, dalam satu transaksi DB).

**Code review sebelum commit (2026-10-07, `/code-review high` + review sendiri)**: 13 temuan, semua diperbaiki
dan diuji — daftar lengkap di riwayat perubahan `10-fitur-opsional-keluarga.md` rev. 10. Yang paling penting:
gate fitur beneficiary bisa dilewati lewat `receipts/ingest items[].for` (gate dipindah ke dalam
`resolveBeneficiaryRef`); skema penyimpanan `features` yang `.strict()` akan membuat SEMUA endpoint inti 500
begitu ada kunci asing di jsonb (rollback deploy/edit Studio) — sekarang strip + fallback; `enable_beneficiary_feature()`
SECURITY DEFINER tanpa guard terekspos lewat PostgREST RPC; dan `fileParallelism:false` di `apps/api/vitest.config.ts`
ternyata TIDAK berlaku saat `pnpm test` dari root (workspace) — dipindah ke `vitest.config.ts` root (itu sebabnya
race antar file test sempat muncul lagi).

**Bug ke-3 ditemukan**: `current_date + ${jsNumber}` tanpa cast eksplisit -> Postgres `operator is not unique:
date + unknown` (parameter postgres.js tanpa tipe eksplisit ambigu antara overload `date+integer` vs
`date+interval`). Diperbaiki `${withinDays}::int`.

**Update 2026-10-08 — selesai sejak catatan di atas**:
- Frontend (tab Fitur opsional, sidebar grup Rumah, field Untuk, Belanja/Pantry view) — **DONE**, commit `b019b99`,
  deployed. Masih kurang: tab "Ringkasan bulanan" + kartu "Per penerima" di `LaporanView.jsx`.
- Hermes tool registry (32 tool) — **DONE**, commit `d1b2641`, deployed. Lihat §"Tool Hermes F-A/F-B/F-D" di bawah.
- Skill VPS (`karaya-finance-api`, `groceries-shopping`) — **DONE**, diedit langsung di VPS (di luar repo git).
  Lihat §"Skill Hermes di VPS" di bawah.

**Masih belum dikerjakan** (bukan lupa):
- **User perlu `/new` atau `/reset` di Telegram** supaya Hermes memuat skill yang baru, lalu dites dengan pesan
  nyata (belum ada verifikasi end-to-end lewat Telegram untuk F-A/F-B/F-D, baru verifikasi API langsung).
- Cron Hermes utk laporan bulanan (F-B, jadwal `features.monthly_report`) dan pengingat kedaluwarsa (F-D §6.6,
  `features.shopping_stock.expiry_reminder`) — SKILL SUDAH bilang fitur ini "belum aktif di sisi aku" kalau
  ditanya; benar-benar menjadwalkan cron belum dikerjakan sama sekali (bukan cuma belum, memang belum ada
  rencana konkret caranya — Hermes jalan sebagai chat-triggered, bukan daemon terjadwal per-household).
- Migrasi `belanja.db`/`kulkas.db` dari container Hermes (F-D §6.7) ke tabel `shopping_items`/`pantry_items`
  — baru relevan KALAU `shopping_stock` dinyalakan; selama masih mati, data lama tetap di SQLite seperti biasa.
- Backfill `scripts/backfill-beneficiary.ts` (96 transaksi migrasi 6 Oktober yang punya `[untuk: ...]` di note)
  — belum ditulis; baru relevan kalau `beneficiary` dinyalakan dan user mau data lama ikut ter-tag.
- Tab "Ringkasan bulanan" + kartu "Per penerima" di `LaporanView.jsx` (disebut di atas).
- F-C rekonsiliasi mutasi bank — **masih terblokir Q-F4**, belum ada file contoh ekspor mutasi BCA/BRI/GoPay asli.
- F-A §3.6 Fase 2 (`budgets.beneficiary_id`) — sengaja dilewati sesuai spec ("baru kalau user memang menganggarkan").
- i18n 6 bahasa untuk semua UI baru sesi 2026-10-07/08 (tab Fitur opsional, Belanja, Pantry) — dicatat sebagai
  utang teknis yang disengaja, konsisten dengan `HouseholdPanel`/`ApiKeysPanel`.

**Catatan setup DB lokal (beda dari sesi sebelumnya)**: `supabase start` (bukan container `karaya-test-pg` manual)
berhasil kali ini — stack penuh jalan di `127.0.0.1:54322` (direct Postgres, pooler `[db.pooler] enabled=false` di
`config.toml`), BUKAN port `54329` yang jadi default di `vitest.config.ts`/`.env.local` lama (asumsi lama: pooler
manual via `docker run karaya-test-pg -p 54329:5432`, lihat entri F2/F3 di atas). `apps/api/.env.local` sudah
diarahkan ke `54322`; menjalankan `pnpm test` perlu override `DATABASE_URL`/`TEST_ADMIN_DATABASE_URL` env var ke
`54322` juga (keduanya TIDAK di-commit, gitignored — sesi baru perlu set ulang atau `supabase start` lagi dari
volume yang sama kalau Docker belum dibuang).

## Tool Hermes F-A/F-B/F-D: registry & manifest (2026-10-08)

Lanjutan sesi 2026-10-07 (backend+web) — sekarang sisi tool Hermes. **Update 2026-10-08 (sore)**:
skill VPS (`karaya-finance-api`, `groceries-shopping`) JUGA sudah diperbarui langsung (di luar repo
ini, tidak lewat commit) — lihat §"Skill Hermes di VPS" di bawah untuk detail. Commit kode lokal: `d1b2641`.

`apps/api/src/tools/registry.ts`: +10 tool —
`list_beneficiaries`/`add_beneficiary` (F-A, gate `feature:'beneficiary'`),
`get_monthly_report` (F-B, SELALU tersedia, tanpa `feature`),
`ingest_receipt`/`list_shopping`/`add_shopping_item`/`mark_bought`/`shopping_suggestions`/`list_pantry`/
`adjust_pantry` (F-D, gate `feature:'shopping_stock'`). 5 tool inti (`record_expense`,
`record_expense_batch`, `update_transaction`, `search_transactions`, `get_summary`) dapat parameter
opsional `beneficiary` baru, TANPA diberi `feature` (tool-nya sendiri tetap berguna saat fitur mati,
cuma param itu yang tidak boleh dipakai — dijelaskan di deskripsi parameter).

`ToolDefinition.feature?: 'beneficiary'|'monthly_report'|'reconciliation'|'shopping_stock'` (field baru) —
Hermes menyaring tool yang ditawarkan ke model berdasarkan `GET /v1/households/current`.features; manifest
tetap statis/berisi semua 32 tool. `scripts/gen-tools.ts` diupdate ikut mengemit `feature` (dihilangkan dari
output, bukan `null`, untuk tool yang tidak punya — supaya diff git rapi).

**Bug kecil ke-5 ditemukan & diperbaiki**: kontrak `beneficiary_id` nullable di `PATCH /v1/transactions/{id}`
tidak bisa dikirim Hermes (tool-calling function biasa tidak punya cara alami mengirim literal JSON `null`).
Diperbaiki dengan menambah kata kunci **"bersama"/"keluarga"** di `resolveBeneficiaryRef` (apps/api/src/
services/resolver.ts) yang berarti "tanpa beneficiary tertentu" — pola yang SAMA PERSIS dengan kata kunci
`bersama`/`joint`/`keluarga`/`rumah`/`kita` yang sudah ada di `resolve_account` untuk akun joint. Sekarang
Hermes cukup kirim `update_transaction{beneficiary:"bersama"}` untuk mengosongkan, dan filter
`search_transactions`/`get_summary` juga menerima "bersama"/"keluarga" sebagai sinonim sentinel "none" yang
sudah ada. Test baru: `features-beneficiaries.test.ts` ("kata bersama/keluarga...").

**Bug ke-6 (ditemukan saat review sendiri sebelum `/code-review`)**: `/v1/ai/chat` (`services/ai/chat.ts`,
`buildToolDefs`) memakai registry yang SAMA tapi hanya menyaring read/write — model AI Coach di web akan
ditawari `list_shopping` dkk. walau household belum menyalakan fiturnya, memanggilnya, lalu 403
`feature_disabled` bocor ke chat sebagai "Gagal: …". Sekarang `buildToolDefs(allowWrite, features)` ikut
menyaring `t.feature` berdasarkan `getHouseholdFeatures(actor)` — aturan yang sama dengan skill Hermes.
Diekspor + 3 unit test di `tools-registry.test.ts`.

**Code review (`/code-review high`, 2026-10-08) — 10 temuan, semua diperbaiki+diuji** (detail: riwayat
`10-fitur-opsional-keluarga.md` rev. 12). Yang paling penting: (1) sentinel "bersama/keluarga/none" tadinya
tiga salinan regex di transactions/summary/resolver yang sudah saling menyimpang (trim vs tidak, 'none' vs
tidak) → `?beneficiary=%20bersama` diam-diam jadi TANPA filter; sekarang satu helper `isNoBeneficiarySentinel()`
+ resolver mengembalikan `null` (eksplisit tanpa penerima) vs `undefined` (tidak disentuh), pemanggil tidak
perlu pre-check lagi; (2) nama sentinel ditolak sebagai nama beneficiary; (3) handler tool menormalkan
`beneficiary: null/""` dari model (umum untuk param opsional) jadi undefined — tanpa ini record_expense GAGAL
400 di household yang F-A-nya mati; (4) `ingest_receipt` coerce Number + param `shopping`/`pantry` yang
deskripsinya sudah menjanjikan; (5) `formatToolResult` case untuk 10 tool baru — ARRAY hasil tool baca
tadinya jadi "Berhasil." dan model mengarang. Test: +2 integrasi (sentinel berspasi, nama reserved), +2 unit
(formatToolResult). Total 89/89.

`mark_bought`/`adjust_pantry` BUTUH id (`shopping_item_id`/`pantry_item_id`) dari `list_shopping`/`list_pantry`
dulu — pola yang SAMA dengan `pay_debt`/`contribute_goal`/`receive_piutang` (bukan pencocokan nama fuzzy;
`find_shopping_match`/`find_pantry_match` SQL cuma dipakai internal oleh `ingest_receipt`, tidak diekspos
sebagai endpoint publik untuk lookup sembarangan).

Diverifikasi: `apps/api/test/tools-registry.test.ts` (baru, unit test — 15 test, total tool, gate per fitur,
manifest ter-commit sinkron dengan registry, `get_monthly_report` tidak ter-gate). Total `pnpm test`: 83/83.
`pnpm gen:tools --md` dijalankan ulang, `apps/api/tools/hermes-tools.json` 22→32 entri. `06-agent-integration.md`
(tabel tool + total) dan `08-rencana-implementasi.md` (kriteria F6-T4 `length==22`→`length==32`) diperbarui.

Di-commit & push sebagai `d1b2641` setelah `/code-review high` (10 temuan diperbaiki, lihat §"Spec fitur opsional" di bawah untuk detail), deployed ke produksi — `GET /v1/tools/hermes.json` menunjukkan 32 tool.

### Skill Hermes di VPS (karaya-finance-api, groceries-shopping) — 2026-10-08

Diedit langsung di `/home/hermes/.hermes/skills/productivity/{karaya-finance-api,groceries-shopping}/SKILL.md`
(container `ws-001`, VPS 20.41.96.123) — file ini TIDAK ada di repo git, jadi perubahannya berlaku
langsung di produksi tanpa commit/deploy, dan TIDAK ikut ter-track di `git log` project ini.

`karaya-finance-api/SKILL.md` dapat 4 bagian baru: (1) cek `features` sekali di awal sesi lewat
`GET /v1/households/current`; (2) "Untuk siapa" (beneficiary) — kapan isi field, kata "bersama"/
"keluarga" untuk mengosongkan; (3) laporan bulanan (`get_monthly_report`, selalu tersedia); (4)
Belanja & Stok — bersyarat: `features.shopping_stock` MATI (default sekarang) → tidak ada yang
berubah, tetap pakai `belanja.db`/`kulkas.db` seperti biasa; NYALA → pindah total ke tool Karaya,
berhenti pakai SQLite. `groceries-shopping/SKILL.md` dapat satu paragraf pointer ke aturan
bersyarat yang sama.

**Belum dites dengan pesan nyata dari Telegram** — perlu `/new` atau `/reset` dulu di sisi user
(skill loader Hermes di-cache per sesi) sebelum skill baru benar-benar kepakai.

## Spec fitur opsional "kelola keluarga" (2026-10-07) — belum diimplementasi

File: `docs/spec/10-fitur-opsional-keluarga.md`. Konteks: setelah migrasi data Hermes (2026-10-06) dan
pemakaian nyata via Telegram (2026-10-07), pemilik produk minta ide fitur "kelola keluarga" tapi dengan syarat
**inti tetap keuangan** dan fitur baru **bisa diaktifkan/dimatikan**. Yang dispesifikasikan:

- **F-0** mekanisme flag: `households.features jsonb` (migrasi `00000000000021`, belum dibuat), `GET /v1/features`
  (bisa dibaca API key — `households/current` jwt-only), toggle owner via `PATCH /v1/households/current`, error
  baru `feature_disabled` (403) yang **wajib** ditambah ke `05-api.md` §7 + `errors.ts` saat dikerjakan,
  `ToolDefinition.feature` di registry (→ kontrak "22 tool" di `06` dan CI harus diubah bersamaan).
- **F-A** beneficiary "untuk siapa" (`beneficiaries` + `transactions.beneficiary_id`, resolver, filter summary;
  backfill dari `[untuk: …]` di note 96 transaksi migrasi).
- **F-B** `GET /v1/reports/monthly` dengan `text_id` siap kirim; Hermes cron per penerima dengan key masing-masing
  (privasi akun privat).
- **F-C** rekonsiliasi mutasi bank (`statement_imports`/`statement_lines`, fingerprint idempoten, skor pencocokan
  deterministik, `accept` memakai `tx_source='import'` — perlu `createTransaction` berhenti hardcode `'web'`).
- **F-D** belanja & stok: `POST /v1/receipts/ingest` membungkus `post_transactions_batch` + coret shopping list +
  tambah stok dalam satu transaksi DB; migrasi `belanja.db`/`kulkas.db` dari container Hermes.
  Rev. 2–3 (2026-10-07): pantry punya `location` (kulkas/freezer/lemari/lainnya) dan pengingat kedaluwarsa harian
  via Hermes cron (`GET /v1/pantry/expiring`, diam kalau tidak ada yang basi).

Rev. 5 (2026-10-07, hasil review silang dengan kode): referensi salah diperbaiki (cek 22 tool ada di `08`, bukan CI;
`PORT-REQUEST.md` tidak ada di repo), fingerprint statement + `seq`, `pantry_items` unique partial, `beneficiaries`
unique per member, laporan bulanan selalu bulan sebelumnya, penerima tanpa key dilewati, backfill di-throttle.

Tidak ada kode, migrasi, atau skill Hermes yang berubah pada 2026-10-07 untuk ini. Pertanyaan terbuka Q-F1..Q-F10
ada di §9 file spec. Urutan rekomendasi: F-0 → F-A → F-B → F-C → F-D.


## Kategori scan struk: kategori household di prompt + gudang kata kunci + pencarian web (2026-10-12)

Keluhan pemilik produk: hasil scan struk "ngasal, semuanya makanan". Akar masalah: prompt `scan-receipt.ts`
dan `SCAN_CATEGORIES` di `AddTransactionModal.jsx` memakai 8 kategori lama hardcode ("Makanan & Minuman",
"Tagihan", …) yang tidak sama dengan kategori household di DB; backend lalu mencocokkan fuzzy
(`resolve_category`) — "Tagihan" bahkan gagal `category_not_found`. Jalur Hermes (`ingest_receipt`) punya
masalah yang sama plus gagal total kalau `category` kosong.

Yang dikerjakan (commit menyusul):
- `apps/api/src/services/ai/provider.ts` (baru): akses provider BYOK dipisah dari scan-receipt; model
  Anthropic → `claude-haiku-5-5`, Google → `gemini-3.6-flash` (1.5 sudah mati; 3.5 dideprekasi & dirutekan
  ke 3.6 per ai.google.dev), key Gemini lewat header `x-goog-api-key` (bukan query string); `max_tokens` 2048.
- `apps/api/src/services/categorize.ts` (baru) + `product-groups.ts` + `web-lookup.ts`: klasifikasi per item
  dengan urutan **learned (category_keywords) → ai → known (product_knowledge) → rule (regex) → web
  (DuckDuckGo Lite + AI BYOK, maks 5 item/panggilan, hasil di-cache global) → Lainnya**. Dipakai oleh
  `scan-receipt.ts` (web; respons item kini membawa `category_source`) dan `receipts.ts` (Hermes ingest;
  klasifikasi dilakukan SEBELUM transaksi DB utama supaya pencarian web tidak menahan koneksi).
- Belajar: `createTransactionBatch` (hanya JWT) dan `updateTransaction` (perubahan kategori) memanggil
  `learn_category_keyword`. Migrasi `00000000000024_category_keywords.sql` (03-database.md §3.20–3.21).
- Prompt scan: daftar kategori household + alias disuntikkan, panduan "per jenis barang, bukan per toko",
  `note` diminta persis seperti di struk (bahan kata kunci). Frontend: dropdown/validasi memakai kategori
  household dari API (`useCategories`), default "Lainnya".
- Hermes: deskripsi `ingest_receipt`/`record_expense_batch` di `registry.ts` (→ `pnpm gen:tools`),
  `docs/hermes/SYSTEM_PROMPT.md` aturan 11, dan SKILL.md di VPS (section "Kategori" diganti + aturan 11;
  backup `/home/hermes/SKILL.md.karaya-finance-api.bak-20261012`). Perlu `/new` di Telegram.

Verifikasi: `pnpm --filter @karaya/api typecheck/lint` bersih; `vitest run` **89/89** lulus terhadap
`supabase start` lokal (54322) setelah migrasi 0024 diterapkan via psql (termasuk 14 unit test
`categorize.test.ts`: urutan prioritas, substring terpanjang, `keywordFromNote`, parser DDG). Build
`apps/api` (bundle `api/index.js`) dan `apps/web` hijau. **Update 2026-10-13: migrasi 0024 SUDAH diterapkan ke
produksi** (pemilik produk menjalankan isi file lewat SQL Editor Supabase dashboard, seperti 0020), lalu commit
`24d7bc9` di-push → Vercel `karaya-api-v1` dan `keuangan` Ready, `/v1/health` db ok, manifest
`/v1/tools/hermes.json` sudah memuat deskripsi `ingest_receipt` baru. Catatan untuk sesi berikutnya: Supabase CLI
di repo ini ter-link ke produksi (`supabase migration list --linked` jalan tanpa kredensial tambahan), tetapi tabel
riwayat `supabase_migrations.schema_migrations` di produksi KOSONG (semua migrasi diterapkan manual), jadi
`supabase db push` polos akan mencoba menerapkan ulang 1..24 — perlu `supabase migration repair --status applied`
dulu, atau tetap pakai SQL Editor.

Belum diuji end-to-end dengan foto struk nyata (butuh API key provider pemilik). Utang: UI untuk melihat/
mengedit gudang kata kunci (`GET /v1/categories/keywords` belum ada); `category_source` belum ditampilkan
di modal scan; pencarian web bergantung DuckDuckGo Lite yang bisa memblokir IP serverless (fallback:
pengetahuan AI saja, `source=ai`).

### Titipan → Piutang otomatis + note kanonik `[Toko] item` (2026-10-13)
Permintaan pemilik produk: (1) item TITIPAN masuk Piutang, (2) note struk berformat `[nama toko] nama item`,
(3) strategi membandingkan harga produk antar toko walau penamaannya beda.
- **Note**: `formatReceiptNote`/`parseReceiptNote` baru di `packages/shared/src/format` — dipakai `receipts.ts`
  (`[Toko] item [ref: X]`), modal scan web (prefix toko saat simpan), dan `keywordFromNote` (parser mengerti format
  lama ` — Toko` juga). Test `shopping-pantry.test.ts` disesuaikan.
- **Titipan**: service baru `apps/api/src/services/titipan.ts` (`detectTitipan`, `borrowerFromText`,
  `createTitipanPiutang`). Dikenali dari field `titipan`, kata "titipan" di nama/note, atau kategori "Piutang".
  Diterapkan di `ingestReceipt` dan `createTransactionBatch`: kategori dipaksa Piutang, satu baris `piutang` per
  orang per struk (`from_account_id` akun struk, `lend_transaction_id` kalau tepat satu item), respons `piutang[]`.
  Tidak ada migrasi (memakai tabel/kategori sistem yang sudah ada). `learnKeywords` melewati kategori sistem.
  Skema `ReceiptItemSchema`/`BatchItemSchema` + `titipan`; tool `ingest_receipt`/`record_expense_batch` + param
  `titipan` (manifest di-regen); `SYSTEM_PROMPT.md` aturan 12; skill VPS bagian Titipan ditambah pola otomatis.
  Modal web: dropdown scan menawarkan "Piutang" (kategori sistem) untuk item titipan.
- **Verifikasi**: `typecheck`/`lint` bersih; 115/115 test (unit `titipan.test.ts` 5, integrasi `titipan.test.ts` 3);
  `schema.d.ts` di-regen dari OpenAPI lokal; bundle `api/index.js` + `apps/web` dibangun ulang.
- **Perbandingan harga antar toko** — dikerjakan di entri berikutnya.

### Perbandingan harga produk antar toko (2026-10-13)
Desain lengkap: `10-fitur-opsional-keluarga.md` §6.8; skema `03-database.md` §3.22; endpoint `05-api.md` §4.14.
- **Migrasi `00000000000025_product_prices.sql`**: `product_prices`, `product_aliases`, `product_knowledge.canonical_name`,
  view `v_product_prices`, fungsi `parse_item_size`/`item_keyword`/`product_key`/`merchant_key`/`record_product_prices`,
  `learn_product_knowledge` + `p_canonical` (versi lama di-drop), backfill dari note struk lama. Diterapkan ke DB LOKAL.
  **BELUM diterapkan ke produksi** saat entri ini ditulis — wajib sebelum deploy API (ingest/batch memanggil
  `record_product_prices` dan `item_keyword`; tanpa migrasi, simpan struk akan error).
- **API**: `services/prices.ts` (kanonikalisasi AI sekali per struk, `recordPrices`, `summarizeObservations`,
  `comparePrices`, `cheapestForNames`, `setProductAlias`), `routes/prices.ts`; terpasang di `receipts.ts`,
  `transactions.ts` (batch), `ai/scan-receipt.ts`, `shopping.ts` (`cheapest`), `web-lookup.ts` (+`canonical`).
  Tool Hermes `compare_prices`, `merge_products` (registry 32 → 34, manifest di-regen). `SYSTEM_PROMPT.md` aturan 13.
- **Web**: halaman Belanja menampilkan "💰 Termurah di …" per item + panel "⚖️ Banding harga antar toko".
- **Verifikasi**: `typecheck`/`lint` bersih; 125/125 test di Supabase lokal (unit `prices.test.ts` 4, integrasi
  `prices.test.ts` 6: parser ukuran, ingest dua toko dengan nama kasir beda → satu produk, banding per 100 g,
  `cheapest` di daftar belanja, batch `[Toko]` + alias manual, transaksi terhapus tidak ikut, q pendek → 400);
  `schema.d.ts` di-regen; bundle `api/index.js` + `apps/web` dibangun ulang. Belum diuji dengan BYOK sungguhan
  (kanonikalisasi AI) — jalur itu best-effort dan tidak pernah menggagalkan pencatatan.
