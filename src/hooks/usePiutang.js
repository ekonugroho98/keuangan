import { useState } from "react";
import { supabase } from "../lib/supabase";

export function usePiutang(userId, showToast) {
    const [piutang, setPiutang] = useState([]);

    const addPiutang = async (payload, { accounts, setAccounts }) => {
        const { data, error } = await supabase.from("piutang").insert({ user_id: userId, ...payload }).select().single();
        if (error) { showToast("Gagal menyimpan piutang", "error"); return; }
        setPiutang(p => [...p, data]);

        if (payload.from_account) {
            const acc = accounts.find(a => a.name === payload.from_account);
            if (acc) {
                const newBal = Math.max(0, acc.balance - payload.total);
                const { data: updAcc } = await supabase.from("accounts").update({ balance: newBal }).eq("id", acc.id).select().single();
                if (updAcc) setAccounts(p => p.map(a => a.id === acc.id ? updAcc : a));
            }
        }

        showToast(`🤝 Piutang ke "${data.borrower_name}" berhasil dicatat!`);
    };

    const editPiutang = async (id, payload) => {
        const { data, error } = await supabase.from("piutang").update(payload).eq("id", id).select().single();
        if (error) { showToast("Gagal mengubah piutang", "error"); return; }
        setPiutang(p => p.map(d => d.id === id ? data : d));
        showToast(`✅ Piutang "${data.borrower_name}" diperbarui!`);
    };

    const deletePiutang = async (id) => {
        const { error } = await supabase.from("piutang").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus piutang", "error"); return; }
        setPiutang(p => p.filter(d => d.id !== id));
        showToast("Piutang dihapus");
    };

    const terimaPiutang = async (item, amount, accountName, { accounts, setAccounts }) => {
        const acc = accounts.find(a => a.name === accountName);
        if (acc) {
            const newBal = acc.balance + amount;
            const { data: updAcc } = await supabase.from("accounts").update({ balance: newBal }).eq("id", acc.id).select().single();
            if (updAcc) setAccounts(p => p.map(a => a.id === acc.id ? updAcc : a));
        }

        const newRemaining = Math.max(0, item.remaining - amount);
        const { data: updPiu } = await supabase.from("piutang").update({ remaining: newRemaining }).eq("id", item.id).select().single();
        if (updPiu) setPiutang(p => p.map(d => d.id === item.id ? updPiu : d));

        showToast(`✅ Terima Rp ${amount.toLocaleString("id-ID")} dari ${item.borrower_name} berhasil dicatat!`);
    };

    return { piutang, setPiutang, addPiutang, editPiutang, deletePiutang, terimaPiutang };
}
