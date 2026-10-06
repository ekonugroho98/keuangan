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
