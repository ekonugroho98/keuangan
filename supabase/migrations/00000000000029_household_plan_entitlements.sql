-- ── 0029: Fondasi Paid Feature (Plan Tier & Entitlements) + Auto-Cleanup Idempotency Keys ──
-- 1. Kolom paket langganan & override fitur per-household di tabel public.households:
--    - plan_tier: 'free' | 'pro' | 'lifetime' (default 'pro' untuk masa early-adopter)
--    - plan_expires_at: batas aktif paket 'pro' (NULL = aktif selamanya)
--    - entitlements: JSONB override per fitur (mis. {"api_access": true, "price_compare": true})
--      untuk jual add-on satuan / unlock khusus per keluarga.

alter table public.households
  add column if not exists plan_tier text not null default 'pro'
    check (plan_tier in ('free', 'pro', 'lifetime')),
  add column if not exists plan_expires_at timestamptz null,
  add column if not exists entitlements jsonb not null default '{}'::jsonb;

comment on column public.households.plan_tier is
  'Tier paket household: free (fitur inti manual), pro (semua fitur keluarga & AI bot), lifetime (permanen tanpa batas waktu).';

comment on column public.households.plan_expires_at is
  'Batas waktu aktif untuk plan_tier = pro. Jika NULL maka aktif selamanya.';

comment on column public.households.entitlements is
  'Override boolean per fitur berbayar (api_access, receipt_storage, price_compare, multi_member, shopping_stock, beneficiary, excel_export).';

-- Set household yang sudah ada saat ini (termasuk household internal Kara) menjadi 'lifetime'
update public.households
set plan_tier = 'lifetime',
    plan_expires_at = null
where plan_tier = 'pro';

-- 2. Indeks & fungsi pembersih otomatis idempotency_keys (> 7 hari) agar kuota DB 500 MB tetap lega
create index if not exists idx_idempotency_keys_created_at
  on public.idempotency_keys (created_at);

create or replace function public.cleanup_expired_idempotency_keys(
  p_older_than interval default interval '7 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.idempotency_keys
  where created_at < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_expired_idempotency_keys(interval) to karaya_api, authenticated, service_role;
