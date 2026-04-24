import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toLocalDateStr } from "../utils/dateHelpers";

export function useGoals(userId, showToast, accountsRef) {
  const [goals, setGoals] = useState([]);

  const addGoal = async (payload) => {
    const { data, error } = await supabase
      .from("goals")
      .insert({ user_id: userId, ...payload })
      .select()
      .single();
    if (error) {
      showToast("Gagal menyimpan target", "error");
      return;
    }
    setGoals((p) => [...p, data]);
    showToast(`🎯 Target "${data.name}" berhasil ditambahkan!`);
  };

  const editGoal = async (id, payload) => {
    const { data, error } = await supabase
      .from("goals")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      showToast("Gagal mengubah target", "error");
      return;
    }
    setGoals((p) => p.map((g) => (g.id === id ? data : g)));
    showToast(`✅ Target "${data.name}" diperbarui!`);
  };

  const deleteGoal = async (id) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) {
      showToast("Gagal menghapus target", "error");
      return;
    }
    setGoals((p) => p.filter((g) => g.id !== id));
    showToast("Target dihapus");
  };

  const topupGoal = async (
    goalId,
    goal,
    amount,
    accountName,
    { setTransactions, setAccounts },
  ) => {
    if (accountName) {
      // 1. Validate: account harus ada
      const accounts = accountsRef.current;
      const acc = accounts.find((a) => a.name === accountName);
      if (!acc) {
        showToast("Akun tidak ditemukan. Pilih akun yang valid.", "error");
        return;
      }

      // 2. Refetch saldo terbaru dari DB
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
          `⚠️ Saldo ${accountName} (Rp ${freshAcc.balance.toLocaleString("id-ID")}) tidak cukup`,
          "error",
        );
        return;
      }

      // 4. Insert transaksi
      const dateStr = toLocalDateStr();
      const tx = {
        user_id: userId,
        type: "expense",
        amount,
        category: "Tabungan & Goal",
        note: `Tabungan: ${goal.name}`,
        date: dateStr,
        account_name: accountName,
        icon: "🎯",
      };
      const { data: newTx, error: txErr } = await supabase
        .from("transactions")
        .insert(tx)
        .select()
        .single();
      if (txErr || !newTx) {
        showToast("Gagal menyimpan transaksi tabungan", "error");
        return;
      }

      // 5. Update saldo akun (fresh balance)
      const newBal = freshAcc.balance - amount;
      const { data: updAcc, error: accErr } = await supabase
        .from("accounts")
        .update({ balance: newBal })
        .eq("id", acc.id)
        .select()
        .single();
      if (accErr || !updAcc) {
        await supabase.from("transactions").delete().eq("id", newTx.id);
        showToast("Gagal update saldo. Transaksi dibatalkan.", "error");
        return;
      }

      // 6. Update goal
      const newCurrent = goal.current + amount;
      const { data: updGoal, error: gErr } = await supabase
        .from("goals")
        .update({ current: newCurrent })
        .eq("id", goalId)
        .select()
        .single();
      if (gErr || !updGoal) {
        // Rollback saldo & transaksi
        await supabase
          .from("accounts")
          .update({ balance: freshAcc.balance })
          .eq("id", acc.id);
        await supabase.from("transactions").delete().eq("id", newTx.id);
        showToast("Gagal update target. Transaksi dibatalkan.", "error");
        return;
      }

      // 7. Semua berhasil — update state
      setTransactions((p) => [newTx, ...p]);
      setAccounts((p) => p.map((a) => (a.id === acc.id ? updAcc : a)));
      setGoals((p) => p.map((g) => (g.id === goalId ? updGoal : g)));
      showToast(
        `💰 +Rp ${amount.toLocaleString("id-ID")} ditabung dari ${accountName}`,
      );

      if (newCurrent >= goal.target)
        showToast(`🎉 Target "${goal.name}" tercapai!`);
    } else {
      // Tanpa akun — hanya update goal
      const newCurrent = goal.current + amount;
      const { data: updGoal, error: gErr } = await supabase
        .from("goals")
        .update({ current: newCurrent })
        .eq("id", goalId)
        .select()
        .single();
      if (gErr) {
        showToast("Gagal memperbarui target", "error");
        return;
      }
      setGoals((p) => p.map((g) => (g.id === goalId ? updGoal : g)));
      showToast(`💰 Dana bertambah Rp ${amount.toLocaleString("id-ID")}!`);
      if (newCurrent >= goal.target)
        showToast(`🎉 Target "${goal.name}" tercapai!`);
    }
  };

  return { goals, setGoals, addGoal, editGoal, deleteGoal, topupGoal };
}
