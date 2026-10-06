-- 0001: ekstensi dan enum dasar (03-database.md §2)
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
-- pg_cron diaktifkan lewat Dashboard > Database > Extensions pada project ini (butuh akses superuser
-- yang tidak selalu tersedia lewat migration runner); 0007_cron.sql memeriksa keberadaannya sebelum jadwal.

do $$ begin
  create type member_role as enum ('owner', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_type as enum ('bank', 'ewallet', 'cash', 'crypto', 'investasi', 'tabungan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_visibility as enum ('shared', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tx_type as enum ('income', 'expense', 'transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tx_source as enum ('web', 'api_key', 'recurring', 'system', 'import', 'migration');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_type as enum ('income', 'expense', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recurring_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type api_key_scope as enum ('read', 'write', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type credential_type as enum ('jwt', 'api_key', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

-- helper updated_at trigger (dipakai semua tabel berikutnya)
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Wrapper IMMUTABLE untuk unaccent() agar bisa dipakai di index expression.
-- unaccent() bawaan ditandai STABLE oleh Postgres karena bergantung pada search_path dictionary;
-- kita kunci ke dictionary 'unaccent' secara eksplisit sehingga aman ditandai IMMUTABLE.
create or replace function immutable_unaccent(text) returns text
language sql immutable parallel safe as $$
  select unaccent('unaccent'::regdictionary, $1);
$$;
