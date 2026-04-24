import {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
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
/* ═══ Eager: Dashboard landing view (first screen after login) ═══ */
import DasborView from "../components/dashboard/views/DasborView";
/* ═══ Lazy: the other 12 views + heavy modals ═══ */
const TransaksiView = lazy(
  () => import("../components/dashboard/views/TransaksiView"),
);
const AkunView = lazy(() => import("../components/dashboard/views/AkunView"));
const KategoriView = lazy(
  () => import("../components/dashboard/views/KategoriView"),
);
const BerulangView = lazy(
  () => import("../components/dashboard/views/BerulangView"),
);
const GoalsView = lazy(() => import("../components/dashboard/views/GoalsView"));
const HutangView = lazy(
  () => import("../components/dashboard/views/HutangView"),
);
const PiutangView = lazy(
  () => import("../components/dashboard/views/PiutangView"),
);
const InvestasiView = lazy(
  () => import("../components/dashboard/views/InvestasiView"),
);
const LaporanView = lazy(
  () => import("../components/dashboard/views/LaporanView"),
);
const AiView = lazy(() => import("../components/dashboard/views/AiView"));
const AnggaranView = lazy(
  () => import("../components/dashboard/views/AnggaranView"),
);
const SplitBillView = lazy(
  () => import("../components/dashboard/views/SplitBillView"),
);
const PrediksiView = lazy(
  () => import("../components/dashboard/views/PrediksiView"),
);
const AddTransactionModal = lazy(
  () => import("../components/dashboard/AddTransactionModal"),
);
const AddAccountModal = lazy(
  () => import("../components/dashboard/AddAccountModal"),
);
import { categoryIcons } from "../constants/categories";
import { toLocalDateStr } from "../utils/dateHelpers";
import { supabase } from "../lib/supabase";
import { DashboardSkeleton, BentoSkeleton } from "../components/ui/Skeleton";

const NAV_LABELS = {
  dasbor: "nav.dashboard",
  transaksi: "nav.transaction",
  akun: "nav.accounts",
  kategori: "nav.categories",
  berulang: "nav.recurring",
  goals: "nav.goals",
  hutang: "nav.debts",
  investasi: "nav.investments",
  anggaran: "nav.budgets",
  laporan: "nav.reports",
  ai: "nav.ai",
  splitbill: "nav.splitbill",
  prediksi: "nav.prediksi",
};

const Dashboard = ({ session, onLogout, showToast }) => {
  const { t, lang } = useLanguage();
  const isMobile = useIsMobile();
  const user = session.user;
  const [userName, setUserName] = useState(
    user.user_metadata?.full_name || user.email.split("@")[0],
  );

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [activeMenu, setActiveMenu] = useState("dasbor");
  const [initialCategoryFilter, setInitialCategoryFilter] = useState("");
  const [initialAccountFilter, setInitialAccountFilter] = useState("");
  const [showAddTx, setShowAddTx] = useState(false);
  const [showEditTx, setShowEditTx] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [isSavingTx, setIsSavingTx] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [txForm, setTxForm] = useState({
    type: "expense",
    amount: "",
    category: "Makanan",
    note: "",
    account: "",
    toAccount: "",
    date: toLocalDateStr(),
  });

  // Auto-select akun pertama saat modal dibuka agar tidak pernah kosong
  const openAddTxModal = () => {
    setTxForm((p) => ({ ...p, account: p.account || accounts[0]?.name || "" }));
    setShowAddTx(true);
  };
  const [accForm, setAccForm] = useState({
    name: "",
    type: "bank",
    balance: "",
  });

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Keep a ref for accounts so hooks can access latest value without re-render deps
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  // ── Domain hooks ─────────────────────────────────────────
  const {
    customCategories,
    setCustomCategories,
    addCategory,
    editCategory,
    deleteCategory,
  } = useCategories(user.id, showToast);
  const {
    investments,
    setInvestments,
    addInvestment,
    editInvestment,
    deleteInvestment,
  } = useInvestments(user.id, showToast);
  const {
    budgets,
    setBudgets,
    addBudget,
    editBudget,
    deleteBudget,
    copyBudgetMonth,
  } = useBudgets(user.id, showToast);
  const { goals, setGoals, addGoal, editGoal, deleteGoal, topupGoal } =
    useGoals(user.id, showToast, accountsRef);
  const { debts, setDebts, addDebt, editDebt, deleteDebt, payDebt } = useDebts(
    user.id,
    showToast,
  );
  const {
    piutang,
    setPiutang,
    addPiutang,
    editPiutang,
    deletePiutang,
    terimaPiutang,
  } = usePiutang(user.id, showToast);
  const {
    recurrings,
    setRecurrings,
    addRecurring,
    editRecurring,
    deleteRecurring,
  } = useRecurrings(user.id, showToast);
  const {
    splitBills,
    setSplitBills,
    addSplitBill,
    deleteSplitBill,
    toggleMemberPaid,
  } = useSplitBills(user.id, showToast);

  // ── AI GREETING ──────────────────────────────────────────
  const makeGreeting = useCallback(() => {
    const name = userName.split(" ")[0];
    const raw = t("ai.greeting");
    const tmpl =
      raw === "ai.greeting"
        ? `Halo ${name}! 👋 Gue ${APP_AI_NAME}. Mau analisis keuangan atau tanya apa?`
        : raw.replace("{name}", name).replace("{ai}", APP_AI_NAME);
    return [{ role: "ai", text: tmpl }];
  }, [userName, t]);

  const [aiChat, setAiChat] = useState(makeGreeting);
  const [aiInput, setAiInput] = useState("");
  const [aiTyping, setAiTyping] = useState(false);

  useEffect(() => {
    setAiChat((prev) => {
      if (prev.length === 1) return makeGreeting();
      return [makeGreeting()[0], ...prev.slice(1)];
    });
  }, [lang, makeGreeting]);

  // ── USER SETTINGS (synced to DB) ────────────────────────
  const [userSettings, setUserSettings] = useState(null);
  const [goldPrices, setGoldPrices] = useState(null);
  const [refreshingGold, setRefreshingGold] = useState(false);
  const [aiConfig, setAiConfig] = useState(() => {
    try {
      const c = localStorage.getItem("karaya_ai_config");
      return c ? JSON.parse(c) : null;
    } catch {
      return null;
    }
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
      if (import.meta.env.DEV)
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
      if (data.avatar_color)
        localStorage.setItem("karaya_avatar_color", data.avatar_color);
      if (data.hidden_menus)
        localStorage.setItem(
          "karaya_hidden_menus",
          JSON.stringify(data.hidden_menus),
        );
      if (data.app_name) localStorage.setItem("karaya_app_name", data.app_name);
      if (data.app_tagline)
        localStorage.setItem("karaya_app_tagline", data.app_tagline);
      if (data.ai_config?.apiKey) {
        setAiConfig(data.ai_config);
        localStorage.setItem(
          "karaya_ai_config",
          JSON.stringify(data.ai_config),
        );
      }
    }
  };

  const saveSettings = async (patch) => {
    setUserSettings((prev) => ({ ...(prev || {}), ...patch }));
    Object.entries(patch).forEach(([k, v]) => {
      const key = {
        avatar_color: "karaya_avatar_color",
        hidden_menus: "karaya_hidden_menus",
        app_name: "karaya_app_name",
        app_tagline: "karaya_app_tagline",
      }[k];
      if (key)
        localStorage.setItem(
          key,
          typeof v === "object" ? JSON.stringify(v) : v,
        );
    });
    await supabase.from("user_settings").upsert({
      user_id: user.id,
      ...patch,
      updated_at: new Date().toISOString(),
    });
  };

  // ── PROFILE HANDLERS ────────────────────────────────────
  const updateName = async (newName) => {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: newName },
    });
    if (!error) {
      setUserName(newName);
      showToast("✅ Nama berhasil diperbarui");
    } else showToast("Gagal memperbarui nama", "error");
  };

  const updatePassword = async (newPass) => {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (!error) showToast("✅ Password berhasil diperbarui");
    else showToast(error.message || "Gagal memperbarui password", "error");
  };

  const exportCSV = () => {
    const headers = [
      "Tanggal",
      "Tipe",
      "Kategori",
      "Jumlah",
      "Akun",
      "Catatan",
    ];
    const rows = transactions.map((tx) => [
      tx.date,
      tx.type,
      tx.category,
      tx.amount,
      tx.account_name || "",
      (tx.note || "").replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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

  const autoExecuteRecurrings = async (
    recurringsData,
    accountsData,
    debtsData,
  ) => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    const due = recurringsData.filter(
      (r) => r.active && r.next_date <= todayStr,
    );
    if (due.length === 0)
      return {
        accounts: accountsData,
        recurrings: recurringsData,
        debts: debtsData,
        executed: 0,
      };

    const calcNextDate = (freq, from) => {
      const d = new Date(from);
      if (freq === "daily") d.setDate(d.getDate() + 1);
      if (freq === "weekly") d.setDate(d.getDate() + 7);
      if (freq === "monthly") d.setMonth(d.getMonth() + 1);
      if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    };

    const { data: existingAuto } = await supabase
      .from("transactions")
      .select("note, date")
      .eq("user_id", user.id)
      .like("note", "[Auto]%")
      .gte("date", todayStr);
    const alreadyInserted = new Set(
      (existingAuto || []).map((t) => `${t.note}|${t.date}`),
    );
    const dueToInsert = due.filter(
      (r) => !alreadyInserted.has(`[Auto] ${r.name}|${r.next_date}`),
    );

    const newTxs = dueToInsert.map((r) => ({
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
      const acc = accountsData.find((a) => a.name === r.account_name);
      if (acc) {
        await supabase
          .from("accounts")
          .update({ balance: Math.max(0, acc.balance - r.amount) })
          .eq("id", acc.id);
        acc.balance = Math.max(0, acc.balance - r.amount);
      }
      if (r.debt_id) {
        const debtIdx = updatedDebts.findIndex((d) => d.id === r.debt_id);
        if (debtIdx !== -1) {
          const newRemaining = Math.max(
            0,
            updatedDebts[debtIdx].remaining - r.amount,
          );
          await supabase
            .from("debts")
            .update({ remaining: newRemaining })
            .eq("id", r.debt_id);
          updatedDebts[debtIdx] = {
            ...updatedDebts[debtIdx],
            remaining: newRemaining,
          };
        }
      }
      const newNext = calcNextDate(r.frequency, r.next_date);
      await supabase
        .from("recurring_transactions")
        .update({ next_date: newNext })
        .eq("id", r.id);
      r.next_date = newNext;
    }

    return {
      accounts: accountsData,
      recurrings: recurringsData,
      debts: updatedDebts,
      executed: dueToInsert.length,
    };
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [accs, txs, gls, dbs, cats, recs, invs, buds, splits, piu] =
        await Promise.all([
          supabase.from("accounts").select("*").order("created_at"),
          supabase
            .from("transactions")
            .select("*")
            .order("date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at"),
          supabase.from("debts").select("*").order("created_at"),
          supabase.from("categories").select("*").order("created_at"),
          supabase
            .from("recurring_transactions")
            .select("*")
            .order("next_date"),
          supabase.from("investments").select("*").order("created_at"),
          supabase.from("budgets").select("*").order("created_at"),
          supabase
            .from("split_bills")
            .select("*, split_bill_members(*)")
            .order("created_at", { ascending: false }),
          supabase.from("piutang").select("*").order("created_at"),
        ]);

      const accountsData = accs.data || [];
      const recurringsData = recs.data || [];
      const debtsData = dbs.data || [];

      const result = await autoExecuteRecurrings(
        recurringsData,
        accountsData,
        debtsData,
      );

      if (result.executed > 0) {
        const [freshAccs, freshTxs] = await Promise.all([
          supabase.from("accounts").select("*").order("created_at"),
          supabase
            .from("transactions")
            .select("*")
            .order("date", { ascending: false }),
        ]);
        if (freshAccs.data) setAccounts(freshAccs.data);
        if (freshTxs.data) setTransactions(freshTxs.data);
        setRecurrings([...recurringsData]);
        setDebts(result.debts);
        showToast(
          `🔄 ${result.executed} transaksi berulang dijalankan otomatis!`,
        );
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
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const savingRate =
    totalIncome > 0 ? Math.round((1 - totalExpense / totalIncome) * 100) : 0;
  const expenseRate =
    totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

  const catTotals = {};
  transactions.forEach((t) => {
    if (t.category)
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // ── ADD TRANSACTION ────────────────────
  const addTx = async () => {
    if (!txForm.amount || isSavingTx) return;

    // Validasi: akun harus dipilih
    const accountName = txForm.account || accounts[0]?.name || "";
    if (!accountName) {
      showToast("Pilih akun terlebih dahulu", "error");
      return;
    }
    const acc = accounts.find((a) => a.name === accountName);
    if (!acc) {
      showToast("Akun tidak ditemukan. Pilih akun yang valid.", "error");
      return;
    }

    setIsSavingTx(true);

    // Refetch saldo terbaru dari DB untuk hindari race condition
    const { data: freshAcc, error: fetchErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", acc.id)
      .single();
    if (fetchErr || !freshAcc) {
      showToast("Gagal membaca saldo akun. Coba lagi.", "error");
      setIsSavingTx(false);
      return;
    }

    const amount = parseInt(txForm.amount);

    // Cek saldo cukup untuk pengeluaran
    if (txForm.type === "expense" && freshAcc.balance < amount) {
      showToast(
        `⚠️ Saldo ${accountName} (Rp ${freshAcc.balance.toLocaleString("id-ID")}) tidak cukup untuk pengeluaran Rp ${amount.toLocaleString("id-ID")}`,
        "error",
      );
      setIsSavingTx(false);
      return;
    }

    const newTx = {
      user_id: user.id,
      type: txForm.type,
      amount,
      category: txForm.category,
      note: txForm.note || txForm.category,
      date: txForm.date || toLocalDateStr(),
      account_name: accountName,
      icon: categoryIcons[txForm.category] || "📦",
    };

    // 1. Insert transaksi
    const { data, error } = await supabase
      .from("transactions")
      .insert(newTx)
      .select()
      .single();
    if (error) {
      showToast("Gagal menyimpan transaksi", "error");
      setIsSavingTx(false);
      return;
    }

    // 2. Update saldo akun (gunakan saldo fresh dari DB)
    const newBalance =
      newTx.type === "income"
        ? freshAcc.balance + newTx.amount
        : freshAcc.balance - newTx.amount;
    const { data: updatedAcc, error: accErr } = await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", acc.id)
      .select()
      .single();
    if (accErr || !updatedAcc) {
      // Rollback: hapus transaksi yang baru di-insert
      await supabase.from("transactions").delete().eq("id", data.id);
      showToast("Gagal update saldo akun. Transaksi dibatalkan.", "error");
      setIsSavingTx(false);
      return;
    }

    // 3. Semua berhasil — update state
    setAccounts((p) => p.map((a) => (a.id === acc.id ? updatedAcc : a)));
    setTransactions((p) => [data, ...p]);
    setTxForm({
      type: "expense",
      amount: "",
      category: "Makanan",
      note: "",
      account: accounts[0]?.name ?? "",
      toAccount: "",
      date: toLocalDateStr(),
    });
    setIsSavingTx(false);
    setShowAddTx(false);
    showToast("Transaksi berhasil ditambahkan!");
  };

  const addMultipleTx = async (items, accountName, date) => {
    if (!items.length || isSavingTx) return;

    // Validasi akun
    if (!accountName) {
      showToast("Pilih akun terlebih dahulu", "error");
      return;
    }
    const acc = accounts.find((a) => a.name === accountName);
    if (!acc) {
      showToast("Akun tidak ditemukan. Pilih akun yang valid.", "error");
      return;
    }

    setIsSavingTx(true);

    // Refetch saldo terbaru
    const { data: freshAcc, error: fetchErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", acc.id)
      .single();
    if (fetchErr || !freshAcc) {
      showToast("Gagal membaca saldo akun. Coba lagi.", "error");
      setIsSavingTx(false);
      return;
    }

    const total = items.reduce((s, i) => s + i.amount, 0);

    // Cek saldo cukup
    if (freshAcc.balance < total) {
      showToast(
        `⚠️ Saldo ${accountName} (Rp ${freshAcc.balance.toLocaleString("id-ID")}) tidak cukup untuk total Rp ${total.toLocaleString("id-ID")}`,
        "error",
      );
      setIsSavingTx(false);
      return;
    }

    const today = toLocalDateStr();
    const txsToInsert = items.map((item) => ({
      user_id: user.id,
      type: "expense",
      amount: item.amount,
      category: item.category,
      note: item.note,
      date: date || today,
      account_name: accountName,
      icon: categoryIcons[item.category] || "📦",
    }));

    // 1. Insert semua transaksi
    const { data, error } = await supabase
      .from("transactions")
      .insert(txsToInsert)
      .select();
    if (error) {
      showToast("Gagal menyimpan transaksi", "error");
      setIsSavingTx(false);
      return;
    }

    // 2. Update saldo akun (fresh balance)
    const { data: updatedAcc, error: accErr } = await supabase
      .from("accounts")
      .update({ balance: freshAcc.balance - total })
      .eq("id", acc.id)
      .select()
      .single();
    if (accErr || !updatedAcc) {
      // Rollback: hapus transaksi yang baru di-insert
      const ids = (data || []).map((t) => t.id);
      if (ids.length)
        await supabase.from("transactions").delete().in("id", ids);
      showToast("Gagal update saldo. Transaksi dibatalkan.", "error");
      setIsSavingTx(false);
      return;
    }

    // 3. Semua berhasil
    setAccounts((p) => p.map((a) => (a.id === acc.id ? updatedAcc : a)));
    setTransactions((p) => [...[...data].reverse(), ...p]);
    setIsSavingTx(false);
    setShowAddTx(false);
    showToast(`${data.length} transaksi berhasil disimpan! ✅`);
  };

  // ── EDIT TRANSAKSI ───────────────────────────────────────
  const openEditTx = (tx) => {
    setEditingTx(tx);
    setTxForm({
      type: tx.type,
      amount: String(tx.amount),
      category: tx.category,
      note: tx.note,
      account: tx.account_name,
      toAccount: "",
      date: tx.date || toLocalDateStr(),
    });
    setShowEditTx(true);
  };

  const editTx = async () => {
    if (!editingTx || isSavingTx) return;
    const newAmount = parseInt(txForm.amount);
    if (!newAmount && editingTx.type !== "transfer") return;

    setIsSavingTx(true);

    // Transfer: hanya bisa edit note & date
    if (editingTx.type === "transfer") {
      const { data, error } = await supabase
        .from("transactions")
        .update({ note: txForm.note, date: txForm.date || editingTx.date })
        .eq("id", editingTx.id)
        .select()
        .single();
      setIsSavingTx(false);
      if (error) {
        showToast("Gagal mengubah transaksi", "error");
        return;
      }
      setTransactions((p) => p.map((t) => (t.id === editingTx.id ? data : t)));
      setShowEditTx(false);
      setEditingTx(null);
      showToast("Transfer diperbarui ✅");
      return;
    }

    const newAccountName = txForm.account || editingTx.account_name;
    const oldAcc = accounts.find((a) => a.name === editingTx.account_name);
    const targetAcc = accounts.find((a) => a.name === newAccountName) || oldAcc;

    // Refetch saldo terbaru kedua akun dari DB
    let freshOldAcc = null,
      freshTargetAcc = null;
    if (oldAcc) {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", oldAcc.id)
        .single();
      freshOldAcc = data;
    }
    if (targetAcc && targetAcc.id !== oldAcc?.id) {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", targetAcc.id)
        .single();
      freshTargetAcc = data;
    } else {
      freshTargetAcc = freshOldAcc;
    }

    // Hitung saldo: revert old tx di akun lama, apply new tx di akun target
    if (freshOldAcc) {
      const revertedBalance =
        editingTx.type === "income"
          ? freshOldAcc.balance - editingTx.amount
          : freshOldAcc.balance + editingTx.amount;
      const { error: revErr } = await supabase
        .from("accounts")
        .update({ balance: revertedBalance })
        .eq("id", oldAcc.id);
      if (revErr) {
        showToast("Gagal mengembalikan saldo akun lama", "error");
        setIsSavingTx(false);
        return;
      }
      // Update freshTargetAcc jika sama dengan oldAcc
      if (targetAcc?.id === oldAcc.id) {
        freshTargetAcc = { ...freshOldAcc, balance: revertedBalance };
      }
      setAccounts((p) =>
        p.map((a) =>
          a.id === oldAcc.id ? { ...a, balance: revertedBalance } : a,
        ),
      );
    }

    if (freshTargetAcc) {
      const newBalance =
        txForm.type === "income"
          ? freshTargetAcc.balance + newAmount
          : freshTargetAcc.balance - newAmount;
      const { data: updatedAcc, error: updErr } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", targetAcc.id)
        .select()
        .single();
      if (updErr || !updatedAcc) {
        // Rollback revert jika akun lama sudah di-revert
        if (freshOldAcc) {
          await supabase
            .from("accounts")
            .update({ balance: freshOldAcc.balance })
            .eq("id", oldAcc.id);
          setAccounts((p) =>
            p.map((a) =>
              a.id === oldAcc.id ? { ...a, balance: freshOldAcc.balance } : a,
            ),
          );
        }
        showToast("Gagal update saldo. Edit dibatalkan.", "error");
        setIsSavingTx(false);
        return;
      }
      setAccounts((p) =>
        p.map((a) => (a.id === targetAcc.id ? updatedAcc : a)),
      );
    }

    // Update transaksi di DB
    const updatedFields = {
      type: txForm.type,
      amount: newAmount,
      category: txForm.category,
      note: txForm.note || txForm.category,
      account_name: newAccountName,
      icon: categoryIcons[txForm.category] || editingTx.icon || "📦",
      date: txForm.date || editingTx.date,
    };
    const { data, error } = await supabase
      .from("transactions")
      .update(updatedFields)
      .eq("id", editingTx.id)
      .select()
      .single();
    if (error) {
      // Rollback semua balance changes
      if (freshOldAcc)
        await supabase
          .from("accounts")
          .update({ balance: freshOldAcc.balance })
          .eq("id", oldAcc.id);
      if (freshTargetAcc && targetAcc?.id !== oldAcc?.id)
        await supabase
          .from("accounts")
          .update({ balance: freshTargetAcc.balance })
          .eq("id", targetAcc.id);
      showToast("Gagal mengubah transaksi. Saldo dikembalikan.", "error");
      setIsSavingTx(false);
      return;
    }

    setTransactions((p) => p.map((t) => (t.id === editingTx.id ? data : t)));
    setShowEditTx(false);
    setEditingTx(null);
    setIsSavingTx(false);
    showToast("Transaksi berhasil diperbarui ✅");
  };

  // ── DELETE TRANSAKSI ─────────────────────────────
  const deleteTx = async (tx) => {
    // 1. Hapus transaksi dulu dari DB
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", tx.id);
    if (error) {
      showToast("Gagal menghapus transaksi", "error");
      return;
    }

    // 2. Kembalikan saldo berdasarkan tipe transaksi
    if (tx.type === "transfer") {
      const fromAcc = accounts.find((a) => a.name === tx.account_name);
      const toAcc = tx.to_account
        ? accounts.find((a) => a.name === tx.to_account)
        : null;

      // Refetch saldo terbaru
      let freshFrom = null,
        freshTo = null;
      if (fromAcc) {
        const { data } = await supabase
          .from("accounts")
          .select("*")
          .eq("id", fromAcc.id)
          .single();
        freshFrom = data;
      }
      if (toAcc) {
        const { data } = await supabase
          .from("accounts")
          .select("*")
          .eq("id", toAcc.id)
          .single();
        freshTo = data;
      }

      const updates = [];
      if (freshFrom)
        updates.push(
          supabase
            .from("accounts")
            .update({ balance: freshFrom.balance + tx.amount })
            .eq("id", fromAcc.id)
            .select()
            .single(),
        );
      if (freshTo)
        updates.push(
          supabase
            .from("accounts")
            .update({ balance: freshTo.balance - tx.amount })
            .eq("id", toAcc.id)
            .select()
            .single(),
        );
      const results = await Promise.all(updates);

      setAccounts((p) =>
        p.map((a) => {
          if (freshFrom && a.id === fromAcc.id)
            return (
              results[0]?.data || {
                ...a,
                balance: freshFrom.balance + tx.amount,
              }
            );
          if (freshTo && a.id === toAcc.id)
            return (
              results[freshFrom ? 1 : 0]?.data || {
                ...a,
                balance: freshTo.balance - tx.amount,
              }
            );
          return a;
        }),
      );
    } else {
      const acc = accounts.find((a) => a.name === tx.account_name);
      if (acc) {
        // Refetch saldo terbaru
        const { data: freshAcc } = await supabase
          .from("accounts")
          .select("*")
          .eq("id", acc.id)
          .single();
        if (freshAcc) {
          const revertedBalance =
            tx.type === "income"
              ? freshAcc.balance - tx.amount
              : freshAcc.balance + tx.amount;
          const { data: updatedAcc } = await supabase
            .from("accounts")
            .update({ balance: revertedBalance })
            .eq("id", acc.id)
            .select()
            .single();
          setAccounts((p) =>
            p.map((a) =>
              a.id === acc.id
                ? updatedAcc || { ...a, balance: revertedBalance }
                : a,
            ),
          );
        }
      }
    }

    setTransactions((p) => p.filter((t) => t.id !== tx.id));
    showToast("Transaksi dihapus 🗑️", "info");
  };

  // ── TRANSFER DANA ────────────────────────────
  const addTransfer = async () => {
    const amount = parseInt(txForm.amount);
    const fromAcc = accounts.find((a) => a.name === txForm.account);
    const toAcc = accounts.find((a) => a.name === txForm.toAccount);
    if (!amount || !fromAcc || !toAcc || fromAcc.id === toAcc.id || isSavingTx)
      return;

    setIsSavingTx(true);

    // Refetch saldo terbaru kedua akun
    const [freshFromRes, freshToRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("id", fromAcc.id).single(),
      supabase.from("accounts").select("*").eq("id", toAcc.id).single(),
    ]);
    if (
      freshFromRes.error ||
      freshToRes.error ||
      !freshFromRes.data ||
      !freshToRes.data
    ) {
      showToast("Gagal membaca saldo akun. Coba lagi.", "error");
      setIsSavingTx(false);
      return;
    }
    const freshFrom = freshFromRes.data;
    const freshTo = freshToRes.data;

    // Cek saldo cukup
    if (freshFrom.balance < amount) {
      showToast(
        `⚠️ Saldo ${fromAcc.name} (Rp ${freshFrom.balance.toLocaleString("id-ID")}) tidak cukup untuk transfer Rp ${amount.toLocaleString("id-ID")}`,
        "error",
      );
      setIsSavingTx(false);
      return;
    }

    const date = txForm.date || toLocalDateStr();
    const note = txForm.note || `Transfer ${fromAcc.name} → ${toAcc.name}`;

    // 1. Insert transaksi
    const { data: txData, error: txError } = await supabase
      .from("transactions")
      .insert([
        {
          user_id: user.id,
          type: "transfer",
          amount,
          category: "Transfer",
          note,
          date,
          account_name: fromAcc.name,
          to_account: toAcc.name,
          icon: "🔄",
        },
      ])
      .select();
    if (txError) {
      showToast("Gagal menyimpan transfer", "error");
      setIsSavingTx(false);
      return;
    }

    // 2. Update saldo kedua akun (fresh balance)
    const [resFrom, resTo] = await Promise.all([
      supabase
        .from("accounts")
        .update({ balance: freshFrom.balance - amount })
        .eq("id", fromAcc.id)
        .select()
        .single(),
      supabase
        .from("accounts")
        .update({ balance: freshTo.balance + amount })
        .eq("id", toAcc.id)
        .select()
        .single(),
    ]);
    if (resFrom.error || resTo.error) {
      // Rollback: hapus transaksi & kembalikan saldo yang sudah terupdate
      const txIds = (txData || []).map((t) => t.id);
      if (txIds.length)
        await supabase.from("transactions").delete().in("id", txIds);
      if (!resFrom.error && resFrom.data)
        await supabase
          .from("accounts")
          .update({ balance: freshFrom.balance })
          .eq("id", fromAcc.id);
      if (!resTo.error && resTo.data)
        await supabase
          .from("accounts")
          .update({ balance: freshTo.balance })
          .eq("id", toAcc.id);
      showToast("Gagal update saldo. Transfer dibatalkan.", "error");
      setIsSavingTx(false);
      return;
    }

    // 3. Semua berhasil
    setTransactions((p) => [...(txData || []).reverse(), ...p]);
    setAccounts((p) =>
      p.map((a) => {
        if (a.id === fromAcc.id) return resFrom.data;
        if (a.id === toAcc.id) return resTo.data;
        return a;
      }),
    );
    setTxForm({
      type: "expense",
      amount: "",
      category: "Makanan",
      note: "",
      account: accounts[0]?.name ?? "",
      toAccount: "",
      date: toLocalDateStr(),
    });
    setIsSavingTx(false);
    setShowAddTx(false);
    showToast(
      `✅ Transfer Rp ${amount.toLocaleString("id-ID")} dari ${fromAcc.name} ke ${toAcc.name} berhasil!`,
    );
  };

  // ── ADD ACCOUNT ──────────────────────────────────────────
  const addAccount = async () => {
    if (!accForm.name || !accForm.balance) return;
    const icons = {
      bank: "🏦",
      ewallet: "📱",
      cash: "💵",
      crypto: "₿",
      investasi: "📈",
      tabungan: "🪙",
    };
    const colors = [
      "#6366f1",
      "#8b5cf6",
      "#06b6d4",
      "#10b981",
      "#f59e0b",
      "#ef4444",
    ];
    const newAcc = {
      user_id: user.id,
      name: accForm.name,
      type: accForm.type,
      balance: parseInt(accForm.balance),
      icon: icons[accForm.type] || "💰",
      color: colors[accounts.length % colors.length],
    };
    const { data, error } = await supabase
      .from("accounts")
      .insert(newAcc)
      .select()
      .single();
    if (error) {
      showToast("Gagal menyimpan akun", "info");
      return;
    }
    setAccounts((p) => [...p, data]);
    setAccForm({ name: "", type: "bank", balance: "" });
    setShowAddAccount(false);
    showToast("Akun berhasil ditambahkan!");
  };

  // ── ADJUST BALANCE ───────────────────────────────────────
  const handleAdjustBalance = async (account, newBalance) => {
    const diff = newBalance - account.balance;
    if (diff === 0) return;
    const { data: updatedAcc, error: accErr } = await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", account.id)
      .select()
      .single();
    if (accErr) {
      showToast("Gagal update saldo", "info");
      return;
    }
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
    const { data: newTx } = await supabase
      .from("transactions")
      .insert(adjTx)
      .select()
      .single();
    setAccounts((p) => p.map((a) => (a.id === account.id ? updatedAcc : a)));
    if (newTx) setTransactions((p) => [newTx, ...p]);
    showToast(`Saldo ${account.name} diperbarui`);
  };

  // ── AI HANDLER ───────────────────────────────────────────
  const saveAiConfig = async (cfg) => {
    setAiConfig(cfg);
    setUserSettings((prev) => ({ ...(prev || {}), ai_config: cfg }));
    if (cfg?.apiKey) {
      localStorage.setItem("karaya_ai_config", JSON.stringify(cfg));
    } else {
      localStorage.removeItem("karaya_ai_config");
    }
    await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        ai_config: cfg,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  };

  const handleAi = async () => {
    if (!aiInput.trim() || aiTyping) return;
    if (!aiConfig?.apiKey) {
      setAiChat((p) => [
        ...p,
        {
          role: "error",
          text: "⚙️ API key belum diatur. Buka Settings → AI Coach untuk mengatur.",
        },
      ]);
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
        financialData: {
          accounts,
          transactions,
          goals,
          debts,
          investments,
          recurrings,
        },
        userName: userName.split(" ")[0],
        onThinking: (msg) =>
          setAiChat((p) => {
            const last = p[p.length - 1];
            if (last?.role === "thinking")
              return [...p.slice(0, -1), { role: "thinking", text: msg }];
            return [...p, { role: "thinking", text: msg }];
          }),
      });
      setAiChat((p) =>
        p
          .filter((m) => m.role !== "thinking")
          .concat({ role: "ai", text: reply }),
      );
    } catch (err) {
      setAiChat((p) =>
        p
          .filter((m) => m.role !== "thinking")
          .concat({ role: "error", text: `❌ ${err.message}` }),
      );
    } finally {
      setAiTyping(false);
    }
  };

  // ── Wrappers for hooks that need cross-entity access ─────
  const handleTopupGoal = (goalId, goal, amount, accountName) =>
    topupGoal(goalId, goal, amount, accountName, {
      setTransactions,
      setAccounts,
    });

  const handlePayDebt = (debt, amount, accountName) =>
    payDebt(debt, amount, accountName, {
      accounts,
      setAccounts,
      setTransactions,
    });

  const handleAddPiutang = (payload) =>
    addPiutang(payload, { accounts, setAccounts, setTransactions });

  const handleTerimaPiutang = (item, amount, accountName) =>
    terimaPiutang(item, amount, accountName, {
      accounts,
      setAccounts,
      setTransactions,
    });

  // ── RENDER ───────────────────────────────────────────────
  const activeLabel = t(NAV_LABELS[activeMenu] || "nav.dashboard");
  const sharedProps = {
    totalBalance,
    totalIncome,
    totalExpense,
    netBalance,
    savingRate,
    expenseRate,
    sortedCats,
    catTotals,
  };

  if (loading || session === undefined) {
    return <DashboardSkeleton />;
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg-app)",
        color: "var(--color-text)",
        fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif",
      }}
    >
      <Suspense fallback={null}>
        {showAddTx && (
          <AddTransactionModal
            open={showAddTx}
            onClose={() => setShowAddTx(false)}
            txForm={txForm}
            setTxForm={setTxForm}
            onSubmit={addTx}
            onTransfer={addTransfer}
            accounts={accounts}
            customCategories={customCategories}
            isSaving={isSavingTx}
            aiConfig={aiConfig}
            onSubmitMultiple={addMultipleTx}
            autoSelectAccount
          />
        )}
        {showEditTx && (
          <AddTransactionModal
            open={showEditTx}
            onClose={() => {
              setShowEditTx(false);
              setEditingTx(null);
            }}
            txForm={txForm}
            setTxForm={setTxForm}
            onSubmit={addTx}
            onTransfer={addTransfer}
            accounts={accounts}
            customCategories={customCategories}
            editMode={true}
            onUpdate={editTx}
            isSaving={isSavingTx}
            aiConfig={aiConfig}
          />
        )}
        {showAddAccount && (
          <AddAccountModal
            open={showAddAccount}
            onClose={() => setShowAddAccount(false)}
            accForm={accForm}
            setAccForm={setAccForm}
            onSubmit={addAccount}
          />
        )}
      </Suspense>
      <Sidebar
        open={sidebarOpen}
        activeMenu={activeMenu}
        setActiveMenu={(m) => {
          setActiveMenu(m);
          if (isMobile) setSidebarOpen(false);
        }}
        user={{ name: userName }}
        onAddTx={openAddTxModal}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
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
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            zIndex: 49,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <main
        style={{
          flex: 1,
          marginLeft: isMobile ? 0 : sidebarOpen ? 248 : 0,
          transition: "margin-left .35s cubic-bezier(.2,.8,.2,1)",
          minHeight: "100vh",
          minWidth: 0,
          width: "100%",
        }}
      >
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            padding: isMobile ? "10px 14px" : "14px 28px",
            background: "var(--glass-2, var(--bg-glass))",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
            borderBottom:
              "1px solid var(--glass-border, var(--color-border-soft))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
              flex: 1,
            }}
          >
            <button
              onClick={() => setSidebarOpen((p) => !p)}
              aria-label="Toggle sidebar"
              style={{
                background: "var(--color-border-soft)",
                border: "1px solid var(--glass-border)",
                color: "var(--color-muted)",
                width: 36,
                height: 36,
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 16,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ☰
            </button>
            <h1
              style={{
                fontSize: isMobile ? 16 : 19,
                fontWeight: 800,
                color: "var(--color-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-.02em",
                margin: 0,
                minWidth: 0,
              }}
            >
              {activeLabel}
            </h1>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 6 : 10,
              flexShrink: 0,
            }}
          >
            <button
              onClick={openAddTxModal}
              style={{
                padding: isMobile ? "8px 14px" : "9px 18px",
                borderRadius: 9999,
                border: "none",
                background:
                  "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))",
                color: "var(--color-on-primary)",
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                letterSpacing: "-.01em",
                boxShadow:
                  "0 4px 14px rgba(96,252,198,.2), inset 0 1px 0 rgba(255,255,255,.25)",
              }}
            >
              + {isMobile ? "Tx" : t("nav.transaction")}
            </button>
            {!isMobile && (
              <button
                onClick={onLogout}
                style={{
                  padding: "9px 16px",
                  borderRadius: 9999,
                  background: "rgba(255,113,108,.08)",
                  border: "1px solid rgba(255,113,108,.18)",
                  color: "#ff716c",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("common.logout")}
              </button>
            )}
            {isMobile && (
              <button
                onClick={onLogout}
                aria-label="Logout"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(255,113,108,.08)",
                  border: "1px solid rgba(255,113,108,.18)",
                  color: "#ff716c",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </header>

        <div
          style={{
            padding: isMobile
              ? "14px 12px calc(20px + env(safe-area-inset-bottom))"
              : "28px",
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          <Suspense fallback={<BentoSkeleton />}>
            {activeMenu === "dasbor" && (
              <DasborView
                accounts={accounts}
                transactions={transactions}
                goals={goals}
                investments={investments}
                debts={debts}
                budgets={budgets}
                setActiveMenu={setActiveMenu}
                setShowAddAccount={setShowAddAccount}
                setShowAddTx={openAddTxModal}
                customCategories={customCategories}
                {...sharedProps}
              />
            )}
            {activeMenu === "transaksi" && (
              <TransaksiView
                transactions={transactions}
                onEdit={openEditTx}
                onDelete={deleteTx}
                accounts={accounts}
                initialCategory={initialCategoryFilter}
                onClearInitialCategory={() => setInitialCategoryFilter("")}
                initialAccount={initialAccountFilter}
                onClearInitialAccount={() => setInitialAccountFilter("")}
              />
            )}
            {activeMenu === "akun" && (
              <AkunView
                accounts={accounts}
                transactions={transactions}
                setShowAddAccount={setShowAddAccount}
                setActiveMenu={setActiveMenu}
                onAdjustBalance={handleAdjustBalance}
                onViewAccount={(accName) => {
                  setInitialAccountFilter(accName);
                  setActiveMenu("transaksi");
                }}
              />
            )}
            {activeMenu === "kategori" && (
              <KategoriView
                transactions={transactions}
                customCategories={customCategories}
                onAddCategory={addCategory}
                onEditCategory={editCategory}
                onDeleteCategory={deleteCategory}
                onViewCategory={(catName) => {
                  setInitialCategoryFilter(catName);
                  setActiveMenu("transaksi");
                }}
              />
            )}
            {activeMenu === "berulang" && (
              <BerulangView
                recurrings={recurrings}
                accounts={accounts}
                debts={debts}
                onAdd={addRecurring}
                onEdit={editRecurring}
                onDelete={deleteRecurring}
                customCategories={customCategories}
              />
            )}
            {activeMenu === "goals" && (
              <GoalsView
                goals={goals}
                accounts={accounts}
                onAdd={addGoal}
                onEdit={editGoal}
                onDelete={deleteGoal}
                onTopup={handleTopupGoal}
              />
            )}
            {activeMenu === "hutang" && (
              <HutangView
                debts={debts}
                onAdd={addDebt}
                onEdit={editDebt}
                onDelete={deleteDebt}
                onPayDebt={handlePayDebt}
                accounts={accounts}
              />
            )}
            {activeMenu === "piutang" && (
              <PiutangView
                piutang={piutang}
                onAdd={handleAddPiutang}
                onEdit={editPiutang}
                onDelete={deletePiutang}
                onTerima={handleTerimaPiutang}
                accounts={accounts}
              />
            )}
            {activeMenu === "investasi" && (
              <InvestasiView
                investments={investments}
                onAdd={addInvestment}
                onEdit={editInvestment}
                onDelete={deleteInvestment}
                goldPrices={goldPrices}
                onRefreshGold={refreshGoldPrices}
                refreshingGold={refreshingGold}
              />
            )}
            {activeMenu === "anggaran" && (
              <AnggaranView
                budgets={budgets}
                transactions={transactions}
                onAdd={addBudget}
                onEdit={editBudget}
                onDelete={deleteBudget}
                onCopyMonth={copyBudgetMonth}
                customCategories={customCategories}
              />
            )}
            {activeMenu === "laporan" && (
              <LaporanView transactions={transactions} />
            )}
            {activeMenu === "ai" && (
              <AiView
                aiChat={aiChat}
                aiTyping={aiTyping}
                aiInput={aiInput}
                setAiInput={setAiInput}
                handleAi={handleAi}
                aiConfig={aiConfig}
                onOpenAiSettings={() => {
                  setSidebarOpen(true);
                  setAiSettingsTrigger((p) => p + 1);
                }}
              />
            )}
            {activeMenu === "splitbill" && (
              <SplitBillView
                splitBills={splitBills}
                onAdd={addSplitBill}
                onDelete={deleteSplitBill}
                onTogglePaid={toggleMemberPaid}
              />
            )}
            {activeMenu === "prediksi" && (
              <PrediksiView
                transactions={transactions}
                budgets={budgets}
                accounts={accounts}
              />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
