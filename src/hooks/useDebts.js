import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toLocalDateStr } from "../utils/dateHelpers";

export function useDebts(userId, showToast) {
    const [debts, setDebts] = useState([]);

    const addDebt = async (payload) => {
        const { data, error } = await supabase.from("debts").insert({ user_id: userId, ...payload }).select().single();
        if (error) { showToast("Gagal menyimpan hutang", "error"); return; }
        setDebts(p => [...p, data]);
        showToast(`📋 Hutang "${data.name}" berhasil dicatat!`);
    };

    const editDebt = async (id, payload) => {
        const { data, error } = await supabase.from("debts").update(payload).eq("id", id).select().single();
        if (error) { showToast("Gagal mengubah hutang", "error"); return; }
        setDebts(p => p.map(d => d.id === id ? data : d));
        showToast(`✅ Hutang "${data.name}" diperbarui!`);
    };

    const deleteDebt = async (id) => {
        const { error } = await supabase.from("debts").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus hutang", "error"); return; }
        setDebts(p => p.filter(d => d.id !== id));
        showToast("Hutang dihapus");
    };

    const payDebt = async (debt, amount, accountName, { accounts, setAccounts, setTransactions }) => {
        const today = toLocalDateStr();
        const tx = {
            user_id: userId, type: "expense", amount,
            category: "Hutang & Cicilan",
            note: `Cicilan ${debt.name}`,
            date: today,
            account_name: accountName,
            icon: "📋",
        };
        const { data: newTx } = await supabase.from("transactions").insert(tx).select().single();
        if (newTx) setTransactions(p => [newTx, ...p]);

        const acc = accounts.find(a => a.name === accountName);
        if (acc) {
            const newBal = Math.max(0, acc.balance - amount);
            const { data: updAcc } = await supabase.from("accounts").update({ balance: newBal }).eq("id", acc.id).select().single();
            if (updAcc) setAccounts(p => p.map(a => a.id === acc.id ? updAcc : a));
        }

        const newRemaining = Math.max(0, debt.remaining - amount);
        const { data: updDebt } = await supabase.from("debts").update({ remaining: newRemaining }).eq("id", debt.id).select().single();
        if (updDebt) setDebts(p => p.map(d => d.id === debt.id ? updDebt : d));

        showToast(`✅ Cicilan ${debt.name} Rp ${amount.toLocaleString("id-ID")} berhasil dicatat!`);
    };

    return { debts, setDebts, addDebt, editDebt, deleteDebt, payDebt };
}
