


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."account_type" AS ENUM (
    'bank',
    'ewallet',
    'cash',
    'crypto',
    'investasi',
    'tabungan'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."account_visibility" AS ENUM (
    'shared',
    'private'
);


ALTER TYPE "public"."account_visibility" OWNER TO "postgres";


CREATE TYPE "public"."api_key_scope" AS ENUM (
    'read',
    'write',
    'admin'
);


ALTER TYPE "public"."api_key_scope" OWNER TO "postgres";


CREATE TYPE "public"."category_type" AS ENUM (
    'income',
    'expense',
    'both'
);


ALTER TYPE "public"."category_type" OWNER TO "postgres";


CREATE TYPE "public"."credential_type" AS ENUM (
    'jwt',
    'api_key',
    'system'
);


ALTER TYPE "public"."credential_type" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'revoked',
    'expired'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'member',
    'viewer'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."recurring_frequency" AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'yearly'
);


ALTER TYPE "public"."recurring_frequency" OWNER TO "postgres";


CREATE TYPE "public"."tx_source" AS ENUM (
    'web',
    'api_key',
    'recurring',
    'system',
    'import',
    'migration'
);


ALTER TYPE "public"."tx_source" OWNER TO "postgres";


CREATE TYPE "public"."tx_type" AS ENUM (
    'income',
    'expense',
    'transfer'
);


ALTER TYPE "public"."tx_type" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."household_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "role" "public"."member_role" DEFAULT 'member'::"public"."member_role" NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "household_members_display_name_check" CHECK ((("length"("display_name") >= 1) AND ("length"("display_name") <= 60)))
);


ALTER TABLE "public"."household_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."household_members"."aliases" IS 'Kata yang dipakai agent untuk merujuk member ini, mis. {istri,bunda,mama}.';



CREATE OR REPLACE FUNCTION "public"."accept_invitation"("p_code" "text", "p_user_id" "uuid", "p_display_name" "text", "p_mode" "text") RETURNS "public"."household_members"
    LANGUAGE "plpgsql"
    AS $$
declare v_inv household_invitations; v_user_email text; v_member household_members; v_source_household uuid;
begin
  select * into v_inv from household_invitations where code = p_code for update;
  if v_inv is null or v_inv.status <> 'pending' then raise exception using errcode = 'P0001', message = 'invitation_invalid'; end if;
  if v_inv.expires_at < now() then
    update household_invitations set status = 'expired' where id = v_inv.id;
    raise exception using errcode = 'P0001', message = 'invitation_expired';
  end if;
  if v_inv.email is not null then
    select email into v_user_email from auth.users where id = p_user_id;
    if lower(v_user_email) <> lower(v_inv.email) then
      raise exception using errcode = 'P0001', message = 'invitation_email_mismatch';
    end if;
  end if;
  if exists (select 1 from household_members where household_id = v_inv.household_id and user_id = p_user_id and deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;

  insert into household_members (household_id, user_id, display_name, role, aliases)
  values (v_inv.household_id, p_user_id, p_display_name, v_inv.role, '{}')
  returning * into v_member;

  update household_invitations set status = 'accepted', accepted_by = v_member.id, accepted_at = now() where id = v_inv.id;

  if p_mode = 'merge' then
    select active_household_id into v_source_household from user_settings where user_id = p_user_id;
    if v_source_household is not null and v_source_household <> v_inv.household_id then
      perform merge_household_into(v_source_household, v_inv.household_id, v_member.id);
    end if;
  end if;

  update user_settings set active_household_id = v_inv.household_id, updated_at = now() where user_id = p_user_id;
  insert into user_settings (user_id, active_household_id) values (p_user_id, v_inv.household_id)
    on conflict (user_id) do nothing;

  return v_member;
end;
$$;


ALTER FUNCTION "public"."accept_invitation"("p_code" "text", "p_user_id" "uuid", "p_display_name" "text", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."account_balance"("p_account_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE
    AS $$
  select a.opening_balance
    + coalesce((select sum(amount) from transactions where deleted_at is null and account_id = a.id and type = 'income'), 0)
    - coalesce((select sum(amount) from transactions where deleted_at is null and account_id = a.id and type in ('expense','transfer')), 0)
    + coalesce((select sum(amount) from transactions where deleted_at is null and to_account_id = a.id and type = 'transfer'), 0)
  from accounts a where a.id = p_account_id;
$$;


ALTER FUNCTION "public"."account_balance"("p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_balance"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_new_balance" bigint, "p_date" "date" DEFAULT NULL::"date", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_actor household_members; v_account accounts; v_diff bigint; v_cat_id uuid; v_tx transactions;
begin
  if p_new_balance is null or p_new_balance < 0 or p_new_balance > 100000000000 then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"new_balance"}';
  end if;
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;

  v_diff := p_new_balance - account_balance(p_account_id);
  if v_diff = 0 then
    return jsonb_build_object('account', to_jsonb(v_account) || jsonb_build_object('balance', p_new_balance), 'transaction', null, 'diff', 0);
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'balance_adjustment';

  insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source)
  values (p_household_id, case when v_diff > 0 then 'income' else 'expense' end::tx_type, abs(v_diff), p_account_id, v_cat_id,
          coalesce(nullif(p_note,''), 'Koreksi saldo ' || v_account.name), coalesce(p_date, today_in_tz(p_household_id)), p_actor_member_id, 'system')
  returning * into v_tx;

  return jsonb_build_object('account', to_jsonb(v_account) || jsonb_build_object('balance', p_new_balance), 'transaction', to_jsonb(v_tx), 'diff', v_diff);
end;
$$;


ALTER FUNCTION "public"."adjust_balance"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_new_balance" bigint, "p_date" "date", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_actor"("p_household_id" "uuid", "p_actor_member_id" "uuid") RETURNS "public"."household_members"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members;
begin
  select * into v_actor from household_members
    where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'not_household_member';
  end if;
  if v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;
  return v_actor;
end;
$$;


ALTER FUNCTION "public"."assert_actor"("p_household_id" "uuid", "p_actor_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_rate_limit"("p_api_key_id" "uuid", "p_minute_limit" integer, "p_day_limit" integer) RETURNS TABLE("allowed" boolean, "remaining_minute" integer, "remaining_day" integer, "reset_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."bump_rate_limit"("p_api_key_id" "uuid", "p_minute_limit" integer, "p_day_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_post_to_account"("p_account_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from accounts a
    where a.id = p_account_id and a.deleted_at is null
      and member_role_in(a.household_id) in ('owner','member')
      and (a.visibility = 'shared' or a.owner_member_id in (select current_member_ids()))
  );
$$;


ALTER FUNCTION "public"."can_post_to_account"("p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_account"("p_account_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from accounts a
    where a.id = p_account_id
      and is_household_member(a.household_id)
      and (a.visibility = 'shared' or a.owner_member_id in (select current_member_ids()))
  );
$$;


ALTER FUNCTION "public"."can_view_account"("p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_member_role"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_role" "public"."member_role") RETURNS "public"."household_members"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_owner_count int; v_result household_members;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then raise exception using errcode = 'P0001', message = 'actor_mismatch'; end if;
  if v_actor.role <> 'owner' then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  if p_role <> 'owner' then
    select count(*) into v_owner_count from household_members where household_id = p_household_id and role = 'owner' and deleted_at is null and id <> p_member_id;
    if v_owner_count = 0 then raise exception using errcode = 'P0001', message = 'last_owner'; end if;
  end if;

  update household_members set role = p_role, updated_at = now() where id = p_member_id and household_id = p_household_id
  returning * into v_result;
  if v_result is null then raise exception using errcode = 'P0001', message = 'member_not_found'; end if;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."change_member_role"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_role" "public"."member_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_household"("p_name" "text", "p_timezone" "text", "p_display_name" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare v_household households; v_member household_members;
begin
  insert into households (name, timezone, created_by) values (p_name, coalesce(p_timezone, 'Asia/Jakarta'), p_user_id)
  returning * into v_household;

  insert into household_members (household_id, user_id, display_name, role, aliases)
  values (v_household.id, p_user_id, p_display_name, 'owner', '{saya}')
  returning * into v_member;

  perform seed_household_categories(v_household.id);

  insert into user_settings (user_id, active_household_id) values (p_user_id, v_household.id)
  on conflict (user_id) do update set active_household_id = excluded.active_household_id;

  return jsonb_build_object('household', to_jsonb(v_household), 'member', to_jsonb(v_member));
end;
$$;


ALTER FUNCTION "public"."create_household"("p_name" "text", "p_timezone" "text", "p_display_name" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "email" "text",
    "code" "text" NOT NULL,
    "role" "public"."member_role" DEFAULT 'owner'::"public"."member_role" NOT NULL,
    "display_name_suggestion" "text",
    "invited_by" "uuid" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "household_invitations_email_check" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text")))
);


ALTER TABLE "public"."household_invitations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invitation"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_email" "text", "p_role" "public"."member_role", "p_display_name_suggestion" "text") RETURNS "public"."household_invitations"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_code text; v_inv household_invitations; v_exists int;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'actor_mismatch';
  end if;
  if v_actor.role <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if p_email is not null then
    select count(*) into v_exists from household_members hm join auth.users u on u.id = hm.user_id
      where hm.household_id = p_household_id and hm.deleted_at is null and lower(u.email) = lower(p_email);
    if v_exists > 0 then raise exception using errcode = 'P0001', message = 'already_member'; end if;
  end if;
  loop
    v_code := generate_invitation_code();
    exit when not exists (select 1 from household_invitations where code = v_code);
  end loop;
  insert into household_invitations (household_id, email, code, role, display_name_suggestion, invited_by)
  values (p_household_id, p_email, v_code, coalesce(p_role, 'owner'), p_display_name_suggestion, p_actor_member_id)
  returning * into v_inv;
  return v_inv;
end;
$$;


ALTER FUNCTION "public"."create_invitation"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_email" "text", "p_role" "public"."member_role", "p_display_name_suggestion" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_household_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select household_id from household_members where user_id = auth.uid() and deleted_at is null;
$$;


ALTER FUNCTION "public"."current_household_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_member_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from household_members where user_id = auth.uid() and deleted_at is null;
$$;


ALTER FUNCTION "public"."current_member_ids"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "owner_member_id" "uuid",
    "name" "text" NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "type" "public"."account_type" NOT NULL,
    "visibility" "public"."account_visibility" DEFAULT 'shared'::"public"."account_visibility" NOT NULL,
    "opening_balance" bigint DEFAULT 0 NOT NULL,
    "icon" "text" DEFAULT '💰'::"text" NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "needs_review" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "accounts_joint_must_be_shared" CHECK ((("owner_member_id" IS NOT NULL) OR ("visibility" = 'shared'::"public"."account_visibility"))),
    CONSTRAINT "accounts_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 60))),
    CONSTRAINT "accounts_opening_balance_check" CHECK ((("opening_balance" >= 0) AND ("opening_balance" <= '100000000000'::bigint)))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."accounts"."opening_balance" IS 'Saldo sebelum transaksi pertama. Saldo berjalan = opening_balance + efek transaksi aktif (v_account_balances).';



COMMENT ON COLUMN "public"."accounts"."needs_review" IS 'True untuk akun placeholder hasil migrasi (tidak dipakai di jalur greenfield).';



CREATE OR REPLACE FUNCTION "public"."delete_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_force_archive" boolean DEFAULT false) RETURNS "public"."accounts"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_account accounts; v_balance bigint; v_tx_count int; v_rec_count int;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;
  if v_actor.role <> 'owner' and v_account.owner_member_id <> p_actor_member_id then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select count(*) into v_rec_count from recurring_transactions where account_id = p_account_id and active and deleted_at is null;
  if v_rec_count > 0 then raise exception using errcode = 'P0001', message = 'account_in_use_by_recurring'; end if;

  v_balance := account_balance(p_account_id);
  if v_balance <> 0 then
    raise exception using errcode = 'P0001', message = 'account_has_balance', detail = jsonb_build_object('balance', v_balance)::text;
  end if;

  select count(*) into v_tx_count from transactions where (account_id = p_account_id or to_account_id = p_account_id) and deleted_at is null;
  if v_tx_count > 0 and not p_force_archive then
    raise exception using errcode = 'P0001', message = 'account_has_transactions', detail = jsonb_build_object('count', v_tx_count)::text;
  end if;

  update accounts set deleted_at = now() where id = p_account_id returning * into v_account;
  return v_account;
end;
$$;


ALTER FUNCTION "public"."delete_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_force_archive" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "type" "public"."category_type" DEFAULT 'expense'::"public"."category_type" NOT NULL,
    "icon" "text" DEFAULT '📦'::"text" NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "system_key" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "categories_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 40))),
    CONSTRAINT "categories_system_key_consistency" CHECK ((("is_system" AND ("system_key" IS NOT NULL)) OR ((NOT "is_system") AND ("system_key" IS NULL))))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_category"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_category_id" "uuid", "p_merge_into_category_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."categories"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_cat categories; v_count int;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  if v_actor.role <> 'owner' then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  select * into v_cat from categories where id = p_category_id and household_id = p_household_id and deleted_at is null for update;
  if v_cat is null then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  if v_cat.is_system then raise exception using errcode = 'P0001', message = 'category_reserved'; end if;

  select count(*) into v_count from transactions where category_id = p_category_id and deleted_at is null;
  if v_count > 0 then
    if p_merge_into_category_id is null then
      raise exception using errcode = 'P0001', message = 'category_in_use', detail = jsonb_build_object('count', v_count)::text;
    end if;
    update transactions set category_id = p_merge_into_category_id where category_id = p_category_id;
    update budgets set category_id = p_merge_into_category_id where category_id = p_category_id;
    update recurring_transactions set category_id = p_merge_into_category_id where category_id = p_category_id;
  end if;

  update categories set deleted_at = now() where id = p_category_id returning * into v_cat;
  return v_cat;
end;
$$;


ALTER FUNCTION "public"."delete_category"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_category_id" "uuid", "p_merge_into_category_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "type" "public"."tx_type" NOT NULL,
    "amount" bigint NOT NULL,
    "account_id" "uuid" NOT NULL,
    "to_account_id" "uuid",
    "category_id" "uuid" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "date" "date" NOT NULL,
    "recorded_by_member_id" "uuid" NOT NULL,
    "source" "public"."tx_source" DEFAULT 'web'::"public"."tx_source" NOT NULL,
    "recurring_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by_member_id" "uuid",
    CONSTRAINT "transactions_amount_check" CHECK ((("amount" > 0) AND ("amount" <= '100000000000'::bigint))),
    CONSTRAINT "transactions_note_check" CHECK (("length"("note") <= 500)),
    CONSTRAINT "tx_transfer_shape" CHECK (((("type" = 'transfer'::"public"."tx_type") AND ("to_account_id" IS NOT NULL) AND ("to_account_id" <> "account_id")) OR (("type" <> 'transfer'::"public"."tx_type") AND ("to_account_id" IS NULL))))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions"."account_id" IS 'Akun asal. Income: akun yang menerima. Expense/transfer: akun yang berkurang.';



COMMENT ON COLUMN "public"."transactions"."recorded_by_member_id" IS 'Siapa yang mencatat; bukan pemilik uang (lihat accounts.owner_member_id).';



CREATE OR REPLACE FUNCTION "public"."delete_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") RETURNS "public"."transactions"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_tx transactions; v_result transactions;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_tx from transactions where id = p_id and household_id = p_household_id and deleted_at is null for update;
  if v_tx is null then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;

  if v_tx.type = 'income' and account_balance(v_tx.account_id) - v_tx.amount < 0 then
    raise exception using errcode = 'P0001', message = 'would_make_balance_negative';
  end if;
  if v_tx.type = 'transfer' and account_balance(v_tx.to_account_id) - v_tx.amount < 0 then
    raise exception using errcode = 'P0001', message = 'would_make_balance_negative';
  end if;

  update transactions set deleted_at = now(), deleted_by_member_id = p_actor_member_id, updated_at = now()
  where id = p_id returning * into v_result;

  update piutang set lend_transaction_id = null where lend_transaction_id = p_id;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."delete_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invitation_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare v_alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; v_code text := '';
begin
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    if i = 4 then v_code := v_code || '-'; end if;
  end loop;
  return v_code;
end;
$$;


ALTER FUNCTION "public"."generate_invitation_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $_$
  select unaccent('unaccent'::regdictionary, $1);
$_$;


ALTER FUNCTION "public"."immutable_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_household_member"("p_household_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$ select p_household_id in (select current_household_ids()); $$;


ALTER FUNCTION "public"."is_household_member"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lend_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_borrower_name" "text", "p_total" bigint, "p_from_account_id" "uuid", "p_owner_member_id" "uuid", "p_due_date" "date", "p_notes" "text", "p_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_piutang piutang; v_tx transactions; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  insert into piutang (household_id, owner_member_id, borrower_name, total, from_account_id, due_date, notes)
  values (p_household_id, coalesce(p_owner_member_id, p_actor_member_id), p_borrower_name, p_total, p_from_account_id, p_due_date, coalesce(p_notes,''))
  returning * into v_piutang;

  if p_from_account_id is not null then
    select id into v_cat_id from categories where household_id = p_household_id and system_key = 'piutang';
    v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_from_account_id, v_cat_id, p_total, coalesce(p_date, today_in_tz(p_household_id)),
              'Piutang ke ' || p_borrower_name, 'web');
    update piutang set lend_transaction_id = v_tx.id where id = v_piutang.id;
  end if;

  return jsonb_build_object('piutang', to_jsonb((select p from v_piutang p where id = v_piutang.id)), 'transaction', to_jsonb(v_tx));
end;
$$;


ALTER FUNCTION "public"."lend_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_borrower_name" "text", "p_total" bigint, "p_from_account_id" "uuid", "p_owner_member_id" "uuid", "p_due_date" "date", "p_notes" "text", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."member_role_in"("p_household_id" "uuid") RETURNS "public"."member_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from household_members where household_id = p_household_id and user_id = auth.uid() and deleted_at is null limit 1;
$$;


ALTER FUNCTION "public"."member_role_in"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_household_into"("p_source_household_id" "uuid", "p_target_household_id" "uuid", "p_member_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare v_moved jsonb := '{}'::jsonb; v_cat record; v_target_cat uuid; v_n int;
begin
  if p_source_household_id = p_target_household_id then return v_moved; end if;

  -- dedupe kategori non-sistem by nama: arahkan transaksi/budget/recurring ke kategori target yang namanya sama
  for v_cat in select * from categories where household_id = p_source_household_id and deleted_at is null and not is_system loop
    select id into v_target_cat from categories where household_id = p_target_household_id and lower(unaccent(name)) = lower(unaccent(v_cat.name)) and deleted_at is null limit 1;
    if v_target_cat is null then
      update categories set household_id = p_target_household_id where id = v_cat.id;
    else
      update transactions set category_id = v_target_cat where category_id = v_cat.id;
      update budgets set category_id = v_target_cat where category_id = v_cat.id;
      update recurring_transactions set category_id = v_target_cat where category_id = v_cat.id;
      update categories set deleted_at = now() where id = v_cat.id;
    end if;
  end loop;

  update accounts set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('accounts', v_n);

  update transactions set household_id = p_target_household_id, recorded_by_member_id = p_member_id where household_id = p_source_household_id;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('transactions', v_n);

  -- budget household lama menjadi budget pribadi member baru di target
  update budgets set household_id = p_target_household_id, member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update goals set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update debts set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update piutang set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update recurring_transactions set household_id = p_target_household_id, member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update investments set household_id = p_target_household_id, owner_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;
  update split_bills set household_id = p_target_household_id, created_by_member_id = p_member_id where household_id = p_source_household_id and deleted_at is null;

  update households set deleted_at = now(), merged_into_household_id = p_target_household_id where id = p_source_household_id;

  return v_moved;
end;
$$;


ALTER FUNCTION "public"."merge_household_into"("p_source_household_id" "uuid", "p_target_household_id" "uuid", "p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_recurring_date"("p_from" "date", "p_freq" "public"."recurring_frequency", "p_anchor_day" smallint) RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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


ALTER FUNCTION "public"."next_recurring_date"("p_from" "date", "p_freq" "public"."recurring_frequency", "p_anchor_day" smallint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."norm_text"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select trim(regexp_replace(lower(unaccent(coalesce(p,''))), '\s+', ' ', 'g'));
$$;


ALTER FUNCTION "public"."norm_text"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pay_debt"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_debt_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_debt debts; v_remaining bigint; v_tx transactions; v_payment debt_payments; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_debt from debts where id = p_debt_id and household_id = p_household_id and deleted_at is null for update;
  if v_debt is null then raise exception using errcode = 'P0001', message = 'debt_not_found'; end if;

  select remaining into v_remaining from v_debts where id = p_debt_id;
  if v_remaining <= 0 then raise exception using errcode = 'P0001', message = 'debt_already_settled'; end if;
  if p_amount > v_remaining and not p_allow_overpay then
    raise exception using errcode = 'P0001', message = 'overpayment', detail = jsonb_build_object('remaining', v_remaining)::text;
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'debt_payment';
  v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_account_id, v_cat_id, p_amount, p_date,
            coalesce(nullif(p_note,''), 'Cicilan ' || v_debt.name), 'web');

  insert into debt_payments (debt_id, transaction_id, member_id, amount, date, note)
  values (p_debt_id, v_tx.id, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
  returning * into v_payment;

  return jsonb_build_object('transaction', to_jsonb(v_tx), 'payment', to_jsonb(v_payment),
    'debt', to_jsonb((select d from v_debts d where id = p_debt_id)));
end;
$$;


ALTER FUNCTION "public"."pay_debt"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_debt_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_type" "public"."tx_type", "p_account_id" "uuid", "p_category_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source", "p_recurring_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."transactions"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_actor household_members; v_account accounts; v_category categories; v_balance bigint; v_tx transactions;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000000000 then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"amount"}';
  end if;
  if p_type = 'transfer' then
    raise exception using errcode = 'P0001', message = 'use_post_transfer';
  end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);

  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;
  -- CATATAN: role 'owner' household TIDAK membolehkan menulis ke akun privat milik member lain.
  -- 'owner' = admin household (kelola member/kategori/API key), bukan pembebasan visibilitas akun.
  if v_actor.role not in ('owner','member') then
    raise exception using errcode = 'P0001', message = 'insufficient_scope';
  end if;
  if not (v_account.visibility = 'shared' or v_account.owner_member_id = p_actor_member_id) then
    raise exception using errcode = 'P0001', message = 'forbidden_account';
  end if;

  select * into v_category from categories where id = p_category_id and household_id = p_household_id and deleted_at is null;
  if v_category is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  if v_category.system_key = 'transfer' then
    raise exception using errcode = 'P0001', message = 'category_reserved';
  end if;
  if p_type = 'income' and v_category.type not in ('income','both') then
    raise exception using errcode = 'P0001', message = 'category_type_mismatch';
  end if;
  if p_type = 'expense' and v_category.type not in ('expense','both') then
    raise exception using errcode = 'P0001', message = 'category_type_mismatch';
  end if;

  if p_type = 'expense' then
    v_balance := account_balance(p_account_id);
    if v_balance < p_amount then
      raise exception using errcode = 'P0001', message = 'insufficient_funds',
        detail = jsonb_build_object('balance', v_balance, 'needed', p_amount, 'account_name', v_account.name)::text;
    end if;
  end if;

  insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source, recurring_id)
  values (p_household_id, p_type, p_amount, p_account_id, p_category_id, coalesce(nullif(p_note,''), v_category.name), p_date, p_actor_member_id, p_source, p_recurring_id)
  returning * into v_tx;

  return v_tx;
end;
$$;


ALTER FUNCTION "public"."post_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_type" "public"."tx_type", "p_account_id" "uuid", "p_category_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source", "p_recurring_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_transactions_batch"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_date" "date", "p_items" "jsonb", "p_source" "public"."tx_source") RETURNS SETOF "public"."transactions"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_actor household_members; v_account accounts; v_total bigint := 0; v_item jsonb; v_cat_id uuid; v_cat categories;
begin
  if jsonb_array_length(p_items) = 0 then raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"items"}'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception using errcode = 'P0001', message = 'batch_too_large'; end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_account from accounts where id = p_account_id and household_id = p_household_id and deleted_at is null for update;
  if v_account is null then raise exception using errcode = 'P0001', message = 'account_not_found'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'amount')::bigint <= 0 then raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"items.amount"}'; end if;
    v_total := v_total + (v_item->>'amount')::bigint;
    v_cat_id := (v_item->>'category_id')::uuid;
    select * into v_cat from categories where id = v_cat_id and household_id = p_household_id and deleted_at is null;
    if v_cat is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  end loop;

  if account_balance(p_account_id) < v_total then
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(p_account_id), 'needed', v_total, 'account_name', v_account.name)::text;
  end if;

  return query
    insert into transactions (household_id, type, amount, account_id, category_id, note, date, recorded_by_member_id, source)
    select p_household_id, 'expense', (item->>'amount')::bigint, p_account_id, (item->>'category_id')::uuid,
           coalesce(nullif(item->>'note',''), ''), p_date, p_actor_member_id, p_source
    from jsonb_array_elements(p_items) as item
    returning *;
end;
$$;


ALTER FUNCTION "public"."post_transactions_batch"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_date" "date", "p_items" "jsonb", "p_source" "public"."tx_source") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_transfer"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source") RETURNS "public"."transactions"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_actor household_members; v_from accounts; v_to accounts; v_cat_id uuid; v_balance bigint; v_tx transactions;
  v_first uuid; v_second uuid;
begin
  if p_from_account_id = p_to_account_id then raise exception using errcode = 'P0001', message = 'same_account_transfer'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000000 then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"amount"}';
  end if;

  v_actor := assert_actor(p_household_id, p_actor_member_id);

  -- lock kedua akun dalam urutan tetap untuk mencegah deadlock
  if p_from_account_id < p_to_account_id then v_first := p_from_account_id; v_second := p_to_account_id;
  else v_first := p_to_account_id; v_second := p_from_account_id; end if;
  perform id from accounts where id = v_first for update;
  perform id from accounts where id = v_second for update;

  select * into v_from from accounts where id = p_from_account_id and household_id = p_household_id and deleted_at is null;
  select * into v_to from accounts where id = p_to_account_id and household_id = p_household_id and deleted_at is null;
  if v_from is null then raise exception using errcode = 'P0001', message = 'account_not_found', detail = '{"field":"from_account"}'; end if;
  if v_to is null then raise exception using errcode = 'P0001', message = 'account_not_found', detail = '{"field":"to_account"}'; end if;

  if v_actor.role not in ('owner','member') then
    raise exception using errcode = 'P0001', message = 'insufficient_scope';
  end if;
  if not (v_from.visibility = 'shared' or v_from.owner_member_id = p_actor_member_id) then
    raise exception using errcode = 'P0001', message = 'forbidden_account';
  end if;

  v_balance := account_balance(p_from_account_id);
  if v_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', v_balance, 'needed', p_amount, 'account_name', v_from.name)::text;
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'transfer';

  insert into transactions (household_id, type, amount, account_id, to_account_id, category_id, note, date, recorded_by_member_id, source)
  values (p_household_id, 'transfer', p_amount, p_from_account_id, p_to_account_id, v_cat_id,
          coalesce(nullif(p_note,''), 'Transfer ' || v_from.name || ' → ' || v_to.name), p_date, p_actor_member_id, p_source)
  returning * into v_tx;

  return v_tx;
end;
$$;


ALTER FUNCTION "public"."post_transfer"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_invitation"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_inv household_invitations; v_household households; v_inviter household_members;
begin
  select * into v_inv from household_invitations where code = p_code;
  if v_inv is null or v_inv.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'invitation_invalid';
  end if;
  if v_inv.expires_at < now() then
    update household_invitations set status = 'expired' where id = v_inv.id;
    raise exception using errcode = 'P0001', message = 'invitation_expired';
  end if;
  select * into v_household from households where id = v_inv.household_id;
  select * into v_inviter from household_members where id = v_inv.invited_by;
  return jsonb_build_object(
    'household_name', v_household.name, 'inviter_name', v_inviter.display_name,
    'role', v_inv.role, 'email_locked', v_inv.email is not null, 'expires_at', v_inv.expires_at
  );
end;
$$;


ALTER FUNCTION "public"."preview_invitation"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receive_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_piutang_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_piutang piutang; v_remaining bigint; v_tx transactions; v_receipt piutang_receipts; v_cat_id uuid;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_piutang from piutang where id = p_piutang_id and household_id = p_household_id and deleted_at is null for update;
  if v_piutang is null then raise exception using errcode = 'P0001', message = 'piutang_not_found'; end if;

  select remaining into v_remaining from v_piutang where id = p_piutang_id;
  if v_remaining <= 0 then raise exception using errcode = 'P0001', message = 'piutang_already_settled'; end if;
  if p_amount > v_remaining and not p_allow_overpay then
    raise exception using errcode = 'P0001', message = 'overpayment', detail = jsonb_build_object('remaining', v_remaining)::text;
  end if;

  select id into v_cat_id from categories where household_id = p_household_id and system_key = 'piutang';
  v_tx := post_transaction(p_household_id, p_actor_member_id, 'income', p_account_id, v_cat_id, p_amount, p_date,
            coalesce(nullif(p_note,''), 'Terima piutang dari ' || v_piutang.borrower_name), 'web');

  insert into piutang_receipts (piutang_id, transaction_id, member_id, amount, date, note)
  values (p_piutang_id, v_tx.id, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
  returning * into v_receipt;

  return jsonb_build_object('transaction', to_jsonb(v_tx), 'receipt', to_jsonb(v_receipt),
    'piutang', to_jsonb((select p from v_piutang p where id = p_piutang_id)));
end;
$$;


ALTER FUNCTION "public"."receive_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_piutang_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_fill_anchor_day"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.anchor_day is null then
    new.anchor_day := extract(day from new.next_date);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."recurring_fill_anchor_day"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_member"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_reassign_to_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_target household_members; v_owner_count int; v_account_count int;
begin
  select * into v_actor from household_members where id = p_actor_member_id and household_id = p_household_id and deleted_at is null;
  if v_actor is null or v_actor.user_id <> auth.uid() then raise exception using errcode = 'P0001', message = 'actor_mismatch'; end if;
  if v_actor.role <> 'owner' then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  select * into v_target from household_members where id = p_member_id and household_id = p_household_id and deleted_at is null;
  if v_target is null then raise exception using errcode = 'P0001', message = 'member_not_found'; end if;

  if v_target.role = 'owner' then
    select count(*) into v_owner_count from household_members where household_id = p_household_id and role = 'owner' and deleted_at is null and id <> p_member_id;
    if v_owner_count = 0 then raise exception using errcode = 'P0001', message = 'last_owner'; end if;
  end if;

  select count(*) into v_account_count from accounts where owner_member_id = p_member_id and deleted_at is null;
  if v_account_count > 0 and p_reassign_to_member_id is null then
    raise exception using errcode = 'P0001', message = 'reassign_required';
  end if;
  if v_account_count > 0 then
    update accounts set owner_member_id = (case when p_reassign_to_member_id = '00000000-0000-0000-0000-000000000000'::uuid then null else p_reassign_to_member_id end)
    where owner_member_id = p_member_id and deleted_at is null;
  end if;

  update budgets set deleted_at = now() where member_id = p_member_id and deleted_at is null;
  update api_keys set revoked_at = now() where member_id = p_member_id and revoked_at is null;
  update household_members set deleted_at = now() where id = p_member_id;
end;
$$;


ALTER FUNCTION "public"."remove_member"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_reassign_to_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_query" "text", "p_prefer_own" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."resolve_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_query" "text", "p_prefer_own" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_category"("p_household_id" "uuid", "p_query" "text", "p_type" "public"."tx_type" DEFAULT NULL::"public"."tx_type") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."resolve_category"("p_household_id" "uuid", "p_query" "text", "p_type" "public"."tx_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_member"("p_household_id" "uuid", "p_query" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."resolve_member"("p_household_id" "uuid", "p_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") RETURNS "public"."transactions"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_tx transactions; v_result transactions;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_tx from transactions where id = p_id and household_id = p_household_id and deleted_at is not null for update;
  if v_tx is null then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;

  if v_tx.recurring_id is not null and exists (
    select 1 from transactions where recurring_id = v_tx.recurring_id and date = v_tx.date and deleted_at is null and id <> v_tx.id
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate_recurring_execution';
  end if;

  if v_tx.type in ('expense','transfer') and account_balance(v_tx.account_id) < v_tx.amount then
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(v_tx.account_id), 'needed', v_tx.amount)::text;
  end if;

  update transactions set deleted_at = null, deleted_by_member_id = null, updated_at = now()
  where id = p_id returning * into v_result;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."restore_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_due_recurrings"("p_household_id" "uuid" DEFAULT NULL::"uuid", "p_today" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."run_due_recurrings"("p_household_id" "uuid", "p_today" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_household_categories"("p_household_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into categories (household_id, name, type, icon, aliases, is_system, system_key, sort_order) values
    (p_household_id, 'Makanan', 'expense', '🍔', '{makan,jajan,kuliner,minum,sayur,belanja dapur}', false, null, 10),
    (p_household_id, 'Transport', 'expense', '🚗', '{bensin,ojek,grab,gojek,parkir,tol}', false, null, 20),
    (p_household_id, 'Kos/Sewa', 'expense', '🏠', '{sewa,kontrakan,kos}', false, null, 30),
    (p_household_id, 'Hiburan', 'expense', '🎬', '{nonton,game,langganan}', false, null, 40),
    (p_household_id, 'Shopping', 'expense', '🛍️', '{belanja,baju}', false, null, 50),
    (p_household_id, 'Utilitas', 'expense', '⚡', '{listrik,air,internet,pulsa,wifi}', false, null, 60),
    (p_household_id, 'Kesehatan', 'expense', '💊', '{obat,dokter,rs}', false, null, 70),
    (p_household_id, 'Pendidikan', 'expense', '📚', '{sekolah,kursus,buku}', false, null, 80),
    (p_household_id, 'Donasi', 'expense', '❤️', '{sedekah,zakat,infak}', false, null, 90),
    (p_household_id, 'Lainnya', 'both', '📦', '{}', false, null, 100),
    (p_household_id, 'Gaji', 'income', '💰', '{gajian,salary}', false, null, 110),
    (p_household_id, 'Freelance', 'income', '💼', '{project,sampingan}', false, null, 120),
    (p_household_id, 'Bisnis', 'income', '📊', '{usaha,jualan}', false, null, 130),
    (p_household_id, 'Investasi', 'income', '📈', '{dividen,cuan}', false, null, 140),
    (p_household_id, 'Transfer', 'both', '🔄', '{}', true, 'transfer', 200),
    (p_household_id, 'Koreksi Saldo', 'both', '⚖️', '{}', true, 'balance_adjustment', 210),
    (p_household_id, 'Hutang & Cicilan', 'expense', '📋', '{cicilan,angsuran,hutang}', true, 'debt_payment', 220),
    (p_household_id, 'Tabungan & Goal', 'expense', '🎯', '{nabung,tabungan}', true, 'goal_saving', 230),
    (p_household_id, 'Piutang', 'both', '🤝', '{}', true, 'piutang', 240)
  on conflict do nothing;
end;
$$;


ALTER FUNCTION "public"."seed_household_categories"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."today_in_tz"("p_household_id" "uuid") RETURNS "date"
    LANGUAGE "sql" STABLE
    AS $$
  select (now() at time zone (select timezone from households where id = p_household_id))::date;
$$;


ALTER FUNCTION "public"."today_in_tz"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."topup_goal"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_goal_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare v_actor household_members; v_goal goals; v_tx transactions; v_contribution goal_contributions; v_cat_id uuid; v_current bigint; v_target bigint;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_goal from goals where id = p_goal_id and household_id = p_household_id and deleted_at is null for update;
  if v_goal is null then raise exception using errcode = 'P0001', message = 'goal_not_found'; end if;

  if p_account_id is not null then
    select id into v_cat_id from categories where household_id = p_household_id and system_key = 'goal_saving';
    v_tx := post_transaction(p_household_id, p_actor_member_id, 'expense', p_account_id, v_cat_id, p_amount, p_date,
              coalesce(nullif(p_note,''), 'Tabungan: ' || v_goal.name), 'web');
    insert into goal_contributions (goal_id, transaction_id, member_id, amount, date, note)
    values (p_goal_id, v_tx.id, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
    returning * into v_contribution;
  else
    insert into goal_contributions (goal_id, transaction_id, member_id, amount, date, note)
    values (p_goal_id, null, p_actor_member_id, p_amount, p_date, coalesce(p_note,''))
    returning * into v_contribution;
  end if;

  select current, target into v_current, v_target from v_goals_full where id = p_goal_id;

  return jsonb_build_object('transaction', to_jsonb(v_tx), 'contribution', to_jsonb(v_contribution),
    'goal', to_jsonb((select g from v_goals_full g where id = p_goal_id)), 'reached', v_current >= v_target);
end;
$$;


ALTER FUNCTION "public"."topup_goal"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_goal_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tx_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare v_hh uuid;
begin
  select household_id into v_hh from accounts where id = new.account_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"account_id","reason":"different_household"}';
  end if;
  if new.to_account_id is not null then
    select household_id into v_hh from accounts where id = new.to_account_id;
    if v_hh is distinct from new.household_id then
      raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"to_account_id","reason":"different_household"}';
    end if;
  end if;
  select household_id into v_hh from categories where id = new.category_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"category_id","reason":"different_household"}';
  end if;
  select household_id into v_hh from household_members where id = new.recorded_by_member_id;
  if v_hh is distinct from new.household_id then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"recorded_by_member_id","reason":"different_household"}';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."tx_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid", "p_patch" "jsonb") RETURNS "public"."transactions"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_actor household_members; v_orig transactions; v_new_amount bigint; v_new_type tx_type; v_new_account uuid;
  v_new_category uuid; v_new_date date; v_cat categories; v_result transactions;
begin
  v_actor := assert_actor(p_household_id, p_actor_member_id);
  select * into v_orig from transactions where id = p_id and household_id = p_household_id and deleted_at is null for update;
  if v_orig is null then raise exception using errcode = 'P0001', message = 'transaction_not_found'; end if;

  if v_orig.type = 'transfer' then
    if (p_patch ? 'amount') or (p_patch ? 'type') or (p_patch ? 'account_id') then
      raise exception using errcode = 'P0001', message = 'transfer_edit_limited';
    end if;
    update transactions set note = coalesce(p_patch->>'note', note), date = coalesce((p_patch->>'date')::date, date), updated_at = now()
    where id = p_id returning * into v_result;
    return v_result;
  end if;

  v_new_amount := coalesce((p_patch->>'amount')::bigint, v_orig.amount);
  v_new_type := coalesce((p_patch->>'type')::tx_type, v_orig.type);
  v_new_account := coalesce((p_patch->>'account_id')::uuid, v_orig.account_id);
  v_new_category := coalesce((p_patch->>'category_id')::uuid, v_orig.category_id);
  v_new_date := coalesce((p_patch->>'date')::date, v_orig.date);

  if v_new_type = 'transfer' or v_orig.type = 'transfer' then
    raise exception using errcode = 'P0001', message = 'transfer_edit_limited';
  end if;

  perform id from accounts where id in (v_orig.account_id, v_new_account) order by id for update;

  select * into v_cat from categories where id = v_new_category and household_id = p_household_id and deleted_at is null;
  if v_cat is null then raise exception using errcode = 'P0001', message = 'category_not_found'; end if;
  if v_new_type = 'income' and v_cat.type not in ('income','both') then raise exception using errcode='P0001', message='category_type_mismatch'; end if;
  if v_new_type = 'expense' and v_cat.type not in ('expense','both') then raise exception using errcode='P0001', message='category_type_mismatch'; end if;

  update transactions set deleted_at = now() where id = p_id;

  if v_new_type = 'expense' and account_balance(v_new_account) < v_new_amount then
    update transactions set deleted_at = null where id = p_id;
    raise exception using errcode = 'P0001', message = 'insufficient_funds',
      detail = jsonb_build_object('balance', account_balance(v_new_account), 'needed', v_new_amount)::text;
  end if;

  update transactions set
    amount = v_new_amount, type = v_new_type, account_id = v_new_account, category_id = v_new_category,
    date = v_new_date, note = coalesce(p_patch->>'note', note), deleted_at = null, updated_at = now()
  where id = p_id returning * into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."update_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid", "p_patch" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_timezone"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.timezone is null or new.timezone not in (select name from pg_timezone_names) then
    raise exception using errcode = 'P0001', message = 'validation_error', detail = '{"field":"timezone"}';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_timezone"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "key_hash" "bytea" NOT NULL,
    "scope" "public"."api_key_scope" DEFAULT 'write'::"public"."api_key_scope" NOT NULL,
    "expires_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "last_used_ip" "inet",
    "revoked_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "api_keys_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 60)))
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."api_keys" IS 'Kunci jangka panjang untuk agent. Full key hanya dikembalikan sekali saat POST /v1/api-keys.';



CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "household_id" "uuid",
    "actor_member_id" "uuid",
    "credential_type" "public"."credential_type" NOT NULL,
    "api_key_id" "uuid",
    "request_id" "text" NOT NULL,
    "idempotency_key" "text",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "http_status" integer NOT NULL,
    "payload" "jsonb",
    "ip" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_log_id_seq" OWNED BY "public"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "period_start" "date" NOT NULL,
    "amount" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "budgets_amount_check" CHECK ((("amount" > 0) AND ("amount" <= '100000000000'::bigint))),
    CONSTRAINT "budgets_period_start_check" CHECK (("period_start" = ("date_trunc"('month'::"text", ("period_start")::timestamp with time zone))::"date"))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debt_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "debt_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "member_id" "uuid" NOT NULL,
    "amount" bigint NOT NULL,
    "date" "date" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "debt_payments_amount_check" CHECK (("amount" > 0))
);


ALTER TABLE "public"."debt_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "owner_member_id" "uuid",
    "name" "text" NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "total" bigint NOT NULL,
    "opening_paid" bigint DEFAULT 0 NOT NULL,
    "monthly" bigint DEFAULT 0 NOT NULL,
    "due_date" "date",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "icon" "text" DEFAULT '📋'::"text" NOT NULL,
    "color" "text" DEFAULT '#ef4444'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "debts_monthly_check" CHECK (("monthly" >= 0)),
    CONSTRAINT "debts_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 80))),
    CONSTRAINT "debts_opening_paid_check" CHECK (("opening_paid" >= 0)),
    CONSTRAINT "debts_total_check" CHECK (("total" > 0))
);


ALTER TABLE "public"."debts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "member_id" "uuid" NOT NULL,
    "amount" bigint NOT NULL,
    "date" "date" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_contributions_amount_check" CHECK (("amount" <> 0))
);


ALTER TABLE "public"."goal_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "owner_member_id" "uuid",
    "name" "text" NOT NULL,
    "target" bigint NOT NULL,
    "opening_amount" bigint DEFAULT 0 NOT NULL,
    "deadline" "date",
    "icon" "text" DEFAULT '🎯'::"text" NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "goals_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 80))),
    CONSTRAINT "goals_opening_amount_check" CHECK (("opening_amount" >= 0)),
    CONSTRAINT "goals_target_check" CHECK (("target" > 0))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gold_prices" (
    "id" bigint NOT NULL,
    "brand" "text" NOT NULL,
    "tanggal" "text",
    "data" "jsonb" NOT NULL,
    "scraped_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gold_prices" OWNER TO "postgres";


ALTER TABLE "public"."gold_prices" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."gold_prices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Jakarta'::"text" NOT NULL,
    "currency" "text" DEFAULT 'IDR'::"text" NOT NULL,
    "default_account_visibility" "public"."account_visibility" DEFAULT 'shared'::"public"."account_visibility" NOT NULL,
    "owners_can_view_private_totals" boolean DEFAULT false NOT NULL,
    "merged_into_household_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "households_currency_check" CHECK (("currency" = 'IDR'::"text")),
    CONSTRAINT "households_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 80)))
);


ALTER TABLE "public"."households" OWNER TO "postgres";


COMMENT ON COLUMN "public"."households"."timezone" IS 'Zona waktu untuk evaluasi period (this_month, today) dan tanggal default transaksi.';



COMMENT ON COLUMN "public"."households"."currency" IS 'Hardcode IDR. Non-tujuan multi-currency.';



COMMENT ON COLUMN "public"."households"."owners_can_view_private_totals" IS 'Bila true, owner boleh melihat ringkasan (bukan rincian) member lain yang punya akun privat. Lihat Q-05.';



COMMENT ON COLUMN "public"."households"."merged_into_household_id" IS 'Terisi bila household ini digabung ke household lain saat accept undangan mode merge.';



CREATE TABLE IF NOT EXISTS "public"."idempotency_keys" (
    "credential_type" "public"."credential_type" NOT NULL,
    "credential_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "request_hash" "bytea" NOT NULL,
    "status" "text" NOT NULL,
    "response_status" integer,
    "response_body" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    CONSTRAINT "idempotency_keys_key_check" CHECK ((("length"("key") >= 1) AND ("length"("key") <= 128))),
    CONSTRAINT "idempotency_keys_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "owner_member_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "icon" "text",
    "color" "text",
    "brand" "text",
    "buy_price" bigint DEFAULT 0 NOT NULL,
    "current_value" bigint DEFAULT 0 NOT NULL,
    "quantity" numeric(18,6),
    "unit" "text" DEFAULT 'unit'::"text" NOT NULL,
    "kode_saham" "text",
    "buy_date" "date",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "investments_type_check" CHECK (("type" = ANY (ARRAY['emas'::"text", 'saham'::"text", 'reksa_dana'::"text", 'crypto'::"text", 'properti'::"text", 'lainnya'::"text"])))
);


ALTER TABLE "public"."investments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."migration_issues" (
    "id" bigint NOT NULL,
    "phase" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "row_id" "uuid",
    "issue" "text" NOT NULL,
    "detail" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."migration_issues" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."migration_issues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."migration_issues_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."migration_issues_id_seq" OWNED BY "public"."migration_issues"."id";



CREATE TABLE IF NOT EXISTS "public"."piutang" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "owner_member_id" "uuid",
    "borrower_name" "text" NOT NULL,
    "total" bigint NOT NULL,
    "opening_received" bigint DEFAULT 0 NOT NULL,
    "from_account_id" "uuid",
    "due_date" "date",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "icon" "text" DEFAULT '🤝'::"text" NOT NULL,
    "color" "text" DEFAULT '#60fcc6'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "lend_transaction_id" "uuid",
    CONSTRAINT "piutang_borrower_name_check" CHECK ((("length"("borrower_name") >= 1) AND ("length"("borrower_name") <= 80))),
    CONSTRAINT "piutang_opening_received_check" CHECK (("opening_received" >= 0)),
    CONSTRAINT "piutang_total_check" CHECK (("total" > 0))
);


ALTER TABLE "public"."piutang" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piutang_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "piutang_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "member_id" "uuid" NOT NULL,
    "amount" bigint NOT NULL,
    "date" "date" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "piutang_receipts_amount_check" CHECK (("amount" > 0))
);


ALTER TABLE "public"."piutang_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_counters" (
    "api_key_id" "uuid" NOT NULL,
    "window_kind" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "rate_limit_counters_window_kind_check" CHECK (("window_kind" = ANY (ARRAY['minute'::"text", 'day'::"text"])))
);


ALTER TABLE "public"."rate_limit_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."tx_type" DEFAULT 'expense'::"public"."tx_type" NOT NULL,
    "amount" bigint NOT NULL,
    "category_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "frequency" "public"."recurring_frequency" NOT NULL,
    "anchor_day" smallint,
    "next_date" "date" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "debt_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "last_run_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "recurring_transactions_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "recurring_transactions_anchor_day_check" CHECK ((("anchor_day" >= 1) AND ("anchor_day" <= 31))),
    CONSTRAINT "recurring_transactions_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 80))),
    CONSTRAINT "recurring_transactions_type_check" CHECK (("type" <> 'transfer'::"public"."tx_type"))
);


ALTER TABLE "public"."recurring_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_bill_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" bigint NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "split_bill_members_amount_check" CHECK (("amount" > 0))
);


ALTER TABLE "public"."split_bill_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "created_by_member_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "total_amount" bigint NOT NULL,
    "date" "date" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "split_bills_total_amount_check" CHECK (("total_amount" > 0))
);


ALTER TABLE "public"."split_bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'trial'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "payment_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "active_household_id" "uuid",
    "avatar_color" "text" DEFAULT '#60fcc6'::"text" NOT NULL,
    "hidden_menus" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "app_name" "text" DEFAULT 'Karaya'::"text" NOT NULL,
    "app_tagline" "text" DEFAULT 'Wealth Ledger'::"text" NOT NULL,
    "language" "text" DEFAULT 'id'::"text" NOT NULL,
    "theme" "text" DEFAULT 'dark'::"text" NOT NULL,
    "ai_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_account_balances" AS
SELECT
    NULL::"uuid" AS "account_id",
    NULL::"uuid" AS "household_id",
    NULL::numeric AS "balance",
    NULL::bigint AS "tx_count",
    NULL::"date" AS "last_tx_date";


ALTER VIEW "public"."v_account_balances" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_account_balances" IS 'balance/tx_count/last_tx_date NULL kalau caller tidak can_view_account (akun privat milik orang lain) — defense in depth selain filtering di apps/api.';



CREATE OR REPLACE VIEW "public"."v_api_keys" WITH ("security_invoker"='on') AS
 SELECT "id",
    "household_id",
    "member_id",
    "name",
    "key_prefix",
    "scope",
    "expires_at",
    "last_used_at",
    "last_used_ip",
    "revoked_at",
    "created_by",
    "created_at"
   FROM "public"."api_keys";


ALTER VIEW "public"."v_api_keys" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_debts" WITH ("security_invoker"='on') AS
 SELECT "id",
    "household_id",
    "owner_member_id",
    "name",
    "aliases",
    "total",
    "opening_paid",
    "monthly",
    "due_date",
    "notes",
    "icon",
    "color",
    "created_at",
    "updated_at",
    "deleted_at",
    GREATEST((0)::numeric, (((("total" - "opening_paid"))::numeric - COALESCE(( SELECT "sum"("p"."amount") AS "sum"
           FROM ("public"."debt_payments" "p"
             JOIN "public"."transactions" "t" ON (("t"."id" = "p"."transaction_id")))
          WHERE (("p"."debt_id" = "d"."id") AND ("t"."deleted_at" IS NULL))), (0)::numeric)) - COALESCE(( SELECT "sum"("p"."amount") AS "sum"
           FROM "public"."debt_payments" "p"
          WHERE (("p"."debt_id" = "d"."id") AND ("p"."transaction_id" IS NULL))), (0)::numeric))) AS "remaining"
   FROM "public"."debts" "d";


ALTER VIEW "public"."v_debts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_goals" WITH ("security_invoker"='on') AS
 SELECT "id",
    "household_id",
    "owner_member_id",
    "name",
    "target",
    "opening_amount",
    "deadline",
    "icon",
    "color",
    "created_at",
    "updated_at",
    "deleted_at",
    ((("opening_amount")::numeric + COALESCE(( SELECT "sum"("c"."amount") AS "sum"
           FROM ("public"."goal_contributions" "c"
             JOIN "public"."transactions" "t" ON (("t"."id" = "c"."transaction_id")))
          WHERE (("c"."goal_id" = "g"."id") AND ("t"."deleted_at" IS NULL))), (0)::numeric)) + COALESCE(( SELECT "sum"("c"."amount") AS "sum"
           FROM "public"."goal_contributions" "c"
          WHERE (("c"."goal_id" = "g"."id") AND ("c"."transaction_id" IS NULL))), (0)::numeric)) AS "current"
   FROM "public"."goals" "g";


ALTER VIEW "public"."v_goals" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_goals_full" WITH ("security_invoker"='on') AS
 SELECT "id",
    "household_id",
    "owner_member_id",
    "name",
    "target",
    "opening_amount",
    "deadline",
    "icon",
    "color",
    "created_at",
    "updated_at",
    "deleted_at",
    "current",
    ("current" >= ("target")::numeric) AS "reached"
   FROM "public"."v_goals" "g";


ALTER VIEW "public"."v_goals_full" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_piutang" WITH ("security_invoker"='on') AS
 SELECT "id",
    "household_id",
    "owner_member_id",
    "borrower_name",
    "total",
    "opening_received",
    "from_account_id",
    "due_date",
    "notes",
    "icon",
    "color",
    "created_at",
    "updated_at",
    "deleted_at",
    "lend_transaction_id",
    GREATEST((0)::numeric, (((("total" - "opening_received"))::numeric - COALESCE(( SELECT "sum"("r"."amount") AS "sum"
           FROM ("public"."piutang_receipts" "r"
             JOIN "public"."transactions" "t" ON (("t"."id" = "r"."transaction_id")))
          WHERE (("r"."piutang_id" = "p"."id") AND ("t"."deleted_at" IS NULL))), (0)::numeric)) - COALESCE(( SELECT "sum"("r"."amount") AS "sum"
           FROM "public"."piutang_receipts" "r"
          WHERE (("r"."piutang_id" = "p"."id") AND ("r"."transaction_id" IS NULL))), (0)::numeric))) AS "remaining"
   FROM "public"."piutang" "p";


ALTER VIEW "public"."v_piutang" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_transactions" WITH ("security_invoker"='on') AS
 SELECT "t"."id",
    "t"."household_id",
    "t"."type",
    "t"."amount",
    "t"."account_id",
    "t"."to_account_id",
    "t"."category_id",
    "t"."note",
    "t"."date",
    "t"."recorded_by_member_id",
    "t"."source",
    "t"."recurring_id",
    "t"."created_at",
    "t"."updated_at",
    "t"."deleted_at",
    "t"."deleted_by_member_id",
    "a"."name" AS "account_name",
    "a"."owner_member_id" AS "account_owner_member_id",
    "a"."visibility" AS "account_visibility",
    "ta"."name" AS "to_account_name",
    "ta"."owner_member_id" AS "to_account_owner_member_id",
    "c"."name" AS "category_name",
    "c"."icon" AS "category_icon",
    "c"."color" AS "category_color",
    "rm"."display_name" AS "recorded_by_display_name"
   FROM (((("public"."transactions" "t"
     JOIN "public"."accounts" "a" ON (("a"."id" = "t"."account_id")))
     LEFT JOIN "public"."accounts" "ta" ON (("ta"."id" = "t"."to_account_id")))
     JOIN "public"."categories" "c" ON (("c"."id" = "t"."category_id")))
     JOIN "public"."household_members" "rm" ON (("rm"."id" = "t"."recorded_by_member_id")))
  WHERE ("t"."deleted_at" IS NULL);


ALTER VIEW "public"."v_transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."migration_issues" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."migration_issues_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_contributions"
    ADD CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_contributions"
    ADD CONSTRAINT "goal_contributions_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gold_prices"
    ADD CONSTRAINT "gold_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_household_id_user_id_key" UNIQUE ("household_id", "user_id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("credential_type", "credential_id", "key");



ALTER TABLE ONLY "public"."investments"
    ADD CONSTRAINT "investments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migration_issues"
    ADD CONSTRAINT "migration_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_lend_transaction_id_key" UNIQUE ("lend_transaction_id");



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piutang_receipts"
    ADD CONSTRAINT "piutang_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piutang_receipts"
    ADD CONSTRAINT "piutang_receipts_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."rate_limit_counters"
    ADD CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("api_key_id", "window_kind", "window_start");



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_bill_members"
    ADD CONSTRAINT "split_bill_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_bills"
    ADD CONSTRAINT "split_bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_bills"
    ADD CONSTRAINT "split_bills_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "accounts_household_idx" ON "public"."accounts" USING "btree" ("household_id") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "accounts_name_per_owner_uq" ON "public"."accounts" USING "btree" ("household_id", COALESCE("owner_member_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("name")) WHERE ("deleted_at" IS NULL);



CREATE INDEX "accounts_name_trgm_idx" ON "public"."accounts" USING "gin" ("lower"("name") "public"."gin_trgm_ops");



CREATE INDEX "api_keys_prefix_idx" ON "public"."api_keys" USING "btree" ("key_prefix") WHERE ("revoked_at" IS NULL);



CREATE INDEX "audit_log_api_key_idx" ON "public"."audit_log" USING "btree" ("api_key_id", "created_at" DESC) WHERE ("api_key_id" IS NOT NULL);



CREATE INDEX "audit_log_household_time_idx" ON "public"."audit_log" USING "btree" ("household_id", "created_at" DESC);



CREATE INDEX "budgets_period_idx" ON "public"."budgets" USING "btree" ("household_id", "period_start") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "budgets_uq" ON "public"."budgets" USING "btree" ("household_id", "category_id", COALESCE("member_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "period_start") WHERE ("deleted_at" IS NULL);



CREATE INDEX "categories_name_trgm_idx" ON "public"."categories" USING "gin" ("lower"("name") "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "categories_name_uq" ON "public"."categories" USING "btree" ("household_id", "lower"("name")) WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "categories_system_key_uq" ON "public"."categories" USING "btree" ("household_id", "system_key") WHERE ("system_key" IS NOT NULL);



CREATE INDEX "debt_payments_debt_idx" ON "public"."debt_payments" USING "btree" ("debt_id");



CREATE INDEX "debts_household_idx" ON "public"."debts" USING "btree" ("household_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "debts_name_trgm_idx" ON "public"."debts" USING "gin" ("lower"("name") "public"."gin_trgm_ops");



CREATE INDEX "goal_contributions_goal_idx" ON "public"."goal_contributions" USING "btree" ("goal_id");



CREATE INDEX "goals_household_idx" ON "public"."goals" USING "btree" ("household_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "gold_prices_brand_scraped" ON "public"."gold_prices" USING "btree" ("brand", "scraped_at" DESC);



CREATE INDEX "household_invitations_pending_idx" ON "public"."household_invitations" USING "btree" ("household_id") WHERE ("status" = 'pending'::"public"."invitation_status");



CREATE UNIQUE INDEX "household_members_active_name_uq" ON "public"."household_members" USING "btree" ("household_id", "lower"("display_name")) WHERE ("deleted_at" IS NULL);



CREATE INDEX "household_members_user_idx" ON "public"."household_members" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idempotency_expires_idx" ON "public"."idempotency_keys" USING "btree" ("expires_at");



CREATE INDEX "investments_household_idx" ON "public"."investments" USING "btree" ("household_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "piutang_household_idx" ON "public"."piutang" USING "btree" ("household_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "piutang_receipts_piutang_idx" ON "public"."piutang_receipts" USING "btree" ("piutang_id");



CREATE INDEX "recurring_due_idx" ON "public"."recurring_transactions" USING "btree" ("next_date") WHERE ("active" AND ("deleted_at" IS NULL));



CREATE INDEX "recurring_household_idx" ON "public"."recurring_transactions" USING "btree" ("household_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "split_bill_members_bill_idx" ON "public"."split_bill_members" USING "btree" ("bill_id");



CREATE INDEX "split_bills_household_idx" ON "public"."split_bills" USING "btree" ("household_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "tx_account_idx" ON "public"."transactions" USING "btree" ("account_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "tx_category_idx" ON "public"."transactions" USING "btree" ("household_id", "category_id", "date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "tx_household_date_idx" ON "public"."transactions" USING "btree" ("household_id", "date" DESC, "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "tx_note_trgm_idx" ON "public"."transactions" USING "gin" ("lower"("note") "public"."gin_trgm_ops");



CREATE INDEX "tx_recorded_by_idx" ON "public"."transactions" USING "btree" ("recorded_by_member_id", "date") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "tx_recurring_once_per_date_uq" ON "public"."transactions" USING "btree" ("recurring_id", "date") WHERE (("recurring_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "tx_to_account_idx" ON "public"."transactions" USING "btree" ("to_account_id") WHERE (("deleted_at" IS NULL) AND ("to_account_id" IS NOT NULL));



CREATE OR REPLACE VIEW "public"."v_account_balances" WITH ("security_invoker"='on') AS
 SELECT "a"."id" AS "account_id",
    "a"."household_id",
        CASE
            WHEN "public"."can_view_account"("a"."id") THEN ((((("a"."opening_balance")::numeric + COALESCE("sum"(
            CASE
                WHEN (("t"."type" = 'income'::"public"."tx_type") AND ("t"."account_id" = "a"."id")) THEN "t"."amount"
                ELSE NULL::bigint
            END), (0)::numeric)) - COALESCE("sum"(
            CASE
                WHEN (("t"."type" = 'expense'::"public"."tx_type") AND ("t"."account_id" = "a"."id")) THEN "t"."amount"
                ELSE NULL::bigint
            END), (0)::numeric)) - COALESCE("sum"(
            CASE
                WHEN (("t"."type" = 'transfer'::"public"."tx_type") AND ("t"."account_id" = "a"."id")) THEN "t"."amount"
                ELSE NULL::bigint
            END), (0)::numeric)) + COALESCE("sum"(
            CASE
                WHEN (("t"."type" = 'transfer'::"public"."tx_type") AND ("t"."to_account_id" = "a"."id")) THEN "t"."amount"
                ELSE NULL::bigint
            END), (0)::numeric))
            ELSE NULL::numeric
        END AS "balance",
        CASE
            WHEN "public"."can_view_account"("a"."id") THEN "count"("t"."id") FILTER (WHERE ("t"."id" IS NOT NULL))
            ELSE NULL::bigint
        END AS "tx_count",
        CASE
            WHEN "public"."can_view_account"("a"."id") THEN "max"("t"."date")
            ELSE NULL::"date"
        END AS "last_tx_date"
   FROM ("public"."accounts" "a"
     LEFT JOIN "public"."transactions" "t" ON ((("t"."deleted_at" IS NULL) AND (("t"."account_id" = "a"."id") OR ("t"."to_account_id" = "a"."id")))))
  GROUP BY "a"."id";



CREATE OR REPLACE TRIGGER "accounts_set_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "budgets_set_updated_at" BEFORE UPDATE ON "public"."budgets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "categories_set_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "debts_set_updated_at" BEFORE UPDATE ON "public"."debts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "goals_set_updated_at" BEFORE UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "household_invitations_set_updated_at" BEFORE UPDATE ON "public"."household_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "household_members_set_updated_at" BEFORE UPDATE ON "public"."household_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "households_set_updated_at" BEFORE UPDATE ON "public"."households" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "households_validate_timezone" BEFORE INSERT OR UPDATE OF "timezone" ON "public"."households" FOR EACH ROW EXECUTE FUNCTION "public"."validate_timezone"();



CREATE OR REPLACE TRIGGER "investments_set_updated_at" BEFORE UPDATE ON "public"."investments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "piutang_set_updated_at" BEFORE UPDATE ON "public"."piutang" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "recurring_fill_anchor_day" BEFORE INSERT ON "public"."recurring_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."recurring_fill_anchor_day"();



CREATE OR REPLACE TRIGGER "recurring_set_updated_at" BEFORE UPDATE ON "public"."recurring_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "split_bills_set_updated_at" BEFORE UPDATE ON "public"."split_bills" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tx_same_household" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."tx_same_household"();



CREATE OR REPLACE TRIGGER "tx_set_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."goal_contributions"
    ADD CONSTRAINT "goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_contributions"
    ADD CONSTRAINT "goal_contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."goal_contributions"
    ADD CONSTRAINT "goal_contributions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_merged_into_household_id_fkey" FOREIGN KEY ("merged_into_household_id") REFERENCES "public"."households"("id");



ALTER TABLE ONLY "public"."investments"
    ADD CONSTRAINT "investments_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investments"
    ADD CONSTRAINT "investments_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_lend_transaction_id_fkey" FOREIGN KEY ("lend_transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."piutang_receipts"
    ADD CONSTRAINT "piutang_receipts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."piutang_receipts"
    ADD CONSTRAINT "piutang_receipts_piutang_id_fkey" FOREIGN KEY ("piutang_id") REFERENCES "public"."piutang"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piutang_receipts"
    ADD CONSTRAINT "piutang_receipts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."rate_limit_counters"
    ADD CONSTRAINT "rate_limit_counters_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."split_bill_members"
    ADD CONSTRAINT "split_bill_members_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."split_bills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_bills"
    ADD CONSTRAINT "split_bills_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."split_bills"
    ADD CONSTRAINT "split_bills_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_bills"
    ADD CONSTRAINT "split_bills_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_deleted_by_member_id_fkey" FOREIGN KEY ("deleted_by_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_recorded_by_member_id_fkey" FOREIGN KEY ("recorded_by_member_id") REFERENCES "public"."household_members"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_active_household_id_fkey" FOREIGN KEY ("active_household_id") REFERENCES "public"."households"("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts_insert" ON "public"."accounts" FOR INSERT WITH CHECK (("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])));



CREATE POLICY "accounts_select" ON "public"."accounts" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "accounts_update" ON "public"."accounts" FOR UPDATE USING ((("public"."member_role_in"("household_id") = 'owner'::"public"."member_role") OR ("owner_member_id" IN ( SELECT "public"."current_member_ids"() AS "current_member_ids"))));



CREATE POLICY "anon insert" ON "public"."gold_prices" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "api_keys_select" ON "public"."api_keys" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select" ON "public"."audit_log" FOR SELECT USING (("public"."member_role_in"("household_id") = 'owner'::"public"."member_role"));



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budgets_select" ON "public"."budgets" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "budgets_write" ON "public"."budgets" USING (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))) WITH CHECK (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "categories_update" ON "public"."categories" FOR UPDATE USING (("public"."member_role_in"("household_id") = 'owner'::"public"."member_role"));



CREATE POLICY "categories_write" ON "public"."categories" FOR INSERT WITH CHECK (("public"."member_role_in"("household_id") = 'owner'::"public"."member_role"));



ALTER TABLE "public"."debt_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debt_payments_select" ON "public"."debt_payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."debts" "d"
  WHERE (("d"."id" = "debt_payments"."debt_id") AND "public"."is_household_member"("d"."household_id")))));



ALTER TABLE "public"."debts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debts_select" ON "public"."debts" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "debts_write" ON "public"."debts" USING (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))) WITH CHECK (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))));



CREATE POLICY "goal_contrib_select" ON "public"."goal_contributions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."goals" "g"
  WHERE (("g"."id" = "goal_contributions"."goal_id") AND "public"."is_household_member"("g"."household_id")))));



ALTER TABLE "public"."goal_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals_select" ON "public"."goals" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "goals_write" ON "public"."goals" USING (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))) WITH CHECK (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))));



ALTER TABLE "public"."gold_prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."household_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."household_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "households_select" ON "public"."households" FOR SELECT USING ("public"."is_household_member"("id"));



CREATE POLICY "households_update" ON "public"."households" FOR UPDATE USING (("public"."member_role_in"("id") = 'owner'::"public"."member_role"));



ALTER TABLE "public"."investments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investments_select" ON "public"."investments" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "investments_write" ON "public"."investments" USING (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))) WITH CHECK (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))));



CREATE POLICY "invitations_select" ON "public"."household_invitations" FOR SELECT USING (("public"."member_role_in"("household_id") = 'owner'::"public"."member_role"));



CREATE POLICY "members_select" ON "public"."household_members" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."piutang" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."piutang_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "piutang_receipts_select" ON "public"."piutang_receipts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."piutang" "p"
  WHERE (("p"."id" = "piutang_receipts"."piutang_id") AND "public"."is_household_member"("p"."household_id")))));



CREATE POLICY "piutang_select" ON "public"."piutang" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "piutang_write" ON "public"."piutang" USING (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))) WITH CHECK (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))));



CREATE POLICY "public read" ON "public"."gold_prices" FOR SELECT USING (true);



CREATE POLICY "recurring_select" ON "public"."recurring_transactions" FOR SELECT USING ("public"."is_household_member"("household_id"));



ALTER TABLE "public"."recurring_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_write" ON "public"."recurring_transactions" USING (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))) WITH CHECK (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))));



ALTER TABLE "public"."split_bill_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "split_bill_members_select" ON "public"."split_bill_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."split_bills" "b"
  WHERE (("b"."id" = "split_bill_members"."bill_id") AND "public"."is_household_member"("b"."household_id")))));



CREATE POLICY "split_bill_members_write" ON "public"."split_bill_members" USING ((EXISTS ( SELECT 1
   FROM "public"."split_bills" "b"
  WHERE (("b"."id" = "split_bill_members"."bill_id") AND ("public"."member_role_in"("b"."household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."split_bills" "b"
  WHERE (("b"."id" = "split_bill_members"."bill_id") AND ("public"."member_role_in"("b"."household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))))));



ALTER TABLE "public"."split_bills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "split_bills_select" ON "public"."split_bills" FOR SELECT USING ("public"."is_household_member"("household_id"));



CREATE POLICY "split_bills_write" ON "public"."split_bills" USING (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"])))) WITH CHECK (("public"."is_household_member"("household_id") AND ("public"."member_role_in"("household_id") = ANY (ARRAY['owner'::"public"."member_role", 'member'::"public"."member_role"]))));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_select" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tx_insert" ON "public"."transactions" FOR INSERT WITH CHECK (("public"."can_post_to_account"("account_id") AND (("to_account_id" IS NULL) OR "public"."is_household_member"("household_id"))));



CREATE POLICY "tx_select" ON "public"."transactions" FOR SELECT USING (("public"."is_household_member"("household_id") AND ("public"."can_view_account"("account_id") OR (("to_account_id" IS NOT NULL) AND "public"."can_view_account"("to_account_id")))));



CREATE POLICY "tx_update" ON "public"."transactions" FOR UPDATE USING ("public"."can_post_to_account"("account_id"));



ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_settings_own" ON "public"."user_settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "karaya_api";



GRANT ALL ON TABLE "public"."household_members" TO "anon";
GRANT ALL ON TABLE "public"."household_members" TO "authenticated";
GRANT ALL ON TABLE "public"."household_members" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invitation"("p_code" "text", "p_user_id" "uuid", "p_display_name" "text", "p_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_code" "text", "p_user_id" "uuid", "p_display_name" "text", "p_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_code" "text", "p_user_id" "uuid", "p_display_name" "text", "p_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."account_balance"("p_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."account_balance"("p_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."account_balance"("p_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."adjust_balance"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_new_balance" bigint, "p_date" "date", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."adjust_balance"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_new_balance" bigint, "p_date" "date", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_balance"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_new_balance" bigint, "p_date" "date", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assert_actor"("p_household_id" "uuid", "p_actor_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assert_actor"("p_household_id" "uuid", "p_actor_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_actor"("p_household_id" "uuid", "p_actor_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_rate_limit"("p_api_key_id" "uuid", "p_minute_limit" integer, "p_day_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."bump_rate_limit"("p_api_key_id" "uuid", "p_minute_limit" integer, "p_day_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_rate_limit"("p_api_key_id" "uuid", "p_minute_limit" integer, "p_day_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."bump_rate_limit"("p_api_key_id" "uuid", "p_minute_limit" integer, "p_day_limit" integer) TO "karaya_api";



GRANT ALL ON FUNCTION "public"."can_post_to_account"("p_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_post_to_account"("p_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_post_to_account"("p_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_account"("p_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_account"("p_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_account"("p_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_member_role"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_role" "public"."member_role") TO "anon";
GRANT ALL ON FUNCTION "public"."change_member_role"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_role" "public"."member_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_member_role"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_role" "public"."member_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_household"("p_name" "text", "p_timezone" "text", "p_display_name" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_household"("p_name" "text", "p_timezone" "text", "p_display_name" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_household"("p_name" "text", "p_timezone" "text", "p_display_name" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."household_invitations" TO "anon";
GRANT ALL ON TABLE "public"."household_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."household_invitations" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invitation"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_email" "text", "p_role" "public"."member_role", "p_display_name_suggestion" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_email" "text", "p_role" "public"."member_role", "p_display_name_suggestion" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_email" "text", "p_role" "public"."member_role", "p_display_name_suggestion" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_household_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_household_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_household_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_member_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_member_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_member_ids"() TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_force_archive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_force_archive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_force_archive" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_category"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_category_id" "uuid", "p_merge_into_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_category"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_category_id" "uuid", "p_merge_into_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_category"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_category_id" "uuid", "p_merge_into_category_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."lend_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_borrower_name" "text", "p_total" bigint, "p_from_account_id" "uuid", "p_owner_member_id" "uuid", "p_due_date" "date", "p_notes" "text", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."lend_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_borrower_name" "text", "p_total" bigint, "p_from_account_id" "uuid", "p_owner_member_id" "uuid", "p_due_date" "date", "p_notes" "text", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lend_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_borrower_name" "text", "p_total" bigint, "p_from_account_id" "uuid", "p_owner_member_id" "uuid", "p_due_date" "date", "p_notes" "text", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."member_role_in"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."member_role_in"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."member_role_in"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_household_into"("p_source_household_id" "uuid", "p_target_household_id" "uuid", "p_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_household_into"("p_source_household_id" "uuid", "p_target_household_id" "uuid", "p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_household_into"("p_source_household_id" "uuid", "p_target_household_id" "uuid", "p_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."next_recurring_date"("p_from" "date", "p_freq" "public"."recurring_frequency", "p_anchor_day" smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."next_recurring_date"("p_from" "date", "p_freq" "public"."recurring_frequency", "p_anchor_day" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_recurring_date"("p_from" "date", "p_freq" "public"."recurring_frequency", "p_anchor_day" smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."norm_text"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."norm_text"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."norm_text"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pay_debt"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_debt_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pay_debt"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_debt_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pay_debt"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_debt_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."post_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_type" "public"."tx_type", "p_account_id" "uuid", "p_category_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source", "p_recurring_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."post_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_type" "public"."tx_type", "p_account_id" "uuid", "p_category_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source", "p_recurring_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_type" "public"."tx_type", "p_account_id" "uuid", "p_category_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source", "p_recurring_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_transactions_batch"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_date" "date", "p_items" "jsonb", "p_source" "public"."tx_source") TO "anon";
GRANT ALL ON FUNCTION "public"."post_transactions_batch"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_date" "date", "p_items" "jsonb", "p_source" "public"."tx_source") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_transactions_batch"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_account_id" "uuid", "p_date" "date", "p_items" "jsonb", "p_source" "public"."tx_source") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_transfer"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source") TO "anon";
GRANT ALL ON FUNCTION "public"."post_transfer"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_transfer"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_source" "public"."tx_source") TO "service_role";



GRANT ALL ON FUNCTION "public"."preview_invitation"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."preview_invitation"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_invitation"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."receive_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_piutang_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."receive_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_piutang_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."receive_piutang"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_piutang_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text", "p_allow_overpay" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_fill_anchor_day"() TO "anon";
GRANT ALL ON FUNCTION "public"."recurring_fill_anchor_day"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_fill_anchor_day"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_member"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_reassign_to_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_member"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_reassign_to_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_member"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_member_id" "uuid", "p_reassign_to_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_query" "text", "p_prefer_own" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_query" "text", "p_prefer_own" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_account"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_query" "text", "p_prefer_own" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_category"("p_household_id" "uuid", "p_query" "text", "p_type" "public"."tx_type") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_category"("p_household_id" "uuid", "p_query" "text", "p_type" "public"."tx_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_category"("p_household_id" "uuid", "p_query" "text", "p_type" "public"."tx_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_member"("p_household_id" "uuid", "p_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_member"("p_household_id" "uuid", "p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_member"("p_household_id" "uuid", "p_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_due_recurrings"("p_household_id" "uuid", "p_today" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."run_due_recurrings"("p_household_id" "uuid", "p_today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_due_recurrings"("p_household_id" "uuid", "p_today" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_household_categories"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_household_categories"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_household_categories"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."today_in_tz"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."today_in_tz"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."today_in_tz"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."topup_goal"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_goal_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."topup_goal"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_goal_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."topup_goal"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_goal_id" "uuid", "p_account_id" "uuid", "p_amount" bigint, "p_date" "date", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tx_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."tx_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tx_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid", "p_patch" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid", "p_patch" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_transaction"("p_household_id" "uuid", "p_actor_member_id" "uuid", "p_id" "uuid", "p_patch" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_timezone"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_timezone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_timezone"() TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."api_keys" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";
GRANT SELECT ON TABLE "public"."api_keys" TO "karaya_api";



GRANT UPDATE("last_used_at") ON TABLE "public"."api_keys" TO "karaya_api";



GRANT UPDATE("last_used_ip") ON TABLE "public"."api_keys" TO "karaya_api";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_log" TO "karaya_api";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."audit_log_id_seq" TO "karaya_api";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."debt_payments" TO "anon";
GRANT ALL ON TABLE "public"."debt_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."debt_payments" TO "service_role";



GRANT ALL ON TABLE "public"."debts" TO "anon";
GRANT ALL ON TABLE "public"."debts" TO "authenticated";
GRANT ALL ON TABLE "public"."debts" TO "service_role";



GRANT ALL ON TABLE "public"."goal_contributions" TO "anon";
GRANT ALL ON TABLE "public"."goal_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."gold_prices" TO "anon";
GRANT ALL ON TABLE "public"."gold_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."gold_prices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gold_prices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gold_prices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gold_prices_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."gold_prices_id_seq" TO "karaya_api";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."idempotency_keys" TO "anon";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."idempotency_keys" TO "karaya_api";



GRANT ALL ON TABLE "public"."investments" TO "anon";
GRANT ALL ON TABLE "public"."investments" TO "authenticated";
GRANT ALL ON TABLE "public"."investments" TO "service_role";



GRANT ALL ON TABLE "public"."migration_issues" TO "anon";
GRANT ALL ON TABLE "public"."migration_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_issues" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."migration_issues" TO "karaya_api";



GRANT ALL ON SEQUENCE "public"."migration_issues_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."migration_issues_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."migration_issues_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."migration_issues_id_seq" TO "karaya_api";



GRANT ALL ON TABLE "public"."piutang" TO "anon";
GRANT ALL ON TABLE "public"."piutang" TO "authenticated";
GRANT ALL ON TABLE "public"."piutang" TO "service_role";



GRANT ALL ON TABLE "public"."piutang_receipts" TO "anon";
GRANT ALL ON TABLE "public"."piutang_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."piutang_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_counters" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_counters" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rate_limit_counters" TO "karaya_api";



GRANT ALL ON TABLE "public"."recurring_transactions" TO "anon";
GRANT ALL ON TABLE "public"."recurring_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."split_bill_members" TO "anon";
GRANT ALL ON TABLE "public"."split_bill_members" TO "authenticated";
GRANT ALL ON TABLE "public"."split_bill_members" TO "service_role";



GRANT ALL ON TABLE "public"."split_bills" TO "anon";
GRANT ALL ON TABLE "public"."split_bills" TO "authenticated";
GRANT ALL ON TABLE "public"."split_bills" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."v_account_balances" TO "anon";
GRANT ALL ON TABLE "public"."v_account_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."v_account_balances" TO "service_role";



GRANT ALL ON TABLE "public"."v_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."v_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."v_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."v_debts" TO "anon";
GRANT ALL ON TABLE "public"."v_debts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_debts" TO "service_role";



GRANT ALL ON TABLE "public"."v_goals" TO "anon";
GRANT ALL ON TABLE "public"."v_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."v_goals" TO "service_role";



GRANT ALL ON TABLE "public"."v_goals_full" TO "anon";
GRANT ALL ON TABLE "public"."v_goals_full" TO "authenticated";
GRANT ALL ON TABLE "public"."v_goals_full" TO "service_role";



GRANT ALL ON TABLE "public"."v_piutang" TO "anon";
GRANT ALL ON TABLE "public"."v_piutang" TO "authenticated";
GRANT ALL ON TABLE "public"."v_piutang" TO "service_role";



GRANT ALL ON TABLE "public"."v_transactions" TO "anon";
GRANT ALL ON TABLE "public"."v_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_transactions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







