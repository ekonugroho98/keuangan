import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useInvestments(userId, showToast) {
    const [investments, setInvestments] = useState([]);

    const addInvestment = async (payload) => {
        const { data, error } = await supabase.from("investments").insert({ user_id: userId, ...payload }).select().single();
        if (error) { showToast("Gagal menyimpan aset", "error"); return; }
        setInvestments(p => [...p, data]);
        showToast(`📈 Aset "${data.name}" berhasil ditambahkan!`);
    };

    const editInvestment = async (id, payload) => {
        const { data, error } = await supabase.from("investments").update(payload).eq("id", id).select().single();
        if (error) { showToast("Gagal mengubah aset", "error"); return; }
        setInvestments(p => p.map(i => i.id === id ? data : i));
        showToast(`✅ Aset "${data.name}" diperbarui!`);
    };

    const deleteInvestment = async (id) => {
        const { error } = await supabase.from("investments").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus aset", "error"); return; }
        setInvestments(p => p.filter(i => i.id !== id));
        showToast("Aset dihapus");
    };

    return { investments, setInvestments, addInvestment, editInvestment, deleteInvestment };
}
