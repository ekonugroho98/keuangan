-- Fase 6 (F6-T1): api_keys hanya punya policy SELECT sejak F2 (00000000000010_rls.sql) — membuat
-- atau mencabut key butuh fungsi SECURITY DEFINER baru, pola sama persis dengan
-- create_invitation/remove_member (Fase 5): validasi otorisasi internal dulu, baru tulis,
-- supaya tidak terkena default-deny RLS saat dipanggil sebagai role authenticated sungguhan.
--
-- Pembuatan/hashing key (kf_live_...) terjadi di TypeScript (API_KEY_PEPPER adalah secret
-- aplikasi, bukan secret DB) — fungsi ini hanya menerima key_hash yang sudah dihitung dan
-- menyisipkannya, setelah menegakkan dua aturan dari 05-api.md §3.2:
--   1. Member hanya boleh membuat key untuk DIRINYA SENDIRI; owner boleh untuk siapa pun.
--   2. Scope key tidak boleh melebihi scope efektif peran target member (owner→admin,
--      member→write, viewer→read) — "member bisa membuat key untuk dirinya dengan scope <= role".
create or replace function role_to_scope(p_role member_role) returns api_key_scope
language sql immutable as $$
  select case p_role when 'owner' then 'admin'::api_key_scope when 'member' then 'write'::api_key_scope else 'read'::api_key_scope end;
$$;

create or replace function scope_rank(p_scope api_key_scope) returns int
language sql immutable as $$
  select case p_scope when 'admin' then 3 when 'write' then 2 else 1 end;
$$;

create or replace function create_api_key(
  p_household_id uuid, p_actor_member_id uuid, p_name text, p_target_member_id uuid,
  p_scope api_key_scope, p_key_prefix text, p_key_hash bytea, p_expires_at timestamptz
)
returns api_keys language plpgsql security definer set search_path = public as $$
declare v_actor household_members; v_target household_members; v_row api_keys;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;

  select * into v_target from household_members where id = p_target_member_id and household_id = p_household_id and deleted_at is null;
  if v_target is null then raise exception using errcode = 'P0001', message = 'member_not_found'; end if;

  if v_target.id <> v_actor.id and v_actor.role <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden_owner';
  end if;
  if scope_rank(p_scope) > scope_rank(role_to_scope(v_target.role)) then
    raise exception using errcode = 'P0001', message = 'scope_exceeds_role';
  end if;

  insert into api_keys (household_id, member_id, name, key_prefix, key_hash, scope, expires_at, created_by)
  values (p_household_id, p_target_member_id, p_name, p_key_prefix, p_key_hash, p_scope, p_expires_at, p_actor_member_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function revoke_api_key(p_household_id uuid, p_actor_member_id uuid, p_key_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor household_members; v_key api_keys;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;

  select * into v_key from api_keys where id = p_key_id and household_id = p_household_id;
  if v_key is null then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  if v_key.member_id <> v_actor.id and v_actor.role <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden_owner';
  end if;

  update api_keys set revoked_at = now() where id = p_key_id and revoked_at is null;
end;
$$;

grant execute on function create_api_key(uuid, uuid, text, uuid, api_key_scope, text, bytea, timestamptz) to authenticated;
grant execute on function revoke_api_key(uuid, uuid, uuid) to authenticated;

-- Bug nyata ditemukan saat uji manual F6-T1 (POST /v1/api-keys sukses di DB tapi response 403):
-- 2 penyebab terpisah ditemukan di request yang sama.
-- (1) audit_log punya RLS enabled sejak F2 dengan policy SELECT (owner-only) tapi TIDAK PERNAH
--     punya policy INSERT — auditMiddleware (Fase 6, menulis SETIAP request) selalu 42501 saat
--     insert. Grant langsung ke karaya_api di migrasi 0010 TIDAK cukup: role biasa (non-superuser,
--     tanpa BYPASSRLS) tetap tunduk RLS walau punya table-level privilege.
create policy audit_log_insert on audit_log for insert with check (is_household_member(household_id));

-- (2) v_api_keys dibuat dengan security_invoker = on (migrasi 0010) — niatnya supaya RLS tetap
--     dievaluasi per-pemanggil, TAPI efek sampingnya: akses ke TABEL DASAR api_keys di belakang
--     view JUGA dievaluasi dengan privilege pemanggil (authenticated), yang SELECT-nya sengaja
--     di-REVOKE penuh di baris yang sama persis. Hasilnya: SIAPA PUN yang query v_api_keys selalu
--     "permission denied for table api_keys", termasuk lewat GET /v1/api-keys yang justru dibuat
--     untuk itu. Pola standar Postgres untuk "expose kolom terbatas dari tabel yang direvoke" adalah
--     view BIASA (security_invoker OFF, default): akses ke tabel dasar dicek pakai privilege PEMILIK
--     VIEW (jadi revoke di tabel dasar tidak menghalangi), SEMENTARA row-level security policy tetap
--     dievaluasi pakai auth.uid() sesi pemanggil (ini perilaku khusus Postgres untuk view+RLS,
--     didokumentasikan resmi) — jadi household-scoping tidak hilang. security_invoker=on di sini
--     adalah kesalahan desain F2, bukan kehati-hatian yang disengaja.
alter view v_api_keys set (security_invoker = off);

-- (3) resolveApiKeyActor (auth/api-key.ts) butuh join api_keys + household_members SEBELUM
--     SET LOCAL ROLE authenticated (sama seperti lookup hash api_keys sendiri, 03-database.md §7.4:
--     "lookup hash sebelum SET ROLE") untuk tahu role/user_id pemilik key — tapi karaya_api belum
--     pernah di-grant akses apa pun ke household_members (sengaja, itu tabel domain yang harusnya
--     hanya lewat role authenticated+RLS). Select sempit 3 kolom yang dibutuhkan, meniru pola
--     grant api_keys yang sudah ada (granular, bukan akses penuh tabel domain).
grant select (id, user_id, role, deleted_at) on household_members to karaya_api;

-- (3b) Grant kolom di atas TIDAK CUKUP: household_members punya RLS enabled dengan hanya policy
--      SELECT yang butuh auth.uid() (is_household_member) — pada titik resolveApiKeyActor berjalan
--      BELUM ada JWT claims sama sekali (justru itu tujuannya: cari tahu siapa dulu dari hash key),
--      jadi auth.uid() null dan RLS menyaring SEMUA baris walau grant kolom sudah ada. Pola yang
--      benar (sama seperti look-up kredensial lain di sistem ini): bungkus SATU fungsi SECURITY
--      DEFINER yang melakukan JOIN api_keys+household_members dengan privilese dinaikkan, dipanggil
--      langsung oleh karaya_api tanpa SET ROLE — menggantikan query JOIN mentah di TypeScript.
create or replace function resolve_api_key(p_key_hash bytea)
returns table (
  id uuid, household_id uuid, member_id uuid, user_id uuid, scope api_key_scope,
  expires_at timestamptz, revoked_at timestamptz, member_deleted_at timestamptz, member_role member_role
)
language sql security definer set search_path = public as $$
  select k.id, k.household_id, k.member_id, m.user_id, k.scope, k.expires_at, k.revoked_at,
         m.deleted_at, m.role
  from api_keys k join household_members m on m.id = k.member_id
  where k.key_hash = p_key_hash;
$$;

grant execute on function resolve_api_key(bytea) to karaya_api;

-- (3c) touchLastUsed (auth/api-key.ts) — UPDATE last_used_at/last_used_ip oleh karaya_api langsung
--      juga kena RLS (api_keys hanya punya policy SELECT, UPDATE default-deny) meski sudah ada
--      grant UPDATE kolom sempit di migrasi 0010. Function kecil SECURITY DEFINER, best-effort
--      (dipanggil fire-and-forget, kegagalan tidak boleh menggagalkan request utama).
create or replace function touch_api_key_last_used(p_id uuid, p_ip inet)
returns void language sql security definer set search_path = public as $$
  update api_keys set last_used_at = now(), last_used_ip = p_ip where id = p_id;
$$;

grant execute on function touch_api_key_last_used(uuid, inet) to karaya_api;
