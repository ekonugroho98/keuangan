-- 0012: Perbaikan bug — debt_payments/goal_contributions/piutang_receipts punya RLS aktif
-- (migrasi 0010) tapi hanya diberi policy SELECT. Baris-baris ini HANYA pernah di-insert oleh
-- fungsi plpgsql (pay_debt, topup_goal, receive_piutang, run_due_recurrings), yang berjalan
-- dengan hak akses PEMANGGIL (bukan SECURITY DEFINER) sejak apps/api melakukan
-- `SET LOCAL ROLE authenticated` per request (03-database.md §7.1). Tanpa policy INSERT,
-- `insert into debt_payments ...` di dalam pay_debt() gagal dengan 42501 (permission denied)
-- begitu dipanggil sebagai role `authenticated` sungguhan — baru ditemukan di Fase 3 saat
-- menguji lewat apps/api; lolos di Fase 2 karena saat itu diuji sebagai superuser `postgres`
-- yang bypass RLS. Lihat docs/spec/PROGRESS.md untuk detail.

create policy debt_payments_insert on debt_payments for insert
  with check (exists (
    select 1 from debts d where d.id = debt_id
      and is_household_member(d.household_id)
      and member_role_in(d.household_id) in ('owner','member')
  ));

create policy goal_contrib_insert on goal_contributions for insert
  with check (exists (
    select 1 from goals g where g.id = goal_id
      and is_household_member(g.household_id)
      and member_role_in(g.household_id) in ('owner','member')
  ));

create policy piutang_receipts_insert on piutang_receipts for insert
  with check (exists (
    select 1 from piutang p where p.id = piutang_id
      and is_household_member(p.household_id)
      and member_role_in(p.household_id) in ('owner','member')
  ));
