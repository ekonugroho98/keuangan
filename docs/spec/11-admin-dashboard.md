# 11 — Spesifikasi & Handoff: Superadmin Dashboard (Karaya Finance / Keluarga Berkembang)

> **Status**: Siap dikerjakan di sesi baru (Handoff dari sesi 2026-10-19 setelah penyelesaian Migrasi `0028` Receipt Storage, Migrasi `0029` Plan/Entitlements + Idempotency Cleanup, dan Bug Audit E2E `e738091`).

---

## 1. Tujuan & Konteks Produk
Membangun **Dashboard Admin (Superadmin)** untuk memantau pertumbuhan user, status pembayaran/paket (`plan_tier` & `entitlements`), pemakaian kuota (foto struk & database), serta mengelola akun keluarga secara langsung tanpa perlu buka SQL Editor Supabase.

---

## 2. Konteks Teknis Penting (Wajib Dibaca Agent sebelum Coding)

### 2.1. Skema Database yang Sudah Terpasang (Migrasi `0001`–`0029`)
1. **`public.households`**:
   - `id uuid primary key`
   - `name text`, `currency text`, `timezone text`, `salary_day int`
   - `features jsonb` — toggle fitur opsional oleh user: `{"beneficiary": {"enabled": bool}, "shopping_stock": {"enabled": bool}}`
   - `plan_tier text not null default 'free'` — check constraint: `'free' | 'pro' | 'lifetime'` (Migrasi `0029`)
   - `plan_expires_at timestamptz null` — jika diisi dan `< now()`, efektif turun ke `'free'` kecuali `'lifetime'`
   - `entitlements jsonb not null default '{}'::jsonb` — override per fitur untuk add-on satuan (`api_access`, `receipt_storage`, `price_compare`, `multi_member`, `shopping_stock`, `beneficiary`, `excel_export`)
   - `created_at timestamptz`, `updated_at timestamptz`
   - *Catatan*: Household utama pemilik (`Kara`, ID `fb505774-619d-4352-be75-39598e01416b`) sudah berstatus `plan_tier = 'lifetime'`.
2. **`public.household_members`**:
   - `id uuid`, `household_id uuid`, `user_id uuid` (relasi ke `auth.users`), `display_name text`, `role text` (`'owner' | 'member' | 'viewer'`), `aliases text[]`, `joined_at timestamptz`, `removed_at timestamptz`.
3. **`public.transactions`**:
   - `id uuid`, `household_id uuid`, `account_id uuid`, `to_account_id uuid`, `category_id uuid`, `type tx_type` (`'income' | 'expense' | 'transfer'`), `amount bigint`, `discount bigint`, `date date`, `note text`, `source tx_source` (`'web' | 'api_key' | 'recurring' | 'system' | 'import' | 'migration'`), `recorded_by_member_id uuid`, `beneficiary_id uuid`, `receipt_url text` (Migrasi `0028`), `created_at timestamptz`, `deleted_at timestamptz`.
4. **`public.api_keys`**:
   - `id uuid`, `household_id uuid`, `member_id uuid`, `name text`, `key_prefix text`, `scopes text[]`, `last_used_at timestamptz`, `expires_at timestamptz`, `revoked_at timestamptz`, `created_at timestamptz`.
5. **`public.idempotency_keys`**:
   - Memiliki fungsi `public.cleanup_expired_idempotency_keys(p_max_age interval default '7 days') returns integer` (`SECURITY DEFINER`, Migrasi `0029`).

### 2.2. Aturan RLS & Koneksi Database di `apps/api`
- Koneksi `apps/api` memakai role Postgres **`karaya_api`** (`NOBYPASSRLS`).
- Seluruh tabel domain (`households`, `household_members`, `transactions`, `accounts`, `api_keys`, dll.) dikunci oleh RLS berbasis GUC transaksi `current_setting('app.household_id', true)` dan `current_setting('app.member_id', true)`.
- **Konsekuensi untuk Endpoint `/v1/admin/*`**:
  - Jangan query langsung tabel `households` / `transactions` lintas tenant sebagai `karaya_api` biasa karena RLS akan menyaring barisnya!
  - Buat **fungsi SQL `SECURITY DEFINER`** di migrasi baru `00000000000030_admin_dashboard.sql` (mis. `public.admin_get_overview()`, `public.admin_list_households(...)`, `public.admin_update_household_plan(...)`) dan beri `grant execute ... to karaya_api`, **ATAU** gunakan `supabaseAdmin` (`SUPABASE_SERVICE_ROLE_KEY`) / verifikasi superadmin di middleware `apps/api`.
  - Menggunakan fungsi SQL `SECURITY DEFINER` yang dipanggil lewat `sql` pool `apps/api` (setelah middleware `requireSuperadmin` memverifikasi `actor.userId` / email superadmin) sangat cepat (1 round-trip ke Supavisor pooler) dan konsisten dengan pola migrasi `0007`–`0029`.

### 2.3. Cache Entitlements di Memory (`apps/api/src/services/entitlements.ts`)
- Saat admin mengubah `plan_tier`, `plan_expires_at`, atau `entitlements` milik sebuah household lewat endpoint admin, **wajib memanggil `invalidateEntitlementsCache(householdId)`** di [`apps/api/src/services/entitlements.ts`](file:///Users/macbookpro/Projects/02-products/karaya/karaya-keuangan/apps/api/src/services/entitlements.ts) agar perubahan paket langsung aktif detik itu juga.

### 2.4. Aturan Build & Deploy `apps/api` ke Vercel
- Setiap perubahan di `apps/api` atau `packages/shared` **wajib** diikuti `pnpm build` (yang menjalankan `apps/api/scripts/build-function.mjs` untuk mem-bundle `apps/api/api/index.js`), dan file `apps/api/api/index.js` **wajib ikut di-commit ke git**.
- Gunakan git author email `28286211+ekonugroho98@users.noreply.github.com`.

---

## 3. Rancangan Fitur Admin Dashboard

### A. Ringkasan Metrik Utama (KPI Cards)
1. **Total Pengguna & Keluarga**:
   - Total `households` terdaftar + pertumbuhan 7 hari & 30 hari terakhir.
   - Total `household_members` aktif (dan berapa keluarga yang sudah multi-member / suami+istri).
2. **Metrik Monetisasi & Paket (`plan_tier`)**:
   - Jumlah household per tier: **`free`**, **`pro`** (aktif), **`lifetime`**, serta yang **`pro` akan kedaluwarsa ≤ 7 hari** atau sudah **expired**.
   - Status saklar global `ENFORCE_PAID_FEATURES` (`true` = mode komersial aktif / `false` = mode promo early-adopter semua fitur terbuka) & `STORAGE_PROVIDER` (`supabase` / `r2` / `firebase`).
3. **Aktivitas & Retensi**:
   - Total transaksi tercatat (hari ini, 7 hari, 30 hari, sepanjang waktu).
   - Breakdown sumber pencatatan: **Web/APK (`source = 'web'`)** vs **Bot AI Hermes/CLI (`source = 'api_key'`)** vs **Rutin (`source = 'recurring'`)**.
   - Jumlah keluarga aktif (Active Households) dalam 7 hari terakhir.
4. **Pemakaian Infrastruktur & Kuota Gratis**:
   - **Kuota Struk Cloud**: jumlah transaksi dengan `receipt_url IS NOT NULL` + estimasi pemakaian storage (asumsi rata-rata ~80 KB/struk WebP terhadap batas 1 GB = ~12.500 struk di Supabase Storage).
   - **Kesehatan Tabel DB**: jumlah baris di `transactions`, `product_prices`, `product_knowledge`, dan `idempotency_keys` + tombol **"🧹 Bersihkan Idempotency Keys Kedaluwarsa"** (`cleanup_expired_idempotency_keys()`).

### B. Manajemen Keluarga & User (Tabel + Detail Drawer/Modal)
- **Pencarian & Filter**:
  - Cari berdasarkan nama keluarga (`households.name`), nama member (`display_name`), atau email (`auth.users.email`).
  - Filter berdasarkan `plan_tier` (`all`, `free`, `pro`, `lifetime`) dan status aktivitas.
- **Kolom Tabel**:
  - Nama Keluarga + ID singkat
  - Daftar Anggota (Owner & Member beserta email dari `auth.users` dan tanggal bergabung)
  - Paket Saat Ini (`free` / `pro` / `lifetime` + badge `plan_expires_at` + jumlah override add-on aktif)
  - Statistik Pemakaian: jumlah transaksi (`web` vs `api_key`), jumlah foto struk, jumlah API key aktif (`last_used_at` terakhir)
  - Tanggal Daftar (`created_at`) & Aktivitas Terakhir (`max(transactions.created_at)`)
- **Aksi Admin per Keluarga (Modal Kelola Paket & Fitur)**:
  - **Ubah `plan_tier`**: pilih `free`, `pro`, atau `lifetime`.
  - **Atur `plan_expires_at`**: tombol cepat (`+30 Hari`, `+1 Tahun`, `Seumur Hidup / Kosongkan`, atau pilih tanggal manual).
  - **Override Entitlements Satuan (Add-on JSONB)**: toggle per fitur (`api_access`, `receipt_storage`, `price_compare`, `multi_member`, `shopping_stock`, `beneficiary`, `excel_export`) antara *Ikut Default Paket*, *Paksa Aktif (Add-on)*, atau *Paksa Nonaktif*.

---

## 4. Arsitektur Autentikasi Superadmin & UI

1. **Autentikasi Superadmin (`apps/api`)**:
   - Tambahkan env var opsional `SUPERADMIN_EMAILS` / `SUPERADMIN_USER_IDS` di [`apps/api/src/env.ts`](file:///Users/macbookpro/Projects/02-products/karaya/karaya-keuangan/apps/api/src/env.ts) (dengan default menyertakan user ID/email owner utama agar langsung bekerja di produksi tanpa wajib set env baru, namun tetap bisa ditambah lewat env Vercel).
   - Middleware `requireSuperadmin` memastikan request memiliki JWT valid yang `actor.userId` atau email-nya termasuk daftar superadmin (selain itu kembalikan `403 forbidden`).
   - Endpoint `GET /v1/bootstrap` atau `GET /v1/households/current` dapat menyertakan boolean `is_superadmin: boolean` agar Web UI tahu apakah menu **`🛡️ Admin Panel`** perlu ditampilkan di Sidebar.
2. **Tampilan di `apps/web`**:
   - Lazy-loaded view `AdminView.jsx` di dalam `Dashboard.jsx` (muncul di Sidebar hanya jika `is_superadmin === true`, atau diakses via `/admin`), sehingga:
     - Tidak menambah ukuran bundle untuk user biasa (karena `React.lazy`).
     - Langsung memakai sistem autentikasi Supabase JWT & tema desain *Financial Sanctuary* yang sudah ada.
