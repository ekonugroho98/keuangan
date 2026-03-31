import { useState, useEffect } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import { useLanguage } from "../i18n/LanguageContext";
import AddTransactionModal from "../components/dashboard/AddTransactionModal";
import AddAccountModal from "../components/dashboard/AddAccountModal";
import DasborView from "../components/dashboard/views/DasborView";
import TransaksiView from "../components/dashboard/views/TransaksiView";
import AkunView from "../components/dashboard/views/AkunView";
import KategoriView from "../components/dashboard/views/KategoriView";
import BerulangView from "../components/dashboard/views/BerulangView";
import GoalsView from "../components/dashboard/views/GoalsView";
import HutangView from "../components/dashboard/views/HutangView";
import InvestasiView from "../components/dashboard/views/InvestasiView";
import LaporanView from "../components/dashboard/views/LaporanView";
import AiView from "../components/dashboard/views/AiView";
import PricingModal from "../components/dashboard/PricingModal";
import { categoryIcons } from "../constants/categories";
import { supabase } from "../lib/supabase";

const NAV_LABELS = {
    dasbor: "nav.dashboard", transaksi: "nav.transaction", akun: "nav.accounts",
    kategori: "nav.categories", berulang: "nav.recurring", goals: "nav.goals",
    hutang: "nav.debts", investasi: "nav.investments", laporan: "nav.reports", ai: "nav.ai",
};

const Dashboard = ({ session, onLogout, showToast }) => {
    const { t } = useLanguage();
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email.split("@")[0];

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeMenu, setActiveMenu] = useState("dasbor");
    const [showAddTx, setShowAddTx] = useState(false);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [txForm, setTxForm] = useState({ type: "expense", amount: "", category: "Makanan", note: "", account: "", toAccount: "" });
    const [accForm, setAccForm] = useState({ name: "", type: "bank", balance: "" });

    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [goals, setGoals] = useState([]);
    const [debts, setDebts] = useState([]);
    const [recurrings, setRecurrings] = useState([]);
    const [customCategories, setCustomCategories] = useState([]);
    const [investments, setInvestments] = useState([]);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPricing, setShowPricing] = useState(false);

    const [aiChat, setAiChat] = useState([{ role: "ai", text: `Halo ${userName.split(" ")[0]}! 👋 Gue Karaya AI. Mau analisis keuangan atau tanya apa?` }]);
    const [aiInput, setAiInput] = useState("");
    const [aiTyping, setAiTyping] = useState(false);

    // ── FETCH DATA ──────────────────────────────────────────
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        const [accs, txs, gls, dbs, sub, cats, recs, invs] = await Promise.all([
            supabase.from("accounts").select("*").order("created_at"),
            supabase.from("transactions").select("*").order("date", { ascending: false }),
            supabase.from("goals").select("*").order("created_at"),
            supabase.from("debts").select("*").order("created_at"),
            supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("categories").select("*").order("created_at"),
            supabase.from("recurring_transactions").select("*").order("next_date"),
            supabase.from("investments").select("*").order("created_at"),
        ]);

        // Buat trial subscription jika belum ada
        if (!sub.data) {
            const expires = new Date();
            expires.setDate(expires.getDate() + 14);
            const { data: newSub } = await supabase.from("subscriptions").insert({
                user_id: user.id,
                plan: "trial",
                started_at: new Date().toISOString(),
                expires_at: expires.toISOString(),
            }).select().single();
            setSubscription(newSub);
        } else {
            setSubscription(sub.data);
        }

        const accounts = accs.data || [];
        const recurrings = recs.data || [];

        // ── AUTO-EXECUTE transaksi berulang yang jatuh tempo ──
        const todayStr = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" local timezone
        const due = recurrings.filter(r => r.active && r.next_date <= todayStr);

        if (due.length > 0) {
            const calcNextDate = (freq, from) => {
                const d = new Date(from);
                if (freq === "daily")   d.setDate(d.getDate() + 1);
                if (freq === "weekly")  d.setDate(d.getDate() + 7);
                if (freq === "monthly") d.setMonth(d.getMonth() + 1);
                if (freq === "yearly")  d.setFullYear(d.getFullYear() + 1);
                return d.toISOString().slice(0, 10);
            };

            // Idempotency check: cek transaksi [Auto] yang sudah diinsert hari ini
            const { data: existingAuto } = await supabase
                .from("transactions")
                .select("note, date")
                .eq("user_id", user.id)
                .like("note", "[Auto]%")
                .gte("date", todayStr);
            const alreadyInserted = new Set(
                (existingAuto || []).map(t => `${t.note}|${t.date}`)
            );
            const dueToInsert = due.filter(
                r => !alreadyInserted.has(`[Auto] ${r.name}|${r.next_date}`)
            );

            // Insert hanya yang belum ada
            const newTxs = dueToInsert.map(r => ({
                user_id: user.id,
                type: "expense",
                amount: r.amount,
                category: r.category || "Lainnya",
                note: `[Auto] ${r.name}`,
                date: new Date(r.next_date).toISOString().slice(0, 10),
                account_name: r.account_name,
                icon: r.icon || "🔄",
            }));
            if (dueToInsert.length > 0) {
                await supabase.from("transactions").insert(newTxs).select();
            }

            // Update saldo tiap akun, next_date, dan sisa hutang (jika linked)
            // Hanya untuk yang baru diinsert (dueToInsert), bukan semua due
            const debtsList = dbs.data || [];
            const updatedDebts = [...debtsList];
            for (const r of dueToInsert) {
                const acc = accounts.find(a => a.name === r.account_name);
                if (acc) {
                    await supabase.from("accounts").update({ balance: Math.max(0, acc.balance - r.amount) }).eq("id", acc.id);
                    acc.balance = Math.max(0, acc.balance - r.amount);
                }
                // Kurangi sisa hutang jika linked
                if (r.debt_id) {
                    const debtIdx = updatedDebts.findIndex(d => d.id === r.debt_id);
                    if (debtIdx !== -1) {
                        const newRemaining = Math.max(0, updatedDebts[debtIdx].remaining - r.amount);
                        await supabase.from("debts").update({ remaining: newRemaining }).eq("id", r.debt_id);
                        updatedDebts[debtIdx] = { ...updatedDebts[debtIdx], remaining: newRemaining };
                    }
                }
                const newNext = calcNextDate(r.frequency, r.next_date);
                await supabase.from("recurring_transactions").update({ next_date: newNext }).eq("id", r.id);
                r.next_date = newNext;
            }
            if (updatedDebts !== debtsList) setDebts(updatedDebts);

            // Fetch ulang data terbaru setelah auto-execute
            const [freshAccs, freshTxs] = await Promise.all([
                supabase.from("accounts").select("*").order("created_at"),
                supabase.from("transactions").select("*").order("date", { ascending: false }),
            ]);
            if (freshAccs.data) setAccounts(freshAccs.data);
            if (freshTxs.data) setTransactions(freshTxs.data);
            setRecurrings([...recurrings]);
            if (dueToInsert.length > 0) {
                showToast(`🔄 ${dueToInsert.length} transaksi berulang dijalankan otomatis!`);
            }
        } else {
            if (accs.data) setAccounts(accs.data);
            if (txs.data) setTransactions(txs.data);
        }

        if (gls.data) setGoals(gls.data);
        if (dbs.data) setDebts(dbs.data);
        if (cats.data) setCustomCategories(cats.data);
        if (recs.data) setRecurrings(recs.data);
        if (invs.data) setInvestments(invs.data);
        setLoading(false);
    };

    // ── CATEGORY CRUD ────────────────────────────────────────
    const addCategory = async (form) => {
        const { data, error } = await supabase.from("categories").insert({
            user_id: user.id,
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

    // ── INVESTMENTS CRUD ─────────────────────────────────────
    const addInvestment = async (payload) => {
        const { data, error } = await supabase.from("investments").insert({ user_id: user.id, ...payload }).select().single();
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

    // ── GOALS CRUD ───────────────────────────────────────────
    const addGoal = async (payload) => {
        const { data, error } = await supabase.from("goals").insert({ user_id: user.id, ...payload }).select().single();
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

    // ── DEBTS CRUD ───────────────────────────────────────────
    const addDebt = async (payload) => {
        const { data, error } = await supabase.from("debts").insert({ user_id: user.id, ...payload }).select().single();
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

    // ── RECURRING TRANSACTIONS ───────────────────────────────
    const addRecurring = async (form) => {
        const { data, error } = await supabase.from("recurring_transactions").insert({
            user_id: user.id, ...form,
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

    // ── COMPUTED VALUES ──────────────────────────────────────
    const totalBalance = accounts.reduce((a, b) => a + b.balance, 0);
    const totalIncome = transactions.filter(t => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    const netBalance = totalIncome - totalExpense;
    const savingRate = totalIncome > 0 ? Math.round((1 - totalExpense / totalIncome) * 100) : 0;
    const expenseRate = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

    const catTotals = {};
    transactions.filter(t => t.type === "expense").forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    // ── ADD TRANSACTION ──────────────────────────────────────
    const addTx = async () => {
        if (!txForm.amount) return;
        const newTx = {
            user_id: user.id,
            type: txForm.type,
            amount: parseInt(txForm.amount),
            category: txForm.category,
            note: txForm.note || txForm.category,
            date: new Date().toISOString().slice(0, 10),
            account_name: txForm.account || (accounts[0]?.name ?? ""),
            icon: categoryIcons[txForm.category] || "📦",
        };
        const { data, error } = await supabase.from("transactions").insert(newTx).select().single();
        if (error) { showToast("Gagal menyimpan transaksi", "info"); return; }

        // Update saldo akun
        const acc = accounts.find(a => a.name === newTx.account_name);
        if (acc) {
            const newBalance = newTx.type === "income"
                ? acc.balance + newTx.amount
                : acc.balance - newTx.amount;
            const { data: updatedAcc } = await supabase.from("accounts")
                .update({ balance: newBalance }).eq("id", acc.id).select().single();
            if (updatedAcc) setAccounts(p => p.map(a => a.id === acc.id ? updatedAcc : a));
        }

        setTransactions(p => [data, ...p]);
        setTxForm({ type: "expense", amount: "", category: "Makanan", note: "", account: accounts[0]?.name ?? "", toAccount: "" });
        setShowAddTx(false);
        showToast("Transaksi berhasil ditambahkan!");
    };

    // ── TRANSFER DANA ────────────────────────────────────────
    const addTransfer = async () => {
        const amount = parseInt(txForm.amount);
        const fromAcc = accounts.find(a => a.name === txForm.account);
        const toAcc = accounts.find(a => a.name === txForm.toAccount);
        if (!amount || !fromAcc || !toAcc || fromAcc.id === toAcc.id) return;

        const date = new Date().toISOString().slice(0, 10);
        const note = txForm.note || `Transfer ${fromAcc.name} → ${toAcc.name}`;

        // Insert 1 transaksi transfer (dari akun asal saja)
        const { data: txData, error: txError } = await supabase.from("transactions").insert([
            { user_id: user.id, type: "transfer", amount, category: "Transfer", note, date, account_name: fromAcc.name, icon: "🔄" },
        ]).select();
        if (txError) { showToast("Gagal menyimpan transfer", "error"); return; }

        // Update saldo kedua akun
        const [resFrom, resTo] = await Promise.all([
            supabase.from("accounts").update({ balance: fromAcc.balance - amount }).eq("id", fromAcc.id).select().single(),
            supabase.from("accounts").update({ balance: toAcc.balance + amount   }).eq("id", toAcc.id  ).select().single(),
        ]);
        if (resFrom.error || resTo.error) { showToast("Transfer dicatat tapi saldo gagal diupdate", "error"); return; }

        // Update state lokal
        setTransactions(p => [...(txData || []).reverse(), ...p]);
        setAccounts(p => p.map(a => {
            if (a.id === fromAcc.id) return resFrom.data;
            if (a.id === toAcc.id)   return resTo.data;
            return a;
        }));
        setTxForm({ type: "expense", amount: "", category: "Makanan", note: "", account: accounts[0]?.name ?? "", toAccount: "" });
        setShowAddTx(false);
        showToast(`✅ Transfer Rp ${amount.toLocaleString("id-ID")} dari ${fromAcc.name} ke ${toAcc.name} berhasil!`);
    };

    // ── ADD ACCOUNT ──────────────────────────────────────────
    const addAccount = async () => {
        if (!accForm.name || !accForm.balance) return;
        const icons = { bank: "🏦", ewallet: "📱", cash: "💵", crypto: "₿", investasi: "📈" };
        const colors = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
        const newAcc = {
            user_id: user.id,
            name: accForm.name,
            type: accForm.type,
            balance: parseInt(accForm.balance),
            icon: icons[accForm.type] || "💰",
            color: colors[accounts.length % colors.length],
        };
        const { data, error } = await supabase.from("accounts").insert(newAcc).select().single();
        if (error) { showToast("Gagal menyimpan akun", "info"); return; }
        setAccounts(p => [...p, data]);
        setAccForm({ name: "", type: "bank", balance: "" });
        setShowAddAccount(false);
        showToast("Akun berhasil ditambahkan!");
    };

    // ── AI HANDLER ───────────────────────────────────────────
    const handleAi = () => {
        if (!aiInput.trim()) return;
        setAiChat(p => [...p, { role: "user", text: aiInput.trim() }]);
        setAiInput("");
        setAiTyping(true);
        setTimeout(() => {
            const responses = [
                `Pengeluaran terbesar bulan ini: Kos/Sewa (Rp ${(catTotals["Kos/Sewa"] || 0).toLocaleString()}) dan Makanan (Rp ${(catTotals["Makanan"] || 0).toLocaleString()}). Saving rate ${savingRate}% — ${savingRate > 20 ? "bagus!" : "coba naikin ke 20%."}`,
                `Berdasarkan pattern, bisa hemat ~Rp 200rb/bulan dari Makanan dengan meal prep.`,
                `Total hutang Rp ${debts.reduce((a, d) => a + d.remaining, 0).toLocaleString()}. Prioritaskan yang bunga tertinggi dulu.`,
                `Kalau konsisten nabung Rp ${Math.round(netBalance * 0.2).toLocaleString()}/bulan, emergency fund bisa tercapai lebih cepat.`,
            ];
            setAiChat(p => [...p, { role: "ai", text: responses[Math.floor(Math.random() * responses.length)] }]);
            setAiTyping(false);
        }, 1500);
    };

    const activeLabel = t(NAV_LABELS[activeMenu] || "nav.dashboard");
    const sharedProps = { totalBalance, totalIncome, totalExpense, netBalance, savingRate, expenseRate, sortedCats, catTotals };

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, border: "3px solid rgba(99,102,241,.3)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
                    <div style={{ color: "#64748b", fontSize: 13 }}>{t("common.loading")}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#06060e", color: "#e2e8f0", fontFamily: "'Inter',-apple-system,sans-serif" }}>
            <AddTransactionModal open={showAddTx} onClose={() => setShowAddTx(false)} txForm={txForm} setTxForm={setTxForm} onSubmit={addTx} onTransfer={addTransfer} accounts={accounts} customCategories={customCategories} />
            <AddAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)} accForm={accForm} setAccForm={setAccForm} onSubmit={addAccount} />
            <PricingModal open={showPricing} onClose={() => setShowPricing(false)} currentPlan={subscription?.plan} />

            <Sidebar open={sidebarOpen} activeMenu={activeMenu} setActiveMenu={setActiveMenu} user={{ name: userName, plan: subscription?.plan, expiresAt: subscription?.expires_at }} />

            <main style={{ flex: 1, marginLeft: sidebarOpen ? 260 : 0, transition: "margin-left .3s", minHeight: "100vh" }}>
                <header style={{ position: "sticky", top: 0, zIndex: 40, padding: "14px 28px", background: "rgba(6,6,14,.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button onClick={() => setSidebarOpen(p => !p)} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#94a3b8", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>{sidebarOpen ? "☰" : "→"}</button>
                        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{activeLabel}</h1>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => setShowAddTx(true)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ {t("nav.transaction")}</button>
                        <button onClick={onLogout} style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.15)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.logout")}</button>
                    </div>
                </header>

                <div style={{ padding: 28 }}>
                    {/* Banner subscription dinamis */}
                    {(() => {
                        const plan = subscription?.plan;
                        const expires = subscription?.expires_at ? new Date(subscription.expires_at) : null;
                        const daysLeft = expires ? Math.max(0, Math.ceil((expires - new Date()) / 86400000)) : 0;
                        const isExpired = expires ? new Date() > expires : false;
                        const isUrgent = !isExpired && daysLeft <= 3;

                        if (!plan || plan === "trial") return (
                            <div style={{
                                position: "relative", overflow: "hidden",
                                background: isExpired
                                    ? "linear-gradient(135deg,rgba(239,68,68,.18),rgba(239,68,68,.08))"
                                    : isUrgent
                                        ? "linear-gradient(135deg,rgba(245,158,11,.18),rgba(239,68,68,.12))"
                                        : "linear-gradient(135deg,rgba(99,102,241,.18),rgba(139,92,246,.12))",
                                border: `1.5px solid ${isExpired ? "rgba(239,68,68,.5)" : isUrgent ? "rgba(245,158,11,.5)" : "rgba(99,102,241,.45)"}`,
                                borderRadius: 16,
                                padding: "18px 24px",
                                marginBottom: 24,
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                                boxShadow: isExpired
                                    ? "0 0 24px rgba(239,68,68,.15), inset 0 1px 0 rgba(255,255,255,.05)"
                                    : isUrgent
                                        ? "0 0 24px rgba(245,158,11,.15), inset 0 1px 0 rgba(255,255,255,.05)"
                                        : "0 0 32px rgba(99,102,241,.2), inset 0 1px 0 rgba(255,255,255,.05)",
                            }}>
                                {/* Shimmer effect */}
                                <div style={{
                                    position: "absolute", top: 0, left: "-100%", width: "60%", height: "100%",
                                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                                    animation: "shimmer 3s infinite",
                                    pointerEvents: "none",
                                }} />
                                {/* Glow orb */}
                                <div style={{
                                    position: "absolute", right: -40, top: -40,
                                    width: 160, height: 160, borderRadius: "50%",
                                    background: isExpired ? "rgba(239,68,68,.08)" : isUrgent ? "rgba(245,158,11,.08)" : "rgba(99,102,241,.1)",
                                    filter: "blur(30px)",
                                    pointerEvents: "none",
                                }} />

                                <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                                    {/* Icon badge */}
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                        background: isExpired ? "rgba(239,68,68,.15)" : isUrgent ? "rgba(245,158,11,.15)" : "rgba(99,102,241,.15)",
                                        border: `1px solid ${isExpired ? "rgba(239,68,68,.3)" : isUrgent ? "rgba(245,158,11,.3)" : "rgba(99,102,241,.3)"}`,
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                                    }}>
                                        {isExpired ? "🔒" : isUrgent ? "⚠️" : "💎"}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: isExpired ? "#f87171" : isUrgent ? "#fbbf24" : "#c4b5fd", marginBottom: 3 }}>
                                            {isExpired ? "Free Trial kamu sudah berakhir!" : isUrgent ? `⚡ Sisa ${daysLeft} hari — Trial hampir habis!` : "✨ Kamu sedang menggunakan Free Trial 14 Hari"}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                            {isExpired
                                                ? "Upgrade sekarang untuk tetap bisa akses semua fitur."
                                                : isUrgent
                                                    ? "Jangan sampai akses kamu terhenti. Upgrade sekarang!"
                                                    : `Trial berakhir dalam ${daysLeft} hari · Upgrade untuk fitur lengkap tanpa batas`}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", flexShrink: 0 }}>
                                    {/* Progress bar hari tersisa */}
                                    {!isExpired && (
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{daysLeft}/14 hari</div>
                                            <div style={{ width: 80, height: 4, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
                                                <div style={{
                                                    height: "100%", borderRadius: 4,
                                                    width: `${(daysLeft / 14) * 100}%`,
                                                    background: isUrgent ? "linear-gradient(90deg,#ef4444,#f59e0b)" : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                                                    transition: "width .3s",
                                                }} />
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowPricing(true)}
                                        style={{
                                            padding: "10px 22px", borderRadius: 10, border: "none",
                                            background: isExpired || isUrgent
                                                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                                                : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                                            color: "#fff", fontSize: 13, fontWeight: 700,
                                            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                            boxShadow: isExpired || isUrgent ? "0 4px 16px rgba(239,68,68,.4)" : "0 4px 16px rgba(99,102,241,.4)",
                                            animation: isExpired || isUrgent ? "pulse-btn 2s infinite" : "none",
                                        }}
                                    >
                                        {isExpired ? "🔓 Upgrade Sekarang" : "🚀 Lihat Paket"}
                                    </button>
                                </div>
                            </div>
                        );
                        if (plan === "starter") return (
                            <div style={{
                                position: "relative", overflow: "hidden",
                                background: "linear-gradient(135deg,rgba(16,185,129,.12),rgba(5,150,105,.06))",
                                border: "1.5px solid rgba(16,185,129,.3)", borderRadius: 16,
                                padding: "16px 24px", marginBottom: 24,
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                                boxShadow: "0 0 24px rgba(16,185,129,.1), inset 0 1px 0 rgba(255,255,255,.04)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚀</div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#6ee7b7" }}>Paket Starter Aktif</div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Berakhir {expires?.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · {daysLeft} hari lagi</div>
                                    </div>
                                </div>
                                <button onClick={() => setShowPricing(true)} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid rgba(16,185,129,.4)", background: "rgba(16,185,129,.1)", color: "#6ee7b7", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Perpanjang</button>
                            </div>
                        );
                        if (plan === "pro") return (
                            <div style={{
                                position: "relative", overflow: "hidden",
                                background: "linear-gradient(135deg,rgba(245,158,11,.12),rgba(217,119,6,.06))",
                                border: "1.5px solid rgba(245,158,11,.3)", borderRadius: 16,
                                padding: "16px 24px", marginBottom: 24,
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                                boxShadow: "0 0 24px rgba(245,158,11,.1), inset 0 1px 0 rgba(255,255,255,.04)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⭐</div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fcd34d" }}>Paket Pro Aktif</div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Berakhir {expires?.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · {daysLeft} hari lagi</div>
                                    </div>
                                </div>
                                <button onClick={() => setShowPricing(true)} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid rgba(245,158,11,.4)", background: "rgba(245,158,11,.1)", color: "#fcd34d", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Perpanjang</button>
                            </div>
                        );
                        return null;
                    })()}

                    {activeMenu === "dasbor" && <DasborView accounts={accounts} transactions={transactions} goals={goals} setActiveMenu={setActiveMenu} setShowAddAccount={setShowAddAccount} setShowAddTx={setShowAddTx} customCategories={customCategories} {...sharedProps} />}
                    {activeMenu === "transaksi" && <TransaksiView transactions={transactions} />}
                    {activeMenu === "akun" && <AkunView accounts={accounts} transactions={transactions} setShowAddAccount={setShowAddAccount} />}
                    {activeMenu === "kategori" && <KategoriView catTotals={catTotals} customCategories={customCategories} onAddCategory={addCategory} onEditCategory={editCategory} onDeleteCategory={deleteCategory} />}
                    {activeMenu === "berulang" && <BerulangView recurrings={recurrings} accounts={accounts} debts={debts} onAdd={addRecurring} onEdit={editRecurring} onDelete={deleteRecurring} />}
                    {activeMenu === "goals" && <GoalsView goals={goals} onAdd={addGoal} onEdit={editGoal} onDelete={deleteGoal} />}
                    {activeMenu === "hutang" && <HutangView debts={debts} onAdd={addDebt} onEdit={editDebt} onDelete={deleteDebt} />}
                    {activeMenu === "investasi" && <InvestasiView investments={investments} onAdd={addInvestment} onEdit={editInvestment} onDelete={deleteInvestment} />}
                    {activeMenu === "laporan" && <LaporanView transactions={transactions} />}
                    {activeMenu === "ai" && <AiView aiChat={aiChat} aiTyping={aiTyping} aiInput={aiInput} setAiInput={setAiInput} handleAi={handleAi} />}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
