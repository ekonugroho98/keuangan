import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchGoldPrices } from "../services/goldPrice";
import { APP_AI_NAME } from "../config/app";
import { api, unwrap } from "../api/client";
import Sidebar from "../components/dashboard/Sidebar";
import AiFloatingChat from "../components/dashboard/AiFloatingChat";
import { exportTransactionsCSV, exportTransactionsExcel } from "../utils/exportData";
import { useLanguage } from "../i18n/LanguageContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAccounts } from "../hooks/useAccounts";
import { useTransactions } from "../hooks/useTransactions";
import { useTransfers } from "../hooks/useTransfers";
import { useCategories } from "../hooks/useCategories";
import { useInvestments } from "../hooks/useInvestments";
import { useBudgets } from "../hooks/useBudgets";
import { useGoals } from "../hooks/useGoals";
import { useDebts } from "../hooks/useDebts";
import { usePiutang } from "../hooks/usePiutang";
import { useRecurrings } from "../hooks/useRecurrings";
import { useSplitBills } from "../hooks/useSplitBills";
import { useSettings } from "../hooks/useSettings";
import { useHouseholdInfo } from "../hooks/useHouseholdInfo";
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
// F-D (10-fitur-opsional-keluarga.md §6): hanya di-load kalau household menyalakan
// features.shopping_stock (Sidebar.jsx menyembunyikan menunya kalau mati) — lazy import tetap
// aman diimpor di sini walau tidak pernah dirender.
const BelanjaView = lazy(
  () => import("../components/dashboard/views/BelanjaView"),
);
const PantryView = lazy(
  () => import("../components/dashboard/views/PantryView"),
);
const ReconciliationView = lazy(
  () => import("../components/dashboard/views/ReconciliationView"),
);
const AdminView = lazy(
  () => import("../components/dashboard/views/AdminView"),
);
const AddTransactionModal = lazy(
  () => import("../components/dashboard/AddTransactionModal"),
);
const AddAccountModal = lazy(
  () => import("../components/dashboard/AddAccountModal"),
);
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
  piutang: "nav.piutang",
  investasi: "nav.investments",
  anggaran: "nav.budgets",
  laporan: "nav.reports",
  ai: "nav.ai",
  splitbill: "nav.splitbill",
  prediksi: "nav.prediksi",
  belanja: "nav.shopping",
  pantry: "nav.pantry",
  rekonsiliasi: "nav.reconciliation",
  admin: "nav.admin",
};

const Dashboard = ({ session, onLogout, showToast }) => {
  const { t, lang } = useLanguage();
  const isMobile = useIsMobile();
  const user = session.user;
  const [userName, setUserName] = useState(
    user.user_metadata?.full_name || user.email.split("@")[0],
  );

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [activeMenu, setActiveMenu] = useState(() =>
    window.location.pathname === "/admin" || window.location.hash === "#admin"
      ? "admin"
      : window.location.hash === "#ai"
        ? "ai"
        : "dasbor",
  );
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === "#admin") setActiveMenu("admin");
      if (window.location.hash === "#ai") setActiveMenu("ai");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
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
    category: "Bahan Makanan",
    note: "",
    account: "",
    toAccount: "",
    date: toLocalDateStr(),
    beneficiary: "", // F-A (10-fitur-opsional-keluarga.md §3) — "" = Bersama, hanya terpakai kalau feature aktif
  });
  const [accForm, setAccForm] = useState({
    name: "",
    type: "bank",
    balance: "",
    owner: "me",
    visibility: "shared",
    aliases: [],
  });

  // ── Household & domain hooks (apps/api, 07-frontend.md §3) ─────────────
  const { accounts, accountsLoading, addAccount, adjustBalance } = useAccounts();
  const { transactions, transactionsLoading, addTx, addMultipleTx, editTx: editTxApi, deleteTx: deleteTxApi } = useTransactions();
  const { addTransfer: addTransferApi } = useTransfers();
  const { customCategories, allCategoriesFromApi, addCategory, editCategory, deleteCategory } = useCategories();
  const defaultExpenseCat =
    allCategoriesFromApi.find((c) => !c.is_system && c.type !== "income")?.name || "Bahan Makanan";

  // Reset form & auto-select akun + kategori pertama saat modal tambah dibuka (cegah state bocor dari openEditTx)
  const openAddTxModal = () => {
    setTxForm({
      type: "expense",
      amount: "",
      category: defaultExpenseCat,
      note: "",
      account: accounts[0]?.name || "",
      toAccount: "",
      date: toLocalDateStr(),
      beneficiary: "",
      receipt_url: "",
    });
    setShowAddTx(true);
  };
  const { investments, addInvestment, editInvestment, deleteInvestment } = useInvestments();
  const { budgets, personalBudgets, addBudget, editBudget, deleteBudget, copyBudgetMonth } = useBudgets();
  const { goals, addGoal, editGoal, deleteGoal, topupGoal } = useGoals();
  const { debts, addDebt, editDebt, deleteDebt, payDebt } = useDebts();
  const { piutang, addPiutang, editPiutang, deletePiutang, terimaPiutang } = usePiutang();
  const { recurrings, addRecurring, editRecurring, deleteRecurring, runDueRecurrings } = useRecurrings();
  const { splitBills, addSplitBill, deleteSplitBill, toggleMemberPaid } = useSplitBills();
  const { userSettings, aiConfig, saveSettings, saveAiConfig } = useSettings();
  const { household } = useHouseholdInfo(); // F-0/F-A: gate field "Untuk" dari features.beneficiary.enabled + plan
  const beneficiaryEnabled =
    !!household?.features?.beneficiary?.enabled &&
    household?.plan?.entitlements?.beneficiary !== false;

  // Selalu gunakan Asisten AI resmi Keluarga Berkembang (Gatekeeper).
  // Aktif otomatis bila user punya key sk-kb- ATAU paket keluarga berstatus Pro / Lifetime.
  const isPlanAiActive =
    Boolean(household?.plan?.is_active) ||
    household?.plan_tier === "pro" ||
    household?.plan_tier === "lifetime";
  const effectiveAiConfig = useMemo(() => {
    const rawKey = (aiConfig?.apiKey || "").trim();
    const hasKbKey = rawKey.startsWith("sk-kb-");
    return {
      provider: "gatekeeper",
      model: "kb-auto",
      apiKey: hasKbKey ? rawKey : isPlanAiActive ? "sk-kb-managed" : "",
      disabled: false,
    };
  }, [aiConfig?.apiKey, isPlanAiActive]);

  const loading = accountsLoading || transactionsLoading;

  // Fallback eksekusi recurring jatuh tempo (pg_cron belum aktif sampai Fase 5, F5-T7)
  useEffect(() => {
    runDueRecurrings()
      .then((result) => {
        if (result.executed > 0) {
          showToast(`🔄 ${result.executed} transaksi berulang dijalankan otomatis!`);
        }
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.warn("run recurrings:", e.message);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 1-Click Zero-Setup AI Key Activation (?ai_key=sk-kb-... dari @KelolaKeluargaBot)
  useEffect(() => {
    try {
      const pendingKey = (sessionStorage.getItem("kb_pending_ai_key") || "").trim();
      if (pendingKey.startsWith("sk-kb-")) {
        sessionStorage.removeItem("kb_pending_ai_key");
        saveAiConfig({
          provider: "gatekeeper",
          model: "kb-auto",
          apiKey: pendingKey,
          disabled: false,
        })
          .then(() => {
            showToast("🎉 Paket Asisten AI Keluarga Berkembang aktif! Siap scan struk & chat 24 jam.");
            setActiveMenu("ai");
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const queryClient = useQueryClient();
  const [showAiChat, setShowAiChat] = useState(false);

  // Android hardware Back button handler (tutup modal → tutup drawer → kembali ke Dasbor)
  useEffect(() => {
    window.__handleAndroidBack = () => {
      if (showAiChat) {
        setShowAiChat(false);
        return "handled";
      }
      if (showAddTx) {
        setShowAddTx(false);
        return "handled";
      }
      if (showEditTx) {
        setShowEditTx(false);
        setEditingTx(null);
        return "handled";
      }
      if (showAddAccount) {
        setShowAddAccount(false);
        return "handled";
      }
      if (isMobile && sidebarOpen) {
        setSidebarOpen(false);
        return "handled";
      }
      if (activeMenu !== "dasbor") {
        setActiveMenu("dasbor");
        return "handled";
      }
      return "exit";
    };
    return () => {
      delete window.__handleAndroidBack;
    };
  }, [showAiChat, showAddTx, showEditTx, showAddAccount, isMobile, sidebarOpen, activeMenu]);

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

  // ── GOLD PRICES (layanan eksternal, bukan Supabase/apps-api) ─────────────
  const [goldPrices, setGoldPrices] = useState(null);
  const [refreshingGold, setRefreshingGold] = useState(false);
  const [aiSettingsTrigger, setAiSettingsTrigger] = useState(0);

  useEffect(() => {
    loadGoldPrices();
  }, []);

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

  // ── PROFILE HANDLERS (tetap lewat Supabase Auth langsung — bukan tabel domain) ──
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
    exportTransactionsCSV(transactions, { periodLabel: "Semua Transaksi" });
    showToast(`✅ ${transactions.length} transaksi berhasil diekspor ke CSV`);
  };

  const exportExcel = () => {
    exportTransactionsExcel(transactions, {
      periodLabel: "Semua Transaksi",
      accounts,
    });
    showToast(`✅ ${transactions.length} transaksi berhasil diekspor ke Excel (.xlsx)`);
  };

  const deleteAccount = async () => {
    showToast("Menghapus akun...", "info");
    try {
      await unwrap(await api.DELETE("/v1/me"));
      await supabase.auth.signOut();
      onLogout();
    } catch (err) {
      showToast(err.message || "Gagal menghapus akun", "error");
    }
  };

  // ── COMPUTED VALUES ──────────────────────────────────────
  const totalBalance = accounts.reduce((a, b) => a + (b.balance || 0), 0);
  const totalIncome = transactions
    .filter((t) => t.type === "income" && t.category !== "Piutang")
    .reduce((a, t) => a + t.amount, 0);
  const totalPiutangOffset = transactions
    .filter((t) => t.type === "income" && t.category === "Piutang")
    .reduce((a, t) => a + t.amount, 0);
  const totalExpense = Math.max(
    0,
    transactions
      .filter((t) => t.type === "expense")
      .reduce((a, t) => a + t.amount, 0) - totalPiutangOffset,
  );
  const netBalance = totalIncome - totalExpense;
  const savingRate =
    totalIncome > 0 ? Math.round((1 - totalExpense / totalIncome) * 100) : 0;
  const expenseRate =
    totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

  const catTotals = {};
  transactions.forEach((t) => {
    if (t.type === "expense" && t.category && t.category !== "Piutang") {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    }
  });
  const sortedCats = Object.entries(catTotals)
    .filter(([, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);

  // ── TRANSAKSI (POST /v1/transactions, apps/api) ──────────────────────────
  const addTx_ = async () => {
    if (!txForm.amount || isSavingTx) return;
    const accountName = txForm.account || accounts[0]?.name || "";
    if (!accountName) { showToast("Pilih akun terlebih dahulu", "error"); return; }

    setIsSavingTx(true);
    try {
      await addTx({
        type: txForm.type,
        amount: parseInt(txForm.amount),
        category: txForm.category,
        note: txForm.note || txForm.category,
        date: txForm.date || toLocalDateStr(),
        account: accountName,
        ...(txForm.receipt_url ? { receipt_url: txForm.receipt_url } : {}),
        // Gate dengan beneficiaryEnabled (bukan selalu kirim txForm.beneficiary) — review 2026-10-07:
        // kalau user sempat pilih chip beneficiary lalu fiturnya dimatikan dari sesi lain SEBELUM
        // submit, txForm.beneficiary masih terisi walau pickernya sudah hilang dari layar; tanpa
        // gate ini nilai lama tetap terkirim dan ditolak backend (400) alih-alih diam-diam dibuang.
        ...(beneficiaryEnabled ? { beneficiary: txForm.beneficiary } : {}),
      });
      setTxForm({ type: "expense", amount: "", category: defaultExpenseCat, note: "", account: accounts[0]?.name ?? "", toAccount: "", date: toLocalDateStr(), beneficiary: "", receipt_url: "" });
      setShowAddTx(false);
      showToast("Transaksi berhasil ditambahkan!");
    } catch (err) {
      showToast(err.message || "Gagal menyimpan transaksi", "error");
    } finally {
      setIsSavingTx(false);
    }
  };

  const addMultipleTx_ = async (items, accountName, date, receiptUrl) => {
    if (!items.length || isSavingTx) return;
    if (!accountName) { showToast("Pilih akun terlebih dahulu", "error"); return; }

    setIsSavingTx(true);
    try {
      const result = await addMultipleTx(items, accountName, date || toLocalDateStr(), receiptUrl);
      setShowAddTx(false);
      showToast(`${result.transactions.length} transaksi berhasil disimpan!`);
    } catch (err) {
      showToast(err.message || "Gagal menyimpan transaksi", "error");
    } finally {
      setIsSavingTx(false);
    }
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
      toAccount: tx.to_account_name || "",
      date: tx.date || toLocalDateStr(),
      beneficiary: tx.beneficiary || "",
      receipt_url: tx.receipt_url || "",
    });
    setShowEditTx(true);
  };

  const editTx_ = async () => {
    if (!editingTx || isSavingTx) return;
    const newAmount = parseInt(txForm.amount);
    if (!newAmount && editingTx.type !== "transfer") return;

    setIsSavingTx(true);
    try {
      if (editingTx.type === "transfer") {
        await editTxApi(editingTx.id, {
          note: txForm.note ?? "",
          date: txForm.date || editingTx.date,
          receipt_url: txForm.receipt_url || null,
        });
      } else {
        await editTxApi(editingTx.id, {
          type: txForm.type,
          amount: newAmount,
          category: txForm.category,
          note: txForm.note || txForm.category,
          date: txForm.date || editingTx.date,
          account: txForm.account || editingTx.account_name,
          receipt_url: txForm.receipt_url || null,
          // Hanya ikut kalau fitur aktif — lihat catatan panjang di editTx (useTransactions.js) soal
          // kenapa "" di sini beda arti dari key yang tidak ada sama sekali.
          ...(beneficiaryEnabled ? { beneficiary: txForm.beneficiary } : {}),
        });
      }
      setShowEditTx(false);
      setEditingTx(null);
      showToast("Transaksi berhasil diperbarui");
    } catch (err) {
      showToast(err.message || "Gagal mengubah transaksi", "error");
    } finally {
      setIsSavingTx(false);
    }
  };

  // ── DELETE TRANSAKSI ──────────────────────────────────────
  const deleteTx_ = async (tx) => {
    try {
      await deleteTxApi(tx.id);
      showToast("Transaksi dihapus", "info");
    } catch (err) {
      showToast(err.message || "Gagal menghapus transaksi", "error");
    }
  };

  // ── TRANSFER DANA (POST /v1/transfers) ────────────────────────────────
  const addTransfer_ = async () => {
    const amount = parseInt(txForm.amount);
    if (!amount || !txForm.account || !txForm.toAccount || txForm.account === txForm.toAccount || isSavingTx) return;

    setIsSavingTx(true);
    try {
      await addTransferApi({
        amount,
        from_account: txForm.account,
        to_account: txForm.toAccount,
        date: txForm.date || toLocalDateStr(),
        note: txForm.note || `Transfer ${txForm.account} → ${txForm.toAccount}`,
        ...(txForm.receipt_url ? { receipt_url: txForm.receipt_url } : {}),
      });
      setTxForm({ type: "expense", amount: "", category: defaultExpenseCat, note: "", account: accounts[0]?.name ?? "", toAccount: "", date: toLocalDateStr(), beneficiary: "", receipt_url: "" });
      setShowAddTx(false);
      showToast(`Transfer Rp ${amount.toLocaleString("id-ID")} berhasil!`);
    } catch (err) {
      showToast(err.message || "Gagal transfer", "error");
    } finally {
      setIsSavingTx(false);
    }
  };

  // ── ADD ACCOUNT (POST /v1/accounts) ─────────────────────
  const addAccount_ = async () => {
    if (!accForm.name || !accForm.balance) return;
    try {
      await addAccount(accForm);
      setAccForm({ name: "", type: "bank", balance: "", owner: "me", visibility: "shared", aliases: [] });
      setShowAddAccount(false);
      showToast("Akun berhasil ditambahkan!");
    } catch (err) {
      showToast(err.message || "Gagal menyimpan akun", "error");
    }
  };

  // ── ADJUST BALANCE ───────────────────────────────────────
  const handleAdjustBalance = async (account, newBalance) => {
    if (newBalance === account.balance) return;
    try {
      await adjustBalance(account.id, newBalance);
      showToast(`Saldo ${account.name} diperbarui`);
    } catch (err) {
      showToast(err.message || "Gagal update saldo", "error");
    }
  };

  // ── AI CHAT (POST /v1/ai/chat — API key dibaca server-side, 05-api.md) ───
  const handleAi = async (overridePrompt) => {
    const rawMsg = typeof overridePrompt === "string" ? overridePrompt : aiInput;
    const userMsg = rawMsg.trim();
    if (!userMsg || aiTyping) return;
    if (!effectiveAiConfig?.apiKey || effectiveAiConfig?.disabled) {
      setAiChat((p) => [
        ...p,
        { role: "error", text: "Paket Asisten AI belum aktif. Silakan aktifkan Paket Asisten AI Keluarga Berkembang terlebih dahulu." },
      ]);
      return;
    }
    const updatedChat = [...aiChat, { role: "user", text: userMsg }];
    setAiChat(updatedChat);
    if (typeof overridePrompt !== "string") setAiInput("");
    setAiTyping(true);
    try {
      const result = await unwrap(
        await api.POST("/v1/ai/chat", {
          body: {
            messages: updatedChat.filter((m) => m.role === "user" || m.role === "ai"),
            allow_write: true,
          },
        }),
      );
      setAiChat((p) =>
        p.filter((m) => m.role !== "thinking").concat({ role: "ai", text: result.reply }),
      );
      // Hanya segarkan data dasbor bila AI benar-benar mengeksekusi tool tulis (catat transaksi, belanja, stok kulkas, dll.)
      if (result?.mutated) {
        queryClient.invalidateQueries();
      }
    } catch (err) {
      setAiChat((p) =>
        p.filter((m) => m.role !== "thinking").concat({ role: "error", text: err.message }),
      );
    } finally {
      setAiTyping(false);
    }
  };

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
            onSubmit={addTx_}
            onTransfer={addTransfer_}
            accounts={accounts}
            customCategories={customCategories}
            isSaving={isSavingTx}
            aiConfig={effectiveAiConfig}
            onSubmitMultiple={addMultipleTx_}
            autoSelectAccount
            beneficiaryEnabled={beneficiaryEnabled}
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
            onSubmit={addTx_}
            onTransfer={addTransfer_}
            accounts={accounts}
            customCategories={customCategories}
            editMode={true}
            onUpdate={editTx_}
            isSaving={isSavingTx}
            aiConfig={effectiveAiConfig}
            beneficiaryEnabled={beneficiaryEnabled}
          />
        )}
        {showAddAccount && (
          <AddAccountModal
            open={showAddAccount}
            onClose={() => setShowAddAccount(false)}
            accForm={accForm}
            setAccForm={setAccForm}
            onSubmit={addAccount_}
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
        onExportExcel={exportExcel}
        txCount={transactions.length}
        onDeleteAccount={deleteAccount}
        userSettings={userSettings}
        onSaveSettings={saveSettings}
        aiConfig={aiConfig}
        onSaveAiConfig={saveAiConfig}
        aiSettingsTrigger={aiSettingsTrigger}
        showToast={showToast}
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
          marginLeft: isMobile ? 0 : sidebarOpen ? 256 : 0,
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
                background: "linear-gradient(135deg, #B06443, #965032)",
                color: "#FAF5EA",
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Fredoka', inherit",
                whiteSpace: "nowrap",
                letterSpacing: ".01em",
                boxShadow:
                  "0 4px 14px rgba(176,100,67,.26), inset 0 1px 0 rgba(255,255,255,.25)",
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
                  background: "var(--color-expense-soft)",
                  border: "1px solid rgba(176,100,67,.24)",
                  color: "var(--color-expense)",
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
                  background: "var(--color-expense-soft)",
                  border: "1px solid rgba(176,100,67,.24)",
                  color: "var(--color-expense)",
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
                onDelete={deleteTx_}
                accounts={accounts}
                initialCategory={initialCategoryFilter}
                onClearInitialCategory={() => setInitialCategoryFilter("")}
                initialAccount={initialAccountFilter}
                onClearInitialAccount={() => setInitialAccountFilter("")}
                beneficiaryEnabled={beneficiaryEnabled}
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
                allCategoriesFromApi={allCategoriesFromApi}
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
                allCategoriesFromApi={allCategoriesFromApi}
              />
            )}
            {activeMenu === "goals" && (
              <GoalsView
                goals={goals}
                accounts={accounts}
                onAdd={addGoal}
                onEdit={editGoal}
                onDelete={deleteGoal}
                onTopup={topupGoal}
              />
            )}
            {activeMenu === "hutang" && (
              <HutangView
                debts={debts}
                onAdd={addDebt}
                onEdit={editDebt}
                onDelete={deleteDebt}
                onPayDebt={payDebt}
                accounts={accounts}
              />
            )}
            {activeMenu === "piutang" && (
              <PiutangView
                piutang={piutang}
                onAdd={addPiutang}
                onEdit={editPiutang}
                onDelete={deletePiutang}
                onTerima={terimaPiutang}
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
                personalBudgets={personalBudgets}
                transactions={transactions}
                accounts={accounts}
                onAdd={addBudget}
                onEdit={editBudget}
                onDelete={deleteBudget}
                onCopyMonth={copyBudgetMonth}
                customCategories={customCategories}
                allCategoriesFromApi={allCategoriesFromApi}
              />
            )}
            {activeMenu === "laporan" && (
              <LaporanView transactions={transactions} accounts={accounts} budgets={budgets} personalBudgets={personalBudgets} />
            )}
            {activeMenu === "ai" && (
              <AiView
                aiChat={aiChat}
                aiTyping={aiTyping}
                aiInput={aiInput}
                setAiInput={setAiInput}
                handleAi={handleAi}
                aiConfig={effectiveAiConfig}
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
                personalBudgets={personalBudgets}
                accounts={accounts}
              />
            )}
            {activeMenu === "belanja" && <BelanjaView showToast={showToast} setActiveMenu={setActiveMenu} />}
            {activeMenu === "pantry" && <PantryView showToast={showToast} setActiveMenu={setActiveMenu} />}
            {activeMenu === "rekonsiliasi" && (
              <ReconciliationView
                accounts={accounts}
                categories={categories}
                onAdjustAccountBalance={adjustBalance}
                showToast={showToast}
              />
            )}
            {activeMenu === "admin" && <AdminView showToast={showToast} />}
          </Suspense>
        </div>
      </main>

      <AiFloatingChat
        open={showAiChat}
        setOpen={setShowAiChat}
        aiChat={aiChat}
        aiTyping={aiTyping}
        aiInput={aiInput}
        setAiInput={setAiInput}
        handleAi={handleAi}
        onResetChat={() => setAiChat(makeGreeting())}
        aiConfig={effectiveAiConfig}
        activeMenu={activeMenu}
      />
    </div>
  );
};

export default Dashboard;
