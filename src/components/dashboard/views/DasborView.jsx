import { fmtRp, fmtDate } from "../../../utils/formatters";
import { categoryColors } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";

/* ═══════════════════════════════════════════════════════════════
 * ASYMMETRIC BENTO DESIGN
 *
 * 12-column responsive grid. Cards have wildly different sizes
 * (span 4-12 cols, 1-2 rows) and distinct personalities:
 *  - Hero      : huge, gradient border, ambient orbs
 *  - Filled    : colored tint background
 *  - Outline   : transparent, dashed/solid border
 *  - Glass     : frosted translucent
 *  - Gradient  : mint→blue gradient fill
 * ═══════════════════════════════════════════════════════════════ */

/* ─── Shared tokens ─── */
const cardBase = {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: "24px 26px",
    display: "flex",
    flexDirection: "column",
};

const glassCard = {
    ...cardBase,
    background: "var(--glass-1)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-highlight), 0 2px 8px rgba(0,0,0,.08)",
};

const eyebrow = {
    fontSize: 10,
    fontWeight: 800,
    color: "var(--color-subtle)",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    lineHeight: 1,
};

const sectionTitle = {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--color-text)",
    letterSpacing: "-.02em",
    margin: 0,
    lineHeight: 1.2,
};

/* ═══ Smooth SVG area chart ═══ */
function AreaChart({ transactions }) {
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();

    const data = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(y, m - (5 - i), 1);
        const mo = date.getMonth(), yr = date.getFullYear();
        const txM = transactions.filter(tx => {
            const dateStr = (tx.date || "").slice(0, 10);
            const [txY, txM2] = dateStr.split("-").map(Number);
            return txM2 - 1 === mo && txY === yr;
        });
        return {
            label: date.toLocaleString("id-ID", { month: "short" }),
            income: txM.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0),
            expense: txM.filter(tx => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0),
        };
    });

    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
    const hasAnyData = data.some(d => d.income > 0 || d.expense > 0);
    const W = 560, H = 170, PAD = 10;

    const toPath = (values, close = false) => {
        const pts = values.map((v, i) => {
            const x = PAD + (i * (W - 2 * PAD)) / (values.length - 1);
            const y = H - PAD - ((v / maxVal) * (H - 2 * PAD - 10));
            return [x, y];
        });
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) {
            const [x1, y1] = pts[i - 1];
            const [x2, y2] = pts[i];
            const cx = (x1 + x2) / 2;
            d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
        }
        if (close) d += ` L ${pts[pts.length - 1][0]} ${H - PAD} L ${pts[0][0]} ${H - PAD} Z`;
        return d;
    };

    return (
        <div style={{ ...glassCard, minHeight: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                    <div style={eyebrow}>Arus Kas · 6 Bulan</div>
                    <h3 style={{ ...sectionTitle, fontSize: 18, marginTop: 8 }}>Pemasukan vs Pengeluaran</h3>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-muted)", fontWeight: 600 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-primary)", boxShadow: "0 0 10px var(--color-primary)" }} />Masuk
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-muted)", fontWeight: 600 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-expense)", boxShadow: "0 0 10px var(--color-expense)" }} />Keluar
                    </span>
                </div>
            </div>

            {!hasAnyData ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13 }}>
                    Belum ada data transaksi
                </div>
            ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
                        <defs>
                            <linearGradient id="incomeGrad" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity=".45" />
                                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="expenseGrad" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-expense)" stopOpacity=".32" />
                                <stop offset="100%" stopColor="var(--color-expense)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {[0.25, 0.5, 0.75].map(f => (
                            <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - 2 * PAD - 10)} y2={PAD + f * (H - 2 * PAD - 10)}
                                stroke="var(--color-border-soft)" strokeWidth="1" strokeDasharray="2 4" />
                        ))}
                        <path d={toPath(data.map(d => d.income), true)} fill="url(#incomeGrad)" />
                        <path d={toPath(data.map(d => d.expense), true)} fill="url(#expenseGrad)" />
                        <path d={toPath(data.map(d => d.income))} stroke="var(--color-primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        <path d={toPath(data.map(d => d.expense))} stroke="var(--color-expense)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        {data.map((d, i) => {
                            const x = PAD + (i * (W - 2 * PAD)) / (data.length - 1);
                            const yIn = H - PAD - ((d.income / maxVal) * (H - 2 * PAD - 10));
                            const yEx = H - PAD - ((d.expense / maxVal) * (H - 2 * PAD - 10));
                            const current = i === data.length - 1;
                            return (
                                <g key={i}>
                                    <circle cx={x} cy={yIn} r={current ? 5 : 3} fill="var(--color-primary)" stroke="var(--glass-1)" strokeWidth={current ? 3 : 1.5} />
                                    <circle cx={x} cy={yEx} r={current ? 5 : 3} fill="var(--color-expense)" stroke="var(--glass-1)" strokeWidth={current ? 3 : 1.5} />
                                </g>
                            );
                        })}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, padding: "0 4px" }}>
                        {data.map((d, i) => (
                            <span key={i} style={{
                                fontSize: 10,
                                fontWeight: i === data.length - 1 ? 800 : 600,
                                color: i === data.length - 1 ? "var(--color-text)" : "var(--color-subtle)",
                                textTransform: "capitalize",
                                letterSpacing: .5,
                            }}>{d.label}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══ Mini sparkline ═══ */
function MiniSpark({ values, color = "var(--color-primary)", width = 200, height = 54 }) {
    if (!values || values.length < 2) return <div style={{ width, height }} />;
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
        const x = (i * width) / (values.length - 1);
        const y = height - 4 - ((v - min) / range) * (height - 10);
        return [x, y];
    });
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1];
        const [x2, y2] = pts[i];
        const cx = (x1 + x2) / 2;
        d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }
    const fill = `${d} L ${width} ${height} L 0 ${height} Z`;
    const lastPt = pts[pts.length - 1];
    return (
        <svg width={width} height={height} style={{ display: "block" }}>
            <defs>
                <linearGradient id={`spk-${color.replace(/[^a-z]/gi, '')}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity=".45" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={fill} fill={`url(#spk-${color.replace(/[^a-z]/gi, '')})`} />
            <path d={d} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill={color} stroke="var(--glass-hero)" strokeWidth="2.5" />
        </svg>
    );
}

/* ═══ Fallback palette — cycles through distinct colors for custom categories ═══ */
const FALLBACK_PALETTE = [
    "#60fcc6", // mint
    "#a78bfa", // purple
    "#4FC3F7", // sky blue
    "#f59e0b", // amber
    "#ff716c", // red
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f97316", // orange
    "#6366f1", // indigo
    "#22c55e", // green
];
const colorForCategory = (cat, index) =>
    categoryColors[cat] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];

/* ═══ Donut chart ═══ */
function CategoryDonut({ sortedCats, totalExpense }) {
    if (sortedCats.length === 0) return null;
    const top5 = sortedCats.slice(0, 5);
    const R = 42, CX = 60, CY = 60, STROKE = 14;
    const CIRC = 2 * Math.PI * R;
    let offset = 0;
    const segments = top5.map(([cat, amt], i) => {
        const pct = totalExpense > 0 ? amt / totalExpense : 0;
        const dash = pct * CIRC;
        const seg = { dash, offset, color: colorForCategory(cat, i), cat, amt, pct };
        offset += dash;
        return seg;
    });
    return (
        <svg width="120" height="120" style={{ display: "block" }}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-border-soft)" strokeWidth={STROKE} />
            {segments.map((s, i) => (
                <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                    stroke={s.color} strokeWidth={STROKE}
                    strokeDasharray={`${s.dash} ${CIRC}`}
                    strokeDashoffset={-s.offset}
                    transform={`rotate(-90 ${CX} ${CY})`}
                    strokeLinecap="butt"
                />
            ))}
        </svg>
    );
}

/* ═══ Main DasborView ═══ */
const DasborView = ({
    accounts, transactions, goals, investments = [], debts = [], budgets = [],
    totalBalance, totalIncome, totalExpense, netBalance, savingRate, expenseRate,
    sortedCats, setActiveMenu, setShowAddAccount, setShowAddTx, customCategories = []
}) => {
    const { t } = useLanguage();

    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const lm = m === 0 ? 11 : m - 1, ly = m === 0 ? y - 1 : y;

    const txThis = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === m && d.getFullYear() === y; });
    const txLast = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === lm && d.getFullYear() === ly; });

    const thisIncome = txThis.filter(tx => tx.type === "income").reduce((a, tx) => a + tx.amount, 0);
    const thisExpense = txThis.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const lastIncome = txLast.filter(tx => tx.type === "income").reduce((a, tx) => a + tx.amount, 0);
    const lastExpense = txLast.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const thisNet = thisIncome - thisExpense;

    const pctChange = (cur, prev) => {
        if (prev === 0 || cur === 0) return null;
        const val = Math.round(((cur - prev) / prev) * 100);
        return (val >= 0 ? "+" : "") + val + "%";
    };
    const incomePct = pctChange(thisIncome, lastIncome);
    const expensePct = pctChange(thisExpense, lastExpense);
    const thisSavingRate = thisIncome > 0 ? Math.round((1 - thisExpense / thisIncome) * 100) : 0;

    const tabunganAccountNames = new Set(accounts.filter(a => a.type === "tabungan").map(a => a.name));
    const investmentSaving = investments.filter(inv => { const d = new Date(inv.created_at); return d.getMonth() === m && d.getFullYear() === y; }).reduce((s, inv) => s + (inv.buy_price || 0), 0);
    const tabunganSaving = txThis.filter(tx => tx.type === "income" && tabunganAccountNames.has(tx.account_name)).reduce((s, tx) => s + tx.amount, 0);
    const actualSavingAmt = investmentSaving + tabunganSaving;
    const actualSavingRate = thisIncome > 0 ? Math.round((actualSavingAmt / thisIncome) * 100) : 0;

    const activeGoals = goals.filter(g => g.current < g.target).length;
    const achievedGoals = goals.filter(g => g.current >= g.target).length;
    const totalDebtRemaining = debts.reduce((a, d) => a + (d.remaining || 0), 0);
    const overBudgets = budgets.filter(b => {
        const spent = txThis.filter(tx => tx.category === b.category && tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
        return spent > b.amount;
    }).length;

    const sparkData = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(y, m - (5 - i), 1);
        const mo = date.getMonth(), yr = date.getFullYear();
        const txM = transactions.filter(tx => {
            const ds = (tx.date || "").slice(0, 10);
            const [txY, txM2] = ds.split("-").map(Number);
            return txM2 - 1 === mo && txY === yr;
        });
        const inc = txM.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const exp = txM.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return inc - exp;
    });

    const acctAccent = (a) => {
        if (a.type === "bank") return "var(--color-primary)";
        if (a.type === "ewallet") return "var(--color-purple)";
        if (a.type === "cash") return "var(--color-amber)";
        if (a.type === "tabungan") return "var(--color-transfer)";
        return a.color || "var(--color-primary)";
    };

    const greeting = (() => {
        const h = now.getHours();
        if (h < 11) return "Selamat pagi";
        if (h < 15) return "Selamat siang";
        if (h < 18) return "Selamat sore";
        return "Selamat malam";
    })();

    const sortedGoals = [...goals.filter(g => g.current < g.target)].sort((a, b) => {
        if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return (b.current / b.target) - (a.current / a.target);
    }).slice(0, 2);

    return (
        <>
            <style>{`
                .bento-grid {
                    display: grid;
                    grid-template-columns: repeat(12, 1fr);
                    grid-auto-rows: minmax(92px, auto);
                    gap: 14px;
                    animation: fadeIn .5s ease;
                }
                .b-hero       { grid-column: span 8; grid-row: span 2; }
                .b-ring       { grid-column: span 4; grid-row: span 1; }
                .b-target-mini{ grid-column: span 4; grid-row: span 1; }
                .b-income     { grid-column: span 4; }
                .b-expense    { grid-column: span 4; }
                .b-net        { grid-column: span 4; }
                .b-accounts   { grid-column: span 12; }
                .b-chart      { grid-column: span 8; grid-row: span 2; }
                .b-tx         { grid-column: span 4; grid-row: span 2; }
                .b-cats       { grid-column: span 5; }
                .b-goals      { grid-column: span 4; }
                .b-debts      { grid-column: span 3; }
                .b-health     { grid-column: span 12; }

                @media (max-width: 1100px) {
                    .b-hero       { grid-column: span 12; }
                    .b-ring       { grid-column: span 6; }
                    .b-target-mini{ grid-column: span 6; }
                    .b-income, .b-expense, .b-net { grid-column: span 4; }
                    .b-chart      { grid-column: span 12; }
                    .b-tx         { grid-column: span 12; grid-row: span 1; }
                    .b-cats       { grid-column: span 12; }
                    .b-goals      { grid-column: span 6; }
                    .b-debts      { grid-column: span 6; }
                }
                @media (max-width: 720px) {
                    .bento-grid   { grid-template-columns: repeat(6, 1fr); gap: 10px; grid-auto-rows: minmax(auto, auto); }
                    .b-hero       { grid-column: span 6 !important; grid-row: auto !important; padding: 20px 18px !important; }
                    .b-ring, .b-target-mini { grid-column: span 6 !important; grid-row: auto !important; }
                    .b-income, .b-expense, .b-net { grid-column: span 6 !important; grid-row: auto !important; }
                    .b-accounts   { grid-column: span 6 !important; grid-row: auto !important; }
                    .b-chart      { grid-column: span 6 !important; grid-row: auto !important; min-height: 300px; }
                    .b-tx         { grid-column: span 6 !important; grid-row: auto !important; }
                    .b-cats, .b-goals, .b-debts { grid-column: span 6 !important; grid-row: auto !important; }
                    .b-health     { grid-column: span 6 !important; grid-row: auto !important; }
                    .hero-number  { font-size: clamp(34px, 11vw, 52px) !important; }
                }
                @media (max-width: 480px) {
                    .hero-number  { font-size: clamp(30px, 10vw, 44px) !important; letter-spacing: -.04em !important; }
                }
            `}</style>

            <div className="bento-grid">

                {/* ═══════════════════════════════════════════════════════
                 * 1. HERO — gigantic net-worth display
                 * Span: 8×2. Gradient border, floating orbs, big typography.
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-hero bento-glow" style={{
                    ...cardBase,
                    padding: "34px 40px",
                    background: "var(--glass-hero)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-highlight), 0 16px 48px rgba(0,0,0,.15)",
                    borderRadius: 32,
                    justifyContent: "space-between",
                }}>
                    {/* Ambient orbs */}
                    <div style={{ position: "absolute", top: -120, right: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,252,198,.22), transparent 70%)", pointerEvents: "none", filter: "blur(10px)" }} />
                    <div style={{ position: "absolute", bottom: -80, left: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,.14), transparent 70%)", pointerEvents: "none", filter: "blur(10px)" }} />

                    {/* Top row */}
                    <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ fontSize: 15, color: "var(--color-muted)", fontWeight: 500, marginBottom: 8, letterSpacing: "-.01em" }}>
                                {greeting} <span style={{ marginLeft: 2 }}>👋</span>
                            </div>
                            <div style={eyebrow}>Total Saldo · Kekayaan Bersih</div>
                        </div>
                        <span className="chip chip-mint" style={{ fontSize: 11, padding: "6px 14px" }}>
                            <span style={{ width: 7, height: 7, borderRadius: 99, background: "currentColor", animation: "glow-pulse 2s infinite" }} />
                            LIVE
                        </span>
                    </div>

                    {/* Massive number */}
                    <div style={{ position: "relative", margin: "16px 0" }}>
                        <div className="num-tight hero-number" style={{
                            fontSize: "clamp(48px, 7vw, 96px)",
                            fontWeight: 900,
                            color: "var(--color-text)",
                            lineHeight: .92,
                            letterSpacing: "-.045em",
                            animation: "count-up .7s ease",
                        }}>
                            {fmtRp(totalBalance)}
                        </div>
                    </div>

                    {/* Bottom row: sparkline + pills */}
                    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span className="chip chip-ghost" style={{ padding: "6px 12px", background: "var(--bg-surface-low)" }}>
                                🏦 {accounts.length} akun
                            </span>
                            <span className="chip chip-ghost" style={{ padding: "6px 12px", background: "var(--bg-surface-low)" }}>
                                💳 {txThis.length} transaksi bulan ini
                            </span>
                            {thisNet !== 0 && (
                                <span className={thisNet >= 0 ? "chip chip-mint" : "chip chip-red"} style={{ padding: "6px 12px", fontWeight: 800 }}>
                                    {thisNet >= 0 ? "↑" : "↓"} {thisNet >= 0 ? "+" : "-"}{fmtRp(Math.abs(thisNet))} bulan ini
                                </span>
                            )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                            <div style={{ fontSize: 9, color: "var(--color-subtle)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 6 }}>Trend · 6 bulan</div>
                            <MiniSpark values={sparkData} color="var(--color-primary)" width={220} height={54} />
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 2. SAVING RATE — filled dark-tint, big ring
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-ring" style={{
                    ...cardBase,
                    padding: "22px 24px",
                    background: "linear-gradient(145deg, var(--color-primary-soft), rgba(25,206,155,.02))",
                    border: "1px solid var(--color-primary-soft)",
                    backdropFilter: "var(--glass-blur-sm)",
                    WebkitBackdropFilter: "var(--glass-blur-sm)",
                    boxShadow: "var(--glass-highlight)",
                    borderRadius: 24,
                    justifyContent: "space-between",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={eyebrow}>Rasio Tabungan</div>
                            <h3 style={{ ...sectionTitle, fontSize: 13, marginTop: 6 }}>Bulan ini</h3>
                        </div>
                        <span className={thisSavingRate > 20 ? "chip chip-mint" : "chip chip-amber"}>
                            {thisSavingRate > 20 ? "Mantap" : "Tingkatkan"}
                        </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ position: "relative", width: 86, height: 86, flexShrink: 0 }}>
                            <svg width="86" height="86" style={{ transform: "rotate(-90deg)" }}>
                                <circle cx="43" cy="43" r="36" fill="transparent" stroke="var(--bg-sunk)" strokeWidth="8" />
                                <circle cx="43" cy="43" r="36" fill="transparent"
                                    stroke="var(--color-primary)"
                                    strokeWidth="8"
                                    strokeDasharray={`${Math.min(thisSavingRate, 100) * 2.262} 226.2`}
                                    strokeLinecap="round"
                                    style={{ transition: "stroke-dasharray 1s ease", filter: "drop-shadow(0 0 10px rgba(96,252,198,.5))" }}
                                />
                            </svg>
                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                <span className="num-tight" style={{ fontSize: 26, fontWeight: 900, color: "var(--color-text)", lineHeight: 1 }}>{thisSavingRate}</span>
                                <span style={{ fontSize: 9, color: "var(--color-muted)", fontWeight: 700, letterSpacing: 1 }}>PERSEN</span>
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6 }}>
                            {actualSavingAmt > 0 ? (
                                <>Aktual <strong style={{ color: "var(--color-transfer)", fontSize: 15 }}>{actualSavingRate}%</strong><br /><span className="mono" style={{ fontSize: 10, opacity: .8 }}>{fmtRp(actualSavingAmt)}</span></>
                            ) : "Belum ada tabungan bulan ini"}
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 3. TARGET AKTIF — outline card
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-target-mini" onClick={() => setActiveMenu("goals")} style={{
                    ...cardBase,
                    padding: "22px 24px",
                    background: "transparent",
                    border: "1.5px dashed var(--color-border)",
                    borderRadius: 24,
                    cursor: "pointer",
                    justifyContent: "space-between",
                    transition: "border-color .25s, background .25s",
                }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = "var(--color-purple)"; e.currentTarget.style.background = "var(--color-purple-soft)"; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={eyebrow}>Target Finansial</div>
                            <h3 style={{ ...sectionTitle, fontSize: 13, marginTop: 6 }}>Aktif saat ini</h3>
                        </div>
                        <span style={{ fontSize: 20 }}>🎯</span>
                    </div>
                    <div>
                        <div className="num-tight" style={{ fontSize: 44, fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.04em", lineHeight: 1 }}>
                            {activeGoals}
                            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-subtle)", marginLeft: 8 }}>/ {goals.length}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>
                            {achievedGoals > 0 ? <><strong style={{ color: "var(--color-primary)" }}>{achievedGoals}</strong> sudah tercapai ✨</> : "Tap untuk kelola →"}
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 4. INCOME — mint tinted glass
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-income" style={{
                    ...cardBase,
                    padding: "22px 24px",
                    background: "linear-gradient(145deg, rgba(96,252,198,.1), rgba(96,252,198,.02))",
                    border: "1px solid rgba(96,252,198,.18)",
                    backdropFilter: "var(--glass-blur-sm)",
                    WebkitBackdropFilter: "var(--glass-blur-sm)",
                    boxShadow: "var(--glass-highlight)",
                    borderRadius: 22,
                    justifyContent: "space-between",
                    minHeight: 140,
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={eyebrow}>{t("dash.incomeMonth")}</div>
                        {incomePct && <span className={incomePct.startsWith("+") ? "chip chip-mint" : "chip chip-red"} style={{ fontSize: 10 }}>{incomePct.startsWith("+") ? "↑" : "↓"} {incomePct}</span>}
                    </div>
                    <div>
                        <div className="num-tight" style={{ fontSize: "clamp(26px, 2.6vw, 36px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", lineHeight: 1 }}>{fmtRp(thisIncome)}</div>
                        <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-primary)" }} />
                            Lalu: <span className="mono" style={{ fontWeight: 600 }}>{fmtRp(lastIncome)}</span>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 5. EXPENSE — red tinted glass
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-expense" style={{
                    ...cardBase,
                    padding: "22px 24px",
                    background: "linear-gradient(145deg, rgba(255,113,108,.1), rgba(255,113,108,.02))",
                    border: "1px solid rgba(255,113,108,.18)",
                    backdropFilter: "var(--glass-blur-sm)",
                    WebkitBackdropFilter: "var(--glass-blur-sm)",
                    boxShadow: "var(--glass-highlight)",
                    borderRadius: 22,
                    justifyContent: "space-between",
                    minHeight: 140,
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={eyebrow}>{t("dash.expenseMonth")}</div>
                        {expensePct && <span className={expensePct.startsWith("+") ? "chip chip-red" : "chip chip-mint"} style={{ fontSize: 10 }}>{expensePct.startsWith("+") ? "↑" : "↓"} {expensePct}</span>}
                    </div>
                    <div>
                        <div className="num-tight" style={{ fontSize: "clamp(26px, 2.6vw, 36px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", lineHeight: 1 }}>{fmtRp(thisExpense)}</div>
                        <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-expense)" }} />
                            Lalu: <span className="mono" style={{ fontWeight: 600 }}>{fmtRp(lastExpense)}</span>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 6. NET — gradient mint→blue bold card
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-net" style={{
                    ...cardBase,
                    padding: "22px 24px",
                    background: thisNet >= 0
                        ? "linear-gradient(135deg, rgba(96,252,198,.22), rgba(79,195,247,.12))"
                        : "linear-gradient(135deg, rgba(255,113,108,.22), rgba(245,158,11,.12))",
                    border: `1px solid ${thisNet >= 0 ? "rgba(96,252,198,.28)" : "rgba(255,113,108,.28)"}`,
                    backdropFilter: "var(--glass-blur-sm)",
                    WebkitBackdropFilter: "var(--glass-blur-sm)",
                    boxShadow: "var(--glass-highlight), 0 6px 20px rgba(0,0,0,.08)",
                    borderRadius: 22,
                    justifyContent: "space-between",
                    minHeight: 140,
                    overflow: "hidden",
                }}>
                    {/* Corner flare */}
                    <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: thisNet >= 0 ? "radial-gradient(circle, rgba(96,252,198,.3), transparent 70%)" : "radial-gradient(circle, rgba(255,113,108,.25), transparent 70%)", filter: "blur(10px)", pointerEvents: "none" }} />
                    <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={eyebrow}>Net Bulan Ini</div>
                        <span style={{ fontSize: 20 }}>{thisNet >= 0 ? "💚" : "🔴"}</span>
                    </div>
                    <div style={{ position: "relative" }}>
                        <div className="num-tight" style={{ fontSize: "clamp(28px, 2.8vw, 38px)", fontWeight: 900, color: thisNet >= 0 ? "var(--color-primary)" : "var(--color-expense)", letterSpacing: "-.03em", lineHeight: 1 }}>
                            {thisNet >= 0 ? "+" : "−"}{fmtRp(Math.abs(thisNet))}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8, fontWeight: 500 }}>
                            {thisNet >= 0 ? "Surplus — pertahankan 👏" : "Defisit — cek pengeluaran"}
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 7. ACCOUNTS — full width horizontal carousel
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-accounts" style={{ ...glassCard, padding: "22px 26px", borderRadius: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div>
                            <div style={eyebrow}>Portofolio · {accounts.length} akun</div>
                            <h3 style={{ ...sectionTitle, fontSize: 18, marginTop: 6 }}>{t("dash.yourAccounts")}</h3>
                        </div>
                        <button onClick={() => setActiveMenu("akun")} className="link-btn" style={{ fontSize: 12 }}>{t("dash.viewAll")} →</button>
                    </div>
                    <div style={{
                        display: "flex", gap: 12, overflowX: "auto",
                        padding: "4px 0 6px", margin: "0 -4px",
                        scrollSnapType: "x mandatory",
                        maskImage: "linear-gradient(to right, black calc(100% - 30px), transparent)",
                        WebkitMaskImage: "linear-gradient(to right, black calc(100% - 30px), transparent)",
                    }}>
                        {accounts.map(a => {
                            const accent = acctAccent(a);
                            return (
                                <div key={a.id} style={{
                                    minWidth: 210, height: 130, flexShrink: 0,
                                    background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 10%, transparent), color-mix(in srgb, ${accent} 2%, transparent))`,
                                    backdropFilter: "var(--glass-blur-sm)",
                                    WebkitBackdropFilter: "var(--glass-blur-sm)",
                                    border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
                                    borderRadius: 18,
                                    padding: "16px 18px",
                                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                                    position: "relative", overflow: "hidden",
                                    scrollSnapAlign: "start",
                                    transition: "transform .25s, border-color .25s",
                                    boxShadow: "var(--glass-highlight)",
                                    cursor: "default",
                                }}
                                    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
                                    onMouseOut={e => { e.currentTarget.style.transform = ""; }}>
                                    {/* Corner accent */}
                                    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, color-mix(in srgb, ${accent} 35%, transparent), transparent 70%)`, pointerEvents: "none", filter: "blur(6px)" }} />
                                    <div style={{ position: "relative" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                            <span style={{ fontSize: 18 }}>{a.icon}</span>
                                            <span className="chip chip-ghost" style={{ fontSize: 9, padding: "3px 9px", background: "rgba(255,255,255,.08)", border: "1px solid var(--glass-border)" }}>{a.type}</span>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-.01em" }}>{a.name}</div>
                                    </div>
                                    <div className="num-tight mono" style={{ fontSize: 17, fontWeight: 800, color: "var(--color-text)", position: "relative" }}>{fmtRp(a.balance)}</div>
                                </div>
                            );
                        })}
                        <div onClick={() => setShowAddAccount(true)} style={{
                            minWidth: 150, height: 130, borderRadius: 18,
                            border: "1.5px dashed var(--color-border)",
                            background: "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--color-primary)", fontSize: 12, fontWeight: 700,
                            cursor: "pointer", flexDirection: "column", gap: 6, flexShrink: 0,
                            transition: "border-color .25s, background .25s",
                        }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.background = "var(--color-primary-soft)"; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "transparent"; }}>
                            <span style={{ fontSize: 28, fontWeight: 300 }}>+</span>
                            <span>{t("dash.addAccount")}</span>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 8. CHART — 8 cols × 2 rows (wide)
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-chart">
                    <AreaChart transactions={transactions} />
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 9. RECENT TX — 4 cols × 2 rows (tall list)
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-tx" style={{ ...glassCard, padding: "22px 22px", borderRadius: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div>
                            <div style={eyebrow}>Aktivitas</div>
                            <h3 style={{ ...sectionTitle, fontSize: 16, marginTop: 6 }}>{t("dash.recentTx")}</h3>
                        </div>
                        <button onClick={() => setActiveMenu("transaksi")} className="link-btn" style={{ fontSize: 12 }}>{t("dash.viewAll")}</button>
                    </div>
                    {transactions.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)", fontSize: 13, textAlign: "center" }}>
                            <div style={{ fontSize: 36, marginBottom: 10, opacity: .4 }}>💳</div>
                            Belum ada transaksi
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
                            {transactions.slice(0, 7).map(tx => (
                                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 6px", borderRadius: 10, transition: "background .15s" }}
                                    onMouseOver={e => e.currentTarget.style.background = "var(--color-border-soft)"}
                                    onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                                        background: tx.type === "income" ? "var(--color-primary-soft)" : tx.type === "transfer" ? "var(--color-transfer-soft)" : "var(--color-expense-soft)",
                                    }}>{tx.icon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-.01em" }}>{tx.note || tx.category}</div>
                                        <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 2 }}>{fmtDate(tx.date)}</div>
                                    </div>
                                    <div className="num-tight mono" style={{ fontSize: 12, fontWeight: 800, color: tx.type === "income" ? "var(--color-primary)" : tx.type === "transfer" ? "var(--color-transfer)" : "var(--color-expense)", flexShrink: 0 }}>
                                        {tx.type === "income" ? "+" : tx.type === "transfer" ? "↔" : "−"}{fmtRp(tx.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={() => setShowAddTx(true)} style={{
                        width: "100%", marginTop: 10, padding: "10px 0",
                        borderRadius: 10, border: "1px dashed var(--color-border)",
                        background: "transparent", color: "var(--color-primary)",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        transition: "background .2s, border-color .2s",
                    }}
                        onMouseOver={e => { e.currentTarget.style.background = "var(--color-primary-soft)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                        onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--color-border)"; }}>
                        + {t("dash.addTx")}
                    </button>
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 10. CATEGORIES — 5 cols, donut + list
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-cats" style={{ ...glassCard, padding: "22px 26px", borderRadius: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={eyebrow}>Distribusi Pengeluaran</div>
                        <h3 style={{ ...sectionTitle, fontSize: 16, marginTop: 6 }}>{t("dash.topCategories")}</h3>
                    </div>
                    {sortedCats.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-subtle)", fontSize: 13 }}>
                            Belum ada pengeluaran
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                            <CategoryDonut sortedCats={sortedCats} totalExpense={totalExpense} />
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                                {sortedCats.slice(0, 5).map(([cat, amt], i) => {
                                    const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
                                    const color = colorForCategory(cat, i);
                                    return (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 99, background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}` }} />
                                            <span style={{ flex: 1, fontSize: 12, color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                                            <span className="mono num-tight" style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 700, flexShrink: 0 }}>{Math.round(pct)}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 11. GOALS — 4 cols, stacked progress
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-goals" style={{ ...glassCard, padding: "22px 24px", borderRadius: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div>
                            <div style={eyebrow}>Target Terdekat</div>
                            <h3 style={{ ...sectionTitle, fontSize: 16, marginTop: 6 }}>Progress Goals</h3>
                        </div>
                        <button onClick={() => setActiveMenu("goals")} className="link-btn" style={{ fontSize: 12 }}>Semua</button>
                    </div>
                    {sortedGoals.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-subtle)", fontSize: 13 }}>
                            <div style={{ fontSize: 28, marginBottom: 8, opacity: .4 }}>🎯</div>
                            Tap "Target Finansial" buat mulai
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {sortedGoals.map(g => {
                                const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                                return (
                                    <div key={g.id}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                            <div style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in srgb, ${g.color} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{g.icon}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                                                <div style={{ fontSize: 10, color: "var(--color-subtle)" }} className="mono">{fmtRp(g.current)} / {fmtRp(g.target)}</div>
                                            </div>
                                            <span className="num-tight" style={{ fontSize: 16, fontWeight: 900, color: g.color }}>{pct}%</span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 99, background: "var(--bg-sunk)", overflow: "hidden" }}>
                                            <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${g.color}, color-mix(in srgb, ${g.color} 50%, transparent))`, width: `${pct}%`, transition: "width 1s cubic-bezier(.2,.8,.2,1)", boxShadow: `0 0 12px ${g.color}` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 12. HUTANG — 3 cols, amber alert vibe
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-debts" style={{
                    ...cardBase,
                    padding: "22px 24px",
                    background: debts.length > 0
                        ? "linear-gradient(145deg, rgba(245,158,11,.08), rgba(255,113,108,.04))"
                        : "linear-gradient(145deg, rgba(96,252,198,.08), rgba(96,252,198,.02))",
                    border: `1px solid ${debts.length > 0 ? "rgba(245,158,11,.2)" : "var(--color-primary-soft)"}`,
                    backdropFilter: "var(--glass-blur-sm)",
                    WebkitBackdropFilter: "var(--glass-blur-sm)",
                    boxShadow: "var(--glass-highlight)",
                    borderRadius: 24,
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "transform .25s",
                }}
                    onClick={() => setActiveMenu("hutang")}
                    onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
                    onMouseOut={e => e.currentTarget.style.transform = ""}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={eyebrow}>{debts.length > 0 ? "Kewajiban" : "Status"}</div>
                            <h3 style={{ ...sectionTitle, fontSize: 13, marginTop: 6 }}>Hutang & Cicilan</h3>
                        </div>
                        <span style={{ fontSize: 20 }}>{debts.length > 0 ? "📋" : "🎉"}</span>
                    </div>
                    {debts.length === 0 ? (
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary)", letterSpacing: "-.02em" }}>Bebas!</div>
                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>Tidak ada hutang aktif</div>
                        </div>
                    ) : (
                        <div>
                            <div className="num-tight mono" style={{ fontSize: 22, fontWeight: 900, color: "var(--color-amber)", letterSpacing: "-.03em", lineHeight: 1 }}>{fmtRp(totalDebtRemaining)}</div>
                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>
                                <strong style={{ color: "var(--color-text)" }}>{debts.length}</strong> hutang aktif · tap kelola
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════
                 * 13. FINANCIAL HEALTH — full-width tiles
                 * ═══════════════════════════════════════════════════════ */}
                <div className="b-health" style={{ ...glassCard, padding: "22px 26px", borderRadius: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div>
                            <div style={eyebrow}>{t("dash.financialHealth")}</div>
                            <h3 style={{ ...sectionTitle, fontSize: 18, marginTop: 6 }}>Skor Keuangan</h3>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 600 }}>3 indikator</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                        {[
                            { label: t("dash.savingRate"), val: savingRate, color: savingRate > 20 ? "var(--color-primary)" : "var(--color-amber)", note: savingRate > 20 ? t("dash.goodRate") : t("dash.needImprove"), icon: "💰" },
                            { label: t("dash.expenseRatio"), val: expenseRate, color: expenseRate < 70 ? "var(--color-primary)" : "var(--color-expense)", note: expenseRate < 70 ? t("dash.veryGood") : t("dash.tooHigh"), icon: "📊" },
                            { label: t("dash.actualSaving"), val: actualSavingRate, color: "var(--color-transfer)", note: actualSavingAmt > 0 ? fmtRp(actualSavingAmt) : "Belum ada", icon: "🏆" },
                        ].map((h, i) => (
                            <div key={i} style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,.03)", border: "1px solid var(--glass-border)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <span style={{ fontSize: 20 }}>{h.icon}</span>
                                    <span className="num-tight" style={{ fontSize: 28, fontWeight: 900, color: h.color, letterSpacing: "-.03em", lineHeight: 1 }}>{h.val}<span style={{ fontSize: 14, color: "var(--color-subtle)", marginLeft: 2 }}>%</span></span>
                                </div>
                                <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 700, marginBottom: 8, letterSpacing: "-.01em" }}>{h.label}</div>
                                <div style={{ height: 5, borderRadius: 99, background: "var(--bg-sunk)", overflow: "hidden", marginBottom: 8 }}>
                                    <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${h.color}, color-mix(in srgb, ${h.color} 50%, transparent))`, width: `${Math.min(h.val, 100)}%`, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }} />
                                </div>
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 500 }}>{h.note}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DasborView;
