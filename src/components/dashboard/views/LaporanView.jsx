import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

const MONTHS_LOCALIZED = {
    id: [
        { v: "01", l: "Januari" }, { v: "02", l: "Februari" }, { v: "03", l: "Maret" },
        { v: "04", l: "April" },   { v: "05", l: "Mei" },      { v: "06", l: "Juni" },
        { v: "07", l: "Juli" },    { v: "08", l: "Agustus" },  { v: "09", l: "September" },
        { v: "10", l: "Oktober" }, { v: "11", l: "November" }, { v: "12", l: "Desember" },
    ],
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
        { v: "01", l: "Enero" },   { v: "02", l: "Febrero" },   { v: "03", l: "Marzo" },
        { v: "04", l: "Abril" },   { v: "05", l: "Mayo" },      { v: "06", l: "Junio" },
        { v: "07", l: "Julio" },   { v: "08", l: "Agosto" },    { v: "09", l: "Septiembre" },
        { v: "10", l: "Octubre" }, { v: "11", l: "Noviembre" }, { v: "12", l: "Diciembre" },
    ],
    zh: [
        { v: "01", l: "一月" }, { v: "02", l: "二月" }, { v: "03", l: "三月" },
        { v: "04", l: "四月" }, { v: "05", l: "五月" }, { v: "06", l: "六月" },
        { v: "07", l: "七月" }, { v: "08", l: "八月" }, { v: "09", l: "九月" },
        { v: "10", l: "十月" }, { v: "11", l: "十一月"}, { v: "12", l: "十二月"},
    ],
    ja: [
        { v: "01", l: "1月" }, { v: "02", l: "2月" }, { v: "03", l: "3月" },
        { v: "04", l: "4月" }, { v: "05", l: "5月" }, { v: "06", l: "6月" },
        { v: "07", l: "7月" }, { v: "08", l: "8月" }, { v: "09", l: "9月" },
        { v: "10", l: "10月"}, { v: "11", l: "11月"}, { v: "12", l: "12月"},
    ],
};

const selectStyle = {
    padding: "7px 12px", borderRadius: 9,
    background: "var(--color-border-soft)",
    border: "1px solid var(--color-border-soft)",
    color: "#c5c5d9", fontSize: 12, fontFamily: "inherit",
    outline: "none", cursor: "pointer",
};

const LaporanView = ({ transactions = [] }) => {
    const { t, lang } = useLanguage();
    const MONTHS = MONTHS_LOCALIZED[lang] || MONTHS_LOCALIZED.id;

    const now = new Date();
    const [filterYear,  setFilterYear]  = useState(String(now.getFullYear()));
    const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));

    const years = [...new Set(transactions.map(tx => tx.date?.slice(0, 4)).filter(Boolean))].sort().reverse();

    const filtered = transactions.filter(tx => {
        if (filterYear  && tx.date?.slice(0, 4) !== filterYear)  return false;
        if (filterMonth && tx.date?.slice(5, 7) !== filterMonth) return false;
        return true;
    });

    const income   = filtered.filter(tx => tx.type === "income").reduce((a, tx) => a + tx.amount, 0);
    const expense  = filtered.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const transfer = filtered.filter(tx => tx.type === "transfer").reduce((a, tx) => a + tx.amount, 0);
    const net      = income - expense;
    const savingRate = income > 0 ? Math.round((1 - expense / income) * 100) : 0;

    const daysInMonth = filterYear && filterMonth
        ? new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
        : 30;
    const avgPerDay = daysInMonth > 0 ? Math.round(expense / daysInMonth) : 0;

    const dailyExpense = {};
    filtered.filter(tx => tx.type === "expense").forEach(tx => {
        const day = parseInt(tx.date?.slice(8, 10));
        dailyExpense[day] = (dailyExpense[day] || 0) + tx.amount;
    });
    const maxDaily = Math.max(...Object.values(dailyExpense), 1);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const catTotals = {};
    filtered.filter(tx => tx.type === "expense").forEach(tx => {
        catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
    });
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    const monthLabel = filterMonth ? MONTHS.find(m => m.v === filterMonth)?.l : "";
    const periodLabel = monthLabel && filterYear ? `${monthLabel} ${filterYear}` : filterYear || t("rep.allPeriod");

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header + Filter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{t("rep.title")}</h3>
                    <p style={{ fontSize: 12, color: "var(--color-subtle)", margin: "4px 0 0" }}>{t("rep.period")}: {periodLabel}</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={selectStyle}>
                        <option value="">{t("rep.allYears")}</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} disabled={!filterYear} style={{ ...selectStyle, opacity: filterYear ? 1 : 0.4 }}>
                        <option value="">{t("rep.allMonths")}</option>
                        {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>

                {/* Ringkasan */}
                <div style={{ background: "rgba(25,25,33,.6)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: 22 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>{t("rep.summary")} {periodLabel}</h3>
                    {[
                        { l: t("rep.totalIncome"),   v: fmtRp(income),    c: "var(--color-primary)" },
                        { l: t("rep.totalExpense"),  v: fmtRp(expense),   c: "#ff716c" },
                        { l: t("rep.totalTransfer"), v: fmtRp(transfer),  c: "#4FC3F7" },
                        { l: t("rep.netBalance"),    v: fmtRp(net),       c: net >= 0 ? "var(--color-primary)" : "#ff716c" },
                        { l: t("rep.savingRate"),    v: `${savingRate}%`, c: savingRate >= 20 ? "var(--color-primary)" : "#f59e0b" },
                        { l: t("rep.avgPerDay"),     v: fmtRp(avgPerDay), c: "var(--color-primary)" },
                        { l: t("rep.txCount"),       v: filtered.length,  c: "var(--color-muted)" },
                    ].map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i > 0 ? "1px solid var(--color-border-soft)" : "none" }}>
                            <span style={{ fontSize: 13, color: "var(--color-muted)" }}>{r.l}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: r.c }}>{r.v}</span>
                        </div>
                    ))}
                </div>

                {/* Bar chart harian */}
                <div style={{ background: "rgba(25,25,33,.6)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: 22 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>{t("rep.dailyExpense")}</h3>
                    <p style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 16 }}>{periodLabel} · {t("rep.maxPerDay")} {fmtRp(maxDaily === 1 ? 0 : maxDaily)}{t("rep.perDay")}</p>
                    {expense === 0 ? (
                        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#48474f", fontSize: 13 }}>
                            {t("rep.noExpense")}
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 120, overflowX: "auto" }}>
                            {days.map(day => {
                                const val = dailyExpense[day] || 0;
                                const h = val > 0 ? Math.max(4, Math.round((val / maxDaily) * 100)) : 0;
                                const isHigh = val > maxDaily * 0.7;
                                return (
                                    <div key={day} title={`${day}: ${fmtRp(val)}`}
                                        style={{ flex: 1, minWidth: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "default" }}>
                                        <div style={{ width: "100%", height: h || 2, borderRadius: 3, background: val === 0 ? "var(--color-border-soft)" : isHigh ? "linear-gradient(135deg,#ff716c,#ff716c)" : "linear-gradient(135deg,#60fcc6,#60fcc6)", transition: "height .4s" }} />
                                        {daysInMonth <= 14 && <span style={{ fontSize: 8, color: "#48474f" }}>{day}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {daysInMonth > 14 && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <span style={{ fontSize: 9, color: "#48474f" }}>1</span>
                            <span style={{ fontSize: 9, color: "#48474f" }}>{Math.round(daysInMonth / 2)}</span>
                            <span style={{ fontSize: 9, color: "#48474f" }}>{daysInMonth}</span>
                        </div>
                    )}
                </div>

                {/* Breakdown Kategori */}
                <div style={{ background: "rgba(25,25,33,.6)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: 22 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>{t("rep.breakdown")}</h3>
                    <p style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 16 }}>{t("rep.breakdownSub")} · {periodLabel}</p>
                    {sortedCats.length === 0 ? (
                        <div style={{ color: "#48474f", fontSize: 13, textAlign: "center", padding: "20px 0" }}>{t("rep.noExpense")}</div>
                    ) : sortedCats.map(([cat, amt], i) => {
                        const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
                        const colors = ["var(--color-primary)","var(--color-primary)","#4FC3F7","var(--color-primary)","#f59e0b","#ff716c","#ec4899"];
                        const c = colors[i % colors.length];
                        return (
                            <div key={cat} style={{ marginBottom: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, color: "#c5c5d9" }}>{cat}</span>
                                    <span style={{ fontSize: 12, color: "var(--color-muted)", fontWeight: 600 }}>{fmtRp(amt)} <span style={{ color: "#48474f" }}>({pct}%)</span></span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: "var(--color-border-soft)" }}>
                                    <div style={{ height: "100%", borderRadius: 3, background: c, width: `${pct}%`, transition: "width .8s" }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>
        </div>
    );
};

export default LaporanView;
