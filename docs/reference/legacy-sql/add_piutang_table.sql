-- Jalankan di Supabase SQL Editor
-- Membuat tabel piutang untuk fitur "uang yang dipinjamkan ke orang lain"

CREATE TABLE IF NOT EXISTS piutang (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  borrower_name TEXT NOT NULL,
  total BIGINT NOT NULL,
  remaining BIGINT NOT NULL,
  due_date TEXT,
  notes TEXT,
  icon TEXT DEFAULT '🤝',
  color TEXT DEFAULT '#60fcc6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE piutang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "piutang: user can select own" ON piutang
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "piutang: user can insert own" ON piutang
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "piutang: user can update own" ON piutang
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "piutang: user can delete own" ON piutang
  FOR DELETE USING (auth.uid() = user_id);

-- Verifikasi
SELECT 'Tabel piutang berhasil dibuat!' AS status;
