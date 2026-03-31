/**
 * Edge Function: update-subscription
 *
 * Dipanggil setelah payment dikonfirmasi — TIDAK bisa dipanggil langsung dari browser
 * karena butuh FUNCTION_SECRET di header.
 *
 * POST /functions/v1/update-subscription
 * Headers: { x-function-secret: <FUNCTION_SECRET> }
 * Body: { user_id, plan, payment_ref? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-function-secret",
};

const PLAN_DURATION: Record<string, number> = {
  trial: 14,    // hari
  starter: 30,  // hari
  pro: 90,      // hari
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Verifikasi secret — tanpa ini, request ditolak ──────────────────
    const secret = req.headers.get("x-function-secret");
    if (!secret || secret !== Deno.env.get("FUNCTION_SECRET")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Parse body ───────────────────────────────────────────────────────
    const { user_id, plan, payment_ref } = await req.json();

    if (!user_id || !plan) {
      return new Response(
        JSON.stringify({ error: "user_id dan plan wajib diisi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!PLAN_DURATION[plan]) {
      return new Response(
        JSON.stringify({ error: `Plan tidak valid. Pilihan: ${Object.keys(PLAN_DURATION).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Pakai service_role key — bypass RLS, hanya aman di server ────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 4. Hitung tanggal kadaluarsa ────────────────────────────────────────
    const expires = new Date();
    expires.setDate(expires.getDate() + PLAN_DURATION[plan]);

    // ── 5. Upsert subscription ──────────────────────────────────────────────
    const { data, error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id,
          plan,
          started_at: new Date().toISOString(),
          expires_at: expires.toISOString(),
          payment_ref: payment_ref ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    console.log(`[update-subscription] user=${user_id} plan=${plan} expires=${expires.toISOString()} ref=${payment_ref}`);

    return new Response(
      JSON.stringify({ success: true, subscription: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[update-subscription] error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
