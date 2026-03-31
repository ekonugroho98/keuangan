import { fmtRp, fmtDate } from "../../../utils/formatters";
import { categoryColors } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";

const DasborView = ({ accounts, transactions, goals, totalBalance, totalIncome, totalExpense, netBalance, savingRate, expenseRate, sortedCats, setActiveMenu, setShowAddAccount, setShowAddTx, customCategories = [] }) => {
    const { t } = useLanguage();

    // Hitung bulan ini vs bulan lalu
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const lm = m === 0 ? 11 : m - 1, ly = m === 0 ? y - 1 : y;

    const txThis  = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === m  && d.getFullYear() === y;  });
    const txLast  = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === lm && d.getFullYear() === ly; });

    const thisIncome  = txThis.filter(tx => tx.type === "income" ).reduce((a, tx) => a + tx.amount, 0);
    const thisExpense = txThis.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
    const lastIncome  = txLast.filter(tx => tx.type === "income" ).reduce((a, tx) => a + tx.amount, 0);
    const lastExpense = txLast.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);

    const pctChange = (cur, prev) => {
        if (prev === 0 && cur === 0) return null;
        if (prev === 0) return null;
        const val = Math.round(((cur - prev) / prev) * 100);
        return (val >= 0 ? "+" : "") + val + "%";
    };

    const incomePct  = pctChange(thisIncome, lastIncome);
    const expensePct = pctChange(thisExpense, lastExpense);
    const thisNetBalance = thisIncome - thisExpense;
    const thisSavingRate = thisIncome > 0 ? Math.round((1 - thisExpense / thisIncome) * 100) : 0;
    const totalCats = 15 + (customCategories?.length || 0);

    return (
    <div style={{ animation: "fadeIn .4s" }}>
        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
            {[
                { label: t("dash.totalBalance"),   val: fmtRp(totalBalance),    sub: t("dash.totalBalanceSub"),    icon: "💰", color: "#6366f1" },
                { label: t("dash.incomeMonth"),    val: fmtRp(thisIncome),      sub: t("dash.fromLastMonth"),      icon: "📈", color: "#10b981", pct: incomePct,  isExpense: false },
                { label: t("dash.expenseMonth"),   val: fmtRp(thisExpense),     sub: t("dash.fromLastMonth"),      icon: "📉", color: "#ef4444", pct: expensePct, isExpense: true },
                { label: t("dash.netBalance"),     val: fmtRp(thisNetBalance),  sub: `${t("dash.savingRateLabel")}: ${thisSavingRate}%`, icon: "💎", color: "#8b5cf6" },
            ].map((c, i) => (
                <div key={i} style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22, backdropFilter: "blur(10px)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{c.label}</span>
                        <span style={{ fontSize: 20 }}>{c.icon}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{c.val}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                        {c.pct && (() => {
                            const isPos = c.pct.startsWith("+");
                            const pctColor = c.isExpense
                                ? (isPos ? "#ef4444" : "#10b981")
                                : (isPos ? "#10b981" : "#ef4444");
                            return <span style={{ background: pctColor + "18", color: pctColor, padding: "2px 8px", borderRadius: 6, fontWeight: 600, marginRight: 6 }}>{c.pct}</span>;
                        })()}
                        {c.sub}
                    </div>
                </div>
            ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 24 }}>
            {/* Akun */}
            <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{t("dash.yourAccounts")}</h3>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{accounts.length} {t("dash.accountsCount")} {fmtRp(totalBalance)}</span>
                    </div>
                    <button onClick={() => setActiveMenu("akun")} style={{ background: "none", border: "none", color: "#818cf8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.viewAll")}</button>
                </div>
                {accounts.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${a.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{a.icon}</div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{a.name}</div>
                                <div style={{ fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>{a.type}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmtRp(a.balance)}</div>
                    </div>
                ))}
                <button onClick={() => setShowAddAccount(true)} style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 10, border: "1px dashed rgba(99,102,241,.3)", background: "transparent", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.addAccount")}</button>
            </div>

            {/* Transaksi Terbaru */}
            <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{t("dash.recentTx")}</h3>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{t("dash.last5tx")}</span>
                    </div>
                    <button onClick={() => setActiveMenu("transaksi")} style={{ background: "none", border: "none", color: "#818cf8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.viewAll")}</button>
                </div>
                {transactions.slice(0, 5).map(tx => (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.type === "income" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{tx.icon}</div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{tx.note}</div>
                                <div style={{ fontSize: 10, color: "#64748b" }}>{fmtDate(tx.date)} · {tx.account}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === "income" ? "#10b981" : "#ef4444" }}>{tx.type === "income" ? "+" : "-"}{fmtRp(tx.amount)}</div>
                    </div>
                ))}
                <button onClick={() => setShowAddTx(true)} style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 10, border: "1px dashed rgba(99,102,241,.3)", background: "transparent", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.addTx")}</button>
            </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            {/* Kesehatan Keuangan */}
            <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 20 }}>{t("dash.financialHealth")}</h3>
                {[
                    { label: t("dash.savingRate"),   val: savingRate,   note: savingRate > 20   ? t("dash.goodRate")    : t("dash.needImprove"), color: savingRate > 20   ? "#10b981" : "#f59e0b" },
                    { label: t("dash.expenseRatio"), val: expenseRate,  note: expenseRate < 70  ? t("dash.veryGood")   : t("dash.tooHigh"),     color: expenseRate < 70  ? "#10b981" : "#ef4444" },
                ].map((h, i) => (
                    <div key={i} style={{ marginBottom: 18 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: "#cbd5e1" }}>{h.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: h.color }}>{h.val}%</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.04)" }}>
                            <div style={{ height: "100%", borderRadius: 4, background: h.color, width: `${Math.min(h.val, 100)}%`, transition: "width 1s" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{h.note}</div>
                    </div>
                ))}
            </div>

            {/* Kategori Teratas */}
            <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{t("dash.topCategories")}</h3>
                <span style={{ fontSize: 11, color: "#64748b" }}>{t("dash.topCatSub")}</span>
                <div style={{ marginTop: 16 }}>
                    {sortedCats.slice(0, 5).map(([cat, amt], i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: "#cbd5e1" }}>{cat}</span>
                                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{fmtRp(amt)}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.04)" }}>
                                <div style={{ height: "100%", borderRadius: 3, background: categoryColors[cat] || "#6366f1", width: `${(amt / totalExpense) * 100}%`, transition: "width .8s" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Statistik Cepat */}
            <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 20 }}>{t("dash.quickStats")}</h3>
                {[
                    { l: t("dash.totalAccounts"),   v: accounts.length, i: "🏦" },
                    { l: t("dash.totalCategories"), v: totalCats,        i: "🏷️" },
                    { l: t("dash.txThisMonth"),     v: txThis.length,    i: "💳" },
                ].map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 18 }}>{s.i}</span>
                            <span style={{ fontSize: 13, color: "#94a3b8" }}>{s.l}</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{s.v}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
    );
};

export default DasborView;
