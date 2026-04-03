-- =============================================
-- SIMETRI - Database Schema + RLS Policies
-- Jalankan di Supabase SQL Editor
-- =============================================

-- TABEL ACCOUNTS
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('bank','ewallet','cash','crypto','investasi')) NOT NULL,
  balance BIGINT DEFAULT 0 NOT NULL,
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABEL TRANSACTIONS
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('income','expense')) NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  note TEXT DEFAULT '',
  date DATE NOT NULL,
  account_name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABEL GOALS
CREATE TABLE goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target BIGINT NOT NULL CHECK (target > 0),
  current BIGINT DEFAULT 0 NOT NULL,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABEL DEBTS
CREATE TABLE debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  total BIGINT NOT NULL,
  remaining BIGINT NOT NULL,
  monthly BIGINT NOT NULL,
  due_date TEXT NOT NULL,
  icon TEXT DEFAULT '📋',
  color TEXT DEFAULT '#ef4444',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY — AKTIFKAN DI SEMUA TABEL
-- =============================================
ALTER TABLE accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts       ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES — User hanya bisa akses data sendiri
-- =============================================

-- ACCOUNTS
CREATE POLICY "accounts: user can select own" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "accounts: user can insert own" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts: user can update own" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "accounts: user can delete own" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- TRANSACTIONS
CREATE POLICY "transactions: user can select own" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions: user can insert own" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: user can update own" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "transactions: user can delete own" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- GOALS
CREATE POLICY "goals: user can select own" ON goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "goals: user can insert own" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals: user can update own" ON goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "goals: user can delete own" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- DEBTS
CREATE POLICY "debts: user can select own" ON debts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "debts: user can insert own" ON debts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debts: user can update own" ON debts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "debts: user can delete own" ON debts
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- TABEL USER_SETTINGS (preferensi UI per-user)
-- =============================================
CREATE TABLE user_settings (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  avatar_color TEXT    DEFAULT '#60fcc6',
  hidden_menus JSONB   DEFAULT '[]',
  app_name     TEXT    DEFAULT 'Karaya',
  app_tagline  TEXT    DEFAULT 'Wealth Ledger',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: user own" ON user_settings
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
