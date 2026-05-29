import { useState } from "react";
import { supabase } from "../lib/supabase";
import { callEdge } from "../services/api";
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
    showToast(`Hutang "${data.name}" berhasil dicatat!`);
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
    showToast(`Hutang "${data.name}" diperbarui!`);
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
    try {
      const result = await callEdge("financial-ops", {
        action: "pay-debt",
        debt_id: debt.id,
        amount,
        account_name: accountName,
        date: toLocalDateStr(),
      });
      setTransactions((p) => [result.transaction, ...p]);
      setAccounts((p) => p.map((a) => (a.id === result.account.id ? result.account : a)));
      setDebts((p) => p.map((d) => (d.id === debt.id ? result.debt : d)));
      showToast(
        `Cicilan ${debt.name} Rp ${amount.toLocaleString("id-ID")} berhasil dicatat!`,
      );
    } catch (err) {
      showToast(err.message || "Gagal bayar cicilan", "error");
    }
  };

  return { debts, setDebts, addDebt, editDebt, deleteDebt, payDebt };
}
