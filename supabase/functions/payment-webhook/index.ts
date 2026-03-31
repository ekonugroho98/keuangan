/**
 * Edge Function: payment-webhook
 *
 * Menerima notifikasi dari Midtrans setelah user bayar.
 * Midtrans → POST /functions/v1/payment-webhook → update subscription
 *
 * Setup di Midtrans Dashboard:
 * Notification URL: https://<project>.supabase.co/functions/v1/payment-webhook
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map order_id prefix ke plan
// Contoh order_id: "karaya-starter-<userId>-<timestamp>"
const ORDER_PREFIX_TO_PLAN: Record<string, string> = {
  "karaya-trial": "trial",
  "karaya-starter": "starter",
  "karaya-pro": "pro",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      order_id,
      transaction_status,
      fraud_status,
      gross_amount,
      signature_key,
      status_code,
      transaction_id,
    } = body;

    // ── 1. Verifikasi signature Midtrans ────────────────────────────────────
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const expectedSignature = createHmac("sha512", serverKey)
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest("hex");

    if (signature_key !== expectedSignature) {
      console.warn("[payment-webhook] Signature tidak valid:", { order_id });
      return new Response(
        JSON.stringify({ error: "Signature tidak valid" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Cek status transaksi ─────────────────────────────────────────────
    const isSuccess =
      transaction_status === "capture" ||
      transaction_status === "settlement";
    const isFraud = fraud_status === "deny";

    if (!isSuccess || isFraud) {
      console.log(`[payment-webhook] Transaksi tidak berhasil: ${transaction_status}, fraud: ${fraud_status}`);
      return new Response(
        JSON.stringify({ message: "Transaksi tidak diproses" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Parse order_id → user_id + plan ─────────────────────────────────
    // Format order_id: "karaya-{plan}-{userId}-{timestamp}"
    // Contoh: "karaya-starter-91c69204-2b72-4e94-8232-f390b4e51a78-1711900000"
    const parts = order_id.split("-");
    if (parts.length < 3 || parts[0] !== "karaya") {
      throw new Error(`Format order_id tidak valid: ${order_id}`);
    }

    const plan = parts[1]; // "trial" | "starter" | "pro"
    // user_id adalah UUID (format: 8-4-4-4-12) setelah prefix
    const userId = parts.slice(2, -1).join("-");

    if (!ORDER_PREFIX_TO_PLAN[`karaya-${plan}`]) {
      throw new Error(`Plan tidak dikenal: ${plan}`);
    }

    // ── 4. Update subscription via service_role ─────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const PLAN_DAYS: Record<string, number> = { trial: 14, starter: 30, pro: 90 };
    const expires = new Date();
    expires.setDate(expires.getDate() + PLAN_DAYS[plan]);

    const { data, error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan,
          started_at: new Date().toISOString(),
          expires_at: expires.toISOString(),
          payment_ref: transaction_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    console.log(`[payment-webhook] ✅ user=${userId} → plan=${plan} expires=${expires.toISOString()}`);

    return new Response(
      JSON.stringify({ success: true, subscription: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[payment-webhook] error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
