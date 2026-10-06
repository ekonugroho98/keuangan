Status: draft
Terakhir diubah: 2026-10-04
Bergantung pada: semua bab 00–07

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-04 | Fase 0, 2, 4 | Revisi greenfield, lihat blok 'Revisi 2026-10-04' di bawah | DB produksi dikosongkan atas permintaan pemilik produk (4 user, 1.393 transaksi, 13 tabel domain di-drop; `gold_prices` dipertahankan untuk karaya-api). Backup: `backups/pre-wipe-*.sql` (lokal, gitignored), skema di `docs/reference/legacy-schema-live-2026-10-04.sql`. |
> | 2026-10-06 | Fase 5, Fase 6 (F6-T6) | F6-T6 dibatalkan total, bukan dikerjakan | Pemilik produk mengonfirmasi project tidak pernah punya pembayaran sungguhan. Detail: `docs/spec/PROGRESS.md` §"Pembatalan total subscription/Midtrans". |

# 08 — Rencana Implementasi Bertahap

Setiap fase menghasilkan **sistem yang tetap berjalan** untuk pengguna saat ini. Setiap tugas dirancang selesai dalam satu sesi kerja (≈ 1–3 jam fokus). Kriteria selesai adalah **perintah yang bisa dijalankan** dan hasil yang diharapkan. Status tiap tugas dicatat di `docs/spec/PROGRESS.md`.

Notasi: `[F3-T2]` = Fase 3, Tugas 2. Perintah dijalankan dari root repo kecuali disebutkan.

## Revisi 2026-10-04 (DB produksi sudah kosong, ADR-19)

Tabel fase di bawah ditulis untuk skenario migrasi data. Dengan DB kosong, berlaku perubahan berikut dan **mengalahkan** teks fase aslinya bila bertentangan:

| Fase / tugas | Perubahan |
|---|---|
| F0-T2 | **Selesai** dalam bentuk lain: dump skema live tersimpan di `docs/reference/legacy-schema-live-2026-10-04.sql`. **Tidak** dijadikan baseline migration; `supabase/migrations/` dimulai dari nol dengan skema target. |
| F0-T3 | **Selesai**: lihat `01` §4. |
| F0-T4 | **Selesai**: `backups/pre-wipe-*.sql`. |
| F0-T6 | Diganti: tulis `supabase/scripts/verify_schema.sql` (cek tabel, view, fungsi, policy, 5 kategori sistem per household, cron job) sebagai pengganti `verify_migration.sql`. Tidak ada snapshot. |
| F2 (seluruhnya) | Menjadi: **F2-T1** migrasi `0001_extensions_enums`, `0002_households_members_invitations`, `0003_domain_tables` (DDL `03` §3 lengkap, langsung NOT NULL/FK/index), `0004_api_infra` (`api_keys`, `idempotency_keys`, `rate_limit_counters`, `audit_log`), `0005_views_functions` (`03` §4, §8, role `karaya_api`), `0006_rls` (`03` §7, tanpa policy lama), `0007_cron`. **F2-T2** pgTAP seperti F2-T5 asli. **F2-T3** `supabase/seed.sql` household demo "Keluarga Eko" (`06` §5). **F2-T4** apply ke produksi: `supabase db push --db-url <pooler>` (Docker + pooler IPv4, karena direct host IPv6 tidak terjangkau dari mesin dev), lalu `verify_schema.sql`. Tugas backfill, trigger sinkronisasi, snapshot, dan constraint v2 terpisah **dihapus**. Tidak ada tabel `migration_issues`. Semua migrasi wajib `IF NOT EXISTS`-aman dan **tidak menyentuh `public.gold_prices`**. |
| F2 kriteria | `supabase db reset && pnpm test:db` hijau; `psql $PROD -f supabase/scripts/verify_schema.sql` hijau; `SELECT count(*) FROM gold_prices` tetap 358+. |
| F2 "tidak boleh disentuh" | `public.gold_prices`, schema `auth`. |
| F3 | Tidak berubah, kecuali tidak perlu memperhatikan kolom legacy. Catatan: sejak F2-T4, **frontend lama dan edge function lama sudah tidak berfungsi** (tabel lama tidak ada). Karena tidak ada pengguna aktif (0 user), ini diterima. |
| F4-T7 | Undeploy edge function `transactions`, `financial-ops`, `auto-recurrings` boleh langsung setelah F4-T6 tanpa menunggu 7 hari. |
| F4-T8 (contract) | **Dihapus.** |
| F5-T6 `MigrationReviewBanner` | **Dihapus** (tidak ada akun `needs_review`). Kolom `accounts.needs_review` tetap ada untuk impor di masa depan. |
| Urutan dependensi | `F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → [F8]`, tanpa cabang contract. |
| Risiko | Baris "Drift skema", "Backfill account_name", "Trigger sinkronisasi", "Merge household salah (backup)" tidak relevan. Risiko baru: menyentuh `gold_prices` secara tidak sengaja → mitigasi: `verify_schema.sql` memeriksa jumlah barisnya. |


---

## Fase 0 — Persiapan dan baseline (tanpa perubahan perilaku)

**Tujuan:** Mengunci kondisi nyata DB produksi dan membuat jaring pengaman sebelum menyentuh apa pun.

| Tugas | Rincian | File |
|---|---|---|
| F0-T1 | `supabase init` (buat `supabase/config.toml`), `supabase link --project-ref twcrflhvxzatpfrjmqzi` | `supabase/config.toml` |
| F0-T2 | Dump skema live: `supabase db dump --schema public -f supabase/migrations/<ts>_baseline.sql`; bersihkan dan tandai sebagai applied di remote (`supabase migration repair --status applied <ts>`) | `supabase/migrations/*_baseline.sql` |
| F0-T3 | Audit drift: bandingkan baseline dengan `supabase_schema.sql`; catat di `01-kondisi-saat-ini.md` §4 kolom mana yang ada di live (`transactions.account_id`? `goals.deadline`? CHECK `type`?) dan perbarui `04-migrasi-data.md` jika perlu | `docs/spec/01-…`, `04-…` |
| F0-T4 | Backup data: `supabase db dump --data-only -f backups/<date>_data.sql` (folder `backups/` di-gitignore; file dienkripsi `age`/`gpg` dan disimpan di luar repo) | `.gitignore` |
| F0-T5 | Buat `docs/spec/PROGRESS.md` dari template §"Cara melanjutkan" | `PROGRESS.md` |
| F0-T6 | Tulis `supabase/scripts/snapshot_before.sql` (membuat `*_snapshot` tables) dan `verify_migration.sql` V1–V9 (`04` §6); jalankan snapshot di DB lokal hasil `supabase db reset` + impor data backup untuk latihan | `supabase/scripts/*.sql` |

**Kriteria selesai**
```bash
supabase migration list            # baseline tampil "applied" di Local dan Remote
test -s supabase/migrations/*_baseline.sql && grep -c "CREATE TABLE" supabase/migrations/*_baseline.sql   # >= 13
grep -n "account_id\|deadline" supabase/migrations/*_baseline.sql   # hasil dicatat di 01 §4 (ada atau tidak)
ls backups/*_data.sql.age          # backup terenkripsi ada
```
**Tidak boleh disentuh:** kode `src/`, edge function, DB produksi (hanya dibaca).
**Rollback:** tidak ada perubahan; hapus file yang dibuat.

---

## Fase 1 — Monorepo, pindahkan frontend apa adanya

**Tujuan:** Repo berbentuk monorepo pnpm dengan `apps/web` berjalan identik dengan sekarang dan `apps/api` berupa kerangka `GET /v1/health`.

| Tugas | Rincian | File |
|---|---|---|
| F1-T1 | Root: `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`, `tsconfig.base.json`, `eslint.config.js`, `prettier.config.js`, `.editorconfig`, `.gitignore` (tambah `dist_*/`, `.vercel/`, `backups/`) | root |
| F1-T2 | `git mv` `src/`, `index.html`, `public/`, `vite.config.js` → `apps/web/`; buat `apps/web/package.json`, `tsconfig.json`, `.env.example`; rename env harga emas ke `VITE_PRICES_API_BASE_URL` | `apps/web/**` |
| F1-T3 | Hapus artefak: 13 `dist_*/`, `generate_*.{cjs,py}`, `Panduan_*.docx/.pdf`, `scripts/seed_*.py`, `.claude/launch.json`; pindahkan `SS/` ke `docs/panduan-assets/` | root |
| F1-T4 | `packages/shared` kerangka: `constants/categories.ts` (port dari `categories.js` + tabel sistem `03` §3.5), `format/` (port `fmtRp`, `fmtDate`, `toLocalDateStr`, tambah `parseAmountId` + unit test), `errors.ts` (daftar code `05` §7) | `packages/shared/**` |
| F1-T5 | `apps/api` kerangka: Hono app, `env.ts`, `GET /v1/health` (tanpa DB dulu), `server.ts`, `api/index.ts`, `vercel.json`, `@hono/zod-openapi` + `/v1/openapi.json` + `/v1/docs` dengan satu route | `apps/api/**` |
| F1-T6 | CI `ci.yml`: install, lint, typecheck, test, build. Vercel: ubah Root Directory project web ke `apps/web`; buat project `karaya-api-v1` (belum menerima trafik) | `.github/workflows/ci.yml` |
| F1-T7 | Perbarui `README.md` bagian setup dan struktur | `README.md` |

**Kriteria selesai**
```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test          # lulus; test parseAmountId: "45rb"→45000, "1,2 juta"→1200000, "500 ribu"→500000
pnpm build                                         # apps/web/dist dan apps/api build sukses
pnpm dev &  sleep 8
curl -s localhost:8787/v1/health | jq -e '.status=="ok"'
curl -s localhost:8787/v1/openapi.json | jq -e '.openapi=="3.1.0"'
curl -s -o /dev/null -w '%{http_code}\n' localhost:5173   # 200
# Manual: login di localhost:5173 dengan akun tester, tambah transaksi → berhasil (masih via edge function lama)
git ls-files | grep -c '^dist_'                    # 0
```
**Tidak boleh disentuh:** skema DB, edge function, perilaku UI.
**Rollback:** `git revert` seluruh fase; Vercel Root Directory dikembalikan ke `/`.

---

## Fase 2 — Skema baru + migrasi data (expand) + verifikasi

**Tujuan:** DB produksi memiliki household, FK, enum, DATE, view saldo derived, dan fungsi atomik, sementara frontend lama tetap berjalan tanpa perubahan di atas kolom legacy yang disinkronkan trigger.

| Tugas | Rincian | File |
|---|---|---|
| F2-T1 | Migrasi 01–03 (`04` §5): ekstensi, enum, tabel household/member/invitation, expand kolom semua tabel domain, tabel payments/contributions/receipts, `migration_issues`, `parse_legacy_date`, `seed_household_categories`. Uji di lokal: `supabase db reset` | `supabase/migrations/*` |
| F2-T2 | Migrasi 04–06: backfill households, categories, accounts, transactions (termasuk `opening_balance`, placeholder akun, parsing due_date). Uji di lokal dengan data backup produksi: `verify_migration.sql` V1–V9 hijau | `supabase/migrations/*`, `supabase/scripts/backfill_categories.sql` |
| F2-T3 | Migrasi 07 trigger sinkronisasi dua arah; uji lokal: jalankan frontend lama (apps/web + edge function via `supabase functions serve`) → add/edit/delete/transfer/pay-debt/topup → V4 & V5 tetap hijau | `supabase/migrations/*_sync_triggers.sql` |
| F2-T4 | Migrasi 08 constraint v2 (NOT NULL, FK, unique, index) | |
| F2-T5 | Migrasi 09 view + fungsi (`03` §4, §8) + role `karaya_api`; pgTAP untuk setiap fungsi: `post_transaction` insufficient funds, `post_transfer` lock order, `update_transaction` pindah akun, `delete/restore`, `adjust_balance` diff 0/+/−, `pay_debt` overpay, `topup_goal` tanpa akun, `run_due_recurrings` catch-up & skip, `resolve_account` 7 kasus (exact, alias, owner keyword, joint keyword, ambiguous, not_found, prefer_own) | `supabase/migrations/*_views_functions.sql`, `supabase/tests/*.sql` |
| F2-T6 | Migrasi 10 RLS v2 berdampingan dengan policy lama; uji: sebagai user A tidak bisa membaca household B (pgTAP dengan `set_config('request.jwt.claims')`) | |
| F2-T7 | **Apply ke produksi**: backup (F0-T4 ulang), `snapshot_before.sql`, `supabase db push`, `verify_migration.sql`, smoke test frontend lama di produksi; catat ringkasan `migration_issues` di `PROGRESS.md` | |

**Kriteria selesai**
```bash
supabase db reset && pnpm test:db                              # semua pgTAP lulus
psql "$LOCAL_DB_URL" -f supabase/scripts/verify_migration.sql   # semua ok = true, 0 baris 'false'
psql "$LOCAL_DB_URL" -c "SELECT count(*) FROM households"       # = jumlah user yang punya data
psql "$LOCAL_DB_URL" -c "SELECT sum(balance) FROM v_account_balances" # = sum(balance) accounts_snapshot
psql "$LOCAL_DB_URL" -c "SELECT * FROM post_transaction(...) "  # contoh insufficient → ERROR: insufficient_funds
# Produksi (F2-T7):
supabase migration list                                         # semua applied Remote
psql "$PROD_DB_URL" -f supabase/scripts/verify_migration.sql    # hijau
# Manual produksi: akun tester tambah expense via UI lama → SELECT account_id, category_id, household_id FROM transactions ORDER BY created_at DESC LIMIT 1 → semua terisi
```
**Tidak boleh disentuh:** `apps/web` (selain tidak ada), edge function, kolom legacy (tidak di-drop).
**Rollback:** `migrations_down/10 … 01` berurutan; verifikasi frontend lama masih jalan (selalu jalan karena kolom lama utuh). Kalau backfill rusak data lama (seharusnya mustahil, backfill hanya menulis kolom baru), restore `backups/<date>_data.sql`.

---

## Fase 3 — `apps/api` dengan auth JWT, paritas fitur dengan edge function lama

**Tujuan:** Semua yang bisa dilakukan edge function dan hook lama bisa dilakukan lewat `/v1` dengan JWT, teruji dengan curl, tanpa frontend menyentuhnya dulu.

| Tugas | Rincian | File |
|---|---|---|
| F3-T1 | Infra: `db/client.ts` (postgres.js, `prepare:false`), `db/tx.ts` `withActor()`, `db/errors.ts`, `auth/jwt.ts`, `auth/middleware.ts`, `error-handler.ts`, `request-id.ts`, `cors.ts`; migrasi 11 (`api_keys`, `idempotency_keys`, `rate_limit_counters`, `audit_log`) sudah di-apply agar tabel ada meski belum dipakai | `apps/api/src/{db,auth,middleware}/**`, migrasi 11 |
| F3-T2 | Zod schemas di `packages/shared/src/schemas/` untuk semua resource (`05` §4) + `period.ts` + `resolver.ts` (TS wrapper memanggil `resolve_*` SQL) | `packages/shared/src/schemas/**`, `apps/api/src/services/{period,resolver}.ts` |
| F3-T3 | Routes + services: `me`, `settings`, `households`, `members` (read-only dulu), `accounts`, `categories` | `apps/api/src/{routes,services}/*` |
| F3-T4 | `transactions` (list dengan cursor + filter, create, batch, patch, delete, restore, export.csv), `transfers` | |
| F3-T5 | `budgets` (+status, copy), `goals` (+contributions), `debts` (+payments), `piutang` (+receipts) | |
| F3-T6 | `recurrings` (+run), `split-bills`, `investments`, `summary`, `reports/*`, `bootstrap`, `resolve` | |
| F3-T7 | Integration test (vitest, DB lokal): untuk setiap endpoint tulis minimal 1 kasus sukses + 1 kasus error domain; skenario paritas: ulangi contoh di `API_DOCS.md` lama dalam bentuk baru dan bandingkan saldo | `apps/api/test/integration/*.test.ts` |
| F3-T8 | `pnpm gen:api-client` menghasilkan `schema.d.ts`; CI job diff | `scripts/gen-api-client.sh` |
| F3-T9 | Deploy `apps/api` ke Vercel (`api.karaya.app` atau domain sementara) dengan env produksi; `GET /v1/health` memeriksa koneksi DB | |

**Kriteria selesai**
```bash
pnpm --filter @karaya/api test                      # unit + integration lulus (DATABASE_URL lokal)
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -d '{"email":"...","password":"..."}' | jq -r .access_token)
curl -s -H "Authorization: Bearer $TOKEN" localhost:8787/v1/accounts | jq -e 'type=="array" or (.data|type)=="array"'
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' localhost:8787/v1/transactions \
  -d '{"type":"expense","amount":1,"account":"BCA","category":"Makanan","note":"paritas"}' | jq -e '.transaction.id and .account.balance'
curl -s -X POST ... /v1/transactions -d '{"type":"expense","amount":999999999999,"account":"BCA","category":"Makanan"}' | jq -e '.error.code=="insufficient_funds"'
curl -s -H "Authorization: Bearer $TOKEN" 'localhost:8787/v1/summary?period=this_month' | jq -e '.totals.expense>=0'
curl -s localhost:8787/v1/openapi.json | jq '.paths | keys | length'   # >= 60
pnpm gen:api-client && git diff --exit-code packages/shared/src/api-client/schema.d.ts
curl -s https://<api-prod>/v1/health | jq -e '.db=="ok"'
```
**Tidak boleh disentuh:** `apps/web` (masih memakai edge function), kolom legacy, API key (Fase 6).
**Rollback:** API baru belum punya konsumen; cukup jangan dipakai. Data yang ditulis saat uji di produksi dihapus via API (soft delete) atau dibiarkan pada akun tester.

---

## Fase 4 — Frontend pindah ke `apps/api`, matikan akses langsung

**Tujuan:** `apps/web` tidak lagi memanggil `supabase.from` atau edge function; semua data lewat `/v1` dengan JWT; paritas fitur 100 %.

| Tugas | Rincian | File |
|---|---|---|
| F4-T1 | `src/api/client.ts`, `QueryClientProvider`, `HouseholdProvider` (minimal: memuat `/v1/me` dan `active_household_id`), `OnboardingHousehold` untuk user tanpa household | `apps/web/src/{api,auth,components/household}/**` |
| F4-T2 | Ganti `fetchAll` → `useBootstrap`; migrasi `Dashboard.jsx` → `Dashboard.tsx` dengan mutasi API untuk transaksi, transfer, akun, koreksi saldo, settings, AI chat | `apps/web/src/pages/Dashboard.tsx` |
| F4-T3 | Ganti hook domain: budgets, categories, goals, debts, piutang, recurrings, split bills, investments → `api/queries` + `api/mutations`; sesuaikan view ke bentuk data baru (`07` §2) memakai helper legacy | `apps/web/src/api/**`, views |
| F4-T4 | `AddTransactionModal`: `account_id`, batch endpoint, scan AI → `/v1/ai/scan-receipt` (endpoint ditambahkan di api pada tugas ini, provider adapter port dari modal) | modal, `apps/api/src/ai/scan-receipt.ts`, `routes/ai.ts` |
| F4-T5 | `Sidebar`: settings via `/v1/me/settings`, export CSV via API, hapus akun via `DELETE /v1/me`; hapus `karaya_ai_config` dari localStorage | |
| F4-T6 | Lint rule larang `supabase.from`/`supabase.functions` di `apps/web`; hapus `services/api.js`, `hooks/use*.js` lama; workbox cache rule | `eslint.config.js`, `vite.config.ts` |
| F4-T7 | Deploy web yang menunjuk ke api produksi. Pantau 7 hari. Undeploy edge function `transactions`, `financial-ops`, `auto-recurrings` (`supabase functions delete`) setelah log menunjukkan 0 panggilan 3 hari | |
| F4-T8 | **Contract** (setelah ≥ 7 hari stabil): backup, migrasi 13 drop kolom legacy & policy lama, `verify_migration.sql` V10 | `supabase/migrations/*_contract_drop_legacy.sql` |

**Kriteria selesai**
```bash
pnpm lint                                              # 0 pelanggaran no-restricted-syntax supabase.from di apps/web
grep -rn "supabase.from\|supabase.functions\|callEdge" apps/web/src | wc -l   # 0
pnpm --filter @karaya/web build
# Checklist manual (dicatat di PROGRESS.md) pada preview deploy, akun tester:
#  login → dasbor memuat (1 request /v1/bootstrap di Network tab) → tambah expense → saldo berubah → edit → hapus → transfer →
#  scan struk (OCR) → simpan batch → bayar cicilan → topup goal → piutang catat & terima → budget tambah & salin →
#  recurring tambah & "Jalankan sekarang" → laporan periode → AI chat → export CSV → ubah nama/password → logout
psql "$PROD_DB_URL" -c "SELECT count(*) FROM transactions WHERE created_at > now() - interval '3 days' AND source = 'web'"  # > 0
supabase functions list                                 # transactions, financial-ops, auto-recurrings tidak ada lagi (F4-T7)
psql "$PROD_DB_URL" -f supabase/scripts/verify_migration.sql | grep legacy_columns_remaining   # actual 0 (F4-T8)
```
**Tidak boleh disentuh:** fitur household baru (UI owner/visibility belum ada; semua akun default owner=diri sendiri, shared), API key, `ai-chat` edge function (masih dipakai sampai F4-T2 memindahkan chat? **Catatan:** `POST /v1/ai/chat` dibuat di F4-T2 agar `AiView` tidak tertinggal; edge `ai-chat` di-undeploy di Fase 6 setelah stabil).
**Rollback:** Vercel "Instant Rollback" ke deploy web sebelumnya (masih memakai edge function, yang belum di-undeploy sampai F4-T7). Kolom legacy masih disinkronkan trigger sampai F4-T8, jadi rollback web tidak kehilangan data. Setelah F4-T8, rollback web **tidak mungkin** (kolom legacy hilang); itu sebabnya F4-T8 menunggu 7 hari.

---

## Fase 5 — Household: member, undangan, kepemilikan, visibilitas, laporan per scope

**Tujuan:** Dua orang memakai satu household dengan akun pribadi/bersama, privat/shared, dan laporan tiga sudut pandang.

| Tugas | Rincian | File |
|---|---|---|
| F5-T1 | API: `invitations` (create, list, revoke, preview, accept fresh/merge dengan fungsi `merge_household_into`), `members` mutasi (patch, delete dengan reassign, leave), `households` PATCH; pgTAP untuk merge (kategori dedupe, owner remap, budget → member) | migrasi 12b `merge_household_into`, routes |
| F5-T2 | API: `accounts` owner/visibility/aliases; `summary`/`reports` dengan `scope`, `attribution`, `hidden_private_accounts`, `private_scope`; `transactions` filter member/recorded_by | services |
| F5-T3 | Web: `HouseholdProvider` lengkap, `HouseholdSwitcher`, Settings → Household, Anggota, Undangan; route `/join/:code` + `JoinHouseholdPage` | komponen household |
| F5-T4 | Web: `OwnerBadge`, `RecordedByChip`, `OwnerSelect`, `VisibilitySelect`, `AliasInput`; `AddAccountModal`, `AkunView`, `TransaksiView`, `AddTransactionModal` | |
| F5-T5 | Web: `ScopeSwitcher` di Dasbor, Laporan, Prediksi; kartu "Per anggota" & "Per akun"; AnggaranView tab Keluarga/Pribadi; owner selector di Goals/Hutang/Piutang/Investasi | |
| F5-T6 | `MigrationReviewBanner` untuk akun `needs_review`; i18n 6 bahasa untuk string baru | |
| F5-T7 | pg_cron (migrasi 12) aktif di produksi; dashboard berhenti memanggil `run` otomatis kecuali fallback | |

**Kriteria selesai**
```bash
pnpm test:db                                                     # termasuk merge_household_into dan RLS visibilitas
pnpm --filter @karaya/api test                                   # invitations/members/scope tests
# Skenario manual dua akun (A = owner, B = pasangan baru dengan data lama):
#  A buat undangan → B buka /join/<code> → pilih "merge" → data B muncul di household A dengan owner B →
#  A buat akun "BCA" (sendiri), B sudah punya "BCA" → keduanya ada → B set BCA-nya private →
#  A melihat BCA(B) terkunci tanpa saldo, A bisa transfer ke BCA(B) → A tidak bisa catat expense dari BCA(B) (403) →
#  Laporan scope Household/A/B/akun menampilkan angka konsisten (Household = A + B + Bersama)
curl -s -H "Authorization: Bearer $TOKEN_A" 'https://<api>/v1/summary?scope=member&member=istri' | jq -e '.error.code=="private_scope" or .totals'
psql "$PROD_DB_URL" -c "SELECT jobname FROM cron.job"            # 4 job terdaftar
psql "$PROD_DB_URL" -c "SELECT status, return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 4"   # succeeded
```
**Tidak boleh disentuh:** API key & idempotency (Fase 6).
**Rollback:** fitur UI di belakang flag `VITE_FEATURE_HOUSEHOLD=true` sampai fase selesai; API baru tidak merusak data lama. Migrasi 12b hanya menambah fungsi.

---

## Fase 6 — API key, idempotency, rate limit, audit log, OpenAPI lengkap, tool manifest, pindah AI/webhook

**Tujuan:** API siap dikonsumsi mesin: Hermes bisa autentikasi dengan API key, retry aman, dan setiap tindakan terlacak.

| Tugas | Rincian | File |
|---|---|---|
| F6-T1 | `auth/api-key.ts` (parse, hash dengan pepper, lookup sebelum SET ROLE, scope efektif), `routes/api-keys.ts` (create/list/revoke/rotate), Settings → API Key di web | api, web |
| F6-T2 | `middleware/idempotency.ts` + test paralel (dua request bersamaan → satu 201 satu 409) + replay + reuse | api |
| F6-T3 | `middleware/rate-limit.ts` + `bump_rate_limit` + header; `middleware/audit.ts` + `routes/audit-log.ts` + Settings → Audit | api, web |
| F6-T4 | `tools/registry.ts` (22 tool `06` §2), `emit-hermes.ts`, `GET /v1/tools/hermes.json`; CI diff check; OpenAPI: `operationId`, `security`, `x-karaya-scope`, contoh request/response untuk endpoint agent | api |
| F6-T5 | `ai/chat.ts` memakai registry (tool read; tool write di balik `allow_write`), port provider adapters dari `ai-chat` edge; undeploy edge `ai-chat` setelah 3 hari | api |
| ~~F6-T6~~ | **DIBATALKAN 2026-10-06**: project tidak pernah punya pembayaran sungguhan. `routes/webhooks.ts`/`services/subscriptions.ts` sempat dibangun lalu dihapus total, bersama edge function lama `payment-webhook`/`update-subscription` dan tabel `subscriptions` di DB. Detail: `docs/spec/PROGRESS.md` §"Pembatalan total subscription/Midtrans". | — |
| F6-T7 | Hapus `API_DOCS.md` (ganti link ke `/v1/docs` di README); `docs/hermes/SYSTEM_PROMPT.md` draft | docs |

**Kriteria selesai**
```bash
KEY=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" https://<api>/v1/api-keys -d '{"name":"test","scope":"write"}' | jq -r .secret); echo $KEY | grep -E '^kf_live_[0-9A-Za-z]{40}$'
curl -s -H "Authorization: Bearer $KEY" https://<api>/v1/accounts | jq -e '.[0].id or .data[0].id'
IK=$(uuidgen); for i in 1 2; do curl -s -X POST -H "Authorization: Bearer $KEY" -H "Idempotency-Key: $IK" -H 'Content-Type: application/json' https://<api>/v1/transactions -d '{"type":"expense","amount":1000,"account":"Cash","category":"Lainnya","note":"idem"}' -D - | grep -iE 'HTTP/|Idempotent-Replayed'; done   # 201, lalu 201 + Idempotent-Replayed: true
psql "$PROD_DB_URL" -c "SELECT count(*) FROM transactions WHERE note='idem' AND deleted_at IS NULL"   # 1
for i in $(seq 1 70); do curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $KEY" https://<api>/v1/health?x=$i; done | sort | uniq -c   # ada 429 setelah 60
curl -s -H "Authorization: Bearer $KEY" https://<api>/v1/me | jq -e '.error.code=="jwt_required"'
curl -s https://<api>/v1/tools/hermes.json | jq -e 'length==22'
pnpm gen:tools && git diff --exit-code apps/api/tools/hermes-tools.json
curl -s -H "Authorization: Bearer $TOKEN" 'https://<api>/v1/audit-log?limit=5' | jq -e '.data[0].action'
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" https://<api>/v1/api-keys/<id> && curl -s -H "Authorization: Bearer $KEY" https://<api>/v1/accounts | jq -e '.error.code=="api_key_revoked"'
supabase functions list   # kosong
```
**Tidak boleh disentuh:** skema tabel domain; UI selain Settings.
**Rollback:** middleware baru di belakang env `FEATURE_API_KEYS=false` (menolak semua key dengan 401). Edge function lama bisa di-deploy ulang dari git kalau webhook bermasalah (Notification URL dikembalikan).

---

## Fase 7 — Integrasi Hermes end-to-end dan dokumentasi

**Tujuan:** Tujuh skenario di `06` §5 berjalan dari Telegram sampai DB, dan dokumentasi pengguna diperbarui.

| Tugas | Rincian | File |
|---|---|---|
| F7-T1 | `docs/hermes/SETUP.md`, `SYSTEM_PROMPT.md` final; konfigurasi Hermes di workspace user (di luar repo) | docs |
| F7-T2 | Skrip uji skenario `apps/api/test/e2e/agent-scenarios.test.ts`: memainkan 7 skenario sebagai HTTP murni terhadap DB lokal berisi seed household "Keluarga Eko" (`supabase/seed.sql`) dan mengasersi SQL yang dihasilkan (lewat baris `transactions`, `debt_payments`, saldo) | test, seed |
| F7-T3 | Uji nyata lewat Telegram dengan dua key (Eko, Rina): 7 skenario + skenario tambahan; catat transkrip di `docs/hermes/TRANSCRIPT-<date>.md` | docs |
| F7-T4 | `PANDUAN.md` bab baru: Household & pasangan, API key, Hermes; `README.md` final | docs |
| F7-T5 | Perbaiki deskripsi tool berdasarkan kesalahan pemilihan tool yang ditemukan (hanya deskripsi, bukan endpoint) | registry |

**Kriteria selesai**
```bash
pnpm --filter @karaya/api test:e2e        # 7 skenario lulus: S1 201 & saldo −45000; S2 409 ambiguous dengan 2 kandidat; S3 transfer dua saldo berubah; S4 remaining = amount − spent; S5 totals hanya akun Rina; S6 remaining 8.400.000; S7 satu baris transaksi
test -s docs/hermes/SETUP.md && test -s docs/hermes/TRANSCRIPT-*.md
```
**Tidak boleh disentuh:** skema; endpoint (hanya deskripsi tool & docs).
**Rollback:** tidak ada perubahan sistem.

---

## Fase 8 (opsional) — MCP server tipis

`apps/mcp` sesuai `06` §7. Kriteria: `npx @karaya/mcp` dengan env key dapat dipakai Claude Desktop untuk `list_accounts`. Tidak ada ketergantungan fase lain.

---

## Urutan dependensi

```
F0 → F1 → F2 → F3 → F4 (T1–T7) → F5 → F6 → F7 → [F8]
                              └→ F4-T8 (contract) setelah ≥ 7 hari stabil, boleh paralel dengan F5/F6
```

## Risiko utama dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Drift skema live tidak terdeteksi | F0-T2/T3 wajib; semua ALTER `IF NOT EXISTS` |
| Backfill `account_name` banyak tidak ketemu | Placeholder + `needs_review` + banner; angka saldo user tidak berubah |
| Trigger sinkronisasi memperlambat edge lama | Hanya selama Fase 2–4; volume kecil |
| Vercel Hobby timeout untuk AI chat | `maxDuration 60`; 2-pass dibatasi; kalau tetap lewat, pindah `/v1/ai/*` ke Cloudflare Workers |
| Supabase free pause 7 hari | pg_cron harian menjaga aktivitas; `/v1/health` menampilkan `database_unavailable` yang jelas |
| Merge household salah | Hanya satu transaksi DB; audit log; backup sebelum fase 5 di produksi |

---

## Cara melanjutkan di sesi baru (instruksi untuk diri sendiri)

Saat context kosong dan diminta melanjutkan implementasi:

1. **Baca berurutan**: `docs/spec/PROGRESS.md` (status), lalu `docs/spec/00-ringkasan.md` (glosarium + ADR), lalu bab yang relevan dengan fase aktif (`08` untuk kriteria; `03`/`04` untuk fase 2; `05` untuk fase 3/6; `07` untuk fase 4/5; `06` untuk fase 6/7). Jangan membaca semua bab sekaligus kalau fase sudah jelas.
2. **Tentukan fase dan tugas aktif** dari `PROGRESS.md`: tugas pertama yang berstatus `todo` atau `in_progress` di fase pertama yang belum `done`. Jangan melompat fase.
3. **Sebelum menulis kode**, jalankan kriteria selesai fase sebelumnya (minimal `pnpm lint && pnpm typecheck && pnpm test`) untuk memastikan titik awal sehat. Kalau merah, perbaiki itu dulu dan catat di `PROGRESS.md`.
4. **Kerjakan satu tugas**, jalankan kriteria selesainya, lalu perbarui `PROGRESS.md`: status, tanggal, perintah yang dijalankan dan hasil ringkas, catatan penting (mis. ringkasan `migration_issues`).
5. **Spec tidak boleh diubah diam-diam.** Kalau implementasi menemukan spec salah/tidak lengkap: (a) tambahkan baris di tabel "Riwayat perubahan" di bagian atas file spec terkait (tanggal, bagian, apa yang berubah, alasan), (b) ubah teks spec, (c) kalau mengubah keputusan ADR, tambah baris ADR baru di `00` yang menyatakan ADR lama digantikan, (d) baru lanjut kode. Pertanyaan baru → tambah ke `09` dengan asumsi sementara.
6. **Jangan menyentuh** yang dilarang di fase aktif (kolom "Tidak boleh disentuh").
7. Commit per tugas dengan pesan `F<n>-T<m>: <ringkasan>`; jangan commit `.env`, backup, atau key.
8. Kalau sesi hampir habis di tengah tugas: tulis di `PROGRESS.md` bagian "Sedang dikerjakan" apa yang sudah dilakukan, file yang setengah jadi, dan langkah berikutnya yang konkret.

### Template `PROGRESS.md`

```markdown
# PROGRESS

Fase aktif: F0
Terakhir diperbarui: 2026-10-04

## Sedang dikerjakan
(kosong)

## Status tugas
| Tugas | Status | Tanggal | Catatan / hasil verifikasi |
|---|---|---|---|
| F0-T1 | todo | | |
| ... | | | |

## Catatan lintas fase
- (mis.) Hasil F0-T3: kolom `transactions.account_id` ADA di live, `goals.deadline` ADA, CHECK type sudah mencakup transfer.

## Riwayat perubahan spec
| Tanggal | File | Bagian | Perubahan | Alasan |
|---|---|---|---|---|
```
