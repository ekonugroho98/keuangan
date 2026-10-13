-- 0024: "gudang kata kunci" kategori untuk scan struk (web) dan ingest_receipt (Hermes).
-- Masalah: nama item di struk minimarket disingkat kasir ("LFBY BS 85G") sehingga AI/regex sering
-- salah atau menjatuhkan semua ke Makanan. Dua lapis pengetahuan yang bertambah seiring pemakaian:
--   (1) category_keywords  — per household, belajar dari KONFIRMASI/KOREKSI user (nama item → kategori);
--                            prioritas tertinggi, mengalahkan tebakan AI.
--   (2) product_knowledge  — lintas household, hasil identifikasi produk via pencarian web / pengetahuan
--                            AI (nama item → kelompok generik), dipetakan ke kategori household saat dipakai.
--                            Bukan data keuangan, hanya "LFBY BS 85G = sabun Lifebuoy = household".

create type keyword_source as enum ('user', 'web', 'ai');
create type product_group as enum ('food', 'household', 'health', 'utility', 'transport', 'education', 'entertainment', 'other');

-- user > web > ai: sumber yang lebih lemah tidak boleh menimpa yang lebih kuat.
create or replace function keyword_source_rank(p keyword_source) returns int
language sql immutable as $$
  select case p when 'user' then 3 when 'web' then 2 else 1 end;
$$;

create table category_keywords (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  keyword       text not null check (length(keyword) between 2 and 80),
  category_id   uuid not null references categories(id) on delete cascade,
  source        keyword_source not null default 'user',
  hits          int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index category_keywords_uq on category_keywords (household_id, keyword);
comment on column category_keywords.keyword is 'norm_text(nama item). Dicocokkan exact dulu, lalu sebagai substring nama item (keyword terpanjang menang).';
comment on column category_keywords.hits is 'Berapa kali pemetaan yang sama dikonfirmasi ulang — sinyal kepercayaan, belum dipakai untuk keputusan.';
alter table category_keywords enable row level security;
create policy category_keywords_select on category_keywords for select using (is_household_member(household_id));
create policy category_keywords_write on category_keywords for all
  using (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'))
  with check (is_household_member(household_id) and member_role_in(household_id) in ('owner','member'));
create trigger category_keywords_set_updated_at before update on category_keywords for each row execute function set_updated_at();

create table product_knowledge (
  keyword        text primary key check (length(keyword) between 2 and 80),
  product_group  product_group not null,
  label          text,
  source         keyword_source not null default 'web',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table product_knowledge is 'Pengetahuan produk lintas household (bukan data keuangan): norm_text(nama item struk) → kelompok generik. Diisi backend dari hasil pencarian web (source=web) atau pengetahuan AI tanpa hasil web (source=ai).';
comment on column product_knowledge.label is 'Nama produk lengkap hasil identifikasi, mis. "Lifebuoy sabun mandi batang 85g" — untuk ditampilkan/diaudit.';
alter table product_knowledge enable row level security;
create policy product_knowledge_select on product_knowledge for select to authenticated using (true);
create policy product_knowledge_write on product_knowledge for all to authenticated using (true) with check (true);
create trigger product_knowledge_set_updated_at before update on product_knowledge for each row execute function set_updated_at();

-- Dipanggil backend setelah user mengonfirmasi kategori (simpan hasil scan di web, atau ubah kategori
-- transaksi). Keyword dinormalkan di sini; terlalu pendek/panjang diabaikan diam-diam supaya tidak
-- pernah menggagalkan transaksi utama yang memanggilnya.
create or replace function learn_category_keyword(p_household_id uuid, p_keyword text, p_category_id uuid, p_source keyword_source default 'user')
returns void language plpgsql as $$
declare v_kw text := left(norm_text(p_keyword), 80);
begin
  if length(v_kw) < 2 then return; end if;
  insert into category_keywords (household_id, keyword, category_id, source)
  values (p_household_id, v_kw, p_category_id, p_source)
  on conflict (household_id, keyword) do update
    set category_id = excluded.category_id, source = excluded.source, hits = category_keywords.hits + 1
    where keyword_source_rank(excluded.source) >= keyword_source_rank(category_keywords.source);
end;
$$;

create or replace function learn_product_knowledge(p_keyword text, p_group product_group, p_label text, p_source keyword_source default 'web')
returns void language plpgsql as $$
declare v_kw text := left(norm_text(p_keyword), 80);
begin
  if length(v_kw) < 2 then return; end if;
  insert into product_knowledge (keyword, product_group, label, source)
  values (v_kw, p_group, p_label, p_source)
  on conflict (keyword) do update
    set product_group = excluded.product_group, label = excluded.label, source = excluded.source
    where keyword_source_rank(excluded.source) >= keyword_source_rank(product_knowledge.source);
end;
$$;
