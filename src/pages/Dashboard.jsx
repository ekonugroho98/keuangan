import { useState, useEffect, useRef, useCallback } from "react";
import { fetchGoldPrices } from "../services/goldPrice";
import { sendAiMessage, buildSystemPrompt } from "../services/aiService";
import { APP_AI_NAME } from "../config/app";
import Sidebar from "../components/dashboard/Sidebar";
import { useLanguage } from "../i18n/LanguageContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useCategories } from "../hooks/useCategories";
import { useInvestments } from "../hooks/useInvestments";
import { useBudgets } from "../hooks/useBudgets";
import { useGoals } from "../hooks/useGoals";
import { useDebts } from "../hooks/useDebts";
import { usePiutang } from "../hooks/usePiutang";
import { useRecurrings } from "../hooks/useRecurrings";
import { useSplitBills } from "../hooks/useSplitBills";
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
import { categoryIcons } from "../constants/categories";
import { toLocalDateStr } from "../utils/dateHelpers";
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
    const [initialCategoryFilter, setInitialCategoryFilter] = useState("");
    const [initialAccountFilter, setInitialAccountFilter] = useState("");
    const [showAddTx, setShowAddTx] = useState(false);
    const [showEditTx, setShowEditTx] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [isSavingTx, setIsSavingTx] = useState(false);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [txForm, setTxForm] = useState({ type: "expense", amount: "", category: "Makanan", note: "", account: "", toAccount: "", date: toLocalDateStr() });
    const [accForm, setAccForm] = useState({ name: "", type: "bank", balance: "" });

    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Keep a ref for accounts so hooks can access latest value without re-render deps
    const accountsRef = useRef(accounts);
    accountsRef.current = accounts;

    // ── Domain hooks ─────────────────────────────────────────
    const { customCategories, setCustomCategories, addCategory, editCategory, deleteCategory } = useCategories(user.id, showToast);
    const { investments, setInvestments, addInvestment, editInvestment, deleteInvestment } = useInvestments(user.id, showToast);
    const { budgets, setBudgets, addBudget, editBudget, deleteBudget, copyBudgetMonth } = useBudgets(user.id, showToast);
    const { goals, setGoals, addGoal, editGoal, deleteGoal, topupGoal } = useGoals(user.id, showToast, accountsRef);
    const { debts, setDebts, addDebt, editDebt, deleteDebt, payDebt } = useDebts(user.id, showToast);
    const { piutang, setPiutang, addPiutang, editPiutang, deletePiutang, terimaPiutang } = usePiutang(user.id, showToast);
    const { recurrings, setRecurrings, addRecurring, editRecurring, deleteRecurring } = useRecurrings(user.id, showToast);
    const { splitBills, setSplitBills, addSplitBill, deleteSplitBill, toggleMemberPaid } = useSplitBills(user.id, showToast);

    // ── AI GREETING ──────────────────────────────────────────
    const makeGreeting = useCallback(() => {
        const name = userName.split(" ")[0];
        const raw  = t("ai.greeting");
        const tmpl = raw === "ai.greeting"
            ? `Halo ${name}! 👋 Gue ${APP_AI_NAME}. Mau analisis keuangan atau tanya apa?`
            : raw.replace("{name}", name).replace("{ai}", APP_AI_NAME);
        return [{ role: "ai", text: tmpl }];
    }, [userName, t]);

    const [aiChat, setAiChat] = useState(makeGreeting);
    const [aiInput, setAiInput] = useState("");
    const [aiTyping, setAiTyping] = useState(false);

    useEffect(() => {
        setAiChat(prev => {
            if (prev.length === 1) return makeGreeting();
            return [makeGreeting()[0], ...prev.slice(1)];
        });
    }, [lang, makeGreeting]);

    // ── USER SETTINGS (synced to DB) ────────────────────────
    const [userSettings,   setUserSettings]   = useState(null);
    const [goldPrices,     setGoldPrices]     = useState(null);
    const [refreshingGold, setRefreshingGold] = useState(false);
    const [aiConfig,       setAiConfig]       = useState(() => {
        try { const c = localStorage.getItem("karaya_ai_config"); return c ? JSON.parse(c) : null; } catch { return null; }
    });
    const [aiSettingsTrigger, setAiSettingsTrigger] = useState(0);

    useEffect(() => {
        fetchSettings();
        loadGoldPrices();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadGoldPrices = async () => {
        try {
            const data = await fetchGoldPrices("antam");
            setGoldPrices(data);
        } catch (err) {
            if (import.meta.env.DEV) console.warn("Gagal load harga emas:", err.message);
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
        setUserSettings(prev => ({ ...(prev || {}), ...patch }));
        Object.entries(patch).forEach(([k, v]) => {
            const key = { avatar_color: "karaya_avatar_color", hidden_menus: "karaya_hidden_menus", app_name: "karaya_app_name", app_tagline: "karaya_app_tagline" }[k];
            if (key) localStorage.setItem(key, typeof v === "object" ? JSON.stringify(v) : v);
        });
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
        a.download = `karaya-export-${toLocalDateStr()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ ${transactions.length} transaksi berhasil diekspor`);
    };

    const deleteAccount = async () => {
        showToast("Menghapus akun...", "info");
        await Promise.allSettled([
            supabase.from("transactions").delete().eq("user_id", user.id),
            supabase.from("accounts").delete().eq("user_id", user.id),
            supabase.from("goals").delete().eq("user_id", user.id),
            supabase.from("debts").delete().eq("user_id", user.id),
            supabase.from("budgets").delete().eq("user_id", user.id),
            supabase.from("investments").delete().eq("user_id", user.id),
            supabase.from("categories").delete().eq("user_id", user.id),
            supabase.from("recurring_transactions").delete().eq("user_id", user.id),
        ]);
        await supabase.auth.signOut();
        onLogout();
    };

    // ── FETCH DATA ──────────────────────────────────────────
    useEffect(() => {
        fetchAll();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const autoExecuteRecurrings = async (recurringsData, accountsData, debtsData) => {
        const todayStr = new Date().toLocaleDateString("en-CA");
        const due = recurringsData.filter(r => r.active && r.next_date <= todayStr);
        if (due.length === 0) return { accounts: accountsData, recurrings: recurringsData, debts: debtsData, executed: 0 };

        const calcNextDate = (freq, from) => {
            const d = new Date(from);
            if (freq === "daily")   d.setDate(d.getDate() + 1);
            if (freq === "weekly")  d.setDate(d.getDate() + 7);
            if (freq === "monthly") d.setMonth(d.getMonth() + 1);
            if (freq === "yearly")  d.setFullYear(d.getFullYear() + 1);
            return d.toISOString().slice(0, 10);
        };

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

        const updatedDebts = [...debtsData];
        for (const r of dueToInsert) {
            const acc = accountsData.find(a => a.name === r.account_name);
            if (acc) {
                await supabase.from("accounts").update({ balance: Math.max(0, acc.balance - r.amount) }).eq("id", acc.id);
                acc.balance = Math.max(0, acc.balance - r.amount);
            }
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

        return { accounts: accountsData, recurrings: recurringsData, debts: updatedDebts, executed: dueToInsert.length };
    };

    const fetchAll = async () => {
        setLoading(true);
        try {
        const [accs, txs, gls, dbs, cats, recs, invs, buds, splits, piu] = await Promise.all([
            supabase.from("accounts").select("*").order("created_at"),
            supabase.from("transactions").select("*").order("date", { ascending: false }),
            supabase.from("goals").select("*").order("created_at"),
            supabase.from("debts").select("*").order("created_at"),
            supabase.from("categories").select("*").order("created_at"),
            supabase.from("recurring_transactions").select("*").order("next_date"),
            supabase.from("investments").select("*").order("created_at"),
            supabase.from("budgets").select("*").order("created_at"),
            supabase.from("split_bills").select("*, split_bill_members(*)").order("created_at", { ascending: false }),
            supabase.from("piutang").select("*").order("created_at"),
        ]);

        const accountsData = accs.data || [];
        const recurringsData = recs.data || [];
        const debtsData = dbs.data || [];

        const result = await autoExecuteRecurrings(recurringsData, accountsData, debtsData);

        if (result.executed > 0) {
            const [freshAccs, freshTxs] = await Promise.all([
                supabase.from("accounts").select("*").order("created_at"),
                supabase.from("transactions").select("*").order("date", { ascending: false }),
            ]);
            if (freshAccs.data) setAccounts(freshAccs.data);
            if (freshTxs.data) setTransactions(freshTxs.data);
            setRecurrings([...recurringsData]);
            setDebts(result.debts);
            showToast(`🔄 ${result.executed} transaksi berulang dijalankan otomatis!`);
        } else {
            if (accs.data) setAccounts(accs.data);
            if (txs.data) setTransactions(txs.data);
        }

        if (gls.data) setGoals(gls.data);
        if (!result.executed && dbs.data) setDebts(dbs.data);
        if (cats.data) setCustomCategories(cats.data);
        if (recs.data && !result.executed) setRecurrings(recs.data);
        if (invs.data) setInvestments(invs.data);
        if (buds.data) setBudgets(buds.data);
        if (splits.data) setSplitBills(splits.data);
        if (piu.data) setPiutang(piu.data);
        setLoading(false);
        } catch (err) {
            if (import.meta.env.DEV) console.error("fetchAll error:", err);
            showToast("Gagal memuat data. Coba refresh halaman.", "error");
            setLoading(false);
        }
    };

    // ── COMPUTED VALUES ──────────────────────────────────────
    const totalBalance = accounts.reduce((a, b) => a + b.balance, 0);
    const totalIncome = transactions.filter(t => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    const netBalance = totalIncome - totalExpense;
    const savingRate = totalIncome > 0 ? Math.round((1 - totalExpense / totalIncome) * 100) : 0;
    const expenseRate = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

    const catTotals = {};
    transactions.forEach(t => {
        if (t.category) catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
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
            date: txForm.date || toLocalDateStr(),
            account_name: txForm.account || (accounts[0]?.name ?? ""),
            icon: categoryIcons[txForm.category] || "📦",
        };
        const { data, error } = await supabase.from("transactions").insert(newTx).select().single();
        if (error) { showToast("Gagal menyimpan transaksi", "info"); setIsSavingTx(false); return; }

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
        setTxForm({ type: "expense", amount: "", category: "Makanan", note: "", account: accounts[0]?.name ?? "", toAccount: "", date: toLocalDateStr() });
        setIsSavingTx(false);
        setShowAddTx(false);
        showToast("Transaksi berhasil ditambahkan!");
    };

    const addMultipleTx = async (items, accountName, date) => {
        if (!items.length || isSavingTx) return;
        setIsSavingTx(true);
        const today = toLocalDateStr();
        const acc = accounts.find(a => a.name === accountName);
        const txsToInsert = items.map(item => ({
            user_id: user.id,
            type: "expense",
            amount: item.amount,
            category: item.category,
            note: item.note,
            date: date || today,
            account_name: accountName,
            icon: categoryIcons[item.category] || "📦",
        }));
        const { data, error } = await supabase.from("transactions").insert(txsToInsert).select();
        if (error) { showToast("Gagal menyimpan transaksi", "error"); setIsSavingTx(false); return; }
        if (acc) {
            const total = items.reduce((s, i) => s + i.amount, 0);
            const { data: updatedAcc } = await supabase.from("accounts")
                .update({ balance: acc.balance - total }).eq("id", acc.id).select().single();
            if (updatedAcc) setAccounts(p => p.map(a => a.id === acc.id ? updatedAcc : a));
        }
        setTransactions(p => [...[...data].reverse(), ...p]);
        setIsSavingTx(false);
        setShowAddTx(false);
        showToast(`${data.length} transaksi berhasil disimpan! ✅`);
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
            date:      tx.date || toLocalDateStr(),
        });
        setShowEditTx(true);
    };

    const editTx = async () => {
        if (!editingTx || isSavingTx) return;
        const newAmount = parseInt(txForm.amount);
        if (!newAmount && editingTx.type !== "transfer") return;

        setIsSavingTx(true);
        const oldAcc = accounts.find(a => a.name === editingTx.account_name);

        if (editingTx.type === "transfer") {
            const { data, error } = await supabase.from("transactions")
                .update({ note: txForm.note, date: txForm.date || editingTx.date })
                .eq("id", editingTx.id).select().single();
            setIsSavingTx(false);
            if (error) { showToast("Gagal mengubah transaksi", "error"); return; }
            setTransactions(p => p.map(t => t.id === editingTx.id ? data : t));
            setShowEditTx(false); setEditingTx(null);
            showToast("Transfer diperbarui ✅");
            return;
        }

        if (oldAcc) {
            const revertedBalance = editingTx.type === "income"
                ? oldAcc.balance - editingTx.amount
                : oldAcc.balance + editingTx.amount;
            await supabase.from("accounts").update({ balance: revertedBalance }).eq("id", oldAcc.id);
            setAccounts(p => p.map(a => a.id === oldAcc.id ? { ...a, balance: revertedBalance } : a));
        }

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
        if (tx.type === "transfer") {
            const fromAcc = accounts.find(a => a.name === tx.account_name);
            const toAcc   = tx.to_account ? accounts.find(a => a.name === tx.to_account) : null;
            const updates = [];
            if (fromAcc) updates.push(supabase.from("accounts").update({ balance: fromAcc.balance + tx.amount }).eq("id", fromAcc.id));
            if (toAcc)   updates.push(supabase.from("accounts").update({ balance: toAcc.balance   - tx.amount }).eq("id", toAcc.id));
            await Promise.all(updates);
            setAccounts(p => p.map(a => {
                if (fromAcc && a.id === fromAcc.id) return { ...a, balance: fromAcc.balance + tx.amount };
                if (toAcc   && a.id === toAcc.id)   return { ...a, balance: toAcc.balance   - tx.amount };
                return a;
            }));
        } else {
            const acc = accounts.find(a => a.name === tx.account_name);
            if (acc) {
                const revertedBalance = tx.type === "income"
                    ? acc.balance - tx.amount
                    : acc.balance + tx.amount;
                await supabase.from("accounts").update({ balance: revertedBalance }).eq("id", acc.id);
                setAccounts(p => p.map(a => a.id === acc.id ? { ...a, balance: revertedBalance } : a));
            }
        }
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
        const date = txForm.date || toLocalDateStr();
        const note = txForm.note || `Transfer ${fromAcc.name} → ${toAcc.name}`;

        const { data: txData, error: txError } = await supabase.from("transactions").insert([
            { user_id: user.id, type: "transfer", amount, category: "Transfer", note, date, account_name: fromAcc.name, to_account: toAcc.name, icon: "🔄" },
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
        setTxForm({ type: "expense", amount: "", category: "Makanan", note: "", account: accounts[0]?.name ?? "", toAccount: "", date: toLocalDateStr() });
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
        const { data: updatedAcc, error: accErr } = await supabase
            .from("accounts").update({ balance: newBalance }).eq("id", account.id).select().single();
        if (accErr) { showToast("Gagal update saldo", "info"); return; }
        const adjTx = {
            user_id: user.id,
            account_id: account.id,
            account_name: account.name,
            type: diff > 0 ? "income" : "expense",
            amount: Math.abs(diff),
            category: "Koreksi Saldo",
            note: `Koreksi saldo ${account.name}`,
            icon: "⚖️",
            date: toLocalDateStr(),
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
        if (cfg?.apiKey) {
            localStorage.setItem("karaya_ai_config", JSON.stringify(cfg));
        } else {
            localStorage.removeItem("karaya_ai_config");
        }
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

    // ── Wrappers for hooks that need cross-entity access ─────
    const handleTopupGoal = (goalId, goal, amount, accountName) =>
        topupGoal(goalId, goal, amount, accountName, { setTransactions, setAccounts });

    const handlePayDebt = (debt, amount, accountName) =>
        payDebt(debt, amount, accountName, { accounts, setAccounts, setTransactions });

    const handleAddPiutang = (payload) =>
        addPiutang(payload, { accounts, setAccounts });

    const handleTerimaPiutang = (item, amount, accountName) =>
        terimaPiutang(item, amount, accountName, { accounts, setAccounts });

    // ── RENDER ───────────────────────────────────────────────
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
            <AddTransactionModal open={showAddTx} onClose={() => setShowAddTx(false)} txForm={txForm} setTxForm={setTxForm} onSubmit={addTx} onTransfer={addTransfer} accounts={accounts} customCategories={customCategories} isSaving={isSavingTx} aiConfig={aiConfig} onSubmitMultiple={addMultipleTx} />
            <AddTransactionModal open={showEditTx} onClose={() => { setShowEditTx(false); setEditingTx(null); }} txForm={txForm} setTxForm={setTxForm} onSubmit={addTx} onTransfer={addTransfer} accounts={accounts} customCategories={customCategories} editMode={true} onUpdate={editTx} isSaving={isSavingTx} aiConfig={aiConfig} />
            <AddAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)} accForm={accForm} setAccForm={setAccForm} onSubmit={addAccount} />
            <Sidebar
                open={sidebarOpen}
                activeMenu={activeMenu}
                setActiveMenu={(m) => { setActiveMenu(m); if (isMobile) setSidebarOpen(false); }}
                user={{ name: userName }}
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

                    {activeMenu === "dasbor" && <DasborView accounts={accounts} transactions={transactions} goals={goals} investments={investments} debts={debts} budgets={budgets} setActiveMenu={setActiveMenu} setShowAddAccount={setShowAddAccount} setShowAddTx={setShowAddTx} customCategories={customCategories} {...sharedProps} />}
                    {activeMenu === "transaksi" && <TransaksiView transactions={transactions} onEdit={openEditTx} onDelete={deleteTx} accounts={accounts} initialCategory={initialCategoryFilter} onClearInitialCategory={() => setInitialCategoryFilter("")} initialAccount={initialAccountFilter} onClearInitialAccount={() => setInitialAccountFilter("")} />}
                    {activeMenu === "akun" && <AkunView accounts={accounts} transactions={transactions} setShowAddAccount={setShowAddAccount} setActiveMenu={setActiveMenu} onAdjustBalance={handleAdjustBalance} onViewAccount={(accName) => { setInitialAccountFilter(accName); setActiveMenu("transaksi"); }} />}
                    {activeMenu === "kategori" && <KategoriView transactions={transactions} customCategories={customCategories} onAddCategory={addCategory} onEditCategory={editCategory} onDeleteCategory={deleteCategory} onViewCategory={(catName) => { setInitialCategoryFilter(catName); setActiveMenu("transaksi"); }} />}
                    {activeMenu === "berulang" && <BerulangView recurrings={recurrings} accounts={accounts} debts={debts} onAdd={addRecurring} onEdit={editRecurring} onDelete={deleteRecurring} customCategories={customCategories} />}
                    {activeMenu === "goals" && <GoalsView goals={goals} accounts={accounts} onAdd={addGoal} onEdit={editGoal} onDelete={deleteGoal} onTopup={handleTopupGoal} />}
                    {activeMenu === "hutang" && <HutangView debts={debts} onAdd={addDebt} onEdit={editDebt} onDelete={deleteDebt} onPayDebt={handlePayDebt} accounts={accounts} />}
                    {activeMenu === "piutang" && <PiutangView piutang={piutang} onAdd={handleAddPiutang} onEdit={editPiutang} onDelete={deletePiutang} onTerima={handleTerimaPiutang} accounts={accounts} />}
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
