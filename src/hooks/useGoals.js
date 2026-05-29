import { useState } from "react";
import { supabase } from "../lib/supabase";
import { callEdge } from "../services/api";
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
    showToast(`Target "${data.name}" berhasil ditambahkan!`);
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
    showToast(`Target "${data.name}" diperbarui!`);
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
    try {
      const result = await callEdge("financial-ops", {
        action: "topup-goal",
        goal_id: goalId,
        amount,
        account_name: accountName || null,
        date: toLocalDateStr(),
      });

      setGoals((p) => p.map((g) => (g.id === goalId ? result.goal : g)));

      if (result.account) {
        setAccounts((p) => p.map((a) => (a.id === result.account.id ? result.account : a)));
      }
      if (result.transaction) {
        setTransactions((p) => [result.transaction, ...p]);
      }

      if (accountName) {
        showToast(`+Rp ${amount.toLocaleString("id-ID")} ditabung dari ${accountName}`);
      } else {
        showToast(`Dana bertambah Rp ${amount.toLocaleString("id-ID")}!`);
      }

      if (result.reached) {
        showToast(`Target "${goal.name}" tercapai!`);
      }
    } catch (err) {
      showToast(err.message || "Gagal topup goal", "error");
    }
  };

  return { goals, setGoals, addGoal, editGoal, deleteGoal, topupGoal };
}
