


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



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_api_key"("p_key_hash" "text", "p_ip" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "scopes" "text"[], "rate_limit_per_minute" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  UPDATE api_keys
     SET last_used_at = NOW(),
         last_used_ip = COALESCE(p_ip, last_used_ip)
   WHERE api_keys.key_hash = p_key_hash
     AND is_active = true
     AND (expires_at IS NULL OR expires_at > NOW())
     AND revoked_at IS NULL
  RETURNING api_keys.id, api_keys.user_id, api_keys.scopes,
            api_keys.rate_limit_per_minute;
END;
$$;


ALTER FUNCTION "public"."verify_api_key"("p_key_hash" "text", "p_ip" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "balance" bigint DEFAULT 0 NOT NULL,
    "icon" "text" DEFAULT '💰'::"text",
    "color" "text" DEFAULT '#6366f1'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "accounts_type_check" CHECK (("type" = ANY (ARRAY['bank'::"text", 'ewallet'::"text", 'cash'::"text", 'crypto'::"text", 'investasi'::"text", 'tabungan'::"text"]))),
    CONSTRAINT "balance_reasonable" CHECK ((("balance" >= 0) AND ("balance" <= '100000000000'::bigint)))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "scopes" "text"[] DEFAULT ARRAY['content:read'::"text", 'content:write'::"text", 'publish:read'::"text", 'publish:write'::"text", 'ads:read'::"text", 'ads:write'::"text", 'analytics:read'::"text", 'accounts:read'::"text"] NOT NULL,
    "rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
    "last_used_at" timestamp with time zone,
    "last_used_ip" "text",
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "period" "text" DEFAULT 'monthly'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "month" "text" NOT NULL
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT '📦'::"text",
    "type" "text" DEFAULT 'both'::"text",
    "color" "text" DEFAULT '#64748b'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "total" bigint NOT NULL,
    "remaining" bigint NOT NULL,
    "monthly" bigint NOT NULL,
    "due_date" "text" NOT NULL,
    "icon" "text" DEFAULT '📋'::"text",
    "color" "text" DEFAULT '#ef4444'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target" bigint NOT NULL,
    "current" bigint DEFAULT 0 NOT NULL,
    "icon" "text" DEFAULT '🎯'::"text",
    "color" "text" DEFAULT '#6366f1'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deadline" "date",
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



CREATE TABLE IF NOT EXISTS "public"."investments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'lainnya'::"text" NOT NULL,
    "icon" "text" DEFAULT '📊'::"text",
    "color" "text" DEFAULT '#6366f1'::"text",
    "buy_price" bigint DEFAULT 0 NOT NULL,
    "current_value" bigint DEFAULT 0 NOT NULL,
    "quantity" numeric DEFAULT 1,
    "unit" "text" DEFAULT 'unit'::"text",
    "buy_date" "date",
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "brand" "text",
    "kode_saham" "text"
);


ALTER TABLE "public"."investments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piutang" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "borrower_name" "text" NOT NULL,
    "total" bigint NOT NULL,
    "remaining" bigint NOT NULL,
    "due_date" "text",
    "notes" "text",
    "icon" "text" DEFAULT '🤝'::"text",
    "color" "text" DEFAULT '#60fcc6'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "from_account" "text"
);


ALTER TABLE "public"."piutang" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" bigint NOT NULL,
    "icon" "text" DEFAULT '🔄'::"text",
    "category" "text" DEFAULT 'Lainnya'::"text",
    "account_name" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "next_date" "date" NOT NULL,
    "notes" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "debt_id" "uuid",
    CONSTRAINT "recurring_transactions_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."recurring_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_bill_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "paid" boolean DEFAULT false
);


ALTER TABLE "public"."split_bill_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "total_amount" numeric NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."split_bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "plan" "text" DEFAULT 'trial'::"text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval),
    "payment_ref" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" bigint NOT NULL,
    "category" "text" NOT NULL,
    "note" "text" DEFAULT ''::"text",
    "date" "date" NOT NULL,
    "account_name" "text" NOT NULL,
    "icon" "text" DEFAULT '📦'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "to_account" "text",
    CONSTRAINT "amount_reasonable" CHECK ((("amount" > 0) AND ("amount" <= '100000000000'::bigint))),
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'transfer'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "avatar_color" "text" DEFAULT '#60fcc6'::"text",
    "hidden_menus" "jsonb" DEFAULT '[]'::"jsonb",
    "app_name" "text" DEFAULT 'Karaya'::"text",
    "app_tagline" "text" DEFAULT 'Wealth Ledger'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ai_config" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_category_month_unique" UNIQUE ("user_id", "category", "month");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gold_prices"
    ADD CONSTRAINT "gold_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investments"
    ADD CONSTRAINT "investments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_bill_members"
    ADD CONSTRAINT "split_bill_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_bills"
    ADD CONSTRAINT "split_bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "gold_prices_brand_scraped" ON "public"."gold_prices" USING "btree" ("brand", "scraped_at" DESC);



CREATE INDEX "idx_api_keys_hash" ON "public"."api_keys" USING "btree" ("key_hash") WHERE "is_active";



CREATE INDEX "idx_api_keys_user" ON "public"."api_keys" USING "btree" ("user_id", "created_at" DESC);



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investments"
    ADD CONSTRAINT "investments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piutang"
    ADD CONSTRAINT "piutang_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_bill_members"
    ADD CONSTRAINT "split_bill_members_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."split_bills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_bills"
    ADD CONSTRAINT "split_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can create api keys" ON "public"."api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own api keys" ON "public"."api_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own api keys" ON "public"."api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own api keys" ON "public"."api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own budgets" ON "public"."budgets" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own split bill members" ON "public"."split_bill_members" USING ((EXISTS ( SELECT 1
   FROM "public"."split_bills"
  WHERE (("split_bills"."id" = "split_bill_members"."bill_id") AND ("split_bills"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users manage own split bills" ON "public"."split_bills" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts: user can delete own" ON "public"."accounts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "accounts: user can insert own" ON "public"."accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "accounts: user can select own" ON "public"."accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "accounts: user can update own" ON "public"."accounts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "anon insert" ON "public"."gold_prices" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories: user crud own" ON "public"."categories" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."debts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debts: user can delete own" ON "public"."debts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "debts: user can insert own" ON "public"."debts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "debts: user can select own" ON "public"."debts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "debts: user can update own" ON "public"."debts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals: user can delete own" ON "public"."goals" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "goals: user can insert own" ON "public"."goals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "goals: user can select own" ON "public"."goals" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "goals: user can update own" ON "public"."goals" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."gold_prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."investments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investments: delete own" ON "public"."investments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "investments: insert own" ON "public"."investments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "investments: select own" ON "public"."investments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "investments: update own" ON "public"."investments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."piutang" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "piutang: user can delete own" ON "public"."piutang" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "piutang: user can insert own" ON "public"."piutang" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "piutang: user can select own" ON "public"."piutang" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "piutang: user can update own" ON "public"."piutang" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "public read" ON "public"."gold_prices" FOR SELECT USING (true);



CREATE POLICY "recurring: user crud own" ON "public"."recurring_transactions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."recurring_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings: user own" ON "public"."user_settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."split_bill_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_bills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions: user can insert own" ON "public"."subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "subscriptions: user can select own" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions: user can delete own" ON "public"."transactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "transactions: user can insert own" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "transactions: user can select own" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "transactions: user can update own" ON "public"."transactions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_api_key"("p_key_hash" "text", "p_ip" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_api_key"("p_key_hash" "text", "p_ip" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_api_key"("p_key_hash" "text", "p_ip" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_api_key"("p_key_hash" "text", "p_ip" "text") TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."debts" TO "anon";
GRANT ALL ON TABLE "public"."debts" TO "authenticated";
GRANT ALL ON TABLE "public"."debts" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."gold_prices" TO "anon";
GRANT ALL ON TABLE "public"."gold_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."gold_prices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gold_prices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gold_prices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gold_prices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."investments" TO "anon";
GRANT ALL ON TABLE "public"."investments" TO "authenticated";
GRANT ALL ON TABLE "public"."investments" TO "service_role";



GRANT ALL ON TABLE "public"."piutang" TO "anon";
GRANT ALL ON TABLE "public"."piutang" TO "authenticated";
GRANT ALL ON TABLE "public"."piutang" TO "service_role";



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



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



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







