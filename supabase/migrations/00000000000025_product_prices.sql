-- 0025: perbandingan harga produk antar toko.
-- Masalah: nama kasir beda tiap toko ("LFBY BS 85G" di Indomaret, "LIFEBUOY SABUN 85GR" di Alfamart) dan
-- ukuran kemasan beda (85 g vs 110 g). Tiga lapis:
--   (1) identitas produk kanonik — product_knowledge.canonical_name (global, diisi AI/pencarian web:
--       "lifebuoy sabun batang", TANPA ukuran) + product_aliases (koreksi manual per household).
--       product_key() = token kanonik diurutkan, jadi urutan kata tidak berpengaruh.
--   (2) riwayat harga per toko — product_prices, diisi otomatis saat struk dicatat (ingest/batch web).
--   (3) banding per satuan — ukuran diurai dari nama item (parse_item_size) jadi g/ml/pcs.

alter table product_knowledge add column canonical_name text check (canonical_name is null or length(canonical_name) between 2 and 120);
comment on column product_knowledge.canonical_name is 'Nama produk kanonik TANPA ukuran (merek + jenis + varian, huruf kecil), mis. "lifebuoy sabun batang". Kunci perbandingan harga antar toko.';

-- ── Parser nama item ────────────────────────────────────────────────────────────────────────

-- Nama item → (nama dasar tanpa ukuran/kelipatan, ukuran dalam satuan dasar g/ml/pcs, kelipatan "x2").
-- Catatan regex Postgres (ARE): \y = batas kata (BUKAN \b, itu backspace).
create or replace function parse_item_size(p_name text, out base_name text, out size_value numeric, out size_unit text, out multiplier int)
language plpgsql immutable as $$
declare
  v text := norm_text(p_name);
  m text[];
  n numeric;
  u text;
begin
  multiplier := 1;
  m := regexp_match(v, '(^|\s)x\s*(\d{1,3})\y');
  if m is not null then
    multiplier := greatest(1, m[2]::int);
    v := regexp_replace(v, '(^|\s)x\s*\d{1,3}\y', ' ');
  else
    m := regexp_match(v, '\y(\d{1,3})\s*x(\s|$)');
    if m is not null then
      multiplier := greatest(1, m[1]::int);
      v := regexp_replace(v, '\y\d{1,3}\s*x(\s|$)', ' ');
    end if;
  end if;

  -- Berat/volume dulu, baru hitungan (pcs/sachet/...) kalau tidak ada.
  m := regexp_match(v, '(\d+(?:[.,]\d+)?)\s*(kg|kilo|gram|grm|gr|g|mg|liter|ltr|lt|l|ml|cc)\y');
  if m is null then
    m := regexp_match(v, '(\d+(?:[.,]\d+)?)\s*(pcs|pc|sachet|sct|btl|bks|bh|lbr|lembar|tablet|tab|kaplet|roll|rol)\y');
  end if;
  if m is not null then
    n := replace(m[1], ',', '.')::numeric;
    u := m[2];
    if u in ('kg', 'kilo') then size_value := n * 1000; size_unit := 'g';
    elsif u = 'mg' then size_value := n / 1000; size_unit := 'g';
    elsif u in ('gram', 'grm', 'gr', 'g') then size_value := n; size_unit := 'g';
    elsif u in ('liter', 'ltr', 'lt', 'l') then size_value := n * 1000; size_unit := 'ml';
    elsif u in ('ml', 'cc') then size_value := n; size_unit := 'ml';
    else size_value := n; size_unit := 'pcs';
    end if;
    if size_value <= 0 then size_value := null; size_unit := null; end if;
    v := regexp_replace(v, '(\d+(?:[.,]\d+)?)\s*(kg|kilo|gram|grm|gr|g|mg|liter|ltr|lt|l|ml|cc|pcs|pc|sachet|sct|btl|bks|bh|lbr|lembar|tablet|tab|kaplet|roll|rol)\y', ' ');
  end if;
  base_name := trim(regexp_replace(v, '\s+', ' ', 'g'));
end;
$$;

-- Kunci item untuk gudang produk: nama dinormalkan TANPA kelipatan ("lfby bs 85g x2" → "lfby bs 85g").
create or replace function item_keyword(p_name text) returns text
language sql immutable as $$
  select left(trim(regexp_replace(regexp_replace(regexp_replace(norm_text(p_name), '(^|\s)x\s*\d{1,3}\y', ' '), '\y\d{1,3}\s*x(\s|$)', ' '), '\s+', ' ', 'g')), 80);
$$;

-- Kunci produk: token nama dasar (tanpa ukuran & tanda baca) unik + diurutkan → urutan kata tidak penting.
create or replace function product_key(p text) returns text
language sql immutable as $$
  select coalesce(string_agg(distinct w, ' ' order by w), '')
  from unnest(string_to_array(regexp_replace((parse_item_size(p)).base_name, '[^a-z0-9 ]', ' ', 'g'), ' ')) as w
  where w <> '';
$$;

-- Toko → kunci: jaringan minimarket/supermarket disatukan lintas cabang ("Indomaret Jatikramat" → "indomaret").
create or replace function merchant_key(p text) returns text
language sql immutable as $$
  select coalesce(
    replace((regexp_match(norm_text(p), '^(indomaret|alfamart|alfamidi|alfaexpress|super ?indo|hypermart|transmart|carrefour|giant|hero|lotte ?mart|lotte grosir|yogya|griya|ranch market|farmers market|hari hari|tip ?top|circle ?k|lawson|family ?mart|guardian|watsons|century|kimia farma|k-?24|indogrosir|primo|grand lucky|total buah)'))[1], ' ', ''),
    norm_text(p));
$$;

-- ── Tabel ───────────────────────────────────────────────────────────────────────────────────

create table product_prices (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  transaction_id uuid not null unique references transactions(id) on delete cascade,
  keyword        text not null,              -- item_keyword(nama item) → join product_knowledge/product_aliases
  base_name      text not null,              -- nama tanpa ukuran, fallback nama produk kalau belum dikanonikkan
  merchant       text not null,              -- nama toko apa adanya (dengan cabang)
  merchant_key   text not null,              -- merchant_key(merchant)
  qty            numeric not null default 1 check (qty > 0),
  amount         bigint not null check (amount > 0),   -- total baris struk
  unit_price     numeric not null,           -- amount / qty (harga satu kemasan)
  size_value     numeric,                    -- ukuran satu kemasan dalam satuan dasar
  size_unit      text check (size_unit in ('g', 'ml', 'pcs')),
  date           date not null,
  created_at     timestamptz not null default now()
);
create index product_prices_household_date_idx on product_prices (household_id, date desc);
create index product_prices_keyword_idx on product_prices (keyword);
comment on table product_prices is 'Riwayat harga per item struk per toko (diisi otomatis saat ingest_receipt / simpan scan web). Dasar perbandingan harga antar toko.';
alter table product_prices enable row level security;
create policy product_prices_select on product_prices for select using (is_household_member(household_id));
create policy product_prices_write on product_prices for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));

create table product_aliases (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  keyword        text not null check (length(keyword) between 2 and 80),
  canonical_name text not null check (length(canonical_name) between 2 and 120),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index product_aliases_uq on product_aliases (household_id, keyword);
comment on table product_aliases is 'Koreksi manual per household: "item struk ini = produk itu". Menang atas product_knowledge.canonical_name.';
alter table product_aliases enable row level security;
create policy product_aliases_select on product_aliases for select using (is_household_member(household_id));
create policy product_aliases_write on product_aliases for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create trigger product_aliases_set_updated_at before update on product_aliases for each row execute function set_updated_at();

-- ── View ────────────────────────────────────────────────────────────────────────────────────

-- Nama produk diputuskan saat DIBACA (bukan saat disimpan), jadi kanonikalisasi/alias yang datang
-- belakangan langsung berlaku untuk riwayat lama. Transaksi yang dihapus tidak ikut.
create or replace view v_product_prices as
select pp.*,
  coalesce(pa.canonical_name, pk.canonical_name, pp.base_name) as product_name,
  product_key(coalesce(pa.canonical_name, pk.canonical_name, pp.base_name)) as product_key,
  case when pp.size_value > 0 then pp.unit_price / pp.size_value end as price_per_unit
from product_prices pp
join transactions t on t.id = pp.transaction_id and t.deleted_at is null
left join product_aliases pa on pa.household_id = pp.household_id and pa.keyword = pp.keyword
left join product_knowledge pk on pk.keyword = pp.keyword;
alter view v_product_prices set (security_invoker = on);

-- ── Fungsi tulis ────────────────────────────────────────────────────────────────────────────

-- Signature baru (+ p_canonical) — drop dulu supaya tidak jadi overload ambigu dengan versi 0024.
drop function if exists learn_product_knowledge(text, product_group, text, keyword_source);
create or replace function learn_product_knowledge(p_keyword text, p_group product_group, p_label text, p_source keyword_source default 'web', p_canonical text default null)
returns void language plpgsql as $$
declare
  v_kw text := left(norm_text(p_keyword), 80);
  v_can text := nullif(left(norm_text(p_canonical), 120), '');
begin
  if length(v_kw) < 2 then return; end if;
  if v_can is not null and length(v_can) < 2 then v_can := null; end if;
  insert into product_knowledge (keyword, product_group, label, source, canonical_name)
  values (v_kw, p_group, p_label, p_source, v_can)
  on conflict (keyword) do update set
    product_group = case when keyword_source_rank(excluded.source) >= keyword_source_rank(product_knowledge.source) then excluded.product_group else product_knowledge.product_group end,
    label         = case when keyword_source_rank(excluded.source) >= keyword_source_rank(product_knowledge.source) then excluded.label else product_knowledge.label end,
    source        = case when keyword_source_rank(excluded.source) >= keyword_source_rank(product_knowledge.source) then excluded.source else product_knowledge.source end,
    -- Nama kanonik: sumber lebih kuat boleh mengganti; sumber lebih lemah hanya MENGISI yang kosong.
    canonical_name = case when keyword_source_rank(excluded.source) >= keyword_source_rank(product_knowledge.source)
                          then coalesce(excluded.canonical_name, product_knowledge.canonical_name)
                          else coalesce(product_knowledge.canonical_name, excluded.canonical_name) end;
end;
$$;

-- Catat harga item satu struk. p_items: [{transaction_id, name, qty?, amount}]. Tanpa toko → 0 (tidak
-- bisa dibandingkan antar toko). Dipanggil di DALAM transaksi yang sama dengan post_transactions_batch.
create or replace function record_product_prices(p_household_id uuid, p_merchant text, p_date date, p_items jsonb)
returns int language plpgsql as $$
declare
  v_item jsonb;
  v_name text;
  v_kw text;
  v_amount bigint;
  v_qty numeric;
  v_p record;
  v_n int := 0;
begin
  if coalesce(trim(p_merchant), '') = '' then return 0; end if;
  -- Prefix penanda lama di note ("[TITIPAN] …", "[NOMBOK] …") bukan nama toko.
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
    insert into product_prices (household_id, transaction_id, keyword, base_name, merchant, merchant_key, qty, amount, unit_price, size_value, size_unit, date)
    values (p_household_id, (v_item->>'transaction_id')::uuid, v_kw, coalesce(nullif(v_p.base_name, ''), v_kw),
            left(trim(p_merchant), 80), merchant_key(p_merchant), v_qty, v_amount, round(v_amount::numeric / v_qty, 2),
            v_p.size_value, v_p.size_unit, p_date)
    on conflict (transaction_id) do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ── Backfill: transaksi struk yang sudah ada ────────────────────────────────────────────────
-- Format baru "[Toko] Nama [ref: X]" dan format lama "Nama — Toko [ref: X]". Qty tidak tersimpan di
-- transaksi lama → 1 (kecuali ada "x2" di nama).
with src as (
  select t.id, t.household_id, t.amount, t.date,
         regexp_replace(t.note, '\s*\[ref:[^\]]*\]\s*$', '') as body
  from transactions t
  where t.deleted_at is null and t.type = 'expense' and t.note is not null
    and (t.note ~ '^\[[^\]]+\]\s*\S' or t.note like '% — %')
), parsed as (
  select id, household_id, amount, date,
    case when body ~ '^\[[^\]]+\]' then (regexp_match(body, '^\[([^\]]+)\]'))[1]
         else (regexp_match(body, '^.* — (.+)$'))[1] end as merchant,
    case when body ~ '^\[[^\]]+\]' then regexp_replace(body, '^\[[^\]]+\]\s*', '')
         else (regexp_match(body, '^(.*) — .+$'))[1] end as name
  from src
)
select count(*) from (
  select record_product_prices(household_id, merchant, date,
           jsonb_build_array(jsonb_build_object('transaction_id', id, 'name', regexp_replace(name, '\s*\(?titipan\y.*$', '', 'i'), 'amount', amount)))
  from parsed
  where merchant is not null and trim(merchant) <> '' and name is not null
) as done;
