import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useCategories(userId, showToast) {
    const [customCategories, setCustomCategories] = useState([]);

    const addCategory = async (form) => {
        const { data, error } = await supabase.from("categories").insert({
            user_id: userId,
            name: form.name.trim(),
            icon: form.icon,
            type: form.type,
            color: form.color,
        }).select().single();
        if (error) { showToast("Gagal menambah kategori", "error"); return; }
        setCustomCategories(p => [...p, data]);
        showToast(`Kategori "${data.name}" berhasil ditambahkan!`);
    };

    const editCategory = async (id, form) => {
        const { data, error } = await supabase.from("categories")
            .update({ name: form.name.trim(), icon: form.icon, type: form.type, color: form.color })
            .eq("id", id).select().single();
        if (error) { showToast("Gagal mengubah kategori", "error"); return; }
        setCustomCategories(p => p.map(c => c.id === id ? data : c));
        showToast(`Kategori "${data.name}" berhasil diperbarui!`);
    };

    const deleteCategory = async (id) => {
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus kategori", "error"); return; }
        setCustomCategories(p => p.filter(c => c.id !== id));
        showToast("Kategori berhasil dihapus");
    };

    return { customCategories, setCustomCategories, addCategory, editCategory, deleteCategory };
}
