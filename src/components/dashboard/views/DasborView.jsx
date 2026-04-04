import { fmtRp, fmtDate } from "../../../utils/formatters";
import { categoryColors } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";

const card = {
    background: "var(--bg-surface)",
    borderRadius: 16,
    padding: "20px 22px",
    position: "relative",
    overflow: "hidden",
};

// ── Trend Chart (6 bulan terakhir) ────────────────────────────────────────
function TrendChart({ transactions }) {
    const now   = new Date();
    const m     = now.getMonth();
    const y     = now.getFullYear();

    const data = Array.from({ length: 6 }, (_, i) => {
        const d  = new Date(y, m - (5 - i), 1);
        const mo = d.getMonth(), yr = d.getFullYear();
        const txM = transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === mo && td.getFullYear() === yr;
        });
        return {
            label:   d.toLocaleString("id-ID", { month: "short" }),
            income:  txM.filter(t => t.type === "income").reduce((a, t) => a + t.amount, 0),
            expense: txM.filter(t => t.type === "expense").reduce((a, t) => a + t.amount, 0),
        };
    });

    const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
    const barH   = 80; // max bar height px

    return (
        <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>Tren 6 Bulan</h3>
                    <span style={{ fontSize: 10, color: "var(--color-muted)" }}>Pemasukan vs Pengeluaran</span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--color-muted)" }}>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--color-primary)", marginRight: 4 }} />Masuk</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#ff716c", marginRight: 4 }} />Keluar</span>
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: barH + 28 }}>
                {data.map((d, i) => {
                    const iH = Math.round((d.income  / maxVal) * barH);
                    const eH = Math.round((d.expense / maxVal) * barH);
                    const isCurrentMonth = i === 5;
                    return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: barH }}>
                                <div title={`Masuk: ${fmtRp(d.income)}`}
                                    style={{ width: "44%", height: iH || 2, background: isCurrentMonth ? "var(--color-primary)" : "rgba(96,252,198,.35)", borderRadius: "3px 3px 0 0", transition: "height .6s", cursor: "default" }} />
                                <div title={`Keluar: ${fmtRp(d.expense)}`}
                                    style={{ width: "44%", height: eH || 2, background: isCurrentMonth ? "#ff716c" : "rgba(255,113,108,.35)", borderRadius: "3px 3px 0 0", transition: "height .6s", cursor: "default" }} />
                            </div>
                            <div style={{ fontSize: 9, color: isCurrentMonth ? "var(--color-text)" : "var(--color-subtle)", fontWeight: isCurrentMonth ? 700 : 400, textTransform: "capitalize" }}>{d.label}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Goals Progress Widget ─────────────────────────────────────────────────
function GoalsWidget({ goals, setActiveMenu }) {
    const active = goals.filter(g => g.current < g.target);
    // Sort: ada deadline dulu, lalu by pct descending
    const sorted = [...active].sort((a, b) => {
        if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        const pctA = a.target > 0 ? a.current / a.target : 0;
        const pctB = b.target > 0 ? b.current / b.target : 0;
        return pctB - pctA;
    }).slice(0, 3);

    const achieved = goals.filter(g => g.current >= g.target).length;

    return (
        <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>Target Finansial</h3>
                    <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{goals.length} target · {achieved} tercapai</span>
                </div>
                <button onClick={() => setActiveMenu("goals")} style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Lihat Semua →</button>
            </div>

            {goals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--color-subtle)", fontSize: 12 }}>
                    🎯 Belum ada target
                    <button onClick={() => setActiveMenu("goals")} style={{ display: "block", margin: "8px auto 0", padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Tambah Target</button>
                </div>
            ) : sorted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
                    <div style={{ fontSize: 12, color: "var(--color-primary)", fontWeight: 700 }}>Semua target tercapai!</div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {sorted.map(g => {
                        const pct      = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                        const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date().setHours(0,0,0,0)) / 86400000) : null;
                        let deadlineLabel = null, deadlineColor = "var(--color-muted)";
                        if (daysLeft !== null) {
                            if (daysLeft < 0)      { deadlineLabel = `❌ Terlambat ${Math.abs(daysLeft)}h`; deadlineColor = "#ff716c"; }
                            else if (daysLeft <= 7) { deadlineLabel = `⚠️ ${daysLeft} hari lagi`; deadlineColor = "#f97316"; }
                            else if (daysLeft <= 30){ deadlineLabel = `🗓️ ${daysLeft} hari lagi`; deadlineColor = "#f59e0b"; }
                            else                    { deadlineLabel = `🗓️ ${Math.round(daysLeft/30)} bln lagi`; }
                        }
                        return (
                            <div key={g.id} style={{ borderTop: "1px solid var(--color-border-soft)", paddingTop: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 16 }}>{g.icon}</span>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{g.name}</div>
                                            {deadlineLabel && <div style={{ fontSize: 10, color: deadlineColor, fontWeight: 600 }}>{deadlineLabel}</div>}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: g.color }}>{pct}%</span>
                                </div>
                                <div style={{ height: 5, borderRadius: 99, background: "var(--bg-surface-low)" }}>
                                    <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${g.color},${g.color}88)`, width: `${pct}%`, transition: "width 1s" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--color-muted)", marginTop: 4 }}>
                                    <span>{fmtRp(g.current)}</span>
                                    <span>{fmtRp(g.target)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Hutang Summary Widget ─────────────────────────────────────────────────
function HutangWidget({ debts, setActiveMenu }) {
    if (!debts) return null;
    const totalRemaining = debts.reduce((a, d) => a + (d.remaining || 0), 0);
    const totalMonthly   = debts.reduce((a, d) => a + (d.monthly  || 0), 0);
    const top3           = [...debts].sort((a, b) => (b.remaining || 0) - (a.remaining || 0)).slice(0, 3);

    return (
        <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>Hutang & Cicilan</h3>
                    <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{debts.length} hutang aktif</span>
                </div>
                <button onClick={() => setActiveMenu("hutang")} style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Kelola →</button>
            </div>

            {debts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "12px 0", color: "var(--color-primary)", fontSize: 12, fontWeight: 600 }}>
                    🎉 Bebas hutang!
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                        <div style={{ background: "rgba(255,113,108,.06)", border: "1px solid rgba(255,113,108,.15)", borderRadius: 10, padding: "10px 12px" }}>
                            <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 3 }}>TOTAL SISA</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#ff716c" }}>{fmtRp(totalRemaining)}</div>
                        </div>
                        <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.15)", borderRadius: 10, padding: "10px 12px" }}>
                            <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 3 }}>CICILAN/BULAN</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b" }}>{fmtRp(totalMonthly)}</div>
                        </div>
                    </div>
                    {/* Top debts */}
                    {top3.map(d => {
                        const pct = d.total > 0 ? Math.min(100, Math.round(((d.total - d.remaining) / d.total) * 100)) : 0;
                        return (
                            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--color-border-soft)" }}>
                                <span style={{ fontSize: 18 }}>{d.icon || "📋"}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                                        <span style={{ fontSize: 10, color: "#ff716c", fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{fmtRp(d.remaining)}</span>
                                    </div>
                                    <div style={{ height: 4, borderRadius: 99, background: "var(--bg-surface-low)" }}>
                                        <div style={{ height: "100%", borderRadius: 99, background: d.color || "#ff716c", width: `${pct}%`, transition: "width 1s", opacity: 0.7 }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}

const DasborView = ({
    accounts, transactions, goals, investments = [], debts = [], budgets = [],
    totalBalance, totalIncome, totalExpense, netBalance, savingRate, expenseRate,
    sortedCats, setActiveMenu, setShowAddAccount, setShowAddTx, customCategories = []
}) => {
    const { t } = useLanguage();

    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const lm = m === 0 ? 11 : m - 1, ly = m === 0 ? y - 1 : y;

    const txThis  = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === m  && d.getFullYear() === y;  });
    const txLast  = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === lm && d.getFullYear() === ly; });

    const thisIncome  = txThis.filter(tx => tx.type === "income" ).reduce((a, tx) => a + tx.amount, 0);
    const thisExpense = txThis.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const lastIncome  = txLast.filter(tx => tx.type === "income" ).reduce((a, tx) => a + tx.amount, 0);
    const lastExpense = txLast.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const thisNet     = thisIncome - thisExpense;

    const pctChange = (cur, prev) => {
        if (prev === 0 || cur === 0) return null;
        const val = Math.round(((cur - prev) / prev) * 100);
        return (val >= 0 ? "+" : "") + val + "%";
    };

    const incomePct  = pctChange(thisIncome, lastIncome);
    const expensePct = pctChange(thisExpense, lastExpense);
    const thisSavingRate = thisIncome > 0 ? Math.round((1 - thisExpense / thisIncome) * 100) : 0;

    // Tabungan aktual
    const tabunganAccountNames = new Set(accounts.filter(a => a.type === "tabungan").map(a => a.name));
    const investmentSaving = investments.filter(inv => { const d = new Date(inv.created_at); return d.getMonth() === m && d.getFullYear() === y; }).reduce((s, inv) => s + (inv.buy_price || 0), 0);
    const tabunganSaving   = txThis.filter(tx => tx.type === "income" && tabunganAccountNames.has(tx.account_name)).reduce((s, tx) => s + tx.amount, 0);
    const actualSavingAmt  = investmentSaving + tabunganSaving;
    const actualSavingRate = thisIncome > 0 ? Math.round((actualSavingAmt / thisIncome) * 100) : 0;

    // Quick stats
    const activeGoals    = goals.filter(g => g.current < g.target).length;
    const activeDebts    = debts.length;
    const overBudgets    = budgets.filter(b => {
        const spent = txThis.filter(tx => tx.category === b.category && tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
        return spent > b.amount;
    }).length;

    const acctBorderColor = (a) => {
        if (a.type === "bank")    return "var(--color-primary)";
        if (a.type === "ewallet") return "#a78bfa";
        if (a.type === "cash")    return "#f59e0b";
        return a.color || "var(--color-primary)";
    };

    return (
    <div style={{ animation: "fadeIn .4s", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ROW 1: STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            {/* Saldo Total */}
            <div style={{ ...card, borderLeft: "4px solid #00C896" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{t("dash.totalBalance")}</p>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px" }}>{fmtRp(totalBalance)}</h2>
                <p style={{ fontSize: 10, color: "var(--color-muted)" }}>🏦 {accounts.length} {t("dash.accountsCount")}</p>
            </div>

            {/* Pemasukan */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{t("dash.incomeMonth")}</p>
                    <span style={{ fontSize: 16 }}>📈</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px" }}>{fmtRp(thisIncome)}</h2>
                {incomePct && (
                    <p style={{ fontSize: 10, color: incomePct.startsWith("+") ? "var(--color-primary)" : "#ff716c", fontWeight: 700 }}>
                        {incomePct.startsWith("+") ? "↑" : "↓"} {incomePct} <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>{t("dash.fromLastMonth")}</span>
                    </p>
                )}
            </div>

            {/* Pengeluaran */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{t("dash.expenseMonth")}</p>
                    <span style={{ fontSize: 16 }}>📉</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px" }}>{fmtRp(thisExpense)}</h2>
                {expensePct && (
                    <p style={{ fontSize: 10, color: expensePct.startsWith("+") ? "#ff716c" : "var(--color-primary)", fontWeight: 700 }}>
                        {expensePct.startsWith("+") ? "↑" : "↓"} {expensePct} <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>{t("dash.fromLastMonth")}</span>
                    </p>
                )}
            </div>

            {/* Sisa Pendapatan / Saving Rate */}
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                    <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="28" cy="28" r="22" fill="transparent" stroke="var(--bg-surface-low)" strokeWidth="5" />
                        <circle cx="28" cy="28" r="22" fill="transparent" stroke="var(--color-primary)"
                            strokeWidth="5"
                            strokeDasharray={`${Math.min(thisSavingRate, 100) * 1.382} 138.2`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text)" }}>{thisSavingRate}%</span>
                    </div>
                </div>
                <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{t("dash.savingRate")}</p>
                    <div style={{ background: "rgba(0,200,150,.1)", color: "var(--color-primary)", padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, display: "inline-block", marginBottom: 6 }}>
                        {thisSavingRate > 20 ? `${t("dash.goodRate")} 👍` : t("dash.needImprove")}
                    </div>
                    {actualSavingAmt > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4FC3F7", flexShrink: 0 }} />
                            <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>
                                {t("dash.actualSaving")}: <strong style={{ color: "#4FC3F7" }}>{actualSavingRate}%</strong>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* ROW 2: AKUN */}
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{t("dash.yourAccounts")}</h3>
                <button onClick={() => setActiveMenu("akun")} style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.viewAll")} →</button>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
                {accounts.map(a => (
                    <div key={a.id} style={{
                        minWidth: 170, background: "var(--bg-surface)", borderRadius: 14, padding: "16px 18px",
                        borderLeft: `4px solid ${acctBorderColor(a)}`,
                        display: "flex", flexDirection: "column", justifyContent: "space-between", height: 108, flexShrink: 0,
                    }}>
                        <div>
                            <span style={{ fontSize: 9, background: "var(--bg-surface-low)", padding: "2px 7px", borderRadius: 4, color: "var(--color-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{a.type}</span>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.icon} {a.name}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)" }}>{fmtRp(a.balance)}</div>
                    </div>
                ))}
                <div onClick={() => setShowAddAccount(true)} style={{ minWidth: 120, height: 108, borderRadius: 14, border: "1.5px dashed rgba(96,252,198,.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 20 }}>+</span>
                    <span>{t("dash.addAccount")}</span>
                </div>
            </div>
        </div>

        {/* ROW 3: Transaksi + Kategori + Goals */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>

            {/* Transaksi Terbaru */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{t("dash.recentTx")}</h3>
                        <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{t("dash.last5tx")}</span>
                    </div>
                    <button onClick={() => setActiveMenu("transaksi")} style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.viewAll")}</button>
                </div>
                {transactions.slice(0, 5).map(tx => (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--color-border-soft)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: tx.type === "income" ? "rgba(96,252,198,.1)" : tx.type === "transfer" ? "rgba(79,195,247,.1)" : "rgba(255,113,108,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{tx.icon}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.note}</div>
                                <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{fmtDate(tx.date)}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tx.type === "income" ? "var(--color-primary)" : tx.type === "transfer" ? "#4FC3F7" : "#ff716c", flexShrink: 0, marginLeft: 8 }}>
                            {tx.type === "income" ? "+" : tx.type === "transfer" ? "↔ " : "-"}{fmtRp(tx.amount)}
                        </div>
                    </div>
                ))}
                <button onClick={() => setShowAddTx(true)} style={{ width: "100%", marginTop: 10, padding: 8, borderRadius: 10, border: "1px dashed rgba(96,252,198,.25)", background: "transparent", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.addTx")}</button>
            </div>

            {/* Kategori Teratas */}
            <div style={card}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>{t("dash.topCategories")}</h3>
                <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{t("dash.topCatSub")}</span>
                <div style={{ marginTop: 14 }}>
                    {sortedCats.slice(0, 5).map(([cat, amt], i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: "var(--color-text)" }}>{cat}</span>
                                <span style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 600 }}>{fmtRp(amt)}</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 99, background: "var(--bg-surface-low)" }}>
                                <div style={{ height: "100%", borderRadius: 99, background: categoryColors[cat] || "var(--color-primary)", width: totalExpense > 0 ? `${(amt / totalExpense) * 100}%` : "0%", transition: "width .8s" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Goals Progress */}
            <GoalsWidget goals={goals} setActiveMenu={setActiveMenu} />
        </div>

        {/* ROW 4: Trend Chart + Hutang */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
            <TrendChart transactions={transactions} />
            <HutangWidget debts={debts} setActiveMenu={setActiveMenu} />
        </div>

        {/* ROW 5: Kesehatan + Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>

            {/* Kesehatan Keuangan */}
            <div style={card}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 14 }}>{t("dash.financialHealth")}</h3>
                {[
                    { label: t("dash.savingRate"),   val: savingRate,  color: savingRate > 20  ? "var(--color-primary)" : "#f59e0b", note: savingRate > 20  ? t("dash.goodRate")  : t("dash.needImprove") },
                    { label: t("dash.expenseRatio"), val: expenseRate, color: expenseRate < 70 ? "var(--color-primary)" : "#ff716c", note: expenseRate < 70 ? t("dash.veryGood") : t("dash.tooHigh") },
                ].map((h, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: "var(--color-text)" }}>{h.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: h.color }}>{h.val}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: "var(--bg-surface-low)" }}>
                            <div style={{ height: "100%", borderRadius: 99, background: h.color, width: `${Math.min(h.val, 100)}%`, transition: "width 1s" }} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 3 }}>{h.note}</div>
                    </div>
                ))}
                <div style={{ borderTop: "1px solid var(--color-border-soft)", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <div>
                            <span style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>{t("dash.actualSaving")}</span>
                            <span style={{ fontSize: 10, color: "var(--color-muted)", marginLeft: 6 }}>💡 {t("dash.fromInvestment")}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: actualSavingRate > 0 ? "#4FC3F7" : "var(--color-subtle)" }}>{actualSavingRate}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "var(--bg-surface-low)" }}>
                        <div style={{ height: "100%", borderRadius: 99, background: "#4FC3F7", width: `${Math.min(actualSavingRate, 100)}%`, transition: "width 1s" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 3 }}>
                        {actualSavingAmt > 0 ? fmtRp(actualSavingAmt) : "Belum ada tabungan/investasi bulan ini"}
                    </div>
                </div>
            </div>

            {/* Quick Stats — lebih bermakna */}
            <div style={card}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 14 }}>{t("dash.quickStats")}</h3>
                {[
                    { l: t("dash.txThisMonth"),  v: txThis.length,             i: "💳", c: "var(--color-text)",                          onClick: () => setActiveMenu("transaksi") },
                    { l: "Target Aktif",         v: `${activeGoals} target`,    i: "🎯", c: "var(--color-text)",                          onClick: () => setActiveMenu("goals") },
                    { l: "Hutang Aktif",         v: `${activeDebts} hutang`,    i: "📋", c: activeDebts > 0 ? "#ff716c" : "var(--color-primary)", onClick: () => setActiveMenu("hutang") },
                    { l: "Anggaran Terlampaui",  v: `${overBudgets} kategori`,  i: "⚠️", c: overBudgets > 0 ? "#f59e0b" : "var(--color-primary)", onClick: () => setActiveMenu("anggaran") },
                    { l: "Net Bulan Ini",        v: fmtRp(Math.abs(thisNet)),   i: thisNet >= 0 ? "💚" : "🔴", c: thisNet >= 0 ? "var(--color-primary)" : "#ff716c", prefix: thisNet >= 0 ? "+" : "-" },
                ].map((s, i) => (
                    <div key={i} onClick={s.onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: i > 0 ? "1px solid var(--color-border-soft)" : "none", cursor: s.onClick ? "pointer" : "default" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{s.i}</span>
                            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.l}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.prefix || ""}{s.v}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
    );
};

export default DasborView;
