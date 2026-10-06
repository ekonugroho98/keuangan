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
