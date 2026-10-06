Status: draft
Terakhir diubah: 2026-10-04
Bergantung pada: (tidak ada; file ini adalah pintu masuk)

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-04 | §4 ADR-19 | ADR-12 (expand/contract) digantikan ADR-19 (greenfield) | DB produksi dikosongkan atas permintaan pemilik produk (4 user, 1.393 transaksi, 13 tabel domain di-drop; `gold_prices` dipertahankan untuk karaya-api). Backup: `backups/pre-wipe-*.sql` (lokal, gitignored), skema di `docs/reference/legacy-schema-live-2026-10-04.sql`. |
> | 2026-10-06 | §2, ADR-07 | **Fitur subscription/payment/Midtrans DIHAPUS TOTAL**, bukan "dipindah apa adanya" seperti baris non-tujuan di bawah — kode, migrasi, tabel DB (`subscriptions`), edge function lama, dan UI (`PricingModal`/`PricingSection`/`plans.js`) semua dihapus | Pemilik produk mengonfirmasi project ini tidak pernah punya pembayaran sungguhan (tidak ada integrasi Midtrans aktif, tidak ada user yang pernah bayar; tombol beli di UI hanya `alert(...)`, lihat `01-kondisi-saat-ini.md` T5). Detail penghapusan: `docs/spec/PROGRESS.md` §"Pembatalan total subscription/Midtrans". |

# 00 — Ringkasan: Karaya Finance → Platform Keuangan Keluarga

## 1. Tujuan

Merombak Karaya Finance dari aplikasi pencatatan keuangan **satu orang** menjadi **platform keuangan rumah tangga** yang:

1. Dipakai oleh dua orang atau lebih (suami, istri, dan opsional anak/viewer) dalam satu **household**, dengan akun yang bisa milik pribadi atau bersama, dan laporan yang bisa dilihat gabungan, per member, atau per akun.
2. Memiliki **backend HTTP terpisah** (`apps/api`, TypeScript + Hono) yang menjadi satu-satunya jalur baca/tulis data. Frontend tidak lagi menyentuh tabel Supabase secara langsung.
3. Menyediakan **API publik versi `/v1`** yang ramah untuk AI agent (REST resource-based, OpenAPI 3.1, API key jangka panjang, idempotency, resolusi nama yang toleran, error yang bisa ditindaklanjuti), dan dikonsumsi pertama kali oleh **Hermes Agent** lewat Telegram.
4. Menghilangkan 9 masalah struktural yang ada sekarang (lihat `01-kondisi-saat-ini.md` §3) tanpa kehilangan data pengguna lama.

## 2. Non-tujuan (eksplisit tidak dirancang)

| Non-tujuan | Alasan |
|---|---|
| Multi-currency | Semua nominal tetap BIGINT rupiah. Kolom `currency` di household di-hardcode `IDR` agar nanti bisa dibuka tanpa migrasi besar, tapi tidak ada logika konversi. |
| Integrasi bank otomatis / open banking | Di luar scope dan biaya. Pencatatan tetap manual, lewat web, scan struk, atau agent. |
| Aplikasi mobile native | PWA yang ada dipertahankan. |
| ~~Mengubah fungsi subscription dan payment webhook~~ **USANG (2026-10-06)**: fitur ini dihapus total, bukan dipindah — lihat riwayat perubahan di atas | — |
| Mengganti Supabase Auth | Login, session, refresh, reset password tetap Supabase Auth. |
| Rewrite UI secara visual | Fokus pada data dan backend. UI hanya ditambah komponen yang diperlukan oleh fitur household. |
| Harga emas dan saham | Tetap di repo terpisah `karaya-api`; tidak disentuh. |
| Multi-household per user di UI | Skema mengizinkan satu user di beberapa household, tapi UI dan API v1 hanya menjamin alur satu household aktif. |

## 3. Glosarium

| Istilah | Arti |
|---|---|
| **Household** | Satu rumah tangga; unit kepemilikan data tertinggi. Semua tabel domain punya `household_id`. Menggantikan peran `user_id` sebagai pembatas data. |
| **Member** | Keanggotaan satu user di satu household (`household_members`). Punya `display_name`, `role`, dan `aliases` (misalnya `["istri","bunda"]`) untuk resolusi nama oleh agent. |
| **Role** | `owner` (kelola member, undangan, API key, hapus household), `member` (baca-tulis penuh atas data yang boleh dilihatnya), `viewer` (hanya baca akun `shared`). Pasangan yang diundang default-nya `owner` agar suami-istri setara. |
| **Owner akun** | `accounts.owner_member_id`. Kalau terisi, akun milik satu member. Kalau `NULL`, akun **bersama (joint)**. |
| **Joint account** | Akun dengan `owner_member_id IS NULL`, misalnya "Tabungan Bersama", "Kas Rumah". Selalu `visibility = shared`. |
| **Visibility** | `shared`: semua member lihat saldo dan transaksi. `private`: hanya owner yang lihat saldo dan transaksi; member lain hanya melihat bahwa akun itu ada (nama, pemilik, tipe) supaya tetap bisa jadi tujuan transfer. |
| **recorded_by** | `transactions.recorded_by_member_id`: member yang **mencatat** transaksi. Berbeda dari **pemilik uang**, yang ditentukan oleh `account_id → owner_member_id`. Istri bisa mencatat belanja dari rekening suami. |
| **Atribusi** | Cara menjawab "pengeluaran siapa". Default: **berdasarkan pemilik akun** (uang siapa yang keluar). Alternatif via parameter `attribution=recorded_by`. Pengeluaran dari joint account diatribusikan ke "bersama", bukan ke member mana pun. |
| **Saldo derived** | Saldo akun tidak disimpan sebagai angka yang di-update, melainkan dihitung: `opening_balance + Σ income − Σ expense − Σ transfer keluar + Σ transfer masuk` atas transaksi yang `deleted_at IS NULL`. |
| **Opening balance** | `accounts.opening_balance`: saldo awal akun sebelum transaksi pertama yang tercatat. Saat migrasi diisi sehingga saldo derived == saldo lama. |
| **Koreksi Saldo** | Transaksi `income`/`expense` dengan kategori sistem "Koreksi Saldo" yang dibuat oleh `adjust_balance`. Audit trail, bukan edit angka saldo. |
| **Kategori sistem** | Kategori per household dengan `is_system = true`: Transfer, Koreksi Saldo, Hutang & Cicilan, Tabungan & Goal, Piutang. Tidak bisa dihapus. |
| **Soft delete** | Kolom `deleted_at` (+ `deleted_by_member_id` untuk transaksi). Baris tetap ada, dikecualikan dari saldo, laporan, dan listing default. |
| **Credential** | Salah satu dari: JWT Supabase (frontend) atau API key `kf_live_...` (mesin/agent). Setiap request punya tepat satu credential. |
| **Actor** | Member yang bertindak pada sebuah request. Dari JWT: member yang `user_id`-nya = `sub`. Dari API key: `api_keys.member_id`. |
| **Scope (API key)** | `read`, `write`, `admin`. `write` mencakup `read`; `admin` mencakup `write` plus kelola member/kategori/API key lain. |
| **Idempotency-Key** | Header pada POST yang membuat data. Request ulang dengan key sama dalam 24 jam mengembalikan respons tersimpan, bukan membuat data baru. |
| **Resolusi nama** | Proses backend mencocokkan string manusia ("BCA istri", "makan") menjadi `account_id` / `category_id` lewat nama, alias, dan kata kunci pemilik. Ambigu → HTTP 409 dengan kandidat. |
| **Period** | Rentang tanggal bernama (`this_month`, `last_month`, `YYYY-MM`, …) yang dievaluasi dalam zona waktu household (`households.timezone`, default `Asia/Jakarta`). |
| **Hermes Agent** | Agen AI yang dijalankan user sendiri, berbicara lewat Telegram, memanggil API v1 dengan API key. Konsumen pertama tool manifest. |
| **Expand/contract** | Pola migrasi: tambah kolom baru sambil mempertahankan kolom lama yang disinkronkan trigger (expand), pindahkan semua pembaca/penulis, lalu hapus kolom lama (contract). |

## 4. Keputusan arsitektur utama (ADR ringkas)

| # | Keputusan | Alasan | Alternatif yang ditolak |
|---|---|---|---|
| ADR-01 | **Monorepo pnpm workspaces**: `apps/web`, `apps/api`, `packages/shared`, `supabase/`, `docs/spec/`. | pnpm sudah terpasang (v10), `workspace:*` protocol, filter per paket (`pnpm --filter`), node_modules hemat. | npm workspaces: tidak ada filter yang ergonomis dan hoisting longgar. Turborepo: ditunda; skrip `pnpm -r --parallel` cukup untuk 3 paket. |
| ADR-02 | **Backend TypeScript + Hono**, dev di Node 22 via `@hono/node-server`, deploy ke **Vercel** via adapter `hono/vercel`. | Hono runtime-agnostik; Vercel Hobby gratis dan satu vendor dengan web. Kode tidak boleh pakai API khusus Node di luar adapter agar bisa pindah ke Cloudflare Workers/Deno. | Fly.io: tidak lagi punya free tier untuk akun baru. Supabase Edge Functions: tetap Deno-only dan sulit menjalankan lokal bersama web. |
| ADR-03 | **Akses DB dari backend via `postgres.js`** ke Supavisor pooler (transaction mode, port 6543) dengan role khusus `karaya_api`; setiap request dibungkus transaksi yang `SET LOCAL ROLE authenticated` dan `set_config('request.jwt.claims', …)` berisi `sub` actor. | Otorisasi utama di backend, **RLS tetap berjalan sebagai lapisan kedua** karena `auth.uid()` terisi. Tidak pakai service role untuk jalur domain. | supabase-js dengan service role: RLS ter-bypass total, dan tidak bisa transaksi eksplisit. ORM (Drizzle/Kysely): menambah sumber kebenaran skema kedua; SQL migration tetap satu-satunya sumber. |
| ADR-04 | **Semua mutasi multi-tabel adalah fungsi plpgsql** (`post_transaction`, `post_transfer`, `pay_debt`, `topup_goal`, `receive_piutang`, `adjust_balance`, `run_due_recurrings`, dll.). | Atomik oleh DB, tidak ada "rollback manual". Fungsi bisa dipanggil dari API, pg_cron, dan skrip migrasi. | Transaksi di application layer: bisa, tapi logika validasi tersebar dan tidak bisa dipakai pg_cron. |
| ADR-05 | **Saldo akun derived** dari transaksi + `opening_balance`, diekspos lewat view `v_account_balances`. Validasi saldo cukup dilakukan dalam fungsi dengan `SELECT … FOR UPDATE` pada baris akun. | Menghapus seluruh kelas bug drift (masalah #5). Soft delete otomatis benar. Volume data rumah tangga kecil (puluhan ribu baris), agregasi berindeks sub-milidetik. | Kolom `balance` + trigger: lebih banyak kode trigger (update amount/type/account/soft delete), drift tetap mungkin kalau ada jalur tulis lain. Materialized view: staleness dan refresh cost. |
| ADR-06 | **Riwayat pembayaran eksplisit**: `debt_payments`, `piutang_receipts`, `goal_contributions`, masing-masing menunjuk ke `transactions.id`. `remaining`/`current` derived di view. | Konsisten dengan ADR-05, memberi riwayat "siapa bayar kapan" yang sekarang tidak ada, dan membuat hapus transaksi cicilan otomatis mengembalikan sisa hutang. | Kolom `remaining` yang di-update: sama rawan drift seperti saldo. |
| ADR-07 | **Household sebagai pembatas data**, bukan `user_id`. Setiap tabel domain punya `household_id`; RLS berbasis `is_household_member(household_id)`. | Memungkinkan dua member berbagi data. `user_id` lama dipertahankan hanya di `user_settings` (`subscriptions` dihapus total 2026-10-06, lihat riwayat perubahan di atas). | Sharing per tabel dengan ACL: terlalu granular untuk kebutuhan suami-istri. |
| ADR-08 | **FK untuk akun dan kategori**; `transactions.type` jadi enum `income|expense|transfer`; semua tanggal `DATE`; `budgets.period_start DATE` (awal bulan). | Menyelesaikan masalah #1–#4. Rename akun/kategori tidak memutus relasi. | `daterange` untuk budget: fleksibel tapi UI dan agent hanya butuh bulanan; `period_start` lebih sederhana dan tetap bisa diperluas dengan kolom `period_type`. |
| ADR-09 | **Dua credential**: JWT Supabase dan API key `kf_live_` (hash SHA-256 di DB, scoped household + member + scope, bisa dicabut, ditampilkan sekali). | Agent tidak boleh menyimpan password user (masalah #8). | OAuth client credentials: berlebihan untuk pemakaian keluarga. Service account JWT Supabase: masa berlaku pendek dan tidak bisa di-scope. |
| ADR-10 | **Idempotency** via tabel `idempotency_keys` scoped per credential, TTL 24 jam, menolak key yang dipakai ulang dengan body berbeda. | Agent sering retry (masalah #7). | Idempotency berbasis dedup heuristik (jumlah+tanggal+catatan): salah positif untuk transaksi yang memang sama. |
| ADR-11 | **OpenAPI 3.1 di-generate dari zod** (`@hono/zod-openapi`), diserve di `/v1/openapi.json` dan `/v1/docs`. Tool manifest Hermes dan tool AI chat internal **di-generate dari registry yang sama**. | Satu sumber kebenaran untuk skema request. Agent membaca OpenAPI; AI chat tidak punya implementasi logika kedua. | Menulis OpenAPI manual: pasti tertinggal dari kode. |
| ADR-12 | **Expand/contract** untuk migrasi: kolom lama (`user_id`, `account_name`, `to_account`, `category` TEXT) dipertahankan dan disinkronkan trigger selama Fase 2–4, lalu dihapus di fase contract. | Frontend dan edge function lama tetap jalan selama transisi tanpa view kompatibilitas yang rumit. | View kompatibilitas dengan INSTEAD OF trigger: lebih rapuh untuk supabase-js dan PostgREST. |
| ADR-13 | **Frontend hanya memakai Supabase client untuk auth**; semua data lewat `apps/api` dengan client `openapi-fetch` + tipe hasil `openapi-typescript` yang disimpan di `packages/shared/src/api-client/`. State server dikelola **TanStack Query**. | Satu jalur data, satu tempat business logic (masalah #6). React Query menggantikan sinkronisasi `setState` manual lintas 10 entitas yang sekarang rapuh. | Hono `hc` RPC client: mengikat build web ke tipe app api secara langsung; openapi-fetch lebih longgar dan dokumentasinya sama dengan yang dibaca agent. |
| ADR-14 | **TSX bertahap**: `apps/api` dan `packages/shared` 100% TS; `apps/web` file baru `.tsx`, file lama `.jsx` dibiarkan sampai disentuh. `allowJs: true`. | Risiko kecil, tidak memblokir fase. | Konversi total di awal: memakan satu fase penuh tanpa nilai bisnis. |
| ADR-15 | **Rate limit per API key** disimpan di Postgres (`rate_limit_counters`, fixed window per menit dan per hari). | Tetap gratis, tidak butuh Redis. Volume agent keluarga sangat rendah. | Upstash Redis: komponen eksternal tambahan. |
| ADR-16 | **Soft delete** untuk transaksi, akun, member (`deleted_at`). Akun hanya bisa dihapus jika saldo derived = 0. Member yang dihapus wajib menyerahkan akun miliknya ke member lain atau jadi joint. | Laporan historis tidak berubah diam-diam; saldo total tidak melompat. | Hard delete: tidak bisa dipulihkan, dan agent bisa salah hapus. |
| ADR-17 | **pg_cron** menjalankan `run_due_recurrings()` harian 00:05 WIB; API `POST /v1/recurrings/run` tetap ada untuk eksekusi on-demand. | Transaksi berulang tidak lagi bergantung pada user membuka dashboard. pg_cron tersedia di Supabase free. | Vercel Cron: tersedia di Hobby (1 job/hari) tapi menambah ketergantungan ke endpoint HTTP. |
| ADR-19 | **Greenfield: skema target diterapkan langsung ke DB yang sudah kosong.** Tidak ada migrasi data lama, tidak ada kolom legacy, tidak ada trigger sinkronisasi, tidak ada fase contract. Edge function dan frontend lama berhenti berfungsi begitu skema baru diterapkan (tabel lama sudah tidak ada sejak 2026-10-04). **Menggantikan ADR-12.** | DB produksi dikosongkan 2026-10-04. Menghapus seluruh kelas risiko migrasi dan memangkas Fase 2 dan 4. | Mempertahankan rencana expand/contract: tidak ada data yang perlu dilindungi. |
| ADR-18 | **Scan struk dengan AI dipindah ke server** (`POST /v1/ai/scan-receipt`). | Saat ini API key provider dikirim dari browser ke OpenAI/Groq/Google (temuan audit), bertentangan dengan prinsip "key tidak pernah keluar dari server". | Dibiarkan: bocor key di network log browser. |

## 5. Peta dokumen

| File | Isi | Baca saat |
|---|---|---|
| `01-kondisi-saat-ini.md` | Audit terverifikasi, koreksi, inventaris fitur | Sebelum menyentuh kode lama |
| `02-monorepo.md` | Struktur, tooling, env, dev, deploy | Fase 1 |
| `03-database.md` | ERD, DDL, RLS, fungsi, saldo | Fase 2, 5 |
| `04-migrasi-data.md` | Urutan migrasi, verifikasi, rollback | Fase 2, contract di Fase 4 |
| `05-api.md` | Prinsip, auth, tabel endpoint, error, idempotency, rate limit | Fase 3, 5, 6 |
| `06-agent-integration.md` | Tool manifest, skenario end-to-end, resolusi nama, setup Hermes | Fase 6, 7 |
| `07-frontend.md` | Migrasi web, komponen baru, pemetaan view | Fase 1, 4, 5 |
| `08-rencana-implementasi.md` | Fase, kriteria selesai, rollback, cara lanjut di sesi baru | Setiap awal sesi |
| `09-pertanyaan-terbuka.md` | Asumsi dan pertanyaan | Saat ragu |
| `PROGRESS.md` | Status fase dan tugas, diperbarui setiap tugas selesai | Setiap awal sesi |

## 6. Prinsip yang berlaku di semua bab

1. Uang: `BIGINT` rupiah, tidak ada desimal, tidak ada float.
2. Waktu: `TIMESTAMPTZ` untuk timestamp, `DATE` untuk tanggal transaksi dan jatuh tempo, zona waktu household default `Asia/Jakarta`.
3. Semua ID `UUID` (`gen_random_uuid()`).
4. Tidak ada secret di respons API. API key hanya ditampilkan sekali saat dibuat.
5. Semua pesan `error.message` dalam Bahasa Indonesia, `error.code` stabil dalam snake_case Inggris.
6. Hosting harus tetap gratis atau sangat murah: Supabase Free, Vercel Hobby. Keputusan yang mengancam ini wajib mencantumkan biaya.
7. Spec adalah sumber kebenaran. Kalau implementasi menemukan spec salah, perbaiki spec dulu (dengan catatan perubahan di bagian atas file), baru lanjut kode.
