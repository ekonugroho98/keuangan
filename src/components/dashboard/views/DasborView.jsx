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

const DasborView = ({ accounts, transactions, goals, investments = [], totalBalance, totalIncome, totalExpense, netBalance, savingRate, expenseRate, sortedCats, setActiveMenu, setShowAddAccount, setShowAddTx, customCategories = [] }) => {
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

    // Tabungan Aktual = investasi bulan ini + transfer masuk ke akun tabungan bulan ini
    const tabunganAccountNames = new Set(
        accounts.filter(a => a.type === "tabungan").map(a => a.name)
    );

    // Investasi baru bulan ini (buy_price saat created_at = bulan ini)
    const investmentSaving = investments
        .filter(inv => {
            const d = new Date(inv.created_at);
            return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((sum, inv) => sum + (inv.buy_price || 0), 0);

    // Transfer/setoran masuk ke akun bertipe "tabungan" bulan ini
    const tabunganSaving = txThis
        .filter(tx => tx.type === "income" && tabunganAccountNames.has(tx.account_name))
        .reduce((sum, tx) => sum + tx.amount, 0);

    const actualSavingAmt  = investmentSaving + tabunganSaving;
    const actualSavingRate = thisIncome > 0 ? Math.round((actualSavingAmt / thisIncome) * 100) : 0;

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
                    <p style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 700 }}>
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

            {/* Kesehatan Finansial */}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4FC3F7", flexShrink: 0 }} />
                            <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>
                                {t("dash.actualSaving")}: <strong style={{ color: "#4FC3F7" }}>{actualSavingRate}%</strong>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* ROW 2: AKUN — full width horizontal scroll */}
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
                        display: "flex", flexDirection: "column", justifyContent: "space-between", height: 108,
                        flexShrink: 0,
                    }}>
                        <div>
                            <span style={{ fontSize: 9, background: "var(--bg-surface-low)", padding: "2px 7px", borderRadius: 4, color: "var(--color-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{a.type}</span>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.icon} {a.name}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)" }}>{fmtRp(a.balance)}</div>
                    </div>
                ))}
                <div
                    onClick={() => setShowAddAccount(true)}
                    style={{
                        minWidth: 120, height: 108, borderRadius: 14,
                        border: "1.5px dashed rgba(96,252,198,.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
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
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{t("dash.recentTx")}</h3>
                        <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{t("dash.last5tx")}</span>
                    </div>
                    <button onClick={() => setActiveMenu("transaksi")} style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("dash.viewAll")}</button>
                </div>
                {transactions.slice(0, 5).map(tx => (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--color-border-soft)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: tx.type === "income" ? "rgba(96,252,198,.1)" : "rgba(255,113,108,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{tx.icon}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.note}</div>
                                <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{fmtDate(tx.date)}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tx.type === "income" ? "var(--color-primary)" : "#ff716c", flexShrink: 0, marginLeft: 8 }}>{tx.type === "income" ? "+" : "-"}{fmtRp(tx.amount)}</div>
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

            {/* Kesehatan + Quick Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={card}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 14 }}>{t("dash.financialHealth")}</h3>

                    {/* Sisa Pendapatan */}
                    {[
                        { label: t("dash.savingRate"),   val: savingRate,  color: savingRate > 20  ? "var(--color-primary)" : "#f59e0b", note: savingRate > 20  ? t("dash.goodRate")   : t("dash.needImprove") },
                        { label: t("dash.expenseRatio"), val: expenseRate, color: expenseRate < 70 ? "var(--color-primary)" : "#ff716c", note: expenseRate < 70 ? t("dash.veryGood")  : t("dash.tooHigh") },
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

                    {/* Tabungan Aktual */}
                    <div style={{ borderTop: "1px solid var(--color-border-soft)", paddingTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <div>
                                <span style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>{t("dash.actualSaving")}</span>
                                <span style={{ fontSize: 10, color: "var(--color-muted)", marginLeft: 6 }}>💡 {t("dash.fromInvestment")}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: actualSavingRate > 0 ? "#4FC3F7" : "var(--color-subtle)" }}>
                                {actualSavingRate}%
                            </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: "var(--bg-surface-low)" }}>
                            <div style={{ height: "100%", borderRadius: 99, background: "#4FC3F7", width: `${Math.min(actualSavingRate, 100)}%`, transition: "width 1s" }} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 3 }}>
                            {actualSavingAmt > 0 ? (
                                <span>
                                    {fmtRp(actualSavingAmt)}
                                    {investmentSaving > 0 && tabunganSaving > 0 && (
                                        <span> · 📈 {fmtRp(investmentSaving)} investasi + 🪙 {fmtRp(tabunganSaving)} tabungan</span>
                                    )}
                                    {investmentSaving > 0 && tabunganSaving === 0 && (
                                        <span> · dari investasi bulan ini</span>
                                    )}
                                    {tabunganSaving > 0 && investmentSaving === 0 && (
                                        <span> · dari akun tabungan bulan ini</span>
                                    )}
                                </span>
                            ) : "Belum ada tabungan/investasi bulan ini"}
                        </div>
                    </div>
                </div>

                <div style={card}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 14 }}>{t("dash.quickStats")}</h3>
                    {[
                        { l: t("dash.totalAccounts"),   v: accounts.length, i: "🏦" },
                        { l: t("dash.totalCategories"), v: totalCats,        i: "🏷️" },
                        { l: t("dash.txThisMonth"),     v: txThis.length,    i: "💳" },
                    ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: i > 0 ? "1px solid var(--color-border-soft)" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>{s.i}</span>
                                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.l}</span>
                            </div>
                            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)" }}>{s.v}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
    );
};

export default DasborView;
