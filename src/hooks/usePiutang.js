import { useState } from "react";
import { supabase } from "../lib/supabase";
import { callEdge } from "../services/api";

export function usePiutang(userId, showToast) {
  const [piutang, setPiutang] = useState([]);

  const addPiutang = async (
    payload,
    { accounts, setAccounts, setTransactions },
  ) => {
    try {
      const result = await callEdge("financial-ops", {
        action: "add-piutang",
        payload,
        from_account: payload.from_account || null,
      });
      setPiutang((p) => [...p, result.piutang]);
      if (result.account) {
        setAccounts((p) => p.map((a) => (a.id === result.account.id ? result.account : a)));
      }
      if (result.transaction && setTransactions) {
        setTransactions((p) => [result.transaction, ...p]);
      }
      showToast(`Piutang ke "${result.piutang.borrower_name}" berhasil dicatat!`);
    } catch (err) {
      showToast(err.message || "Gagal menyimpan piutang", "error");
    }
  };

  const editPiutang = async (id, payload) => {
    const { data, error } = await supabase
      .from("piutang")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      showToast("Gagal mengubah piutang", "error");
      return;
    }
    setPiutang((p) => p.map((d) => (d.id === id ? data : d)));
    showToast(`Piutang "${data.borrower_name}" diperbarui!`);
  };

  const deletePiutang = async (id) => {
    const { error } = await supabase.from("piutang").delete().eq("id", id);
    if (error) {
      showToast("Gagal menghapus piutang", "error");
      return;
    }
    setPiutang((p) => p.filter((d) => d.id !== id));
    showToast("Piutang dihapus");
  };

  const terimaPiutang = async (
    item,
    amount,
    accountName,
    { accounts, setAccounts, setTransactions },
  ) => {
    try {
      const result = await callEdge("financial-ops", {
        action: "terima-piutang",
        piutang_id: item.id,
        amount,
        account_name: accountName,
      });
      setAccounts((p) => p.map((a) => (a.id === result.account.id ? result.account : a)));
      setPiutang((p) => p.map((d) => (d.id === item.id ? result.piutang : d)));
      if (result.transaction && setTransactions) {
        setTransactions((p) => [result.transaction, ...p]);
      }
      showToast(
        `Terima Rp ${amount.toLocaleString("id-ID")} dari ${item.borrower_name} berhasil!`,
      );
    } catch (err) {
      showToast(err.message || "Gagal terima piutang", "error");
    }
  };

  return {
    piutang,
    setPiutang,
    addPiutang,
    editPiutang,
    deletePiutang,
    terimaPiutang,
  };
}
