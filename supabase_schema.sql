-- =============================================
-- DATABASE SCHEMA — Jalankan sekali di Supabase SQL Editor
-- Membuat semua tabel + RLS policies sekaligus
-- =============================================

-- ─── ACCOUNTS ────────────────────────────────────────────────────────────────
CREATE TABLE accounts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN ('bank','ewallet','cash','crypto','investasi','tabungan')) NOT NULL,
  balance     BIGINT DEFAULT 0 NOT NULL,
  icon        TEXT DEFAULT '💰',
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRANSACTIONS ────────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type         TEXT CHECK (type IN ('income','expense')) NOT NULL,
  amount       BIGINT NOT NULL CHECK (amount > 0),
  category     TEXT NOT NULL,
  note         TEXT DEFAULT '',
  date         DATE NOT NULL,
  account_name TEXT NOT NULL,
  to_account   TEXT,                        -- akun tujuan (hanya untuk type='transfer')
  icon         TEXT DEFAULT '📦',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── GOALS ───────────────────────────────────────────────────────────────────
CREATE TABLE goals (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  target      BIGINT NOT NULL CHECK (target > 0),
  current     BIGINT DEFAULT 0 NOT NULL,
  icon        TEXT DEFAULT '🎯',
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DEBTS (hutang — user sebagai peminjam) ──────────────────────────────────
CREATE TABLE debts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  total       BIGINT NOT NULL,
  remaining   BIGINT NOT NULL,
  monthly     BIGINT NOT NULL DEFAULT 0,
  due_date    TEXT,
  icon        TEXT DEFAULT '📋',
  color       TEXT DEFAULT '#ef4444',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PIUTANG (uang yang dipinjamkan ke orang lain) ───────────────────────────
CREATE TABLE piutang (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  borrower_name TEXT NOT NULL,
  total         BIGINT NOT NULL,
  remaining     BIGINT NOT NULL,
  from_account  TEXT,
  due_date      TEXT,
  notes         TEXT,
  icon          TEXT DEFAULT '🤝',
  color         TEXT DEFAULT '#60fcc6',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CATEGORIES (kategori custom) ────────────────────────────────────────────
CREATE TABLE categories (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT DEFAULT '📦',
  type        TEXT CHECK (type IN ('income','expense','both')) DEFAULT 'expense',
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BUDGETS (anggaran per kategori per bulan) ───────────────────────────────
CREATE TABLE budgets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category    TEXT NOT NULL,
  amount      BIGINT NOT NULL CHECK (amount > 0),
  month       TEXT NOT NULL,  -- format: "YYYY-MM", contoh: "2026-04"
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, category, month)
);

-- ─── RECURRING TRANSACTIONS (transaksi berulang) ─────────────────────────────
CREATE TABLE recurring_transactions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  amount       BIGINT NOT NULL CHECK (amount > 0),
  icon         TEXT DEFAULT '🔄',
  category     TEXT NOT NULL,
  account_name TEXT NOT NULL,
  frequency    TEXT CHECK (frequency IN ('daily','weekly','monthly','yearly')) NOT NULL,
  next_date    DATE NOT NULL,
  notes        TEXT,
  debt_id      UUID REFERENCES debts(id) ON DELETE SET NULL,
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SPLIT BILLS (tagihan bersama) ───────────────────────────────────────────
CREATE TABLE split_bills (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  total_amount BIGINT NOT NULL CHECK (total_amount > 0),
  date         DATE NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE split_bill_members (
  id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id  UUID REFERENCES split_bills(id) ON DELETE CASCADE NOT NULL,
  name     TEXT NOT NULL,
  amount   BIGINT NOT NULL CHECK (amount > 0),
  paid     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVESTMENTS (portofolio investasi) ──────────────────────────────────────
CREATE TABLE investments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  icon          TEXT,
  color         TEXT,
  brand         TEXT,
  buy_price     BIGINT NOT NULL DEFAULT 0,
  current_value BIGINT NOT NULL DEFAULT 0,
  quantity      NUMERIC,
  unit          TEXT DEFAULT 'unit',
  kode_saham    TEXT,
  buy_date      DATE,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USER SETTINGS (preferensi UI per-user) ──────────────────────────────────
CREATE TABLE user_settings (
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  avatar_color TEXT    DEFAULT '#60fcc6',
  hidden_menus JSONB   DEFAULT '[]',
  app_name     TEXT    DEFAULT 'Karaya',
  app_tagline  TEXT    DEFAULT 'Wealth Ledger',
  ai_config    JSONB   DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS (status berlangganan) ─────────────────────────────────────
CREATE TABLE subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan       TEXT DEFAULT 'trial',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY — aktifkan di semua tabel
-- =============================================
ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE piutang               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_bills           ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_bill_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES — user hanya bisa akses data sendiri
-- =============================================

-- ACCOUNTS
CREATE POLICY "accounts: select own" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts: insert own" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts: update own" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts: delete own" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- TRANSACTIONS
CREATE POLICY "transactions: select own" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions: insert own" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions: update own" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions: delete own" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- GOALS
CREATE POLICY "goals: select own" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals: insert own" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals: update own" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals: delete own" ON goals FOR DELETE USING (auth.uid() = user_id);

-- DEBTS
CREATE POLICY "debts: select own" ON debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "debts: insert own" ON debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debts: update own" ON debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "debts: delete own" ON debts FOR DELETE USING (auth.uid() = user_id);

-- PIUTANG
CREATE POLICY "piutang: select own" ON piutang FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "piutang: insert own" ON piutang FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "piutang: update own" ON piutang FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "piutang: delete own" ON piutang FOR DELETE USING (auth.uid() = user_id);

-- CATEGORIES
CREATE POLICY "categories: select own" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories: insert own" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: update own" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories: delete own" ON categories FOR DELETE USING (auth.uid() = user_id);

-- BUDGETS
CREATE POLICY "budgets: select own" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budgets: insert own" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets: update own" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "budgets: delete own" ON budgets FOR DELETE USING (auth.uid() = user_id);

-- RECURRING TRANSACTIONS
CREATE POLICY "recurring: select own" ON recurring_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recurring: insert own" ON recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring: update own" ON recurring_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recurring: delete own" ON recurring_transactions FOR DELETE USING (auth.uid() = user_id);

-- SPLIT BILLS
CREATE POLICY "split_bills: select own" ON split_bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "split_bills: insert own" ON split_bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "split_bills: update own" ON split_bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "split_bills: delete own" ON split_bills FOR DELETE USING (auth.uid() = user_id);

-- SPLIT BILL MEMBERS (akses via join ke split_bills milik user)
CREATE POLICY "split_members: select own" ON split_bill_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM split_bills WHERE id = bill_id AND user_id = auth.uid())
  );
CREATE POLICY "split_members: insert own" ON split_bill_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM split_bills WHERE id = bill_id AND user_id = auth.uid())
  );
CREATE POLICY "split_members: update own" ON split_bill_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM split_bills WHERE id = bill_id AND user_id = auth.uid())
  );
CREATE POLICY "split_members: delete own" ON split_bill_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM split_bills WHERE id = bill_id AND user_id = auth.uid())
  );

-- INVESTMENTS
CREATE POLICY "investments: select own" ON investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "investments: insert own" ON investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "investments: update own" ON investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "investments: delete own" ON investments FOR DELETE USING (auth.uid() = user_id);

-- USER SETTINGS
CREATE POLICY "settings: own" ON user_settings
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SUBSCRIPTIONS
CREATE POLICY "subscriptions: select own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions: insert own" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subscriptions: update own" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
SELECT 'Database berhasil dibuat!' AS status;
-- =============================================
