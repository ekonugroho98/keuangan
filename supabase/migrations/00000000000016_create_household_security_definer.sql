-- Bug ditemukan saat verifikasi manual Fase 4: households tidak punya INSERT policy sama sekali
-- (hanya select+update, lihat 00000000000010_rls.sql), jadi create_household() yang berjalan
-- sebagai role `authenticated` SELALU gagal dengan 42501/forbidden untuk SETIAP user baru — alur
-- onboarding (POST /v1/households, dipakai OnboardingHousehold.jsx) belum pernah benar-benar bisa
-- jalan sejak dibuat. Household memang belum ada saat fungsi ini dipanggil, jadi tidak ada baris
-- untuk dicek is_household_member/member_role_in — pola yang sama seperti fungsi onboarding
-- lain butuh security definer. Guard p_user_id = auth.uid() ditambah supaya user A tidak bisa
-- membuatkan household atas nama user B lewat parameter ini.
create or replace function create_household(p_name text, p_timezone text, p_display_name text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_household households; v_member household_members;
begin
  if p_user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

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

grant execute on function create_household(text, text, text, uuid) to anon, authenticated, service_role;
