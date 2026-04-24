import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toLocalDateStr } from "../utils/dateHelpers";

export function useDebts(userId, showToast) {
  const [debts, setDebts] = useState([]);

  const addDebt = async (payload) => {
    const { data, error } = await supabase
      .from("debts")
      .insert({ user_id: userId, ...payload })
      .select()
      .single();
    if (error) {
      showToast("Gagal menyimpan hutang", "error");
      return;
    }
    setDebts((p) => [...p, data]);
    showToast(`📋 Hutang "${data.name}" berhasil dicatat!`);
  };

  const editDebt = async (id, payload) => {
    const { data, error } = await supabase
      .from("debts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      showToast("Gagal mengubah hutang", "error");
      return;
    }
    setDebts((p) => p.map((d) => (d.id === id ? data : d)));
    showToast(`✅ Hutang "${data.name}" diperbarui!`);
  };

  const deleteDebt = async (id) => {
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) {
      showToast("Gagal menghapus hutang", "error");
      return;
    }
    setDebts((p) => p.filter((d) => d.id !== id));
    showToast("Hutang dihapus");
  };

  const payDebt = async (
    debt,
    amount,
    accountName,
    { accounts, setAccounts, setTransactions },
  ) => {
    // 1. Validate: account harus ada
    const acc = accounts.find((a) => a.name === accountName);
    if (!acc) {
      showToast("Akun tidak ditemukan. Pilih akun yang valid.", "error");
      return;
    }

    // 2. Refetch saldo terbaru dari DB untuk hindari race condition
    const { data: freshAcc, error: fetchErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", acc.id)
      .single();
    if (fetchErr || !freshAcc) {
      showToast("Gagal membaca saldo akun. Coba lagi.", "error");
      return;
    }

    // 3. Cek saldo cukup
    if (freshAcc.balance < amount) {
      showToast(
        `⚠️ Saldo ${accountName} (Rp ${freshAcc.balance.toLocaleString("id-ID")}) tidak cukup untuk cicilan Rp ${amount.toLocaleString("id-ID")}`,
        "error",
      );
      return;
    }

    // 4. Insert transaksi
    const today = toLocalDateStr();
    const tx = {
      user_id: userId,
      type: "expense",
      amount,
      category: "Hutang & Cicilan",
      note: `Cicilan ${debt.name}`,
      date: today,
      account_name: accountName,
      icon: "📋",
    };
    const { data: newTx, error: txErr } = await supabase
      .from("transactions")
      .insert(tx)
      .select()
      .single();
    if (txErr || !newTx) {
      showToast("Gagal menyimpan transaksi cicilan", "error");
      return;
    }

    // 5. Update saldo akun (gunakan saldo fresh)
    const newBal = freshAcc.balance - amount;
    const { data: updAcc, error: accErr } = await supabase
      .from("accounts")
      .update({ balance: newBal })
      .eq("id", acc.id)
      .select()
      .single();
    if (accErr || !updAcc) {
      // Rollback: hapus transaksi
      await supabase.from("transactions").delete().eq("id", newTx.id);
      showToast("Gagal update saldo. Transaksi dibatalkan.", "error");
      return;
    }

    // 6. Update sisa hutang
    const newRemaining = Math.max(0, debt.remaining - amount);
    const { data: updDebt, error: debtErr } = await supabase
      .from("debts")
      .update({ remaining: newRemaining })
      .eq("id", debt.id)
      .select()
      .single();
    if (debtErr || !updDebt) {
      // Rollback: kembalikan saldo & hapus transaksi
      await supabase
        .from("accounts")
        .update({ balance: freshAcc.balance })
        .eq("id", acc.id);
      await supabase.from("transactions").delete().eq("id", newTx.id);
      showToast("Gagal update hutang. Transaksi dibatalkan.", "error");
      return;
    }

    // 7. Semua berhasil — update state
    setTransactions((p) => [newTx, ...p]);
    setAccounts((p) => p.map((a) => (a.id === acc.id ? updAcc : a)));
    setDebts((p) => p.map((d) => (d.id === debt.id ? updDebt : d)));
    showToast(
      `✅ Cicilan ${debt.name} Rp ${amount.toLocaleString("id-ID")} berhasil dicatat!`,
    );
  };

  return { debts, setDebts, addDebt, editDebt, deleteDebt, payDebt };
}
