-- Seed household demo "Keluarga Eko" untuk dev & pengujian skenario (06-agent-integration.md §5)
-- Dijalankan otomatis oleh `supabase db reset`.

do $$
declare
  v_eko_user uuid := '00000000-0000-0000-0000-0000000000e0';
  v_rina_user uuid := '00000000-0000-0000-0000-0000000000e1';
  v_household uuid;
  v_m_eko uuid;
  v_m_rina uuid;
  v_acc_bca_eko uuid;
  v_acc_bca_rina uuid;
  v_acc_gopay_rina uuid;
  v_acc_cash_eko uuid;
  v_acc_joint uuid;
  v_cat_makanan uuid;
  v_debt_motor uuid;
  v_budget_makanan uuid;
  v_result jsonb;
begin
  -- user dummy di auth.users (hanya untuk dev lokal; di produksi user dibuat lewat Supabase Auth asli)
  insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
  values
    (v_eko_user, '00000000-0000-0000-0000-000000000000', 'eko@example.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Eko"}', 'authenticated', 'authenticated', now(), now()),
    (v_rina_user, '00000000-0000-0000-0000-000000000000', 'rina@example.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rina"}', 'authenticated', 'authenticated', now(), now())
  on conflict (id) do nothing;

  -- household via fungsi domain (menguji create_household + seed kategori)
  select (create_household('Keluarga Eko', 'Asia/Jakarta', 'Eko', v_eko_user)) into v_result;
  v_household := (v_result->'household'->>'id')::uuid;
  v_m_eko := (v_result->'member'->>'id')::uuid;

  update household_members set aliases = array['saya','suami','ayah','papa'] where id = v_m_eko;

  insert into household_members (household_id, user_id, display_name, role, aliases)
  values (v_household, v_rina_user, 'Rina', 'owner', array['istri','bunda','mama'])
  returning id into v_m_rina;

  insert into user_settings (user_id, active_household_id) values (v_rina_user, v_household)
    on conflict (user_id) do update set active_household_id = excluded.active_household_id;

  -- akun
  insert into accounts (household_id, owner_member_id, name, type, visibility, opening_balance, aliases) values
    (v_household, v_m_eko, 'BCA', 'bank', 'shared', 8000000, '{}') returning id into v_acc_bca_eko;
  insert into accounts (household_id, owner_member_id, name, type, visibility, opening_balance, aliases) values
    (v_household, v_m_rina, 'BCA', 'bank', 'shared', 4500000, '{}') returning id into v_acc_bca_rina;
  insert into accounts (household_id, owner_member_id, name, type, visibility, opening_balance, aliases) values
    (v_household, v_m_rina, 'GoPay', 'ewallet', 'shared', 1500000, '{}') returning id into v_acc_gopay_rina;
  insert into accounts (household_id, owner_member_id, name, type, visibility, opening_balance, aliases) values
    (v_household, v_m_eko, 'Cash', 'cash', 'shared', 200000, '{}') returning id into v_acc_cash_eko;
  insert into accounts (household_id, owner_member_id, name, type, visibility, opening_balance, aliases) values
    (v_household, null, 'Tabungan Bersama', 'tabungan', 'shared', 13500000, '{}') returning id into v_acc_joint;

  select id into v_cat_makanan from categories where household_id = v_household and name = 'Makanan';

  -- hutang
  insert into debts (household_id, owner_member_id, name, aliases, total, opening_paid, monthly, due_date)
  values (v_household, v_m_eko, 'Cicilan Motor', array['motor','cicilan motor'], 24000000, 14400000, 1200000, (today_in_tz(v_household) + interval '10 days')::date)
  returning id into v_debt_motor;

  -- budget household bulan ini
  insert into budgets (household_id, category_id, member_id, period_start, amount)
  values (v_household, v_cat_makanan, null, date_trunc('month', today_in_tz(v_household))::date, 3000000)
  returning id into v_budget_makanan;

  -- beberapa transaksi riwayat, DIMASUKKAN KRONOLOGIS (lama -> baru) karena saldo dihitung berjalan (ADR-05)
  -- bulan lalu untuk Rina (menguji scope=member period=last_month)
  perform post_transaction(v_household, v_m_rina, 'expense', v_acc_bca_rina, v_cat_makanan, 1900000, (date_trunc('month', today_in_tz(v_household)) - interval '1 month' + interval '5 days')::date, 'Belanja bulan lalu', 'web');
  perform post_transaction(v_household, v_m_rina, 'expense', v_acc_gopay_rina, (select id from categories where household_id=v_household and name='Transport'), 800000, (date_trunc('month', today_in_tz(v_household)) - interval '1 month' + interval '10 days')::date, 'Ojek bulan lalu', 'web');
  -- bulan ini
  perform post_transaction(v_household, v_m_eko, 'income', v_acc_bca_eko, (select id from categories where household_id = v_household and name='Gaji'), 12000000, date_trunc('month', today_in_tz(v_household))::date + 1, 'Gaji Oktober', 'web');
  perform post_transaction(v_household, v_m_rina, 'expense', v_acc_bca_rina, v_cat_makanan, 1245000, today_in_tz(v_household) - 3, 'Belanja bulanan', 'web');
  perform post_transaction(v_household, v_m_rina, 'expense', v_acc_gopay_rina, v_cat_makanan, 45000, today_in_tz(v_household), 'Kopi', 'web');
  perform post_transaction(v_household, v_m_eko, 'expense', v_acc_cash_eko, (select id from categories where household_id=v_household and name='Transport'), 25000, today_in_tz(v_household), 'Parkir', 'web');

  raise notice 'Seed selesai. household_id=%, eko_member=%, rina_member=%, debt_motor=%', v_household, v_m_eko, v_m_rina, v_debt_motor;
end $$;
