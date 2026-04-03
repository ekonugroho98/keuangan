// ─── Supabase Edge Function: scrape-gold-prices ────────────────────────────
// Dipanggil oleh Supabase Cron setiap hari 08:30 WIB (01:30 UTC)
// Bisa juga dipanggil manual via POST /functions/v1/scrape-gold-prices

import { createClient } from "npm:@supabase/supabase-js@2";
import { antam } from "./sources/antam.ts";
import type { GoldSource } from "./sources/types.ts";

// ── Registry semua sumber harga ── (tambah brand baru di sini)
const SOURCES: GoldSource[] = [
  antam,
  // pegadaian,
  // ubs,
];

// ── CORS headers ──
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role agar bisa write tanpa RLS
  );

  const today   = new Date().toISOString().slice(0, 10);
  const results: Record<string, { status: string; count?: number; error?: string }> = {};

  for (const source of SOURCES) {
    console.log(`⏳ Fetching ${source.name}...`);
    try {
      const { categories, scraped_at } = await source.fetch();

      // Flatten categories → rows
      const rows = Object.entries(categories).flatMap(([category, items]) =>
        items.map(item => ({
          brand:          source.brand,
          category,
          weight:         item.weight,
          weight_grams:   item.weight_grams,
          buy_price:      item.buy_price,
          sell_price:     item.sell_price,
          price_per_gram: item.price_per_gram,
          date:           today,
          scraped_at,
        }))
      );

      if (rows.length === 0) {
        results[source.brand] = { status: "empty", count: 0 };
        console.warn(`⚠️  ${source.name}: tidak ada data ditemukan`);
        continue;
      }

      const { error } = await supabase
        .from("gold_prices")
        .upsert(rows, { onConflict: "brand,category,weight,date" });

      if (error) throw error;

      results[source.brand] = { status: "ok", count: rows.length };
      console.log(`✅ ${source.name}: ${rows.length} baris disimpan`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[source.brand] = { status: "error", error: msg };
      console.error(`❌ ${source.name}:`, msg);
    }
  }

  return new Response(
    JSON.stringify({ date: today, results }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
