import { fmtRp, fmtDate } from "../../../utils/formatters";
import { categoryColors } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";

const card = {
    background: "#1f1f26",
    borderRadius: 16,
    padding: "20px 22px",
    position: "relative",
    overflow: "hidden",
};

const DasborView = ({ accounts, transactions, goals, totalBalance, totalIncome, totalExpense, netBalance, savingRate, expenseRate, sortedCats, setActiveMenu, setShowAddAccount, setShowAddTx, customCategories = [] }) => {
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

    const acctBorderColor = (a) => {
        if (a.type === "bank")    return "#00C896";
        if (a.type === "ewallet") return "#a78bfa";
        if (a.type === "cash")    return "#f59e0b";
        return a.color || "#60fcc6";
    };

    return (
    <div style={{ animation: "fadeIn .4s", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ROW 1: STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            {/* Saldo Total */}
            <div style={{ ...card, borderLeft: "4px solid #00C896" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#acaab4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{t("dash.totalBalance")}</p>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{fmtRp(totalBalance)}</h2>
                <p style={{ fontSize: 10, color: "#8B8BA8" }}>🏦 {accounts.length} {t("dash.accountsCount")}</p>
            </div>

            {/* Pemasukan */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#acaab4", textTransform: "uppercase", letterSpacing: 1 }}>{t("dash.incomeMonth")}</p>
                    <span style={{ fontSize: 16 }}>📈</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{fmtRp(thisIncome)}</h2>
                {incomePct && (
                    <p style={{ fontSize: 10, color: "#60fcc6", fontWeight: 700 }}>
                        {incomePct.startsWith("+") ? "↑" : "↓"} {incomePct} <span style={{ fontWeight: 400, color: "#acaab4" }}>{t("dash.fromLastMonth")}</span>
                    </p>
                )}
            </div>

            {/* Pengeluaran */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#acaab4", textTransform: "uppercase", letterSpacing: 1 }}>{t("dash.expenseMonth")}</p>
                    <span style={{ fontSize: 16 }}>📉</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{fmtRp(thisExpense)}</h2>
                {expensePct && (
                    <p style={{ fontSize: 10, color: expensePct.startsWith("+") ? "#ff716c" : "#60fcc6", fontWeight: 700 }}>
                        {expensePct.startsWith("+") ? "↑" : "↓"} {expensePct} <span style={{ fontWeight: 400, color: "#acaab4" }}>{t("dash.fromLastMonth")}</span>
                    </p>
                )}
            </div>

            {/* Kesehatan Finansial */}
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                    <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="28" cy="28" r="22" fill="transparent" stroke="#2a2931" strokeWidth="5" />
                        <circle cx="28" cy="28" r="22" fill="transparent" stroke="#00C896"
                            strokeWidth="5"
                            strokeDasharray={`${Math.min(thisSavingRate, 100) * 1.382} 138.2`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{thisSavingRate}%</span>
                    </div>
                </div>
                <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#acaab4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{t("dash.savingRate")}</p>
                    <div style={{ background: "rgba(0,200,150,.1)", color: "#00C896", padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, display: "inline-block" }}>
                        {thisSavingRate > 20 ? `${t("dash.goodRate")} 👍` : t("dash.needImprove")}
                    </div>
                </div>
            </div>
        </div>

        {/* ROW 2: AKUN — full width horizontal scroll */}
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{t("dash.yourAccounts")}</h3>
                <button onClick={() => setActiveMenu("akun")} style={{ background: "none", border: "none", color: "#19ce9b", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.viewAll")} →</button>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
                {accounts.map(a => (
                    <div key={a.id} style={{
                        minWidth: 170, background: "#1f1f26", borderRadius: 14, padding: "16px 18px",
                        borderLeft: `4px solid ${acctBorderColor(a)}`,
                        display: "flex", flexDirection: "column", justifyContent: "space-between", height: 108,
                        flexShrink: 0,
                    }}>
                        <div>
                            <span style={{ fontSize: 9, background: "#2a2931", padding: "2px 7px", borderRadius: 4, color: "#acaab4", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{a.type}</span>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.icon} {a.name}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{fmtRp(a.balance)}</div>
                    </div>
                ))}
                <div
                    onClick={() => setShowAddAccount(true)}
                    style={{
                        minWidth: 120, height: 108, borderRadius: 14,
                        border: "1.5px dashed rgba(96,252,198,.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#60fcc6", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        flexDirection: "column", gap: 4, flexShrink: 0,
                    }}
                >
                    <span style={{ fontSize: 20 }}>+</span>
                    <span>{t("dash.addAccount")}</span>
                </div>
            </div>
        </div>

        {/* ROW 3: Transaksi + Kategori + Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>

            {/* Transaksi Terbaru */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{t("dash.recentTx")}</h3>
                        <span style={{ fontSize: 10, color: "#acaab4" }}>{t("dash.last5tx")}</span>
                    </div>
                    <button onClick={() => setActiveMenu("transaksi")} style={{ background: "none", border: "none", color: "#19ce9b", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.viewAll")}</button>
                </div>
                {transactions.slice(0, 5).map(tx => (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: tx.type === "income" ? "rgba(96,252,198,.1)" : "rgba(255,113,108,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{tx.icon}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.note}</div>
                                <div style={{ fontSize: 10, color: "#acaab4" }}>{fmtDate(tx.date)}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tx.type === "income" ? "#60fcc6" : "#ff716c", flexShrink: 0, marginLeft: 8 }}>{tx.type === "income" ? "+" : "-"}{fmtRp(tx.amount)}</div>
                    </div>
                ))}
                <button onClick={() => setShowAddTx(true)} style={{ width: "100%", marginTop: 10, padding: 8, borderRadius: 10, border: "1px dashed rgba(96,252,198,.25)", background: "transparent", color: "#60fcc6", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.addTx")}</button>
            </div>

            {/* Kategori Teratas */}
            <div style={card}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{t("dash.topCategories")}</h3>
                <span style={{ fontSize: 10, color: "#acaab4" }}>{t("dash.topCatSub")}</span>
                <div style={{ marginTop: 14 }}>
                    {sortedCats.slice(0, 5).map(([cat, amt], i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: "#e7e4ee" }}>{cat}</span>
                                <span style={{ fontSize: 11, color: "#acaab4", fontWeight: 600 }}>{fmtRp(amt)}</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 99, background: "#2a2931" }}>
                                <div style={{ height: "100%", borderRadius: 99, background: categoryColors[cat] || "#60fcc6", width: totalExpense > 0 ? `${(amt / totalExpense) * 100}%` : "0%", transition: "width .8s" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Kesehatan + Quick Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={card}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>{t("dash.financialHealth")}</h3>
                    {[
                        { label: t("dash.savingRate"),   val: savingRate,  color: savingRate > 20  ? "#00C896" : "#f59e0b", note: savingRate > 20  ? t("dash.goodRate")   : t("dash.needImprove") },
                        { label: t("dash.expenseRatio"), val: expenseRate, color: expenseRate < 70 ? "#00C896" : "#ff716c", note: expenseRate < 70 ? t("dash.veryGood")  : t("dash.tooHigh") },
                    ].map((h, i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                <span style={{ fontSize: 12, color: "#e7e4ee" }}>{h.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: h.color }}>{h.val}%</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 99, background: "#2a2931" }}>
                                <div style={{ height: "100%", borderRadius: 99, background: h.color, width: `${Math.min(h.val, 100)}%`, transition: "width 1s" }} />
                            </div>
                            <div style={{ fontSize: 10, color: "#8B8BA8", marginTop: 3 }}>{h.note}</div>
                        </div>
                    ))}
                </div>

                <div style={card}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>{t("dash.quickStats")}</h3>
                    {[
                        { l: t("dash.totalAccounts"),   v: accounts.length, i: "🏦" },
                        { l: t("dash.totalCategories"), v: totalCats,        i: "🏷️" },
                        { l: t("dash.txThisMonth"),     v: txThis.length,    i: "💳" },
                    ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>{s.i}</span>
                                <span style={{ fontSize: 12, color: "#acaab4" }}>{s.l}</span>
                            </div>
                            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.v}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
    );
};

export default DasborView;
