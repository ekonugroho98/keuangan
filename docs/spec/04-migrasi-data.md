Status: ARSIP (tidak berlaku sejak 2026-10-04)
Terakhir diubah: 2026-10-04
Bergantung pada: 01-kondisi-saat-ini.md, 03-database.md

# 04 — Migrasi Data (ARSIP)

> **Tidak berlaku.** Pada 2026-10-04 pemilik produk memutuskan mengosongkan DB produksi (13 tabel domain di-drop, 4 user auth dihapus; `gold_prices` dipertahankan). Backup lengkap ada di `backups/pre-wipe-schema.sql` dan `backups/pre-wipe-data.sql` (lokal, gitignored) serta `docs/reference/legacy-schema-live-2026-10-04.sql`. Kalau suatu saat data lama perlu dipulihkan ke skema baru, bab ini adalah rencananya; sampai saat itu, **jangan dikerjakan**. Fase 2 yang berlaku ada di `08-rencana-implementasi.md` (revisi 2026-10-04).
>
> Yang masih dipakai dari bab ini: §4.5 `parse_legacy_date` (berguna untuk impor CSV di masa depan) dan pola skrip verifikasi §6 sebagai inspirasi `supabase/scripts/verify_schema.sql`.


## 1. Prinsip

1. **Expand → migrate → contract** (ADR-12). Kolom lama tidak dihapus sampai semua pembaca dan penulis sudah pindah (Fase 4 selesai dan stabil minimal 7 hari).
2. **Baseline dari DB live**, bukan dari `supabase_schema.sql` (lihat `01` §4). Semua `ADD COLUMN` memakai `IF NOT EXISTS`, semua `CREATE TYPE` dibungkus `DO $$ … IF NOT EXISTS`.
3. **Backfill idempoten**: setiap skrip backfill bisa dijalankan ulang tanpa menggandakan data (memakai `WHERE kolom_baru IS NULL` atau `ON CONFLICT`).
4. **Setiap langkah punya**: file `up`, file `down` di `supabase/migrations_down/`, dan query verifikasi yang hasilnya harus hijau sebelum lanjut.
5. **Backup penuh sebelum setiap fase migrasi** dengan `supabase db dump --data-only` + `--schema public` ke file lokal terenkripsi (free tier tidak punya PITR; backup harian Supabase free hanya 7 hari dan tidak bisa restore parsial).
6. Migrasi dijalankan oleh `supabase db push` dari mesin developer (bukan CI otomatis) dengan `PROGRESS.md` diperbarui setelah tiap langkah.
7. Selama expand, frontend lama dan edge function lama **tetap berjalan** di atas kolom lama; trigger sinkronisasi mengisi kolom baru. Sebaliknya, `apps/api` menulis kolom baru dan trigger mengisi kolom lama. Jadi dua dunia konsisten sampai contract.

## 2. Pemetaan lama → baru

| Tabel lama | Kolom lama | Kolom/tabel baru | Aturan transformasi |
|---|---|---|---|
| `auth.users` (tiap user yang punya ≥1 baris di tabel domain **atau** `user_settings`) | — | `households` (1 per user), `household_members` (1 owner per household) | `households.name = coalesce(user_metadata.full_name, split_part(email,'@',1)) || ' Family'`; `household_members.display_name = coalesce(full_name, split_part(email,'@',1))`, `role='owner'`, `aliases='{saya}'` |
| `accounts` | `user_id` | `household_id` | lookup household via `household_members.user_id` |
| | `balance` | `opening_balance` | `opening_balance = balance_lama − efek(transaksi lama akun ini)`; lihat §4.3 |
| | — | `owner_member_id` | member owner dari user tersebut (semua akun lama = milik pribadi; user bisa mengubah ke joint nanti) |
| | — | `visibility` | `'shared'` (household baru hanya berisi 1 member; saat pasangan bergabung, user memutuskan). Lihat Q-05 |
| | — | `aliases` | `'{}'`; lalu backfill `{lower(name)}` kalau nama ≠ lower(name) |
| `transactions` | `account_name` | `account_id` | lookup `(user_id, name)` di `accounts`; kalau DB live sudah punya `account_id` terisi, pakai itu. Tidak ketemu → §4.4 |
| | `to_account` | `to_account_id` | lookup sama; hanya untuk `type='transfer'` |
| | `category` TEXT | `category_id` | lookup kategori household (case-insensitive, unaccent) termasuk kategori sistem; tidak ketemu → buat kategori baru di household dengan `type` dari tipe transaksi (`income`→`income`, `expense`→`expense`, campuran→`both`), `icon` dari `categoryIcons` kalau ada, dan catat `migration_issues(category_created)` |
| | `type` TEXT | `type tx_type` | cast langsung; nilai di luar `income|expense|transfer` → `migration_issues(invalid_type)` dan baris di-skip (ditandai `deleted_at = now()`, `note || ' [migrasi: tipe tidak valid]'`) |
| | `user_id` | `recorded_by_member_id` | member owner dari user tersebut |
| | — | `source` | `'migration'` |
| | `note LIKE '[Auto] %'` | `recurring_id` | cocokkan `substr(note, 8)` dengan `recurring_transactions.name` user yang sama; cocok → isi `recurring_id`, bersihkan prefix dari `note`. Duplikat `(recurring_id, date)` → yang kedua dst. di-soft-delete dan dicatat `duplicate_recurring` |
| | `icon` | — | dibuang |
| `categories` | `user_id`, `name`, `type`, `icon`, `color` | `categories` household | masukkan sebagai non-sistem; bentrok nama (case-insensitive) dengan default → pakai default, salin icon/color custom ke default |
| `budgets` | `category` TEXT | `category_id` | lookup/buat seperti transaksi |
| | `month "YYYY-MM"` | `period_start` | `to_date(month || '-01', 'YYYY-MM-DD')`; gagal parse → `migration_issues(invalid_month)`, baris di-soft-delete |
| | — | `member_id` | `NULL` (anggaran household) |
| `goals` | `current` | `opening_amount` | salin |
| | `deadline` (jika ada di live) | `deadline DATE` | parse §4.5 |
| | — | `owner_member_id` | member owner |
| `debts` | `total`, `remaining` | `total`, `opening_paid = GREATEST(0, total − remaining)` | `remaining > total` → `opening_paid = 0`, catat `negative_paid` |
| | `due_date` TEXT | `due_date DATE` | parse §4.5 |
| | `name` | `aliases` | `'{}'` |
| `piutang` | `total`, `remaining` | `total`, `opening_received = GREATEST(0, total − remaining)` | sama |
| | `from_account` TEXT | `from_account_id` | lookup; tidak ketemu → NULL + `migration_issues` |
| | `due_date`, `notes` | `due_date DATE`, `notes` | parse; `notes NULL → ''` |
| `recurring_transactions` | `account_name`, `category` | `account_id`, `category_id` | lookup/buat |
| | — | `type` | `'income'` kalau kategori hasil lookup bertipe `income`, selain itu `'expense'` (meniru `INCOME_CATS` di `BerulangView`) |
| | — | `member_id` | member owner |
| | `next_date` | `next_date`, `anchor_day` | `anchor_day = extract(day from next_date)` |
| `split_bills` | `user_id` | `household_id`, `created_by_member_id` | |
| `split_bill_members` | `paid BOOLEAN` | `paid_at` | `paid ? created_at : NULL` |
| `investments` | `user_id` | `household_id`, `owner_member_id` | |
| `user_settings` | — | `+ active_household_id` | household hasil migrasi |
| `subscriptions` | — | tidak berubah | |

Transaksi lama yang berhubungan dengan hutang/goal/piutang (kategori "Hutang & Cicilan", "Tabungan & Goal", "Piutang") **tidak** di-backfill menjadi `debt_payments`/`goal_contributions`/`piutang_receipts`, karena tidak ada kunci yang menghubungkannya ke hutang/goal tertentu (hanya nama di `note`). Sisa hutang/goal/piutang lama diwakili oleh `opening_*`. Konsekuensi: menghapus transaksi cicilan **lama** tidak mengubah sisa hutang (sama seperti perilaku lama). Dicatat di Q-06.

## 3. Trigger sinkronisasi selama expand

Dua arah, dipasang di migrasi `0007` dan dicabut di fase contract.

| Tabel | Arah lama → baru (penulis: edge function/hook lama) | Arah baru → lama (penulis: apps/api) |
|---|---|---|
| `accounts` | `BEFORE INSERT`: jika `household_id IS NULL` → isi dari `user_id`; `owner_member_id` → member owner user; `opening_balance = NEW.balance` (akun baru tanpa transaksi); `visibility = 'shared'` | `BEFORE INSERT/UPDATE`: jika `user_id IS NULL` → isi dari `owner_member_id → user_id` (joint → user owner pertama household); `balance` **dipertahankan** oleh trigger di `transactions` (lihat baris berikut) agar frontend lama tetap melihat saldo |
| `transactions` | `BEFORE INSERT/UPDATE`: isi `household_id`, `account_id` (lookup `(user_id, account_name)`), `to_account_id`, `category_id` (lookup/buat), `recorded_by_member_id`, `source='web'` | `BEFORE INSERT/UPDATE`: isi `user_id` (dari recorded_by), `account_name`, `to_account`, `category` TEXT dari FK. **`AFTER INSERT/UPDATE/DELETE`**: hitung ulang `accounts.balance = account_balance(account_id)` untuk akun terdampak (hanya selama expand; ini satu-satunya tempat `balance` lama diisi oleh sistem baru). Edge function lama yang masih meng-update `balance` sendiri akan ditimpa oleh nilai derived yang benar → **menyembuhkan drift lama** |
| `budgets` | isi `household_id`, `category_id`, `period_start` dari `month` | isi `user_id`, `category`, `month = to_char(period_start,'YYYY-MM')` |
| `recurring_transactions` | isi `household_id`, `member_id`, `account_id`, `category_id`, `type`, `anchor_day` | isi `user_id`, `account_name`, `category` |
| `goals`, `debts`, `piutang`, `investments`, `split_bills`, `categories` | isi `household_id`, `owner_member_id`/`created_by_member_id` dari `user_id` | isi `user_id` |
| `debts`, `piutang` | — | `remaining` lama diisi ulang `AFTER` perubahan `debt_payments`/`piutang_receipts`/transaksi terkait: `remaining = (SELECT remaining FROM v_debts WHERE id = …)` |
| `goals` | — | `current` lama diisi ulang dari `v_goals` |

Konflik yang disengaja: edge function lama `handleEdit` mengubah `account_name` saja; trigger lama→baru melakukan lookup ulang `account_id`. Edge function lama `edit-account` me-rename akun: trigger `accounts AFTER UPDATE OF name` memperbarui `transactions.account_name/to_account` untuk `account_id` tersebut, supaya kolom lama tetap konsisten dengan FK (ini juga memperbaiki masalah #1 untuk pengguna selama transisi).

## 4. Aturan khusus

### 4.1 User tanpa data

User di `auth.users` yang tidak punya baris di tabel mana pun **tidak** dibuatkan household saat migrasi; household dibuat saat login pertama lewat `POST /v1/households` otomatis oleh frontend (onboarding). Alasan: menghindari household kosong untuk akun percobaan.

### 4.2 Pencocokan nama akun

`lower(unaccent(trim(account_name))) = lower(unaccent(trim(accounts.name)))` dalam `user_id` yang sama. Kalau ada > 1 akun dengan nama sama untuk user yang sama (mungkin, karena tidak ada UNIQUE), pilih yang `created_at` paling awal dan catat `migration_issues(ambiguous_account_name)`.

### 4.3 Menghitung `opening_balance`

```sql
UPDATE accounts a SET opening_balance = a.balance - COALESCE(e.effect, 0)
FROM (
  SELECT acc.id,
    SUM(CASE WHEN t.type='income'   AND t.account_id    = acc.id THEN  t.amount
             WHEN t.type='expense'  AND t.account_id    = acc.id THEN -t.amount
             WHEN t.type='transfer' AND t.account_id    = acc.id THEN -t.amount
             WHEN t.type='transfer' AND t.to_account_id = acc.id THEN  t.amount END) AS effect
  FROM accounts acc
  JOIN transactions t ON (t.account_id = acc.id OR t.to_account_id = acc.id) AND t.deleted_at IS NULL
  GROUP BY acc.id
) e
WHERE e.id = a.id AND a.opening_balance = 0 AND a.household_id IS NOT NULL;
```

Dijalankan **setelah** `account_id`/`to_account_id` terisi. Jika hasilnya `< 0` (saldo lama lebih kecil dari yang seharusnya karena drift), tetap simpan nilai negatif? **Tidak**: `opening_balance` punya CHECK `>= 0`. Aturan: kalau negatif, set `opening_balance = 0` dan buat transaksi Koreksi Saldo `expense` sebesar selisih bertanggal `created_at` akun, `source='migration'`, note `Koreksi migrasi (drift saldo lama)`, dan catat `migration_issues(negative_opening_balance)`. Dengan begitu saldo derived tetap = saldo lama yang dilihat user.

### 4.4 `account_name` yang tidak ditemukan

Buat akun placeholder di household user: `name = account_name || ' (migrasi)'`, `type='bank'`, `opening_balance=0`, `needs_review=true`, `owner_member_id` = member owner. Semua transaksi dengan nama itu menunjuk ke akun placeholder. Saldo derived placeholder bisa negatif secara matematis (hanya expense) → `opening_balance` diisi agar saldo = 0 (asumsi: akun sudah dihapus user, uangnya sudah tidak ada). Catat `migration_issues(account_not_found, {account_name, tx_count, net_effect})`. UI Fase 5 menampilkan banner "n akun hasil migrasi perlu ditinjau".

### 4.5 Parsing `due_date` / `deadline` TEXT → DATE

```sql
CREATE FUNCTION parse_legacy_date(p TEXT) RETURNS DATE LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s TEXT := trim(p);
BEGIN
  IF s IS NULL OR s = '' THEN RETURN NULL; END IF;
  IF s ~ '^\d{4}-\d{2}-\d{2}$'      THEN RETURN s::date; END IF;                       -- 2026-06-30
  IF s ~ '^\d{4}-\d{2}-\d{2}T'      THEN RETURN left(s,10)::date; END IF;              -- ISO timestamp
  IF s ~ '^\d{2}/\d{2}/\d{4}$'      THEN RETURN to_date(s, 'DD/MM/YYYY'); END IF;      -- 30/06/2026 (asumsi DD/MM, lokal Indonesia)
  IF s ~ '^\d{4}-\d{2}$'            THEN RETURN to_date(s||'-01','YYYY-MM-DD'); END IF; -- 2026-06 → awal bulan
  IF s ~ '^\d{1,2}$'                THEN RETURN NULL; END IF;                           -- "15" (tanggal tiap bulan) → tidak bisa jadi DATE; lihat catatan
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;
```

Nilai yang menghasilkan NULL tapi string aslinya tidak kosong → `migration_issues(due_date_unparseable, {raw})` dan string asli disimpan ke `notes` sebagai `[jatuh tempo lama: "<raw>"]` supaya tidak hilang.

### 4.6 Kategori teks "liar"

Daftar nilai `category` distinct per user digabung dengan default. Normalisasi tambahan sebelum lookup: `Makanan & Minuman → Makanan`, `Belanja → Shopping`, `Transportasi → Transport`, `Tagihan → Utilitas` (peta eksplisit di `supabase/scripts/backfill_categories.sql`, mengikuti `guessCategory()` di modal). Yang tetap tidak ketemu dibuat sebagai kategori baru.

## 5. Urutan file migrasi

Nama memakai timestamp `YYYYMMDDHHMMSS_<slug>.sql` (format Supabase CLI). Angka di bawah hanya urutan logis.

| # | File | Isi ringkas | Fase | Down |
|---|---|---|---|---|
| 00 | `..._baseline.sql` | Hasil `supabase db dump --schema public` DB live, dibersihkan dari `CREATE SCHEMA public`. Di-mark sebagai sudah diterapkan di live (`supabase migration repair --status applied`) | 0 | — |
| 01 | `..._extensions_enums.sql` | §2 `03-database.md` | 2 | `DROP TYPE … ; DROP EXTENSION pg_trgm, unaccent` (pg_cron biarkan) |
| 02 | `..._households_members_invitations.sql` | tabel 3.1–3.3, trigger `validate_timezone`, fungsi `create_household`, `seed_household_categories` (tabel `categories` di-expand dulu di 03, jadi fungsi seed dibuat di 03) | 2 | DROP tabel |
| 03 | `..._expand_domain_tables.sql` | `ALTER TABLE … ADD COLUMN IF NOT EXISTS` untuk semua kolom baru di `accounts`, `categories`, `transactions`, `budgets`, `goals`, `debts`, `piutang`, `recurring_transactions`, `split_bills`, `split_bill_members`, `investments`, `user_settings`; kolom baru **nullable dulu**; `transactions.type` dikonversi ke enum lewat kolom baru `type_v2 tx_type` (bukan ALTER TYPE langsung, agar edge lama yang menulis TEXT tetap jalan); `CHECK` lama `transactions_type_check` di-DROP; tabel baru `debt_payments`, `goal_contributions`, `piutang_receipts`, `migration_issues`; fungsi `parse_legacy_date`, `seed_household_categories` | 2 | DROP COLUMN semua kolom baru; DROP tabel baru; restore CHECK lama |
| 04 | `..._backfill_households.sql` | Buat household + member owner untuk setiap user yang punya data (§4.1); isi `user_settings.active_household_id` | 2 | DELETE households yang `created_at` dalam window migrasi (ditandai `households.name LIKE '% Family'` dan `migration_batch` di `migration_issues`) |
| 05 | `..._backfill_categories.sql` | Seed default+sistem per household; impor custom; bangun peta `category text → id` dan isi `category_id` di transactions, budgets, recurring (§4.6) | 2 | `UPDATE … SET category_id = NULL`; DELETE categories household-level |
| 06 | `..._backfill_accounts_transactions.sql` | Isi `accounts.household_id/owner_member_id/visibility`; isi `transactions.household_id/account_id/to_account_id/recorded_by/type_v2/source/recurring_id` (§4.2, §4.4); isi tabel lain (`budgets.period_start/household_id`, goals, debts (`opening_paid`, `due_date`), piutang, recurring, split_bills, investments); hitung `opening_balance` (§4.3) | 2 | `UPDATE … SET kolom_baru = NULL`; hapus akun placeholder (`needs_review`) dan transaksi koreksi `source='migration'` |
| 07 | `..._sync_triggers.sql` | Trigger dua arah §3 | 2 | DROP TRIGGER |
| 08 | `..._constraints_v2.sql` | Setelah verifikasi §6 hijau: `SET NOT NULL` pada `household_id`, `account_id`, `category_id`, `recorded_by_member_id`, `type_v2`; FK; unique index v2; `tx_transfer_shape`; index §9 | 2 | DROP constraint/index; `DROP NOT NULL` |
| 09 | `..._views_functions.sql` | View §4, fungsi §8 (semua), trigger §8.4, role `karaya_api` (password lewat `\set` dari env saat apply, bukan hardcode) | 2 | DROP FUNCTION/VIEW |
| 10 | `..._rls_v2.sql` | Helper §7.2; policy baru **ditambahkan di samping policy lama** (`auth.uid() = user_id`) → selama expand keduanya berlaku (OR), jadi edge lama tetap lolos | 2 | DROP policy baru |
| 11 | `..._api_infra.sql` | `api_keys`, `idempotency_keys`, `rate_limit_counters`, `audit_log`, `bump_rate_limit`, grant `karaya_api` | 3 | DROP |
| 12 | `..._cron.sql` | §10 jadwal | 3 | `cron.unschedule` |
| 12b | `..._merge_household.sql` | Fungsi `merge_household_into` + kolom `households.merged_into_household_id` sudah ada sejak 02; pgTAP merge | 5 | DROP FUNCTION |
| 13 | `..._contract_drop_legacy.sql` | **Fase contract** (setelah Fase 4 stabil ≥ 7 hari): DROP trigger sinkronisasi; DROP policy lama `auth.uid() = user_id`; DROP kolom `transactions.account_name/to_account/category/icon/type` (TEXT) lalu `RENAME type_v2 → type`; DROP `accounts.balance`, `accounts.user_id`, `budgets.month/category/user_id`, `recurring.account_name/category/user_id`, `goals.current/user_id`, `debts.remaining/user_id`, `piutang.remaining/from_account/user_id`, `categories.user_id`, `split_bills.user_id`, `investments.user_id`, `split_bill_members.paid`; DROP `migration_issues`? **tidak** (dipertahankan 90 hari) | 4+ | **Tidak ada down otomatis**: restore dari backup data-only yang diambil tepat sebelum langkah ini. Karena itu langkah ini dijalankan terakhir dan terpisah. |

## 6. Skrip verifikasi (`supabase/scripts/verify_migration.sql`)

Setiap blok mengembalikan satu baris `check, expected, actual, ok`. Skrip gagal (`\set ON_ERROR_STOP` + `RAISE` di akhir) kalau ada `ok = false`.

```sql
-- V1 jumlah baris tidak berubah per tabel (tidak ada yang hilang)
SELECT 'transactions_count', (SELECT count(*) FROM transactions_snapshot), (SELECT count(*) FROM transactions), …;
-- transactions_snapshot dibuat di awal fase: CREATE TABLE transactions_snapshot AS SELECT id, user_id, type, amount, account_name, to_account, category, date FROM transactions;

-- V2 setiap user yang punya data punya tepat satu household & satu member owner
SELECT 'users_without_household', 0, count(*) FROM (SELECT DISTINCT user_id FROM accounts) u
  WHERE NOT EXISTS (SELECT 1 FROM household_members m WHERE m.user_id = u.user_id AND m.role='owner');

-- V3 tidak ada transaksi aktif tanpa FK
SELECT 'tx_missing_account_id', 0, count(*) FROM transactions WHERE deleted_at IS NULL AND account_id IS NULL;
SELECT 'tx_missing_category_id', 0, count(*) FROM transactions WHERE deleted_at IS NULL AND category_id IS NULL;
SELECT 'tx_transfer_missing_to', 0, count(*) FROM transactions WHERE deleted_at IS NULL AND type_v2='transfer' AND to_account_id IS NULL;
SELECT 'tx_household_mismatch', 0, count(*) FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.household_id <> a.household_id;

-- V4 TOTAL SALDO SEBELUM == SESUDAH, per akun dan agregat
SELECT 'balance_sum', (SELECT sum(balance) FROM accounts_snapshot), (SELECT sum(balance) FROM v_account_balances), …;
SELECT 'balance_per_account_mismatch', 0, count(*) FROM accounts_snapshot s JOIN v_account_balances v ON v.account_id = s.id WHERE s.balance <> v.balance;

-- V5 sisa hutang/piutang/goal identik
SELECT 'debt_remaining_mismatch', 0, count(*) FROM debts_snapshot s JOIN v_debts v ON v.id=s.id WHERE s.remaining <> v.remaining;
SELECT 'piutang_remaining_mismatch', 0, count(*) FROM piutang_snapshot s JOIN v_piutang v ON v.id=s.id WHERE s.remaining <> v.remaining;
SELECT 'goal_current_mismatch', 0, count(*) FROM goals_snapshot s JOIN v_goals v ON v.id=s.id WHERE s.current <> v.current;

-- V6 total nominal transaksi per tipe identik (membuktikan tidak ada amount yang berubah)
SELECT 'sum_income', (SELECT sum(amount) FROM transactions_snapshot WHERE type='income'), (SELECT sum(amount) FROM transactions WHERE type_v2='income' AND source <> 'migration'), …;

-- V7 budgets: jumlah dan period_start valid
SELECT 'budget_period_invalid', 0, count(*) FROM budgets WHERE deleted_at IS NULL AND (period_start IS NULL OR period_start <> date_trunc('month', period_start)::date);

-- V8 kategori: setiap household punya 5 kategori sistem
SELECT 'households_missing_system_cats', 0, count(*) FROM households h WHERE (SELECT count(*) FROM categories c WHERE c.household_id=h.id AND c.is_system) <> 5;

-- V9 laporan masalah (informasional, tidak menggagalkan)
SELECT issue, count(*) FROM migration_issues GROUP BY issue ORDER BY 2 DESC;

-- V10 setelah contract: kolom legacy sudah tidak ada
SELECT 'legacy_columns_remaining', 0, count(*) FROM information_schema.columns
 WHERE table_schema='public' AND (table_name, column_name) IN (('transactions','account_name'),('transactions','category'),('accounts','balance'),('budgets','month'));
```

Tabel `*_snapshot` dibuat oleh `supabase/scripts/snapshot_before.sql` di awal Fase 2 dan dihapus setelah contract.

Verifikasi fungsional tambahan (dijalankan manual, hasil dicatat di `PROGRESS.md`): login dengan akun tester lama di frontend lama (masih di atas edge function) → tambah expense, transfer, bayar cicilan → `verify_migration.sql` tetap hijau (membuktikan trigger sinkronisasi dua arah).

## 7. Rollback per fase

| Situasi | Tindakan |
|---|---|
| Migrasi 01–03 gagal di tengah | Supabase CLI menjalankan tiap file dalam transaksi; file yang gagal otomatis rollback. Jalankan `down` file sebelumnya kalau perlu kembali lebih jauh. |
| Backfill 04–06 menghasilkan verifikasi merah | Jalankan `migrations_down/06`, `05`, `04` berurutan (semuanya hanya `UPDATE … SET NULL` / `DELETE` baris yang dibuat migrasi, data lama tidak tersentuh). Perbaiki skrip, ulangi. Frontend lama tidak terpengaruh sepanjang waktu karena hanya membaca kolom lama. |
| Trigger sinkronisasi (07) menyebabkan error di edge function lama | `DROP TRIGGER` (down 07). Kolom baru berhenti ter-update untuk tulisan baru; backfill ulang 06 (idempoten) setelah perbaikan. |
| Constraint v2 (08) gagal `SET NOT NULL` | Berarti verifikasi V3 dilewati; kembali ke 06. |
| `apps/api` (Fase 3) salah tulis data | Fungsi atomik tidak menyentuh kolom lama secara langsung; drop trigger baru→lama dan perbaiki. Data transaksi yang salah di-soft-delete lewat API. |
| Contract (13) ternyata prematur | Restore backup data-only ke tabel yang terdampak, atau terima kehilangan kolom legacy (yang memang tidak dipakai lagi). Karena itu syarat contract: `apps/web` dan Hermes sudah 7 hari tanpa akses ke kolom legacy (cek `pg_stat_statements` tidak mengandung `account_name`). |

## 8. Dampak ke setiap edge function dan hook

| Kode lama | Status selama expand (Fase 2–3) | Pengganti di `apps/api` | Dimatikan pada |
|---|---|---|---|
| `functions/transactions` `add/add-multiple/edit/delete/transfer/adjust-balance` | Tetap jalan; trigger mengisi kolom baru; `balance` lama ditimpa nilai derived | `services/transactions.ts` → `post_transaction`, `post_transactions_batch`, `update_transaction`, `delete_transaction`, `post_transfer`, `adjust_balance` | Fase 4 |
| `functions/transactions` `add-account/edit-account/delete-account/list-accounts` | Tetap | `services/accounts.ts` | Fase 4 |
| `functions/financial-ops` | Tetap (menulis `remaining`/`current` lama; trigger baru→lama tidak berlaku untuk tulisan lama, jadi `opening_*` **tidak** berubah → sisa hutang lama dan `v_debts` bisa berbeda sampai Fase 4). Mitigasi: trigger lama→baru pada `debts.remaining` UPDATE menyesuaikan `opening_paid` = `total − remaining − Σ payments` | `services/debts.ts`, `goals.ts`, `piutang.ts` → `pay_debt`, `topup_goal`, `lend_piutang`, `receive_piutang` | Fase 4 |
| `functions/auto-recurrings` | Tetap, tapi `Math.max(0, …)` tidak lagi berbahaya karena `balance` ditimpa derived; transaksi `[Auto]` yang dibuatnya dapat `recurring_id` lewat trigger lama→baru (lookup nama) | `run_due_recurrings` + pg_cron + `POST /v1/recurrings/run` | Fase 4 (frontend berhenti memanggil) dan undeploy Fase 5 |
| `functions/ai-chat` | Tetap | `routes/ai.ts` + `ai/chat.ts` | Fase 6 |
| `functions/payment-webhook` | Tetap; URL Midtrans diubah saat cutover | `routes/webhooks.ts` | Fase 6 |
| `functions/update-subscription` | Tetap | `routes/internal.ts` | Fase 6 |
| `hooks/useBudgets` | Tetap (kolom `month`, `category` lama) | `api/queries/budgets.ts` | Fase 4 |
| `hooks/useCategories` | Tetap | `api/queries/categories.ts` | Fase 4 |
| `hooks/useDebts`, `useGoals`, `usePiutang` | Tetap | `api/queries/debts.ts`, `goals.ts`, `piutang.ts` | Fase 4 |
| `hooks/useInvestments`, `useRecurrings`, `useSplitBills` | Tetap | `api/queries/*.ts` | Fase 4 |
| `Dashboard.jsx fetchAll()` | Tetap | `api/queries/bootstrap.ts` (`GET /v1/bootstrap`) | Fase 4 |
| `Dashboard.jsx saveSettings/saveAiConfig/fetchSettings` | Tetap | `GET/PATCH /v1/me/settings` | Fase 4 |
| `Dashboard.jsx deleteAccount()` | Tetap (tidak lengkap) | `DELETE /v1/me` | Fase 4 |
| `services/api.js callEdge` | Tetap | `apps/web/src/api/client.ts` | Fase 4 |
| `services/goldPrice.js`, `stockPrice.js` | Tetap, langsung ke karaya-api | tidak berubah | — |
| `scripts/seed_*.py` | Dihapus Fase 1 | `supabase/seed.sql` | Fase 1 |
