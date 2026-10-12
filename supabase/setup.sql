-- Karaya Finance: skema database lengkap (gabungan semua file supabase/migrations).
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> tempel SELURUH isi file ini -> Run.
-- Hanya untuk project BARU yang masih kosong. Jangan dijalankan dua kali.
-- Dibuat otomatis oleh scripts/gen-setup-sql.sh; jangan diedit manual.

-- ====================================================================
-- 00000000000001_extensions_enums.sql
-- ====================================================================
-- 0001: ekstensi dan enum dasar (03-database.md §2)
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
-- pg_cron diaktifkan lewat Dashboard > Database > Extensions pada project ini (butuh akses superuser
-- yang tidak selalu tersedia lewat migration runner); 0007_cron.sql memeriksa keberadaannya sebelum jadwal.

do $$ begin
  create type member_role as enum ('owner', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_type as enum ('bank', 'ewallet', 'cash', 'crypto', 'investasi', 'tabungan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_visibility as enum ('shared', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tx_type as enum ('income', 'expense', 'transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tx_source as enum ('web', 'api_key', 'recurring', 'system', 'import', 'migration');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_type as enum ('income', 'expense', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recurring_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type api_key_scope as enum ('read', 'write', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type credential_type as enum ('jwt', 'api_key', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

-- helper updated_at trigger (dipakai semua tabel berikutnya)
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Wrapper IMMUTABLE untuk unaccent() agar bisa dipakai di index expression.
-- unaccent() bawaan ditandai STABLE oleh Postgres karena bergantung pada search_path dictionary;
-- kita kunci ke dictionary 'unaccent' secara eksplisit sehingga aman ditandai IMMUTABLE.
create or replace function immutable_unaccent(text) returns text
language sql immutable parallel safe as $$
  select unaccent('unaccent'::regdictionary, $1);
$$;


-- ====================================================================
-- 00000000000002_households.sql
-- ====================================================================
-- 0002: households, household_members, household_invitations (03-database.md §3.1-3.3)

create table households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 1 and 80),
  timezone     text not null default 'Asia/Jakarta',
  currency     text not null default 'IDR' check (currency = 'IDR'),
  default_account_visibility account_visibility not null default 'shared',
  owners_can_view_private_totals boolean not null default false,
  merged_into_household_id uuid references households(id),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
comment on column households.timezone is 'Zona waktu untuk evaluasi period (this_month, today) dan tanggal default transaksi.';
comment on column households.currency is 'Hardcode IDR. Non-tujuan multi-currency.';
comment on column households.owners_can_view_private_totals is 'Bila true, owner boleh melihat ringkasan (bukan rincian) member lain yang punya akun privat. Lihat Q-05.';
comment on column households.merged_into_household_id is 'Terisi bila household ini digabung ke household lain saat accept undangan mode merge.';

create trigger households_set_updated_at before update on households
  for each row execute function set_updated_at();

create or replace function validate_timezone() returns trigger
language plpgsql as $$
begin
  if new.timezone is null or new.timezone not in (select name from pg_timezone_names) then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"timezone"}';
  end if;
  return new;
end;
$$;
create trigger households_validate_timezone before insert or update of timezone on households
  for each row execute function validate_timezone();

create table household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null check (length(display_name) between 1 and 60),
  role          member_role not null default 'member',
  aliases       text[] not null default '{}',
  color         text not null default '#6366f1',
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (household_id, user_id)
);
create unique index household_members_active_name_uq
  on household_members (household_id, lower(display_name)) where deleted_at is null;
create index household_members_user_idx on household_members (user_id) where deleted_at is null;
comment on column household_members.aliases is 'Kata yang dipakai agent untuk merujuk member ini, mis. {istri,bunda,mama}.';

create trigger household_members_set_updated_at before update on household_members
  for each row execute function set_updated_at();

create table household_invitations (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  code           text not null unique,
  role           member_role not null default 'owner',
  display_name_suggestion text,
  invited_by     uuid not null references household_members(id),
  status         invitation_status not null default 'pending',
  expires_at     timestamptz not null default now() + interval '7 days',
  accepted_by    uuid references household_members(id),
  accepted_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index household_invitations_pending_idx on household_invitations (household_id) where status = 'pending';

create trigger household_invitations_set_updated_at before update on household_invitations
  for each row execute function set_updated_at();


-- ====================================================================
-- 00000000000003_domain_tables.sql
-- ====================================================================
-- 0003: tabel domain inti (03-database.md §3.4-3.13)

-- ── categories ──────────────────────────────────────────────────────────
create table categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null check (length(name) between 1 and 40),
  aliases       text[] not null default '{}',
  type          category_type not null default 'expense',
  icon          text not null default '📦',
  color         text not null default '#6366f1',
  is_system     boolean not null default false,
  system_key    text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint categories_system_key_consistency check ((is_system and system_key is not null) or (not is_system and system_key is null))
);
create unique index categories_name_uq on categories (household_id, lower(name)) where deleted_at is null;
create unique index categories_system_key_uq on categories (household_id, system_key) where system_key is not null;
create index categories_name_trgm_idx on categories using gin (lower(name) gin_trgm_ops);
create trigger categories_set_updated_at before update on categories for each row execute function set_updated_at();

-- ── accounts ────────────────────────────────────────────────────────────
create table accounts (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  owner_member_id  uuid references household_members(id),
  name             text not null check (length(name) between 1 and 60),
  aliases          text[] not null default '{}',
  type             account_type not null,
  visibility       account_visibility not null default 'shared',
  opening_balance  bigint not null default 0 check (opening_balance between 0 and 100000000000),
  icon             text not null default '💰',
  color            text not null default '#6366f1',
  sort_order       int not null default 0,
  needs_review     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint accounts_joint_must_be_shared check (owner_member_id is not null or visibility = 'shared')
);
create unique index accounts_name_per_owner_uq
  on accounts (household_id, coalesce(owner_member_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;
create index accounts_household_idx on accounts (household_id) where deleted_at is null;
create index accounts_name_trgm_idx on accounts using gin (lower(name) gin_trgm_ops);
comment on column accounts.opening_balance is 'Saldo sebelum transaksi pertama. Saldo berjalan = opening_balance + efek transaksi aktif (v_account_balances).';
comment on column accounts.needs_review is 'True untuk akun placeholder hasil migrasi (tidak dipakai di jalur greenfield).';
create trigger accounts_set_updated_at before update on accounts for each row execute function set_updated_at();

-- ── debts ───────────────────────────────────────────────────────────────
create table debts (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  owner_member_id  uuid references household_members(id),
  name             text not null check (length(name) between 1 and 80),
  aliases          text[] not null default '{}',
  total            bigint not null check (total > 0),
  opening_paid     bigint not null default 0 check (opening_paid >= 0),
  monthly          bigint not null default 0 check (monthly >= 0),
  due_date         date,
  notes            text not null default '',
  icon             text not null default '📋',
  color            text not null default '#ef4444',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index debts_household_idx on debts (household_id) where deleted_at is null;
create index debts_name_trgm_idx on debts using gin (lower(name) gin_trgm_ops);
create trigger debts_set_updated_at before update on debts for each row execute function set_updated_at();

-- ── goals ───────────────────────────────────────────────────────────────
create table goals (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  owner_member_id  uuid references household_members(id),
  name             text not null check (length(name) between 1 and 80),
  target           bigint not null check (target > 0),
  opening_amount   bigint not null default 0 check (opening_amount >= 0),
  deadline         date,
  icon             text not null default '🎯',
  color            text not null default '#6366f1',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index goals_household_idx on goals (household_id) where deleted_at is null;
create trigger goals_set_updated_at before update on goals for each row execute function set_updated_at();

-- ── piutang ─────────────────────────────────────────────────────────────
create table piutang (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  owner_member_id   uuid references household_members(id),
  borrower_name     text not null check (length(borrower_name) between 1 and 80),
  total             bigint not null check (total > 0),
  opening_received  bigint not null default 0 check (opening_received >= 0),
  from_account_id   uuid references accounts(id),
  due_date          date,
  notes             text not null default '',
  icon              text not null default '🤝',
  color             text not null default '#60fcc6',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index piutang_household_idx on piutang (household_id) where deleted_at is null;
create trigger piutang_set_updated_at before update on piutang for each row execute function set_updated_at();

-- ── recurring_transactions ──────────────────────────────────────────────
create table recurring_transactions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  member_id     uuid not null references household_members(id),
  name          text not null check (length(name) between 1 and 80),
  type          tx_type not null default 'expense' check (type <> 'transfer'),
  amount        bigint not null check (amount > 0),
  category_id   uuid not null references categories(id),
  account_id    uuid not null references accounts(id),
  frequency     recurring_frequency not null,
  anchor_day    smallint check (anchor_day between 1 and 31),
  next_date     date not null,
  notes         text not null default '',
  debt_id       uuid references debts(id) on delete set null,
  active        boolean not null default true,
  last_run_at   timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index recurring_due_idx on recurring_transactions (next_date) where active and deleted_at is null;
create index recurring_household_idx on recurring_transactions (household_id) where deleted_at is null;
create trigger recurring_set_updated_at before update on recurring_transactions for each row execute function set_updated_at();

create or replace function recurring_fill_anchor_day() returns trigger
language plpgsql as $$
begin
  if new.anchor_day is null then
    new.anchor_day := extract(day from new.next_date);
  end if;
  return new;
end;
$$;
create trigger recurring_fill_anchor_day before insert on recurring_transactions
  for each row execute function recurring_fill_anchor_day();

-- ── transactions ────────────────────────────────────────────────────────
create table transactions (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references households(id) on delete cascade,
  type                   tx_type not null,
  amount                 bigint not null check (amount > 0 and amount <= 100000000000),
  account_id             uuid not null references accounts(id),
  to_account_id          uuid references accounts(id),
  category_id            uuid not null references categories(id),
  note                   text not null default '' check (length(note) <= 500),
  date                   date not null,
  recorded_by_member_id  uuid not null references household_members(id),
  source                 tx_source not null default 'web',
  recurring_id           uuid references recurring_transactions(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  deleted_by_member_id   uuid references household_members(id),
  constraint tx_transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transfer' and to_account_id is null)
  )
);
create index tx_household_date_idx on transactions (household_id, date desc, created_at desc) where deleted_at is null;
create index tx_account_idx on transactions (account_id) where deleted_at is null;
create index tx_to_account_idx on transactions (to_account_id) where deleted_at is null and to_account_id is not null;
create index tx_category_idx on transactions (household_id, category_id, date) where deleted_at is null;
create index tx_recorded_by_idx on transactions (recorded_by_member_id, date) where deleted_at is null;
create index tx_note_trgm_idx on transactions using gin (lower(note) gin_trgm_ops);
create unique index tx_recurring_once_per_date_uq on transactions (recurring_id, date) where recurring_id is not null and deleted_at is null;
comment on column transactions.account_id is 'Akun asal. Income: akun yang menerima. Expense/transfer: akun yang berkurang.';
comment on column transactions.recorded_by_member_id is 'Siapa yang mencatat; bukan pemilik uang (lihat accounts.owner_member_id).';
create trigger tx_set_updated_at before update on transactions for each row execute function set_updated_at();

create or replace function tx_same_household() returns trigger
language plpgsql as $$
declare v_hh uuid;
begin
  select household_id into v_hh from accounts where id = new.account_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"account_id","reason":"different_household"}';
  end if;
  if new.to_account_id is not null then
    select household_id into v_hh from accounts where id = new.to_account_id;
    if v_hh is distinct from new.household_id then
      raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"to_account_id","reason":"different_household"}';
    end if;
  end if;
  select household_id into v_hh from categories where id = new.category_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"category_id","reason":"different_household"}';
  end if;
  select household_id into v_hh from household_members where id = new.recorded_by_member_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"recorded_by_member_id","reason":"different_household"}';
  end if;
  return new;
end;
$$;
create trigger tx_same_household before insert or update on transactions
  for each row execute function tx_same_household();

-- ── debt_payments / goal_contributions / piutang_receipts ───────────────
create table debt_payments (
  id              uuid primary key default gen_random_uuid(),
  debt_id         uuid not null references debts(id) on delete cascade,
  transaction_id  uuid unique references transactions(id),
  member_id       uuid not null references household_members(id),
  amount          bigint not null check (amount > 0),
  date            date not null,
  note            text not null default '',
  created_at      timestamptz not null default now()
);
create index debt_payments_debt_idx on debt_payments (debt_id);

create table goal_contributions (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references goals(id) on delete cascade,
  transaction_id  uuid unique references transactions(id),
  member_id       uuid not null references household_members(id),
  amount          bigint not null check (amount <> 0),
  date            date not null,
  note            text not null default '',
  created_at      timestamptz not null default now()
);
create index goal_contributions_goal_idx on goal_contributions (goal_id);

create table piutang_receipts (
  id              uuid primary key default gen_random_uuid(),
  piutang_id      uuid not null references piutang(id) on delete cascade,
  transaction_id  uuid unique references transactions(id),
  member_id       uuid not null references household_members(id),
  amount          bigint not null check (amount > 0),
  date            date not null,
  note            text not null default '',
  created_at      timestamptz not null default now()
);
create index piutang_receipts_piutang_idx on piutang_receipts (piutang_id);

-- link lend_transaction_id sekarang tabel transactions sudah ada
alter table piutang add column lend_transaction_id uuid unique references transactions(id);

-- ── budgets ─────────────────────────────────────────────────────────────
create table budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  category_id   uuid not null references categories(id),
  member_id     uuid references household_members(id),
  period_start  date not null check (period_start = date_trunc('month', period_start)::date),
  amount        bigint not null check (amount > 0 and amount <= 100000000000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create unique index budgets_uq on budgets (household_id, category_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start) where deleted_at is null;
create index budgets_period_idx on budgets (household_id, period_start) where deleted_at is null;
create trigger budgets_set_updated_at before update on budgets for each row execute function set_updated_at();

-- ── split_bills / split_bill_members ─────────────────────────────────────
create table split_bills (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  created_by_member_id uuid not null references household_members(id),
  title                text not null,
  total_amount         bigint not null check (total_amount > 0),
  date                 date not null,
  note                 text not null default '',
  transaction_id       uuid unique references transactions(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create index split_bills_household_idx on split_bills (household_id) where deleted_at is null;
create trigger split_bills_set_updated_at before update on split_bills for each row execute function set_updated_at();

create table split_bill_members (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references split_bills(id) on delete cascade,
  name        text not null,
  amount      bigint not null check (amount > 0),
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index split_bill_members_bill_idx on split_bill_members (bill_id);

-- ── investments ─────────────────────────────────────────────────────────
create table investments (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  owner_member_id uuid references household_members(id),
  name          text not null,
  type          text not null check (type in ('emas','saham','reksa_dana','crypto','properti','lainnya')),
  icon          text,
  color         text,
  brand         text,
  buy_price     bigint not null default 0,
  current_value bigint not null default 0,
  quantity      numeric(18,6),
  unit          text not null default 'unit',
  kode_saham    text,
  buy_date      date,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index investments_household_idx on investments (household_id) where deleted_at is null;
create trigger investments_set_updated_at before update on investments for each row execute function set_updated_at();

-- ── user_settings / subscriptions (tetap per-user, bukan per-household) ─
create table user_settings (
  user_id      uuid references auth.users(id) on delete cascade primary key,
  active_household_id uuid references households(id),
  avatar_color text not null default '#60fcc6',
  hidden_menus jsonb not null default '[]',
  app_name     text not null default 'Karaya',
  app_tagline  text not null default 'Wealth Ledger',
  language     text not null default 'id',
  theme        text not null default 'dark',
  ai_config    jsonb not null default '{}',
  updated_at   timestamptz not null default now()
);

create table subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  plan       text not null default 'trial',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ====================================================================
-- 00000000000004_api_infra.sql
-- ====================================================================
-- 0004: infrastruktur API key, idempotency, rate limit, audit log (03-database.md §3.15-3.19)

create table api_keys (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  member_id      uuid not null references household_members(id),
  name           text not null check (length(name) between 1 and 60),
  key_prefix     text not null,
  key_hash       bytea not null unique,
  scope          api_key_scope not null default 'write',
  expires_at     timestamptz,
  last_used_at   timestamptz,
  last_used_ip   inet,
  revoked_at     timestamptz,
  created_by     uuid not null references household_members(id),
  created_at     timestamptz not null default now()
);
create index api_keys_prefix_idx on api_keys (key_prefix) where revoked_at is null;
comment on table api_keys is 'Kunci jangka panjang untuk agent. Full key hanya dikembalikan sekali saat POST /v1/api-keys.';

create table idempotency_keys (
  credential_type  credential_type not null,
  credential_id    uuid not null,
  key              text not null check (length(key) between 1 and 128),
  request_hash     bytea not null,
  status           text not null check (status in ('in_progress','completed')),
  response_status  int,
  response_body    jsonb,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours',
  primary key (credential_type, credential_id, key)
);
create index idempotency_expires_idx on idempotency_keys (expires_at);

create table rate_limit_counters (
  api_key_id    uuid not null references api_keys(id) on delete cascade,
  window_kind   text not null check (window_kind in ('minute','day')),
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (api_key_id, window_kind, window_start)
);

create table audit_log (
  id               bigserial primary key,
  household_id     uuid references households(id) on delete cascade,
  actor_member_id  uuid references household_members(id),
  credential_type  credential_type not null,
  api_key_id       uuid references api_keys(id) on delete set null,
  request_id       text not null,
  idempotency_key  text,
  action           text not null,
  resource_type    text,
  resource_id      uuid,
  http_status      int not null,
  payload          jsonb,
  ip               inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);
create index audit_log_household_time_idx on audit_log (household_id, created_at desc);
create index audit_log_api_key_idx on audit_log (api_key_id, created_at desc) where api_key_id is not null;

create table migration_issues (
  id          bigserial primary key,
  phase       text not null,
  table_name  text not null,
  row_id      uuid,
  issue       text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);


-- ====================================================================
-- 00000000000005_views.sql
-- ====================================================================
-- 0005: views saldo & agregat (03-database.md §4)

-- helper RLS (dipindah ke sini karena v_account_balances butuh can_view_account sebelum views dibuat)
create or replace function current_member_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from household_members where user_id = auth.uid() and deleted_at is null;
$$;

create or replace function current_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from household_members where user_id = auth.uid() and deleted_at is null;
$$;

create or replace function is_household_member(p_household_id uuid) returns boolean
language sql stable as $$ select p_household_id in (select current_household_ids()); $$;

create or replace function member_role_in(p_household_id uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from household_members where household_id = p_household_id and user_id = auth.uid() and deleted_at is null limit 1;
$$;

create or replace function can_view_account(p_account_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a
    where a.id = p_account_id
      and is_household_member(a.household_id)
      and (a.visibility = 'shared' or a.owner_member_id in (select current_member_ids()))
  );
$$;

create or replace function can_post_to_account(p_account_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a
    where a.id = p_account_id and a.deleted_at is null
      and member_role_in(a.household_id) in ('owner','member')
      and (a.visibility = 'shared' or a.owner_member_id in (select current_member_ids()))
  );
$$;


create or replace function account_balance(p_account_id uuid) returns bigint
language sql stable as $$
  select a.opening_balance
    + coalesce((select sum(amount) from transactions where deleted_at is null and account_id = a.id and type = 'income'), 0)
    - coalesce((select sum(amount) from transactions where deleted_at is null and account_id = a.id and type in ('expense','transfer')), 0)
    + coalesce((select sum(amount) from transactions where deleted_at is null and to_account_id = a.id and type = 'transfer'), 0)
  from accounts a where a.id = p_account_id;
$$;

create or replace view v_account_balances as
select
  a.id as account_id,
  a.household_id,
  case when can_view_account(a.id) then
    a.opening_balance
      + coalesce(sum(case when t.type = 'income'   and t.account_id    = a.id then t.amount end), 0)
      - coalesce(sum(case when t.type = 'expense'  and t.account_id    = a.id then t.amount end), 0)
      - coalesce(sum(case when t.type = 'transfer' and t.account_id    = a.id then t.amount end), 0)
      + coalesce(sum(case when t.type = 'transfer' and t.to_account_id = a.id then t.amount end), 0)
  else null end as balance,
  case when can_view_account(a.id) then count(t.id) filter (where t.id is not null) else null end as tx_count,
  case when can_view_account(a.id) then max(t.date) else null end as last_tx_date
from accounts a
left join transactions t
  on t.deleted_at is null and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;
alter view v_account_balances set (security_invoker = on);
comment on view v_account_balances is 'balance/tx_count/last_tx_date NULL kalau caller tidak can_view_account (akun privat milik orang lain) — defense in depth selain filtering di apps/api.';

create or replace view v_debts as
select d.*,
  greatest(0, d.total - d.opening_paid
    - coalesce((select sum(p.amount) from debt_payments p join transactions t on t.id = p.transaction_id where p.debt_id = d.id and t.deleted_at is null), 0)
    - coalesce((select sum(p.amount) from debt_payments p where p.debt_id = d.id and p.transaction_id is null), 0)
  ) as remaining
from debts d;
alter view v_debts set (security_invoker = on);

create or replace view v_goals as
select g.*,
  g.opening_amount
    + coalesce((select sum(c.amount) from goal_contributions c join transactions t on t.id = c.transaction_id where c.goal_id = g.id and t.deleted_at is null), 0)
    + coalesce((select sum(c.amount) from goal_contributions c where c.goal_id = g.id and c.transaction_id is null), 0)
    as current
from goals g;
alter view v_goals set (security_invoker = on);

create or replace view v_goals_full as
select g.*, (g.current >= g.target) as reached
from v_goals g;
alter view v_goals_full set (security_invoker = on);

create or replace view v_piutang as
select p.*,
  greatest(0, p.total - p.opening_received
    - coalesce((select sum(r.amount) from piutang_receipts r join transactions t on t.id = r.transaction_id where r.piutang_id = p.id and t.deleted_at is null), 0)
    - coalesce((select sum(r.amount) from piutang_receipts r where r.piutang_id = p.id and r.transaction_id is null), 0)
  ) as remaining
from piutang p;
alter view v_piutang set (security_invoker = on);

create or replace view v_transactions as
select
  t.*,
  a.name as account_name, a.owner_member_id as account_owner_member_id, a.visibility as account_visibility,
  ta.name as to_account_name, ta.owner_member_id as to_account_owner_member_id,
  c.name as category_name, c.icon as category_icon, c.color as category_color,
  rm.display_name as recorded_by_display_name
from transactions t
join accounts a on a.id = t.account_id
left join accounts ta on ta.id = t.to_account_id
join categories c on c.id = t.category_id
join household_members rm on rm.id = t.recorded_by_member_id
where t.deleted_at is null;
alter view v_transactions set (security_invoker = on);

create or replace function today_in_tz(p_household_id uuid) returns date
language sql stable as $$
  select (now() at time zone (select timezone from households where id = p_household_id))::date;
$$;


-- ====================================================================
-- 00000000000006_functions_household.sql
-- ====================================================================
-- 0006: fungsi household, member, invitation (03-database.md §8.2-8.3)

-- ── seed kategori default per household ──────────────────────────────────
create or replace function seed_household_categories(p_household_id uuid) returns void
language plpgsql as $$
begin
  insert into categories (household_id, name, type, icon, aliases, is_system, system_key, sort_order) values
    (p_household_id, 'Makanan', 'expense', '🍔', '{makan,jajan,kuliner,minum,sayur,belanja dapur}', false, null, 10),
    (p_household_id, 'Transport', 'expense', '🚗', '{bensin,ojek,grab,gojek,parkir,tol}', false, null, 20),
    (p_household_id, 'Kos/Sewa', 'expense', '🏠', '{sewa,kontrakan,kos}', false, null, 30),
    (p_household_id, 'Hiburan', 'expense', '🎬', '{nonton,game,langganan}', false, null, 40),
    (p_household_id, 'Shopping', 'expense', '🛍️', '{belanja,baju}', false, null, 50),
    (p_household_id, 'Utilitas', 'expense', '⚡', '{listrik,air,internet,pulsa,wifi}', false, null, 60),
    (p_household_id, 'Kesehatan', 'expense', '💊', '{obat,dokter,rs}', false, null, 70),
    (p_household_id, 'Pendidikan', 'expense', '📚', '{sekolah,kursus,buku}', false, null, 80),
    (p_household_id, 'Donasi', 'expense', '❤️', '{sedekah,zakat,infak}', false, null, 90),
    (p_household_id, 'Lainnya', 'both', '📦', '{}', false, null, 100),
    (p_household_id, 'Gaji', 'income', '💰', '{gajian,salary}', false, null, 110),
    (p_household_id, 'Freelance', 'income', '💼', '{project,sampingan}', false, null, 120),
    (p_household_id, 'Bisnis', 'income', '📊', '{usaha,jualan}', false, null, 130),
    (p_household_id, 'Investasi', 'income', '📈', '{dividen,cuan}', false, null, 140),
    (p_household_id, 'Transfer', 'both', '🔄', '{}', true, 'transfer', 200),
    (p_household_id, 'Koreksi Saldo', 'both', '⚖️', '{}', true, 'balance_adjustment', 210),
    (p_household_id, 'Hutang & Cicilan', 'expense', '📋', '{cicilan,angsuran,hutang}', true, 'debt_payment', 220),
    (p_household_id, 'Tabungan & Goal', 'expense', '🎯', '{nabung,tabungan}', true, 'goal_saving', 230),
    (p_household_id, 'Piutang', 'both', '🤝', '{}', true, 'piutang', 240)
  on conflict do nothing;
end;
$$;

-- ── create_household ──────────────────────────────────────────────────────
create or replace function create_household(p_name text, p_timezone text, p_display_name text, p_user_id uuid)
returns jsonb language plpgsql as $$
declare v_household households; v_member household_members;
begin
  insert into households (name, timezone, created_by) values (p_name, coalesce(p_timezone, 'Asia/Jakarta'), p_user_id)
  returning * into v_household;

  insert into household_members (household_id, user_id, display_name, role, aliases)
  values (v_household.id, p_user_id, p_display_name, 'owner', '{saya}')
  returning * into v_member;

  perform seed_household_categories(v_household.id);

  insert into user_settings (user_id, active_household_id) values (p_user_id, v_household.id)
  on conflict (user_id) do update set active_household_id = excluded.active_household_id;

  return jsonb_build_object('household', to_jsonb(v_household), 'member', to_jsonb(v_member));
end;
$$;

-- ── invitations ───────────────────────────────────────────────────────────
create or replace function generate_invitation_code() returns text
language plpgsql as $$
declare v_alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; v_code text := '';
begin
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    if i = 4 then v_code := v_code || '-'; end if;
  end loop;
  return v_code;
end;
$$;

create or replace function create_invitation(p_household_id uuid, p_actor_member_id uuid, p_email text, p_role member_role, p_display_name_suggestion text)
returns household_invitations language plpgsql as $$
declare v_actor household_members; v_code text; v_inv household_invitations; v_exists int;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;
  if v_actor.role <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if p_email is not null then
    select count(*) into v_exists from household_members hm join auth.users u on u.id = hm.user_id
      where hm.household_id = p_household_id and hm.deleted_at is null and lower(u.email) = lower(p_email);
    if v_exists > 0 then raise exception using errcode = 'P0001', message = 'already_member'; end if;
  end if;
  loop
    v_code := generate_invitation_code();
    exit when not exists (select 1 from household_invitations where code = v_code);
  end loop;
  insert into household_invitations (household_id, email, code, role, display_name_suggestion, invited_by)
  values (p_household_id, p_email, v_code, coalesce(p_role, 'owner'), p_display_name_suggestion, p_actor_member_id)
  returning * into v_inv;
  return v_inv;
end;
$$;

create or replace function preview_invitation(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_inv household_invitations; v_household households; v_inviter household_members;
begin
  select * into v_inv from household_invitations where code = p_code;
  if v_inv is null or v_inv.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'invitation_invalid';
  end if;
  if v_inv.expires_at < now() then
    update household_invitations set status = 'expired' where id = v_inv.id;
    raise exception using errcode = 'P0001', message = 'invitation_expired';
  end if;
  select * into v_household from households where id = v_inv.household_id;
  select * into v_inviter from household_members where id = v_inv.invited_by;
  return jsonb_build_object(
    'household_name', v_household.name, 'inviter_name', v_inviter.display_name,
    'role', v_inv.role, 'email_locked', v_inv.email is not null, 'expires_at', v_inv.expires_at
  );
end;
$$;

create or replace function accept_invitation(p_code text, p_user_id uuid, p_display_name text, p_mode text)
returns household_members language plpgsql as $$
declare v_inv household_invitations; v_user_email text; v_member household_members; v_source_household uuid;
begin
  select * into v_inv from household_invitations where code = p_code for update;
  if v_inv is null or v_inv.status <> 'pending' then raise exception using errcode = 'P0001', message = 'invitation_invalid'; end if;
  if v_inv.expires_at < now() then
    update household_invitations set status = 'expired' where id = v_inv.id;
    raise exception using errcode = 'P0001', message = 'invitation_expired';
  end if;
  if v_inv.email is not null then
    select email into v_user_email from auth.users where id = p_user_id;
    if lower(v_user_email) <> lower(v_inv.email) then
      raise exception using errcode = 'P0001', message = 'invitation_email_mismatch';
    end if;
  end if;
  if exists (select 1 from household_members where household_id = v_inv.household_id and user_id = p_user_id and deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;

  insert into household_members (household_id, user_id, display_name, role, aliases)
  values (v_inv.household_id, p_user_id, p_display_name, v_inv.role, '{}')
  returning * into v_member;

  update household_invitations set status = 'accepted', accepted_by = v_member.id, accepted_at = now() where id = v_inv.id;

  if p_mode = 'merge' then
    select active_household_id into v_source_household from user_settings where user_id = p_user_id;
    if v_source_household is not null and v_source_household <> v_inv.household_id then
      perform merge_household_into(v_source_household, v_inv.household_id, v_member.id);
    end if;
  end if;

  update user_settings set active_household_id = v_inv.household_id, updated_at = now() where user_id = p_user_id;
  insert into user_settings (user_id, active_household_id) values (p_user_id, v_inv.household_id)
    on conflict (user_id) do nothing;

  return v_member;
end;
$$;

create or replace function remove_member(p_household_id uuid, p_actor_member_id uuid, p_member_id uuid, p_reassign_to_member_id uuid)
returns void language plpgsql as $$
declare v_actor household_members; v_target household_members; v_owner_count int; v_account_count int;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then raise exception using errcode = 'P0001', message = 'actor_mismatch'; end if;
  if v_actor.role <> 'owner' then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  select * into v_target from household_members where id = p_member_id and household_id = p_household_id and deleted_at is null;
  if v_target is null then raise exception using errcode = 'P0001', message = 'member_not_found'; end if;

  if v_target.role = 'owner' then
    select count(*) into v_owner_count from household_members where household_id = p_household_id and role = 'owner' and deleted_at is null and id <> p_member_id;
    if v_owner_count = 0 then raise exception using errcode = 'P0001', message = 'last_owner'; end if;
  end if;

  select count(*) into v_account_count from accounts where owner_member_id = p_member_id and deleted_at is null;
  if v_account_count > 0 and p_reassign_to_member_id is null then
    raise exception using errcode = 'P0001', message = 'reassign_required';
  end if;
  if v_account_count > 0 then
    update accounts set owner_member_id = (case when p_reassign_to_member_id = '00000000-0000-0000-0000-000000000000'::uuid then null else p_reassign_to_member_id end)
    where owner_member_id = p_member_id and deleted_at is null;
  end if;

  update budgets set deleted_at = now() where member_id = p_member_id and deleted_at is null;
  update api_keys set revoked_at = now() where member_id = p_member_id and revoked_at is null;
  update household_members set deleted_at = now() where id = p_member_id;
end;
$$;

create or replace function change_member_role(p_household_id uuid, p_actor_member_id uuid, p_member_id uuid, p_role member_role)
returns household_members language plpgsql as $$
declare v_actor household_members; v_owner_count int; v_result household_members;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then raise exception using errcode = 'P0001', message = 'actor_mismatch'; end if;
  if v_actor.role <> 'owner' then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  if p_role <> 'owner' then
    select count(*) into v_owner_count from household_members where household_id = p_household_id and role = 'owner' and deleted_at is null and id <> p_member_id;
    if v_owner_count = 0 then raise exception using errcode = 'P0001', message = 'last_owner'; end if;
  end if;

  update household_members set role = p_role, updated_at = now() where id = p_member_id and household_id = p_household_id
  returning * into v_result;
  if v_result is null then raise exception using errcode = 'P0001', message = 'member_not_found'; end if;
  return v_result;
end;
$$;

-- ── merge_household_into (fase 5, disederhanakan) ────────────────────────
create or replace function merge_household_into(p_source_household_id uuid, p_target_household_id uuid, p_member_id uuid)
returns jsonb language plpgsql as $$
declare v_moved jsonb := '{}'::jsonb; v_cat record; v_target_cat uuid; v_n int;
begin
  if p_source_household_id = p_target_household_id then return v_moved; end if;

  -- dedupe kategori non-sistem by nama: arahkan transaksi/budget/recurring ke kategori target yang namanya sama
  for v_cat in select * from categories where household_id = p_source_household_id and deleted_at is null and not is_system loop
    select id into v_target_cat from categories where household_id = p_target_household_id and lower(unaccent(name)) = lower(unaccent(v_cat.name)) and deleted_at is null limit 1;
    if v_target_cat is null then
      update categories set household_id = p_target_household_id where id = v_cat.id;
    else
      update transactions set category_id = v_target_cat where category_id = v_cat.id;
      update budgets set category_id = v_target_cat where category_id = v_cat.id;
      update recurring_transactions set category_id = v_target_cat where category_id = v_cat.id;
      update categories set deleted_at = now() where id = v_cat.id;
    end if;
  end loop;

  update accounts set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('accounts', v_n);

  update transactions set household_id = p_target_household_id, recorded_by_member_id = p_member_id where household_id = p_source_household_id;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('transactions', v_n);

  -- budget household lama menjadi budget pribadi member baru di target
  update budgets set household_id = p_target_household_id, member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update goals set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update debts set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update piutang set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update recurring_transactions set household_id = p_target_household_id, member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update investments set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update split_bills set household_id = p_target_household_id, created_by_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;

  update households set deleted_at = now(), merged_into_household_id = p_target_household_id where id = p_source_household_id;

  return v_moved;
end;
$$;


-- ====================================================================
-- 00000000000007_functions_transactions.sql
-- ====================================================================
-- 0007: fungsi transaksi, transfer, koreksi saldo (03-database.md §8.3)

create or replace function assert_actor(p_household_id uuid, p_actor_member_id uuid) returns household_members
language plpgsql as $$
declare v_actor household_members;
begin
  select * into v_actor from household_members
    where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'not_household_member';
  end if;
  if v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;
  return v_actor;
end;
$$;

create or replace function post_transaction(
  p_household_id uuid, p_actor_member_id uuid, p_type tx_type, p_account_id uuid, p_category_id uuid,
  p_amount bigint, p_date date, p_note text, p_source tx_source, p_recurring_id uuid default null
) returns transactions language plpgsql as $$
declare
  v_actor household_members; v_account accounts; v_category categories; v_balance bigint; v_tx transactions;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000000000 then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"amount"}';
  end if;
  if p_type = 'transfer' then
    raise exception using errcode = 'P0001', message = 'use_post_transfer';
  end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);

  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;
  -- CATATAN: role 'owner' household TIDAK membolehkan menulis ke akun privat milik member lain.
  -- 'owner' = admin household (kelola member/kategori/API key), bukan pembebasan visibilitas akun.
  if v_actor.role not in ('owner','member') then
    raise exception using errcode = 'P0001', message = 'insufficient_scope';
  end if;
  if not (v_account.visibility = 'shared' or v_account.owner_member_id = p_actor_member_id) then
    raise exception using errcode = 'P0001', message = 'forbidden_account';
  end if;

  select * into v_category from categories where id = p_category_id and household_id = p_household_id and deleted_at is null;
  if v_category is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  if v_category.system_key = 'transfer' then
    raise exception using errcode = 'P0001', message = 'category_reserved';
  end if;
  if p_type = 'income' and v_category.type not in ('income','both') then
    raise exception using errcode = 'P0001', message = 'category_type_mismatch';
  end if;
  if p_type = 'expense' and v_category.type not in ('expense','both') then
    raise exception using errcode = 'P0001', message = 'category_type_mismatch';
  end if;

  if p_type = 'expense' then
    v_balance := account_balance(p_account_id);
    if v_balance < p_amount then
      raise exception using errcode = 'P0001', message = 'insufficient_funds',
        detail = jsonb_build_object('balance', v_balance, 'needed', p_amount, 'account_name', v_account.name)::text;
    end if;
  end if;

  insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source, recurring_id)
  values (p_household_id, p_type, p_amount, p_account_id, p_category_id, coalesce(nullif(p_note,''), v_category.name), p_date, p_actor_member_id, p_source, p_recurring_id)
  returning * into v_tx;

  return v_tx;
end;
$$;

create or replace function post_transactions_batch(
  p_household_id uuid, p_actor_member_id uuid, p_account_id uuid, p_date date, p_items jsonb, p_source tx_source
) returns setof transactions language plpgsql as $$
declare
  v_actor household_members; v_account accounts; v_total bigint := 0; v_item jsonb; v_cat_id uuid; v_cat categories;
begin
  if jsonb_array_length(p_items) = 0 then raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"items"}'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception using errcode = 'P0001', message = 'batch_too_large'; end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'amount')::bigint <= 0 then raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"items.amount"}'; end if;
    v_total := v_total + (v_item->>'amount')::bigint;
    v_cat_id := (v_item->>'category_id')::uuid;
    select * into v_cat from categories where id = v_cat_id and household_id = p_household_id and deleted_at is null;
    if v_cat is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  end loop;

  if account_balance(p_account_id) < v_total then
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(p_account_id), 'needed', v_total, 'account_name', v_account.name)::text;
  end if;

  return query
    insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source)
    select p_household_id, 'expense', (item->>'amount')::bigint, p_account_id, (item->>'category_id')::uuid,
           coalesce(nullif(item->>'note',''), ''), p_date, p_actor_member_id, p_source
    from jsonb_array_elements(p_items) as item
    returning *;
end;
$$;

create or replace function post_transfer(
  p_household_id uuid, p_actor_member_id uuid, p_from_account_id uuid, p_to_account_id uuid,
  p_amount bigint, p_date date, p_note text, p_source tx_source
) returns transactions language plpgsql as $$
declare
  v_actor household_members; v_from accounts; v_to accounts; v_cat_id uuid; v_balance bigint; v_tx transactions;
  v_first uuid; v_second uuid;
begin
  if p_from_account_id = p_to_account_id then raise exception using errcode = 'P0001', message = 'same_account_transfer'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000000 then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"amount"}';
  end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);

  -- lock kedua akun dalam urutan tetap untuk mencegah deadlock
  if p_from_account_id < p_to_account_id then v_first := p_from_account_id; v_second := p_to_account_id;
  else v_first := p_to_account_id; v_second := p_from_account_id; end if;
  perform id from accounts where id = v_first for update;
  perform id from accounts where id = v_second for update;

  select * into v_from from accounts where id = p_from_account_id and household_id = p_household_id and deleted_at is null;
  select * into v_to from accounts where id = p_to_account_id and household_id = p_household_id and deleted_at is null;
  if v_from is null then raise exception using errcode = 'P0001', message = 'account_not_found', detail = '{"field":"from_account"}'; end if;
  if v_to is null then raise exception using errcode = 'P0001', message = 'account_not_found', detail = '{"field":"to_account"}'; end if;

  if v_actor.role not in ('owner','member') then
    raise exception using errcode = 'P0001', message = 'insufficient_scope';
  end if;
  if not (v_from.visibility = 'shared' or v_from.owner_member_id = p_actor_member_id) then
    raise exception using errcode = 'P0001', message = 'forbidden_account';
  end if;

  v_balance := account_balance(p_from_account_id);
  if v_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', v_balance, 'needed', p_amount, 'account_name', v_from.name)::text;
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'transfer';

  insert into transactions (household_id, type, amount, account_id, to_account_id, category_id, note, date, recorded_by_member_id, source)
  values (p_household_id, 'transfer', p_amount, p_from_account_id, p_to_account_id, v_cat_id,
          coalesce(nullif(p_note,''), 'Transfer ' || v_from.name || ' → ' || v_to.name), p_date, p_actor_member_id, p_source)
  returning * into v_tx;

  return v_tx;
end;
$$;

create or replace function update_transaction(p_household_id uuid, p_actor_member_id uuid, p_id uuid, p_patch jsonb)
returns transactions language plpgsql as $$
declare
  v_actor household_members; v_orig transactions; v_new_amount bigint; v_new_type tx_type; v_new_account uuid;
  v_new_category uuid; v_new_date date; v_cat categories; v_result transactions;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_orig from transactions where id = p_id and household_id = p_household_id and deleted_at is null for update;
  if v_orig is null then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;

  if v_orig.type = 'transfer' then
    if (p_patch ? 'amount') or (p_patch ? 'type') or (p_patch ? 'account_id') then
      raise exception using errcode = 'P0001', message = 'transfer_edit_limited';
    end if;
    update transactions set note = coalesce(p_patch->>'note', note), date = coalesce((p_patch->>'date')::date, date), updated_at = now()
    where id = p_id returning * into v_result;
    return v_result;
  end if;

  v_new_amount := coalesce((p_patch->>'amount')::bigint, v_orig.amount);
  v_new_type := coalesce((p_patch->>'type')::tx_type, v_orig.type);
  v_new_account := coalesce((p_patch->>'account_id')::uuid, v_orig.account_id);
  v_new_category := coalesce((p_patch->>'category_id')::uuid, v_orig.category_id);
  v_new_date := coalesce((p_patch->>'date')::date, v_orig.date);

  if v_new_type = 'transfer' or v_orig.type = 'transfer' then
    raise exception using errcode = 'P0001', message = 'transfer_edit_limited';
  end if;

  perform id from accounts where id in (v_orig.account_id, v_new_account) order by id for update;

  select * into v_cat from categories where id = v_new_category and household_id = p_household_id and deleted_at is null;
  if v_cat is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  if v_new_type = 'income' and v_cat.type not in ('income','both') then raise exception using errcode='P0001', message='category_type_mismatch'; end if;
  if v_new_type = 'expense' and v_cat.type not in ('expense','both') then raise exception using errcode='P0001', message='category_type_mismatch'; end if;

  update transactions set deleted_at = now() where id = p_id;

  if v_new_type = 'expense' and account_balance(v_new_account) < v_new_amount then
    update transactions set deleted_at = null where id = p_id;
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(v_new_account), 'needed', v_new_amount)::text;
  end if;

  update transactions set
    amount = v_new_amount, type = v_new_type, account_id = v_new_account, category_id = v_new_category,
    date = v_new_date, note = coalesce(p_patch->>'note', note), deleted_at = null, updated_at = now()
  where id = p_id returning * into v_result;

  return v_result;
end;
$$;

create or replace function delete_transaction(p_household_id uuid, p_actor_member_id uuid, p_id uuid)
returns transactions language plpgsql as $$
declare v_actor household_members; v_tx transactions; v_result transactions;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_tx from transactions where id = p_id and household_id = p_household_id and deleted_at is null for update;
  if v_tx is null then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;

  if v_tx.type = 'income' and account_balance(v_tx.account_id) - v_tx.amount < 0 then
    raise exception using errcode = 'P0001', message = 'would_make_balance_negative';
  end if;
  if v_tx.type = 'transfer' and account_balance(v_tx.to_account_id) - v_tx.amount < 0 then
    raise exception using errcode = 'P0001', message = 'would_make_balance_negative';
  end if;

  update transactions set deleted_at = now(), deleted_by_member_id = p_actor_member_id, updated_at = now()
  where id = p_id returning * into v_result;

  update piutang set lend_transaction_id = null where lend_transaction_id = p_id;
  return v_result;
end;
$$;

create or replace function restore_transaction(p_household_id uuid, p_actor_member_id uuid, p_id uuid)
returns transactions language plpgsql as $$
declare v_actor household_members; v_tx transactions; v_result transactions;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_tx from transactions where id = p_id and household_id = p_household_id and deleted_at is not null for update;
  if v_tx is null then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;

  if v_tx.recurring_id is not null and exists (
    select 1 from transactions where recurring_id = v_tx.recurring_id and date = v_tx.date and deleted_at is null and id <> v_tx.id
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate_recurring_execution';
  end if;

  if v_tx.type in ('expense','transfer') and account_balance(v_tx.account_id) < v_tx.amount then
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(v_tx.account_id), 'needed', v_tx.amount)::text;
  end if;

  update transactions set deleted_at = null, deleted_by_member_id = null, updated_at = now()
  where id = p_id returning * into v_result;
  return v_result;
end;
$$;

create or replace function adjust_balance(p_household_id uuid, p_actor_member_id uuid, p_account_id uuid, p_new_balance bigint, p_date date default null, p_note text default null)
returns jsonb language plpgsql as $$
declare
  v_actor household_members; v_account accounts; v_diff bigint; v_cat_id uuid; v_tx transactions;
begin
  if p_new_balance is null or p_new_balance < 0 or p_new_balance > 100000000000 then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"new_balance"}';
  end if;
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;

  v_diff := p_new_balance - account_balance(p_account_id);
  if v_diff = 0 then
    return jsonb_build_object('account', to_jsonb(v_account) || jsonb_build_object('balance', p_new_balance), 'transaction', null, 'diff', 0);
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'balance_adjustment';

  insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source)
  values (p_household_id, case when v_diff > 0 then 'income' else 'expense' end::tx_type, abs(v_diff), p_account_id, v_cat_id,
          coalesce(nullif(p_note,''), 'Koreksi saldo ' || v_account.name), coalesce(p_date, today_in_tz(p_household_id)), p_actor_member_id, 'system')
  returning * into v_tx;

  return jsonb_build_object('account', to_jsonb(v_account) || jsonb_build_object('balance', p_new_balance), 'transaction', to_jsonb(v_tx), 'diff', v_diff);
end;
$$;


-- ====================================================================
-- 00000000000008_functions_debts_goals_piutang.sql
-- ====================================================================
-- 0008: pay_debt, topup_goal, lend_piutang, receive_piutang, delete_account, delete_category (03-database.md §8.3)

create or replace function pay_debt(p_household_id uuid, p_actor_member_id uuid, p_debt_id uuid, p_account_id uuid, p_amount bigint, p_date date, p_note text, p_allow_overpay boolean default false)
returns jsonb language plpgsql as $$
declare v_actor household_members; v_debt debts; v_remaining bigint; v_tx transactions; v_payment debt_payments; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_debt from debts where id = p_debt_id and household_id = p_household_id and deleted_at is null for update;
  if v_debt is null then raise exception using errcode = 'P0001', message = 'debt_not_found'; end if;

  select remaining into v_remaining from v_debts where id = p_debt_id;
  if v_remaining <= 0 then raise exception using errcode = 'P0001', message = 'debt_already_settled'; end if;
  if p_amount > v_remaining and not p_allow_overpay then
    raise exception using errcode = 'P0001', message = 'overpayment', detail = jsonb_build_object('remaining', v_remaining)::text;
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'debt_payment';
  v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_account_id, v_cat_id, p_amount, p_date,
            coalesce(nullif(p_note,''), 'Cicilan ' || v_debt.name), 'web');

  insert into debt_payments (debt_id, transaction_id, member_id, amount, date, note)
  values (p_debt_id, v_tx.id, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
  returning * into v_payment;

  return jsonb_build_object('transaction', to_jsonb(v_tx), 'payment', to_jsonb(v_payment),
    'debt', to_jsonb((select d from v_debts d where id = p_debt_id)));
end;
$$;

create or replace function topup_goal(p_household_id uuid, p_actor_member_id uuid, p_goal_id uuid, p_account_id uuid, p_amount bigint, p_date date, p_note text)
returns jsonb language plpgsql as $$
declare v_actor household_members; v_goal goals; v_tx transactions; v_contribution goal_contributions; v_cat_id uuid; v_current bigint; v_target bigint;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_goal from goals where id = p_goal_id and household_id = p_household_id and deleted_at is null for update;
  if v_goal is null then raise exception using errcode = 'P0001', message = 'goal_not_found'; end if;

  if p_account_id is not null then
    select id into v_cat_id from categories where household_id = p_household_id and system_key = 'goal_saving';
    v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_account_id, v_cat_id, p_amount, p_date,
              coalesce(nullif(p_note,''), 'Tabungan: ' || v_goal.name), 'web');
    insert into goal_contributions (goal_id, transaction_id, member_id, amount, date, note)
    values (p_goal_id, v_tx.id, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
    returning * into v_contribution;
  else
    insert into goal_contributions (goal_id, transaction_id, member_id, amount, date, note)
    values (p_goal_id, null, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
    returning * into v_contribution;
  end if;

  select current, target into v_current, v_target from v_goals_full where id = p_goal_id;

  return jsonb_build_object('transaction', to_jsonb(v_tx), 'contribution', to_jsonb(v_contribution),
    'goal', to_jsonb((select g from v_goals_full g where id = p_goal_id)), 'reached', v_current >= v_target);
end;
$$;

create or replace function lend_piutang(p_household_id uuid, p_actor_member_id uuid, p_borrower_name text, p_total bigint, p_from_account_id uuid, p_owner_member_id uuid, p_due_date date, p_notes text, p_date date)
returns jsonb language plpgsql as $$
declare v_actor household_members; v_piutang piutang; v_tx transactions; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  insert into piutang (household_id, owner_member_id, borrower_name, total, from_account_id, due_date, notes)
  values (p_household_id, coalesce(p_owner_member_id, p_actor_member_id), p_borrower_name, p_total, p_from_account_id, p_due_date, coalesce(p_notes,''))
  returning * into v_piutang;

  if p_from_account_id is not null then
    select id into v_cat_id from categories where household_id = p_household_id and system_key = 'piutang';
    v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_from_account_id, v_cat_id, p_total, coalesce(p_date, today_in_tz(p_household_id)),
              'Piutang ke ' || p_borrower_name, 'web');
    update piutang set lend_transaction_id = v_tx.id where id = v_piutang.id;
  end if;

  return jsonb_build_object('piutang', to_jsonb((select p from v_piutang p where id = v_piutang.id)), 'transaction', to_jsonb(v_tx));
end;
$$;

create or replace function receive_piutang(p_household_id uuid, p_actor_member_id uuid, p_piutang_id uuid, p_account_id uuid, p_amount bigint, p_date date, p_note text, p_allow_overpay boolean default false)
returns jsonb language plpgsql as $$
declare v_actor household_members; v_piutang piutang; v_remaining bigint; v_tx transactions; v_receipt piutang_receipts; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_piutang from piutang where id = p_piutang_id and household_id = p_household_id and deleted_at is null for update;
  if v_piutang is null then raise exception using errcode = 'P0001', message = 'piutang_not_found'; end if;

  select remaining into v_remaining from v_piutang where id = p_piutang_id;
  if v_remaining <= 0 then raise exception using errcode = 'P0001', message = 'piutang_already_settled'; end if;
  if p_amount > v_remaining and not p_allow_overpay then
    raise exception using errcode = 'P0001', message = 'overpayment', detail = jsonb_build_object('remaining', v_remaining)::text;
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'piutang';
  v_tx := post_transaction(p_household_id, p_actor_member_id, 'income', p_account_id, v_cat_id, p_amount, p_date,
            coalesce(nullif(p_note,''), 'Terima piutang dari ' || v_piutang.borrower_name), 'web');

  insert into piutang_receipts (piutang_id, transaction_id, member_id, amount, date, note)
  values (p_piutang_id, v_tx.id, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
  returning * into v_receipt;

  return jsonb_build_object('transaction', to_jsonb(v_tx), 'receipt', to_jsonb(v_receipt),
    'piutang', to_jsonb((select p from v_piutang p where id = p_piutang_id)));
end;
$$;

create or replace function delete_account(p_household_id uuid, p_actor_member_id uuid, p_account_id uuid, p_force_archive boolean default false)
returns accounts language plpgsql as $$
declare v_actor household_members; v_account accounts; v_balance bigint; v_tx_count int; v_rec_count int;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;
  if v_actor.role <> 'owner' and v_account.owner_member_id <> p_actor_member_id then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select count(*) into v_rec_count from recurring_transactions where account_id = p_account_id and active and deleted_at is null;
  if v_rec_count > 0 then raise exception using errcode = 'P0001', message = 'account_in_use_by_recurring'; end if;

  v_balance := account_balance(p_account_id);
  if v_balance <> 0 then
    raise exception using errcode = 'P0001', message = 'account_has_balance', detail = jsonb_build_object('balance', v_balance)::text;
  end if;

  select count(*) into v_tx_count from transactions where (account_id = p_account_id or to_account_id = p_account_id) and deleted_at is null;
  if v_tx_count > 0 and not p_force_archive then
    raise exception using errcode = 'P0001', message = 'account_has_transactions', detail = jsonb_build_object('count', v_tx_count)::text;
  end if;

  update accounts set deleted_at = now() where id = p_account_id returning * into v_account;
  return v_account;
end;
$$;

create or replace function delete_category(p_household_id uuid, p_actor_member_id uuid, p_category_id uuid, p_merge_into_category_id uuid default null)
returns categories language plpgsql as $$
declare v_actor household_members; v_cat categories; v_count int;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  if v_actor.role <> 'owner' then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  select * into v_cat from categories where id = p_category_id and household_id = p_household_id and deleted_at is null for update;
  if v_cat is null then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  if v_cat.is_system then raise exception using errcode = 'P0001', message = 'category_reserved'; end if;

  select count(*) into v_count from transactions where category_id = p_category_id and deleted_at is null;
  if v_count > 0 then
    if p_merge_into_category_id is null then
      raise exception using errcode = 'P0001', message = 'category_in_use', detail = jsonb_build_object('count', v_count)::text;
    end if;
    update transactions set category_id = p_merge_into_category_id where category_id = p_category_id;
    update budgets set category_id = p_merge_into_category_id where category_id = p_category_id;
    update recurring_transactions set category_id = p_merge_into_category_id where category_id = p_category_id;
  end if;

  update categories set deleted_at = now() where id = p_category_id returning * into v_cat;
  return v_cat;
end;
$$;


-- ====================================================================
-- 00000000000009_functions_resolve_recurring.sql
-- ====================================================================
-- 0009: resolve_account/category/member, next_recurring_date, run_due_recurrings, bump_rate_limit (03 §8.3, 06 §4)

create or replace function norm_text(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(lower(unaccent(coalesce(p,''))), '\s+', ' ', 'g'));
$$;

create or replace function resolve_account(p_household_id uuid, p_actor_member_id uuid, p_query text, p_prefer_own boolean default false)
returns jsonb language plpgsql as $$
declare
  v_norm text := norm_text(p_query);
  v_owner_filter uuid; v_is_joint boolean := false; v_name_query text;
  v_candidates jsonb; v_top_score numeric; v_count int;
  v_member record; v_alias text; v_matched_member_count int := 0;
begin
  v_name_query := v_norm;

  if v_norm ~ '\y(saya|aku|gue|gw|ku)\y' then
    v_owner_filter := p_actor_member_id;
    v_name_query := trim(regexp_replace(v_name_query, '\y(saya|aku|gue|gw|ku)\y', '', 'g'));
  elsif v_norm ~ '\y(bersama|joint|keluarga|rumah|kita)\y' then
    v_is_joint := true;
    v_name_query := trim(regexp_replace(v_name_query, '\y(bersama|joint|keluarga|rumah|kita)\y', '', 'g'));
  else
    for v_member in select id, display_name, aliases from household_members where household_id = p_household_id and deleted_at is null loop
      if v_norm ~ ('\y' || norm_text(v_member.display_name) || '\y') then
        v_matched_member_count := v_matched_member_count + 1;
        v_owner_filter := v_member.id;
        v_name_query := trim(regexp_replace(v_name_query, '\y' || norm_text(v_member.display_name) || '\y', '', 'g'));
      else
        foreach v_alias in array v_member.aliases loop
          if v_alias <> '' and v_norm ~ ('\y' || norm_text(v_alias) || '\y') then
            v_matched_member_count := v_matched_member_count + 1;
            v_owner_filter := v_member.id;
            v_name_query := trim(regexp_replace(v_name_query, '\y' || norm_text(v_alias) || '\y', '', 'g'));
            exit;
          end if;
        end loop;
      end if;
    end loop;
    if v_matched_member_count > 1 then
      return jsonb_build_object('status', 'ambiguous', 'candidates', '[]'::jsonb, 'reason', 'multiple_owners_in_query');
    end if;
  end if;
  v_name_query := trim(regexp_replace(v_name_query, '\s+', ' ', 'g'));

  with scored as (
    select a.id, a.name, a.visibility, a.owner_member_id, m.display_name as owner_display_name,
      greatest(
        case when norm_text(a.name) = v_name_query or exists (select 1 from unnest(a.aliases) al where norm_text(al) = v_name_query) then 100 else 0 end,
        case when v_name_query <> '' and (norm_text(a.name) like v_name_query || '%' or v_name_query like norm_text(a.name) || '%') and length(v_name_query) >= 3 then 75 else 0 end,
        case when v_name_query <> '' and norm_text(a.name) like '%' || v_name_query || '%' then 70 else 0 end,
        case when v_name_query <> '' then round((similarity(norm_text(a.name), v_name_query) * 100)::numeric, 0) else 0 end
      ) as score,
      case when v_name_query <> '' then similarity(norm_text(a.name), v_name_query) else 0 end as sim
    from accounts a
    left join household_members m on m.id = a.owner_member_id
    where a.household_id = p_household_id and a.deleted_at is null
      and (v_owner_filter is null or a.owner_member_id = v_owner_filter)
      and (not v_is_joint or a.owner_member_id is null)
  ),
  agg as (select coalesce(max(score) filter (where score >= 45), -1) as top_score from scored)
  select
    nullif((select top_score from agg), -1),
    (select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
        'owner', case when s.owner_member_id is null then null else jsonb_build_object('member_id', s.owner_member_id, 'display_name', s.owner_display_name) end,
        'visibility', s.visibility, 'score', s.score))
     from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45),
    (select count(*) from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45)
  into v_top_score, v_candidates, v_count;

  if v_top_score is null then
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'owner', case when owner_member_id is null then null else jsonb_build_object('member_id', owner_member_id, 'display_name', owner_display_name) end))
    into v_candidates
    from (
      select a.id, a.name, a.owner_member_id, m.display_name as owner_display_name,
             similarity(norm_text(a.name), v_name_query) as sim
      from accounts a left join household_members m on m.id = a.owner_member_id
      where a.household_id = p_household_id and a.deleted_at is null
        and (v_owner_filter is null or a.owner_member_id = v_owner_filter)
        and (not v_is_joint or a.owner_member_id is null)
      order by sim desc limit 3
    ) s;
    return jsonb_build_object('status', 'not_found', 'candidates', coalesce(v_candidates, '[]'::jsonb));
  end if;

  if v_count = 1 then
    return jsonb_build_object('status', 'ok', 'match', v_candidates->0);
  end if;

  if p_prefer_own then
    declare v_own jsonb;
    begin
      select jsonb_agg(c) into v_own from jsonb_array_elements(v_candidates) c where (c->'owner'->>'member_id')::uuid = p_actor_member_id;
      if v_own is not null and jsonb_array_length(v_own) = 1 then
        return jsonb_build_object('status', 'ok', 'match', v_own->0);
      end if;
    end;
  end if;

  return jsonb_build_object('status', 'ambiguous', 'candidates', v_candidates);
end;
$$;

create or replace function resolve_category(p_household_id uuid, p_query text, p_type tx_type default null)
returns jsonb language plpgsql as $$
declare v_name_query text := norm_text(p_query); v_top_score numeric; v_candidates jsonb; v_count int;
begin
  with scored as (
    select c.id, c.name, c.icon, c.color, c.type,
      greatest(
        case when norm_text(c.name) = v_name_query or exists (select 1 from unnest(c.aliases) al where norm_text(al) = v_name_query) then 100 else 0 end,
        case when v_name_query <> '' and norm_text(c.name) like v_name_query || '%' and length(v_name_query) >= 2 then 75 else 0 end,
        case when v_name_query <> '' then round((similarity(norm_text(c.name), v_name_query) * 100)::numeric, 0) else 0 end
      ) as score
    from categories c
    where c.household_id = p_household_id and c.deleted_at is null and c.system_key is distinct from 'transfer'
      and (p_type is null or c.type::text in (p_type::text, 'both'))
  ),
  agg as (select coalesce(max(score) filter (where score >= 45), -1) as top_score from scored)
  select
    nullif((select top_score from agg), -1),
    (select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon, 'color', s.color, 'score', s.score))
     from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45),
    (select count(*) from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45)
  into v_top_score, v_candidates, v_count;

  if v_top_score is null then
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'icon', icon)) into v_candidates
    from (
      select c.id, c.name, c.icon, similarity(norm_text(c.name), v_name_query) as sim
      from categories c
      where c.household_id = p_household_id and c.deleted_at is null and c.system_key is distinct from 'transfer'
        and (p_type is null or c.type::text in (p_type::text, 'both'))
      order by sim desc limit 3
    ) s;
    return jsonb_build_object('status', 'not_found', 'candidates', coalesce(v_candidates, '[]'::jsonb));
  end if;

  if v_count = 1 then return jsonb_build_object('status', 'ok', 'match', v_candidates->0); end if;
  return jsonb_build_object('status', 'ambiguous', 'candidates', v_candidates);
end;
$$;

create or replace function resolve_member(p_household_id uuid, p_query text)
returns jsonb language plpgsql as $$
declare v_name_query text := norm_text(p_query); v_candidates jsonb; v_count int;
begin
  select jsonb_agg(jsonb_build_object('id', id, 'display_name', display_name)), count(*)
  into v_candidates, v_count
  from household_members
  where household_id = p_household_id and deleted_at is null
    and (norm_text(display_name) = v_name_query or exists (select 1 from unnest(aliases) a where norm_text(a) = v_name_query));

  if v_count = 1 then return jsonb_build_object('status', 'ok', 'match', v_candidates->0); end if;
  if v_count is null or v_count = 0 then return jsonb_build_object('status', 'not_found', 'candidates', '[]'::jsonb); end if;
  return jsonb_build_object('status', 'ambiguous', 'candidates', v_candidates);
end;
$$;

create or replace function next_recurring_date(p_from date, p_freq recurring_frequency, p_anchor_day smallint)
returns date language plpgsql immutable as $$
declare v_next date; v_last_day int;
begin
  if p_freq = 'daily' then return p_from + interval '1 day'; end if;
  if p_freq = 'weekly' then return p_from + interval '7 days'; end if;
  if p_freq = 'monthly' then
    v_next := date_trunc('month', p_from) + interval '1 month';
    v_last_day := extract(day from (v_next + interval '1 month - 1 day'));
    return v_next + (least(coalesce(p_anchor_day, extract(day from p_from)::int), v_last_day) - 1) * interval '1 day';
  end if;
  if p_freq = 'yearly' then
    begin
      return (p_from + interval '1 year')::date;
    exception when others then
      return (date_trunc('year', p_from) + interval '1 year' + interval '58 days')::date; -- fallback 29 Feb -> 28 Feb
    end;
  end if;
  return p_from;
end;
$$;

create or replace function run_due_recurrings(p_household_id uuid default null, p_today date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rec record; v_today date; v_skipped jsonb := '[]'::jsonb; v_executed int := 0; v_claims text; v_iter int;
  v_user_id uuid; v_tx transactions; v_cat_id uuid;
begin
  for v_rec in
    select * from recurring_transactions
    where active and deleted_at is null
      and (p_household_id is null or household_id = p_household_id)
      and next_date <= coalesce(p_today, today_in_tz(household_id))
  loop
    select user_id into v_user_id from household_members where id = v_rec.member_id;
    v_claims := json_build_object('sub', v_user_id, 'role', 'authenticated')::text;
    perform set_config('request.jwt.claims', v_claims, true);

    v_iter := 0;
    v_today := coalesce(p_today, today_in_tz(v_rec.household_id));
    <<catchup>>
    while v_rec.next_date <= v_today and v_iter < (case when v_rec.frequency = 'daily' then 7 else 31 end) loop
      v_iter := v_iter + 1;
      begin
        if exists (select 1 from transactions where recurring_id = v_rec.id and date = v_rec.next_date and deleted_at is null) then
          v_rec.next_date := next_recurring_date(v_rec.next_date, v_rec.frequency, v_rec.anchor_day);
          continue;
        end if;

        v_tx := post_transaction(v_rec.household_id, v_rec.member_id, v_rec.type, v_rec.account_id, v_rec.category_id,
                  v_rec.amount, v_rec.next_date, v_rec.name, 'recurring', v_rec.id);

        if v_rec.debt_id is not null then
          select id into v_cat_id from categories where household_id = v_rec.household_id and system_key = 'debt_payment';
          insert into debt_payments (debt_id, transaction_id, member_id, amount, date, note)
          values (v_rec.debt_id, v_tx.id, v_rec.member_id, v_rec.amount, v_rec.next_date, v_rec.name);
        end if;

        v_executed := v_executed + 1;
        v_rec.next_date := next_recurring_date(v_rec.next_date, v_rec.frequency, v_rec.anchor_day);
        update recurring_transactions set next_date = v_rec.next_date, last_run_at = now(), last_error = null, updated_at = now()
        where id = v_rec.id;
      exception when others then
        update recurring_transactions set last_error = sqlerrm, updated_at = now() where id = v_rec.id;
        v_skipped := v_skipped || jsonb_build_object('recurring_id', v_rec.id, 'name', v_rec.name, 'reason', sqlerrm);
        exit catchup;
      end;
    end loop;

    perform set_config('request.jwt.claims', '', true);
  end loop;

  return jsonb_build_object('executed', v_executed, 'skipped', v_skipped);
end;
$$;

create or replace function bump_rate_limit(p_api_key_id uuid, p_minute_limit int, p_day_limit int)
returns table(allowed boolean, remaining_minute int, remaining_day int, reset_at timestamptz)
language plpgsql as $$
declare v_minute_start timestamptz := date_trunc('minute', now()); v_day_start timestamptz := date_trunc('day', now());
        v_minute_count int; v_day_count int;
begin
  insert into rate_limit_counters (api_key_id, window_kind, window_start, count)
  values (p_api_key_id, 'minute', v_minute_start, 1)
  on conflict (api_key_id, window_kind, window_start) do update set count = rate_limit_counters.count + 1
  returning count into v_minute_count;

  insert into rate_limit_counters (api_key_id, window_kind, window_start, count)
  values (p_api_key_id, 'day', v_day_start, 1)
  on conflict (api_key_id, window_kind, window_start) do update set count = rate_limit_counters.count + 1
  returning count into v_day_count;

  return query select
    (v_minute_count <= p_minute_limit and v_day_count <= p_day_limit),
    greatest(0, p_minute_limit - v_minute_count),
    greatest(0, p_day_limit - v_day_count),
    v_minute_start + interval '1 minute';
end;
$$;


-- ====================================================================
-- 00000000000010_rls.sql
-- ====================================================================
-- 0010: Row Level Security (03-database.md §7)

alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invitations enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table goal_contributions enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table piutang enable row level security;
alter table piutang_receipts enable row level security;
alter table recurring_transactions enable row level security;
alter table split_bills enable row level security;
alter table split_bill_members enable row level security;
alter table investments enable row level security;
alter table api_keys enable row level security;
alter table audit_log enable row level security;
alter table user_settings enable row level security;
alter table subscriptions enable row level security;

-- households
create policy households_select on households for select using (is_household_member(id));
create policy households_update on households for update using (member_role_in(id) = 'owner');

-- household_members
create policy members_select on household_members for select using (is_household_member(household_id));

-- household_invitations
create policy invitations_select on household_invitations for select using (member_role_in(household_id) = 'owner');

-- categories
create policy categories_select on categories for select using (is_household_member(household_id));
create policy categories_write on categories for insert with check (member_role_in(household_id) = 'owner');
create policy categories_update on categories for update using (member_role_in(household_id) = 'owner');

-- accounts (semua member lihat baris; saldo privat disaring di aplikasi/view)
create policy accounts_select on accounts for select using (is_household_member(household_id));
create policy accounts_insert on accounts for insert with check (member_role_in(household_id) in ('owner','member'));
create policy accounts_update on accounts for update
  using (member_role_in(household_id) = 'owner' or owner_member_id in (select current_member_ids()));

-- transactions
create policy tx_select on transactions for select
  using (is_household_member(household_id) and (can_view_account(account_id) or (to_account_id is not null and can_view_account(to_account_id))));
create policy tx_insert on transactions for insert
  with check (can_post_to_account(account_id) and (to_account_id is null or is_household_member(household_id)));
create policy tx_update on transactions for update using (can_post_to_account(account_id));

-- budgets, goals, debts, piutang, recurring, split_bills, investments: pola umum baca household, tulis owner/member
create policy budgets_select on budgets for select using (is_household_member(household_id));
create policy budgets_write on budgets for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

create policy goals_select on goals for select using (is_household_member(household_id));
create policy goals_write on goals for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy goal_contrib_select on goal_contributions for select using (exists (select 1 from goals g where g.id = goal_id and is_household_member(g.household_id)));

create policy debts_select on debts for select using (is_household_member(household_id));
create policy debts_write on debts for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy debt_payments_select on debt_payments for select using (exists (select 1 from debts d where d.id = debt_id and is_household_member(d.household_id)));

create policy piutang_select on piutang for select using (is_household_member(household_id));
create policy piutang_write on piutang for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy piutang_receipts_select on piutang_receipts for select using (exists (select 1 from piutang p where p.id = piutang_id and is_household_member(p.household_id)));

create policy recurring_select on recurring_transactions for select using (is_household_member(household_id));
create policy recurring_write on recurring_transactions for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

create policy split_bills_select on split_bills for select using (is_household_member(household_id));
create policy split_bills_write on split_bills for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy split_bill_members_select on split_bill_members for select using (exists (select 1 from split_bills b where b.id = bill_id and is_household_member(b.household_id)));
create policy split_bill_members_write on split_bill_members for all
  using (exists (select 1 from split_bills b where b.id = bill_id and member_role_in(b.household_id) in ('owner','member')))
  with check (exists (select 1 from split_bills b where b.id = bill_id and member_role_in(b.household_id) in ('owner','member')));

create policy investments_select on investments for select using (is_household_member(household_id));
create policy investments_write on investments for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

-- api_keys: key_hash TIDAK BOLEH terbaca oleh authenticated. Revoke kolom saja TIDAK CUKUP karena
-- Supabase memberi GRANT ALL level-tabel ke authenticated/anon by default (ALTER DEFAULT PRIVILEGES
-- platform), dan grant level-tabel mengalahkan revoke level-kolom. Solusi: revoke SELECT penuh dari
-- tabel dasar, hanya expose lewat view yang tidak menyertakan key_hash.
revoke select on api_keys from authenticated, anon;
create policy api_keys_select on api_keys for select using (is_household_member(household_id));

create or replace view v_api_keys as
select id, household_id, member_id, name, key_prefix, scope, expires_at, last_used_at, last_used_ip, revoked_at, created_by, created_at
from api_keys;
alter view v_api_keys set (security_invoker = on);
grant select on v_api_keys to authenticated;

-- audit_log: hanya owner
create policy audit_log_select on audit_log for select using (member_role_in(household_id) = 'owner');

-- user_settings, subscriptions: tetap per auth.uid()
create policy user_settings_own on user_settings using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy subscriptions_select on subscriptions for select using (auth.uid() = user_id);

-- ── role backend ──────────────────────────────────────────────────────────
do $$ begin
  create role karaya_api login password 'change_me_in_production' noinherit;
exception when duplicate_object then null; end $$;
grant authenticated to karaya_api;
grant usage on schema public to karaya_api;
grant select, insert, update, delete on idempotency_keys, rate_limit_counters, audit_log, migration_issues to karaya_api;
grant select on api_keys to karaya_api;
grant update (last_used_at, last_used_ip) on api_keys to karaya_api;
grant execute on function bump_rate_limit(uuid,int,int) to karaya_api;
grant usage, select on all sequences in schema public to karaya_api;


-- ====================================================================
-- 00000000000011_cron.sql
-- ====================================================================
-- 0011: pg_cron (03-database.md §10). Dibungkus guard karena ekstensi hanya tersedia di beberapa image/plan.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
exception when insufficient_privilege then
  raise notice 'pg_cron tidak bisa diaktifkan oleh role saat ini; jadwalkan manual lewat Dashboard > Database > Cron';
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('run-due-recurrings', '5 17 * * *', $cron$select run_due_recurrings(null, null)$cron$);
    perform cron.schedule('cleanup-idempotency', '15 17 * * *', $cron$delete from idempotency_keys where expires_at < now()$cron$);
    perform cron.schedule('cleanup-rate-limits', '20 17 * * *', $cron$delete from rate_limit_counters where window_start < now() - interval '2 days'$cron$);
    perform cron.schedule('expire-invitations', '25 17 * * *', $cron$update household_invitations set status='expired' where status='pending' and expires_at < now()$cron$);
  else
    raise notice 'pg_cron tidak terpasang; jadwal dilewati. Aktifkan manual lalu jalankan ulang blok ini.';
  end if;
end $$;


-- ====================================================================
-- 00000000000012_fix_audit_trail_insert_policies.sql
-- ====================================================================
-- 0012: Perbaikan bug — debt_payments/goal_contributions/piutang_receipts punya RLS aktif
-- (migrasi 0010) tapi hanya diberi policy SELECT. Baris-baris ini HANYA pernah di-insert oleh
-- fungsi plpgsql (pay_debt, topup_goal, receive_piutang, run_due_recurrings), yang berjalan
-- dengan hak akses PEMANGGIL (bukan SECURITY DEFINER) sejak apps/api melakukan
-- `SET LOCAL ROLE authenticated` per request (03-database.md §7.1). Tanpa policy INSERT,
-- `insert into debt_payments ...` di dalam pay_debt() gagal dengan 42501 (permission denied)
-- begitu dipanggil sebagai role `authenticated` sungguhan — baru ditemukan di Fase 3 saat
-- menguji lewat apps/api; lolos di Fase 2 karena saat itu diuji sebagai superuser `postgres`
-- yang bypass RLS. Lihat docs/spec/PROGRESS.md untuk detail.

create policy debt_payments_insert on debt_payments for insert
  with check (exists (
    select 1 from debts d where d.id = debt_id
      and is_household_member(d.household_id)
      and member_role_in(d.household_id) in ('owner','member')
  ));

create policy goal_contrib_insert on goal_contributions for insert
  with check (exists (
    select 1 from goals g where g.id = goal_id
      and is_household_member(g.household_id)
      and member_role_in(g.household_id) in ('owner','member')
  ));

create policy piutang_receipts_insert on piutang_receipts for insert
  with check (exists (
    select 1 from piutang p where p.id = piutang_id
      and is_household_member(p.household_id)
      and member_role_in(p.household_id) in ('owner','member')
  ));


-- ====================================================================
-- 00000000000013_lend_piutang_opening_received.sql
-- ====================================================================
-- 0013: Tambah parameter p_opening_received ke lend_piutang (Fase 4 — ditemukan saat migrasi
-- frontend: form PiutangView lama mengizinkan mencatat piutang yang sebagian sudah diterima
-- sebelum mulai dicatat di app, setara `debts.opening_paid` yang sudah ada sejak awal untuk hutang).
drop function if exists lend_piutang(uuid, uuid, text, bigint, uuid, uuid, date, text, date);

create or replace function lend_piutang(
  p_household_id uuid, p_actor_member_id uuid, p_borrower_name text, p_total bigint,
  p_from_account_id uuid, p_owner_member_id uuid, p_due_date date, p_notes text, p_date date,
  p_opening_received bigint default 0
)
returns jsonb language plpgsql as $$
declare v_actor household_members; v_piutang piutang; v_tx transactions; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  insert into piutang (household_id, owner_member_id, borrower_name, total, opening_received, from_account_id, due_date, notes)
  values (p_household_id, coalesce(p_owner_member_id, p_actor_member_id), p_borrower_name, p_total, greatest(0, coalesce(p_opening_received, 0)), p_from_account_id, p_due_date, coalesce(p_notes,''))
  returning * into v_piutang;

  if p_from_account_id is not null then
    select id into v_cat_id from categories where household_id = p_household_id and system_key = 'piutang';
    v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_from_account_id, v_cat_id, p_total, coalesce(p_date, today_in_tz(p_household_id)),
              'Piutang ke ' || p_borrower_name, 'web');
    update piutang set lend_transaction_id = v_tx.id where id = v_piutang.id;
  end if;

  return jsonb_build_object('piutang', to_jsonb((select p from v_piutang p where id = v_piutang.id)), 'transaction', to_jsonb(v_tx));
end;
$$;


-- ====================================================================
-- 00000000000014_lend_piutang_icon_color.sql
-- ====================================================================
-- Fase 4: CreatePiutangBodySchema/UpdatePiutangBodySchema sebelumnya tidak mengekspos kolom
-- icon/color yang sudah ada di tabel piutang sejak F2 (lihat 00000000000003_domain_tables.sql),
-- padahal debts & goals sudah mendukungnya. lend_piutang() ditambah parameter opsional supaya
-- PiutangView.jsx (yang selalu mengirim icon/color saat tambah piutang) tidak kehilangan datanya.
drop function if exists lend_piutang(uuid, uuid, text, bigint, uuid, uuid, date, text, date, bigint);

create or replace function lend_piutang(
  p_household_id uuid, p_actor_member_id uuid, p_borrower_name text, p_total bigint,
  p_from_account_id uuid, p_owner_member_id uuid, p_due_date date, p_notes text, p_date date,
  p_opening_received bigint default 0, p_icon text default null, p_color text default null
)
returns jsonb language plpgsql as $$
declare v_actor household_members; v_piutang piutang; v_tx transactions; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  insert into piutang (household_id, owner_member_id, borrower_name, total, opening_received, from_account_id, due_date, notes, icon, color)
  values (p_household_id, coalesce(p_owner_member_id, p_actor_member_id), p_borrower_name, p_total, greatest(0, coalesce(p_opening_received, 0)), p_from_account_id, p_due_date, coalesce(p_notes,''),
          coalesce(p_icon, '🤝'), coalesce(p_color, '#60fcc6'))
  returning * into v_piutang;

  if p_from_account_id is not null then
    select id into v_cat_id from categories where household_id = p_household_id and system_key = 'piutang';
    v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_from_account_id, v_cat_id, p_total, coalesce(p_date, today_in_tz(p_household_id)),
              'Piutang ke ' || p_borrower_name, 'web');
    update piutang set lend_transaction_id = v_tx.id where id = v_piutang.id;
  end if;

  return jsonb_build_object('piutang', to_jsonb((select p from v_piutang p where id = v_piutang.id)), 'transaction', to_jsonb(v_tx));
end;
$$;

grant execute on function lend_piutang(uuid, uuid, text, bigint, uuid, uuid, date, text, date, bigint, text, text) to anon, authenticated, service_role;


-- ====================================================================
-- 00000000000015_households_delete_policy.sql
-- ====================================================================
-- Fase 4 (F4-T5): "Hapus akun" di Sidebar butuh DELETE /v1/me, yang menghapus household milik
-- actor (cascade ke semua tabel domain lewat household_id on delete cascade). Tabel households
-- sebelumnya hanya punya policy select+update, belum ada delete — tanpa ini owner tidak bisa
-- menghapus household miliknya sendiri lewat role `authenticated`.
create policy households_delete on households for delete using (member_role_in(id) = 'owner');


-- ====================================================================
-- 00000000000016_create_household_security_definer.sql
-- ====================================================================
-- Bug ditemukan saat verifikasi manual Fase 4: households tidak punya INSERT policy sama sekali
-- (hanya select+update, lihat 00000000000010_rls.sql), jadi create_household() yang berjalan
-- sebagai role `authenticated` SELALU gagal dengan 42501/forbidden untuk SETIAP user baru — alur
-- onboarding (POST /v1/households, dipakai OnboardingHousehold.jsx) belum pernah benar-benar bisa
-- jalan sejak dibuat. Household memang belum ada saat fungsi ini dipanggil, jadi tidak ada baris
-- untuk dicek is_household_member/member_role_in — pola yang sama seperti fungsi onboarding
-- lain butuh security definer. Guard p_user_id = auth.uid() ditambah supaya user A tidak bisa
-- membuatkan household atas nama user B lewat parameter ini.
create or replace function create_household(p_name text, p_timezone text, p_display_name text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_household households; v_member household_members;
begin
  if p_user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  insert into households (name, timezone, created_by) values (p_name, coalesce(p_timezone, 'Asia/Jakarta'), p_user_id)
  returning * into v_household;

  insert into household_members (household_id, user_id, display_name, role, aliases)
  values (v_household.id, p_user_id, p_display_name, 'owner', '{saya}')
  returning * into v_member;

  perform seed_household_categories(v_household.id);

  insert into user_settings (user_id, active_household_id) values (p_user_id, v_household.id)
  on conflict (user_id) do update set active_household_id = excluded.active_household_id;

  return jsonb_build_object('household', to_jsonb(v_household), 'member', to_jsonb(v_member));
end;
$$;

grant execute on function create_household(text, text, text, uuid) to anon, authenticated, service_role;


-- ====================================================================
-- 00000000000017_user_settings_active_household_set_null.sql
-- ====================================================================
-- Bug ditemukan saat verifikasi manual DELETE /v1/me: user_settings.active_household_id punya FK
-- ke households TANPA on delete cascade/set null (default NO ACTION), jadi menghapus household
-- (deleteMyAccount / households_delete policy) selalu gagal 23503 kalau user itu sedang menjadikan
-- household itu active_household_id-nya sendiri — yang SELALU terjadi tepat setelah onboarding
-- (create_household mengisi active_household_id = household baru). Ganti jadi ON DELETE SET NULL:
-- kehilangan household aktif bukan error, cukup null-kan preferensinya; HouseholdProvider.jsx
-- sudah menangani active_household_id null dengan fallback ke membership pertama yang tersisa.
alter table user_settings drop constraint user_settings_active_household_id_fkey;
alter table user_settings add constraint user_settings_active_household_id_fkey
  foreign key (active_household_id) references households(id) on delete set null;


-- ====================================================================
-- 00000000000018_fase5_household_security_definer.sql
-- ====================================================================
-- Fase 5 (F5-T1): sama seperti bug create_household di migrasi 0016 — household_members dan
-- household_invitations hanya punya policy SELECT (lihat 00000000000010_rls.sql), jadi fungsi
-- yang menulis ke keduanya (create_invitation, accept_invitation, remove_member,
-- change_member_role, merge_household_into) akan SELALU gagal 42501 kalau dipanggil lewat role
-- `authenticated` sungguhan. Kelimanya sudah punya pengecekan otorisasi internal sendiri
-- (actor_mismatch, role owner, dst.) — SECURITY DEFINER aman dipakai di sini karena validasi
-- terjadi SEBELUM statement tulis apa pun, pola yang sama dengan member_role_in/can_view_account.
-- remove_member diubah lewat CREATE OR REPLACE di bawah (sekalian perbaikan guard self-leave).
alter function create_invitation(uuid, uuid, text, member_role, text) security definer set search_path = public;
alter function accept_invitation(text, uuid, text, text) security definer set search_path = public;
alter function change_member_role(uuid, uuid, uuid, member_role) security definer set search_path = public;
alter function merge_household_into(uuid, uuid, uuid) security definer set search_path = public;

-- Revoke undangan (DELETE /v1/invitations/{id}) adalah update status satu kolom oleh owner —
-- tidak perlu fungsi plpgsql terpisah, cukup policy UPDATE yang sepadan dengan invitations_select.
create policy invitations_update on household_invitations for update using (member_role_in(household_id) = 'owner');

-- remove_member() awalnya mewajibkan actor role='owner' tanpa kecuali — cocok untuk DELETE
-- /v1/members/{id} (hapus ANGGOTA LAIN, memang owner-only), tapi salah untuk POST
-- /v1/members/me/leave (anggota non-owner keluar dari household sendiri, memang harus boleh).
-- Guard diganti: non-owner tetap ditolak kalau menargetkan ORANG LAIN, tapi boleh menargetkan
-- diri sendiri (self-leave) berapa pun rolenya — aturan bisnis lain (last_owner, reassign_required)
-- di bawahnya tetap berlaku sama persis untuk kedua jalur.
create or replace function remove_member(p_household_id uuid, p_actor_member_id uuid, p_member_id uuid, p_reassign_to_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor household_members; v_target household_members; v_owner_count int; v_account_count int;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then raise exception using errcode = 'P0001', message = 'actor_mismatch'; end if;
  if v_actor.role <> 'owner' and p_actor_member_id <> p_member_id then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  select * into v_target from household_members where id = p_member_id and household_id = p_household_id and deleted_at is null;
  if v_target is null then raise exception using errcode = 'P0001', message = 'member_not_found'; end if;

  if v_target.role = 'owner' then
    select count(*) into v_owner_count from household_members where household_id = p_household_id and role = 'owner' and deleted_at is null and id <> p_member_id;
    if v_owner_count = 0 then raise exception using errcode = 'P0001', message = 'last_owner'; end if;
  end if;

  select count(*) into v_account_count from accounts where owner_member_id = p_member_id and deleted_at is null;
  if v_account_count > 0 and p_reassign_to_member_id is null then
    raise exception using errcode = 'P0001', message = 'reassign_required';
  end if;
  if v_account_count > 0 then
    update accounts set owner_member_id = (case when p_reassign_to_member_id = '00000000-0000-0000-0000-000000000000'::uuid then null else p_reassign_to_member_id end)
    where owner_member_id = p_member_id and deleted_at is null;
  end if;

  update budgets set deleted_at = now() where member_id = p_member_id and deleted_at is null;
  update api_keys set revoked_at = now() where member_id = p_member_id and revoked_at is null;
  update household_members set deleted_at = now() where id = p_member_id;
end;
$$;

-- household_members juga butuh policy UPDATE: PATCH /v1/members/{id} (display_name/aliases/color,
-- BUKAN role — itu lewat change_member_role SECURITY DEFINER) menulis langsung dari service layer,
-- bukan lewat fungsi plpgsql. Tanpa policy ini, UPDATE diam-diam 0 baris (RLS default-deny untuk
-- UPDATE bukan error 42501, jadi muncul sebagai member_not_found yang menyesatkan).
create policy members_update on household_members for update using (user_id = auth.uid() or member_role_in(household_id) = 'owner');

-- Bug nyata ditemukan saat uji manual leave+rejoin (F5-T1): household_members_household_id_user_id_key
-- adalah UNIQUE CONSTRAINT biasa (bukan partial index), jadi anggota yang keluar (soft-delete,
-- deleted_at diisi) lalu diundang lagi SELALU gagal 23505 saat accept_invitation insert baris baru —
-- constraint tidak tahu baris lama sudah "dihapus". Pola yang benar sudah ada di
-- household_members_active_name_uq (partial, where deleted_at is null); constraint user_id
-- seharusnya sama sejak awal.
alter table household_members drop constraint household_members_household_id_user_id_key;
create unique index household_members_household_user_active_uq
  on household_members (household_id, user_id) where deleted_at is null;


-- ====================================================================
-- 00000000000019_fase6_api_keys_functions.sql
-- ====================================================================
-- Fase 6 (F6-T1): api_keys hanya punya policy SELECT sejak F2 (00000000000010_rls.sql) — membuat
-- atau mencabut key butuh fungsi SECURITY DEFINER baru, pola sama persis dengan
-- create_invitation/remove_member (Fase 5): validasi otorisasi internal dulu, baru tulis,
-- supaya tidak terkena default-deny RLS saat dipanggil sebagai role authenticated sungguhan.
--
-- Pembuatan/hashing key (kf_live_...) terjadi di TypeScript (API_KEY_PEPPER adalah secret
-- aplikasi, bukan secret DB) — fungsi ini hanya menerima key_hash yang sudah dihitung dan
-- menyisipkannya, setelah menegakkan dua aturan dari 05-api.md §3.2:
--   1. Member hanya boleh membuat key untuk DIRINYA SENDIRI; owner boleh untuk siapa pun.
--   2. Scope key tidak boleh melebihi scope efektif peran target member (owner→admin,
--      member→write, viewer→read) — "member bisa membuat key untuk dirinya dengan scope <= role".
create or replace function role_to_scope(p_role member_role) returns api_key_scope
language sql immutable as $$
  select case p_role when 'owner' then 'admin'::api_key_scope when 'member' then 'write'::api_key_scope else 'read'::api_key_scope end;
$$;

create or replace function scope_rank(p_scope api_key_scope) returns int
language sql immutable as $$
  select case p_scope when 'admin' then 3 when 'write' then 2 else 1 end;
$$;

create or replace function create_api_key(
  p_household_id uuid, p_actor_member_id uuid, p_name text, p_target_member_id uuid,
  p_scope api_key_scope, p_key_prefix text, p_key_hash bytea, p_expires_at timestamptz
)
returns api_keys language plpgsql security definer set search_path = public as $$
declare v_actor household_members; v_target household_members; v_row api_keys;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;

  select * into v_target from household_members where id = p_target_member_id and household_id = p_household_id and deleted_at is null;
  if v_target is null then raise exception using errcode = 'P0001', message = 'member_not_found'; end if;

  if v_target.id <> v_actor.id and v_actor.role <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden_owner';
  end if;
  if scope_rank(p_scope) > scope_rank(role_to_scope(v_target.role)) then
    raise exception using errcode = 'P0001', message = 'scope_exceeds_role';
  end if;

  insert into api_keys (household_id, member_id, name, key_prefix, key_hash, scope, expires_at, created_by)
  values (p_household_id, p_target_member_id, p_name, p_key_prefix, p_key_hash, p_scope, p_expires_at, p_actor_member_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function revoke_api_key(p_household_id uuid, p_actor_member_id uuid, p_key_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor household_members; v_key api_keys;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;

  select * into v_key from api_keys where id = p_key_id and household_id = p_household_id;
  if v_key is null then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  if v_key.member_id <> v_actor.id and v_actor.role <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden_owner';
  end if;

  update api_keys set revoked_at = now() where id = p_key_id and revoked_at is null;
end;
$$;

grant execute on function create_api_key(uuid, uuid, text, uuid, api_key_scope, text, bytea, timestamptz) to authenticated;
grant execute on function revoke_api_key(uuid, uuid, uuid) to authenticated;

-- Bug nyata ditemukan saat uji manual F6-T1 (POST /v1/api-keys sukses di DB tapi response 403):
-- 2 penyebab terpisah ditemukan di request yang sama.
-- (1) audit_log punya RLS enabled sejak F2 dengan policy SELECT (owner-only) tapi TIDAK PERNAH
--     punya policy INSERT — auditMiddleware (Fase 6, menulis SETIAP request) selalu 42501 saat
--     insert. Grant langsung ke karaya_api di migrasi 0010 TIDAK cukup: role biasa (non-superuser,
--     tanpa BYPASSRLS) tetap tunduk RLS walau punya table-level privilege.
create policy audit_log_insert on audit_log for insert with check (is_household_member(household_id));

-- (2) v_api_keys dibuat dengan security_invoker = on (migrasi 0010) — niatnya supaya RLS tetap
--     dievaluasi per-pemanggil, TAPI efek sampingnya: akses ke TABEL DASAR api_keys di belakang
--     view JUGA dievaluasi dengan privilege pemanggil (authenticated), yang SELECT-nya sengaja
--     di-REVOKE penuh di baris yang sama persis. Hasilnya: SIAPA PUN yang query v_api_keys selalu
--     "permission denied for table api_keys", termasuk lewat GET /v1/api-keys yang justru dibuat
--     untuk itu. Pola standar Postgres untuk "expose kolom terbatas dari tabel yang direvoke" adalah
--     view BIASA (security_invoker OFF, default): akses ke tabel dasar dicek pakai privilege PEMILIK
--     VIEW (jadi revoke di tabel dasar tidak menghalangi), SEMENTARA row-level security policy tetap
--     dievaluasi pakai auth.uid() sesi pemanggil (ini perilaku khusus Postgres untuk view+RLS,
--     didokumentasikan resmi) — jadi household-scoping tidak hilang. security_invoker=on di sini
--     adalah kesalahan desain F2, bukan kehati-hatian yang disengaja.
alter view v_api_keys set (security_invoker = off);

-- (3) resolveApiKeyActor (auth/api-key.ts) butuh join api_keys + household_members SEBELUM
--     SET LOCAL ROLE authenticated (sama seperti lookup hash api_keys sendiri, 03-database.md §7.4:
--     "lookup hash sebelum SET ROLE") untuk tahu role/user_id pemilik key — tapi karaya_api belum
--     pernah di-grant akses apa pun ke household_members (sengaja, itu tabel domain yang harusnya
--     hanya lewat role authenticated+RLS). Select sempit 3 kolom yang dibutuhkan, meniru pola
--     grant api_keys yang sudah ada (granular, bukan akses penuh tabel domain).
grant select (id, user_id, role, deleted_at) on household_members to karaya_api;

-- (3b) Grant kolom di atas TIDAK CUKUP: household_members punya RLS enabled dengan hanya policy
--      SELECT yang butuh auth.uid() (is_household_member) — pada titik resolveApiKeyActor berjalan
--      BELUM ada JWT claims sama sekali (justru itu tujuannya: cari tahu siapa dulu dari hash key),
--      jadi auth.uid() null dan RLS menyaring SEMUA baris walau grant kolom sudah ada. Pola yang
--      benar (sama seperti look-up kredensial lain di sistem ini): bungkus SATU fungsi SECURITY
--      DEFINER yang melakukan JOIN api_keys+household_members dengan privilese dinaikkan, dipanggil
--      langsung oleh karaya_api tanpa SET ROLE — menggantikan query JOIN mentah di TypeScript.
create or replace function resolve_api_key(p_key_hash bytea)
returns table (
  id uuid, household_id uuid, member_id uuid, user_id uuid, scope api_key_scope,
  expires_at timestamptz, revoked_at timestamptz, member_deleted_at timestamptz, member_role member_role
)
language sql security definer set search_path = public as $$
  select k.id, k.household_id, k.member_id, m.user_id, k.scope, k.expires_at, k.revoked_at,
         m.deleted_at, m.role
  from api_keys k join household_members m on m.id = k.member_id
  where k.key_hash = p_key_hash;
$$;

grant execute on function resolve_api_key(bytea) to karaya_api;

-- (3c) touchLastUsed (auth/api-key.ts) — UPDATE last_used_at/last_used_ip oleh karaya_api langsung
--      juga kena RLS (api_keys hanya punya policy SELECT, UPDATE default-deny) meski sudah ada
--      grant UPDATE kolom sempit di migrasi 0010. Function kecil SECURITY DEFINER, best-effort
--      (dipanggil fire-and-forget, kegagalan tidak boleh menggagalkan request utama).
create or replace function touch_api_key_last_used(p_id uuid, p_ip inet)
returns void language sql security definer set search_path = public as $$
  update api_keys set last_used_at = now(), last_used_ip = p_ip where id = p_id;
$$;

grant execute on function touch_api_key_last_used(uuid, inet) to karaya_api;


-- ====================================================================
-- 00000000000020_drop_subscriptions.sql
-- ====================================================================
-- Fase 6: fitur subscription/payment/Midtrans DIBATALKAN TOTAL atas instruksi pemilik produk
-- (2026-10-06) — project ini tidak pernah punya pembayaran sungguhan. Lihat
-- docs/spec/PROGRESS.md § "Pembatalan total subscription/Midtrans" untuk konteks lengkap.
--
-- `subscriptions` dibuat di migrasi 00000000000003_domain_tables.sql (Fase 2, sudah lama live di
-- produksi) — migrasi itu SENGAJA tidak diubah (prinsip: jangan tulis ulang migrasi yang sudah
-- diterapkan). `upsert_subscription` sempat dibuat di migrasi 00000000000020_subscriptions_upsert.sql
-- yang sudah dihapus dari folder ini (belum pernah jadi bagian riwayat git yang di-commit). Memakai
-- IF EXISTS di semua langkah supaya aman dijalankan baik di DB yang baru di-reset (fungsi lama tidak
-- pernah ada) maupun di produksi (fungsi lama memang ada).

drop function if exists upsert_subscription(uuid, text, timestamptz, text);
-- DROP TABLE membawa serta policy (subscriptions_select) dan index-nya; tidak perlu DROP POLICY
-- terpisah (yang justru akan error "relation does not exist" kalau dijalankan saat tabel tak ada).
drop table if exists subscriptions;


-- ====================================================================
-- 00000000000021_household_features.sql
-- ====================================================================
-- 0021: feature flag opsional per household (10-fitur-opsional-keluarga.md §2).
-- Kosong ('{}') berarti semua fitur mati; aplikasi/API mengisi default di layer TS (HouseholdFeaturesSchema),
-- bukan di sini, supaya menambah fitur baru tidak butuh migrasi ALTER ulang untuk nilai default-nya.

alter table households add column features jsonb not null default '{}'::jsonb;

comment on column households.features is
  'Toggle fitur opsional "kelola keluarga" per household (10-fitur-opsional-keluarga.md §2). '
  'Kosong = semua mati. Bentuk divalidasi di packages/shared/src/schemas/household.ts (HouseholdFeaturesSchema), '
  'bukan di DB — kolom ini sengaja jsonb bebas supaya menambah fitur baru tidak perlu migrasi skema.';


-- ====================================================================
-- 00000000000022_beneficiaries.sql
-- ====================================================================
-- 0022: F-A dimensi "untuk siapa" (beneficiary) — 10-fitur-opsional-keluarga.md §3.
-- Fase 2 (budgets.beneficiary_id) sengaja BELUM dikerjakan (spec §3.6: baru kalau user memang
-- menganggarkan per orang).

create type beneficiary_kind as enum ('member', 'child', 'relative', 'property', 'other');

create table beneficiaries (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null check (length(name) between 1 and 60),
  kind          beneficiary_kind not null default 'other',
  member_id     uuid references household_members(id) on delete set null,
  aliases       text[] not null default '{}',
  icon          text not null default '👤',
  color         text not null default '#6366f1',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create unique index beneficiaries_household_name_idx on beneficiaries (household_id, lower(name)) where deleted_at is null;
create unique index beneficiaries_household_member_idx on beneficiaries (household_id, member_id) where member_id is not null and deleted_at is null;
create index beneficiaries_household_idx on beneficiaries (household_id) where deleted_at is null;
comment on column beneficiaries.member_id is
  'on delete set null (bukan default no action): remove_member() (Fase 5) harus tetap bisa menghapus '
  'member meski dia sudah di-seed sebagai beneficiary kind=member — baris beneficiary-nya bertahan '
  '(nama snapshot + riwayat transaksi lama tetap valid), hanya tautan ke household_members yang lepas. '
  'Bug nyata ditemukan 2026-10-07: tanpa ini, household.test.ts (hapus/merge member) gagal FK violation.';
comment on column beneficiaries.name is
  'Untuk kind=member, ini SNAPSHOT display_name saat seeding (tetap not null demi unique index) — '
  'API/resolver memakai coalesce(household_members.display_name, beneficiaries.name) lewat join, '
  'jadi member ganti nama tampilan tidak membuat beneficiary-nya basi.';
alter table beneficiaries enable row level security;
create policy beneficiaries_select on beneficiaries for select using (is_household_member(household_id));
create policy beneficiaries_write on beneficiaries for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create trigger beneficiaries_set_updated_at before update on beneficiaries for each row execute function set_updated_at();

alter table transactions add column beneficiary_id uuid references beneficiaries(id);
create index transactions_beneficiary_idx on transactions (household_id, beneficiary_id) where deleted_at is null and beneficiary_id is not null;
comment on column transactions.beneficiary_id is
  'Siapa/apa yang MENIKMATI pengeluaran ini (beda dari account.owner_member_id = uang siapa yang keluar, '
  'dan recorded_by_member_id = siapa yang mencatat). NULL = bersama/keluarga. Hanya relevan untuk '
  'expense/income, transfer tidak punya beneficiary (pindah dana, bukan pengeluaran).';

-- tx_same_household() (0003) memvalidasi account/to_account/category/recurring sama household; beneficiary
-- ikut divalidasi di sini supaya baris transaksi tidak pernah menunjuk beneficiary household lain.
create or replace function tx_same_household() returns trigger
language plpgsql as $$
declare v_hh uuid;
begin
  select household_id into v_hh from accounts where id = new.account_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"account_id","reason":"different_household"}';
  end if;
  if new.to_account_id is not null then
    select household_id into v_hh from accounts where id = new.to_account_id;
    if v_hh is distinct from new.household_id then
      raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"to_account_id","reason":"different_household"}';
    end if;
  end if;
  select household_id into v_hh from categories where id = new.category_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"category_id","reason":"different_household"}';
  end if;
  if new.recurring_id is not null then
    select household_id into v_hh from recurring_transactions where id = new.recurring_id;
    if v_hh is distinct from new.household_id then
      raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"recurring_id","reason":"different_household"}';
    end if;
  end if;
  if new.beneficiary_id is not null then
    select household_id into v_hh from beneficiaries where id = new.beneficiary_id;
    if v_hh is distinct from new.household_id then
      raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"beneficiary_id","reason":"different_household"}';
    end if;
  end if;
  return new;
end;
$$;

-- ── resolve_beneficiary (pola resolve_member, 0009) ──────────────────────────────────────────
create or replace function resolve_beneficiary(p_household_id uuid, p_query text)
returns jsonb language plpgsql as $$
declare v_name_query text := norm_text(p_query); v_candidates jsonb; v_count int;
begin
  select
    jsonb_agg(jsonb_build_object(
      'id', b.id,
      'name', coalesce(m.display_name, b.name),
      'kind', b.kind
    )),
    count(*)
  into v_candidates, v_count
  from beneficiaries b
  left join household_members m on m.id = b.member_id and m.deleted_at is null
  where b.household_id = p_household_id and b.deleted_at is null
    and (
      norm_text(coalesce(m.display_name, b.name)) = v_name_query
      or exists (select 1 from unnest(b.aliases) a where norm_text(a) = v_name_query)
      or (m.id is not null and exists (select 1 from unnest(m.aliases) a where norm_text(a) = v_name_query))
    );

  if v_count = 1 then return jsonb_build_object('status', 'ok', 'match', v_candidates->0); end if;
  if v_count is null or v_count = 0 then return jsonb_build_object('status', 'not_found', 'candidates', '[]'::jsonb); end if;
  return jsonb_build_object('status', 'ambiguous', 'candidates', v_candidates);
end;
$$;

-- ── enable_beneficiary_feature: dipanggil saat flag beneficiary dinyalakan pertama kali ─────
-- (service layer updateHousehold memanggil ini HANYA saat transisi false->true). SECURITY DEFINER
-- karena perlu insert lintas anggota tanpa bergantung pada role actor (pola 0016).
create or replace function enable_beneficiary_feature(p_household_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Fungsi public otomatis terekspos lewat PostgREST RPC (/rest/v1/rpc/...). Tanpa guard ini
  -- siapa pun yang login bisa menyemai beneficiaries ke household orang lain (pola guard sama
  -- dengan create_household 0016: SECURITY DEFINER wajib memeriksa auth.uid() sendiri).
  if not is_household_member(p_household_id) or member_role_in(p_household_id) <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  insert into beneficiaries (household_id, name, kind, member_id, icon)
  select household_id, display_name, 'member', id, '🧑'
  from household_members
  where household_id = p_household_id and deleted_at is null
  on conflict do nothing;
end;
$$;
grant execute on function enable_beneficiary_feature(uuid) to anon, authenticated, service_role;

-- ── post_transaction: tambah p_beneficiary_id (ganti signature -> drop dulu, pola 0013/0014) ──
drop function if exists post_transaction(uuid, uuid, tx_type, uuid, uuid, bigint, date, text, tx_source, uuid);

create or replace function post_transaction(
  p_household_id uuid, p_actor_member_id uuid, p_type tx_type, p_account_id uuid, p_category_id uuid,
  p_amount bigint, p_date date, p_note text, p_source tx_source, p_recurring_id uuid default null,
  p_beneficiary_id uuid default null
) returns transactions language plpgsql as $$
declare
  v_actor household_members; v_account accounts; v_category categories; v_balance bigint; v_tx transactions;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000000000 then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"amount"}';
  end if;
  if p_type = 'transfer' then
    raise exception using errcode = 'P0001', message = 'use_post_transfer';
  end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);

  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;
  if v_actor.role not in ('owner','member') then
    raise exception using errcode = 'P0001', message = 'insufficient_scope';
  end if;
  if not (v_account.visibility = 'shared' or v_account.owner_member_id = p_actor_member_id) then
    raise exception using errcode = 'P0001', message = 'forbidden_account';
  end if;

  select * into v_category from categories where id = p_category_id and household_id = p_household_id and deleted_at is null;
  if v_category is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  if v_category.system_key = 'transfer' then
    raise exception using errcode = 'P0001', message = 'category_reserved';
  end if;
  if p_type = 'income' and v_category.type not in ('income','both') then
    raise exception using errcode = 'P0001', message = 'category_type_mismatch';
  end if;
  if p_type = 'expense' and v_category.type not in ('expense','both') then
    raise exception using errcode = 'P0001', message = 'category_type_mismatch';
  end if;

  if p_beneficiary_id is not null and not exists (
    select 1 from beneficiaries where id = p_beneficiary_id and household_id = p_household_id and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'beneficiary_not_found';
  end if;

  if p_type = 'expense' then
    v_balance := account_balance(p_account_id);
    if v_balance < p_amount then
      raise exception using errcode = 'P0001', message = 'insufficient_funds',
        detail = jsonb_build_object('balance', v_balance, 'needed', p_amount, 'account_name', v_account.name)::text;
    end if;
  end if;

  insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source, recurring_id, beneficiary_id)
  values (p_household_id, p_type, p_amount, p_account_id, p_category_id, coalesce(nullif(p_note,''), v_category.name), p_date, p_actor_member_id, p_source, p_recurring_id, p_beneficiary_id)
  returning * into v_tx;

  return v_tx;
end;
$$;

-- ── post_transactions_batch: SIGNATURE TIDAK BERUBAH — beneficiary_id per item dibaca dari jsonb
-- `p_items` yang sudah ada, bukan parameter baru (tiap item struk bisa beneficiary berbeda). ────
create or replace function post_transactions_batch(
  p_household_id uuid, p_actor_member_id uuid, p_account_id uuid, p_date date, p_items jsonb, p_source tx_source
) returns setof transactions language plpgsql as $$
declare
  v_actor household_members; v_account accounts; v_total bigint := 0; v_item jsonb; v_cat_id uuid; v_cat categories;
  v_ben_id uuid;
begin
  if jsonb_array_length(p_items) = 0 then raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"items"}'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception using errcode = 'P0001', message = 'batch_too_large'; end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'amount')::bigint <= 0 then raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"items.amount"}'; end if;
    v_total := v_total + (v_item->>'amount')::bigint;
    v_cat_id := (v_item->>'category_id')::uuid;
    select * into v_cat from categories where id = v_cat_id and household_id = p_household_id and deleted_at is null;
    if v_cat is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
    v_ben_id := (v_item->>'beneficiary_id')::uuid;
    if v_ben_id is not null and not exists (select 1 from beneficiaries where id = v_ben_id and household_id = p_household_id and deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'beneficiary_not_found';
    end if;
  end loop;

  if account_balance(p_account_id) < v_total then
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(p_account_id), 'needed', v_total, 'account_name', v_account.name)::text;
  end if;

  return query
    insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source, beneficiary_id)
    select p_household_id, 'expense', (item->>'amount')::bigint, p_account_id, (item->>'category_id')::uuid,
           coalesce(nullif(item->>'note',''), ''), p_date, p_actor_member_id, p_source, (item->>'beneficiary_id')::uuid
    from jsonb_array_elements(p_items) as item
    returning *;
end;
$$;

-- ── update_transaction: SIGNATURE TIDAK BERUBAH — beneficiary_id dibaca dari p_patch (jsonb) ──
-- yang sudah ada. Key HADIR dengan null eksplisit -> kembali ke bersama; key TIDAK ADA -> tidak diubah.
create or replace function update_transaction(p_household_id uuid, p_actor_member_id uuid, p_id uuid, p_patch jsonb)
returns transactions language plpgsql as $$
declare
  v_actor household_members; v_orig transactions; v_new_amount bigint; v_new_type tx_type; v_new_account uuid;
  v_new_category uuid; v_new_date date; v_cat categories; v_result transactions; v_new_beneficiary uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_orig from transactions where id = p_id and household_id = p_household_id and deleted_at is null for update;
  if v_orig is null then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;

  if v_orig.type = 'transfer' then
    if (p_patch ? 'amount') or (p_patch ? 'type') or (p_patch ? 'account_id') then
      raise exception using errcode = 'P0001', message = 'transfer_edit_limited';
    end if;
    update transactions set note = coalesce(p_patch->>'note', note), date = coalesce((p_patch->>'date')::date, date), updated_at = now()
    where id = p_id returning * into v_result;
    return v_result;
  end if;

  v_new_amount := coalesce((p_patch->>'amount')::bigint, v_orig.amount);
  v_new_type := coalesce((p_patch->>'type')::tx_type, v_orig.type);
  v_new_account := coalesce((p_patch->>'account_id')::uuid, v_orig.account_id);
  v_new_category := coalesce((p_patch->>'category_id')::uuid, v_orig.category_id);
  v_new_date := coalesce((p_patch->>'date')::date, v_orig.date);
  if p_patch ? 'beneficiary_id' then
    v_new_beneficiary := (p_patch->>'beneficiary_id')::uuid;
  else
    v_new_beneficiary := v_orig.beneficiary_id;
  end if;

  if v_new_type = 'transfer' or v_orig.type = 'transfer' then
    raise exception using errcode = 'P0001', message = 'transfer_edit_limited';
  end if;

  perform id from accounts where id in (v_orig.account_id, v_new_account) order by id for update;

  select * into v_cat from categories where id = v_new_category and household_id = p_household_id and deleted_at is null;
  if v_cat is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  if v_new_type = 'income' and v_cat.type not in ('income','both') then raise exception using errcode='P0001', message='category_type_mismatch'; end if;
  if v_new_type = 'expense' and v_cat.type not in ('expense','both') then raise exception using errcode='P0001', message='category_type_mismatch'; end if;

  if v_new_beneficiary is not null and not exists (
    select 1 from beneficiaries where id = v_new_beneficiary and household_id = p_household_id and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'beneficiary_not_found';
  end if;

  update transactions set deleted_at = now() where id = p_id;

  if v_new_type = 'expense' and account_balance(v_new_account) < v_new_amount then
    update transactions set deleted_at = null where id = p_id;
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(v_new_account), 'needed', v_new_amount)::text;
  end if;

  update transactions set
    amount = v_new_amount, type = v_new_type, account_id = v_new_account, category_id = v_new_category,
    date = v_new_date, note = coalesce(p_patch->>'note', note), beneficiary_id = v_new_beneficiary,
    deleted_at = null, updated_at = now()
  where id = p_id returning * into v_result;

  return v_result;
end;
$$;


-- ====================================================================
-- 00000000000023_shopping_pantry.sql
-- ====================================================================
-- 0023: F-D belanja & pantry (10-fitur-opsional-keluarga.md §6). Fitur paling jauh dari keuangan
-- inti, opt-in lewat features.shopping_stock — saat mati tidak ada yang berubah di luar modul ini.

create type shopping_status as enum ('needed', 'bought', 'cancelled');
create type shopping_source as enum ('manual', 'suggested', 'receipt');
create type pantry_reason as enum ('purchase', 'consume', 'adjust', 'expired');
create type pantry_location as enum ('fridge', 'freezer', 'shelf', 'other');

-- urutan DDL: pantry_items dulu (shopping_items punya FK opsional ke sana)
create table pantry_items (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  name                text not null check (length(name) between 1 and 80),
  unit                text not null default 'pcs',
  qty                 numeric(12,3) not null default 0,
  min_qty             numeric(12,3),
  location            pantry_location not null default 'other',
  category            text,
  expires_at          date,
  expires_estimated   boolean not null default false,
  expiry_notified_on  date,
  aliases             text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create unique index pantry_items_household_name_idx on pantry_items (household_id, lower(name)) where deleted_at is null;
create index pantry_items_household_idx on pantry_items (household_id) where deleted_at is null;
create index pantry_items_expiring_idx on pantry_items (household_id, expires_at) where deleted_at is null and expires_at is not null and qty > 0;
comment on column pantry_items.expires_estimated is 'true = tanggal tebakan Hermes dari jenis barang (§6.6), bukan dari kemasan/user.';
comment on column pantry_items.expiry_notified_on is 'Tanggal terakhir pengingat kedaluwarsa dikirim — cegah spam harian (§6.6).';
alter table pantry_items enable row level security;
create policy pantry_items_select on pantry_items for select using (is_household_member(household_id));
create policy pantry_items_write on pantry_items for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create trigger pantry_items_set_updated_at before update on pantry_items for each row execute function set_updated_at();

create table shopping_items (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references households(id) on delete cascade,
  name                   text not null check (length(name) between 1 and 80),
  qty_text               text,
  notes                  text not null default '',
  status                 shopping_status not null default 'needed',
  source                 shopping_source not null default 'manual',
  added_by_member_id     uuid references household_members(id),
  pantry_item_id         uuid references pantry_items(id) on delete set null,
  bought_transaction_id  uuid references transactions(id) on delete set null,
  bought_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
create index shopping_items_open_idx on shopping_items (household_id, lower(name)) where status = 'needed' and deleted_at is null;
create index shopping_items_household_idx on shopping_items (household_id) where deleted_at is null;
alter table shopping_items enable row level security;
create policy shopping_items_select on shopping_items for select using (is_household_member(household_id));
create policy shopping_items_write on shopping_items for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create trigger shopping_items_set_updated_at before update on shopping_items for each row execute function set_updated_at();

create table pantry_movements (
  id              uuid primary key default gen_random_uuid(),
  pantry_item_id  uuid not null references pantry_items(id) on delete cascade,
  household_id    uuid not null references households(id) on delete cascade,
  delta           numeric(12,3) not null,
  reason          pantry_reason not null,
  transaction_id  uuid references transactions(id) on delete set null,
  member_id       uuid references household_members(id) on delete set null,
  note            text not null default '',
  created_at      timestamptz not null default now()
);
create index pantry_movements_item_idx on pantry_movements (pantry_item_id, created_at desc);
alter table pantry_movements enable row level security;
create policy pantry_movements_select on pantry_movements for select using (is_household_member(household_id));
create policy pantry_movements_write on pantry_movements for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

-- ── apply_pantry_movement: satu fungsi atomik update qty + insert riwayat (pola post_transaction) ──
create or replace function apply_pantry_movement(
  p_household_id uuid, p_actor_member_id uuid, p_pantry_item_id uuid, p_delta numeric, p_reason pantry_reason,
  p_transaction_id uuid default null, p_note text default ''
) returns pantry_items language plpgsql as $$
declare v_actor household_members; v_item pantry_items;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_item from pantry_items where id = p_pantry_item_id and household_id = p_household_id and deleted_at is null for update;
  if v_item is null then raise exception using errcode = 'P0001', message = 'pantry_item_not_found'; end if;

  insert into pantry_movements (pantry_item_id, household_id, delta, reason, transaction_id, member_id, note)
  values (p_pantry_item_id, p_household_id, p_delta, p_reason, p_transaction_id, p_actor_member_id, coalesce(p_note, ''));

  update pantry_items set qty = greatest(0, qty + p_delta), updated_at = now()
  where id = p_pantry_item_id returning * into v_item;

  return v_item;
end;
$$;

-- ── Pencocokan nama longgar (§6.2): dipakai alur struk (receipts/ingest) untuk mengaitkan nama
-- item struk ke pantry/shopping yang sudah ada. BUKAN pola resolve_* (jsonb ok/ambiguous/not_found)
-- — ini "tebakan terbaik atau tidak sama sekali" untuk best-effort matching, bukan validasi keras.
create or replace function find_pantry_match(p_household_id uuid, p_query text) returns uuid
language plpgsql as $$
declare v_norm text := norm_text(p_query); v_id uuid;
begin
  if v_norm = '' then return null; end if;

  select id into v_id from pantry_items
  where household_id = p_household_id and deleted_at is null
    and (norm_text(name) = v_norm or exists (select 1 from unnest(aliases) a where norm_text(a) = v_norm))
  limit 1;
  if v_id is not null then return v_id; end if;

  select id into v_id from pantry_items
  where household_id = p_household_id and deleted_at is null
    and (norm_text(name) like '%' || v_norm || '%' or v_norm like '%' || norm_text(name) || '%'
         or similarity(norm_text(name), v_norm) > 0.35
         or exists (select 1 from unnest(aliases) a where similarity(norm_text(a), v_norm) > 0.35))
  order by similarity(norm_text(name), v_norm) desc limit 1;
  return v_id;
end;
$$;

create or replace function find_shopping_match(p_household_id uuid, p_query text) returns uuid
language plpgsql as $$
declare v_norm text := norm_text(p_query); v_id uuid;
begin
  if v_norm = '' then return null; end if;

  select id into v_id from shopping_items
  where household_id = p_household_id and deleted_at is null and status = 'needed'
    and (norm_text(name) = v_norm or norm_text(name) like '%' || v_norm || '%' or v_norm like '%' || norm_text(name) || '%'
         or similarity(norm_text(name), v_norm) > 0.35)
  order by similarity(norm_text(name), v_norm) desc limit 1;
  return v_id;
end;
$$;

