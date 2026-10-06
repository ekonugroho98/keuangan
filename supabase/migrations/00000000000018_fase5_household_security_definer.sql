-- Fase 5 (F5-T1): sama seperti bug create_household di migrasi 0016 — household_members dan
-- household_invitations hanya punya policy SELECT (lihat 00000000000010_rls.sql), jadi fungsi
-- yang menulis ke keduanya (create_invitation, accept_invitation, remove_member,
-- change_member_role, merge_household_into) akan SELALU gagal 42501 kalau dipanggil lewat role
-- `authenticated` sungguhan. Kelimanya sudah punya pengecekan otorisasi internal sendiri
-- (actor_mismatch, role owner, dst.) — SECURITY DEFINER aman dipakai di sini karena validasi
-- terjadi SEBELUM statement tulis apa pun, pola yang sama dengan member_role_in/can_view_account.
-- remove_member diubah lewat CREATE OR REPLACE di bawah (sekalian perbaikan guard self-leave).
alter function create_invitation(uuid, uuid, text, member_role, text) security definer set search_path = public;
alter function accept_invitation(text, uuid, text, text) security definer set search_path = public;
alter function change_member_role(uuid, uuid, uuid, member_role) security definer set search_path = public;
alter function merge_household_into(uuid, uuid, uuid) security definer set search_path = public;

-- Revoke undangan (DELETE /v1/invitations/{id}) adalah update status satu kolom oleh owner —
-- tidak perlu fungsi plpgsql terpisah, cukup policy UPDATE yang sepadan dengan invitations_select.
create policy invitations_update on household_invitations for update using (member_role_in(household_id) = 'owner');

-- remove_member() awalnya mewajibkan actor role='owner' tanpa kecuali — cocok untuk DELETE
-- /v1/members/{id} (hapus ANGGOTA LAIN, memang owner-only), tapi salah untuk POST
-- /v1/members/me/leave (anggota non-owner keluar dari household sendiri, memang harus boleh).
-- Guard diganti: non-owner tetap ditolak kalau menargetkan ORANG LAIN, tapi boleh menargetkan
-- diri sendiri (self-leave) berapa pun rolenya — aturan bisnis lain (last_owner, reassign_required)
-- di bawahnya tetap berlaku sama persis untuk kedua jalur.
create or replace function remove_member(p_household_id uuid, p_actor_member_id uuid, p_member_id uuid, p_reassign_to_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor household_members; v_target household_members; v_owner_count int; v_account_count int;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then raise exception using errcode = 'P0001', message = 'actor_mismatch'; end if;
  if v_actor.role <> 'owner' and p_actor_member_id <> p_member_id then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

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

-- household_members juga butuh policy UPDATE: PATCH /v1/members/{id} (display_name/aliases/color,
-- BUKAN role — itu lewat change_member_role SECURITY DEFINER) menulis langsung dari service layer,
-- bukan lewat fungsi plpgsql. Tanpa policy ini, UPDATE diam-diam 0 baris (RLS default-deny untuk
-- UPDATE bukan error 42501, jadi muncul sebagai member_not_found yang menyesatkan).
create policy members_update on household_members for update using (user_id = auth.uid() or member_role_in(household_id) = 'owner');

-- Bug nyata ditemukan saat uji manual leave+rejoin (F5-T1): household_members_household_id_user_id_key
-- adalah UNIQUE CONSTRAINT biasa (bukan partial index), jadi anggota yang keluar (soft-delete,
-- deleted_at diisi) lalu diundang lagi SELALU gagal 23505 saat accept_invitation insert baris baru —
-- constraint tidak tahu baris lama sudah "dihapus". Pola yang benar sudah ada di
-- household_members_active_name_uq (partial, where deleted_at is null); constraint user_id
-- seharusnya sama sejak awal.
alter table household_members drop constraint household_members_household_id_user_id_key;
create unique index household_members_household_user_active_uq
  on household_members (household_id, user_id) where deleted_at is null;
