import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toLocalDateStr } from "../utils/dateHelpers";

export function usePiutang(userId, showToast) {
  const [piutang, setPiutang] = useState([]);

  const addPiutang = async (
    payload,
    { accounts, setAccounts, setTransactions },
  ) => {
    const { data, error } = await supabase
      .from("piutang")
      .insert({ user_id: userId, ...payload })
      .select()
      .single();
    if (error) {
      showToast("Gagal menyimpan piutang", "error");
      return;
    }
    setPiutang((p) => [...p, data]);

    if (payload.from_account) {
      const acc = accounts.find((a) => a.name === payload.from_account);
      if (!acc) {
        showToast(
          `🤝 Piutang dicatat, tapi akun "${payload.from_account}" tidak ditemukan untuk potong saldo.`,
          "error",
        );
        return;
      }

      // Refetch saldo terbaru
      const { data: freshAcc, error: fetchErr } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", acc.id)
        .single();
      if (fetchErr || !freshAcc) {
        showToast(
          `🤝 Piutang dicatat, tapi gagal membaca saldo akun.`,
          "error",
        );
        return;
      }

      if (freshAcc.balance < payload.total) {
        showToast(
          `⚠️ Saldo ${payload.from_account} (Rp ${freshAcc.balance.toLocaleString("id-ID")}) tidak cukup untuk piutang Rp ${payload.total.toLocaleString("id-ID")}`,
          "error",
        );
        return;
      }

      // Update saldo
      const newBal = freshAcc.balance - payload.total;
      const { data: updAcc, error: accErr } = await supabase
        .from("accounts")
        .update({ balance: newBal })
        .eq("id", acc.id)
        .select()
        .single();
      if (accErr || !updAcc) {
        showToast("Piutang dicatat, tapi gagal update saldo akun.", "error");
        return;
      }
      setAccounts((p) => p.map((a) => (a.id === acc.id ? updAcc : a)));

      // Buat record transaksi untuk audit trail
      const tx = {
        user_id: userId,
        type: "expense",
        amount: payload.total,
        category: "Piutang",
        note: `Piutang ke ${payload.borrower_name || "seseorang"}`,
        date: toLocalDateStr(),
        account_name: payload.from_account,
        icon: "🤝",
      };
      const { data: newTx } = await supabase
        .from("transactions")
        .insert(tx)
        .select()
        .single();
      if (newTx && setTransactions) setTransactions((p) => [newTx, ...p]);
    }

    showToast(`🤝 Piutang ke "${data.borrower_name}" berhasil dicatat!`);
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
    showToast(`✅ Piutang "${data.borrower_name}" diperbarui!`);
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
    // 1. Validate akun
    const acc = accounts.find((a) => a.name === accountName);
    if (!acc) {
      showToast("Akun tidak ditemukan. Pilih akun yang valid.", "error");
      return;
    }

    // 2. Refetch saldo terbaru
    const { data: freshAcc, error: fetchErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", acc.id)
      .single();
    if (fetchErr || !freshAcc) {
      showToast("Gagal membaca saldo akun. Coba lagi.", "error");
      return;
    }

    // 3. Update saldo akun (income — tambah)
    const newBal = freshAcc.balance + amount;
    const { data: updAcc, error: accErr } = await supabase
      .from("accounts")
      .update({ balance: newBal })
      .eq("id", acc.id)
      .select()
      .single();
    if (accErr || !updAcc) {
      showToast("Gagal update saldo akun.", "error");
      return;
    }

    // 4. Update sisa piutang
    const newRemaining = Math.max(0, item.remaining - amount);
    const { data: updPiu, error: piuErr } = await supabase
      .from("piutang")
      .update({ remaining: newRemaining })
      .eq("id", item.id)
      .select()
      .single();
    if (piuErr || !updPiu) {
      // Rollback saldo
      await supabase
        .from("accounts")
        .update({ balance: freshAcc.balance })
        .eq("id", acc.id);
      showToast("Gagal update piutang. Saldo dikembalikan.", "error");
      return;
    }

    // 5. Buat record transaksi untuk audit trail
    const tx = {
      user_id: userId,
      type: "income",
      amount,
      category: "Piutang",
      note: `Terima piutang dari ${item.borrower_name || "seseorang"}`,
      date: toLocalDateStr(),
      account_name: accountName,
      icon: "🤝",
    };
    const { data: newTx } = await supabase
      .from("transactions")
      .insert(tx)
      .select()
      .single();
    if (newTx && setTransactions) setTransactions((p) => [newTx, ...p]);

    // 6. Update state
    setAccounts((p) => p.map((a) => (a.id === acc.id ? updAcc : a)));
    setPiutang((p) => p.map((d) => (d.id === item.id ? updPiu : d)));
    showToast(
      `✅ Terima Rp ${amount.toLocaleString("id-ID")} dari ${item.borrower_name} berhasil dicatat!`,
    );
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
