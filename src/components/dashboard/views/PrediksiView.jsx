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
        background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)",
        borderRadius: 16, padding: "20px 22px",
    };

    if (!hasData) {
        return (
            <div style={{ animation: "fadeIn .4s" }}>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{t("pred.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>{t("pred.subtitle")}</p>
                </div>
                <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🔮</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>{t("pred.noData")}</div>
                    <div style={{ fontSize: 13, color: "var(--color-subtle)" }}>{t("pred.noDataSub")}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{t("pred.title")}</h1>
                <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                    {t("pred.subtitle")} · {monthName}
                </p>
            </div>

            {/* Info banner — metode prediksi */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(96,252,198,.06)", border: "1px solid rgba(96,252,198,.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🧮</span>
                <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--color-primary)" }}>{t("pred.methodTitle")}</strong>
                    {" "}— {t("pred.methodDesc")}{" "}
                    <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{t("pred.fixed")}</span> {t("pred.methodFixedDesc")}
                    {" "}{t("pred.methodAnd")}{" "}
                    <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{t("pred.variable")}</span> {t("pred.methodVariableDesc")}.
                    {" "}{t("pred.fixedLabel")} <strong style={{ color: "#4FC3F7" }}>{fmtRp(fixedTotal)}</strong> ·
                    {t("pred.variablePerDay")} <strong style={{ color: "#f59e0b" }}>{fmtRp(variableDailyRate)}</strong>
                    <span style={{ display: "block", marginTop: 4, color: "var(--color-subtle)" }}>
                        💡 {t("pred.aiTip")} <strong>AI Coach</strong>.
                    </span>
                </div>
            </div>

            {/* Top 2 cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 20 }}>

                {/* Prediksi Pengeluaran */}
                <div style={{ ...cardStyle, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(96,252,198,.06)", pointerEvents: "none" }} />

                    {/* Label + konteks */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-subtle)", letterSpacing: 1, marginBottom: 2 }}>
                        {t("pred.estTotalExpense")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 10 }}>
                        📅 {t("pred.endOf")} {monthName} ({t("pred.dayOf")}{todayDay} {t("pred.dari")} {daysInMonth})
                    </div>

                    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-text)", marginBottom: 12 }}>
                        {fmtRp(predictedTotal)}
                    </div>

                    {/* Rumus prediksi yang transparan */}
                    <div style={{ background: "var(--bg-surface-low)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ color: "var(--color-muted)" }}>✅ {t("pred.alreadySpent")}</span>
                            <strong style={{ color: "var(--color-text)" }}>{fmtRp(spentThisMonth)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ color: "var(--color-muted)" }}>📈 + {t("pred.projRemaining")} {remainingDays} {t("pred.daysLeft")}</span>
                            <strong style={{ color: "#f59e0b" }}>+{fmtRp(remainingPredicted)}</strong>
                        </div>
                        <div style={{ borderTop: "1px solid var(--color-border-soft)", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ color: "var(--color-muted)", fontWeight: 600 }}>= {t("pred.totalMonthEnd")}</span>
                            <strong style={{ color: "var(--color-primary)" }}>{fmtRp(predictedTotal)}</strong>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                            🔒 {t("pred.fixedLabel")} <strong style={{ color: "#4FC3F7" }}>{fmtRp(fixedTotal)}</strong>
                        </span>
                        <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                            📈 {t("pred.variablePerDay")} <strong style={{ color: "#f59e0b" }}>{fmtRp(variableDailyRate)}</strong>
                        </span>
                    </div>

                    {avgTotal3m > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: trendUp ? "rgba(255,113,108,.12)" : "rgba(96,252,198,.12)", color: trendUp ? "#ff716c" : "var(--color-primary)" }}>
                                {trendUp ? "▲" : "▼"} {Math.abs(trendPct)}%
                            </span>
                            <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>{t("pred.vsLastMonth")}</span>
                        </div>
                    )}

                    <div style={{ height: 4, borderRadius: 2, background: "var(--color-border-soft)", marginTop: 12 }}>
                        <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#60fcc6,#4FC3F7)", width: `${Math.min(100, (todayDay / daysInMonth) * 100)}%` }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 4 }}>
                        {t("pred.monthProgress")}: {todayDay}/{daysInMonth} {t("pred.days")} ({Math.round((todayDay/daysInMonth)*100)}%)
                    </div>
                </div>

                {/* Estimasi Saldo */}
                <div style={{ ...cardStyle, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(79,195,247,.06)", pointerEvents: "none" }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-subtle)", letterSpacing: 1, marginBottom: 10 }}>
                        {t("pred.estimatedBalance").toUpperCase()}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: estimatedEndBalance >= 0 ? "var(--color-text)" : "#ff716c", marginBottom: 4 }}>
                        {fmtRp(estimatedEndBalance)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
                        {t("pred.currentBalance")}: <strong style={{ color: "var(--color-text)" }}>{fmtRp(totalBalance)}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
                        {t("pred.projVariableRem")}: <strong style={{ color: "#ff716c" }}>−{fmtRp(remainingPredicted)}</strong>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 10 }}>
                        {remainingDays} {t("pred.daysRemaining")} @ {fmtRp(variableDailyRate)}{t("pred.perDayVar")}
                    </div>
                </div>
            </div>

            {/* Alert Kategori */}
            {alertCategories.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>⚠️</span> {t("pred.alertCategories")}
                        <span style={{ fontSize: 11, background: "rgba(255,113,108,.12)", color: "#ff716c", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>
                            {alertCategories.length}
                        </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {alertCategories.map(a => (
                            <div key={a.category} style={{ padding: "12px 14px", borderRadius: 12, background: a.status === "danger" ? "rgba(255,113,108,.06)" : "rgba(245,158,11,.06)", border: `1px solid ${a.status === "danger" ? "rgba(255,113,108,.2)" : "rgba(245,158,11,.2)"}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{a.category}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${a.status === "danger" ? "#ff716c" : "#f59e0b"}18`, color: a.status === "danger" ? "#ff716c" : "#f59e0b" }}>
                                        {a.status === "danger" ? t("pred.danger") : t("pred.warning")} {a.pct}%
                                    </span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: "var(--color-border-soft)", marginBottom: 6 }}>
                                    <div style={{ height: "100%", borderRadius: 3, background: a.status === "danger" ? "#ff716c" : "#f59e0b", width: `${Math.min(100, a.pct)}%`, transition: "width .5s" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-subtle)" }}>
                                    <span>{t("pred.labelSpent")}: {fmtRp(a.spent)}</span>
                                    <span>{t("pred.labelPredicted")}: {fmtRp(a.predicted)}</span>
                                    <span>{t("pred.labelBudget")}: {fmtRp(a.budget)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tren per Kategori */}
            <div style={cardStyle}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
                    📊 {t("pred.trendCategories")}
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
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
                                    <th key={h.k} style={{ padding: "8px 10px", textAlign: h.align, color: "var(--color-subtle)", fontWeight: 700, fontSize: 10, letterSpacing: .5, whiteSpace: "nowrap" }}>
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
                                    const statusClr = statusStr === "fixed"   ? "#4FC3F7"
                                        : statusStr === "safe"    ? "var(--color-primary)"
                                        : statusStr === "warning" ? "#f59e0b" : "#ff716c";
                                    const statusLbl = statusStr === "fixed"   ? t("pred.statusFixed")
                                        : statusStr === "safe"    ? t("pred.safe")
                                        : statusStr === "warning" ? t("pred.warning") : t("pred.danger");

                                    return (
                                        <tr key={cat} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                                            <td style={{ padding: "10px 10px", color: "var(--color-text)", fontWeight: 600 }}>{cat}</td>
                                            <td style={{ padding: "10px 10px" }}>
                                                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: isFixed ? "rgba(79,195,247,.12)" : "rgba(245,158,11,.1)", color: isFixed ? "#4FC3F7" : "#f59e0b" }}>
                                                    {isFixed ? t("pred.typeFixed") : t("pred.typeVariable")}
                                                </span>
                                            </td>
                                            <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--color-text)" }}>{fmtRp(spent)}</td>
                                            <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--color-muted)" }}>{avg > 0 ? fmtRp(avg) : "—"}</td>
                                            <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: isFixed ? "var(--color-muted)" : (predicted > avg * 1.2 && avg > 0 ? "#ff716c" : "var(--color-text)") }}>
                                                {fmtRp(predicted)}
                                                {isFixed && <span style={{ fontSize: 9, color: "var(--color-subtle)", display: "block" }}>{t("pred.labelActual")}</span>}
                                            </td>
                                            <td style={{ padding: "10px 10px", textAlign: "right" }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${statusClr}18`, color: statusClr, whiteSpace: "nowrap" }}>
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
