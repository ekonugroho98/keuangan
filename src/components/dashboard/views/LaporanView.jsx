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

/* 10 warna berbeda untuk kategori */
const CAT_COLORS = [
    "#60fcc6", "#4FC3F7", "#f59e0b", "#ff716c",
    "#ec4899", "#a855f7", "#14b8a6", "#f97316",
    "#6366f1", "#22c55e",
];

const selectStyle = {
    padding: "9px 14px", borderRadius: 12, minHeight: 42,
    background: "var(--glass-1)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border)",
    color: "var(--color-text)", fontSize: 12, fontFamily: "inherit",
    outline: "none", cursor: "pointer",
};

/* Toggle button group — segmented control */
const ChartToggle = ({ value, options, onChange }) => (
    <div style={{
        display: "flex", gap: 2, padding: 3, borderRadius: 10,
        background: "var(--glass-2)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
    }}>
        {options.map(opt => (
            <button key={opt.v} onClick={() => onChange(opt.v)}
                style={{
                    padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700, transition: "all .18s",
                    background: value === opt.v ? "var(--bg-surface)" : "transparent",
                    color: value === opt.v ? "var(--color-text)" : "var(--color-subtle)",
                    boxShadow: value === opt.v ? "var(--glass-highlight), 0 1px 3px rgba(0,0,0,.12)" : "none",
                    minHeight: 32,
                }}>
                {opt.icon} {opt.l}
            </button>
        ))}
    </div>
);

/* ── SVG Donut Chart ── */
const DonutChart = ({ segments, total }) => {
    const cx = 90, cy = 90, R = 78, innerR = 50;
    let startAngle = -Math.PI / 2;

    const arcs = segments.map(([cat, amt], i) => {
        const pct   = total > 0 ? amt / total : 0;
        const angle = pct * 2 * Math.PI;
        const end   = startAngle + angle;

        const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle);
        const x2 = cx + R * Math.cos(end),         y2 = cy + R * Math.sin(end);
        const ix1 = cx + innerR * Math.cos(startAngle), iy1 = cy + innerR * Math.sin(startAngle);
        const ix2 = cx + innerR * Math.cos(end),         iy2 = cy + innerR * Math.sin(end);
        const large = angle > Math.PI ? 1 : 0;

        const d = `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1}Z`;
        startAngle = end;
        return { d, color: CAT_COLORS[i % CAT_COLORS.length], cat, amt, pct };
    });

    return (
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
                {arcs.map((a, i) => (
                    <path key={i} d={a.d} fill={a.color} stroke="var(--bg-surface)" strokeWidth={2.5}>
                        <title>{a.cat}: {fmtRp(a.amt)} ({Math.round(a.pct * 100)}%)</title>
                    </path>
                ))}
                <text x={90} y={85} textAnchor="middle" fill="var(--color-muted)" fontSize={10}>Total</text>
                <text x={90} y={104} textAnchor="middle" fill="var(--color-text)" fontSize={13} fontWeight={800}>
                    {fmtRp(total).replace("Rp ", "")}
                </text>
            </svg>
            {/* Legend */}
            <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 7 }}>
                {arcs.map(a => (
                    <div key={a.cat} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 11, color: "var(--color-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.cat}</span>
                        <span style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 600, flexShrink: 0 }}>{Math.round(a.pct * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ── SVG Line Chart ── */
const LineChart = ({ days, dailyExpense, maxDaily, avgPerDay, daysInMonth, periodLabel }) => {
    const W = 260, H = 130, padL = 4, padR = 4, padT = 8, padB = 4;
    const cW = W - padL - padR;
    const cH = H - padT - padB;

    const pts = days.map(day => ({
        day,
        val: dailyExpense[day] || 0,
        x: padL + ((day - 1) / Math.max(daysInMonth - 1, 1)) * cW,
        y: padT + cH - (maxDaily > 1 ? ((dailyExpense[day] || 0) / maxDaily) * cH : 0),
    }));

    const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
    const area     = `${padL},${padT + cH} ${polyline} ${padL + cW},${padT + cH}`;
    const avgY     = maxDaily > 1 ? padT + cH - (avgPerDay / maxDaily) * cH : padT + cH;

    return (
        <div style={{ width: "100%" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                {/* Grid */}
                {[25, 50, 75].map(p => (
                    <line key={p} x1={padL} x2={padL + cW}
                        y1={padT + cH * (1 - p / 100)} y2={padT + cH * (1 - p / 100)}
                        stroke="var(--color-border-soft)" strokeWidth={0.5} />
                ))}
                {/* Baseline */}
                <line x1={padL} x2={padL + cW} y1={padT + cH} y2={padT + cH} stroke="var(--color-border)" strokeWidth={1} />

                {/* Area fill */}
                <polygon points={area} fill="rgba(96,252,198,0.08)" />

                {/* Avg line */}
                {avgPerDay > 0 && maxDaily > 1 && (
                    <>
                        <line x1={padL} x2={padL + cW} y1={avgY} y2={avgY}
                            stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" opacity={0.8} />
                        <text x={padL + cW - 2} y={avgY - 3} textAnchor="end"
                            fill="#f59e0b" fontSize={7} fontWeight={700}>avg</text>
                    </>
                )}

                {/* Line */}
                <polyline points={polyline} fill="none" stroke="#60fcc6" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />

                {/* Dots for non-zero days */}
                {pts.filter(p => p.val > 0).map(p => {
                    const isHigh = p.val >= maxDaily * 0.7;
                    const isMed  = p.val >= maxDaily * 0.4;
                    return (
                        <circle key={p.day} cx={p.x} cy={p.y} r={2.5}
                            fill={isHigh ? "#ff716c" : isMed ? "#f59e0b" : "#60fcc6"}
                            stroke="var(--bg-surface)" strokeWidth={1.5}>
                            <title>{p.day} {periodLabel}: {fmtRp(p.val)}</title>
                        </circle>
                    );
                })}
            </svg>

            {/* X labels */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                {[1, Math.round(daysInMonth * 0.25), Math.round(daysInMonth * 0.5), Math.round(daysInMonth * 0.75), daysInMonth].map(d => (
                    <span key={d} style={{ fontSize: 9, color: "var(--color-subtle)" }}>{d}</span>
                ))}
            </div>
        </div>
    );
};

/* ── MAIN COMPONENT ── */
const LaporanView = ({ transactions = [] }) => {
    const { t, lang } = useLanguage();
    const MONTHS = MONTHS_LOCALIZED[lang] || MONTHS_LOCALIZED.id;

    const now = new Date();
    const [filterYear,        setFilterYear]        = useState(String(now.getFullYear()));
    const [filterMonth,       setFilterMonth]       = useState(String(now.getMonth() + 1).padStart(2, "0"));
    const [dailyChartType,    setDailyChartType]    = useState("bar");   // "bar" | "line"
    const [breakdownChartType, setBreakdownChartType] = useState("bar"); // "bar" | "donut"

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

    const dailyExpenseMap = {};
    filtered.filter(tx => tx.type === "expense").forEach(tx => {
        const day = parseInt(tx.date?.slice(8, 10));
        if (!isNaN(day)) dailyExpenseMap[day] = (dailyExpenseMap[day] || 0) + tx.amount;
    });
    const maxDaily = Math.max(...Object.values(dailyExpenseMap), 1);
    const days     = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const catTotals = {};
    filtered.filter(tx => tx.type === "expense").forEach(tx => {
        catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
    });
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    const monthLabel  = filterMonth ? MONTHS.find(m => m.v === filterMonth)?.l : "";
    const periodLabel = monthLabel && filterYear ? `${monthLabel} ${filterYear}` : filterYear || t("rep.allPeriod");

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header + Filter */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>REPORTS</div>
                    <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>{t("rep.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>{t("rep.period")}: {periodLabel}</p>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>

                {/* ── Ringkasan ── */}
                <div style={{
                    background: "var(--glass-1)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 20, padding: "22px 24px",
                    boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                    position: "relative", overflow: "hidden",
                }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>SUMMARY</div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", marginBottom: 16, marginTop: 0 }}>{t("rep.summary")} {periodLabel}</h3>
                    {[
                        { l: t("rep.totalIncome"),   v: fmtRp(income),    c: "var(--color-primary)" },
                        { l: t("rep.totalExpense"),  v: fmtRp(expense),   c: "#ff716c" },
                        { l: t("rep.totalTransfer"), v: fmtRp(transfer),  c: "#4FC3F7" },
                        { l: t("rep.netBalance"),    v: fmtRp(net),       c: net >= 0 ? "var(--color-primary)" : "#ff716c" },
                        { l: t("rep.savingRate"),    v: `${savingRate}%`, c: savingRate >= 20 ? "var(--color-primary)" : "#f59e0b" },
                        { l: t("rep.avgPerDay"),     v: fmtRp(avgPerDay), c: "var(--color-primary)" },
                        { l: t("rep.txCount"),       v: filtered.length,  c: "var(--color-muted)" },
                    ].map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i > 0 ? "1px solid var(--color-border-soft)" : "none", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, color: "var(--color-muted)" }}>{r.l}</span>
                            <span className="num-tight mono" style={{ fontSize: 14, fontWeight: 700, color: r.c }}>{r.v}</span>
                        </div>
                    ))}
                </div>

                {/* ── Pengeluaran Harian ── */}
                <div style={{
                    background: "var(--glass-1)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 20, padding: "22px 24px",
                    boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                    position: "relative", overflow: "hidden",
                }}>
                    {/* Header row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{t("rep.dailyExpense")}</h3>
                        <ChartToggle
                            value={dailyChartType}
                            options={[
                                { v: "bar",  icon: "▐▌", l: "Bar"  },
                                { v: "line", icon: "〜", l: "Line" },
                            ]}
                            onChange={setDailyChartType}
                        />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 14 }}>
                        {periodLabel} · {avgPerDay > 0 ? `avg ${fmtRp(avgPerDay)}/hari` : "belum ada data"}
                        {expense > 0 && <> · maks <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{fmtRp(maxDaily)}</span></>}
                    </p>

                    {expense === 0 ? (
                        <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13 }}>
                            {t("rep.noExpense")}
                        </div>
                    ) : dailyChartType === "bar" ? (
                        <>
                            <div style={{ position: "relative", height: 150, marginBottom: 6 }}>
                                {[75, 50, 25].map(p => (
                                    <div key={p} style={{ position: "absolute", bottom: `${p}%`, left: 0, right: 0, borderTop: "1px dashed var(--color-border-soft)", zIndex: 0 }} />
                                ))}
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid var(--color-border)", zIndex: 0 }} />
                                {avgPerDay > 0 && maxDaily > 1 && (() => {
                                    const p = Math.min(95, Math.round((avgPerDay / maxDaily) * 100));
                                    return (
                                        <div style={{ position: "absolute", bottom: `${p}%`, left: 0, right: 0, borderTop: "1px dashed #f59e0b", zIndex: 2 }}>
                                            <span style={{ position: "absolute", right: 2, top: -14, fontSize: 8, color: "#f59e0b", fontWeight: 700, background: "var(--bg-surface)", padding: "1px 3px", borderRadius: 3 }}>avg</span>
                                        </div>
                                    );
                                })()}
                                <div style={{ position: "absolute", inset: 0, display: "flex", gap: 2, alignItems: "flex-end", zIndex: 1 }}>
                                    {days.map(day => {
                                        const val  = dailyExpenseMap[day] || 0;
                                        const hPct = val > 0 ? Math.max(2, Math.round((val / maxDaily) * 100)) : 0;
                                        const isHigh = val >= maxDaily * 0.7;
                                        const isMed  = val >= maxDaily * 0.4;
                                        const bg = val === 0
                                            ? "var(--color-border-soft)"
                                            : isHigh ? "linear-gradient(to top,#e04f4f,#ff716c)"
                                            : isMed  ? "linear-gradient(to top,#d97706,#f59e0b)"
                                            : "linear-gradient(to top,#19ce9b,#60fcc6)";
                                        return (
                                            <div key={day}
                                                title={val > 0 ? `${day} ${periodLabel}: ${fmtRp(val)}` : `${day}: tidak ada pengeluaran`}
                                                style={{ flex: 1, minWidth: 4, height: val === 0 ? 2 : `${hPct}%`, borderRadius: "3px 3px 0 0", background: bg, opacity: val === 0 ? 0.2 : 1, transition: "height .5s ease", cursor: "default", alignSelf: "flex-end" }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                {[1, Math.round(daysInMonth * 0.25), Math.round(daysInMonth * 0.5), Math.round(daysInMonth * 0.75), daysInMonth].map(d => (
                                    <span key={d} style={{ fontSize: 9, color: "var(--color-subtle)" }}>{d}</span>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {[
                                    { bg: "#60fcc6", l: "Normal" },
                                    { bg: "#f59e0b", l: "> 40% maks" },
                                    { bg: "#ff716c", l: "> 70% maks" },
                                ].map(item => (
                                    <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: 2, background: item.bg }} />
                                        <span style={{ fontSize: 9, color: "var(--color-subtle)" }}>{item.l}</span>
                                    </div>
                                ))}
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <div style={{ width: 14, borderTop: "1.5px dashed #f59e0b" }} />
                                    <span style={{ fontSize: 9, color: "var(--color-subtle)" }}>rata-rata</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Line chart */
                        <LineChart
                            days={days}
                            dailyExpense={dailyExpenseMap}
                            maxDaily={maxDaily}
                            avgPerDay={avgPerDay}
                            daysInMonth={daysInMonth}
                            periodLabel={periodLabel}
                        />
                    )}
                </div>

                {/* ── Breakdown Kategori ── */}
                <div style={{
                    background: "var(--glass-1)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 20, padding: "22px 24px",
                    boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                    position: "relative", overflow: "hidden",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{t("rep.breakdown")}</h3>
                        <ChartToggle
                            value={breakdownChartType}
                            options={[
                                { v: "bar",   icon: "≡", l: "Bar"   },
                                { v: "donut", icon: "◎", l: "Donut" },
                            ]}
                            onChange={setBreakdownChartType}
                        />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 16 }}>{t("rep.breakdownSub")} · {periodLabel}</p>

                    {sortedCats.length === 0 ? (
                        <div style={{ color: "var(--color-subtle)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>{t("rep.noExpense")}</div>
                    ) : breakdownChartType === "donut" ? (
                        <DonutChart segments={sortedCats.slice(0, 10)} total={expense} />
                    ) : (
                        sortedCats.map(([cat, amt], i) => {
                            const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
                            const c   = CAT_COLORS[i % CAT_COLORS.length];
                            return (
                                <div key={cat} style={{ marginBottom: 14 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                                            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{cat}</span>
                                        </div>
                                        <span style={{ fontSize: 12, color: "var(--color-muted)", fontWeight: 600 }}>
                                            {fmtRp(amt)} <span style={{ color: "var(--color-subtle)", fontWeight: 400 }}>({pct}%)</span>
                                        </span>
                                    </div>
                                    <div style={{ height: 6, borderRadius: 3, background: "var(--color-border-soft)" }}>
                                        <div style={{ height: "100%", borderRadius: 3, background: c, width: `${pct}%`, transition: "width .8s" }} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

            </div>
        </div>
    );
};

export default LaporanView;
