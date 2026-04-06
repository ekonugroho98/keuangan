import { useState } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { fmtRp, fmtDate } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

const MONTHS_ID = [
    { v: "01", l: "Januari" }, { v: "02", l: "Februari" }, { v: "03", l: "Maret" },
    { v: "04", l: "April" },   { v: "05", l: "Mei" },      { v: "06", l: "Juni" },
    { v: "07", l: "Juli" },    { v: "08", l: "Agustus" },  { v: "09", l: "September" },
    { v: "10", l: "Oktober" }, { v: "11", l: "November" }, { v: "12", l: "Desember" },
];

const MONTHS_LOCALIZED = {
    id: MONTHS_ID,
    en: [
        { v: "01", l: "January" }, { v: "02", l: "February" }, { v: "03", l: "March" },
        { v: "04", l: "April" },   { v: "05", l: "May" },      { v: "06", l: "June" },
        { v: "07", l: "July" },    { v: "08", l: "August" },   { v: "09", l: "September" },
        { v: "10", l: "October" }, { v: "11", l: "November" }, { v: "12", l: "December" },
    ],
    ar: [
        { v: "01", l: "يناير" }, { v: "02", l: "فبراير" }, { v: "03", l: "مارس" },
        { v: "04", l: "أبريل" }, { v: "05", l: "مايو" },   { v: "06", l: "يونيو" },
        { v: "07", l: "يوليو" }, { v: "08", l: "أغسطس" },  { v: "09", l: "سبتمبر" },
        { v: "10", l: "أكتوبر" },{ v: "11", l: "نوفمبر" }, { v: "12", l: "ديسمبر" },
    ],
    es: [
        { v: "01", l: "Enero" },   { v: "02", l: "Febrero" },  { v: "03", l: "Marzo" },
        { v: "04", l: "Abril" },   { v: "05", l: "Mayo" },     { v: "06", l: "Junio" },
        { v: "07", l: "Julio" },   { v: "08", l: "Agosto" },   { v: "09", l: "Septiembre" },
        { v: "10", l: "Octubre" }, { v: "11", l: "Noviembre" },{ v: "12", l: "Diciembre" },
    ],
    zh: [
        { v: "01", l: "一月" }, { v: "02", l: "二月" }, { v: "03", l: "三月" },
        { v: "04", l: "四月" }, { v: "05", l: "五月" }, { v: "06", l: "六月" },
        { v: "07", l: "七月" }, { v: "08", l: "八月" }, { v: "09", l: "九月" },
        { v: "10", l: "十月" }, { v: "11", l: "十一月" },{ v: "12", l: "十二月" },
    ],
    ja: [
        { v: "01", l: "1月" }, { v: "02", l: "2月" }, { v: "03", l: "3月" },
        { v: "04", l: "4月" }, { v: "05", l: "5月" }, { v: "06", l: "6月" },
        { v: "07", l: "7月" }, { v: "08", l: "8月" }, { v: "09", l: "9月" },
        { v: "10", l: "10月"},  { v: "11", l: "11月"}, { v: "12", l: "12月"},
    ],
};

const MONTH_NAMES_ID  = ["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MONTH_NAMES_EN  = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NAMES_MAP = { id: MONTH_NAMES_ID, en: MONTH_NAMES_EN };

const TransaksiView = ({ transactions, onEdit, onDelete, accounts = [] }) => {
    const { t, lang } = useLanguage();
    const isMobile = useIsMobile();
    const MONTHS = MONTHS_LOCALIZED[lang] || MONTHS_ID;
    const tCat = (name) => { const k = "cat.name." + name; const v = t(k); return v === k ? name : v; };

    const now = new Date();
    const [filterYear,    setFilterYear]    = useState(String(now.getFullYear()));
    const [filterMonth,   setFilterMonth]   = useState(String(now.getMonth() + 1).padStart(2, "0"));
    const [filterDate,    setFilterDate]    = useState("");
    const [filterType,    setFilterType]    = useState("all");
    const [filterAccount, setFilterAccount] = useState("");
    const [search,        setSearch]        = useState("");
    const [hoveredId,     setHoveredId]     = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const years = [...new Set(transactions.map(tx => tx.date?.slice(0, 4)).filter(Boolean))].sort().reverse();

    /* --- filtered by date/year/month --- */
    const byDate = transactions.filter(tx => {
        if (filterDate)  return tx.date === filterDate;
        if (filterYear  && tx.date?.slice(0, 4) !== filterYear)  return false;
        if (filterMonth && tx.date?.slice(5, 7) !== filterMonth) return false;
        return true;
    });

    // Helper: apakah transaksi melibatkan akun ini (baik sebagai sumber maupun tujuan transfer)
    const involvesAccount = (tx, acc) => {
        if (!acc) return true;
        if (tx.account_name === acc) return true;
        if (tx.type === "transfer" && tx.to_account === acc) return true;
        return false;
    };

    // Terapkan filter akun ke summary (termasuk transfer masuk ke akun)
    const byDateAndAccount = filterAccount
        ? byDate.filter(tx => involvesAccount(tx, filterAccount))
        : byDate;

    const sumIn       = byDateAndAccount.filter(tx => tx.type === "income" ).reduce((a, tx) => a + tx.amount, 0);
    const sumOut      = byDateAndAccount.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const sumTransfer = byDateAndAccount.filter(tx => tx.type === "transfer").reduce((a, tx) => a + tx.amount, 0);
    // Transfer masuk ke akun ini
    const sumTransferIn  = filterAccount
        ? byDateAndAccount.filter(tx => tx.type === "transfer" && tx.to_account === filterAccount).reduce((a, tx) => a + tx.amount, 0)
        : 0;
    // Transfer keluar dari akun ini
    const sumTransferOut = filterAccount
        ? byDateAndAccount.filter(tx => tx.type === "transfer" && tx.account_name === filterAccount).reduce((a, tx) => a + tx.amount, 0)
        : 0;
    // Bersih:
    // - Tanpa filter akun → income − expense (transfer netral di level portfolio)
    // - Dengan filter akun → income − expense + transferIn − transferOut
    //   (transfer nyata mempengaruhi saldo akun tersebut)
    const net = filterAccount
        ? sumIn - sumOut + sumTransferIn - sumTransferOut
        : sumIn - sumOut;

    // Data akun yang sedang difilter
    const activeAccount = filterAccount ? accounts.find(a => a.name === filterAccount) : null;

    /* --- further filtered by type + account + search --- */
    const filtered = byDate.filter(tx => {
        if (filterType !== "all" && tx.type !== filterType) return false;
        if (filterAccount && !involvesAccount(tx, filterAccount)) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                tx.note?.toLowerCase().includes(q) ||
                tx.category?.toLowerCase().includes(q) ||
                tx.account_name?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const handleReset = () => {
        setFilterYear(String(now.getFullYear()));
        setFilterMonth(String(now.getMonth() + 1).padStart(2, "0"));
        setFilterDate("");
        setSearch("");
        setFilterType("all");
        setFilterAccount("");
    };

    /* periode label */
    const monthNames = MONTH_NAMES_MAP[lang] || MONTH_NAMES_ID;
    const periodLabel = filterDate
        ? fmtDate(filterDate)
        : filterMonth && filterYear
            ? `${monthNames[parseInt(filterMonth)] || filterMonth} ${filterYear}`
            : filterYear || "Semua Periode";

    const TYPE_TABS = [
        { id: "all",      label: t("tx.all")      || "Semua"       },
        { id: "income",   label: t("tx.income")   || "Pemasukan"   },
        { id: "expense",  label: t("tx.expense")  || "Pengeluaran" },
        { id: "transfer", label: t("tx.transfer") || "Transfer"    },
    ];

    const typeMeta = (type) => {
        if (type === "income")   return { badgeBg: "rgba(96,252,198,.12)",  badgeColor: "var(--color-primary)", iconBg: "rgba(96,252,198,.1)",  amtColor: "var(--color-primary)", sign: "+"  };
        if (type === "transfer") return { badgeBg: "rgba(79,195,247,.12)",  badgeColor: "#4FC3F7", iconBg: "rgba(79,195,247,.1)",  amtColor: "#4FC3F7", sign: "↔ " }; // netral — bukan minus
        return                          { badgeBg: "rgba(255,113,108,.12)", badgeColor: "#ff716c", iconBg: "rgba(255,113,108,.1)", amtColor: "#ff716c", sign: "-"  };
    };

    const typeText = (type) => {
        if (type === "income")   return t("tx.income")   || "Pemasukan";
        if (type === "transfer") return t("tx.transfer") || "Transfer";
        return t("tx.expense") || "Pengeluaran";
    };

    return (
        <div style={{ animation: "fadeIn .4s", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Confirm Delete Modal ── */}
            {confirmDelete && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)" }}>
                    <div style={{ background: "var(--bg-surface-low)", border: "1px solid rgba(255,113,108,.3)", borderRadius: 18, padding: "28px 24px", maxWidth: 340, width: "90%", textAlign: "center", animation: "scaleIn .2s" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>{t("tx.deleteTitle") || "Hapus Transaksi?"}</h3>
                        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                            <strong style={{ color: "var(--color-text)" }}>{confirmDelete.note}</strong>
                        </p>
                        <p style={{ fontSize: 12, color: "var(--color-subtle)", marginBottom: 24 }}>
                            {t("tx.deleteDesc") || "Saldo akun"} <strong style={{ color: "#94a3b8" }}>{confirmDelete.account_name}</strong> {t("tx.deleteDescSuffix") || "akan otomatis dikembalikan."}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                {t("common.cancel") || "Batal"}
                            </button>
                            <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "var(--color-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                {t("tx.deleteConfirm") || "Ya, Hapus"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Page Header ── */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
                        {t("tx.allTransactions") || "Transaksi"}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0, fontWeight: 500 }}>
                        {t("tx.subtitle") || "Kelola arus kas dengan presisi."}
                    </p>
                </div>
                <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--color-primary)", display: "block", marginBottom: 4 }}>
                        {t("tx.activePeriod") || "Periode Aktif"}
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)" }}>{periodLabel}</div>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>

                {/* Card Saldo Akun — hanya tampil saat filter akun aktif */}
                {activeAccount && (
                    <div style={{ background: "var(--bg-surface)", borderRadius: 16, padding: 20, borderLeft: `4px solid ${activeAccount.color || "var(--color-primary)"}`, transition: "transform .3s", gridColumn: "1 / -1" }}
                        onMouseOver={e => e.currentTarget.style.transform = "scale(1.01)"}
                        onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: (activeAccount.color || "var(--color-primary)") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                                    {activeAccount.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "var(--color-muted)", fontWeight: 500, marginBottom: 2 }}>
                                        {t("acc.balance") || "Saldo"} · {activeAccount.name}
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>
                                        {fmtRp(activeAccount.balance)}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 2 }}>↑ {t("tx.income") || "Masuk"}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>+{fmtRp(sumIn)}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 2 }}>↓ {t("tx.expense") || "Keluar"}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ff716c" }}>-{fmtRp(sumOut)}</div>
                                </div>
                                {sumTransferIn > 0 && (
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 2 }}>→ Transfer Masuk</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#4FC3F7" }}>+{fmtRp(sumTransferIn)}</div>
                                    </div>
                                )}
                                {sumTransferOut > 0 && (
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 2 }}>← Transfer Keluar</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd" }}>-{fmtRp(sumTransferOut)}</div>
                                    </div>
                                )}
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 2 }}>{t("tx.net") || "Bersih"}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: net >= 0 ? "var(--color-text)" : "#ff716c" }}>{net >= 0 ? "+" : ""}{fmtRp(net)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pemasukan */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 16, padding: 20, borderLeft: "4px solid #60fcc6", transition: "transform .3s" }}
                    onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(96,252,198,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📈</div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-primary)", background: "rgba(96,252,198,.08)", padding: "3px 8px", borderRadius: 6 }}>
                            {byDateAndAccount.filter(tx => tx.type === "income").length} {t("tx.summary") || "tx"}
                        </span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, marginBottom: 3 }}>{t("tx.income") || "Pemasukan"}</p>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary)", margin: "0 0 3px" }}>+{fmtRp(sumIn)}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-subtle)", margin: 0 }}>{t("tx.moreEconomical") || "periode ini"}</p>
                </div>

                {/* Pengeluaran — transfer TIDAK termasuk */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 16, padding: 20, borderLeft: "4px solid #ff716c", transition: "transform .3s" }}
                    onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,113,108,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📉</div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#ff716c", background: "rgba(255,113,108,.08)", padding: "3px 8px", borderRadius: 6 }}>
                            {byDateAndAccount.filter(tx => tx.type === "expense").length} {t("tx.summary") || "tx"}
                        </span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, marginBottom: 3 }}>{t("tx.expense") || "Pengeluaran"}</p>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "#ff716c", margin: "0 0 3px" }}>-{fmtRp(sumOut)}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-subtle)", margin: 0 }}>{t("tx.moreEconomical") || "periode ini"}</p>
                </div>

                {/* Transfer antar akun — NETRAL, tidak mempengaruhi kekayaan */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 16, padding: 20, borderLeft: "4px solid #4FC3F7", transition: "transform .3s" }}
                    onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(79,195,247,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔀</div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#4FC3F7", background: "rgba(79,195,247,.08)", padding: "3px 8px", borderRadius: 6 }}>
                            {byDateAndAccount.filter(tx => tx.type === "transfer").length} {t("tx.summary") || "tx"}
                        </span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, marginBottom: 3 }}>{t("tx.transfer") || "Transfer"}</p>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "#4FC3F7", margin: "0 0 3px" }}>↔ {fmtRp(sumTransfer)}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-subtle)", margin: 0 }}>{t("tx.transferNote") || "pemindahan antar akun"}</p>
                </div>

                {/* Saldo Bersih = income - expense (transfer diabaikan) */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 16, padding: 20, borderLeft: `4px solid ${net >= 0 ? "#a78bfa" : "#ff716c"}`, transition: "transform .3s" }}
                    onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(167,139,250,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💰</div>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid rgba(167,139,250,.25)` }} />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, marginBottom: 3 }}>{t("tx.net") || "Saldo Bersih"}</p>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: net >= 0 ? "var(--color-text)" : "#ff716c", margin: "0 0 3px" }}>{net >= 0 ? "+" : ""}{fmtRp(net)}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-subtle)", margin: 0 }}>{t("tx.netAccumulation") || "pemasukan − pengeluaran"}</p>
                </div>
            </div>

            {/* ── Filter Bar (glass) ── */}
            <div style={{
                background: "var(--bg-glass)", backdropFilter: "blur(20px)",
                border: "1px solid rgba(72,71,79,.15)",
                borderRadius: 16, padding: "16px 18px",
                display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between",
            }}>
                {/* Left: type tabs + year/month */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>

                    {/* Type tabs — pill group */}
                    <div style={{ display: "flex", background: "var(--bg-surface-low)", borderRadius: 12, padding: 4, gap: 2 }}>
                        {TYPE_TABS.map(tab => {
                            const isActive = filterType === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilterType(tab.id)}
                                    style={{
                                        padding: "6px 14px", borderRadius: 9,
                                        border: "none",
                                        background: isActive ? "var(--color-primary)" : "transparent",
                                        color: isActive ? "var(--color-on-primary)" : "var(--color-muted)",
                                        fontSize: 12, fontWeight: isActive ? 700 : 500,
                                        cursor: "pointer", fontFamily: "inherit",
                                        transition: "all .15s",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 24, background: "rgba(72,71,79,.3)" }} />

                    {/* Year + Month dropdowns - transparent style */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <select
                            value={filterYear}
                            onChange={e => { setFilterYear(e.target.value); setFilterMonth(""); setFilterDate(""); }}
                            style={{ background: "transparent", border: "none", color: "var(--color-primary)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", outline: "none" }}
                        >
                            <option value="" style={{ background: "var(--bg-surface)" }}>{t("tx.allYears")}</option>
                            {years.map(y => <option key={y} value={y} style={{ background: "var(--bg-surface)" }}>{y}</option>)}
                        </select>
                        <select
                            value={filterMonth}
                            onChange={e => { setFilterMonth(e.target.value); setFilterDate(""); }}
                            disabled={!filterYear}
                            style={{ background: "transparent", border: "none", color: filterYear ? "var(--color-primary)" : "var(--color-muted)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: filterYear ? "pointer" : "not-allowed", outline: "none", opacity: filterYear ? 1 : .5 }}
                        >
                            <option value="" style={{ background: "var(--bg-surface)" }}>{t("tx.allMonths")}</option>
                            {MONTHS.map(m => <option key={m.v} value={m.v} style={{ background: "var(--bg-surface)" }}>{m.l}</option>)}
                        </select>
                    </div>

                    {/* Account filter — hanya tampil jika ada data akun */}
                    {accounts.length > 0 && (
                        <>
                            <div style={{ width: 1, height: 24, background: "rgba(72,71,79,.3)" }} />
                            <select
                                value={filterAccount}
                                onChange={e => setFilterAccount(e.target.value)}
                                style={{
                                    background: filterAccount ? "rgba(96,252,198,.1)" : "transparent",
                                    border: filterAccount ? "1px solid rgba(96,252,198,.3)" : "none",
                                    borderRadius: 8,
                                    color: filterAccount ? "var(--color-primary)" : "var(--color-muted)",
                                    fontSize: 12, fontWeight: filterAccount ? 700 : 500,
                                    fontFamily: "inherit", cursor: "pointer", outline: "none",
                                    padding: filterAccount ? "4px 8px" : "0",
                                    transition: "all .2s",
                                }}
                            >
                                <option value="" style={{ background: "var(--bg-surface)" }}>
                                    {t("acc.allAccounts") || "Semua Rekening"}
                                </option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.name} style={{ background: "var(--bg-surface)" }}>
                                        {a.icon} {a.name}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}
                </div>

                {/* Right: search + date + reset */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {/* Search */}
                    <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, opacity: .5, pointerEvents: "none" }}>🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t("tx.search") || "Cari transaksi..."}
                            style={{
                                background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 12,
                                color: "var(--color-text)", fontSize: 12, fontFamily: "inherit",
                                padding: "8px 12px 8px 30px", outline: "none", width: 200,
                            }}
                        />
                    </div>

                    {/* Date picker */}
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => { setFilterDate(e.target.value); setFilterYear(""); setFilterMonth(""); }}
                        style={{ background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-muted)", fontSize: 12, fontFamily: "inherit", padding: "8px 10px", outline: "none", colorScheme: "normal", cursor: "pointer" }}
                    />

                    {/* Reset */}
                    {(filterDate || search || filterType !== "all" || filterAccount) && (
                        <button onClick={handleReset}
                            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,113,108,.2)", background: "rgba(255,113,108,.08)", color: "#ff716c", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                            ✕ {t("common.reset")}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Stats Mini Bar ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", flexWrap: "wrap", gap: 6 }}>
                <p style={{ fontSize: 11, color: "var(--color-muted)", margin: 0, display: "flex", flexWrap: "wrap", gap: "0 6px", alignItems: "center" }}>
                    <span><span style={{ fontWeight: 600, color: "var(--color-text)" }}>{filtered.length}</span> {t("tx.summary") || "transaksi"}</span>
                    <span style={{ opacity: .35 }}>·</span>
                    <span style={{ color: "rgba(96,252,198,.85)", fontWeight: 600 }}>↑ {fmtRp(sumIn)}</span>
                    <span style={{ opacity: .35 }}>·</span>
                    <span style={{ color: "rgba(255,113,108,.85)", fontWeight: 600 }}>↓ {fmtRp(sumOut)}</span>
                    {sumTransfer > 0 && <>
                        <span style={{ opacity: .35 }}>·</span>
                        <span style={{ color: "rgba(79,195,247,.85)", fontWeight: 600 }}>↔ {fmtRp(sumTransfer)}</span>
                    </>}
                    <span style={{ opacity: .35 }}>·</span>
                    <span style={{ color: net >= 0 ? "var(--color-text)" : "#ff716c", fontWeight: 600 }}>
                        {t("tx.net") || "Bersih"}: {net >= 0 ? "+" : ""}{fmtRp(net)}
                    </span>
                </p>
            </div>

            {/* ── Transaction List ── */}
            <div style={{ borderRadius: 24, overflow: "hidden" }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#475569", background: "var(--bg-surface-low)", borderRadius: 24 }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                        <p style={{ fontSize: 13, margin: 0, color: "var(--color-muted)" }}>{t("tx.noTxPeriod")}</p>
                    </div>
                ) : (
                    filtered.map((tx, idx) => {
                        const meta = typeMeta(tx.type);
                        const isHovered = hoveredId === tx.id;
                        /* alternating row: even = #13131a, odd = rgba(37,37,47,.3) */
                        const rowBg = isHovered
                            ? "var(--bg-surface-hover)"
                            : idx % 2 === 0
                                ? "var(--bg-surface-low)"
                                : "var(--bg-alt-row)";

                        return (
                            <div
                                key={tx.id}
                                onMouseEnter={() => setHoveredId(tx.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "14px 16px",
                                    background: rowBg,
                                    transition: "background .15s",
                                    gap: 12,
                                }}
                            >
                                {/* Left: icon + info */}
                                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                                    {/* Icon box 48x48 */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14,
                                        background: meta.iconBg,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 20, flexShrink: 0,
                                        transition: "transform .2s",
                                        transform: isHovered ? "scale(1.1)" : "scale(1)",
                                    }}>
                                        {tx.icon}
                                    </div>

                                    {/* Name + badge + meta */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                                                {tx.note}
                                            </span>
                                            <span style={{
                                                fontSize: 9, padding: "2px 8px", borderRadius: 9999,
                                                background: meta.badgeBg, color: meta.badgeColor,
                                                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                                                whiteSpace: "nowrap",
                                            }}>
                                                {typeText(tx.type)}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 11, color: "var(--color-muted)", margin: 0 }}>
                                            {fmtDate(tx.date)} · {tCat(tx.category)} ·{" "}
                                            {tx.type === "transfer" && tx.to_account
                                                ? <span style={{ color: "#4FC3F7", fontWeight: 600 }}>{tx.account_name} → {tx.to_account}</span>
                                                : tx.account_name
                                            }
                                        </p>
                                    </div>
                                </div>

                                {/* Right: amount + actions */}
                                <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: meta.amtColor, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>
                                        {meta.sign}{fmtRp(tx.amount)}
                                    </span>

                                    {/* Action buttons — always visible on mobile */}
                                    <div style={{ display: "flex", gap: 4, opacity: isMobile || isHovered ? 1 : 0, transition: "opacity .15s", pointerEvents: isMobile || isHovered ? "auto" : "none" }}>
                                        <button
                                            onClick={() => onEdit(tx)}
                                            style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: "transparent", color: "var(--color-muted)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}
                                            onMouseOver={e => e.currentTarget.style.background = "var(--bg-surface-hover)"}
                                            onMouseOut={e => e.currentTarget.style.background = "transparent"}
                                        >✏️</button>
                                        <button
                                            onClick={() => setConfirmDelete(tx)}
                                            style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: "transparent", color: "#ff716c", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}
                                            onMouseOver={e => e.currentTarget.style.background = "rgba(255,113,108,.1)"}
                                            onMouseOut={e => e.currentTarget.style.background = "transparent"}
                                        >🗑️</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TransaksiView;
