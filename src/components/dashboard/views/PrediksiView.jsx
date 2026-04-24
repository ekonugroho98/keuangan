import { useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";

const fmtRp = (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

/* ── Kategori yang secara semantik "tetap" per bulan ── */
const FIXED_KEYWORDS = [
    "cicilan","hutang","kredit","angsuran","pinjaman","kpr","cicil","leasing",
    "asuransi","iuran","langganan","subscription","sewa","kontrakan","kos",
    "listrik","pdam","air","gas","internet","wifi","telkom","indihome",
    "utilit","bpjs","pajak","token","pulsa","tv kabel",
];
const isSemanticFixed = (cat) => {
    const lower = (cat || "").toLowerCase();
    return FIXED_KEYWORDS.some(k => lower.includes(k));
};

const PrediksiView = ({ transactions, budgets, accounts }) => {
    const { t } = useLanguage();

    const now          = new Date();
    const thisYear     = now.getFullYear();
    const thisMonth    = now.getMonth();
    const todayDay     = now.getDate();
    const daysInMonth  = new Date(thisYear, thisMonth + 1, 0).getDate();
    const monthStr     = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`;

    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

    const calc = useMemo(() => {
        const expenses       = transactions.filter(t => t.type === "expense");
        const thisMonthTxs   = expenses.filter(t => t.date?.startsWith(monthStr));
        const spentThisMonth = thisMonthTxs.reduce((s, t) => s + t.amount, 0);

        /* ── Per kategori bulan ini ── */
        const spentByCategory = {};
        const countByCategory = {};
        thisMonthTxs.forEach(t => {
            spentByCategory[t.category]  = (spentByCategory[t.category]  || 0) + t.amount;
            countByCategory[t.category]  = (countByCategory[t.category]  || 0) + 1;
        });

        /* ── Avg 3 bulan lalu ── */
        const past3 = [-3, -2, -1].map(o => {
            const d = new Date(thisYear, thisMonth + o, 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        });
        const avgByCategory = {};
        past3.forEach(m => {
            expenses.filter(t => t.date?.startsWith(m)).forEach(t => {
                avgByCategory[t.category] = (avgByCategory[t.category] || 0) + t.amount;
            });
        });
        Object.keys(avgByCategory).forEach(k => { avgByCategory[k] /= 3; });

        /* ─────────────────────────────────────────────────────────
           SMART CLASSIFICATION
           "Tetap"  = bayar sekali (atau ≤2×) per bulan DAN jumlahnya
                      besar (> 2× rata-rata pengeluaran harian)
           "Variabel" = sisanya — diekstrapolasi secara harian
        ───────────────────────────────────────────────────────── */
        /*  Threshold ABSOLUT: jika 1-2 transaksi/bulan DAN tiap transaksi
            >= Rp 200.000 → kemungkinan besar pembayaran bulanan (bukan harian)  */
        const FIXED_PER_TX = 200_000;

        let fixedTotal    = 0;
        let variableSpent = 0;
        const fixedSet    = new Set();

        Object.entries(spentByCategory).forEach(([cat, amt]) => {
            const count    = countByCategory[cat] || 1;
            const perTx    = amt / count;
            const isSemFix = isSemanticFixed(cat);
            // Bayar ≤2× sebulan DAN nominal per transaksi ≥ 200rb → tetap
            const isBigOnce = count <= 2 && perTx >= FIXED_PER_TX;

            if (isSemFix || isBigOnce) {
                fixedTotal += amt;
                fixedSet.add(cat);
            } else {
                variableSpent += amt;
            }
        });

        const variableDailyRate = todayDay > 0 ? variableSpent / todayDay : 0;
        const predictedVariable = variableDailyRate * daysInMonth;
        const predictedTotal    = fixedTotal + predictedVariable;

        /* prediksi per kategori:
           - Tetap  → gunakan nilai aktual (tidak diekstrapolasi)
           - Variabel → gunakan avg 3 bulan jika ada, atau ekstrapolasi harian */
        const predictedByCategory = {};
        Object.keys(spentByCategory).forEach(cat => {
            if (fixedSet.has(cat)) {
                predictedByCategory[cat] = spentByCategory[cat]; // nilai aktual
            } else if (avgByCategory[cat] > 0) {
                predictedByCategory[cat] = avgByCategory[cat];   // rata-rata historis lebih stabil
            } else {
                predictedByCategory[cat] = (spentByCategory[cat] / todayDay) * daysInMonth;
            }
        });

        /* alert terhadap budget
           - Variabel : alert jika prediksi > 70% budget (bisa membengkak sisa bulan)
           - Tetap    : alert hanya jika prediksi > 100% budget (melebihi, bukan pas)
             karena biaya tetap yang pas = budget adalah hal NORMAL, bukan bahaya
        */
        const alertCategories = [];
        if (budgets?.length > 0) {
            budgets.filter(b => !b.month || b.month === monthStr).forEach(b => {
                const predicted = predictedByCategory[b.category] || 0;
                const spent     = spentByCategory[b.category]     || 0;
                const pct       = b.amount > 0 ? (predicted / b.amount) * 100 : 0;
                const isFixed   = fixedSet.has(b.category);

                // Threshold berbeda: tetap harus > 100%, variabel cukup > 70%
                const threshold = isFixed ? 100 : 70;
                if (pct > threshold) {
                    alertCategories.push({
                        category: b.category,
                        budget: b.amount, spent, predicted,
                        pct: Math.round(pct),
                        spentPct: Math.round(b.amount > 0 ? (spent / b.amount) * 100 : 0),
                        status: pct >= 100 ? "danger" : "warning",
                        isFixed,
                    });
                }
            });
        }

        const hasData = expenses.length > 0;

        return {
            spentThisMonth, spentByCategory, avgByCategory,
            predictedTotal, predictedByCategory, alertCategories,
            fixedTotal, variableSpent, variableDailyRate, fixedSet,
            hasData,
        };
    }, [transactions, budgets, monthStr, todayDay, daysInMonth, thisYear, thisMonth]);

    const {
        spentThisMonth, spentByCategory, avgByCategory,
        predictedTotal, predictedByCategory, alertCategories,
        fixedTotal, variableSpent, variableDailyRate, fixedSet,
        hasData,
    } = calc;

    const avgTotal3m  = Object.values(avgByCategory).reduce((s, v) => s + v, 0);
    const trendPct    = avgTotal3m > 0 ? Math.round(((predictedTotal - avgTotal3m) / avgTotal3m) * 100) : 0;
    const trendUp     = trendPct > 0;

    const remainingDays       = daysInMonth - todayDay;
    const remainingPredicted  = variableDailyRate * remainingDays; // hanya variabel yang diproyeksikan sisa bulan
    const estimatedEndBalance = totalBalance - remainingPredicted;

    const allCategories = [...new Set([...Object.keys(spentByCategory), ...Object.keys(avgByCategory)])];
    const monthName     = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    const cardStyle = {
        background: "var(--glass-1)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        borderRadius: 20, padding: "22px 24px",
        boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
        position: "relative", overflow: "hidden",
    };

    if (!hasData) {
        return (
            <div style={{ animation: "fadeIn .4s" }}>
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>PREDICTION</div>
                    <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>{t("pred.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>{t("pred.subtitle")}</p>
                </div>
                <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🔮</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 6, letterSpacing: "-.01em" }}>{t("pred.noData")}</div>
                    <div style={{ fontSize: 13, color: "var(--color-muted)" }}>{t("pred.noDataSub")}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>PREDICTION</div>
                    <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>{t("pred.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        {t("pred.subtitle")} · {monthName}
                    </p>
                </div>
                <span className="chip chip-blue" style={{ fontSize: 11, fontWeight: 800 }}>✨ AI Prediction</span>
            </div>

            {/* Info banner — metode prediksi */}
            <div style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                background: "var(--color-primary-soft)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
                borderRadius: 14, padding: "12px 16px", marginBottom: 20,
                boxShadow: "var(--glass-highlight)",
            }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🧮</span>
                <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--color-primary)" }}>{t("pred.methodTitle")}</strong>
                    {" "}— {t("pred.methodDesc")}{" "}
                    <span style={{ color: "var(--color-text)", fontWeight: 700 }}>{t("pred.fixed")}</span> {t("pred.methodFixedDesc")}
                    {" "}{t("pred.methodAnd")}{" "}
                    <span style={{ color: "var(--color-text)", fontWeight: 700 }}>{t("pred.variable")}</span> {t("pred.methodVariableDesc")}.
                    {" "}{t("pred.fixedLabel")} <strong className="num-tight mono" style={{ color: "var(--color-transfer)" }}>{fmtRp(fixedTotal)}</strong> ·
                    {t("pred.variablePerDay")} <strong className="num-tight mono" style={{ color: "var(--color-amber)" }}>{fmtRp(variableDailyRate)}</strong>
                    <span style={{ display: "block", marginTop: 4, color: "var(--color-subtle)" }}>
                        💡 {t("pred.aiTip")} <strong>AI Coach</strong>.
                    </span>
                </div>
            </div>

            {/* Top 2 cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16, marginBottom: 20 }}>

                {/* Prediksi Pengeluaran — Hero */}
                <div style={{ ...cardStyle, background: "var(--glass-hero)", padding: "24px 22px" }}>
                    <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, var(--color-primary-soft), transparent 70%)", pointerEvents: "none" }} />

                    {/* Label + konteks */}
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", letterSpacing: 1.6, marginBottom: 2, textTransform: "uppercase" }}>
                        {t("pred.estTotalExpense")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 10 }}>
                        📅 {t("pred.endOf")} {monthName} ({t("pred.dayOf")}{todayDay} {t("pred.dari")} {daysInMonth})
                    </div>

                    <div className="num-tight mono" style={{
                        fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 900,
                        background: "linear-gradient(135deg,var(--color-primary),var(--color-primary-deep))",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        marginBottom: 14, letterSpacing: "-.03em", lineHeight: 1,
                    }}>
                        {fmtRp(predictedTotal)}
                    </div>

                    {/* Rumus prediksi yang transparan */}
                    <div style={{
                        background: "var(--glass-2)",
                        backdropFilter: "var(--glass-blur)",
                        WebkitBackdropFilter: "var(--glass-blur)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: 12, padding: "10px 14px", marginBottom: 12,
                        display: "flex", flexDirection: "column", gap: 6,
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
                            <span style={{ color: "var(--color-muted)" }}>✅ {t("pred.alreadySpent")}</span>
                            <strong className="num-tight mono" style={{ color: "var(--color-text)" }}>{fmtRp(spentThisMonth)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
                            <span style={{ color: "var(--color-muted)" }}>📈 + {t("pred.projRemaining")} {remainingDays} {t("pred.daysLeft")}</span>
                            <strong className="num-tight mono" style={{ color: "var(--color-amber)" }}>+{fmtRp(remainingPredicted)}</strong>
                        </div>
                        <div style={{ borderTop: "1px solid var(--color-border-soft)", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
                            <span style={{ color: "var(--color-muted)", fontWeight: 700 }}>= {t("pred.totalMonthEnd")}</span>
                            <strong className="num-tight mono" style={{ color: "var(--color-primary)" }}>{fmtRp(predictedTotal)}</strong>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="chip chip-blue" style={{ fontSize: 11 }}>
                            🔒 {t("pred.fixedLabel")} <strong className="mono">{fmtRp(fixedTotal)}</strong>
                        </span>
                        <span className="chip chip-amber" style={{ fontSize: 11 }}>
                            📈 {t("pred.variablePerDay")} <strong className="mono">{fmtRp(variableDailyRate)}</strong>
                        </span>
                    </div>

                    {avgTotal3m > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                            <span className={trendUp ? "chip chip-red" : "chip chip-mint"} style={{ fontWeight: 800 }}>
                                {trendUp ? "▲" : "▼"} {Math.abs(trendPct)}%
                            </span>
                            <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>{t("pred.vsLastMonth")}</span>
                        </div>
                    )}

                    <div style={{ height: 6, borderRadius: 99, background: "var(--color-border-soft)", marginTop: 14, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,var(--color-primary),var(--color-transfer))", width: `${Math.min(100, (todayDay / daysInMonth) * 100)}%`, transition: "width .6s" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 6 }}>
                        {t("pred.monthProgress")}: {todayDay}/{daysInMonth} {t("pred.days")} ({Math.round((todayDay/daysInMonth)*100)}%)
                    </div>
                </div>

                {/* Estimasi Saldo */}
                <div style={{ ...cardStyle }}>
                    <div style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, var(--color-transfer-soft), transparent 70%)", pointerEvents: "none" }} />
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", letterSpacing: 1.6, marginBottom: 10, textTransform: "uppercase" }}>
                        {t("pred.estimatedBalance")}
                    </div>
                    <div className="num-tight mono" style={{ fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 900, color: estimatedEndBalance >= 0 ? "var(--color-text)" : "var(--color-expense)", marginBottom: 8, letterSpacing: "-.03em", lineHeight: 1 }}>
                        {fmtRp(estimatedEndBalance)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
                        {t("pred.currentBalance")}: <strong className="num-tight mono" style={{ color: "var(--color-text)" }}>{fmtRp(totalBalance)}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
                        {t("pred.projVariableRem")}: <strong className="num-tight mono" style={{ color: "var(--color-expense)" }}>−{fmtRp(remainingPredicted)}</strong>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 10 }}>
                        {remainingDays} {t("pred.daysRemaining")} @ {fmtRp(variableDailyRate)}{t("pred.perDayVar")}
                    </div>
                </div>
            </div>

            {/* Alert Kategori */}
            {alertCategories.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, letterSpacing: "-.01em" }}>
                        <span>⚠️</span> {t("pred.alertCategories")}
                        <span className="chip chip-red" style={{ fontWeight: 800 }}>
                            {alertCategories.length}
                        </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {alertCategories.map(a => (
                            <div key={a.category} style={{
                                padding: "12px 14px", borderRadius: 14,
                                background: a.status === "danger" ? "var(--color-expense-soft)" : "var(--color-amber-soft)",
                                backdropFilter: "var(--glass-blur)",
                                WebkitBackdropFilter: "var(--glass-blur)",
                                border: `1px solid ${a.status === "danger" ? "var(--color-expense-soft)" : "var(--color-amber-soft)"}`,
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{a.category}</span>
                                    <span className={a.status === "danger" ? "chip chip-red" : "chip chip-amber"} style={{ fontWeight: 800 }}>
                                        {a.status === "danger" ? t("pred.danger") : t("pred.warning")} {a.pct}%
                                    </span>
                                </div>
                                <div style={{ height: 6, borderRadius: 99, background: "var(--color-border-soft)", marginBottom: 6, overflow: "hidden" }}>
                                    <div style={{ height: "100%", borderRadius: 99, background: a.status === "danger" ? "var(--color-expense)" : "var(--color-amber)", width: `${Math.min(100, a.pct)}%`, transition: "width .5s" }} />
                                </div>
                                <div className="num-tight" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-subtle)", gap: 8, flexWrap: "wrap" }}>
                                    <span>{t("pred.labelSpent")}: <span className="mono">{fmtRp(a.spent)}</span></span>
                                    <span>{t("pred.labelPredicted")}: <span className="mono">{fmtRp(a.predicted)}</span></span>
                                    <span>{t("pred.labelBudget")}: <span className="mono">{fmtRp(a.budget)}</span></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tren per Kategori */}
            <div style={cardStyle}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16, letterSpacing: "-.01em" }}>
                    📊 {t("pred.trendCategories")}
                </div>
                <div style={{ overflowX: "auto", margin: "0 -22px", padding: "0 22px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                                {[
                                    { k: "pred.colCategory",  align: "left"  },
                                    { k: "pred.colType",      align: "left"  },
                                    { k: "pred.colThisMonth", align: "right" },
                                    { k: "pred.colAvg3m",     align: "right" },
                                    { k: "pred.colPrediction",align: "right" },
                                    { k: "pred.colStatus",    align: "right" },
                                ].map(h => (
                                    <th key={h.k} style={{ padding: "10px 10px", textAlign: h.align, color: "var(--color-subtle)", fontWeight: 800, fontSize: 10, letterSpacing: 1.4, whiteSpace: "nowrap", textTransform: "uppercase" }}>
                                        {t(h.k)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allCategories
                                .sort((a, b) => (spentByCategory[b] || 0) - (spentByCategory[a] || 0))
                                .map(cat => {
                                    const spent     = spentByCategory[cat]     || 0;
                                    const avg       = avgByCategory[cat]       || 0;
                                    const predicted = predictedByCategory[cat] || (spent / todayDay * daysInMonth);
                                    const isFixed   = fixedSet.has(cat);
                                    const diff      = avg > 0 ? ((predicted - avg) / avg) * 100 : 0;
                                    const statusStr = isFixed ? "fixed"
                                        : diff > 20 ? "danger" : diff > -10 ? "warning" : "safe";
                                    const statusChip = statusStr === "fixed"   ? "chip chip-blue"
                                        : statusStr === "safe"    ? "chip chip-mint"
                                        : statusStr === "warning" ? "chip chip-amber" : "chip chip-red";
                                    const statusLbl = statusStr === "fixed"   ? t("pred.statusFixed")
                                        : statusStr === "safe"    ? t("pred.safe")
                                        : statusStr === "warning" ? t("pred.warning") : t("pred.danger");

                                    return (
                                        <tr key={cat} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                                            <td style={{ padding: "12px 10px", color: "var(--color-text)", fontWeight: 700 }}>{cat}</td>
                                            <td style={{ padding: "12px 10px" }}>
                                                <span className={isFixed ? "chip chip-blue" : "chip chip-amber"} style={{ fontSize: 10 }}>
                                                    {isFixed ? t("pred.typeFixed") : t("pred.typeVariable")}
                                                </span>
                                            </td>
                                            <td className="num-tight mono" style={{ padding: "12px 10px", textAlign: "right", color: "var(--color-text)" }}>{fmtRp(spent)}</td>
                                            <td className="num-tight mono" style={{ padding: "12px 10px", textAlign: "right", color: "var(--color-muted)" }}>{avg > 0 ? fmtRp(avg) : "—"}</td>
                                            <td className="num-tight mono" style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: isFixed ? "var(--color-muted)" : (predicted > avg * 1.2 && avg > 0 ? "var(--color-expense)" : "var(--color-text)") }}>
                                                {fmtRp(predicted)}
                                                {isFixed && <span style={{ fontSize: 9, color: "var(--color-subtle)", display: "block", fontFamily: "inherit" }}>{t("pred.labelActual")}</span>}
                                            </td>
                                            <td style={{ padding: "12px 10px", textAlign: "right" }}>
                                                <span className={statusChip} style={{ whiteSpace: "nowrap" }}>
                                                    {statusLbl}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PrediksiView;
