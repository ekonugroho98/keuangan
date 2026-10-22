-- 0032: F-C Rekonsiliasi Mutasi Bank (10-fitur-opsional-keluarga.md §5)
-- Menyimpan impor mutasi bank (CSV BCA/BRI/Mandiri/GoPay, AI Vision screenshot, atau input manual)
-- beserta hasil pencocokan deterministik terhadap transaksi Karaya.

do $$ begin
  create type statement_source as enum ('bca_csv', 'bri_csv', 'mandiri_csv', 'gopay_csv', 'vision', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statement_match_status as enum ('unmatched', 'suggested', 'matched', 'created', 'ignored');
exception when duplicate_object then null; end $$;

create table if not exists statement_imports (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references households(id) on delete cascade,
  account_id            uuid not null references accounts(id) on delete cascade,
  source                statement_source not null,
  filename              text,
  imported_by_member_id uuid references household_members(id) on delete set null,
  period_from           date,
  period_to             date,
  line_count            int not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists statement_imports_household_idx on statement_imports (household_id, created_at desc);
create index if not exists statement_imports_account_idx on statement_imports (account_id, created_at desc);

alter table statement_imports enable row level security;
drop policy if exists statement_imports_select on statement_imports;
create policy statement_imports_select on statement_imports for select using (is_household_member(household_id));
drop policy if exists statement_imports_write on statement_imports;
create policy statement_imports_write on statement_imports for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

create table if not exists statement_lines (
  id                     uuid primary key default gen_random_uuid(),
  import_id              uuid not null references statement_imports(id) on delete cascade,
  household_id           uuid not null references households(id) on delete cascade,
  account_id             uuid not null references accounts(id) on delete cascade,
  date                   date not null,
  amount                 bigint not null check (amount > 0),
  direction              text not null check (direction in ('in','out')),
  description            text not null default '',
  ref_no                 text,
  balance_after          bigint,
  seq                    smallint not null default 1,
  fingerprint            text not null,
  match_status           statement_match_status not null default 'unmatched',
  matched_transaction_id uuid references transactions(id) on delete set null,
  match_confidence       smallint,
  created_at             timestamptz not null default now(),
  unique (account_id, fingerprint)
);

create index if not exists statement_lines_import_idx on statement_lines (import_id, date desc, created_at asc);
create index if not exists statement_lines_household_status_idx on statement_lines (household_id, match_status);
create index if not exists statement_lines_account_date_idx on statement_lines (account_id, date desc);

alter table statement_lines enable row level security;
drop policy if exists statement_lines_select on statement_lines;
create policy statement_lines_select on statement_lines for select using (is_household_member(household_id));
drop policy if exists statement_lines_write on statement_lines;
create policy statement_lines_write on statement_lines for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

grant select, insert, update, delete on statement_imports, statement_lines to authenticated, karaya_api;
