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
