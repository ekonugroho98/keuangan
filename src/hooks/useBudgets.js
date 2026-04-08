import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useBudgets(userId, showToast) {
    const [budgets, setBudgets] = useState([]);

    const addBudget = async (payload) => {
        const { data, error } = await supabase.from("budgets").insert({ user_id: userId, ...payload }).select().single();
        if (error) { showToast("Gagal menyimpan anggaran", "error"); return; }
        setBudgets(p => [...p, data]);
        showToast(`💰 Anggaran "${data.category}" berhasil ditambahkan!`);
    };

    const editBudget = async (id, payload) => {
        const { data, error } = await supabase.from("budgets").update(payload).eq("id", id).select().single();
        if (error) { showToast("Gagal mengubah anggaran", "error"); return; }
        setBudgets(p => p.map(b => b.id === id ? data : b));
        showToast(`✅ Anggaran diperbarui!`);
    };

    const deleteBudget = async (id) => {
        const { error } = await supabase.from("budgets").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus anggaran", "error"); return; }
        setBudgets(p => p.filter(b => b.id !== id));
        showToast("Anggaran dihapus");
    };

    const copyBudgetMonth = async (prevBudgets, targetMonth) => {
        const inserts = prevBudgets.map(b => ({
            user_id: userId,
            category: b.category,
            amount: b.amount,
            month: targetMonth,
        }));
        const { data, error } = await supabase.from("budgets").insert(inserts).select();
        if (error) { showToast("Gagal menyalin anggaran", "error"); return; }
        setBudgets(p => [...p, ...(data || [])]);
        showToast(`✅ ${inserts.length} anggaran disalin ke bulan ini!`);
    };

    return { budgets, setBudgets, addBudget, editBudget, deleteBudget, copyBudgetMonth };
}
