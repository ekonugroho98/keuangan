/**
 * Edge Function: financial-ops
 *
 * Operasi keuangan yang melibatkan multi-table update:
 * - pay-debt: bayar cicilan hutang
 * - topup-goal: tambah dana ke target tabungan
 * - add-piutang: catat piutang (opsional potong saldo)
 * - terima-piutang: terima pembayaran piutang
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

const fmtRp = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    switch (body.action) {
      case "pay-debt":
        return await handlePayDebt(supabase, user.id, body);
      case "topup-goal":
        return await handleTopupGoal(supabase, user.id, body);
      case "add-piutang":
        return await handleAddPiutang(supabase, user.id, body);
      case "terima-piutang":
        return await handleTerimaPiutang(supabase, user.id, body);
      default:
        return jsonRes({ error: `Unknown action: ${body.action}` }, 400);
    }
  } catch (err) {
    console.error("[financial-ops]", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});

// ── PAY DEBT ─────────────────────────────────────────────────────
async function handlePayDebt(supabase: any, userId: string, body: any) {
  const { debt_id, amount, account_name, date } = body;
  if (!debt_id || !amount || !account_name)
    return jsonRes({ error: "debt_id, amount, account_name wajib" }, 400);

  // 1. Fetch debt
  const { data: debt, error: dErr } = await supabase
    .from("debts")
    .select("*")
    .eq("id", debt_id)
    .eq("user_id", userId)
    .single();
  if (dErr || !debt)
    return jsonRes({ error: "Hutang tidak ditemukan" }, 404);

  // 2. Fetch account
  const { data: acc, error: aErr } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("name", account_name)
    .single();
  if (aErr || !acc)
    return jsonRes({ error: `Akun "${account_name}" tidak ditemukan` }, 400);

  if (acc.balance < amount)
    return jsonRes(
      {
        error: `Saldo ${account_name} (${fmtRp(acc.balance)}) tidak cukup untuk cicilan ${fmtRp(amount)}`,
      },
      400
    );

  // 3. Insert transaction
  const tx = {
    user_id: userId,
    type: "expense",
    amount,
    category: "Hutang & Cicilan",
    note: `Cicilan ${debt.name}`,
    date: date || localDateStr(),
    account_name,
    icon: "\u{1F4CB}",
  };
  const { data: newTx, error: txErr } = await supabase
    .from("transactions")
    .insert(tx)
    .select()
    .single();
  if (txErr) return jsonRes({ error: "Gagal menyimpan transaksi cicilan" }, 500);

  // 4. Update account balance
  const { data: updAcc, error: accErr } = await supabase
    .from("accounts")
    .update({ balance: acc.balance - amount })
    .eq("id", acc.id)
    .select()
    .single();
  if (accErr || !updAcc) {
    await supabase.from("transactions").delete().eq("id", newTx.id);
    return jsonRes({ error: "Gagal update saldo. Transaksi dibatalkan." }, 500);
  }

  // 5. Update debt remaining
  const newRemaining = Math.max(0, debt.remaining - amount);
  const { data: updDebt, error: debtErr } = await supabase
    .from("debts")
    .update({ remaining: newRemaining })
    .eq("id", debt.id)
    .select()
    .single();
  if (debtErr || !updDebt) {
    await supabase
      .from("accounts")
      .update({ balance: acc.balance })
      .eq("id", acc.id);
    await supabase.from("transactions").delete().eq("id", newTx.id);
    return jsonRes({ error: "Gagal update hutang. Transaksi dibatalkan." }, 500);
  }

  return jsonRes({ transaction: newTx, account: updAcc, debt: updDebt });
}

// ── TOPUP GOAL ───────────────────────────────────────────────────
async function handleTopupGoal(supabase: any, userId: string, body: any) {
  const { goal_id, amount, account_name, date } = body;
  if (!goal_id || !amount)
    return jsonRes({ error: "goal_id dan amount wajib" }, 400);

  // Fetch goal
  const { data: goal, error: gErr } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goal_id)
    .eq("user_id", userId)
    .single();
  if (gErr || !goal)
    return jsonRes({ error: "Target tidak ditemukan" }, 404);

  // With account deduction
  if (account_name) {
    const { data: acc, error: aErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("name", account_name)
      .single();
    if (aErr || !acc)
      return jsonRes({ error: `Akun "${account_name}" tidak ditemukan` }, 400);

    if (acc.balance < amount)
      return jsonRes(
        { error: `Saldo ${account_name} (${fmtRp(acc.balance)}) tidak cukup` },
        400
      );

    // Insert transaction
    const { data: newTx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "expense",
        amount,
        category: "Tabungan & Goal",
        note: `Tabungan: ${goal.name}`,
        date: date || localDateStr(),
        account_name,
        icon: "\u{1F3AF}",
      })
      .select()
      .single();
    if (txErr) return jsonRes({ error: "Gagal menyimpan transaksi" }, 500);

    // Update account balance
    const { data: updAcc, error: accErr } = await supabase
      .from("accounts")
      .update({ balance: acc.balance - amount })
      .eq("id", acc.id)
      .select()
      .single();
    if (accErr || !updAcc) {
      await supabase.from("transactions").delete().eq("id", newTx.id);
      return jsonRes(
        { error: "Gagal update saldo. Transaksi dibatalkan." },
        500
      );
    }

    // Update goal
    const newCurrent = goal.current + amount;
    const { data: updGoal, error: goalErr } = await supabase
      .from("goals")
      .update({ current: newCurrent })
      .eq("id", goal_id)
      .select()
      .single();
    if (goalErr || !updGoal) {
      await supabase
        .from("accounts")
        .update({ balance: acc.balance })
        .eq("id", acc.id);
      await supabase.from("transactions").delete().eq("id", newTx.id);
      return jsonRes(
        { error: "Gagal update target. Transaksi dibatalkan." },
        500
      );
    }

    return jsonRes({
      transaction: newTx,
      account: updAcc,
      goal: updGoal,
      reached: newCurrent >= goal.target,
    });
  }

  // Without account — just update goal
  const newCurrent = goal.current + amount;
  const { data: updGoal, error: goalErr } = await supabase
    .from("goals")
    .update({ current: newCurrent })
    .eq("id", goal_id)
    .select()
    .single();
  if (goalErr)
    return jsonRes({ error: "Gagal memperbarui target" }, 500);

  return jsonRes({
    goal: updGoal,
    reached: newCurrent >= goal.target,
  });
}

// ── ADD PIUTANG ──────────────────────────────────────────────────
async function handleAddPiutang(supabase: any, userId: string, body: any) {
  const { payload, from_account } = body;
  if (!payload) return jsonRes({ error: "payload wajib" }, 400);

  if (from_account) {
    // With account deduction
    const { data: acc, error: aErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("name", from_account)
      .single();
    if (aErr || !acc)
      return jsonRes({ error: `Akun "${from_account}" tidak ditemukan` }, 400);

    if (acc.balance < payload.total)
      return jsonRes(
        {
          error: `Saldo ${from_account} (${fmtRp(acc.balance)}) tidak cukup untuk piutang ${fmtRp(payload.total)}`,
        },
        400
      );

    // Insert piutang
    const { data: piu, error: piuErr } = await supabase
      .from("piutang")
      .insert({ user_id: userId, ...payload })
      .select()
      .single();
    if (piuErr) return jsonRes({ error: "Gagal menyimpan piutang" }, 500);

    // Update balance
    const newBal = acc.balance - payload.total;
    const { data: updAcc, error: accErr } = await supabase
      .from("accounts")
      .update({ balance: newBal })
      .eq("id", acc.id)
      .select()
      .single();
    if (accErr || !updAcc) {
      await supabase.from("piutang").delete().eq("id", piu.id);
      return jsonRes(
        { error: "Gagal update saldo. Piutang dibatalkan." },
        500
      );
    }

    // Audit trail transaction
    const { data: newTx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "expense",
        amount: payload.total,
        category: "Piutang",
        note: `Piutang ke ${payload.borrower_name || "seseorang"}`,
        date: localDateStr(),
        account_name: from_account,
        icon: "\u{1F91D}",
      })
      .select()
      .single();
    if (txErr) {
      // Rollback
      await supabase
        .from("accounts")
        .update({ balance: acc.balance })
        .eq("id", acc.id);
      await supabase.from("piutang").delete().eq("id", piu.id);
      return jsonRes(
        { error: "Gagal membuat transaksi. Piutang dibatalkan." },
        500
      );
    }

    return jsonRes({ piutang: piu, account: updAcc, transaction: newTx });
  }

  // Without account deduction
  const { data: piu, error: piuErr } = await supabase
    .from("piutang")
    .insert({ user_id: userId, ...payload })
    .select()
    .single();
  if (piuErr) return jsonRes({ error: "Gagal menyimpan piutang" }, 500);

  return jsonRes({ piutang: piu });
}

// ── TERIMA PIUTANG ───────────────────────────────────────────────
async function handleTerimaPiutang(supabase: any, userId: string, body: any) {
  const { piutang_id, amount, account_name } = body;
  if (!piutang_id || !amount || !account_name)
    return jsonRes(
      { error: "piutang_id, amount, account_name wajib" },
      400
    );

  // Fetch piutang
  const { data: piu, error: pErr } = await supabase
    .from("piutang")
    .select("*")
    .eq("id", piutang_id)
    .eq("user_id", userId)
    .single();
  if (pErr || !piu)
    return jsonRes({ error: "Piutang tidak ditemukan" }, 404);

  // Fetch account
  const { data: acc, error: aErr } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("name", account_name)
    .single();
  if (aErr || !acc)
    return jsonRes({ error: `Akun "${account_name}" tidak ditemukan` }, 400);

  // Update account balance (income)
  const { data: updAcc, error: accErr } = await supabase
    .from("accounts")
    .update({ balance: acc.balance + amount })
    .eq("id", acc.id)
    .select()
    .single();
  if (accErr || !updAcc)
    return jsonRes({ error: "Gagal update saldo akun" }, 500);

  // Update piutang remaining
  const newRemaining = Math.max(0, piu.remaining - amount);
  const { data: updPiu, error: piuErr } = await supabase
    .from("piutang")
    .update({ remaining: newRemaining })
    .eq("id", piutang_id)
    .select()
    .single();
  if (piuErr || !updPiu) {
    await supabase
      .from("accounts")
      .update({ balance: acc.balance })
      .eq("id", acc.id);
    return jsonRes(
      { error: "Gagal update piutang. Saldo dikembalikan." },
      500
    );
  }

  // Audit trail transaction
  const { data: newTx } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "income",
      amount,
      category: "Piutang",
      note: `Terima piutang dari ${piu.borrower_name || "seseorang"}`,
      date: localDateStr(),
      account_name,
      icon: "\u{1F91D}",
    })
    .select()
    .single();

  return jsonRes({
    piutang: updPiu,
    account: updAcc,
    transaction: newTx,
  });
}
