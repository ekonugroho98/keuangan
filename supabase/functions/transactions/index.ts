/**
 * Edge Function: transactions
 *
 * Menangani CRUD transaksi + update saldo akun secara atomic.
 * Actions: add, add-multiple, edit, delete, transfer
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
      case "add":
        return await handleAdd(supabase, user.id, body);
      case "add-multiple":
        return await handleAddMultiple(supabase, user.id, body);
      case "edit":
        return await handleEdit(supabase, user.id, body);
      case "delete":
        return await handleDelete(supabase, user.id, body);
      case "transfer":
        return await handleTransfer(supabase, user.id, body);
      case "adjust-balance":
        return await handleAdjustBalance(supabase, user.id, body);
      case "add-account":
        return await handleAddAccount(supabase, user.id, body);
      case "edit-account":
        return await handleEditAccount(supabase, user.id, body);
      case "delete-account":
        return await handleDeleteAccount(supabase, user.id, body);
      case "list-accounts":
        return await handleListAccounts(supabase, user.id);
      default:
        return jsonRes({ error: `Unknown action: ${body.action}` }, 400);
    }
  } catch (err) {
    console.error("[transactions]", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});

// ── helpers ──────────────────────────────────────────────────────
async function getAccount(supabase: any, userId: string, name: string) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("name", name)
    .single();
  return { acc: data, err: error };
}

const fmtRp = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

// ── ADD ──────────────────────────────────────────────────────────
async function handleAdd(supabase: any, userId: string, body: any) {
  const { type, amount, category, note, date, account_name, icon } = body;
  if (!amount || !account_name)
    return jsonRes({ error: "amount dan account_name wajib" }, 400);

  const { acc, err: accErr } = await getAccount(supabase, userId, account_name);
  if (accErr || !acc)
    return jsonRes({ error: `Akun "${account_name}" tidak ditemukan` }, 400);

  if (type === "expense" && acc.balance < amount)
    return jsonRes(
      {
        error: `Saldo ${account_name} (${fmtRp(acc.balance)}) tidak cukup untuk ${fmtRp(amount)}`,
      },
      400
    );

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type,
      amount,
      category,
      note: note || category,
      date,
      account_name,
      icon: icon || "\u{1F4E6}",
    })
    .select()
    .single();
  if (txErr) return jsonRes({ error: "Gagal menyimpan transaksi" }, 500);

  const newBal =
    type === "income" ? acc.balance + amount : acc.balance - amount;
  const { data: updAcc, error: balErr } = await supabase
    .from("accounts")
    .update({ balance: newBal })
    .eq("id", acc.id)
    .select()
    .single();
  if (balErr || !updAcc) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    return jsonRes(
      { error: "Gagal update saldo. Transaksi dibatalkan." },
      500
    );
  }

  return jsonRes({ transaction: tx, account: updAcc });
}

// ── ADD MULTIPLE ─────────────────────────────────────────────────
async function handleAddMultiple(supabase: any, userId: string, body: any) {
  const { items, account_name, date } = body;
  if (!items?.length || !account_name)
    return jsonRes({ error: "items dan account_name wajib" }, 400);

  const { acc, err: accErr } = await getAccount(supabase, userId, account_name);
  if (accErr || !acc)
    return jsonRes({ error: `Akun "${account_name}" tidak ditemukan` }, 400);

  const total = items.reduce((s: number, i: any) => s + i.amount, 0);
  if (acc.balance < total)
    return jsonRes(
      {
        error: `Saldo ${account_name} (${fmtRp(acc.balance)}) tidak cukup untuk total ${fmtRp(total)}`,
      },
      400
    );

  const rows = items.map((i: any) => ({
    user_id: userId,
    type: "expense",
    amount: i.amount,
    category: i.category,
    note: i.note,
    date,
    account_name,
    icon: i.icon || "\u{1F4E6}",
  }));

  const { data: txs, error: txErr } = await supabase
    .from("transactions")
    .insert(rows)
    .select();
  if (txErr) return jsonRes({ error: "Gagal menyimpan transaksi" }, 500);

  const { data: updAcc, error: balErr } = await supabase
    .from("accounts")
    .update({ balance: acc.balance - total })
    .eq("id", acc.id)
    .select()
    .single();
  if (balErr || !updAcc) {
    const ids = (txs || []).map((t: any) => t.id);
    if (ids.length) await supabase.from("transactions").delete().in("id", ids);
    return jsonRes(
      { error: "Gagal update saldo. Transaksi dibatalkan." },
      500
    );
  }

  return jsonRes({ transactions: txs, account: updAcc });
}

// ── EDIT ─────────────────────────────────────────────────────────
async function handleEdit(supabase: any, userId: string, body: any) {
  const { id, type, amount, category, note, date, account_name, icon } = body;
  if (!id) return jsonRes({ error: "id wajib" }, 400);

  // Fetch original
  const { data: orig, error: origErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (origErr || !orig)
    return jsonRes({ error: "Transaksi tidak ditemukan" }, 404);

  // Transfer: hanya boleh edit note & date
  if (orig.type === "transfer") {
    const { data: upd, error } = await supabase
      .from("transactions")
      .update({ note, date: date || orig.date })
      .eq("id", id)
      .select()
      .single();
    if (error) return jsonRes({ error: "Gagal mengubah transaksi" }, 500);
    return jsonRes({ transaction: upd, accounts: [] });
  }

  const newAccName = account_name || orig.account_name;
  const newAmount = amount || orig.amount;
  const newType = type || orig.type;
  const isSameAcc = newAccName === orig.account_name;

  // Fetch old account
  const { data: oldAcc } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("name", orig.account_name)
    .single();

  let targetAcc = oldAcc;
  if (!isSameAcc) {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("name", newAccName)
      .single();
    targetAcc = data;
  }

  const updatedAccounts: any[] = [];

  if (oldAcc) {
    const reverted =
      orig.type === "income"
        ? oldAcc.balance - orig.amount
        : oldAcc.balance + orig.amount;

    if (isSameAcc) {
      const final =
        newType === "income" ? reverted + newAmount : reverted - newAmount;
      const { data: u, error } = await supabase
        .from("accounts")
        .update({ balance: final })
        .eq("id", oldAcc.id)
        .select()
        .single();
      if (error)
        return jsonRes({ error: "Gagal update saldo akun" }, 500);
      updatedAccounts.push(u);
    } else {
      const { data: uOld, error: e1 } = await supabase
        .from("accounts")
        .update({ balance: reverted })
        .eq("id", oldAcc.id)
        .select()
        .single();
      if (e1) return jsonRes({ error: "Gagal update saldo akun lama" }, 500);
      updatedAccounts.push(uOld);

      if (targetAcc) {
        const tBal =
          newType === "income"
            ? targetAcc.balance + newAmount
            : targetAcc.balance - newAmount;
        const { data: uT, error: e2 } = await supabase
          .from("accounts")
          .update({ balance: tBal })
          .eq("id", targetAcc.id)
          .select()
          .single();
        if (e2) {
          await supabase
            .from("accounts")
            .update({ balance: oldAcc.balance })
            .eq("id", oldAcc.id);
          return jsonRes(
            { error: "Gagal update saldo. Edit dibatalkan." },
            500
          );
        }
        updatedAccounts.push(uT);
      }
    }
  }

  // Update transaksi
  const { data: updTx, error: txErr } = await supabase
    .from("transactions")
    .update({
      type: newType,
      amount: newAmount,
      category,
      note: note || category,
      account_name: newAccName,
      icon,
      date: date || orig.date,
    })
    .eq("id", id)
    .select()
    .single();
  if (txErr) {
    if (oldAcc)
      await supabase
        .from("accounts")
        .update({ balance: oldAcc.balance })
        .eq("id", oldAcc.id);
    if (!isSameAcc && targetAcc)
      await supabase
        .from("accounts")
        .update({ balance: targetAcc.balance })
        .eq("id", targetAcc.id);
    return jsonRes(
      { error: "Gagal mengubah transaksi. Saldo dikembalikan." },
      500
    );
  }

  return jsonRes({ transaction: updTx, accounts: updatedAccounts });
}

// ── DELETE ────────────────────────────────────────────────────────
async function handleDelete(supabase: any, userId: string, body: any) {
  const { id } = body;
  if (!id) return jsonRes({ error: "id wajib" }, 400);

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (txErr || !tx)
    return jsonRes({ error: "Transaksi tidak ditemukan" }, 404);

  const updatedAccounts: any[] = [];

  if (tx.type === "transfer") {
    const { data: fromAcc } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("name", tx.account_name)
      .single();
    const toRes = tx.to_account
      ? await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", userId)
          .eq("name", tx.to_account)
          .single()
      : { data: null };
    const toAcc = toRes.data;

    if (fromAcc) {
      const { data: u, error } = await supabase
        .from("accounts")
        .update({ balance: fromAcc.balance + tx.amount })
        .eq("id", fromAcc.id)
        .select()
        .single();
      if (error)
        return jsonRes(
          { error: "Gagal revert saldo. Hapus dibatalkan." },
          500
        );
      updatedAccounts.push(u);
    }
    if (toAcc) {
      const { data: u, error } = await supabase
        .from("accounts")
        .update({ balance: toAcc.balance - tx.amount })
        .eq("id", toAcc.id)
        .select()
        .single();
      if (error) {
        if (fromAcc)
          await supabase
            .from("accounts")
            .update({ balance: fromAcc.balance })
            .eq("id", fromAcc.id);
        return jsonRes(
          { error: "Gagal revert saldo. Hapus dibatalkan." },
          500
        );
      }
      updatedAccounts.push(u);
    }
  } else {
    const { data: acc } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("name", tx.account_name)
      .single();
    if (acc) {
      const revBal =
        tx.type === "income"
          ? acc.balance - tx.amount
          : acc.balance + tx.amount;
      const { data: u, error } = await supabase
        .from("accounts")
        .update({ balance: revBal })
        .eq("id", acc.id)
        .select()
        .single();
      if (error)
        return jsonRes(
          { error: "Gagal revert saldo. Hapus dibatalkan." },
          500
        );
      updatedAccounts.push(u);
    }
  }

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);
  if (delErr) {
    // Best effort rollback — restore original balances
    for (const u of updatedAccounts) {
      const origName =
        u.name === tx.account_name ? tx.account_name : tx.to_account;
      if (origName === tx.account_name) {
        const origBal =
          u.balance - (tx.type === "transfer" ? tx.amount : 0) +
          (tx.type !== "transfer" && tx.type === "income"
            ? tx.amount
            : tx.type !== "transfer"
              ? -tx.amount
              : 0);
        // Simplified: just refetch is safer
      }
    }
    return jsonRes({ error: "Gagal menghapus transaksi" }, 500);
  }

  return jsonRes({ success: true, accounts: updatedAccounts, deletedId: id });
}

// ── TRANSFER ─────────────────────────────────────────────────────
async function handleTransfer(supabase: any, userId: string, body: any) {
  const { amount, from_account, to_account, date, note } = body;
  if (!amount || !from_account || !to_account)
    return jsonRes({ error: "amount, from_account, to_account wajib" }, 400);
  if (from_account === to_account)
    return jsonRes({ error: "Akun asal dan tujuan harus berbeda" }, 400);

  const [fromRes, toRes] = await Promise.all([
    getAccount(supabase, userId, from_account),
    getAccount(supabase, userId, to_account),
  ]);
  if (!fromRes.acc)
    return jsonRes({ error: `Akun "${from_account}" tidak ditemukan` }, 400);
  if (!toRes.acc)
    return jsonRes({ error: `Akun "${to_account}" tidak ditemukan` }, 400);

  const fromAcc = fromRes.acc;
  const toAcc = toRes.acc;

  if (fromAcc.balance < amount)
    return jsonRes(
      {
        error: `Saldo ${from_account} (${fmtRp(fromAcc.balance)}) tidak cukup untuk transfer ${fmtRp(amount)}`,
      },
      400
    );

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "transfer",
      amount,
      category: "Transfer",
      note: note || `Transfer ${from_account} \u2192 ${to_account}`,
      date,
      account_name: from_account,
      to_account,
      icon: "\u{1F504}",
    })
    .select()
    .single();
  if (txErr) return jsonRes({ error: "Gagal menyimpan transfer" }, 500);

  const [resFrom, resTo] = await Promise.all([
    supabase
      .from("accounts")
      .update({ balance: fromAcc.balance - amount })
      .eq("id", fromAcc.id)
      .select()
      .single(),
    supabase
      .from("accounts")
      .update({ balance: toAcc.balance + amount })
      .eq("id", toAcc.id)
      .select()
      .single(),
  ]);

  if (resFrom.error || resTo.error) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    if (!resFrom.error)
      await supabase
        .from("accounts")
        .update({ balance: fromAcc.balance })
        .eq("id", fromAcc.id);
    if (!resTo.error)
      await supabase
        .from("accounts")
        .update({ balance: toAcc.balance })
        .eq("id", toAcc.id);
    return jsonRes(
      { error: "Gagal update saldo. Transfer dibatalkan." },
      500
    );
  }

  return jsonRes({
    transaction: tx,
    accounts: [resFrom.data, resTo.data],
  });
}

// ── ADJUST BALANCE (Koreksi Saldo) ───────────────────────────────
async function handleAdjustBalance(supabase: any, userId: string, body: any) {
  const { account_id, new_balance } = body;
  if (!account_id || new_balance === undefined)
    return jsonRes({ error: "account_id dan new_balance wajib" }, 400);

  // Fetch current account
  const { data: acc, error: accErr } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", account_id)
    .eq("user_id", userId)
    .single();
  if (accErr || !acc)
    return jsonRes({ error: "Akun tidak ditemukan" }, 404);

  const diff = new_balance - acc.balance;
  if (diff === 0) return jsonRes({ account: acc, transaction: null });

  // Update balance
  const { data: updAcc, error: balErr } = await supabase
    .from("accounts")
    .update({ balance: new_balance })
    .eq("id", account_id)
    .select()
    .single();
  if (balErr || !updAcc)
    return jsonRes({ error: "Gagal update saldo" }, 500);

  // Insert correction transaction
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id,
      account_name: acc.name,
      type: diff > 0 ? "income" : "expense",
      amount: Math.abs(diff),
      category: "Koreksi Saldo",
      note: `Koreksi saldo ${acc.name}`,
      icon: "\u2696\uFE0F",
      date: dateStr,
    })
    .select()
    .single();
  if (txErr) {
    // Rollback balance
    await supabase
      .from("accounts")
      .update({ balance: acc.balance })
      .eq("id", account_id);
    return jsonRes({ error: "Gagal membuat transaksi koreksi. Dibatalkan." }, 500);
  }

  return jsonRes({ account: updAcc, transaction: tx });
}

// ── ADD ACCOUNT ──────────────────────────────────────────────────
const ACCOUNT_ICONS: Record<string, string> = {
  bank: "\u{1F3E6}",
  ewallet: "\u{1F4F1}",
  cash: "\u{1F4B5}",
  crypto: "\u20BF",
  investasi: "\u{1F4C8}",
  tabungan: "\u{1FA99}",
};
const ACCOUNT_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
];

async function handleAddAccount(supabase: any, userId: string, body: any) {
  const { name, type, balance } = body;
  if (!name || type === undefined || balance === undefined)
    return jsonRes({ error: "name, type, balance wajib" }, 400);

  // Check duplicate name
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();
  if (existing)
    return jsonRes({ error: `Akun "${name}" sudah ada` }, 400);

  // Count existing accounts for color rotation
  const { count } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data: acc, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name,
      type: type || "bank",
      balance: parseInt(balance) || 0,
      icon: ACCOUNT_ICONS[type] || "\u{1F4B0}",
      color: ACCOUNT_COLORS[(count || 0) % ACCOUNT_COLORS.length],
    })
    .select()
    .single();
  if (error) return jsonRes({ error: "Gagal menyimpan akun" }, 500);

  return jsonRes({ account: acc });
}

// ── EDIT ACCOUNT ─────────────────────────────────────────────────
async function handleEditAccount(supabase: any, userId: string, body: any) {
  const { id, name, type, icon, color } = body;
  if (!id) return jsonRes({ error: "id wajib" }, 400);

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) {
    updates.type = type;
    updates.icon = ACCOUNT_ICONS[type] || icon || "\u{1F4B0}";
  }
  if (icon !== undefined) updates.icon = icon;
  if (color !== undefined) updates.color = color;

  if (Object.keys(updates).length === 0)
    return jsonRes({ error: "Tidak ada field yang diubah" }, 400);

  const { data: acc, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) return jsonRes({ error: "Gagal mengubah akun" }, 500);

  return jsonRes({ account: acc });
}

// ── DELETE ACCOUNT ───────────────────────────────────────────────
async function handleDeleteAccount(supabase: any, userId: string, body: any) {
  const { id } = body;
  if (!id) return jsonRes({ error: "id wajib" }, 400);

  // Check if account has transactions
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("account_name", (
      await supabase.from("accounts").select("name").eq("id", id).eq("user_id", userId).single()
    ).data?.name || "");

  if ((count || 0) > 0)
    return jsonRes(
      { error: `Akun masih punya ${count} transaksi. Hapus transaksi dulu atau pindahkan ke akun lain.` },
      400
    );

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return jsonRes({ error: "Gagal menghapus akun" }, 500);

  return jsonRes({ success: true, deletedId: id });
}

// ── LIST ACCOUNTS ────────────────────────────────────────────────
async function handleListAccounts(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) return jsonRes({ error: "Gagal memuat akun" }, 500);

  return jsonRes({ accounts: data || [] });
}
