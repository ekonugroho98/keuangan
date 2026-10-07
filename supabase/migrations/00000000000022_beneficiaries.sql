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
