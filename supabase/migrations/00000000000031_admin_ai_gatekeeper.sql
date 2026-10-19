-- ── 0031: Superadmin AI Config Summary & Zero-Setup Gatekeeper Key Injection per Household ──
-- Memperkaya `admin_list_households` dengan status konfigurasi AI per keluarga (`ai_config_summary`)
-- serta menyediakan fungsi `admin_get_household_ai_context` dan `admin_set_household_ai_key` agar
-- Superadmin dapat meng-inject API key Token Gatekeeper (`sk-kb-*`) ke seluruh anggota keluarga
-- tanpa user perlu copy-paste key manual (Zero-Setup).

-- 1. Perbarui `admin_list_households` agar menyertakan `ai_config_summary` & status AI per member
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
      coalesce(
        m.ai_config_summary,
        jsonb_build_object(
          'configured_members', 0,
          'total_members', 0,
          'provider', null,
          'model', null,
          'is_gatekeeper', false,
          'key_prefix', null
        )
      ) as ai_config_summary,
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
      select
        jsonb_agg(
          jsonb_build_object(
            'id', hm.id,
            'user_id', hm.user_id,
            'display_name', hm.display_name,
            'email', u.email,
            'role', hm.role,
            'color', hm.color,
            'joined_at', hm.joined_at,
            'has_ai_key', (
              coalesce(trim(us.ai_config->>'apiKey'), '') <> ''
              and not coalesce((us.ai_config->>'disabled')::boolean, false)
            ),
            'ai_provider', case
              when coalesce(trim(us.ai_config->>'apiKey'), '') like 'sk-kb-%' then 'gatekeeper'
              else nullif(trim(coalesce(us.ai_config->>'provider', '')), '')
            end
          )
          order by hm.joined_at asc
        ) as members,
        jsonb_build_object(
          'configured_members', count(*) filter (
            where coalesce(trim(us.ai_config->>'apiKey'), '') <> ''
              and not coalesce((us.ai_config->>'disabled')::boolean, false)
          ),
          'total_members', count(*),
          'provider', (
            array_agg(
              case
                when coalesce(trim(us.ai_config->>'apiKey'), '') like 'sk-kb-%' then 'gatekeeper'
                else nullif(trim(coalesce(us.ai_config->>'provider', '')), '')
              end
              order by (coalesce(trim(us.ai_config->>'apiKey'), '') like 'sk-kb-%') desc, hm.joined_at asc
            ) filter (
              where coalesce(trim(us.ai_config->>'apiKey'), '') <> ''
                and not coalesce((us.ai_config->>'disabled')::boolean, false)
            )
          )[1],
          'model', (
            array_agg(
              nullif(trim(coalesce(us.ai_config->>'model', '')), '')
              order by (coalesce(trim(us.ai_config->>'apiKey'), '') like 'sk-kb-%') desc, hm.joined_at asc
            ) filter (
              where coalesce(trim(us.ai_config->>'apiKey'), '') <> ''
                and not coalesce((us.ai_config->>'disabled')::boolean, false)
            )
          )[1],
          'is_gatekeeper', bool_or(
            (
              coalesce(trim(us.ai_config->>'apiKey'), '') like 'sk-kb-%'
              or lower(coalesce(us.ai_config->>'provider', '')) = 'gatekeeper'
            )
            and coalesce(trim(us.ai_config->>'apiKey'), '') <> ''
            and not coalesce((us.ai_config->>'disabled')::boolean, false)
          ),
          'key_prefix', (
            array_agg(
              case
                when length(trim(coalesce(us.ai_config->>'apiKey', ''))) > 14 then
                  left(trim(us.ai_config->>'apiKey'), 10) || '...' || right(trim(us.ai_config->>'apiKey'), 4)
                when length(trim(coalesce(us.ai_config->>'apiKey', ''))) > 0 then
                  left(trim(us.ai_config->>'apiKey'), 4) || '...'
                else null
              end
              order by (coalesce(trim(us.ai_config->>'apiKey'), '') like 'sk-kb-%') desc, hm.joined_at asc
            ) filter (
              where coalesce(trim(us.ai_config->>'apiKey'), '') <> ''
                and not coalesce((us.ai_config->>'disabled')::boolean, false)
            )
          )[1]
        ) as ai_config_summary
      from public.household_members hm
      left join auth.users u on u.id = hm.user_id
      left join public.user_settings us on us.user_id = hm.user_id
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
            'ai_config_summary', e.ai_config_summary,
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

-- 2. Ambil konteks AI & daftar email anggota suatu household untuk sinkronisasi alias Gatekeeper
create or replace function public.admin_get_household_ai_context(
  p_household_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hh public.households;
  v_emails jsonb;
  v_member_count int;
  v_existing_gk_key text;
begin
  select * into v_hh
  from public.households
  where id = p_household_id
    and deleted_at is null;

  if v_hh.id is null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  select
    coalesce(
      jsonb_agg(distinct lower(trim(u.email))) filter (where u.email is not null and trim(u.email) <> ''),
      '[]'::jsonb
    ),
    count(*),
    (
      array_agg(trim(us.ai_config->>'apiKey') order by hm.joined_at asc)
      filter (
        where coalesce(trim(us.ai_config->>'apiKey'), '') like 'sk-kb-%'
      )
    )[1]
  into v_emails, v_member_count, v_existing_gk_key
  from public.household_members hm
  left join auth.users u on u.id = hm.user_id
  left join public.user_settings us on us.user_id = hm.user_id
  where hm.household_id = p_household_id
    and hm.deleted_at is null;

  return jsonb_build_object(
    'id', v_hh.id,
    'name', v_hh.name,
    'plan_tier', v_hh.plan_tier,
    'member_count', coalesce(v_member_count, 0),
    'member_emails', coalesce(v_emails, '[]'::jsonb),
    'existing_gatekeeper_key', v_existing_gk_key
  );
end;
$$;

-- 3. Auto-inject API key AI (mis. `sk-kb-*` dari Token Gatekeeper) ke seluruh anggota aktif household
create or replace function public.admin_set_household_ai_key(
  p_household_id uuid,
  p_api_key text,
  p_provider text default 'gatekeeper',
  p_model text default 'kb-auto'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := trim(coalesce(p_api_key, ''));
  v_provider text := coalesce(nullif(lower(trim(coalesce(p_provider, ''))), ''), 'gatekeeper');
  v_model text := coalesce(nullif(trim(coalesce(p_model, '')), ''), 'kb-auto');
  v_updated_count integer := 0;
  v_prefix text;
begin
  if not exists (
    select 1 from public.households where id = p_household_id and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  if v_key = '' then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"api_key"}';
  end if;

  insert into public.user_settings (
    user_id,
    active_household_id,
    app_name,
    app_tagline,
    ai_config,
    updated_at
  )
  select
    hm.user_id,
    p_household_id,
    'Keluarga Berkembang',
    'Berkembang Bersama dalam Kehangatan',
    jsonb_build_object(
      'provider', v_provider,
      'model', v_model,
      'apiKey', v_key,
      'disabled', false
    ),
    now()
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.deleted_at is null
  on conflict (user_id) do update set
    ai_config = coalesce(public.user_settings.ai_config, '{}'::jsonb) || jsonb_build_object(
      'provider', v_provider,
      'model', v_model,
      'apiKey', v_key,
      'disabled', false
    ),
    updated_at = now();

  get diagnostics v_updated_count = row_count;

  v_prefix := case
    when length(v_key) > 14 then left(v_key, 10) || '...' || right(v_key, 4)
    else left(v_key, 4) || '...'
  end;

  return jsonb_build_object(
    'household_id', p_household_id,
    'updated_members', v_updated_count,
    'provider', v_provider,
    'model', v_model,
    'key_prefix', v_prefix
  );
end;
$$;

grant execute on function public.admin_list_households(text, text, integer, integer) to karaya_api, authenticated, service_role;
grant execute on function public.admin_get_household_ai_context(uuid) to karaya_api, authenticated, service_role;
grant execute on function public.admin_set_household_ai_key(uuid, text, text, text) to karaya_api, authenticated, service_role;
