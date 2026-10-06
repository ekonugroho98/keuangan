-- 0013: Tambah parameter p_opening_received ke lend_piutang (Fase 4 — ditemukan saat migrasi
-- frontend: form PiutangView lama mengizinkan mencatat piutang yang sebagian sudah diterima
-- sebelum mulai dicatat di app, setara `debts.opening_paid` yang sudah ada sejak awal untuk hutang).
drop function if exists lend_piutang(uuid, uuid, text, bigint, uuid, uuid, date, text, date);

create or replace function lend_piutang(
  p_household_id uuid, p_actor_member_id uuid, p_borrower_name text, p_total bigint,
  p_from_account_id uuid, p_owner_member_id uuid, p_due_date date, p_notes text, p_date date,
  p_opening_received bigint default 0
)
returns jsonb language plpgsql as $$
declare v_actor household_members; v_piutang piutang; v_tx transactions; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  insert into piutang (household_id, owner_member_id, borrower_name, total, opening_received, from_account_id, due_date, notes)
  values (p_household_id, coalesce(p_owner_member_id, p_actor_member_id), p_borrower_name, p_total, greatest(0, coalesce(p_opening_received, 0)), p_from_account_id, p_due_date, coalesce(p_notes,''))
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
