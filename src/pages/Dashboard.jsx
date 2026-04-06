import { useState, useEffect } from "react";
import { fetchGoldPrices } from "../services/goldPrice";
import { sendAiMessage, buildSystemPrompt } from "../services/aiService";
import { APP_AI_NAME } from "../config/app";
import Sidebar from "../components/dashboard/Sidebar";
import { useLanguage } from "../i18n/LanguageContext";
import { useIsMobile } from "../hooks/useIsMobile";
import AddTransactionModal from "../components/dashboard/AddTransactionModal";
import AddAccountModal from "../components/dashboard/AddAccountModal";
import DasborView from "../components/dashboard/views/DasborView";
import TransaksiView from "../components/dashboard/views/TransaksiView";
import AkunView from "../components/dashboard/views/AkunView";
import KategoriView from "../components/dashboard/views/KategoriView";
import BerulangView from "../components/dashboard/views/BerulangView";
import GoalsView from "../components/dashboard/views/GoalsView";
import HutangView from "../components/dashboard/views/HutangView";
import PiutangView from "../components/dashboard/views/PiutangView";
import InvestasiView from "../components/dashboard/views/InvestasiView";
import LaporanView from "../components/dashboard/views/LaporanView";
import AiView from "../components/dashboard/views/AiView";
import AnggaranView from "../components/dashboard/views/AnggaranView";
import SplitBillView from "../components/dashboard/views/SplitBillView";
import PrediksiView from "../components/dashboard/views/PrediksiView";
import PricingModal from "../components/dashboard/PricingModal";
import { categoryIcons } from "../constants/categories";
import { supabase } from "../lib/supabase";

const NAV_LABELS = {
    dasbor: "nav.dashboard", transaksi: "nav.transaction", akun: "nav.accounts",
    kategori: "nav.categories", berulang: "nav.recurring", goals: "nav.goals",
    hutang: "nav.debts", investasi: "nav.investments", anggaran: "nav.budgets",
    laporan: "nav.reports", ai: "nav.ai",
    splitbill: "nav.splitbill", prediksi: "nav.prediksi",
};

const Dashboard = ({ session, onLogout, showToast }) => {
    const { t, lang } = useLanguage();
    const isMobile = useIsMobile();
    const user = session.user;
    const [userName, setUserName] = useState(user.user_metadata?.full_name || user.email.split("@")[0]);

    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
    const [activeMenu, setActiveMenu] = useState("dasbor");
    const [showAddTx, setShowAddTx] = useState(false);
    const [showEditTx, setShowEditTx] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [isSavingTx, setIsSavingTx] = useState(false);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [txForm, setTxForm] = useState({ type: "expense", amount: "", category: "Makanan", note: "", account: "", toAccount: "", date: new Date().toISOString().slice(0, 10) });
    const [accForm, setAccForm] = useState({ name: "", type: "bank", balance: "" });

    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [goals, setGoals] = useState([]);
    const [debts, setDebts] = useState([]);
    const [piutang, setPiutang] = useState([]);
    const [recurrings, setRecurrings] = useState([]);
    const [customCategories, setCustomCategories] = useState([]);
    const [investments, setInvestments] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [splitBills, setSplitBills] = useState([]);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPricing, setShowPricing] = useState(false);

    const makeGreeting = () => {
        const name = userName.split(" ")[0];
        const raw  = t("ai.greeting");
        // Jika key belum ada di translations, fallback ke Indonesian
        const tmpl = raw === "ai.greeting"
            ? `Halo ${name}! 👋 Gue ${APP_AI_NAME}. Mau analisis keuangan atau tanya apa?`
            : raw.replace("{name}", name).replace("{ai}", APP_AI_NAME);
        return [{ role: "ai", text: tmpl }];
    };
    const [aiChat, setAiChat] = useState(makeGreeting);
    const [aiInput, setAiInput] = useState("");
    const [aiTyping, setAiTyping] = useState(false);

    // Update greeting saat bahasa berubah (hanya jika chat masih di pesan pertama)
    useEffect(() => {
        setAiChat(prev => {
            if (prev.length === 1) return makeGreeting();
            // Sudah ada percakapan — hanya update pesan pertama (greeting)
            return [makeGreeting()[0], ...prev.slice(1)];
        });
    }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── USER SETTINGS (synced to DB) ────────────────────────
    const [userSettings,   setUserSettings]   = useState(null);
    const [goldPrices,     setGoldPrices]     = useState(null);
    const [refreshingGold, setRefreshingGold] = useState(false);
    const [aiConfig,       setAiConfig]       = useState(() => {
        // Load dari localStorage sebagai cache awal (supaya tidak hilang saat refresh sebelum DB load)
        try { const c = localStorage.getItem("karaya_ai_config"); return c ? JSON.parse(c) : null; } catch { return null; }
    });
    const [aiSettingsTrigger, setAiSettingsTrigger] = useState(0); // bumped to open Sidebar AI panel

    useEffect(() => {
        fetchSettings();
        loadGoldPrices();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadGoldPrices = async () => {
        try {
            const data = await fetchGoldPrices("antam");
            setGoldPrices(data);
        } catch (err) {
            console.warn("Gagal load harga emas:", err.message);
        }
    };

    const refreshGoldPrices = async () => {
        if (refreshingGold) return;
        setRefreshingGold(true);
        try {
            const data = await fetchGoldPrices("antam");
            setGoldPrices(data);
            showToast("✅ Harga emas berhasil diperbarui");
        } catch {
            showToast("Gagal memperbarui harga emas", "error");
        }
        setRefreshingGold(false);
    };

    const fetchSettings = async () => {
        const { data } = await supabase
            .from("user_settings")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();
        if (data) {
            setUserSettings(data);
            // sync ke localStorage sebagai cache cepat
            if (data.avatar_color) localStorage.setItem("karaya_avatar_color", data.avatar_color);
            if (data.hidden_menus) localStorage.setItem("karaya_hidden_menus", JSON.stringify(data.hidden_menus));
            if (data.app_name)    localStorage.setItem("karaya_app_name",    data.app_name);
            if (data.app_tagline) localStorage.setItem("karaya_app_tagline", data.app_tagline);
            if (data.ai_config?.apiKey) {
                setAiConfig(data.ai_config);
                localStorage.setItem("karaya_ai_config", JSON.stringify(data.ai_config));
            }
        }
    };

    const saveSettings = async (patch) => {
        // optimistic update state
        setUserSettings(prev => ({ ...(prev || {}), ...patch }));
        // sync localStorage cache
        Object.entries(patch).forEach(([k, v]) => {
            const key = { avatar_color: "karaya_avatar_color", hidden_menus: "karaya_hidden_menus", app_name: "karaya_app_name", app_tagline: "karaya_app_tagline" }[k];
            if (key) localStorage.setItem(key, typeof v === "object" ? JSON.stringify(v) : v);
        });
        // upsert ke database
        await supabase.from("user_settings").upsert({
            user_id: user.id,
            ...(patch),
            updated_at: new Date().toISOString(),
        });
    };

    // ── PROFILE HANDLERS ────────────────────────────────────
    const updateName = async (newName) => {
        const { error } = await supabase.auth.updateUser({ data: { full_name: newName } });
        if (!error) { setUserName(newName); showToast("✅ Nama berhasil diperbarui"); }
        else showToast("Gagal memperbarui nama", "error");
    };

    const updatePassword = async (newPass) => {
        const { error } = await supabase.auth.updateUser({ password: newPass });
        if (!error) showToast("✅ Password berhasil diperbarui");
        else showToast(error.message || "Gagal memperbarui password", "error");
    };

    const exportCSV = () => {
        const headers = ["Tanggal","Tipe","Kategori","Jumlah","Akun","Catatan"];
        const rows = transactions.map(tx => [
            tx.date, tx.type, tx.category, tx.amount,
            tx.account_name || "", (tx.note || "").replace(/"/g, '""'),
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = `karaya-export-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ ${transactions.length} transaksi berhasil diekspor`);
    };

    const deleteAccount = async () => {
        showToast("Menghapus akun...", "info");
        // Hapus semua data user dari tabel-tabel
        await Promise.allSettled([
            supabase.from("transactions").delete().eq("user_id", user.id),
            supabase.from("accounts").delete().eq("user_id", user.id),
            supabase.from("goals").delete().eq("user_id", user.id),
            supabase.from("debts").delete().eq("user_id", user.id),
            supabase.from("budgets").delete().eq("user_id", user.id),
            supabase.from("investments").delete().eq("user_id", user.id),
            supabase.from("categories").delete().eq("user_id", user.id),
            supabase.from("recurring_transactions").delete().eq("user_id", user.id),
            supabase.from("subscriptions").delete().eq("user_id", user.id),
        ]);
        await supabase.auth.signOut();
        onLogout();
    };

    // ── FETCH DATA ──────────────────────────────────────────
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
        const [accs, txs, gls, dbs, sub, cats, recs, invs, buds, splits, piu] = await Promise.all([
            supabase.from("accounts").select("*").order("created_at"),
            supabase.from("transactions").select("*").order("date", { ascending: false }),
            supabase.from("goals").select("*").order("created_at"),
            supabase.from("debts").select("*").order("created_at"),
            supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("categories").select("*").order("created_at"),
            supabase.from("recurring_transactions").select("*").order("next_date"),
            supabase.from("investments").select("*").order("created_at"),
            supabase.from("budgets").select("*").order("created_at"),
            supabase.from("split_bills").select("*, split_bill_members(*)").order("created_at", { ascending: false }),
            supabase.from("piutang").select("*").order("created_at"),
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
        if (buds.data) setBudgets(buds.data);
        if (splits.data) setSplitBills(splits.data);
        if (piu.data) setPiutang(piu.data);
        setLoading(false);
        } catch (err) {
            console.error("fetchAll error:", err);
            showToast("Gagal memuat data. Coba refresh halaman.", "error");
            setLoading(false);
        }
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

    // ── BUDGETS CRUD ─────────────────────────────────────────
    const addBudget = async (payload) => {
        const { data, error } = await supabase.from("budgets").insert({ user_id: user.id, ...payload }).select().single();
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
            user_id: user.id,
            category: b.category,
            amount: b.amount,
            month: targetMonth,
        }));
        const { data, error } = await supabase.from("budgets").insert(inserts).select();
        if (error) { showToast("Gagal menyalin anggaran", "error"); return; }
        setBudgets(p => [...p, ...(data || [])]);
        showToast(`✅ ${inserts.length} anggaran disalin ke bulan ini!`);
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

    // Topup goal — opsional catat sebagai transaksi + kurangi saldo akun
    const topupGoal = async (goalId, goal, amount, accountName) => {
        // 1. Update goal current
        const newCurrent = goal.current + amount;
        const { data: updGoal, error: gErr } = await supabase
            .from("goals").update({ current: newCurrent }).eq("id", goalId).select().single();
        if (gErr) { showToast("Gagal memperbarui target", "error"); return; }
        setGoals(p => p.map(g => g.id === goalId ? updGoal : g));

        // 2. Jika pilih akun → catat transaksi expense + kurangi saldo
        if (accountName) {
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
            const tx = {
                user_id: user.id, type: "expense", amount,
                category: "Tabungan & Goal",
                note: `Tabungan: ${goal.name}`,
                date: dateStr,
                account_name: accountName,
                icon: "🎯",
            };
            const { data: newTx } = await supabase.from("transactions").insert(tx).select().single();
            if (newTx) setTransactions(p => [newTx, ...p]);

            // Kurangi saldo akun
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

    // ── PAY DEBT ─────────────────────────────────────────────
    const payDebt = async (debt, amount, accountName) => {
        const today = new Date().toISOString().slice(0, 10);
        // 1. Catat transaksi expense
        const tx = {
            user_id: user.id, type: "expense", amount,
            category: "Hutang & Cicilan",
            note: `Cicilan ${debt.name}`,
            date: today,
            account_name: accountName,
            icon: "📋",
        };
        const { data: newTx } = await supabase.from("transactions").insert(tx).select().single();
        if (newTx) setTransactions(p => [newTx, ...p]);

        // 2. Kurangi saldo akun
        const acc = accounts.find(a => a.name === accountName);
        if (acc) {
            const newBal = Math.max(0, acc.balance - amount);
            const { data: updAcc } = await supabase.from("accounts").update({ balance: newBal }).eq("id", acc.id).select().single();
            if (updAcc) setAccounts(p => p.map(a => a.id === acc.id ? updAcc : a));
        }

        // 3. Kurangi sisa hutang
        const newRemaining = Math.max(0, debt.remaining - amount);
        const { data: updDebt } = await supabase.from("debts").update({ remaining: newRemaining }).eq("id", debt.id).select().single();
        if (updDebt) setDebts(p => p.map(d => d.id === debt.id ? updDebt : d));

        showToast(`✅ Cicilan ${debt.name} Rp ${amount.toLocaleString("id-ID")} berhasil dicatat!`);
    };

    // ── PIUTANG CRUD ─────────────────────────────────────────
    const addPiutang = async (payload) => {
        const { data, error } = await supabase.from("piutang").insert({ user_id: user.id, ...payload }).select().single();
        if (error) { showToast("Gagal menyimpan piutang", "error"); return; }
        setPiutang(p => [...p, data]);

        // Potong saldo akun sumber
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

    // ── TERIMA KEMBALI PIUTANG ───────────────────────────────
    const terimaPiutang = async (item, amount, accountName) => {
        // 1. Tambah saldo akun (uang kembali) — tidak dicatat sebagai income
        //    agar tidak mendistorsi laporan pemasukan bulanan
        const acc = accounts.find(a => a.name === accountName);
        if (acc) {
            const newBal = acc.balance + amount;
            const { data: updAcc } = await supabase.from("accounts").update({ balance: newBal }).eq("id", acc.id).select().single();
            if (updAcc) setAccounts(p => p.map(a => a.id === acc.id ? updAcc : a));
        }

        // 2. Kurangi sisa piutang
        const newRemaining = Math.max(0, item.remaining - amount);
        const { data: updPiu } = await supabase.from("piutang").update({ remaining: newRemaining }).eq("id", item.id).select().single();
        if (updPiu) setPiutang(p => p.map(d => d.id === item.id ? updPiu : d));

        showToast(`✅ Terima Rp ${amount.toLocaleString("id-ID")} dari ${item.borrower_name} berhasil dicatat!`);
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

    // ── SPLIT BILL CRUD ──────────────────────────────────────
    const addSplitBill = async (payload) => {
        const { members, ...billData } = payload;
        const { data: bill, error } = await supabase
            .from("split_bills")
            .insert({ user_id: user.id, title: billData.title, total_amount: billData.total_amount, date: billData.date, note: billData.note || "" })
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
        if (!txForm.amount || isSavingTx) return;
        setIsSavingTx(true);
        const newTx = {
            user_id: user.id,
            type: txForm.type,
            amount: parseInt(txForm.amount),
            category: txForm.category,
            note: txForm.note || txForm.category,
            date: txForm.date || new Date().toISOString().slice(0, 10),
            account_name: txForm.account || (accounts[0]?.name ?? ""),
            icon: categoryIcons[txForm.category] || "📦",
        };
        const { data, error } = await supabase.from("transactions").insert(newTx).select().single();
        if (error) { showToast("Gagal menyimpan transaksi", "info"); setIsSavingTx(false); return; }

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
        setTxForm({ type: "expense", amount: "", category: "Makanan", note: "", account: accounts[0]?.name ?? "", toAccount: "", date: new Date().toISOString().slice(0, 10) });
        setIsSavingTx(false);
        setShowAddTx(false);
        showToast("Transaksi berhasil ditambahkan!");
    };

    // ── EDIT TRANSAKSI ───────────────────────────────────────
    const openEditTx = (tx) => {
        setEditingTx(tx);
        setTxForm({
            type:      tx.type,
            amount:    String(tx.amount),
            category:  tx.category,
            note:      tx.note,
            account:   tx.account_name,
            toAccount: "",
            date:      tx.date || new Date().toISOString().slice(0, 10),
        });
        setShowEditTx(true);
    };

    const editTx = async () => {
        if (!editingTx || isSavingTx) return;
        const newAmount = parseInt(txForm.amount);
        if (!newAmount && editingTx.type !== "transfer") return;

        setIsSavingTx(true);
        const oldAcc = accounts.find(a => a.name === editingTx.account_name);

        // Untuk transfer: hanya update note
        if (editingTx.type === "transfer") {
            const { data, error } = await supabase.from("transactions")
                .update({ note: txForm.note })
                .eq("id", editingTx.id).select().single();
            setIsSavingTx(false);
            if (error) { showToast("Gagal mengubah transaksi", "error"); return; }
            setTransactions(p => p.map(t => t.id === editingTx.id ? data : t));
            setShowEditTx(false); setEditingTx(null);
            showToast("Catatan transfer diperbarui ✅");
            return;
        }

        // Reverse saldo akun lama
        if (oldAcc) {
            const revertedBalance = editingTx.type === "income"
                ? oldAcc.balance - editingTx.amount
                : oldAcc.balance + editingTx.amount;
            await supabase.from("accounts").update({ balance: revertedBalance }).eq("id", oldAcc.id);
            setAccounts(p => p.map(a => a.id === oldAcc.id ? { ...a, balance: revertedBalance } : a));
        }

        // Apply saldo akun baru (mungkin akun berbeda)
        const targetAcc = accounts.find(a => a.name === txForm.account) || oldAcc;
        if (targetAcc) {
            const currentBalance = targetAcc.id === oldAcc?.id
                ? (txForm.type === "income" ? oldAcc.balance - editingTx.amount : oldAcc.balance + editingTx.amount)
                : targetAcc.balance;
            const newBalance = txForm.type === "income"
                ? currentBalance + newAmount
                : currentBalance - newAmount;
            const { data: updatedAcc } = await supabase.from("accounts")
                .update({ balance: newBalance }).eq("id", targetAcc.id).select().single();
            if (updatedAcc) setAccounts(p => p.map(a => a.id === targetAcc.id ? updatedAcc : a));
        }

        // Update transaksi di DB
        const updatedFields = {
            type:         txForm.type,
            amount:       newAmount,
            category:     txForm.category,
            note:         txForm.note || txForm.category,
            account_name: txForm.account || editingTx.account_name,
            icon:         categoryIcons[txForm.category] || editingTx.icon || "📦",
            date:         txForm.date || editingTx.date,
        };
        const { data, error } = await supabase.from("transactions")
            .update(updatedFields).eq("id", editingTx.id).select().single();
        setIsSavingTx(false);
        if (error) { showToast("Gagal mengubah transaksi", "error"); return; }

        setTransactions(p => p.map(t => t.id === editingTx.id ? data : t));
        setShowEditTx(false);
        setEditingTx(null);
        showToast("Transaksi berhasil diperbarui ✅");
    };

    // ── DELETE TRANSAKSI ─────────────────────────────────────
    const deleteTx = async (tx) => {
        // Reverse saldo akun
        const acc = accounts.find(a => a.name === tx.account_name);
        if (acc && tx.type !== "transfer") {
            const revertedBalance = tx.type === "income"
                ? acc.balance - tx.amount
                : acc.balance + tx.amount;
            await supabase.from("accounts").update({ balance: revertedBalance }).eq("id", acc.id);
            setAccounts(p => p.map(a => a.id === acc.id ? { ...a, balance: revertedBalance } : a));
        }
        // Delete dari DB
        const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
        if (error) { showToast("Gagal menghapus transaksi", "error"); return; }
        setTransactions(p => p.filter(t => t.id !== tx.id));
        showToast("Transaksi dihapus 🗑️", "info");
    };

    // ── TRANSFER DANA ────────────────────────────────────────
    const addTransfer = async () => {
        const amount = parseInt(txForm.amount);
        const fromAcc = accounts.find(a => a.name === txForm.account);
        const toAcc = accounts.find(a => a.name === txForm.toAccount);
        if (!amount || !fromAcc || !toAcc || fromAcc.id === toAcc.id || isSavingTx) return;

        setIsSavingTx(true);
        const date = new Date().toISOString().slice(0, 10);
        const note = txForm.note || `Transfer ${fromAcc.name} → ${toAcc.name}`;

        const { data: txData, error: txError } = await supabase.from("transactions").insert([
            { user_id: user.id, type: "transfer", amount, category: "Transfer", note, date, account_name: fromAcc.name, icon: "🔄" },
        ]).select();
        if (txError) { showToast("Gagal menyimpan transfer", "error"); setIsSavingTx(false); return; }

        const [resFrom, resTo] = await Promise.all([
            supabase.from("accounts").update({ balance: fromAcc.balance - amount }).eq("id", fromAcc.id).select().single(),
            supabase.from("accounts").update({ balance: toAcc.balance + amount   }).eq("id", toAcc.id  ).select().single(),
        ]);
        if (resFrom.error || resTo.error) { showToast("Transfer dicatat tapi saldo gagal diupdate", "error"); setIsSavingTx(false); return; }

        setTransactions(p => [...(txData || []).reverse(), ...p]);
        setAccounts(p => p.map(a => {
            if (a.id === fromAcc.id) return resFrom.data;
            if (a.id === toAcc.id)   return resTo.data;
            return a;
        }));
        setTxForm({ type: "expense", amount: "", category: "Makanan", note: "", account: accounts[0]?.name ?? "", toAccount: "", date: new Date().toISOString().slice(0, 10) });
        setIsSavingTx(false);
        setShowAddTx(false);
        showToast(`✅ Transfer Rp ${amount.toLocaleString("id-ID")} dari ${fromAcc.name} ke ${toAcc.name} berhasil!`);
    };

    // ── ADD ACCOUNT ──────────────────────────────────────────
    const addAccount = async () => {
        if (!accForm.name || !accForm.balance) return;
        const icons = { bank: "🏦", ewallet: "📱", cash: "💵", crypto: "₿", investasi: "📈", tabungan: "🪙" };
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

    // ── ADJUST BALANCE ───────────────────────────────────────
    const handleAdjustBalance = async (account, newBalance) => {
        const diff = newBalance - account.balance;
        if (diff === 0) return;
        // Update account balance
        const { data: updatedAcc, error: accErr } = await supabase
            .from("accounts").update({ balance: newBalance }).eq("id", account.id).select().single();
        if (accErr) { showToast("Gagal update saldo", "info"); return; }
        // Record adjustment transaction
        const adjTx = {
            user_id: user.id,
            account_id: account.id,
            account_name: account.name,
            type: diff > 0 ? "income" : "expense",
            amount: Math.abs(diff),
            category: "Koreksi Saldo",
            note: `Koreksi saldo ${account.name}`,
            icon: "⚖️",
            date: new Date().toISOString().slice(0, 10),
        };
        const { data: newTx } = await supabase.from("transactions").insert(adjTx).select().single();
        setAccounts(p => p.map(a => a.id === account.id ? updatedAcc : a));
        if (newTx) setTransactions(p => [newTx, ...p]);
        showToast(`Saldo ${account.name} diperbarui`);
    };

    // ── AI HANDLER ───────────────────────────────────────────
    const saveAiConfig = async (cfg) => {
        setAiConfig(cfg);
        setUserSettings(prev => ({ ...(prev || {}), ai_config: cfg }));
        // Simpan ke localStorage sebagai cache (bertahan saat refresh)
        if (cfg?.apiKey) {
            localStorage.setItem("karaya_ai_config", JSON.stringify(cfg));
        } else {
            localStorage.removeItem("karaya_ai_config");
        }
        // Simpan ke Supabase DB
        await supabase.from("user_settings").upsert({
            user_id: user.id,
            ai_config: cfg,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
    };

    const handleAi = async () => {
        if (!aiInput.trim() || aiTyping) return;
        if (!aiConfig?.apiKey) {
            setAiChat(p => [...p, { role: "error", text: "⚙️ API key belum diatur. Buka Settings → AI Coach untuk mengatur." }]);
            return;
        }
        const userMsg = aiInput.trim();
        const updatedChat = [...aiChat, { role: "user", text: userMsg }];
        setAiChat(updatedChat);
        setAiInput("");
        setAiTyping(true);
        try {
            const systemPrompt = buildSystemPrompt(userName.split(" ")[0]);
            const reply = await sendAiMessage({
                aiConfig,
                messages: updatedChat,
                systemPrompt,
                financialData: { accounts, transactions, goals, debts, investments, recurrings },
                userName: userName.split(" ")[0],
                onThinking: (msg) => setAiChat(p => {
                    const last = p[p.length - 1];
                    if (last?.role === "thinking") return [...p.slice(0, -1), { role: "thinking", text: msg }];
                    return [...p, { role: "thinking", text: msg }];
                }),
            });
            setAiChat(p => p.filter(m => m.role !== "thinking").concat({ role: "ai", text: reply }));
        } catch (err) {
            setAiChat(p => p.filter(m => m.role !== "thinking").concat({ role: "error", text: `❌ ${err.message}` }));
        } finally {
            setAiTyping(false);
        }
    };

    const activeLabel = t(NAV_LABELS[activeMenu] || "nav.dashboard");
    const sharedProps = { totalBalance, totalIncome, totalExpense, netBalance, savingRate, expenseRate, sortedCats, catTotals };

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, border: "3px solid rgba(96,252,198,.25)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
                    <div style={{ color: "var(--color-muted)", fontSize: 13 }}>{t("common.loading")}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-app)", color: "var(--color-text)", fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" }}>
            <AddTransactionModal open={showAddTx} onClose={() => setShowAddTx(false)} txForm={txForm} setTxForm={setTxForm} onSubmit={addTx} onTransfer={addTransfer} accounts={accounts} customCategories={customCategories} isSaving={isSavingTx} />
            <AddTransactionModal open={showEditTx} onClose={() => { setShowEditTx(false); setEditingTx(null); }} txForm={txForm} setTxForm={setTxForm} onSubmit={addTx} onTransfer={addTransfer} accounts={accounts} customCategories={customCategories} editMode={true} onUpdate={editTx} isSaving={isSavingTx} />
            <AddAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)} accForm={accForm} setAccForm={setAccForm} onSubmit={addAccount} />
            <PricingModal open={showPricing} onClose={() => setShowPricing(false)} currentPlan={subscription?.plan} />

            <Sidebar
                open={sidebarOpen}
                activeMenu={activeMenu}
                setActiveMenu={(m) => { setActiveMenu(m); if (isMobile) setSidebarOpen(false); }}
                user={{ name: userName, plan: subscription?.plan, expiresAt: subscription?.expires_at }}
                onAddTx={() => setShowAddTx(true)}
                onToggleSidebar={() => setSidebarOpen(p => !p)}
                onLogout={onLogout}
                onUpdateName={updateName}
                onUpdatePassword={updatePassword}
                onExportCSV={exportCSV}
                onDeleteAccount={deleteAccount}
                userSettings={userSettings}
                onSaveSettings={saveSettings}
                aiConfig={aiConfig}
                onSaveAiConfig={saveAiConfig}
                aiSettingsTrigger={aiSettingsTrigger}
            />

            {/* Mobile overlay backdrop */}
            {isMobile && sidebarOpen && (
                <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 49, backdropFilter: "blur(2px)" }} />
            )}

            <main style={{ flex: 1, marginLeft: isMobile ? 0 : (sidebarOpen ? 260 : 0), transition: "margin-left .3s", minHeight: "100vh", minWidth: 0 }}>
                <header style={{ position: "sticky", top: 0, zIndex: 40, padding: isMobile ? "12px 16px" : "14px 28px", background: "var(--bg-glass)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--color-border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => setSidebarOpen(p => !p)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>{sidebarOpen ? "☰" : "☰"}</button>
                        <h1 style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? 120 : "none" }}>{activeLabel}</h1>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
                        <button onClick={() => setShowAddTx(true)} style={{ padding: isMobile ? "8px 12px" : "8px 16px", borderRadius: 9999, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ {isMobile ? "" : t("nav.transaction")}{isMobile ? "Tx" : ""}</button>
                        {!isMobile && <button onClick={onLogout} style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(255,113,108,.08)", border: "1px solid rgba(255,113,108,.15)", color: "#ff716c", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.logout")}</button>}
                        {isMobile && (
                            <button onClick={onLogout} title="Logout" style={{ padding: "7px 9px", borderRadius: 10, background: "rgba(255,113,108,.08)", border: "1px solid rgba(255,113,108,.15)", color: "#ff716c", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </header>

                <div style={{ padding: isMobile ? "16px 12px" : 28 }}>
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
                                    ? "linear-gradient(135deg,rgba(255,113,108,.18),rgba(255,113,108,.08))"
                                    : isUrgent
                                        ? "linear-gradient(135deg,rgba(245,158,11,.18),rgba(255,113,108,.12))"
                                        : "linear-gradient(135deg,rgba(96,252,198,.15),rgba(79,195,247,.08))",
                                border: `1.5px solid ${isExpired ? "rgba(255,113,108,.5)" : isUrgent ? "rgba(245,158,11,.5)" : "rgba(96,252,198,.4)"}`,
                                borderRadius: 16,
                                padding: "18px 24px",
                                marginBottom: 24,
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                                boxShadow: isExpired
                                    ? "0 0 24px rgba(255,113,108,.15), inset 0 1px 0 var(--color-border-soft)"
                                    : isUrgent
                                        ? "0 0 24px rgba(245,158,11,.15), inset 0 1px 0 var(--color-border-soft)"
                                        : "0 0 32px rgba(96,252,198,.15), inset 0 1px 0 var(--color-border-soft)",
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
                                    background: isExpired ? "rgba(255,113,108,.08)" : isUrgent ? "rgba(245,158,11,.08)" : "rgba(96,252,198,.1)",
                                    filter: "blur(30px)",
                                    pointerEvents: "none",
                                }} />

                                <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                                    {/* Icon badge */}
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                        background: isExpired ? "rgba(255,113,108,.15)" : isUrgent ? "rgba(245,158,11,.15)" : "rgba(96,252,198,.15)",
                                        border: `1px solid ${isExpired ? "rgba(255,113,108,.3)" : isUrgent ? "rgba(245,158,11,.3)" : "rgba(96,252,198,.3)"}`,
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                                    }}>
                                        {isExpired ? "🔒" : isUrgent ? "⚠️" : "💎"}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: isExpired ? "#ff716c" : isUrgent ? "#fbbf24" : "var(--color-primary)", marginBottom: 3 }}>
                                            {isExpired ? t("sub.expired") : isUrgent ? `${t("sub.urgent")} ${daysLeft} ${t("sub.urgentSub")}` : t("sub.trial")}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                                            {isExpired
                                                ? t("sub.expiredSub")
                                                : isUrgent
                                                    ? t("sub.urgentCta")
                                                    : `${t("sub.trialSub")} ${daysLeft} ${t("sub.trialSub2")}`}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", flexShrink: 0 }}>
                                    {/* Progress bar hari tersisa */}
                                    {!isExpired && (
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 4 }}>{daysLeft}/14 {t("sub.days")}</div>
                                            <div style={{ width: 80, height: 4, background: "var(--color-border-soft)", borderRadius: 4, overflow: "hidden" }}>
                                                <div style={{
                                                    height: "100%", borderRadius: 4,
                                                    width: `${(daysLeft / 14) * 100}%`,
                                                    background: isUrgent ? "linear-gradient(90deg,#ff716c,#f59e0b)" : "linear-gradient(90deg,#60fcc6,#4FC3F7)",
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
                                                ? "linear-gradient(135deg,#ff716c,#e04f4f)"
                                                : "linear-gradient(135deg,#60fcc6,#19ce9b)",
                                            color: isExpired || isUrgent ? "#fff" : "var(--color-on-primary)", fontSize: 13, fontWeight: 700,
                                            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                            boxShadow: isExpired || isUrgent ? "0 4px 16px rgba(255,113,108,.35)" : "0 4px 16px rgba(96,252,198,.3)",
                                            animation: isExpired || isUrgent ? "pulse-btn 2s infinite" : "none",
                                        }}
                                    >
                                        {isExpired ? t("sub.upgrade") : t("sub.viewPlans")}
                                    </button>
                                </div>
                            </div>
                        );
                        if (plan === "starter") return (
                            <div style={{
                                position: "relative", overflow: "hidden",
                                background: "linear-gradient(135deg,rgba(96,252,198,.12),rgba(25,206,155,.06))",
                                border: "1.5px solid rgba(96,252,198,.3)", borderRadius: 16,
                                padding: "16px 24px", marginBottom: 24,
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                                boxShadow: "0 0 24px rgba(96,252,198,.1), inset 0 1px 0 var(--color-border-soft)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(96,252,198,.15)", border: "1px solid rgba(96,252,198,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚀</div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>{t("sub.starterActive")}</div>
                                        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{expires?.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })} · {daysLeft} {t("sub.expiresIn")}</div>
                                    </div>
                                </div>
                                <button onClick={() => setShowPricing(true)} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid rgba(96,252,198,.4)", background: "rgba(96,252,198,.1)", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{t("sub.renew")}</button>
                            </div>
                        );
                        if (plan === "pro") return (
                            <div style={{
                                position: "relative", overflow: "hidden",
                                background: "linear-gradient(135deg,rgba(245,158,11,.12),rgba(217,119,6,.06))",
                                border: "1.5px solid rgba(245,158,11,.3)", borderRadius: 16,
                                padding: "16px 24px", marginBottom: 24,
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                                boxShadow: "0 0 24px rgba(245,158,11,.1), inset 0 1px 0 var(--color-border-soft)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⭐</div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fcd34d" }}>{t("sub.proActive")}</div>
                                        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{expires?.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })} · {daysLeft} {t("sub.expiresIn")}</div>
                                    </div>
                                </div>
                                <button onClick={() => setShowPricing(true)} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid rgba(245,158,11,.4)", background: "rgba(245,158,11,.1)", color: "#fcd34d", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{t("sub.renew")}</button>
                            </div>
                        );
                        return null;
                    })()}

                    {activeMenu === "dasbor" && <DasborView accounts={accounts} transactions={transactions} goals={goals} investments={investments} debts={debts} budgets={budgets} setActiveMenu={setActiveMenu} setShowAddAccount={setShowAddAccount} setShowAddTx={setShowAddTx} customCategories={customCategories} {...sharedProps} />}
                    {activeMenu === "transaksi" && <TransaksiView transactions={transactions} onEdit={openEditTx} onDelete={deleteTx} accounts={accounts} />}
                    {activeMenu === "akun" && <AkunView accounts={accounts} transactions={transactions} setShowAddAccount={setShowAddAccount} setActiveMenu={setActiveMenu} onAdjustBalance={handleAdjustBalance} />}
                    {activeMenu === "kategori" && <KategoriView catTotals={catTotals} customCategories={customCategories} onAddCategory={addCategory} onEditCategory={editCategory} onDeleteCategory={deleteCategory} />}
                    {activeMenu === "berulang" && <BerulangView recurrings={recurrings} accounts={accounts} debts={debts} onAdd={addRecurring} onEdit={editRecurring} onDelete={deleteRecurring} customCategories={customCategories} />}
                    {activeMenu === "goals" && <GoalsView goals={goals} accounts={accounts} onAdd={addGoal} onEdit={editGoal} onDelete={deleteGoal} onTopup={topupGoal} />}
                    {activeMenu === "hutang" && <HutangView debts={debts} onAdd={addDebt} onEdit={editDebt} onDelete={deleteDebt} onPayDebt={payDebt} accounts={accounts} />}
                    {activeMenu === "piutang" && <PiutangView piutang={piutang} onAdd={addPiutang} onEdit={editPiutang} onDelete={deletePiutang} onTerima={terimaPiutang} accounts={accounts} />}
                    {activeMenu === "investasi" && <InvestasiView investments={investments} onAdd={addInvestment} onEdit={editInvestment} onDelete={deleteInvestment} goldPrices={goldPrices} onRefreshGold={refreshGoldPrices} refreshingGold={refreshingGold} />}
                    {activeMenu === "anggaran" && <AnggaranView budgets={budgets} transactions={transactions} onAdd={addBudget} onEdit={editBudget} onDelete={deleteBudget} onCopyMonth={copyBudgetMonth} customCategories={customCategories} />}
                    {activeMenu === "laporan" && <LaporanView transactions={transactions} />}
                    {activeMenu === "ai" && <AiView aiChat={aiChat} aiTyping={aiTyping} aiInput={aiInput} setAiInput={setAiInput} handleAi={handleAi} aiConfig={aiConfig} onOpenAiSettings={() => { setSidebarOpen(true); setAiSettingsTrigger(p => p + 1); }} />}
                    {activeMenu === "splitbill" && <SplitBillView splitBills={splitBills} onAdd={addSplitBill} onDelete={deleteSplitBill} onTogglePaid={toggleMemberPaid} />}
                    {activeMenu === "prediksi" && <PrediksiView transactions={transactions} budgets={budgets} accounts={accounts} />}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
