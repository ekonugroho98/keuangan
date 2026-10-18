-- 00000000000028_transaction_receipt_images.sql
-- Menyimpan URL foto/bukti struk (receipt_url) pada transaksi serta menyiapkan bucket Supabase Storage 'receipts'.
-- Arsitektur bertahap:
--   Fase 1 (Saat ini, <=12.500 struk / 1 GB): Supabase Storage bucket 'receipts' (kompresi WebP ~60-90 KB/struk).
--   Fase 2 (Skala SaaS >10.000 struk): Cloudflare R2 / Firebase Blaze lewat abstraksi apps/api/src/services/storage.ts
--   tanpa perlu mengubah kolom `transactions.receipt_url`.

alter table public.transactions
  add column if not exists receipt_url text
  check (receipt_url is null or (char_length(receipt_url) <= 1000 and receipt_url ~ '^https?://'));

comment on column public.transactions.receipt_url is
  'URL bukti foto struk/nota (WebP/JPEG di Supabase Storage atau R2/Firebase di masa depan).';

-- Siapkan bucket 'receipts' di Supabase Storage (public read dengan path UUID acak per household, maks 5 MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
