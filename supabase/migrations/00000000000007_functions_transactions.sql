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
