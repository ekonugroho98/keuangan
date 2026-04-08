import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useRecurrings(userId, showToast) {
    const [recurrings, setRecurrings] = useState([]);

    const addRecurring = async (form) => {
        const { data, error } = await supabase.from("recurring_transactions").insert({
            user_id: userId, ...form,
        }).select().single();
        if (error) { showToast("Gagal menyimpan transaksi berulang", "error"); return; }
        setRecurrings(p => [...p, data].sort((a, b) => new Date(a.next_date) - new Date(b.next_date)));
        showToast(`✅ "${data.name}" ditambahkan!`);
    };

    const editRecurring = async (id, form) => {
        const { data, error } = await supabase.from("recurring_transactions")
            .update(form).eq("id", id).select().single();
        if (error) { showToast("Gagal mengubah transaksi berulang", "error"); return; }
        setRecurrings(p => p.map(r => r.id === id ? data : r).sort((a, b) => new Date(a.next_date) - new Date(b.next_date)));
        showToast(`✅ "${data.name}" diperbarui!`);
    };

    const deleteRecurring = async (id) => {
        const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus", "error"); return; }
        setRecurrings(p => p.filter(r => r.id !== id));
        showToast("Transaksi berulang dihapus");
    };

    return { recurrings, setRecurrings, addRecurring, editRecurring, deleteRecurring };
}
