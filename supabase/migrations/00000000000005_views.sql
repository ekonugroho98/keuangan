-- 0005: views saldo & agregat (03-database.md §4)

-- helper RLS (dipindah ke sini karena v_account_balances butuh can_view_account sebelum views dibuat)
create or replace function current_member_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from household_members where user_id = auth.uid() and deleted_at is null;
$$;

create or replace function current_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from household_members where user_id = auth.uid() and deleted_at is null;
$$;

create or replace function is_household_member(p_household_id uuid) returns boolean
language sql stable as $$ select p_household_id in (select current_household_ids()); $$;

create or replace function member_role_in(p_household_id uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from household_members where household_id = p_household_id and user_id = auth.uid() and deleted_at is null limit 1;
$$;

create or replace function can_view_account(p_account_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a
    where a.id = p_account_id
      and is_household_member(a.household_id)
      and (a.visibility = 'shared' or a.owner_member_id in (select current_member_ids()))
  );
$$;

create or replace function can_post_to_account(p_account_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a
    where a.id = p_account_id and a.deleted_at is null
      and member_role_in(a.household_id) in ('owner','member')
      and (a.visibility = 'shared' or a.owner_member_id in (select current_member_ids()))
  );
$$;


create or replace function account_balance(p_account_id uuid) returns bigint
language sql stable as $$
  select a.opening_balance
    + coalesce((select sum(amount) from transactions where deleted_at is null and account_id = a.id and type = 'income'), 0)
    - coalesce((select sum(amount) from transactions where deleted_at is null and account_id = a.id and type in ('expense','transfer')), 0)
    + coalesce((select sum(amount) from transactions where deleted_at is null and to_account_id = a.id and type = 'transfer'), 0)
  from accounts a where a.id = p_account_id;
$$;

create or replace view v_account_balances as
select
  a.id as account_id,
  a.household_id,
  case when can_view_account(a.id) then
    a.opening_balance
      + coalesce(sum(case when t.type = 'income'   and t.account_id    = a.id then t.amount end), 0)
      - coalesce(sum(case when t.type = 'expense'  and t.account_id    = a.id then t.amount end), 0)
      - coalesce(sum(case when t.type = 'transfer' and t.account_id    = a.id then t.amount end), 0)
      + coalesce(sum(case when t.type = 'transfer' and t.to_account_id = a.id then t.amount end), 0)
  else null end as balance,
  case when can_view_account(a.id) then count(t.id) filter (where t.id is not null) else null end as tx_count,
  case when can_view_account(a.id) then max(t.date) else null end as last_tx_date
from accounts a
left join transactions t
  on t.deleted_at is null and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;
alter view v_account_balances set (security_invoker = on);
comment on view v_account_balances is 'balance/tx_count/last_tx_date NULL kalau caller tidak can_view_account (akun privat milik orang lain) — defense in depth selain filtering di apps/api.';

create or replace view v_debts as
select d.*,
  greatest(0, d.total - d.opening_paid
    - coalesce((select sum(p.amount) from debt_payments p join transactions t on t.id = p.transaction_id where p.debt_id = d.id and t.deleted_at is null), 0)
    - coalesce((select sum(p.amount) from debt_payments p where p.debt_id = d.id and p.transaction_id is null), 0)
  ) as remaining
from debts d;
alter view v_debts set (security_invoker = on);

create or replace view v_goals as
select g.*,
  g.opening_amount
    + coalesce((select sum(c.amount) from goal_contributions c join transactions t on t.id = c.transaction_id where c.goal_id = g.id and t.deleted_at is null), 0)
    + coalesce((select sum(c.amount) from goal_contributions c where c.goal_id = g.id and c.transaction_id is null), 0)
    as current
from goals g;
alter view v_goals set (security_invoker = on);

create or replace view v_goals_full as
select g.*, (g.current >= g.target) as reached
from v_goals g;
alter view v_goals_full set (security_invoker = on);

create or replace view v_piutang as
select p.*,
  greatest(0, p.total - p.opening_received
    - coalesce((select sum(r.amount) from piutang_receipts r join transactions t on t.id = r.transaction_id where r.piutang_id = p.id and t.deleted_at is null), 0)
    - coalesce((select sum(r.amount) from piutang_receipts r where r.piutang_id = p.id and r.transaction_id is null), 0)
  ) as remaining
from piutang p;
alter view v_piutang set (security_invoker = on);

create or replace view v_transactions as
select
  t.*,
  a.name as account_name, a.owner_member_id as account_owner_member_id, a.visibility as account_visibility,
  ta.name as to_account_name, ta.owner_member_id as to_account_owner_member_id,
  c.name as category_name, c.icon as category_icon, c.color as category_color,
  rm.display_name as recorded_by_display_name
from transactions t
join accounts a on a.id = t.account_id
left join accounts ta on ta.id = t.to_account_id
join categories c on c.id = t.category_id
join household_members rm on rm.id = t.recorded_by_member_id
where t.deleted_at is null;
alter view v_transactions set (security_invoker = on);

create or replace function today_in_tz(p_household_id uuid) returns date
language sql stable as $$
  select (now() at time zone (select timezone from households where id = p_household_id))::date;
$$;
