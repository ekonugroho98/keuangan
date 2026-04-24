import { useState, useMemo } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

const MONTHS_LOCALIZED = {
    id: [
        { v: "01", l: "Januari" }, { v: "02", l: "Februari" }, { v: "03", l: "Maret" },
        { v: "04", l: "April" }, { v: "05", l: "Mei" }, { v: "06", l: "Juni" },
        { v: "07", l: "Juli" }, { v: "08", l: "Agustus" }, { v: "09", l: "September" },
        { v: "10", l: "Oktober" }, { v: "11", l: "November" }, { v: "12", l: "Desember" },
    ],
    en: [
        { v: "01", l: "January" }, { v: "02", l: "February" }, { v: "03", l: "March" },
        { v: "04", l: "April" }, { v: "05", l: "May" }, { v: "06", l: "June" },
        { v: "07", l: "July" }, { v: "08", l: "August" }, { v: "09", l: "September" },
        { v: "10", l: "October" }, { v: "11", l: "November" }, { v: "12", l: "December" },
    ],
    ar: [
        { v: "01", l: "يناير" }, { v: "02", l: "فبراير" }, { v: "03", l: "مارس" },
        { v: "04", l: "أبريل" }, { v: "05", l: "مايو" }, { v: "06", l: "يونيو" },
        { v: "07", l: "يوليو" }, { v: "08", l: "أغسطس" }, { v: "09", l: "سبتمبر" },
        { v: "10", l: "أكتوبر" }, { v: "11", l: "نوفمبر" }, { v: "12", l: "ديسمبر" },
    ],
    es: [
        { v: "01", l: "Enero" }, { v: "02", l: "Febrero" }, { v: "03", l: "Marzo" },
        { v: "04", l: "Abril" }, { v: "05", l: "Mayo" }, { v: "06", l: "Junio" },
        { v: "07", l: "Julio" }, { v: "08", l: "Agosto" }, { v: "09", l: "Septiembre" },
        { v: "10", l: "Octubre" }, { v: "11", l: "Noviembre" }, { v: "12", l: "Diciembre" },
    ],
    zh: [
        { v: "01", l: "一月" }, { v: "02", l: "二月" }, { v: "03", l: "三月" },
        { v: "04", l: "四月" }, { v: "05", l: "五月" }, { v: "06", l: "六月" },
        { v: "07", l: "七月" }, { v: "08", l: "八月" }, { v: "09", l: "九月" },
        { v: "10", l: "十月" }, { v: "11", l: "十一月" }, { v: "12", l: "十二月" },
    ],
    ja: [
        { v: "01", l: "1月" }, { v: "02", l: "2月" }, { v: "03", l: "3月" },
        { v: "04", l: "4月" }, { v: "05", l: "5月" }, { v: "06", l: "6月" },
        { v: "07", l: "7月" }, { v: "08", l: "8月" }, { v: "09", l: "9月" },
        { v: "10", l: "10月" }, { v: "11", l: "11月" }, { v: "12", l: "12月" },
    ],
};

/* Kategori palette */
const CAT_COLORS = [
    "#60fcc6", "#4FC3F7", "#f59e0b", "#ff716c",
    "#ec4899", "#a855f7", "#14b8a6", "#f97316",
    "#6366f1", "#22c55e",
];

/* ═══════════════════════════════════════════════════════════════
 * DESIGN TOKENS
 * ═══════════════════════════════════════════════════════════════ */
const glassCard = {
    background: "var(--glass-1)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border)",
    borderRadius: 20,
    padding: "22px 24px",
    boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
    position: "relative",
    overflow: "hidden",
};

const eyebrow = {
    fontSize: 10, fontWeight: 800,
    color: "var(--color-subtle)",
    textTransform: "uppercase",
    letterSpacing: 1.6,
    lineHeight: 1,
};

/* ═══════════════════════════════════════════════════════════════
 * Quick Period Chips — segmented control
 * ═══════════════════════════════════════════════════════════════ */
const PeriodChips = ({ value, onChange }) => {
    const options = [
        { v: "thisMonth", l: "Bulan ini" },
        { v: "lastMonth", l: "Bulan lalu" },
        { v: "thisYear", l: "Tahun ini" },
        { v: "all", l: "Semua" },
    ];
    return (
        <div style={{
            display: "flex", gap: 2, padding: 3, borderRadius: 10,
            background: "rgba(255,255,255,.03)",
            border: "1px solid var(--glass-border)",
            flexWrap: "wrap",
        }}>
            {options.map(opt => (
                <button key={opt.v} onClick={() => onChange(opt.v)}
                    style={{
                        padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                        fontFamily: "inherit", fontSize: 12, fontWeight: 700, transition: "all .18s",
                        background: value === opt.v ? "var(--color-primary-soft)" : "transparent",
                        color: value === opt.v ? "var(--color-primary)" : "var(--color-muted)",
                        boxShadow: value === opt.v ? "inset 0 0 0 1px rgba(96,252,198,.25)" : "none",
                        minHeight: 34,
                        letterSpacing: "-.01em",
                    }}>
                    {opt.l}
                </button>
            ))}
        </div>
    );
};

/* Sub-toggle for chart type */
const ChartToggle = ({ value, options, onChange }) => (
    <div style={{
        display: "flex", gap: 2, padding: 3, borderRadius: 10,
        background: "rgba(255,255,255,.03)",
        border: "1px solid var(--glass-border)",
    }}>
        {options.map(opt => (
            <button key={opt.v} onClick={() => onChange(opt.v)}
                style={{
                    padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700, transition: "all .18s",
                    background: value === opt.v ? "var(--bg-surface)" : "transparent",
                    color: value === opt.v ? "var(--color-text)" : "var(--color-subtle)",
                    boxShadow: value === opt.v ? "var(--glass-highlight), 0 1px 3px rgba(0,0,0,.12)" : "none",
                    minHeight: 28,
                    display: "flex", alignItems: "center", gap: 4,
                }}>
                {opt.icon} {opt.l}
            </button>
        ))}
    </div>
);

/* ═══════════════════════════════════════════════════════════════
 * KPI Card with MoM delta
 * ═══════════════════════════════════════════════════════════════ */
const KpiCard = ({ label, value, delta, deltaGood, icon, accent }) => (
    <div style={{ flex: 1, minWidth: "min(100%, 170px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
            }}>{icon}</div>
            <span style={eyebrow}>{label}</span>
        </div>
        <div className="num-tight" style={{
            fontSize: "clamp(22px, 2.6vw, 30px)",
            fontWeight: 900, color: "var(--color-text)",
            letterSpacing: "-.035em", lineHeight: 1,
            marginBottom: 8,
        }}>{value}</div>
        {delta && (
            <span className={deltaGood ? "chip chip-mint" : "chip chip-red"} style={{ fontSize: 10, padding: "3px 10px" }}>
                {deltaGood ? "↑" : "↓"} {delta} vs bulan lalu
            </span>
        )}
    </div>
);

/* ═══════════════════════════════════════════════════════════════
 * SAVING RATE RING
 * ═══════════════════════════════════════════════════════════════ */
const SavingRing = ({ rate }) => {
    const R = 52, C = 2 * Math.PI * R;
    const dash = (Math.min(rate, 100) / 100) * C;
    return (
        <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
            <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="65" cy="65" r={R} fill="transparent" stroke="var(--bg-sunk)" strokeWidth="9" />
                <circle cx="65" cy="65" r={R} fill="transparent"
                    stroke="var(--color-primary)"
                    strokeWidth="9"
                    strokeDasharray={`${dash} ${C}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s ease", filter: "drop-shadow(0 0 12px rgba(96,252,198,.45))" }}
                />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span className="num-tight" style={{ fontSize: 32, fontWeight: 900, color: "var(--color-text)", lineHeight: 1 }}>{rate}</span>
                <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 700, letterSpacing: 1.2, marginTop: 4 }}>PERSEN</span>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
 * SVG Donut Chart
 * ═══════════════════════════════════════════════════════════════ */
const DonutChart = ({ segments, total }) => {
    const cx = 90, cy = 90, R = 78, innerR = 52;
    let startAngle = -Math.PI / 2;
    const arcs = segments.map(([cat, amt], i) => {
        const pct = total > 0 ? amt / total : 0;
        const angle = pct * 2 * Math.PI;
        const end = startAngle + angle;
        const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle);
        const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
        const ix1 = cx + innerR * Math.cos(startAngle), iy1 = cy + innerR * Math.sin(startAngle);
        const ix2 = cx + innerR * Math.cos(end), iy2 = cy + innerR * Math.sin(end);
        const large = angle > Math.PI ? 1 : 0;
        const d = `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1}Z`;
        startAngle = end;
        return { d, color: CAT_COLORS[i % CAT_COLORS.length], cat, amt, pct };
    });

    return (
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
                {arcs.map((a, i) => (
                    <path key={i} d={a.d} fill={a.color} stroke="var(--bg-surface)" strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 8px ${a.color}40)` }}>
                        <title>{a.cat}: {fmtRp(a.amt)} ({Math.round(a.pct * 100)}%)</title>
                    </path>
                ))}
                <text x={90} y={84} textAnchor="middle" fill="var(--color-muted)" fontSize={9} fontWeight={700} letterSpacing="1.5">TOTAL</text>
                <text x={90} y={104} textAnchor="middle" fill="var(--color-text)" fontSize={14} fontWeight={900} letterSpacing="-.03em">
                    {fmtRp(total).replace("Rp ", "Rp ")}
                </text>
            </svg>
            <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 8 }}>
                {arcs.map(a => (
                    <div key={a.cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0, boxShadow: `0 0 6px ${a.color}` }} />
                        <span style={{ flex: 1, fontSize: 12, color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-.01em" }}>{a.cat}</span>
                        <span className="mono num-tight" style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 700, flexShrink: 0 }}>{Math.round(a.pct * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
 * Daily Line Chart — smooth bezier
 * ═══════════════════════════════════════════════════════════════ */
const LineChart = ({ days, dailyExpense, maxDaily, avgPerDay, daysInMonth, periodLabel }) => {
    const W = 560, H = 160, PAD = 12;
    const cW = W - 2 * PAD, cH = H - 2 * PAD - 8;

    const pts = days.map(day => ({
        day,
        val: dailyExpense[day] || 0,
        x: PAD + ((day - 1) / Math.max(daysInMonth - 1, 1)) * cW,
        y: PAD + cH - (maxDaily > 1 ? ((dailyExpense[day] || 0) / maxDaily) * cH : 0),
    }));

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        const p1 = pts[i - 1], p2 = pts[i];
        const cx = (p1.x + p2.x) / 2;
        d += ` C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    const area = d + ` L ${pts[pts.length - 1].x} ${PAD + cH} L ${pts[0].x} ${PAD + cH} Z`;
    const avgY = maxDaily > 1 ? PAD + cH - (avgPerDay / maxDaily) * cH : PAD + cH;

    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible", display: "block" }}>
                <defs>
                    <linearGradient id="laporan-line-grad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity=".35" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {[25, 50, 75].map(p => (
                    <line key={p} x1={PAD} x2={PAD + cW}
                        y1={PAD + cH * (1 - p / 100)} y2={PAD + cH * (1 - p / 100)}
                        stroke="var(--color-border-soft)" strokeWidth={0.5} strokeDasharray="2 4" />
                ))}
                <path d={area} fill="url(#laporan-line-grad)" />
                {avgPerDay > 0 && maxDaily > 1 && (
                    <>
                        <line x1={PAD} x2={PAD + cW} y1={avgY} y2={avgY}
                            stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" opacity={0.8} />
                        <text x={PAD + cW - 2} y={avgY - 4} textAnchor="end"
                            fill="#f59e0b" fontSize={8} fontWeight={700}>avg</text>
                    </>
                )}
                <path d={d} stroke="var(--color-primary)" strokeWidth={2.2} fill="none" strokeLinecap="round" />
                {pts.filter(p => p.val > 0).map(p => {
                    const isHigh = p.val >= maxDaily * 0.7;
                    const isMed = p.val >= maxDaily * 0.4;
                    const color = isHigh ? "var(--color-expense)" : isMed ? "var(--color-amber)" : "var(--color-primary)";
                    return (
                        <circle key={p.day} cx={p.x} cy={p.y} r={2.8}
                            fill={color}
                            stroke="var(--bg-surface)" strokeWidth={1.8}>
                            <title>{p.day} {periodLabel}: {fmtRp(p.val)}</title>
                        </circle>
                    );
                })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, padding: "0 2px" }}>
                {[1, Math.round(daysInMonth * 0.25), Math.round(daysInMonth * 0.5), Math.round(daysInMonth * 0.75), daysInMonth].map(d => (
                    <span key={d} style={{ fontSize: 9, color: "var(--color-subtle)", fontWeight: 600 }}>{d}</span>
                ))}
            </div>
        </>
    );
};

/* ═══════════════════════════════════════════════════════════════
 * HEATMAP CALENDAR — GitHub-contribution-style
 * Shows spending intensity per day, color-graded
 * ═══════════════════════════════════════════════════════════════ */
const Heatmap = ({ dailyExpense, daysInMonth, maxDaily, firstDayOfWeek, periodLabel, avgPerDay }) => {
    if (daysInMonth === 0) return null;
    const cells = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const weeks = [];
    let currentWeek = Array(firstDayOfWeek).fill(null);
    cells.forEach(day => {
        currentWeek.push(day);
        if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
    });
    if (currentWeek.length > 0) { while (currentWeek.length < 7) currentWeek.push(null); weeks.push(currentWeek); }

    const getIntensity = (val) => {
        if (!val || val === 0) return 0;
        if (val < avgPerDay * 0.5) return 1;
        if (val < avgPerDay) return 2;
        if (val < avgPerDay * 1.5) return 3;
        return 4;
    };
    const colorFor = (intensity) => {
        if (intensity === 0) return "var(--bg-sunk)";
        if (intensity === 1) return "rgba(96,252,198,.25)";
        if (intensity === 2) return "rgba(96,252,198,.5)";
        if (intensity === 3) return "rgba(245,158,11,.55)";
        return "rgba(255,113,108,.65)";
    };

    const dayLabels = ["M", "S", "S", "R", "K", "J", "S"];

    return (
        <>
            {/* Day labels (vertical axis) */}
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4, flexShrink: 0 }}>
                    {dayLabels.map((l, i) => (
                        <div key={i} style={{ height: 22, fontSize: 9, color: "var(--color-subtle)", fontWeight: 700, display: "flex", alignItems: "center" }}>{l}</div>
                    ))}
                </div>
                {/* Grid */}
                <div style={{ display: "flex", gap: 4, flex: 1, overflowX: "auto", paddingBottom: 4 }}>
                    {weeks.map((week, wi) => (
                        <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                            {week.map((day, di) => {
                                const val = day ? (dailyExpense[day] || 0) : null;
                                const intensity = val === null ? -1 : getIntensity(val);
                                return (
                                    <div key={di}
                                        title={day ? `${day} ${periodLabel}: ${val ? fmtRp(val) : "tidak ada pengeluaran"}` : ""}
                                        style={{
                                            width: 22, height: 22,
                                            borderRadius: 5,
                                            background: intensity === -1 ? "transparent" : colorFor(intensity),
                                            border: intensity === -1 ? "none" : "1px solid rgba(255,255,255,.04)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 9, color: intensity >= 3 ? "#fff" : "var(--color-subtle)",
                                            fontWeight: 700,
                                            transition: "transform .15s",
                                            cursor: day ? "default" : "auto",
                                        }}
                                        onMouseOver={e => { if (day) e.currentTarget.style.transform = "scale(1.15)"; }}
                                        onMouseOut={e => { if (day) e.currentTarget.style.transform = ""; }}>
                                        {day || ""}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 600 }}>Sedikit</span>
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: colorFor(i), border: i === 0 ? "1px solid var(--glass-border)" : "none" }} />
                ))}
                <span style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 600 }}>Banyak</span>
            </div>
        </>
    );
};

/* ═══════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════ */
const LaporanView = ({ transactions = [] }) => {
    const { t, lang } = useLanguage();
    const MONTHS = MONTHS_LOCALIZED[lang] || MONTHS_LOCALIZED.id;

    const now = new Date();
    const [quickPeriod, setQuickPeriod] = useState("thisMonth");
    const [customYear, setCustomYear] = useState(String(now.getFullYear()));
    const [customMonth, setCustomMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
    const [useCustom, setUseCustom] = useState(false);
    const [dailyChartType, setDailyChartType] = useState("line");
    const [breakdownChartType, setBreakdownChartType] = useState("donut");

    /* Derive active filter year/month from quick period or custom */
    const { filterYear, filterMonth } = useMemo(() => {
        if (useCustom) return { filterYear: customYear, filterMonth: customMonth };
        switch (quickPeriod) {
            case "thisMonth":
                return { filterYear: String(now.getFullYear()), filterMonth: String(now.getMonth() + 1).padStart(2, "0") };
            case "lastMonth": {
                const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
                const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                return { filterYear: String(ly), filterMonth: String(lm + 1).padStart(2, "0") };
            }
            case "thisYear":
                return { filterYear: String(now.getFullYear()), filterMonth: "" };
            case "all":
            default:
                return { filterYear: "", filterMonth: "" };
        }
    }, [quickPeriod, useCustom, customYear, customMonth]);

    const years = [...new Set(transactions.map(tx => tx.date?.slice(0, 4)).filter(Boolean))].sort().reverse();

    const filtered = transactions.filter(tx => {
        if (filterYear && tx.date?.slice(0, 4) !== filterYear) return false;
        if (filterMonth && tx.date?.slice(5, 7) !== filterMonth) return false;
        return true;
    });

    /* Previous period for comparison */
    const prevPeriodTxs = useMemo(() => {
        if (!filterYear) return [];
        let py = parseInt(filterYear), pm = filterMonth ? parseInt(filterMonth) : 0;
        if (filterMonth) {
            pm = pm === 1 ? 12 : pm - 1;
            if (pm === 12) py = py - 1;
        } else {
            py = py - 1;
        }
        const pyStr = String(py), pmStr = pm ? String(pm).padStart(2, "0") : "";
        return transactions.filter(tx => {
            if (tx.date?.slice(0, 4) !== pyStr) return false;
            if (pmStr && tx.date?.slice(5, 7) !== pmStr) return false;
            return true;
        });
    }, [transactions, filterYear, filterMonth]);

    const income = filtered.filter(tx => tx.type === "income").reduce((a, tx) => a + tx.amount, 0);
    const expense = filtered.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const transfer = filtered.filter(tx => tx.type === "transfer").reduce((a, tx) => a + tx.amount, 0);
    const net = income - expense;
    const savingRate = income > 0 ? Math.round((1 - expense / income) * 100) : 0;

    const prevIncome = prevPeriodTxs.filter(tx => tx.type === "income").reduce((a, tx) => a + tx.amount, 0);
    const prevExpense = prevPeriodTxs.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const prevNet = prevIncome - prevExpense;

    const pctDelta = (cur, prev) => {
        if (!prev) return null;
        const v = Math.round(((cur - prev) / Math.abs(prev)) * 100);
        return v;
    };
    const incomeDelta = pctDelta(income, prevIncome);
    const expenseDelta = pctDelta(expense, prevExpense);
    const netDelta = pctDelta(net, prevNet);

    const daysInMonth = filterYear && filterMonth
        ? new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
        : 30;
    const firstDayOfWeek = filterYear && filterMonth
        ? new Date(parseInt(filterYear), parseInt(filterMonth) - 1, 1).getDay()
        : 0;
    const avgPerDay = daysInMonth > 0 ? Math.round(expense / daysInMonth) : 0;

    const dailyExpenseMap = {};
    filtered.filter(tx => tx.type === "expense").forEach(tx => {
        const day = parseInt(tx.date?.slice(8, 10));
        if (!isNaN(day)) dailyExpenseMap[day] = (dailyExpenseMap[day] || 0) + tx.amount;
    });
    const maxDaily = Math.max(...Object.values(dailyExpenseMap), 1);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    /* Biggest day */
    let biggestDay = null, biggestVal = 0;
    Object.entries(dailyExpenseMap).forEach(([d, v]) => { if (v > biggestVal) { biggestDay = d; biggestVal = v; } });

    const catTotals = {};
    filtered.filter(tx => tx.type === "expense").forEach(tx => {
        catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
    });
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    const monthLabel = filterMonth ? MONTHS.find(m => m.v === filterMonth)?.l : "";
    const periodLabel = monthLabel && filterYear ? `${monthLabel} ${filterYear}` : filterYear || "Sepanjang masa";

    const activeDaysCount = Object.keys(dailyExpenseMap).length;
    const activityRate = daysInMonth > 0 ? Math.round((activeDaysCount / daysInMonth) * 100) : 0;

    const showHeatmap = !!filterMonth && daysInMonth > 0;

    return (
        <>
            <style>{`
                .lap-grid {
                    display: grid;
                    grid-template-columns: repeat(12, 1fr);
                    grid-auto-rows: minmax(80px, auto);
                    gap: 14px;
                }
                .lap-hero     { grid-column: span 8; grid-row: span 2; }
                .lap-saving   { grid-column: span 4; grid-row: span 2; }
                .lap-stats    { grid-column: span 12; }
                .lap-daily    { grid-column: span 8; }
                .lap-heatmap  { grid-column: span 4; }
                .lap-breakdown{ grid-column: span 7; }
                .lap-toplist  { grid-column: span 5; }

                @media (max-width: 1100px) {
                    .lap-hero, .lap-saving { grid-column: span 12; grid-row: auto; }
                    .lap-daily, .lap-heatmap { grid-column: span 12; }
                    .lap-breakdown, .lap-toplist { grid-column: span 12; }
                }
                @media (max-width: 720px) {
                    .lap-grid { grid-template-columns: repeat(6, 1fr); gap: 10px; }
                    .lap-hero, .lap-saving, .lap-stats, .lap-daily,
                    .lap-heatmap, .lap-breakdown, .lap-toplist {
                        grid-column: span 6 !important;
                        grid-row: auto !important;
                    }
                }
            `}</style>

            <div style={{ animation: "fadeIn .4s" }}>
                {/* ═══ HEADER ═══ */}
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
                    <div>
                        <div style={{ ...eyebrow, marginBottom: 8 }}>ANALITIK</div>
                        <h1 style={{ fontSize: "clamp(24px, 3.2vw, 34px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", margin: 0 }}>{t("rep.title")}</h1>
                        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span className="chip chip-mint" style={{ fontSize: 11, padding: "4px 12px" }}>
                                <span style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor", animation: "glow-pulse 2s infinite" }} />
                                {periodLabel}
                            </span>
                            <span>·</span>
                            <span>{filtered.length} transaksi</span>
                        </p>
                    </div>

                    {/* Period chips + custom selector */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <PeriodChips value={useCustom ? "" : quickPeriod} onChange={v => { setUseCustom(false); setQuickPeriod(v); }} />
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button onClick={() => setUseCustom(v => !v)}
                                className={useCustom ? "chip chip-mint" : "chip chip-ghost"}
                                style={{ fontSize: 11, padding: "6px 12px", cursor: "pointer", border: "none", fontFamily: "inherit" }}>
                                {useCustom ? "✓ " : ""}Custom
                            </button>
                            {useCustom && (
                                <>
                                    <select value={customYear} onChange={e => setCustomYear(e.target.value)} style={{
                                        padding: "6px 10px", borderRadius: 8, minHeight: 32,
                                        background: "var(--glass-1)",
                                        backdropFilter: "var(--glass-blur-sm)",
                                        border: "1px solid var(--glass-border)",
                                        color: "var(--color-text)", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                                    }}>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <select value={customMonth} onChange={e => setCustomMonth(e.target.value)} style={{
                                        padding: "6px 10px", borderRadius: 8, minHeight: 32,
                                        background: "var(--glass-1)",
                                        backdropFilter: "var(--glass-blur-sm)",
                                        border: "1px solid var(--glass-border)",
                                        color: "var(--color-text)", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                                    }}>
                                        <option value="">Setahun</option>
                                        {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ═══ BENTO GRID ═══ */}
                <div className="lap-grid">

                    {/* HERO KPI row */}
                    <div className="lap-hero" style={{
                        ...glassCard,
                        background: "var(--glass-hero)",
                        padding: "28px 30px",
                        borderRadius: 24,
                    }}>
                        {/* Ambient orb */}
                        <div style={{ position: "absolute", top: -100, right: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,252,198,.14), transparent 70%)", pointerEvents: "none", filter: "blur(8px)" }} />
                        <div style={{ position: "relative" }}>
                            <div style={{ ...eyebrow, marginBottom: 18 }}>RINGKASAN KEUANGAN</div>
                            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                                <KpiCard
                                    label="Pemasukan"
                                    value={fmtRp(income)}
                                    delta={incomeDelta !== null ? `${incomeDelta >= 0 ? "+" : ""}${incomeDelta}%` : null}
                                    deltaGood={incomeDelta !== null && incomeDelta >= 0}
                                    icon="📈"
                                    accent="var(--color-primary)"
                                />
                                <div style={{ width: 1, background: "var(--glass-border)", alignSelf: "stretch" }} />
                                <KpiCard
                                    label="Pengeluaran"
                                    value={fmtRp(expense)}
                                    delta={expenseDelta !== null ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}%` : null}
                                    deltaGood={expenseDelta !== null && expenseDelta < 0}
                                    icon="📉"
                                    accent="var(--color-expense)"
                                />
                                <div style={{ width: 1, background: "var(--glass-border)", alignSelf: "stretch" }} />
                                <KpiCard
                                    label="Net Balance"
                                    value={`${net >= 0 ? "+" : "−"}${fmtRp(Math.abs(net))}`}
                                    delta={netDelta !== null ? `${netDelta >= 0 ? "+" : ""}${netDelta}%` : null}
                                    deltaGood={netDelta !== null && netDelta >= 0}
                                    icon={net >= 0 ? "💚" : "🔴"}
                                    accent={net >= 0 ? "var(--color-primary)" : "var(--color-expense)"}
                                />
                            </div>
                            {transfer > 0 && (
                                <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--glass-border)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                                    <span className="chip chip-blue" style={{ fontSize: 10 }}>
                                        ↔ Transfer: <strong style={{ marginLeft: 4 }} className="mono num-tight">{fmtRp(transfer)}</strong>
                                    </span>
                                    <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>antar akun (tidak dihitung net)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Saving rate ring */}
                    <div className="lap-saving" style={{
                        ...glassCard,
                        background: "linear-gradient(145deg, var(--color-primary-soft), rgba(25,206,155,.02))",
                        border: "1px solid var(--color-primary-soft)",
                        borderRadius: 24,
                        padding: "28px 24px",
                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                                <div style={eyebrow}>Saving Rate</div>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginTop: 6, letterSpacing: "-.02em" }}>{periodLabel}</h3>
                            </div>
                            <span className={savingRate >= 20 ? "chip chip-mint" : savingRate >= 10 ? "chip chip-amber" : "chip chip-red"}>
                                {savingRate >= 20 ? "Mantap 👍" : savingRate >= 10 ? "Cukup" : "Tingkatkan"}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16 }}>
                            <SavingRing rate={savingRate} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6, fontWeight: 600 }}>Target ideal: <strong style={{ color: "var(--color-primary)" }}>20%+</strong></div>
                                <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6 }}>
                                    {savingRate >= 20
                                        ? "Kamu sudah di zona aman. Coba naikkan ke 30% untuk financial freedom lebih cepat."
                                        : savingRate >= 10
                                            ? "Masih bisa dioptimalkan. Cek kategori pengeluaran terbesar untuk prioritas hemat."
                                            : income > 0
                                                ? "Pengeluaran hampir sama dengan pemasukan. Fokus kurangi expense bulan depan."
                                                : "Belum ada pemasukan di periode ini."}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats strip */}
                    <div className="lap-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 14 }}>
                        {[
                            { l: "Rata/hari", v: fmtRp(avgPerDay), i: "📊", c: "var(--color-primary)" },
                            { l: "Hari tertinggi", v: biggestDay ? `Hari ke-${biggestDay}` : "—", sub: biggestDay ? fmtRp(biggestVal) : "", i: "🔥", c: "var(--color-expense)" },
                            { l: "Aktivitas", v: `${activityRate}%`, sub: `${activeDaysCount} dari ${daysInMonth} hari`, i: "⚡", c: "var(--color-amber)" },
                            { l: "Transaksi", v: filtered.length, sub: `${filtered.filter(tx => tx.type === "expense").length} expense`, i: "💳", c: "var(--color-transfer)" },
                        ].map((s, i) => (
                            <div key={i} style={{ ...glassCard, padding: "16px 18px", borderRadius: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: `color-mix(in srgb, ${s.c} 14%, transparent)`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 13, flexShrink: 0,
                                    }}>{s.i}</div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.4 }}>{s.l}</span>
                                </div>
                                <div className="num-tight" style={{ fontSize: 18, fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.025em", lineHeight: 1.1 }}>{s.v}</div>
                                {s.sub && <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 4, fontWeight: 500 }}>{s.sub}</div>}
                            </div>
                        ))}
                    </div>

                    {/* Daily chart */}
                    <div className="lap-daily" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                            <div>
                                <div style={eyebrow}>TREND HARIAN</div>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", marginTop: 6, letterSpacing: "-.02em", margin: "6px 0 0" }}>Pengeluaran per Hari</h3>
                                <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                    {avgPerDay > 0 ? <>avg <span className="mono num-tight" style={{ color: "var(--color-text)", fontWeight: 700 }}>{fmtRp(avgPerDay)}</span></> : "belum ada data"}
                                    {expense > 0 && <> · maks <span className="mono num-tight" style={{ color: "var(--color-expense)", fontWeight: 700 }}>{fmtRp(maxDaily)}</span></>}
                                </p>
                            </div>
                            <ChartToggle
                                value={dailyChartType}
                                options={[
                                    { v: "bar", icon: "▐▌", l: "Bar" },
                                    { v: "line", icon: "〜", l: "Line" },
                                ]}
                                onChange={setDailyChartType}
                            />
                        </div>

                        {expense === 0 ? (
                            <div style={{ height: 170, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13, gap: 8 }}>
                                <div style={{ fontSize: 32, opacity: .4 }}>📊</div>
                                {t("rep.noExpense")}
                            </div>
                        ) : dailyChartType === "bar" ? (
                            <>
                                <div style={{ position: "relative", height: 170, marginBottom: 8 }}>
                                    {[75, 50, 25].map(p => (
                                        <div key={p} style={{ position: "absolute", bottom: `${p}%`, left: 0, right: 0, borderTop: "1px dashed var(--color-border-soft)", zIndex: 0 }} />
                                    ))}
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid var(--color-border)", zIndex: 0 }} />
                                    {avgPerDay > 0 && maxDaily > 1 && (() => {
                                        const p = Math.min(95, Math.round((avgPerDay / maxDaily) * 100));
                                        return (
                                            <div style={{ position: "absolute", bottom: `${p}%`, left: 0, right: 0, borderTop: "1px dashed var(--color-amber)", zIndex: 2 }}>
                                                <span style={{ position: "absolute", right: 4, top: -16, fontSize: 9, color: "var(--color-amber)", fontWeight: 800, background: "var(--glass-1)", backdropFilter: "var(--glass-blur-sm)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--glass-border)" }}>avg</span>
                                            </div>
                                        );
                                    })()}
                                    <div style={{ position: "absolute", inset: 0, display: "flex", gap: 2, alignItems: "flex-end", zIndex: 1 }}>
                                        {days.map(day => {
                                            const val = dailyExpenseMap[day] || 0;
                                            const hPct = val > 0 ? Math.max(2, Math.round((val / maxDaily) * 100)) : 0;
                                            const isHigh = val >= maxDaily * 0.7;
                                            const isMed = val >= maxDaily * 0.4;
                                            const bg = val === 0
                                                ? "var(--color-border-soft)"
                                                : isHigh ? "linear-gradient(to top,#e04f4f,#ff716c)"
                                                    : isMed ? "linear-gradient(to top,#d97706,#f59e0b)"
                                                        : "linear-gradient(to top,#19ce9b,#60fcc6)";
                                            return (
                                                <div key={day}
                                                    title={val > 0 ? `${day} ${periodLabel}: ${fmtRp(val)}` : `${day}: tidak ada pengeluaran`}
                                                    style={{ flex: 1, minWidth: 4, height: val === 0 ? 2 : `${hPct}%`, borderRadius: "3px 3px 0 0", background: bg, opacity: val === 0 ? 0.25 : 1, transition: "height .5s ease", cursor: "default", alignSelf: "flex-end", boxShadow: val > 0 ? "0 0 8px rgba(96,252,198,.15)" : "none" }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, padding: "0 2px" }}>
                                    {[1, Math.round(daysInMonth * 0.25), Math.round(daysInMonth * 0.5), Math.round(daysInMonth * 0.75), daysInMonth].map(d => (
                                        <span key={d} style={{ fontSize: 9, color: "var(--color-subtle)", fontWeight: 600 }}>{d}</span>
                                    ))}
                                </div>
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--color-border-soft)" }}>
                                    {[
                                        { bg: "linear-gradient(to top,#19ce9b,#60fcc6)", l: "Normal" },
                                        { bg: "linear-gradient(to top,#d97706,#f59e0b)", l: "> 40% maks" },
                                        { bg: "linear-gradient(to top,#e04f4f,#ff716c)", l: "> 70% maks" },
                                    ].map(item => (
                                        <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: 3, background: item.bg }} />
                                            <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 600 }}>{item.l}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
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

                    {/* Heatmap calendar */}
                    <div className="lap-heatmap" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20 }}>
                        <div style={{ marginBottom: 14 }}>
                            <div style={eyebrow}>KALENDER AKTIVITAS</div>
                            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", marginTop: 6, letterSpacing: "-.02em", margin: "6px 0 0" }}>Intensitas Pengeluaran</h3>
                            <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                {showHeatmap ? `${activeDaysCount} hari aktif dari ${daysInMonth} hari` : "Pilih bulan spesifik untuk melihat kalender"}
                            </p>
                        </div>
                        {showHeatmap ? (
                            <Heatmap
                                dailyExpense={dailyExpenseMap}
                                daysInMonth={daysInMonth}
                                maxDaily={maxDaily}
                                firstDayOfWeek={firstDayOfWeek}
                                periodLabel={periodLabel}
                                avgPerDay={avgPerDay}
                            />
                        ) : (
                            <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13, gap: 10 }}>
                                <div style={{ fontSize: 32, opacity: .4 }}>🗓️</div>
                                <div style={{ textAlign: "center" }}>Kalender tersedia saat<br />memilih bulan spesifik</div>
                            </div>
                        )}
                    </div>

                    {/* Breakdown chart */}
                    <div className="lap-breakdown" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                            <div>
                                <div style={eyebrow}>DISTRIBUSI</div>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", marginTop: 6, letterSpacing: "-.02em", margin: "6px 0 0" }}>Breakdown Kategori</h3>
                                <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>{sortedCats.length} kategori aktif</p>
                            </div>
                            <ChartToggle
                                value={breakdownChartType}
                                options={[
                                    { v: "donut", icon: "◎", l: "Donut" },
                                    { v: "bar", icon: "≡", l: "Bar" },
                                ]}
                                onChange={setBreakdownChartType}
                            />
                        </div>

                        {sortedCats.length === 0 ? (
                            <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13, gap: 8 }}>
                                <div style={{ fontSize: 32, opacity: .4 }}>🏷️</div>
                                {t("rep.noExpense")}
                            </div>
                        ) : breakdownChartType === "donut" ? (
                            <DonutChart segments={sortedCats.slice(0, 10)} total={expense} />
                        ) : (
                            <div>
                                {sortedCats.slice(0, 10).map(([cat, amt], i) => {
                                    const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
                                    const c = CAT_COLORS[i % CAT_COLORS.length];
                                    return (
                                        <div key={cat} style={{ marginBottom: 14 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0, boxShadow: `0 0 6px ${c}` }} />
                                                    <span style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                                                </div>
                                                <span style={{ fontSize: 12, color: "var(--color-muted)", fontWeight: 700, flexShrink: 0 }}>
                                                    <span className="mono num-tight">{fmtRp(amt)}</span> <span style={{ color: "var(--color-subtle)", fontWeight: 500 }}>({pct}%)</span>
                                                </span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 99, background: "var(--bg-sunk)", overflow: "hidden" }}>
                                                <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 50%, transparent))`, width: `${pct}%`, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Top spending list — ranked */}
                    <div className="lap-toplist" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20 }}>
                        <div style={{ marginBottom: 14 }}>
                            <div style={eyebrow}>RANKING</div>
                            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", marginTop: 6, letterSpacing: "-.02em", margin: "6px 0 0" }}>Top Spending</h3>
                            <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>Kategori teratas · {periodLabel}</p>
                        </div>
                        {sortedCats.length === 0 ? (
                            <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13, gap: 8 }}>
                                <div style={{ fontSize: 32, opacity: .4 }}>🏆</div>
                                Belum ada data
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {sortedCats.slice(0, 5).map(([cat, amt], i) => {
                                    const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
                                    const c = CAT_COLORS[i % CAT_COLORS.length];
                                    return (
                                        <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: i === 0 ? "color-mix(in srgb, var(--color-primary) 4%, transparent)" : "rgba(255,255,255,.02)", border: "1px solid var(--glass-border)" }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                                background: i === 0 ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))" : `color-mix(in srgb, ${c} 15%, transparent)`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 13, fontWeight: 900,
                                                color: i === 0 ? "var(--color-on-primary)" : c,
                                                boxShadow: i === 0 ? "0 4px 10px rgba(96,252,198,.28), inset 0 1px 0 rgba(255,255,255,.25)" : "none",
                                            }}>
                                                {i === 0 ? "★" : `#${i + 1}`}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</div>
                                                <div className="mono num-tight" style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2, fontWeight: 600 }}>{fmtRp(amt)}</div>
                                            </div>
                                            <div className="num-tight" style={{ fontSize: 16, fontWeight: 900, color: c, letterSpacing: "-.02em", flexShrink: 0 }}>{pct}%</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default LaporanView;
