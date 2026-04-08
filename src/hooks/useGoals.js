import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toLocalDateStr } from "../utils/dateHelpers";

export function useGoals(userId, showToast, accountsRef) {
    const [goals, setGoals] = useState([]);

    const addGoal = async (payload) => {
        const { data, error } = await supabase.from("goals").insert({ user_id: userId, ...payload }).select().single();
        if (error) { showToast("Gagal menyimpan target", "error"); return; }
        setGoals(p => [...p, data]);
        showToast(`🎯 Target "${data.name}" berhasil ditambahkan!`);
    };

    const editGoal = async (id, payload) => {
        const { data, error } = await supabase.from("goals").update(payload).eq("id", id).select().single();
        if (error) { showToast("Gagal mengubah target", "error"); return; }
        setGoals(p => p.map(g => g.id === id ? data : g));
        showToast(`✅ Target "${data.name}" diperbarui!`);
    };

    const deleteGoal = async (id) => {
        const { error } = await supabase.from("goals").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus target", "error"); return; }
        setGoals(p => p.filter(g => g.id !== id));
        showToast("Target dihapus");
    };

    const topupGoal = async (goalId, goal, amount, accountName, { setTransactions, setAccounts }) => {
        const newCurrent = goal.current + amount;
        const { data: updGoal, error: gErr } = await supabase
            .from("goals").update({ current: newCurrent }).eq("id", goalId).select().single();
        if (gErr) { showToast("Gagal memperbarui target", "error"); return; }
        setGoals(p => p.map(g => g.id === goalId ? updGoal : g));

        if (accountName) {
            const dateStr = toLocalDateStr();
            const tx = {
                user_id: userId, type: "expense", amount,
                category: "Tabungan & Goal",
                note: `Tabungan: ${goal.name}`,
                date: dateStr,
                account_name: accountName,
                icon: "🎯",
            };
            const { data: newTx } = await supabase.from("transactions").insert(tx).select().single();
            if (newTx) setTransactions(p => [newTx, ...p]);

            const accounts = accountsRef.current;
            const acc = accounts.find(a => a.name === accountName);
            if (acc) {
                const newBal = Math.max(0, acc.balance - amount);
                const { data: updAcc } = await supabase.from("accounts").update({ balance: newBal }).eq("id", acc.id).select().single();
                if (updAcc) setAccounts(p => p.map(a => a.id === acc.id ? updAcc : a));
            }
            showToast(`💰 +Rp ${amount.toLocaleString("id-ID")} ditabung dari ${accountName}`);
        } else {
            showToast(`💰 Dana bertambah Rp ${amount.toLocaleString("id-ID")}!`);
        }

        if (newCurrent >= goal.target) showToast(`🎉 Target "${goal.name}" tercapai!`);
    };

    return { goals, setGoals, addGoal, editGoal, deleteGoal, topupGoal };
}
