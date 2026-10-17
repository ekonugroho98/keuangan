import { useState, useMemo } from "react";
import { parseReceiptNote } from "@karaya/shared/format";
import { fmtRp } from "../../../utils/formatters";
import { exportTransactionsCSV, exportTransactionsExcel } from "../../../utils/exportData";
import { useLanguage } from "../../../i18n/LanguageContext";
import ScopeSwitcher from "../../household/ScopeSwitcher";
import PrediksiView from "./PrediksiView";

const WEEKDAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const KIND_RULES = [
    { kind: "Minuman & es", icon: "🧋", color: "#4FC3F7", re: /\bes\b|\bjus\b|\bteh\b|kopi|le ?minerale|aqua|air mineral|\bsusu\b|boba|thai tea|minum|milk|yakult|matcha|latte|americano/i },
    { kind: "Camilan", icon: "🥟", color: "#D9A74A", re: /gorengan|risol|takoyaki|takayaki|siomay|batagor|opak|sempol|cilok|cireng|cimol|kerupuk|\bkue\b|roti|martabak|dimsum|dim sum|cakwe|pempek|snack|keripik|cemilan|camilan|donat|pisang|tahubulat|tahu bulat/i },
];

function normKey(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitItem(note) {
    const parsed = parseReceiptNote(note || "");
    let item = (parsed.name || "").replace(/\s*\(titipan [^)]*\)\s*$/i, "").trim();
    let place = parsed.merchant ?? null;
    const paren = item.match(/^(.*\S)\s*\(([^)]+)\)$/);
    if (paren && !place) {
        item = paren[1].trim();
        place = paren[2].trim();
    }
    return { item: item || "(tanpa keterangan)", place };
}

function kindOf(item) {
    const found = KIND_RULES.find((r) => r.re.test(item));
    return found ? found.kind : "Makan berat";
}

/**
 * Filter transaksi berdasarkan scope (Household/per-anggota/per-akun, F5-T5) SEBELUM filter
 * periode yang sudah ada di bawah — pendekatan client-side dipilih (bukan GET /v1/summary) supaya
 * seluruh logika chart/periode kustom di view ini (quickPeriod, custom year/month, daily chart,
 * breakdown chart) tidak perlu ditulis ulang; endpoint summary tidak mendukung rentang kustom itu.
 */
function scopeFilterTx(transactions, accounts, scope) {
    if (!scope || scope.scope === "household") return transactions;
    if (scope.scope === "account") {
        return transactions.filter((tx) => tx.account_name === scope.account || tx.to_account_name === scope.account);
    }
    if (scope.scope === "member") {
        const owned = new Set((accounts || []).filter((a) => a.owner?.display_name === scope.member).map((a) => a.name));
        return transactions.filter((tx) => owned.has(tx.account_name) || owned.has(tx.to_account_name));
    }
    return transactions;
}

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
    "#839B7A", "#C87D55", "#D9A74A", "#ff716c",
    "#4FC3F7", "#a855f7", "#14b8a6", "#f97316",
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
                        boxShadow: value === opt.v ? "inset 0 0 0 1px rgba(131,155,122,.25)" : "none",
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
                    style={{ transition: "stroke-dasharray 1s ease", filter: "drop-shadow(0 0 12px rgba(131,155,122,.45))" }}
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
        if (intensity === 1) return "rgba(131,155,122,.28)";
        if (intensity === 2) return "rgba(131,155,122,.58)";
        if (intensity === 3) return "rgba(217,167,74,.58)";
        return "rgba(229,115,104,.68)";
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
const LaporanView = ({ transactions: allTransactions = [], accounts = [], budgets = [], personalBudgets = [] }) => {
    const { t, lang } = useLanguage();
    const MONTHS = MONTHS_LOCALIZED[lang] || MONTHS_LOCALIZED.id;

    const now = new Date();
    const [scope, setScope] = useState({ scope: "household" });
    const [activeTab, setActiveTab] = useState("ringkasan");
    const [itemRankMode, setItemRankMode] = useState("repeated");
    const transactions = useMemo(() => scopeFilterTx(allTransactions, accounts, scope), [allTransactions, accounts, scope]);
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

    const isScoped = scope && scope.scope !== "household";
    const scopedAccountNames = useMemo(() => {
        if (!isScoped) return new Set();
        if (scope.scope === "account") return new Set([scope.account]);
        if (scope.scope === "member") {
            return new Set((accounts || []).filter((a) => a.owner?.display_name === scope.member).map((a) => a.name));
        }
        return new Set();
    }, [accounts, scope, isScoped]);

    const isScopeTransferIn = (tx) =>
        isScoped && tx.type === "transfer" && scopedAccountNames.has(tx.to_account_name) && !scopedAccountNames.has(tx.account_name);
    const isScopeTransferOut = (tx) =>
        isScoped && tx.type === "transfer" && scopedAccountNames.has(tx.account_name) && !scopedAccountNames.has(tx.to_account_name);
    const isScopeIncome = (tx) =>
        (tx.type === "income" && tx.category !== "Piutang" && (!isScoped || scopedAccountNames.has(tx.account_name))) || isScopeTransferIn(tx);
    const isScopePiutangOffset = (tx) =>
        tx.type === "income" && tx.category === "Piutang" && (!isScoped || scopedAccountNames.has(tx.account_name));
    const isScopeExpense = (tx) =>
        tx.type === "expense" && (!isScoped || scopedAccountNames.has(tx.account_name));

    const income = filtered.filter(isScopeIncome).reduce((a, tx) => a + tx.amount, 0);
    const piutangOffset = filtered.filter(isScopePiutangOffset).reduce((a, tx) => a + tx.amount, 0);
    const expense = Math.max(0, filtered.filter(isScopeExpense).reduce((a, tx) => a + tx.amount, 0) - piutangOffset);
    const transferOut = filtered.filter(isScopeTransferOut).reduce((a, tx) => a + tx.amount, 0);
    const transfer = filtered.filter(tx => tx.type === "transfer").reduce((a, tx) => a + tx.amount, 0);
    const net = income - expense - transferOut;
    const savingRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

    const prevIncome = prevPeriodTxs.filter(isScopeIncome).reduce((a, tx) => a + tx.amount, 0);
    const prevPiutangOffset = prevPeriodTxs.filter(isScopePiutangOffset).reduce((a, tx) => a + tx.amount, 0);
    const prevExpense = Math.max(0, prevPeriodTxs.filter(isScopeExpense).reduce((a, tx) => a + tx.amount, 0) - prevPiutangOffset);
    const prevTransferOut = prevPeriodTxs.filter(isScopeTransferOut).reduce((a, tx) => a + tx.amount, 0);
    const prevNet = prevIncome - prevExpense - prevTransferOut;

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
    const isCurrentMonth = filterYear === String(now.getFullYear()) && filterMonth === String(now.getMonth() + 1).padStart(2, "0");
    const currentDay = now.getDate();
    const remainingDays = isCurrentMonth ? Math.max(1, daysInMonth - currentDay + 1) : 0;
    const isOngoingMonth = isCurrentMonth && remainingDays > 1;
    const safeDailyAllowance = isOngoingMonth && net > 0 ? Math.floor(net / remainingDays) : 0;
    const spentPct = income > 0 ? Math.min(100, Math.round(((expense + transferOut) / income) * 100)) : 0;

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
    filtered.filter(isScopePiutangOffset).forEach(tx => {
        catTotals.Piutang = Math.max(0, (catTotals.Piutang || 0) - tx.amount);
    });
    const sortedCats = Object.entries(catTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    const monthLabel = filterMonth ? MONTHS.find(m => m.v === filterMonth)?.l : "";
    const periodLabel = monthLabel && filterYear ? `${monthLabel} ${filterYear}` : filterYear || "Sepanjang masa";

    const activeDaysCount = Object.keys(dailyExpenseMap).length;
    const activityRate = daysInMonth > 0 ? Math.round((activeDaysCount / daysInMonth) * 100) : 0;

    const showHeatmap = !!filterMonth && daysInMonth > 0;

    /* ═══ KEBIASAAN & POLA BELANJA (mirrors apps/api/src/services/insights.ts) ═══ */
    const habitStats = useMemo(() => {
        const expRows = filtered.filter(isScopeExpense);
        const totalExp = expRows.reduce((s, r) => s + r.amount, 0);
        const countExp = expRows.length;
        const avgTx = countExp > 0 ? Math.round(totalExp / countExp) : 0;

        // Owner lookup from accounts
        const ownerByAcc = new Map();
        (accounts || []).forEach(a => {
            ownerByAcc.set(a.name, a.owner?.display_name || "Bersama");
        });

        // Weekday & WeekSplit (Mon-Fri vs Sat-Sun)
        const byWeekdayRaw = WEEKDAYS_ID.map((name, idx) => {
            const rs = expRows.filter(r => r.date && new Date(`${r.date}T00:00:00Z`).getUTCDay() === idx);
            const activeD = new Set(rs.map(r => r.date)).size;
            const tot = rs.reduce((s, r) => s + r.amount, 0);
            return { idx, weekday: name, total: tot, count: rs.length, activeDays: activeD, avgActive: activeD ? Math.round(tot / activeD) : 0 };
        });
        // Order Monday (1) -> Sunday (0)
        const byWeekday = [1, 2, 3, 4, 5, 6, 0].map(i => byWeekdayRaw[i]);
        const maxWeekdayTotal = Math.max(...byWeekday.map(d => d.total), 1);
        const peakWeekday = [...byWeekday].sort((a, b) => b.total - a.total)[0] || null;

        const weekendRows = expRows.filter(r => {
            if (!r.date) return false;
            const d = new Date(`${r.date}T00:00:00Z`).getUTCDay();
            return d === 0 || d === 6;
        });
        const weekendTotal = weekendRows.reduce((s, r) => s + r.amount, 0);
        const weekdayTotal = totalExp - weekendTotal;
        const allDates = new Set(expRows.map(r => r.date).filter(Boolean));
        const weekendActiveDays = [...allDates].filter(d => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())).length;
        const weekdayActiveDays = allDates.size - weekendActiveDays;
        const weekdayAvgActive = weekdayActiveDays > 0 ? Math.round(weekdayTotal / weekdayActiveDays) : 0;
        const weekendAvgActive = weekendActiveDays > 0 ? Math.round(weekendTotal / weekendActiveDays) : 0;

        // Items & Places (Merchants)
        const itemsMap = new Map();
        const placesMap = new Map();
        for (const r of expRows) {
            const { item, place } = splitItem(r.note || r.category || "");
            const k = `${normKey(item)}|${place ? normKey(place) : ""}`;
            const g = itemsMap.get(k) || { item, total: 0, count: 0, places: new Set(), category: r.category };
            g.total += r.amount;
            g.count += 1;
            if (place) g.places.add(place);
            itemsMap.set(k, g);

            if (place) {
                const pk = normKey(place);
                const p = placesMap.get(pk) || { place, total: 0, count: 0 };
                p.total += r.amount;
                p.count += 1;
                placesMap.set(pk, p);
            }
        }
        const allParsedItems = [...itemsMap.values()].map(g => ({
            item: g.item,
            place: [...g.places][0] || null,
            label: g.places.size ? `${g.item} (${[...g.places][0]})` : g.item,
            category: g.category,
            total: g.total,
            count: g.count,
            avg: Math.round(g.total / g.count),
        }));
        const topItems = [...allParsedItems].sort((a, b) => b.total - a.total || b.count - a.count).slice(0, 8);
        const repeatedItems = [...allParsedItems]
            .filter(i => i.count > 1 && i.item !== "(tanpa keterangan)")
            .sort((a, b) => b.count - a.count || b.total - a.total)
            .slice(0, 8);
        const topPlaces = [...placesMap.values()].sort((a, b) => b.total - a.total || b.count - a.count).slice(0, 6);

        // Culinary & Jajan Breakdown (Makan berat vs Camilan vs Minuman & es)
        const foodRows = expRows.filter(r =>
            /makan|jajan|kuliner|minum|kopi|warung|restoran|dapur|cemilan|camilan|snack/i.test(r.category || "") ||
            KIND_RULES.some(rule => rule.re.test(r.note || ""))
        );
        const foodTotal = foodRows.reduce((s, r) => s + r.amount, 0);
        const byKind = [
            { kind: "Makan berat", icon: "🍛", color: "#839B7A" },
            { kind: "Camilan", icon: "🥟", color: "#D9A74A" },
            { kind: "Minuman & es", icon: "🧋", color: "#4FC3F7" },
        ].map(meta => {
            const rs = foodRows.filter(r => kindOf(splitItem(r.note || r.category || "").item) === meta.kind);
            const tot = rs.reduce((s, r) => s + r.amount, 0);
            const sampleMap = new Map();
            rs.forEach(r => {
                const nm = splitItem(r.note || r.category || "").item;
                if (nm && nm !== "(tanpa keterangan)") {
                    sampleMap.set(nm, (sampleMap.get(nm) || 0) + r.amount);
                }
            });
            const topSamples = [...sampleMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm]) => nm);
            return {
                ...meta,
                total: tot,
                count: rs.length,
                pct: foodTotal > 0 ? Math.round((tot / foodTotal) * 100) : 0,
                samples: topSamples,
            };
        });

        // By Account Owner & By Beneficiary ("Untuk siapa")
        const ownerMap = new Map();
        const benMap = new Map();
        expRows.forEach(r => {
            const owner = ownerByAcc.get(r.account_name) || "Bersama";
            const og = ownerMap.get(owner) || { label: owner, total: 0, count: 0 };
            og.total += r.amount;
            og.count += 1;
            ownerMap.set(owner, og);

            const ben = r.beneficiary || null;
            if (ben) {
                const bg = benMap.get(ben) || { label: ben, total: 0, count: 0 };
                bg.total += r.amount;
                bg.count += 1;
                benMap.set(ben, bg);
            }
        });
        const byOwner = [...ownerMap.values()].sort((a, b) => b.total - a.total).map(g => ({
            ...g,
            pct: totalExp > 0 ? Math.round((g.total / totalExp) * 100) : 0,
        }));
        const byBeneficiary = [...benMap.values()].sort((a, b) => b.total - a.total).map(g => ({
            ...g,
            pct: totalExp > 0 ? Math.round((g.total / totalExp) * 100) : 0,
        }));

        return {
            totalExp, countExp, avgTx,
            byWeekday, maxWeekdayTotal, peakWeekday,
            weekdayTotal, weekendTotal, weekdayActiveDays, weekendActiveDays, weekdayAvgActive, weekendAvgActive,
            weekdayCount: countExp - weekendRows.length, weekendCount: weekendRows.length,
            topItems, repeatedItems, topPlaces,
            foodTotal, foodCount: foodRows.length, byKind,
            byOwner, byBeneficiary,
        };
    }, [filtered, accounts, isScoped, scopedAccountNames]);

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
                .lap-half     { grid-column: span 6; }

                @media (max-width: 1100px) {
                    .lap-hero, .lap-saving { grid-column: span 12; grid-row: auto; }
                    .lap-daily, .lap-heatmap { grid-column: span 12; }
                    .lap-breakdown, .lap-toplist, .lap-half { grid-column: span 12; }
                }
                @media (max-width: 720px) {
                    .lap-grid { grid-template-columns: repeat(6, 1fr); gap: 10px; }
                    .lap-hero, .lap-saving, .lap-stats, .lap-daily,
                    .lap-heatmap, .lap-breakdown, .lap-toplist, .lap-half {
                        grid-column: span 6 !important;
                        grid-row: auto !important;
                    }
                    .lap-header-controls { align-items: flex-start !important; width: 100%; }
                    .lap-header-actions { justify-content: flex-start !important; }
                    .lap-subtabs { flex-direction: column !important; gap: 4px !important; }
                    .lap-subtab-btn { flex: 1 1 auto !important; padding: 9px 12px !important; }
                    .lap-kpi-divider { width: 100% !important; height: 1px !important; }
                    .lap-kpi-row { flex-direction: column !important; gap: 14px !important; }
                }
            `}</style>

            <div style={{ animation: "fadeIn .4s" }}>
                <div style={{ marginBottom: 16 }}>
                    <ScopeSwitcher value={scope} onChange={setScope} />
                </div>

                {/* ═══ HEADER ═══ */}
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
                    <div>
                        <div style={{ ...eyebrow, marginBottom: 8 }}>EVALUASI & ANALITIK KELUARGA</div>
                        <h1 style={{ fontSize: "clamp(24px, 3.2vw, 34px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", margin: 0 }}>{t("rep.title")}</h1>
                        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span className="chip chip-mint" style={{ fontSize: 11, padding: "4px 12px" }}>
                                <span style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor", animation: "glow-pulse 2s infinite" }} />
                                {activeTab === "proyeksi" ? "Proyeksi Bulan Berjalan" : periodLabel}
                            </span>
                            <span>·</span>
                            <span>{activeTab === "proyeksi" ? "Berdasarkan tren 3 bulan terakhir" : `${filtered.length} transaksi`}</span>
                        </p>
                    </div>

                    {/* Period chips + custom selector + Export buttons */}
                    <div className="lap-header-controls" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        {activeTab !== "proyeksi" && (
                            <PeriodChips value={useCustom ? "" : quickPeriod} onChange={v => { setUseCustom(false); setQuickPeriod(v); }} />
                        )}
                        <div className="lap-header-actions" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {activeTab !== "proyeksi" && (
                                <>
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
                                </>
                            )}
                            <button
                                type="button"
                                disabled={filtered.length === 0}
                                onClick={() => {
                                    const slug = periodLabel.toLowerCase().replace(/\s+/g, "-");
                                    const ym = filterYear && filterMonth ? `${filterYear}-${filterMonth}` : "";
                                    const activeBudgetsList = scope.scope === "member" && personalBudgets.length > 0 ? personalBudgets : budgets;
                                    const budgetMap = ym
                                        ? Object.fromEntries(
                                              activeBudgetsList
                                                  .filter((b) => b.month === ym)
                                                  .map((b) => [b.category, b.amount]),
                                          )
                                        : undefined;
                                    const scopeLabel =
                                        scope.scope === "member"
                                            ? `Anggota: ${scope.member || "Pribadi"}`
                                            : scope.scope === "account"
                                              ? `Rekening: ${scope.account || ""}`
                                              : "Seluruh Keluarga";
                                    exportTransactionsExcel(filtered, {
                                        filename: `keluarga-berkembang-laporan-${slug}.xlsx`,
                                        periodLabel,
                                        scopeLabel,
                                        summary: { income: totalIncome, expense: totalExpense, net },
                                        budgetMap,
                                        accounts,
                                    });
                                }}
                                style={{
                                    padding: "6px 12px", borderRadius: 999,
                                    border: "1px solid rgba(131,155,122,.35)",
                                    background: "var(--color-primary-soft)",
                                    color: "var(--color-primary)",
                                    fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                                    cursor: filtered.length === 0 ? "not-allowed" : "pointer",
                                    opacity: filtered.length === 0 ? 0.45 : 1,
                                    display: "flex", alignItems: "center", gap: 5,
                                }}
                                title="Unduh Laporan & Transaksi dalam format Excel (.xlsx)"
                            >
                                📊 Export Excel
                            </button>
                            <button
                                type="button"
                                disabled={filtered.length === 0}
                                onClick={() => {
                                    const slug = periodLabel.toLowerCase().replace(/\s+/g, "-");
                                    exportTransactionsCSV(filtered, {
                                        filename: `keluarga-berkembang-laporan-${slug}.csv`,
                                        periodLabel,
                                    });
                                }}
                                style={{
                                    padding: "6px 11px", borderRadius: 999,
                                    border: "1px solid var(--glass-border)",
                                    background: "var(--glass-1)",
                                    color: "var(--color-text)",
                                    fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                                    cursor: filtered.length === 0 ? "not-allowed" : "pointer",
                                    opacity: filtered.length === 0 ? 0.45 : 1,
                                    display: "flex", alignItems: "center", gap: 4,
                                }}
                                title="Unduh transaksi periode ini dalam format CSV (.csv)"
                            >
                                📄 CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* ═══ 3 SUB-TABS (OPSI A: RINGKASAN · KEBIASAAN · PROYEKSI) ═══ */}
                <div className="lap-subtabs" style={{
                    display: "flex", gap: 6, padding: 5, borderRadius: 14,
                    background: "var(--glass-1)",
                    border: "1px solid var(--glass-border)",
                    marginBottom: 22,
                    overflowX: "auto",
                }}>
                    {[
                        { id: "ringkasan", icon: "📊", label: "Ringkasan & Tren", sub: "Arus kas, sisa kas & kalender" },
                        { id: "kebiasaan", icon: "🔍", label: "Kebiasaan & Pola Belanja", sub: "Kuliner, item berulang & toko" },
                        { id: "proyeksi", icon: "🧭", label: "Proyeksi Akhir Bulan", sub: "Tagihan rutin vs rem harian" },
                    ].map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                className="lap-subtab-btn"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    flex: "1 1 200px",
                                    display: "flex", alignItems: "center", gap: 12,
                                    padding: "11px 16px",
                                    borderRadius: 10,
                                    border: active ? "1px solid rgba(131,155,122,.32)" : "1px solid transparent",
                                    background: active ? "var(--color-primary-soft)" : "transparent",
                                    color: active ? "var(--color-text)" : "var(--color-muted)",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    textAlign: "left",
                                    transition: "all .18s",
                                }}
                            >
                                <span style={{
                                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                                    background: active ? "rgba(131,155,122,.22)" : "rgba(255,255,255,.04)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 16,
                                }}>{tab.icon}</span>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 13, fontWeight: 800,
                                        color: active ? "var(--color-primary)" : "var(--color-text)",
                                        letterSpacing: "-.01em",
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    }}>{tab.label}</div>
                                    <div style={{
                                        fontSize: 11, color: "var(--color-subtle)", marginTop: 2,
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    }}>{tab.sub}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* ═══ TAB 1: RINGKASAN & TREN ═══ */}
                {activeTab === "ringkasan" && (
                <div className="lap-grid">

                    {/* HERO KPI row */}
                    <div className="lap-hero" style={{
                        ...glassCard,
                        background: "var(--glass-hero)",
                        padding: "24px 22px",
                        borderRadius: 24,
                    }}>
                        {/* Ambient orb */}
                        <div style={{ position: "absolute", top: -100, right: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(131,155,122,.14), transparent 70%)", pointerEvents: "none", filter: "blur(8px)" }} />
                        <div style={{ position: "relative" }}>
                            <div style={{ ...eyebrow, marginBottom: 18 }}>RINGKASAN KEUANGAN</div>
                            <div className="lap-kpi-row" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                                <KpiCard
                                    label="Pemasukan"
                                    value={fmtRp(income)}
                                    delta={incomeDelta !== null ? `${incomeDelta >= 0 ? "+" : ""}${incomeDelta}%` : null}
                                    deltaGood={incomeDelta !== null && incomeDelta >= 0}
                                    icon="📈"
                                    accent="var(--color-primary)"
                                />
                                <div className="lap-kpi-divider" style={{ width: 1, background: "var(--glass-border)", alignSelf: "stretch" }} />
                                <KpiCard
                                    label="Pengeluaran"
                                    value={fmtRp(expense)}
                                    delta={expenseDelta !== null ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}%` : null}
                                    deltaGood={expenseDelta !== null && expenseDelta < 0}
                                    icon="📉"
                                    accent="var(--color-expense)"
                                />
                                <div className="lap-kpi-divider" style={{ width: 1, background: "var(--glass-border)", alignSelf: "stretch" }} />
                                <KpiCard
                                    label={isOngoingMonth ? "Sisa Kas Bulan Ini" : "Saldo Bersih"}
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

                    {/* Saving rate / Sisa Kas ring */}
                    <div className="lap-saving" style={{
                        ...glassCard,
                        background: "linear-gradient(145deg, var(--color-primary-soft), rgba(70,99,78,.03))",
                        border: "1px solid var(--color-primary-soft)",
                        borderRadius: 24,
                        padding: "28px 24px",
                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                                <div style={eyebrow}>{isOngoingMonth ? "Sisa Kas vs Pemasukan" : "Saving Rate"}</div>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginTop: 6, letterSpacing: "-.02em" }}>{periodLabel}</h3>
                            </div>
                            <span className={isOngoingMonth ? (net >= 0 ? "chip chip-mint" : "chip chip-red") : (savingRate >= 20 ? "chip chip-mint" : savingRate >= 10 ? "chip chip-amber" : "chip chip-red")}>
                                {isOngoingMonth
                                    ? (net >= 0 ? `⏳ Sisa ${remainingDays} hr` : "Overbudget ⚠️")
                                    : (savingRate >= 20 ? "Mantap 👍" : savingRate >= 10 ? "Cukup" : "Tingkatkan")}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16 }}>
                            <SavingRing rate={savingRate} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 6, fontWeight: 600 }}>
                                    {isOngoingMonth ? (
                                        <>Terpakai: <strong style={{ color: "var(--color-text)" }}>{spentPct}%</strong> dari pemasukan</>
                                    ) : (
                                        <>Target ideal: <strong style={{ color: "var(--color-primary)" }}>20%+</strong></>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6 }}>
                                    {isOngoingMonth
                                        ? (net > 0
                                            ? `Kas tersisa untuk ${remainingDays} hari ke depan. Jatah harian aman: ~${fmtRp(safeDailyAllowance)}/hari.`
                                            : income > 0
                                                ? "Pengeluaran sudah melewati pemasukan bulan ini. Rem pengeluaran non-prioritas."
                                                : "Belum ada pemasukan tercatat di bulan ini.")
                                        : (savingRate >= 20
                                            ? "Kamu sudah di zona aman. Pertahankan rasio tabungan keluarga."
                                            : savingRate >= 10
                                                ? "Masih bisa dioptimalkan. Cek kategori pengeluaran terbesar untuk prioritas hemat."
                                                : income > 0
                                                    ? "Pengeluaran hampir sama dengan pemasukan. Fokus kurangi pengeluaran bulan depan."
                                                    : "Belum ada pemasukan di periode ini.")}
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
                                                        : "linear-gradient(to top,var(--color-primary-deep),var(--color-primary))";
                                            return (
                                                <div key={day}
                                                    title={val > 0 ? `${day} ${periodLabel}: ${fmtRp(val)}` : `${day}: tidak ada pengeluaran`}
                                                    style={{ flex: 1, minWidth: 4, height: val === 0 ? 2 : `${hPct}%`, borderRadius: "3px 3px 0 0", background: bg, opacity: val === 0 ? 0.25 : 1, transition: "height .5s ease", cursor: "default", alignSelf: "flex-end", boxShadow: val > 0 ? "0 0 8px var(--color-primary-soft)" : "none" }}
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
                                        { bg: "linear-gradient(to top,var(--color-primary-deep),var(--color-primary))", l: "Normal" },
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
                                                boxShadow: i === 0 ? "0 4px 10px rgba(131,155,122,.28), inset 0 1px 0 rgba(255,255,255,.25)" : "none",
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
                )}

                {/* ═══ TAB 2: KEBIASAAN & POLA BELANJA ═══ */}
                {activeTab === "kebiasaan" && (
                    <div className="lap-grid" style={{ animation: "fadeIn .3s" }}>
                        {/* Auto-Narrative Insight Banner */}
                        <div className="lap-stats" style={{
                            ...glassCard,
                            background: "linear-gradient(135deg, rgba(131,155,122,.10) 0%, rgba(200,125,85,.06) 100%)",
                            border: "1px solid rgba(131,155,122,.22)",
                            padding: "22px 26px",
                            borderRadius: 22,
                        }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                    background: "rgba(131,155,122,.18)",
                                    border: "1px solid rgba(131,155,122,.28)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 20,
                                }}>🔍</div>
                                <div style={{ flex: 1, minWidth: 220 }}>
                                    <div style={{ ...eyebrow, color: "var(--color-primary)", marginBottom: 6 }}>RINGKASAN KEBIASAAN BELANJA · {periodLabel}</div>
                                    {habitStats.countExp === 0 ? (
                                        <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
                                            Belum ada catatan pengeluaran di periode <strong>{periodLabel}</strong>. Catat struk atau pengeluaran harian supaya pola belanja keluarga terbaca otomatis.
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.65 }}>
                                            Sepanjang <strong>{periodLabel}</strong>, tercatat <strong>{habitStats.countExp}x pengeluaran</strong> senilai total{" "}
                                            <strong className="mono num-tight" style={{ color: "var(--color-primary)" }}>{fmtRp(habitStats.totalExp)}</strong>{" "}
                                            (rata-rata <strong className="mono num-tight">{fmtRp(habitStats.avgTx)}</strong>/transaksi).
                                            {habitStats.peakWeekday && habitStats.peakWeekday.total > 0 && (
                                                <> Hari dengan pengeluaran tertinggi jatuh pada hari <strong>{habitStats.peakWeekday.weekday}</strong> (<span className="mono num-tight">{fmtRp(habitStats.peakWeekday.total)}</span>).</>
                                            )}
                                            {habitStats.repeatedItems.length > 0 && (
                                                <> Item yang paling sering dibeli berulang adalah <strong>{habitStats.repeatedItems[0].label}</strong> ({habitStats.repeatedItems[0].count}x · <span className="mono num-tight">{fmtRp(habitStats.repeatedItems[0].total)}</span>).</>
                                            )}
                                            {habitStats.topPlaces.length > 0 && (
                                                <> Tempat/toko langganan teratas: <strong>{habitStats.topPlaces[0].place}</strong> ({habitStats.topPlaces[0].count}x kunjungan).</>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Card 1: Pola Hari Kerja vs Akhir Pekan + Grafik 7 Hari */}
                        <div className="lap-breakdown" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20 }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={eyebrow}>RITME MINGGUAN</div>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", margin: "6px 0 0", letterSpacing: "-.02em" }}>
                                    Hari Kerja vs Akhir Pekan
                                </h3>
                                <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                    Perbandingan rata-rata belanja di hari aktif & distribusi Senin–Minggu
                                </p>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 18 }}>
                                <div style={{
                                    padding: "14px 16px", borderRadius: 14,
                                    background: "rgba(131,155,122,.07)",
                                    border: "1px solid rgba(131,155,122,.18)",
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)" }}>💼 Hari Kerja (Sen–Jum)</div>
                                    <div className="mono num-tight" style={{ fontSize: 18, fontWeight: 900, color: "var(--color-text)", marginTop: 6 }}>
                                        {fmtRp(habitStats.weekdayTotal)}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                        {habitStats.weekdayCount}x transaksi · rata-rata <strong style={{ color: "var(--color-text)" }}>{fmtRp(habitStats.weekdayAvgActive)}</strong>/hari aktif
                                    </div>
                                </div>
                                <div style={{
                                    padding: "14px 16px", borderRadius: 14,
                                    background: "rgba(217,167,74,.08)",
                                    border: "1px solid rgba(217,167,74,.22)",
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)" }}>🌴 Akhir Pekan (Sab–Min)</div>
                                    <div className="mono num-tight" style={{ fontSize: 18, fontWeight: 900, color: "var(--color-text)", marginTop: 6 }}>
                                        {fmtRp(habitStats.weekendTotal)}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                        {habitStats.weekendCount}x transaksi · rata-rata <strong style={{ color: "var(--color-text)" }}>{fmtRp(habitStats.weekendAvgActive)}</strong>/hari aktif
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                {habitStats.byWeekday.map((d) => {
                                    const pct = habitStats.totalExp > 0 ? Math.round((d.total / habitStats.totalExp) * 100) : 0;
                                    const barW = habitStats.maxWeekdayTotal > 0 ? Math.round((d.total / habitStats.maxWeekdayTotal) * 100) : 0;
                                    const isPeak = habitStats.peakWeekday && habitStats.peakWeekday.weekday === d.weekday && d.total > 0;
                                    const isWeekend = d.idx === 0 || d.idx === 6;
                                    return (
                                        <div key={d.weekday}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span style={{ fontWeight: 700, color: isPeak ? "var(--color-expense)" : "var(--color-text)", minWidth: 58 }}>{d.weekday}</span>
                                                    <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>{d.count}x</span>
                                                    {isPeak && <span className="chip chip-red" style={{ fontSize: 9, padding: "1px 7px" }}>Puncak</span>}
                                                </div>
                                                <div className="mono num-tight" style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)" }}>
                                                    {fmtRp(d.total)} <span style={{ color: "var(--color-subtle)", fontWeight: 500 }}>({pct}%)</span>
                                                </div>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 99, background: "var(--bg-sunk)", overflow: "hidden" }}>
                                                <div style={{
                                                    height: "100%", borderRadius: 99,
                                                    width: `${barW}%`,
                                                    background: isPeak
                                                        ? "linear-gradient(90deg, #e04f4f, #ff716c)"
                                                        : isWeekend
                                                            ? "linear-gradient(90deg, #d97706, #D9A74A)"
                                                            : "linear-gradient(90deg, var(--color-primary-deep), var(--color-primary))",
                                                    transition: "width .6s ease",
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Card 2: Bedah Kuliner & Jajan Keluarga */}
                        <div className="lap-toplist" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20 }}>
                            <div style={{ marginBottom: 14 }}>
                                <div style={eyebrow}>BEDAH KULINER & JAJAN</div>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", margin: "6px 0 0", letterSpacing: "-.02em" }}>
                                    Makan Berat vs Camilan vs Minuman
                                </h3>
                                <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                    Total kuliner & jajan: <strong className="mono num-tight" style={{ color: "var(--color-text)" }}>{fmtRp(habitStats.foodTotal)}</strong> ({habitStats.foodCount}x)
                                </p>
                            </div>

                            {habitStats.foodCount === 0 ? (
                                <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 12, gap: 8, textAlign: "center" }}>
                                    <div style={{ fontSize: 30, opacity: .4 }}>🍛</div>
                                    Belum ada transaksi kategori Makanan/Minuman/Jajanan di periode ini.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {habitStats.byKind.map((k) => (
                                        <div key={k.kind} style={{
                                            padding: "13px 15px", borderRadius: 14,
                                            background: "rgba(255,255,255,.025)",
                                            border: "1px solid var(--glass-border)",
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                                    <span style={{
                                                        width: 30, height: 30, borderRadius: 9,
                                                        background: `color-mix(in srgb, ${k.color} 16%, transparent)`,
                                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                                                    }}>{k.icon}</span>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>{k.kind}</div>
                                                        <div style={{ fontSize: 10, color: "var(--color-subtle)" }}>{k.count}x transaksi</div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: "right" }}>
                                                    <div className="mono num-tight" style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>{fmtRp(k.total)}</div>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: k.color }}>{k.pct}% dari kuliner</div>
                                                </div>
                                            </div>
                                            <div style={{ height: 5, borderRadius: 99, background: "var(--bg-sunk)", overflow: "hidden", marginBottom: k.samples.length > 0 ? 8 : 0 }}>
                                                <div style={{ height: "100%", width: `${k.pct}%`, background: k.color, borderRadius: 99 }} />
                                            </div>
                                            {k.samples.length > 0 && (
                                                <div style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", gap: 5, flexWrap: "wrap" }}>
                                                    <span style={{ color: "var(--color-subtle)" }}>Contoh:</span>
                                                    {k.samples.map((s) => (
                                                        <span key={s} style={{
                                                            padding: "1px 7px", borderRadius: 6,
                                                            background: "rgba(255,255,255,.04)",
                                                            border: "1px solid var(--glass-border)",
                                                            fontSize: 10,
                                                        }}>{s}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Card 3: Item Berulang & Barang Terbesar */}
                        <div className="lap-half" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                                <div>
                                    <div style={eyebrow}>DETEKSI CATATAN & STRUK</div>
                                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", margin: "6px 0 0", letterSpacing: "-.02em" }}>
                                        {itemRankMode === "repeated" ? "Item yang Sering Dibeli Berulang" : "Item Pengeluaran Terbesar"}
                                    </h3>
                                    <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                        Diekstrak otomatis dari catatan transaksi & struk belanja
                                    </p>
                                </div>
                                <ChartToggle
                                    value={itemRankMode}
                                    options={[
                                        { v: "repeated", icon: "🔁", l: "Berulang" },
                                        { v: "top", icon: "💰", l: "Terbesar" },
                                    ]}
                                    onChange={setItemRankMode}
                                />
                            </div>

                            {(() => {
                                const list = itemRankMode === "repeated"
                                    ? (habitStats.repeatedItems.length > 0 ? habitStats.repeatedItems : habitStats.topItems)
                                    : habitStats.topItems;
                                if (list.length === 0) {
                                    return (
                                        <div style={{ height: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 12, gap: 8 }}>
                                            <div style={{ fontSize: 28, opacity: .4 }}>🧾</div>
                                            Belum ada rincian item di periode ini.
                                        </div>
                                    );
                                }
                                return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {itemRankMode === "repeated" && habitStats.repeatedItems.length === 0 && (
                                            <div style={{ fontSize: 11, color: "var(--color-amber)", marginBottom: 4 }}>
                                                Belum ada item yang dibeli ≥ 2x di periode ini — menampilkan item dengan nilai terbesar:
                                            </div>
                                        )}
                                        {list.slice(0, 6).map((it, idx) => (
                                            <div key={`${it.label}-${idx}`} style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                                                padding: "10px 12px", borderRadius: 12,
                                                background: "rgba(255,255,255,.02)",
                                                border: "1px solid var(--glass-border)",
                                            }}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {it.item}
                                                        </span>
                                                        {it.place && (
                                                            <span className="chip chip-ghost" style={{ fontSize: 10, padding: "1px 7px" }}>
                                                                🏪 {it.place}
                                                            </span>
                                                        )}
                                                        {it.count > 1 && (
                                                            <span className="chip chip-mint" style={{ fontSize: 10, padding: "1px 7px" }}>
                                                                {it.count}x beli
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 3 }}>
                                                        {it.category} · rata-rata <span className="mono num-tight">{fmtRp(it.avg)}</span>/beli
                                                    </div>
                                                </div>
                                                <div className="mono num-tight" style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", flexShrink: 0 }}>
                                                    {fmtRp(it.total)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Card 4: Toko / Merchant Langganan + Distribusi Anggota */}
                        <div className="lap-half" style={{ ...glassCard, padding: "22px 24px", borderRadius: 20, display: "flex", flexDirection: "column", gap: 18 }}>
                            <div>
                                <div style={eyebrow}>TOKO & ANGGOTA KELUARGA</div>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", margin: "6px 0 0", letterSpacing: "-.02em" }}>
                                    Merchant Langganan & Pemilik Akun
                                </h3>
                                <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
                                    Toko dari hasil scan struk (`[Nama Toko]`) & pembagian pengeluaran per anggota
                                </p>
                            </div>

                            {/* Top Places / Merchants */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8 }}>
                                    🏪 Toko / Warung yang Paling Sering Dikunjungi
                                </div>
                                {habitStats.topPlaces.length === 0 ? (
                                    <div style={{
                                        padding: "12px 14px", borderRadius: 12,
                                        background: "rgba(255,255,255,.02)", border: "1px dashed var(--glass-border)",
                                        fontSize: 11, color: "var(--color-subtle)",
                                    }}>
                                        Tips: Gunakan fitur <strong>Scan Struk</strong> atau tulis nama toko di catatan (contoh: <code>[Indomaret] Susu UHT</code> atau <code>Bakso (Bakso Mas Boy)</code>) agar toko langganan terekam otomatis.
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                                        {habitStats.topPlaces.map((p, idx) => (
                                            <div key={p.place} style={{
                                                padding: "10px 12px", borderRadius: 12,
                                                background: idx === 0 ? "rgba(131,155,122,.08)" : "rgba(255,255,255,.02)",
                                                border: "1px solid var(--glass-border)",
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {p.place}
                                                    </span>
                                                    <span className="chip chip-mint" style={{ fontSize: 9, padding: "1px 6px" }}>{p.count}x</span>
                                                </div>
                                                <div className="mono num-tight" style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", marginTop: 4 }}>
                                                    {fmtRp(p.total)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* By Account Owner & Beneficiary */}
                            <div style={{ paddingTop: 12, borderTop: "1px solid var(--glass-border)" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8 }}>
                                    👨‍👩‍👧‍👦 Proporsi Pengeluaran per Anggota / Dompet
                                </div>
                                {habitStats.byOwner.length === 0 ? (
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>Belum ada data pengeluaran.</div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {habitStats.byOwner.map((o, idx) => {
                                            const c = CAT_COLORS[idx % CAT_COLORS.length];
                                            return (
                                                <div key={o.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />
                                                        <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{o.label}</span>
                                                        <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>({o.count}x)</span>
                                                    </div>
                                                    <div className="mono num-tight" style={{ fontWeight: 700, color: "var(--color-muted)" }}>
                                                        {fmtRp(o.total)} <span style={{ color: c }}>({o.pct}%)</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {habitStats.byBeneficiary.length > 0 && (
                                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--glass-border)" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 6 }}>
                                            🎁 Rincian Peruntukan ("Untuk Siapa")
                                        </div>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            {habitStats.byBeneficiary.map((b) => (
                                                <span key={b.label} className="chip chip-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                                                    <strong>{b.label}</strong>: {fmtRp(b.total)} ({b.count}x)
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB 3: PROYEKSI AKHIR BULAN (EMBEDDED PREDIKSIVIEW) ═══ */}
                {activeTab === "proyeksi" && (
                    <div style={{ animation: "fadeIn .3s" }}>
                        <PrediksiView
                            transactions={allTransactions}
                            budgets={budgets}
                            personalBudgets={personalBudgets}
                            accounts={accounts}
                            embedded={true}
                            externalScope={scope}
                        />
                    </div>
                )}
            </div>
        </>
    );
};

export default LaporanView;
