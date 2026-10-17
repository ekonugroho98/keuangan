-- 0026: Perbaiki urutan update di merge_household_into agar trigger tx_same_household()
-- tidak gagal ketika household asal sudah memiliki transaksi (baik kategori biasa maupun sistem).

create or replace function merge_household_into(p_source_household_id uuid, p_target_household_id uuid, p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_moved jsonb := '{}'::jsonb;
  v_n int;
begin
  if p_source_household_id = p_target_household_id then return v_moved; end if;

  -- 1. Pindahkan kategori non-sistem yang belum punya padanan nama di household tujuan
  update categories c_src
  set household_id = p_target_household_id
  where c_src.household_id = p_source_household_id
    and c_src.deleted_at is null
    and not c_src.is_system
    and not exists (
      select 1 from categories c_target
      where c_target.household_id = p_target_household_id
        and c_target.deleted_at is null
        and lower(unaccent(c_target.name)) = lower(unaccent(c_src.name))
    );

  -- 2. Pindahkan akun terlebih dahulu agar pengecekan account_id di trigger tx_same_household() lolos
  select count(*) into v_n from accounts where household_id = p_source_household_id and deleted_at is null;
  update accounts
  set household_id = p_target_household_id,
      owner_member_id = p_member_id
  where household_id = p_source_household_id;
  v_moved := v_moved || jsonb_build_object('accounts', v_n);

  -- 3. Pindahkan transaksi sekaligus petakan ulang category_id ke kategori target dalam 1 UPDATE atomik
  --    sehingga trigger BEFORE UPDATE tx_same_household() melihat account, category, dan member
  --    semuanya sudah berada di p_target_household_id.
  update transactions t
  set household_id = p_target_household_id,
      recorded_by_member_id = p_member_id,
      category_id = coalesce(
        (
          select c_target.id
          from categories c_src
          join categories c_target
            on c_target.household_id = p_target_household_id
           and c_target.deleted_at is null
           and (
             (c_src.is_system and c_target.system_key = c_src.system_key)
             or (not c_src.is_system and not c_target.is_system and lower(unaccent(c_target.name)) = lower(unaccent(c_src.name)))
           )
          where c_src.id = t.category_id
          limit 1
        ),
        t.category_id
      )
  where t.household_id = p_source_household_id;
  get diagnostics v_n = row_count;
  v_moved := v_moved || jsonb_build_object('transactions', v_n);

  -- 4. Pindahkan entitas lain & petakan ulang category_id untuk budget dan recurring_transactions
  update budgets b
  set household_id = p_target_household_id,
      member_id = p_member_id,
      category_id = coalesce(
        (
          select c_target.id
          from categories c_src
          join categories c_target
            on c_target.household_id = p_target_household_id
           and c_target.deleted_at is null
           and lower(unaccent(c_target.name)) = lower(unaccent(c_src.name))
          where c_src.id = b.category_id
          limit 1
        ),
        b.category_id
      )
  where b.household_id = p_source_household_id and b.deleted_at is null;

  update recurring_transactions r
  set household_id = p_target_household_id,
      member_id = p_member_id,
      category_id = coalesce(
        (
          select c_target.id
          from categories c_src
          join categories c_target
            on c_target.household_id = p_target_household_id
           and c_target.deleted_at is null
           and lower(unaccent(c_target.name)) = lower(unaccent(c_src.name))
          where c_src.id = r.category_id
          limit 1
        ),
        r.category_id
      )
  where r.household_id = p_source_household_id and r.deleted_at is null;

  -- Soft-delete sisa kategori di source household yang sudah dipetakan ke target
  update categories set deleted_at = now() where household_id = p_source_household_id and deleted_at is null;

  update goals set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update debts set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update piutang set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update investments set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update split_bills set household_id = p_target_household_id, created_by_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;

  update households set deleted_at = now(), merged_into_household_id = p_target_household_id where id = p_source_household_id;

  return v_moved;
end;
$$;
