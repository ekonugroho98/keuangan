-- 0010: Row Level Security (03-database.md §7)

alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invitations enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table goal_contributions enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table piutang enable row level security;
alter table piutang_receipts enable row level security;
alter table recurring_transactions enable row level security;
alter table split_bills enable row level security;
alter table split_bill_members enable row level security;
alter table investments enable row level security;
alter table api_keys enable row level security;
alter table audit_log enable row level security;
alter table user_settings enable row level security;
alter table subscriptions enable row level security;

-- households
create policy households_select on households for select using (is_household_member(id));
create policy households_update on households for update using (member_role_in(id) = 'owner');

-- household_members
create policy members_select on household_members for select using (is_household_member(household_id));

-- household_invitations
create policy invitations_select on household_invitations for select using (member_role_in(household_id) = 'owner');

-- categories
create policy categories_select on categories for select using (is_household_member(household_id));
create policy categories_write on categories for insert with check (member_role_in(household_id) = 'owner');
create policy categories_update on categories for update using (member_role_in(household_id) = 'owner');

-- accounts (semua member lihat baris; saldo privat disaring di aplikasi/view)
create policy accounts_select on accounts for select using (is_household_member(household_id));
create policy accounts_insert on accounts for insert with check (member_role_in(household_id) in ('owner','member'));
create policy accounts_update on accounts for update
  using (member_role_in(household_id) = 'owner' or owner_member_id in (select current_member_ids()));

-- transactions
create policy tx_select on transactions for select
  using (is_household_member(household_id) and (can_view_account(account_id) or (to_account_id is not null and can_view_account(to_account_id))));
create policy tx_insert on transactions for insert
  with check (can_post_to_account(account_id) and (to_account_id is null or is_household_member(household_id)));
create policy tx_update on transactions for update using (can_post_to_account(account_id));

-- budgets, goals, debts, piutang, recurring, split_bills, investments: pola umum baca household, tulis owner/member
create policy budgets_select on budgets for select using (is_household_member(household_id));
create policy budgets_write on budgets for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

create policy goals_select on goals for select using (is_household_member(household_id));
create policy goals_write on goals for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy goal_contrib_select on goal_contributions for select using (exists (select 1 from goals g where g.id = goal_id and is_household_member(g.household_id)));

create policy debts_select on debts for select using (is_household_member(household_id));
create policy debts_write on debts for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy debt_payments_select on debt_payments for select using (exists (select 1 from debts d where d.id = debt_id and is_household_member(d.household_id)));

create policy piutang_select on piutang for select using (is_household_member(household_id));
create policy piutang_write on piutang for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy piutang_receipts_select on piutang_receipts for select using (exists (select 1 from piutang p where p.id = piutang_id and is_household_member(p.household_id)));

create policy recurring_select on recurring_transactions for select using (is_household_member(household_id));
create policy recurring_write on recurring_transactions for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

create policy split_bills_select on split_bills for select using (is_household_member(household_id));
create policy split_bills_write on split_bills for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create policy split_bill_members_select on split_bill_members for select using (exists (select 1 from split_bills b where b.id = bill_id and is_household_member(b.household_id)));
create policy split_bill_members_write on split_bill_members for all
  using (exists (select 1 from split_bills b where b.id = bill_id and member_role_in(b.household_id) in ('owner','member')))
  with check (exists (select 1 from split_bills b where b.id = bill_id and member_role_in(b.household_id) in ('owner','member')));

create policy investments_select on investments for select using (is_household_member(household_id));
create policy investments_write on investments for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

-- api_keys: key_hash TIDAK BOLEH terbaca oleh authenticated. Revoke kolom saja TIDAK CUKUP karena
-- Supabase memberi GRANT ALL level-tabel ke authenticated/anon by default (ALTER DEFAULT PRIVILEGES
-- platform), dan grant level-tabel mengalahkan revoke level-kolom. Solusi: revoke SELECT penuh dari
-- tabel dasar, hanya expose lewat view yang tidak menyertakan key_hash.
revoke select on api_keys from authenticated, anon;
create policy api_keys_select on api_keys for select using (is_household_member(household_id));

create or replace view v_api_keys as
select id, household_id, member_id, name, key_prefix, scope, expires_at, last_used_at, last_used_ip, revoked_at, created_by, created_at
from api_keys;
alter view v_api_keys set (security_invoker = on);
grant select on v_api_keys to authenticated;

-- audit_log: hanya owner
create policy audit_log_select on audit_log for select using (member_role_in(household_id) = 'owner');

-- user_settings, subscriptions: tetap per auth.uid()
create policy user_settings_own on user_settings using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy subscriptions_select on subscriptions for select using (auth.uid() = user_id);

-- ── role backend ──────────────────────────────────────────────────────────
do $$ begin
  create role karaya_api login password 'change_me_in_production' noinherit;
exception when duplicate_object then null; end $$;
grant authenticated to karaya_api;
grant usage on schema public to karaya_api;
grant select, insert, update, delete on idempotency_keys, rate_limit_counters, audit_log, migration_issues to karaya_api;
grant select on api_keys to karaya_api;
grant update (last_used_at, last_used_ip) on api_keys to karaya_api;
grant execute on function bump_rate_limit(uuid,int,int) to karaya_api;
grant usage, select on all sequences in schema public to karaya_api;
