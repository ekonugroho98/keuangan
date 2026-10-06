-- 0009: resolve_account/category/member, next_recurring_date, run_due_recurrings, bump_rate_limit (03 §8.3, 06 §4)

create or replace function norm_text(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(lower(unaccent(coalesce(p,''))), '\s+', ' ', 'g'));
$$;

create or replace function resolve_account(p_household_id uuid, p_actor_member_id uuid, p_query text, p_prefer_own boolean default false)
returns jsonb language plpgsql as $$
declare
  v_norm text := norm_text(p_query);
  v_owner_filter uuid; v_is_joint boolean := false; v_name_query text;
  v_candidates jsonb; v_top_score numeric; v_count int;
  v_member record; v_alias text; v_matched_member_count int := 0;
begin
  v_name_query := v_norm;

  if v_norm ~ '\y(saya|aku|gue|gw|ku)\y' then
    v_owner_filter := p_actor_member_id;
    v_name_query := trim(regexp_replace(v_name_query, '\y(saya|aku|gue|gw|ku)\y', '', 'g'));
  elsif v_norm ~ '\y(bersama|joint|keluarga|rumah|kita)\y' then
    v_is_joint := true;
    v_name_query := trim(regexp_replace(v_name_query, '\y(bersama|joint|keluarga|rumah|kita)\y', '', 'g'));
  else
    for v_member in select id, display_name, aliases from household_members where household_id = p_household_id and deleted_at is null loop
      if v_norm ~ ('\y' || norm_text(v_member.display_name) || '\y') then
        v_matched_member_count := v_matched_member_count + 1;
        v_owner_filter := v_member.id;
        v_name_query := trim(regexp_replace(v_name_query, '\y' || norm_text(v_member.display_name) || '\y', '', 'g'));
      else
        foreach v_alias in array v_member.aliases loop
          if v_alias <> '' and v_norm ~ ('\y' || norm_text(v_alias) || '\y') then
            v_matched_member_count := v_matched_member_count + 1;
            v_owner_filter := v_member.id;
            v_name_query := trim(regexp_replace(v_name_query, '\y' || norm_text(v_alias) || '\y', '', 'g'));
            exit;
          end if;
        end loop;
      end if;
    end loop;
    if v_matched_member_count > 1 then
      return jsonb_build_object('status', 'ambiguous', 'candidates', '[]'::jsonb, 'reason', 'multiple_owners_in_query');
    end if;
  end if;
  v_name_query := trim(regexp_replace(v_name_query, '\s+', ' ', 'g'));

  with scored as (
    select a.id, a.name, a.visibility, a.owner_member_id, m.display_name as owner_display_name,
      greatest(
        case when norm_text(a.name) = v_name_query or exists (select 1 from unnest(a.aliases) al where norm_text(al) = v_name_query) then 100 else 0 end,
        case when v_name_query <> '' and (norm_text(a.name) like v_name_query || '%' or v_name_query like norm_text(a.name) || '%') and length(v_name_query) >= 3 then 75 else 0 end,
        case when v_name_query <> '' and norm_text(a.name) like '%' || v_name_query || '%' then 70 else 0 end,
        case when v_name_query <> '' then round((similarity(norm_text(a.name), v_name_query) * 100)::numeric, 0) else 0 end
      ) as score,
      case when v_name_query <> '' then similarity(norm_text(a.name), v_name_query) else 0 end as sim
    from accounts a
    left join household_members m on m.id = a.owner_member_id
    where a.household_id = p_household_id and a.deleted_at is null
      and (v_owner_filter is null or a.owner_member_id = v_owner_filter)
      and (not v_is_joint or a.owner_member_id is null)
  ),
  agg as (select coalesce(max(score) filter (where score >= 45), -1) as top_score from scored)
  select
    nullif((select top_score from agg), -1),
    (select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
        'owner', case when s.owner_member_id is null then null else jsonb_build_object('member_id', s.owner_member_id, 'display_name', s.owner_display_name) end,
        'visibility', s.visibility, 'score', s.score))
     from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45),
    (select count(*) from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45)
  into v_top_score, v_candidates, v_count;

  if v_top_score is null then
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'owner', case when owner_member_id is null then null else jsonb_build_object('member_id', owner_member_id, 'display_name', owner_display_name) end))
    into v_candidates
    from (
      select a.id, a.name, a.owner_member_id, m.display_name as owner_display_name,
             similarity(norm_text(a.name), v_name_query) as sim
      from accounts a left join household_members m on m.id = a.owner_member_id
      where a.household_id = p_household_id and a.deleted_at is null
        and (v_owner_filter is null or a.owner_member_id = v_owner_filter)
        and (not v_is_joint or a.owner_member_id is null)
      order by sim desc limit 3
    ) s;
    return jsonb_build_object('status', 'not_found', 'candidates', coalesce(v_candidates, '[]'::jsonb));
  end if;

  if v_count = 1 then
    return jsonb_build_object('status', 'ok', 'match', v_candidates->0);
  end if;

  if p_prefer_own then
    declare v_own jsonb;
    begin
      select jsonb_agg(c) into v_own from jsonb_array_elements(v_candidates) c where (c->'owner'->>'member_id')::uuid = p_actor_member_id;
      if v_own is not null and jsonb_array_length(v_own) = 1 then
        return jsonb_build_object('status', 'ok', 'match', v_own->0);
      end if;
    end;
  end if;

  return jsonb_build_object('status', 'ambiguous', 'candidates', v_candidates);
end;
$$;

create or replace function resolve_category(p_household_id uuid, p_query text, p_type tx_type default null)
returns jsonb language plpgsql as $$
declare v_name_query text := norm_text(p_query); v_top_score numeric; v_candidates jsonb; v_count int;
begin
  with scored as (
    select c.id, c.name, c.icon, c.color, c.type,
      greatest(
        case when norm_text(c.name) = v_name_query or exists (select 1 from unnest(c.aliases) al where norm_text(al) = v_name_query) then 100 else 0 end,
        case when v_name_query <> '' and norm_text(c.name) like v_name_query || '%' and length(v_name_query) >= 2 then 75 else 0 end,
        case when v_name_query <> '' then round((similarity(norm_text(c.name), v_name_query) * 100)::numeric, 0) else 0 end
      ) as score
    from categories c
    where c.household_id = p_household_id and c.deleted_at is null and c.system_key is distinct from 'transfer'
      and (p_type is null or c.type::text in (p_type::text, 'both'))
  ),
  agg as (select coalesce(max(score) filter (where score >= 45), -1) as top_score from scored)
  select
    nullif((select top_score from agg), -1),
    (select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon, 'color', s.color, 'score', s.score))
     from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45),
    (select count(*) from scored s, agg where s.score >= agg.top_score - 10 and s.score >= 45)
  into v_top_score, v_candidates, v_count;

  if v_top_score is null then
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'icon', icon)) into v_candidates
    from (
      select c.id, c.name, c.icon, similarity(norm_text(c.name), v_name_query) as sim
      from categories c
      where c.household_id = p_household_id and c.deleted_at is null and c.system_key is distinct from 'transfer'
        and (p_type is null or c.type::text in (p_type::text, 'both'))
      order by sim desc limit 3
    ) s;
    return jsonb_build_object('status', 'not_found', 'candidates', coalesce(v_candidates, '[]'::jsonb));
  end if;

  if v_count = 1 then return jsonb_build_object('status', 'ok', 'match', v_candidates->0); end if;
  return jsonb_build_object('status', 'ambiguous', 'candidates', v_candidates);
end;
$$;

create or replace function resolve_member(p_household_id uuid, p_query text)
returns jsonb language plpgsql as $$
declare v_name_query text := norm_text(p_query); v_candidates jsonb; v_count int;
begin
  select jsonb_agg(jsonb_build_object('id', id, 'display_name', display_name)), count(*)
  into v_candidates, v_count
  from household_members
  where household_id = p_household_id and deleted_at is null
    and (norm_text(display_name) = v_name_query or exists (select 1 from unnest(aliases) a where norm_text(a) = v_name_query));

  if v_count = 1 then return jsonb_build_object('status', 'ok', 'match', v_candidates->0); end if;
  if v_count is null or v_count = 0 then return jsonb_build_object('status', 'not_found', 'candidates', '[]'::jsonb); end if;
  return jsonb_build_object('status', 'ambiguous', 'candidates', v_candidates);
end;
$$;

create or replace function next_recurring_date(p_from date, p_freq recurring_frequency, p_anchor_day smallint)
returns date language plpgsql immutable as $$
declare v_next date; v_last_day int;
begin
  if p_freq = 'daily' then return p_from + interval '1 day'; end if;
  if p_freq = 'weekly' then return p_from + interval '7 days'; end if;
  if p_freq = 'monthly' then
    v_next := date_trunc('month', p_from) + interval '1 month';
    v_last_day := extract(day from (v_next + interval '1 month - 1 day'));
    return v_next + (least(coalesce(p_anchor_day, extract(day from p_from)::int), v_last_day) - 1) * interval '1 day';
  end if;
  if p_freq = 'yearly' then
    begin
      return (p_from + interval '1 year')::date;
    exception when others then
      return (date_trunc('year', p_from) + interval '1 year' + interval '58 days')::date; -- fallback 29 Feb -> 28 Feb
    end;
  end if;
  return p_from;
end;
$$;

create or replace function run_due_recurrings(p_household_id uuid default null, p_today date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rec record; v_today date; v_skipped jsonb := '[]'::jsonb; v_executed int := 0; v_claims text; v_iter int;
  v_user_id uuid; v_tx transactions; v_cat_id uuid;
begin
  for v_rec in
    select * from recurring_transactions
    where active and deleted_at is null
      and (p_household_id is null or household_id = p_household_id)
      and next_date <= coalesce(p_today, today_in_tz(household_id))
  loop
    select user_id into v_user_id from household_members where id = v_rec.member_id;
    v_claims := json_build_object('sub', v_user_id, 'role', 'authenticated')::text;
    perform set_config('request.jwt.claims', v_claims, true);

    v_iter := 0;
    v_today := coalesce(p_today, today_in_tz(v_rec.household_id));
    <<catchup>>
    while v_rec.next_date <= v_today and v_iter < (case when v_rec.frequency = 'daily' then 7 else 31 end) loop
      v_iter := v_iter + 1;
      begin
        if exists (select 1 from transactions where recurring_id = v_rec.id and date = v_rec.next_date and deleted_at is null) then
          v_rec.next_date := next_recurring_date(v_rec.next_date, v_rec.frequency, v_rec.anchor_day);
          continue;
        end if;

        v_tx := post_transaction(v_rec.household_id, v_rec.member_id, v_rec.type, v_rec.account_id, v_rec.category_id,
                  v_rec.amount, v_rec.next_date, v_rec.name, 'recurring', v_rec.id);

        if v_rec.debt_id is not null then
          select id into v_cat_id from categories where household_id = v_rec.household_id and system_key = 'debt_payment';
          insert into debt_payments (debt_id, transaction_id, member_id, amount, date, note)
          values (v_rec.debt_id, v_tx.id, v_rec.member_id, v_rec.amount, v_rec.next_date, v_rec.name);
        end if;

        v_executed := v_executed + 1;
        v_rec.next_date := next_recurring_date(v_rec.next_date, v_rec.frequency, v_rec.anchor_day);
        update recurring_transactions set next_date = v_rec.next_date, last_run_at = now(), last_error = null, updated_at = now()
        where id = v_rec.id;
      exception when others then
        update recurring_transactions set last_error = sqlerrm, updated_at = now() where id = v_rec.id;
        v_skipped := v_skipped || jsonb_build_object('recurring_id', v_rec.id, 'name', v_rec.name, 'reason', sqlerrm);
        exit catchup;
      end;
    end loop;

    perform set_config('request.jwt.claims', '', true);
  end loop;

  return jsonb_build_object('executed', v_executed, 'skipped', v_skipped);
end;
$$;

create or replace function bump_rate_limit(p_api_key_id uuid, p_minute_limit int, p_day_limit int)
returns table(allowed boolean, remaining_minute int, remaining_day int, reset_at timestamptz)
language plpgsql as $$
declare v_minute_start timestamptz := date_trunc('minute', now()); v_day_start timestamptz := date_trunc('day', now());
        v_minute_count int; v_day_count int;
begin
  insert into rate_limit_counters (api_key_id, window_kind, window_start, count)
  values (p_api_key_id, 'minute', v_minute_start, 1)
  on conflict (api_key_id, window_kind, window_start) do update set count = rate_limit_counters.count + 1
  returning count into v_minute_count;

  insert into rate_limit_counters (api_key_id, window_kind, window_start, count)
  values (p_api_key_id, 'day', v_day_start, 1)
  on conflict (api_key_id, window_kind, window_start) do update set count = rate_limit_counters.count + 1
  returning count into v_day_count;

  return query select
    (v_minute_count <= p_minute_limit and v_day_count <= p_day_limit),
    greatest(0, p_minute_limit - v_minute_count),
    greatest(0, p_day_limit - v_day_count),
    v_minute_start + interval '1 minute';
end;
$$;
