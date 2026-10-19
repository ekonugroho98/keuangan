-- ── 0030: Superadmin Dashboard Functions (Overview Metrics, Household List, Plan Management) ──
-- Seluruh fungsi menggunakan SECURITY DEFINER agar role `karaya_api` (setelah diverifikasi oleh
-- middleware `requireSuperadmin` di apps/api) dapat membaca metrik lintas-household & `auth.users`
-- serta mengelola paket (`plan_tier`, `plan_expires_at`, `entitlements`) dalam 1 round-trip DB.

-- 1. Ringkasan Metrik Utama (KPI Cards: Pertumbuhan, Paket, Aktivitas Transaksi, Kuota Struk & DB)
create or replace function public.admin_get_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_households jsonb;
  v_members jsonb;
  v_plans jsonb;
  v_transactions jsonb;
  v_storage_and_db jsonb;
  v_receipt_count bigint;
  v_receipt_count_7d bigint;
begin
  -- A. Pertumbuhan & Aktivitas Keluarga
  select jsonb_build_object(
    'total', count(*),
    'new_7d', count(*) filter (where h.created_at >= now() - interval '7 days'),
    'new_30d', count(*) filter (where h.created_at >= now() - interval '30 days'),
    'active_7d', count(*) filter (
      where exists (
        select 1 from public.transactions t
        where t.household_id = h.id
          and t.deleted_at is null
          and t.created_at >= now() - interval '7 days'
      )
    ),
    'multi_member_count', count(*) filter (
      where (
        select count(*) from public.household_members hm
        where hm.household_id = h.id and hm.deleted_at is null
      ) > 1
    )
  )
  into v_households
  from public.households h
  where h.deleted_at is null
    and h.merged_into_household_id is null;

  -- B. Total Anggota & Pengguna Unik
  select jsonb_build_object(
    'total_active', count(*),
    'unique_users', count(distinct hm.user_id)
  )
  into v_members
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.deleted_at is null
    and h.deleted_at is null
    and h.merged_into_household_id is null;

  -- C. Metrik Monetisasi & Paket (plan_tier & entitlements)
  select jsonb_build_object(
    'free_total', count(*) filter (where h.plan_tier = 'free'),
    'pro_active', count(*) filter (
      where h.plan_tier = 'pro'
        and (h.plan_expires_at is null or h.plan_expires_at > now())
    ),
    'pro_expiring_7d', count(*) filter (
      where h.plan_tier = 'pro'
        and h.plan_expires_at is not null
        and h.plan_expires_at > now()
        and h.plan_expires_at <= now() + interval '7 days'
    ),
    'pro_expired', count(*) filter (
      where h.plan_tier = 'pro'
        and h.plan_expires_at is not null
        and h.plan_expires_at <= now()
    ),
    'lifetime_total', count(*) filter (where h.plan_tier = 'lifetime'),
    'custom_entitlements_count', count(*) filter (
      where h.entitlements is not null and h.entitlements <> '{}'::jsonb
    )
  )
  into v_plans
  from public.households h
  where h.deleted_at is null
    and h.merged_into_household_id is null;

  -- D. Aktivitas Transaksi & Breakdown Sumber
  select
    jsonb_build_object(
      'total', count(*),
      'today', count(*) filter (
        where t.created_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')
      ),
      'last_7d', count(*) filter (where t.created_at >= now() - interval '7 days'),
      'last_30d', count(*) filter (where t.created_at >= now() - interval '30 days'),
      'by_source', jsonb_build_object(
        'web', count(*) filter (where t.source = 'web'),
        'api_key', count(*) filter (where t.source = 'api_key'),
        'recurring', count(*) filter (where t.source = 'recurring'),
        'other', count(*) filter (where t.source not in ('web', 'api_key', 'recurring'))
      )
    ),
    count(*) filter (where t.receipt_url is not null and t.receipt_url <> ''),
    count(*) filter (
      where t.receipt_url is not null
        and t.receipt_url <> ''
        and t.created_at >= now() - interval '7 days'
    )
  into v_transactions, v_receipt_count, v_receipt_count_7d
  from public.transactions t
  join public.households h on h.id = t.household_id
  where t.deleted_at is null
    and h.deleted_at is null
    and h.merged_into_household_id is null;

  -- E. Pemakaian Kuota Struk Cloud (~80 KB/struk WebP) & Kesehatan Tabel DB
  v_storage_and_db := jsonb_build_object(
    'receipt_count', coalesce(v_receipt_count, 0),
    'receipt_count_7d', coalesce(v_receipt_count_7d, 0),
    'estimated_receipt_kb', coalesce(v_receipt_count, 0) * 80,
    'quota_limit_kb', 1048576,
    'table_rows', jsonb_build_object(
      'transactions', (select count(*) from public.transactions),
      'product_prices', (select count(*) from public.product_prices),
      'product_knowledge', (select count(*) from public.product_knowledge),
      'idempotency_keys', (select count(*) from public.idempotency_keys),
      'expired_idempotency_keys', (
        select count(*) from public.idempotency_keys
        where created_at < now() - interval '7 days'
      ),
      'audit_log', (select count(*) from public.audit_log),
      'api_keys_active', (
        select count(*) from public.api_keys
        where revoked_at is null
          and (expires_at is null or expires_at > now())
      )
    )
  );

  return jsonb_build_object(
    'households', v_households,
    'members', v_members,
    'plans', v_plans,
    'transactions', v_transactions,
    'storage_and_db', v_storage_and_db
  );
end;
$$;

-- 2. Daftar Keluarga & User beserta Anggota (auth.users.email) dan Statistik Pemakaian
create or replace function public.admin_list_households(
  p_search text default null,
  p_plan_tier text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
  v_tier text := nullif(lower(trim(coalesce(p_plan_tier, ''))), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 100), 250));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_items jsonb;
begin
  if v_tier = 'all' then
    v_tier := null;
  end if;

  with filtered as (
    select h.*
    from public.households h
    where h.deleted_at is null
      and h.merged_into_household_id is null
      and (
        v_tier is null
        or (v_tier = 'expired' and h.plan_tier = 'pro' and h.plan_expires_at is not null and h.plan_expires_at <= now())
        or (v_tier in ('free', 'pro', 'lifetime') and h.plan_tier = v_tier)
      )
      and (
        v_q is null
        or h.name ilike '%' || v_q || '%'
        or h.id::text ilike '%' || v_q || '%'
        or exists (
          select 1
          from public.household_members hm
          left join auth.users u on u.id = hm.user_id
          where hm.household_id = h.id
            and hm.deleted_at is null
            and (
              hm.display_name ilike '%' || v_q || '%'
              or coalesce(u.email, '') ilike '%' || v_q || '%'
            )
        )
      )
  ),
  counted as (
    select count(*) as total from filtered
  ),
  enriched as (
    select
      f.id,
      f.name,
      f.timezone,
      f.plan_tier,
      f.plan_expires_at,
      f.entitlements,
      f.features,
      f.created_at,
      f.updated_at,
      coalesce(m.members, '[]'::jsonb) as members,
      jsonb_build_object(
        'tx_total', coalesce(tx.tx_total, 0),
        'tx_web', coalesce(tx.tx_web, 0),
        'tx_api_key', coalesce(tx.tx_api_key, 0),
        'tx_recurring', coalesce(tx.tx_recurring, 0),
        'tx_7d', coalesce(tx.tx_7d, 0),
        'receipt_count', coalesce(tx.receipt_count, 0),
        'last_tx_at', tx.last_tx_at,
        'active_api_keys', coalesce(ak.active_api_keys, 0),
        'last_api_key_used_at', ak.last_api_key_used_at
      ) as stats,
      tx.last_tx_at as sort_last_tx_at
    from filtered f
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', hm.id,
          'user_id', hm.user_id,
          'display_name', hm.display_name,
          'email', u.email,
          'role', hm.role,
          'color', hm.color,
          'joined_at', hm.joined_at
        )
        order by hm.joined_at asc
      ) as members
      from public.household_members hm
      left join auth.users u on u.id = hm.user_id
      where hm.household_id = f.id
        and hm.deleted_at is null
    ) m on true
    left join lateral (
      select
        count(*) as tx_total,
        count(*) filter (where t.source = 'web') as tx_web,
        count(*) filter (where t.source = 'api_key') as tx_api_key,
        count(*) filter (where t.source = 'recurring') as tx_recurring,
        count(*) filter (where t.created_at >= now() - interval '7 days') as tx_7d,
        count(*) filter (where t.receipt_url is not null and t.receipt_url <> '') as receipt_count,
        max(t.created_at) as last_tx_at
      from public.transactions t
      where t.household_id = f.id
        and t.deleted_at is null
    ) tx on true
    left join lateral (
      select
        count(*) filter (
          where k.revoked_at is null
            and (k.expires_at is null or k.expires_at > now())
        ) as active_api_keys,
        max(k.last_used_at) as last_api_key_used_at
      from public.api_keys k
      where k.household_id = f.id
    ) ak on true
    order by coalesce(tx.last_tx_at, f.created_at) desc, f.created_at desc
    limit v_limit offset v_offset
  )
  select
    (select total from counted),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'name', e.name,
            'timezone', e.timezone,
            'plan_tier', e.plan_tier,
            'plan_expires_at', e.plan_expires_at,
            'entitlements_override', coalesce(e.entitlements, '{}'::jsonb),
            'features', e.features,
            'created_at', e.created_at,
            'updated_at', e.updated_at,
            'members', e.members,
            'stats', e.stats
          )
        )
        from enriched e
      ),
      '[]'::jsonb
    )
  into v_total, v_items;

  return jsonb_build_object(
    'total', coalesce(v_total, 0),
    'items', v_items
  );
end;
$$;

-- 3. Update Paket & Override Entitlements Keluarga oleh Superadmin
create or replace function public.admin_update_household_plan(
  p_household_id uuid,
  p_plan_tier text default null,
  p_plan_expires_at timestamptz default null,
  p_clear_expires_at boolean default false,
  p_entitlements jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.households;
begin
  if p_plan_tier is not null and p_plan_tier not in ('free', 'pro', 'lifetime') then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"plan_tier"}';
  end if;

  update public.households
  set
    plan_tier = coalesce(p_plan_tier, plan_tier),
    plan_expires_at = case
      when p_clear_expires_at then null
      when p_plan_expires_at is not null then p_plan_expires_at
      else plan_expires_at
    end,
    entitlements = case
      when p_entitlements is not null then jsonb_strip_nulls(coalesce(entitlements, '{}'::jsonb) || p_entitlements)
      else entitlements
    end,
    updated_at = now()
  where id = p_household_id
    and deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'plan_tier', v_row.plan_tier,
    'plan_expires_at', v_row.plan_expires_at,
    'entitlements_override', coalesce(v_row.entitlements, '{}'::jsonb),
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.admin_get_overview() to karaya_api, authenticated, service_role;
grant execute on function public.admin_list_households(text, text, integer, integer) to karaya_api, authenticated, service_role;
grant execute on function public.admin_update_household_plan(uuid, text, timestamptz, boolean, jsonb) to karaya_api, authenticated, service_role;
