import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useSplitBills(userId, showToast) {
    const [splitBills, setSplitBills] = useState([]);

    const addSplitBill = async (payload) => {
        const { members, ...billData } = payload;
        const { data: bill, error } = await supabase
            .from("split_bills")
            .insert({ user_id: userId, title: billData.title, total_amount: billData.total_amount, date: billData.date, note: billData.note || "" })
            .select().single();
        if (error) { showToast("Gagal menyimpan tagihan", "error"); return; }
        if (members && members.length > 0) {
            const memberRows = members.map(m => ({ bill_id: bill.id, name: m.name, amount: m.amount, paid: false }));
            const { data: mData } = await supabase.from("split_bill_members").insert(memberRows).select();
            setSplitBills(p => [{ ...bill, split_bill_members: mData || [] }, ...p]);
        } else {
            setSplitBills(p => [{ ...bill, split_bill_members: [] }, ...p]);
        }
        showToast(`🧾 "${bill.title}" berhasil ditambahkan!`);
    };

    const deleteSplitBill = async (id) => {
        await supabase.from("split_bill_members").delete().eq("bill_id", id);
        const { error } = await supabase.from("split_bills").delete().eq("id", id);
        if (error) { showToast("Gagal menghapus tagihan", "error"); return; }
        setSplitBills(p => p.filter(b => b.id !== id));
        showToast("Tagihan dihapus");
    };

    const toggleMemberPaid = async (memberId, paid) => {
        const { data, error } = await supabase
            .from("split_bill_members").update({ paid }).eq("id", memberId).select().single();
        if (error) { showToast("Gagal update status", "error"); return; }
        setSplitBills(p => p.map(bill => ({
            ...bill,
            split_bill_members: (bill.split_bill_members || []).map(m => m.id === memberId ? data : m),
        })));
    };

    return { splitBills, setSplitBills, addSplitBill, deleteSplitBill, toggleMemberPaid };
}
