import { useState } from "react";
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

const selectStyle = {
    padding: "7px 12px", borderRadius: 9,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    color: "#cbd5e1", fontSize: 12, fontFamily: "inherit",
    outline: "none", cursor: "pointer",
};

const TransaksiView = ({ transactions, onEdit, onDelete }) => {
    const { t, lang } = useLanguage();
    const MONTHS = MONTHS_LOCALIZED[lang] || MONTHS_ID;

    const now = new Date();
    const [filterYear,  setFilterYear]  = useState(String(now.getFullYear()));
    const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
    const [filterDate,  setFilterDate]  = useState("");
    const [hoveredId,   setHoveredId]   = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null); // tx yang mau dihapus

    const years = [...new Set(transactions.map(tx => tx.date?.slice(0, 4)).filter(Boolean))].sort().reverse();

    const filtered = transactions.filter(tx => {
        if (filterDate)  return tx.date === filterDate;
        if (filterYear  && tx.date?.slice(0, 4) !== filterYear)  return false;
        if (filterMonth && tx.date?.slice(5, 7) !== filterMonth) return false;
        return true;
    });

    const sumIn  = filtered.filter(tx => tx.type === "income").reduce((a, tx) => a + tx.amount, 0);
    const sumOut = filtered.filter(tx => tx.type === "expense" || tx.type === "transfer").reduce((a, tx) => a + tx.amount, 0);
    const isFiltered = filterYear || filterMonth || filterDate;

    const handleReset = () => { setFilterYear(""); setFilterMonth(""); setFilterDate(""); };

    const typeLabel = (type) => {
        if (type === "income")   return { text: t("tx.income"),   bg: "rgba(16,185,129,.1)",  color: "#34d399" };
        if (type === "transfer") return { text: t("tx.transfer"), bg: "rgba(6,182,212,.1)",   color: "#22d3ee" };
        return                          { text: t("tx.expense"),  bg: "rgba(239,68,68,.1)",   color: "#f87171" };
    };

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Confirm delete popup */}
            {confirmDelete && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)" }}>
                    <div style={{ background: "#0f0f1e", border: "1px solid rgba(239,68,68,.3)", borderRadius: 18, padding: "28px 24px", maxWidth: 340, width: "90%", textAlign: "center", animation: "scaleIn .2s" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Hapus Transaksi?</h3>
                        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                            <strong style={{ color: "#fff" }}>{confirmDelete.note}</strong>
                        </p>
                        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 24 }}>
                            Saldo akun <strong style={{ color: "#94a3b8" }}>{confirmDelete.account_name}</strong> akan otomatis dikembalikan.
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "transparent", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                Batal
                            </button>
                            <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22 }}>

                {/* Header + Filter */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>{t("tx.allTransactions")}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth(""); setFilterDate(""); }} style={selectStyle}>
                            <option value="">{t("tx.allYears")}</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDate(""); }} disabled={!filterYear} style={{ ...selectStyle, opacity: filterYear ? 1 : 0.4, cursor: filterYear ? "pointer" : "not-allowed" }}>
                            <option value="">{t("tx.allMonths")}</option>
                            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                        <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setFilterYear(""); setFilterMonth(""); }} style={{ ...selectStyle, colorScheme: "dark" }} />
                        {isFiltered && (
                            <button onClick={handleReset} style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid rgba(239,68,68,.2)", background: "rgba(239,68,68,.08)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                ✕ {t("common.reset")}
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary bar */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                        <span style={{ color: "#94a3b8", fontWeight: 600 }}>{filtered.length}</span> {t("tx.summary")}
                    </div>
                    <div style={{ width: 1, background: "rgba(255,255,255,.06)" }} />
                    <div style={{ fontSize: 12, color: "#64748b" }}>{t("tx.income")}: <span style={{ color: "#10b981", fontWeight: 600 }}>{fmtRp(sumIn)}</span></div>
                    <div style={{ width: 1, background: "rgba(255,255,255,.06)" }} />
                    <div style={{ fontSize: 12, color: "#64748b" }}>{t("tx.expense")}: <span style={{ color: "#f87171", fontWeight: 600 }}>{fmtRp(sumOut)}</span></div>
                    <div style={{ width: 1, background: "rgba(255,255,255,.06)" }} />
                    <div style={{ fontSize: 12, color: "#64748b" }}>Bersih: <span style={{ color: sumIn - sumOut >= 0 ? "#10b981" : "#f87171", fontWeight: 600 }}>{fmtRp(sumIn - sumOut)}</span></div>
                </div>

                {/* List */}
                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: 13 }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                        {t("tx.noTxPeriod")}
                    </div>
                ) : (
                    filtered.map(tx => {
                        const badge = typeLabel(tx.type);
                        const isHovered = hoveredId === tx.id;
                        return (
                            <div
                                key={tx.id}
                                onMouseEnter={() => setHoveredId(tx.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 8px", borderBottom: "1px solid rgba(255,255,255,.04)", borderRadius: 10, transition: "background .15s", background: isHovered ? "rgba(255,255,255,.02)" : "transparent", gap: 8 }}
                            >
                                {/* Kiri: icon + info */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: tx.type === "income" ? "rgba(16,185,129,.1)" : tx.type === "transfer" ? "rgba(6,182,212,.1)" : "rgba(239,68,68,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{tx.icon}</div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.note}</div>
                                        <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(tx.date)} · {tx.category} · {tx.account_name}</div>
                                    </div>
                                </div>

                                {/* Kanan: jumlah + badge + action buttons */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: tx.type === "income" ? "#10b981" : tx.type === "transfer" ? "#22d3ee" : "#ef4444" }}>
                                            {tx.type === "income" ? "+" : "-"}{fmtRp(tx.amount)}
                                        </div>
                                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: badge.bg, color: badge.color, fontWeight: 600 }}>
                                            {badge.text}
                                        </span>
                                    </div>

                                    {/* Action buttons — always visible on mobile, hover on desktop */}
                                    <div style={{ display: "flex", gap: 4, opacity: isHovered ? 1 : 0, transition: "opacity .15s", pointerEvents: isHovered ? "auto" : "none" }}>
                                        <button
                                            onClick={() => onEdit(tx)}
                                            title="Edit transaksi"
                                            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(99,102,241,.3)", background: "rgba(99,102,241,.1)", color: "#818cf8", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >✏️</button>
                                        <button
                                            onClick={() => setConfirmDelete(tx)}
                                            title="Hapus transaksi"
                                            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", color: "#f87171", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
