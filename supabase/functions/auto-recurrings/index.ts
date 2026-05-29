/**
 * Edge Function: auto-recurrings
 *
 * Cek & eksekusi transaksi berulang yang sudah jatuh tempo.
 * Dipanggil saat dashboard load atau via cron.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function calcNextDate(freq: string, from: string): string {
  const d = new Date(from);
  if (freq === "daily") d.setDate(d.getDate() + 1);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const todayStr =
      body.today ||
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();

    // 1. Fetch active recurrings that are due
    const { data: recurrings } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .lte("next_date", todayStr);

    if (!recurrings?.length)
      return jsonRes({ executed: 0 });

    // 2. Check for already-inserted auto transactions (prevent duplicates)
    const { data: existingAuto } = await supabase
      .from("transactions")
      .select("note, date")
      .eq("user_id", user.id)
      .like("note", "[Auto]%")
      .gte("date", todayStr);

    const alreadyInserted = new Set(
      (existingAuto || []).map((t: any) => `${t.note}|${t.date}`)
    );

    const dueToInsert = recurrings.filter(
      (r: any) => !alreadyInserted.has(`[Auto] ${r.name}|${r.next_date}`)
    );

    if (!dueToInsert.length)
      return jsonRes({ executed: 0 });

    // 3. Insert transactions
    const newTxs = dueToInsert.map((r: any) => ({
      user_id: user.id,
      type: "expense",
      amount: r.amount,
      category: r.category || "Lainnya",
      note: `[Auto] ${r.name}`,
      date: new Date(r.next_date).toISOString().slice(0, 10),
      account_name: r.account_name,
      icon: r.icon || "\u{1F504}",
    }));

    const { error: insertErr } = await supabase
      .from("transactions")
      .insert(newTxs);
    if (insertErr) {
      console.error("[auto-recurrings] insert failed:", insertErr);
      return jsonRes({ executed: 0 });
    }

    // 4. Update balances & debts, advance next_date
    const updatedAccountIds: string[] = [];
    const updatedDebtIds: string[] = [];

    for (const r of dueToInsert) {
      // Update account balance
      const { data: freshAcc } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("name", r.account_name)
        .single();
      if (freshAcc) {
        const newBal = Math.max(0, freshAcc.balance - r.amount);
        await supabase
          .from("accounts")
          .update({ balance: newBal })
          .eq("id", freshAcc.id);
        updatedAccountIds.push(freshAcc.id);
      }

      // Update linked debt
      if (r.debt_id) {
        const { data: debt } = await supabase
          .from("debts")
          .select("*")
          .eq("id", r.debt_id)
          .single();
        if (debt) {
          const newRemaining = Math.max(0, debt.remaining - r.amount);
          await supabase
            .from("debts")
            .update({ remaining: newRemaining })
            .eq("id", r.debt_id);
          updatedDebtIds.push(r.debt_id);
        }
      }

      // Advance next_date
      const newNext = calcNextDate(r.frequency, r.next_date);
      await supabase
        .from("recurring_transactions")
        .update({ next_date: newNext })
        .eq("id", r.id);
    }

    // 5. Fetch fresh data to return
    const [freshAccs, freshTxs, freshRecs, freshDebts] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at"),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
      supabase
        .from("recurring_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("next_date"),
      supabase
        .from("debts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at"),
    ]);

    return jsonRes({
      executed: dueToInsert.length,
      accounts: freshAccs.data || [],
      transactions: freshTxs.data || [],
      recurrings: freshRecs.data || [],
      debts: freshDebts.data || [],
    });
  } catch (err) {
    console.error("[auto-recurrings]", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});
