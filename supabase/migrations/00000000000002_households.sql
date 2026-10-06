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
