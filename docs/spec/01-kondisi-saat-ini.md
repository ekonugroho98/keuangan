Status: draft
Terakhir diubah: 2026-10-04
Bergantung pada: 00-ringkasan.md

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-04 | §4 | Drift dijawab dari dump skema live; catatan DB sudah kosong | DB produksi dikosongkan atas permintaan pemilik produk (4 user, 1.393 transaksi, 13 tabel domain di-drop; `gold_prices` dipertahankan untuk karaya-api). Backup: `backups/pre-wipe-*.sql` (lokal, gitignored), skema di `docs/reference/legacy-schema-live-2026-10-04.sql`. |
> | 2026-10-06 | T5, §5.1–5.3 (kolom "Padanan"/"Disposisi" terkait subscription/Midtrans/pricing) | Bab ini tetap audit historis kode LAMA yang sah (tidak diubah) — tapi rencana tindak lanjutnya ("dipindah apa adanya ke apps/api") sudah USANG, fitur dihapus total | Pemilik produk mengonfirmasi tidak pernah ada pembayaran sungguhan di project ini. Detail: `docs/spec/PROGRESS.md` §"Pembatalan total subscription/Midtrans". |

# 01 — Kondisi Saat Ini (Hasil Audit Kode)

Audit dilakukan 2026-10-04 atas commit `182e076` (branch `main`) di `karaya-keuangan/`. Semua pernyataan di bab ini **dibaca langsung dari kode**, bukan dari dokumentasi. Angka baris merujuk ke file pada commit tersebut.

## 1. Stack dan bentuk repo

| Aspek | Fakta terverifikasi |
|---|---|
| Frontend | React 18.3 + Vite 6, JSX (bukan TS), PWA via `vite-plugin-pwa` (workbox `NetworkFirst` untuk `*.supabase.co`, cache 5 menit). Tidak ada router; `App.jsx` memilih `LandingPage` / `Dashboard` / `ResetPasswordPage` berdasarkan session dan event `PASSWORD_RECOVERY`. |
| Backend | 6 Supabase Edge Functions (Deno) di `supabase/functions/`: `transactions`, `financial-ops`, `auto-recurrings`, `ai-chat`, `payment-webhook`, `update-subscription`. **Koreksi**: prompt menyebut "5 edge function" tapi mendaftar 6; yang benar 6. |
| Database | Supabase Postgres project ref `twcrflhvxzatpfrjmqzi`. Skema hanya ada sebagai 3 file SQL lepas (`supabase_schema.sql`, `scripts/add_piutang_table.sql`, `supabase/fix_subscription_security.sql`). **Tidak ada** `supabase/config.toml`, **tidak ada** `supabase/migrations/`. |
| Auth | Supabase Auth (email+password, reset password via email). JWT 1 jam, refresh token. |
| Hosting | Vercel (frontend). Edge function di Supabase. |
| Harga emas/saham | Repo terpisah `../karaya-api` (Vercel), dipanggil langsung dari browser (`src/services/goldPrice.js`, `stockPrice.js`), base URL default `https://karaya-api-jec2.vercel.app`. |
| Tooling | `package.json` hanya punya `dev`, `build`, `preview`. **Tidak ada** lint, test, format, TypeScript. Node lokal v22.23.1, pnpm 10.23.0 tersedia. |
| i18n | 6 bahasa di `src/i18n/translations.js` (id, en, ar [RTL], es, zh, ja), 2.183 baris. **Koreksi** README yang menyebut "ID/EN". |
| Artefak liar | 13 folder `dist_*` ter-commit (hasil build eksperimen). `.claude/launch.json` menunjuk path lama `catatan_keuangan_web`. `scripts/seed_*.py` berisi email dan password akun tester dalam plaintext. Semua ini harus dibersihkan di Fase 1. |

## 2. Skema database aktual

13 tabel, semuanya `user_id → auth.users ON DELETE CASCADE` dan RLS `auth.uid() = user_id` untuk SELECT/INSERT/UPDATE/DELETE (kecuali `subscriptions`: policy UPDATE dihapus oleh `fix_subscription_security.sql`; `split_bill_members` lewat EXISTS ke `split_bills`).

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `accounts` | `name TEXT`, `type CHECK IN (bank, ewallet, cash, crypto, investasi, tabungan)`, `balance BIGINT` (+ `CHECK balance BETWEEN 0 AND 100e9`), `icon`, `color` | Tidak ada UNIQUE pada `(user_id, name)`; keunikan dicek di aplikasi (`handleAddAccount`). |
| `transactions` | `type CHECK IN (income, expense)`, `amount BIGINT > 0` (+ `CHECK amount <= 100e9`, komentar di SQL bilang "100 juta" tapi angkanya 100 miliar), `category TEXT`, `note`, `date DATE`, `account_name TEXT`, `to_account TEXT`, `icon` | `type='transfer'` ditulis oleh `handleTransfer` meski CHECK tidak mengizinkan → **lihat §3 masalah 2 dan §4 drift**. |
| `goals` | `name`, `target`, `current`, `icon`, `color` | **Drift**: `GoalsView.jsx` mengirim `deadline` dan menampilkan `DeadlineBadge`, tapi kolom `deadline` tidak ada di file skema. |
| `debts` | `name`, `total`, `remaining`, `monthly`, `due_date TEXT`, `icon`, `color` | `due_date` diisi dari `<input type="date">` → format "YYYY-MM-DD" atau string kosong `""`. |
| `piutang` | `borrower_name`, `total`, `remaining`, `from_account TEXT`, `due_date TEXT`, `notes`, `icon`, `color` | `scripts/add_piutang_table.sql` versi lebih lama tanpa `from_account`. |
| `categories` | `name`, `icon`, `type CHECK IN (income, expense, both)`, `color` | Tidak direferensi FK oleh tabel mana pun. Kategori default 15 buah hardcoded di `src/constants/categories.js`. |
| `budgets` | `category TEXT`, `amount > 0`, `month TEXT "YYYY-MM"`, `UNIQUE (user_id, category, month)` | |
| `recurring_transactions` | `name`, `amount`, `icon`, `category TEXT`, `account_name TEXT`, `frequency CHECK IN (daily, weekly, monthly, yearly)`, `next_date DATE`, `notes`, `debt_id → debts ON DELETE SET NULL`, `active` | Tidak ada kolom `type`; `auto-recurrings` **selalu** membuat `expense`. `BerulangView` menebak income dari nama kategori. |
| `split_bills` / `split_bill_members` | `title`, `total_amount`, `date`, `note` / `name`, `amount`, `paid` | Tidak terhubung ke `transactions`. |
| `investments` | `name`, `type TEXT`, `brand`, `buy_price`, `current_value`, `quantity NUMERIC`, `unit`, `kode_saham`, `buy_date DATE`, `notes` | `type` bebas: emas, saham, reksa_dana, crypto, properti, lainnya. |
| `user_settings` | PK `user_id`, `avatar_color`, `hidden_menus JSONB`, `app_name`, `app_tagline`, `ai_config JSONB` (`{provider, model, apiKey, disabled}` **plaintext**) | Juga di-mirror ke `localStorage` termasuk `apiKey`. |
| `subscriptions` | `user_id UNIQUE`, `plan` (trial/starter/pro), `started_at`, `expires_at`, `payment_ref`, `updated_at` | Hanya ditulis oleh `payment-webhook` dan `update-subscription` dengan service role. **Tidak ada satu pun kode frontend yang membaca tabel ini.** |

## 3. Verifikasi 9 masalah struktural

| # | Klaim awal | Hasil verifikasi | Koreksi / detail tambahan |
|---|---|---|---|
| 1 | `account_name`/`to_account` TEXT, bukan FK | **Benar.** `getAccount()` di `transactions/index.ts:72` mencari `eq("name", name)`. Rename akun lewat `edit-account` tidak menyentuh transaksi. | `handleDeleteAccount` menghitung transaksi lewat nama, jadi akun yang di-rename lalu dihapus akan lolos cek "masih punya transaksi". |
| 2 | CHECK `type` hanya income/expense, kode menulis transfer | **Benar di file skema.** `handleTransfer` insert `type: "transfer"`. Karena fitur transfer dipakai di produksi, kemungkinan besar CHECK di DB live sudah diubah manual tanpa dicatat → **drift skema, lihat §4**. | Fase 0 wajib dump skema live. |
| 3 | Kategori TEXT di transactions, budgets, recurring; tabel `categories` tak direferensi | **Benar.** `KategoriView` menggabungkan default hardcoded + custom dari tabel; rename kategori custom tidak mengubah transaksi. | Prompt scan AI (`AddTransactionModal.jsx:343`) menghasilkan kategori "Makanan & Minuman" dan "Belanja" yang **tidak ada** di daftar default; `guessCategory()` memetakannya kembali sebagian. Migrasi harus menangani kategori teks "liar". |
| 4 | `due_date` TEXT, `budgets.month` TEXT | **Benar.** `HutangView.jsx:109` membandingkan `d.due_date < today` sebagai string. | Aman selama format "YYYY-MM-DD"; rusak untuk `""` (string kosong dianggap falsy, jadi tidak crash). |
| 5 | Saldo di-update manual dengan rollback manual | **Benar, dan lebih buruk dari klaim.** (a) `handleDelete` punya blok rollback yang **mati** (komentar `// Simplified: just refetch is safer`, `transactions/index.ts:384-399`), jadi gagal hapus setelah saldo di-revert meninggalkan saldo salah. (b) `auto-recurrings/index.ts:118` memakai `Math.max(0, balance - amount)`: kalau saldo kurang, transaksi tetap dibuat penuh tapi saldo hanya dipotong sampai 0 → **drift diam-diam**. (c) `handleTerimaPiutang` menulis saldo **sebelum** piutang dan transaksi; insert transaksi audit tidak dicek errornya. (d) Tidak ada lock; dua request paralel membaca saldo yang sama lalu menimpa. | |
| 6 | Hook query Supabase langsung untuk sebagian entitas | **Benar.** Langsung: `useBudgets`, `useCategories`, `useInvestments`, `useRecurrings`, `useSplitBills`, CRUD di `useDebts`, `useGoals`, edit/delete di `usePiutang`, plus di `Dashboard.jsx`: `fetchAll()` (10 tabel), `user_settings` upsert, `deleteAccount()` (hard delete 8 tabel; **melewatkan** `piutang`, `split_bills`, `user_settings`, `subscriptions`). Via edge: add/edit/delete/transfer/adjust/akun (`transactions`), pay-debt/topup-goal/add-piutang/terima-piutang (`financial-ops`), `auto-recurrings`, `ai-chat`. | `callEdge` di `src/services/api.js` adalah satu-satunya wrapper; mudah diganti. |
| 7 | Pola RPC `{action}`, tanpa OpenAPI, tanpa idempotency | **Benar.** `switch (body.action)` di 2 function. Error selalu `{error: string}` dengan status 400/401/404/500. | `API_DOCS.md` adalah satu-satunya dokumentasi, ditulis tangan. |
| 8 | Hanya JWT 1 jam | **Benar.** Semua function memakai `supabase.auth.getUser()` dari header Authorization. `update-subscription` memakai `x-function-secret` statis (server-to-server). | |
| 9 | Tidak ada konsep household | **Benar.** Tidak ada tabel atau kolom yang menyentuh sharing. `plans.js` menjual "Family sharing (2)" di paket Elite sebagai teks marketing saja. | |

### Temuan tambahan yang tidak ada di daftar awal

| # | Temuan | Lokasi | Dampak pada desain |
|---|---|---|---|
| T1 | `handleAdjustBalance` meng-insert kolom `account_id` ke `transactions`, yang tidak ada di file skema. | `transactions/index.ts:467` | Entah DB live sudah punya `account_id` (drift), atau fitur Koreksi Saldo gagal 500 di produksi. Fase 0 harus memeriksa. Kalau kolom ada, migrasi memakainya sebagai sumber `account_id` yang lebih akurat daripada lookup nama. |
| T2 | Scan struk mode AI memanggil OpenAI/Groq/Anthropic/Google **langsung dari browser** dengan `aiConfig.apiKey`. | `AddTransactionModal.jsx:336-456` | Bertentangan dengan klaim "API key tidak pernah dikirim dari browser". Dipindah ke `POST /v1/ai/scan-receipt` (ADR-18). |
| T3 | Deteksi duplikat `auto-recurrings` berbasis string `note LIKE '[Auto]%'` + tanggal. | `auto-recurrings/index.ts:74-85` | Rename recurring → duplikat. Diganti `recurring_id` + unique index `(recurring_id, date)`. |
| T4 | `calcNextDate` memakai `new Date(from)` lalu `toISOString().slice(0,10)`. | `auto-recurrings/index.ts:23-30` | `new Date("2026-03-31")` adalah UTC; `setMonth(+1)` → 1 Mei (overflow), dan di zona UTC+7 bisa bergeser hari. Diganti aritmetika `DATE` di Postgres dengan aturan clamp akhir bulan. |
| T5 | Tidak ada gating subscription di UI; `PricingModal.handleChoose` hanya `alert("…akan segera tersedia")`. | `PricingModal.jsx:108` | Webhook Midtrans berfungsi tapi tidak ada yang mengonsumsinya. Dipindah apa adanya ke `apps/api`; gating tetap non-tujuan. |
| T6 | `ai_config.apiKey` disimpan plaintext di JSONB dan di `localStorage`. | `Dashboard.jsx:640-659` | Tetap plaintext di DB untuk Fase 3 (fungsi identik), dicatat sebagai pertanyaan terbuka Q-14; `localStorage` tidak lagi menyimpan key setelah Fase 4. |
| T7 | Kategori "income" untuk recurring ditebak dari nama kategori (`INCOME_CATS`). | `BerulangView.jsx:106-107` | Tabel baru punya kolom `type` eksplisit. |
| T8 | Transaksi `transfer` memakai `category: "Transfer"`, `topup-goal` memakai "Tabungan & Goal", `pay-debt` memakai "Hutang & Cicilan", piutang memakai "Piutang", koreksi memakai "Koreksi Saldo". Tidak satu pun ada di `expenseCategories` default. | edge functions | Jadi **kategori sistem** per household (`is_system = true`). |
| T9 | `deleteAccount()` (hapus akun pengguna) tidak menghapus `auth.users`, hanya data; user bisa login lagi ke akun kosong. | `Dashboard.jsx:348-361` | Diganti endpoint `DELETE /v1/me` yang memanggil Admin API Supabase di server. |
| T10 | `fetchAll()` memuat **semua** transaksi tanpa batas; semua agregasi (dasbor, laporan, prediksi) dihitung di browser. | `Dashboard.jsx:369-395` | API baru menyediakan agregasi server-side (`/v1/summary`, `/v1/reports/*`) dan listing transaksi ber-cursor. Views lama boleh tetap menghitung di client selama Fase 4 dengan memuat per periode. |
| T11 | `amount_reasonable` membatasi `amount <= 100.000.000.000` dan `balance_reasonable` melarang saldo negatif. | `fix_subscription_security.sql` | Batas 100 miliar dipertahankan. Larangan saldo negatif menjadi aturan fungsi (`insufficient_funds`), bukan CHECK, karena saldo tidak lagi disimpan. |

## 4. Drift antara file skema dan DB live (TERJAWAB 2026-10-04)

Dump skema live sebelum wipe tersimpan di `docs/reference/legacy-schema-live-2026-10-04.sql`. Hasil:

| Dugaan | Fakta di DB live |
|---|---|
| `transactions.account_id` ada? | **Tidak ada.** Berarti `adjust-balance` (Koreksi Saldo) gagal 500 di produksi sejak kolom itu dipakai edge function. |
| `goals.deadline` ada? | **Ada** (`DATE`). File skema repo tertinggal. |
| CHECK `transactions.type` | Sudah mencakup `transfer` (`type = ANY (ARRAY['income','expense','transfer'])`). Ada dua CHECK `amount` yang tumpang tindih. |
| Tabel di luar file skema | `api_keys` (13 kolom, 0 baris) + fungsi `verify_api_key` + event trigger `ensure_rls`/fungsi `rls_auto_enable`: sisa eksperimen, tidak dipakai repo mana pun. `gold_prices` (358 baris): milik repo `karaya-api`, **dipertahankan**. |
| Jumlah policy | 38 |

Status DB sejak 2026-10-04 16:10 WIB: schema `public` hanya berisi `gold_prices`; `auth.users` kosong. Konsekuensi: bab `04-migrasi-data.md` diarsipkan, dan Fase 2 menjadi penerapan skema target langsung (lihat `08`).

## 5. Inventaris fitur yang ada (tidak boleh hilang)

Setiap fitur diberi disposisi: **Tetap** (dipertahankan dengan padanan di desain baru), **Diubah** (ada perubahan perilaku yang disengaja), **Dihapus** (dengan alasan).

### 5.1 Menu / view (`src/components/dashboard/views/`)

| View | Fitur yang ada | Disposisi | Padanan baru |
|---|---|---|---|
| `DasborView` | Total saldo semua akun, pemasukan/pengeluaran bulan ini vs bulan lalu, saldo bersih, saving rate, "tabungan aktual" (income ke akun `tabungan` + investasi bulan ini), area chart 6 bulan, donut kategori, goals aktif, hutang, budget over, 5 transaksi terbaru, daftar akun | Diubah | `GET /v1/summary?period=this_month&scope=household`, `GET /v1/reports/trend?months=6`, `GET /v1/accounts`. Tambah pemilih scope (household / member). |
| `TransaksiView` | Filter tanggal/bulan/tahun, tipe, akun (termasuk transfer masuk/keluar), kategori, teks; summary per filter; pagination 20/halaman client-side; edit, hapus; navigasi dari Kategori/Akun dengan filter awal | Diubah | `GET /v1/transactions` dengan filter dan cursor; badge pemilik akun dan `recorded_by`. |
| `AkunView` | Kartu per tipe (bank/ewallet/cash/tabungan), tab per akun, riwayat transaksi akun, koreksi saldo inline, "lihat transaksi" | Diubah | `GET /v1/accounts` (saldo derived, owner, visibility), `POST /v1/accounts/{id}/adjust-balance`. Tambah badge pemilik, filter owner, pembuatan akun joint/private, aliases. |
| `KategoriView` | Default + custom, tipe income/expense/both, filter, total bulan ini per kategori, CRUD custom | Diubah | Kategori jadi per household, default di-seed ke tabel (bukan hardcoded). `GET/POST/PATCH/DELETE /v1/categories`. Kategori sistem tidak bisa dihapus. |
| `BerulangView` | CRUD, status overdue/soon/paid, link ke hutang, perkiraan bulanan, dieksekusi otomatis saat dashboard load | Diubah | `/v1/recurrings`, `POST /v1/recurrings/run`, pg_cron harian. Kolom `type` eksplisit. Insufficient funds → dilewati dan dicatat `last_error`, bukan dipotong ke 0. |
| `GoalsView` | CRUD, deadline, top-up dengan/tanpa potong akun, progress | Tetap | `/v1/goals`, `POST /v1/goals/{id}/contributions`. Goal bisa milik member atau bersama. |
| `HutangView` | CRUD, bayar cicilan dari akun, due date, monthly | Tetap | `/v1/debts`, `POST /v1/debts/{id}/payments`. Riwayat pembayaran baru. |
| `PiutangView` | CRUD, catat piutang dengan/tanpa potong akun, terima pembayaran | Tetap | `/v1/piutang`, `POST /v1/piutang/{id}/receipts`. |
| `InvestasiView` | CRUD aset, harga emas live (Antam dkk) dari karaya-api, harga saham live, panduan harga | Tetap | `/v1/investments`. Harga live tetap dipanggil browser ke karaya-api (tidak lewat apps/api). |
| `AnggaranView` | Budget per kategori per bulan, salin dari bulan lalu, progres terpakai | Diubah | `/v1/budgets` dengan `period_start` dan `member_id` opsional, `GET /v1/budgets/status`, `POST /v1/budgets/copy`. |
| `LaporanView` | Period chips (bulan ini/lalu/tahun/semua/custom), KPI vs periode sebelumnya, donut, line harian, heatmap, kategori teratas | Diubah | `GET /v1/reports/*` dengan `scope=household|member|account`. |
| `PrediksiView` | Prediksi akhir bulan: kategori tetap (keyword) vs variabel (rata-rata 3 bulan / ekstrapolasi), alert budget | Tetap | Hitung di client dari `GET /v1/reports/by-category?months=4` atau endpoint `GET /v1/reports/forecast` (fase lanjut). |
| `SplitBillView` | CRUD tagihan + anggota, tandai lunas | Tetap | `/v1/split-bills`. Opsional link ke transaksi (fase lanjut). |
| `AiView` | Chat dengan AI Coach, provider/model dari settings, 2-pass untuk Groq | Diubah | `POST /v1/ai/chat`; tool memakai service layer yang sama dengan REST. |

### 5.2 Modal dan komponen

| Komponen | Fitur | Disposisi |
|---|---|---|
| `AddTransactionModal` (2.092 baris) | Tambah/edit expense & income, transfer antar akun, scan struk (Tesseract OCR lokal atau AI vision via key user), pilih item hasil scan, simpan batch | Diubah: pemilih akun menampilkan pemilik; scan AI pindah ke server; batch → `POST /v1/transactions/batch`. |
| `AddAccountModal` | Nama, tipe, saldo awal | Diubah: tambah pemilik (saya / member lain / bersama), visibilitas, aliases. |
| `PricingModal`, `PricingSection`, `plans.js`, `faqs.js` | Tampilan harga; tombol beli hanya alert | Tetap (non-tujuan). |
| `Sidebar` | Navigasi grup, sembunyikan menu, avatar color, nama & tagline app custom, bahasa, tema, install PWA, profil (nama, password), AI Coach settings, Export CSV, hapus akun | Diubah: tambah Settings → Anggota, Undangan, API Key, Household (nama, zona waktu); Export CSV pindah ke `GET /v1/transactions/export.csv`. |
| `LanguageContext`, `ThemeContext` | 6 bahasa, tema dark/light | Tetap. |
| `InstallBanner`, `Toast`, `Skeleton`, dll. | UI util | Tetap. |
| Landing (`HeroSection`, `LoginModal`, `SignupModal`, `ForgotPasswordModal`, …) | Marketing + auth | Tetap; auth tetap Supabase client. |
| `ResetPasswordPage` | Set password baru dari link email | Tetap. |

### 5.3 Perilaku server yang harus dipertahankan

| Perilaku | Sumber | Padanan |
|---|---|---|
| Validasi saldo cukup sebelum expense/transfer/cicilan/top-up/piutang | semua handler | Aturan `insufficient_funds` di fungsi plpgsql dengan lock baris akun. |
| Koreksi saldo membuat transaksi audit "Koreksi Saldo" bertanggal hari ini | `handleAdjustBalance` | `adjust_balance()`; tanggal default `today` zona household, boleh di-override. |
| Batch insert untuk scan struk, validasi total ≤ saldo | `handleAddMultiple` | `post_transactions_batch()` atomik. |
| Edit transfer hanya boleh ubah note dan date | `handleEdit` | Dipertahankan; ubah jumlah transfer = hapus + buat baru (hint di error). |
| Hapus akun ditolak kalau masih punya transaksi | `handleDeleteAccount` | Diubah: ditolak kalau saldo derived ≠ 0 **atau** masih punya transaksi aktif (`account_has_transactions`), lihat ADR-16. |
| Recurring link ke hutang: eksekusi mengurangi sisa hutang | `auto-recurrings` | `run_due_recurrings()` membuat `debt_payments` bila `debt_id` terisi. |
| Nama akun unik per user | `handleAddAccount` | Unik per `(household_id, owner_member_id, lower(name))` → dua "BCA" boleh kalau pemilik beda. |
| Terima piutang menambah saldo + audit income "Piutang" | `handleTerimaPiutang` | `receive_piutang()`. |
| Piutang dengan `from_account` memotong saldo + audit expense "Piutang" | `handleAddPiutang` | `lend_piutang()`. |
| Top-up goal tanpa akun hanya menaikkan `current` | `handleTopupGoal` | `topup_goal(p_account_id => NULL)`: kontribusi tanpa `transaction_id`. |
| Midtrans webhook: verifikasi signature SHA-512, parse `order_id` `karaya-{plan}-{uuid}-{ts}`, upsert subscription dengan durasi trial 14 / starter 30 / pro 90 hari | `payment-webhook` | Dipindah identik ke `POST /v1/webhooks/midtrans`. |
| `update-subscription` dengan `x-function-secret` | `update-subscription` | Dipindah identik ke `POST /v1/internal/subscriptions`. |
| AI chat: provider OpenAI-compatible (openai, groq, mistral, xai, deepseek, kimi), Anthropic, Google; tool calling untuk provider andal, 2-pass planner+analyst untuk Groq; history 20 pesan terakhir; key dari `user_settings.ai_config` | `ai-chat` | Dipindah ke `apps/api/src/ai/`; tool `get_transactions`, `get_summary`, `get_accounts`, `get_debts`, `get_goals`, `get_investments` dipetakan ke service layer. |

### 5.4 Fitur yang dihapus

| Fitur | Alasan |
|---|---|
| Kolom `transactions.icon` per baris | Icon selalu diturunkan dari kategori (`categoryIcons[category]`) di semua jalur tulis; menyimpannya per baris hanya menambah inkonsistensi saat kategori di-rename. Frontend mengambil icon dari `categories.icon`. |
| Deteksi duplikat recurring via prefix `[Auto]` di note | Diganti `recurring_id` + unique index. Note tetap diisi nama recurring untuk keterbacaan. |
| Hard delete data pengguna dari browser (`deleteAccount`) | Diganti endpoint server yang menghapus `auth.users` (cascade) setelah memastikan user bukan satu-satunya owner di household yang masih punya member lain. |
| `scanReceiptWithAI` di browser | Dipindah ke server (ADR-18). OCR Tesseract lokal tetap di browser karena tidak butuh key. |
| Pemanggilan `auto-recurrings` dari `fetchAll()` | Diganti pg_cron; dashboard hanya memanggil `POST /v1/recurrings/run` sebagai fallback kalau `last_cron_run_at` lebih tua dari 1 hari. |

## 6. Kontrak API lama (ringkas, untuk pemetaan)

| Function | action | Pengganti di `/v1` (detail di `05-api.md`) |
|---|---|---|
| `transactions` | `add` | `POST /v1/transactions` |
| | `add-multiple` | `POST /v1/transactions/batch` |
| | `edit` | `PATCH /v1/transactions/{id}` |
| | `delete` | `DELETE /v1/transactions/{id}` (soft) |
| | `transfer` | `POST /v1/transfers` |
| | `adjust-balance` | `POST /v1/accounts/{id}/adjust-balance` |
| | `add-account` / `edit-account` / `delete-account` / `list-accounts` | `POST /v1/accounts`, `PATCH /v1/accounts/{id}`, `DELETE /v1/accounts/{id}`, `GET /v1/accounts` |
| `financial-ops` | `pay-debt` | `POST /v1/debts/{id}/payments` |
| | `topup-goal` | `POST /v1/goals/{id}/contributions` |
| | `add-piutang` | `POST /v1/piutang` (body `from_account_id` opsional) |
| | `terima-piutang` | `POST /v1/piutang/{id}/receipts` |
| `auto-recurrings` | (body `today`) | `POST /v1/recurrings/run` |
| `ai-chat` | (body `messages`) | `POST /v1/ai/chat` |
| `payment-webhook` | Midtrans | `POST /v1/webhooks/midtrans` |
| `update-subscription` | `x-function-secret` | `POST /v1/internal/subscriptions` |
| Hook langsung | `budgets`, `categories`, `debts`, `goals`, `investments`, `piutang`, `recurring_transactions`, `split_bills(+members)`, `user_settings` | Resource REST masing-masing, lihat `05-api.md` §4 |

## 7. Hal yang sudah bagus dan dipertahankan

- Uang BIGINT rupiah tanpa desimal.
- Validasi saldo cukup sebelum pengeluaran.
- Audit trail "Koreksi Saldo" sebagai transaksi, bukan edit angka.
- Batch insert untuk scan struk.
- Recurring yang terhubung ke hutang.
- AI chat dengan tool calling di server dan key tersimpan di DB (akan ditutup celah T2 dan T6).
- `toLocalDateStr()` di frontend menghindari bug UTC untuk tanggal transaksi.
- PWA, i18n 6 bahasa, tema.
