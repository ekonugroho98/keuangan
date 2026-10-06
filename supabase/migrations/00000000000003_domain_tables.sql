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
