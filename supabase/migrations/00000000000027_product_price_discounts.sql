-- 0027: simpan potongan diskon per item struk di product_prices.
-- Prinsip:
--   - transactions.amount TETAP harga bersih yang dibayar (setelah diskon) agar saldo rekening 100% akurat.
--   - product_prices.discount menyimpan total potongan diskon baris struk tersebut (Rp, default 0).
--   - Dari (amount, qty, discount) otomatis diperoleh:
--       * unit_price        = amount / qty                  (harga satuan setelah diskon / yang dibayar)
--       * normal_unit_price = (amount + discount) / qty     (harga satuan asli/normal sebelum diskon)

alter table product_prices
  add column if not exists discount bigint not null default 0 check (discount >= 0);

comment on column product_prices.discount is 'Total potongan diskon baris struk (Rp, default 0). Harga asli total = amount + discount; harga satuan normal = (amount + discount) / qty.';

create or replace view v_product_prices as
select pp.id, pp.household_id, pp.transaction_id, pp.keyword, pp.base_name, pp.merchant, pp.merchant_key,
       pp.qty, pp.amount, pp.unit_price, pp.size_value, pp.size_unit, pp.date, pp.created_at,
       coalesce(pa.canonical_name, pk.canonical_name, pp.base_name) as product_name,
       product_key(coalesce(pa.canonical_name, pk.canonical_name, pp.base_name)) as product_key,
       case when pp.size_value > 0 then pp.unit_price / pp.size_value end as price_per_unit,
       pp.discount,
       round((pp.amount + pp.discount)::numeric / pp.qty, 2) as normal_unit_price
from product_prices pp
join transactions t on t.id = pp.transaction_id and t.deleted_at is null
left join product_aliases pa on pa.household_id = pp.household_id and pa.keyword = pp.keyword
left join product_knowledge pk on pk.keyword = pp.keyword;
alter view v_product_prices set (security_invoker = on);

create or replace function record_product_prices(p_household_id uuid, p_merchant text, p_date date, p_items jsonb)
returns int language plpgsql as $$
declare
  v_item jsonb;
  v_name text;
  v_kw text;
  v_amount bigint;
  v_qty numeric;
  v_discount bigint;
  v_p record;
  v_n int := 0;
begin
  if coalesce(trim(p_merchant), '') = '' then return 0; end if;
  if norm_text(p_merchant) in ('titipan', 'nombok', 'koreksi', 'transfer') then return 0; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := norm_text(v_item->>'name');
    v_amount := coalesce((v_item->>'amount')::bigint, 0);
    continue when length(v_name) < 2 or v_amount <= 0 or (v_item->>'transaction_id') is null;
    v_kw := item_keyword(v_name);
    v_p := parse_item_size(v_name);
    v_qty := coalesce(nullif(v_item->>'qty', '')::numeric, 1);
    if v_qty <= 0 then v_qty := 1; end if;
    if v_qty = 1 and v_p.multiplier > 1 then v_qty := v_p.multiplier; end if;
    v_discount := greatest(0, coalesce(nullif(v_item->>'discount', '')::bigint, 0));
    insert into product_prices (household_id, transaction_id, keyword, base_name, merchant, merchant_key, qty, amount, discount, unit_price, size_value, size_unit, date)
    values (p_household_id, (v_item->>'transaction_id')::uuid, v_kw, coalesce(nullif(v_p.base_name, ''), v_kw),
            left(trim(p_merchant), 80), merchant_key(p_merchant), v_qty, v_amount, v_discount, round(v_amount::numeric / v_qty, 2),
            v_p.size_value, v_p.size_unit, p_date)
    on conflict (transaction_id) do update set
      discount = greatest(product_prices.discount, excluded.discount);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
