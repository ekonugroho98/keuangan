-- ============================================================
-- FIX SECURITY: Subscription & Data Integrity
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. HAPUS UPDATE policy subscriptions (user tidak boleh ubah plan sendiri)
DROP POLICY IF EXISTS "subscriptions: user can update own" ON subscriptions;

-- 2. Tambah kolom payment_ref dan updated_at jika belum ada
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Pastikan user_id unique (satu user satu subscription)
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_key;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);

-- 4. Tambah CHECK constraint amount transaksi (max 100 juta per transaksi)
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS amount_reasonable;
ALTER TABLE transactions
  ADD CONSTRAINT amount_reasonable
  CHECK (amount > 0 AND amount <= 100000000000);

-- 5. Tambah CHECK constraint saldo akun
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS balance_reasonable;
ALTER TABLE accounts
  ADD CONSTRAINT balance_reasonable
  CHECK (balance >= 0 AND balance <= 100000000000);

-- ============================================================
-- Verifikasi: jalankan query ini untuk cek hasilnya
-- ============================================================
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'subscriptions';
