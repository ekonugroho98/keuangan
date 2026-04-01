import { useState } from "react";
import { fmtRp, fmtDate } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

/* ── helpers ── */
const accentColor = (type) => {
    if (type === "bank")    return "var(--color-primary)";
    if (type === "ewallet") return "#a78bfa";
    if (type === "cash")    return "#f59e0b";
    return "var(--color-primary)";
};

const typeLabel = (type) => {
    if (type === "bank")    return "BANK";
    if (type === "ewallet") return "E-WALLET";
    if (type === "cash")    return "CASH";
    return type?.toUpperCase() || "AKUN";
};

const typeBadgeStyle = (type) => {
    const color = accentColor(type);
    return {
        fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
        textTransform: "uppercase", padding: "3px 8px",
        borderRadius: 6,
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
    };
};

const card = {
    background: "var(--bg-surface)",
    borderRadius: 18,
    padding: "22px 22px 18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition: "transform .25s, box-shadow .25s, border-color .25s",
    border: "1px solid rgba(255,255,255,.06)",
    cursor: "default",
};

/* ── component ── */
const AkunView = ({ accounts, transactions, setShowAddAccount, setActiveMenu }) => {
    const { t } = useLanguage();
    const tCat = (name) => t("cat.name." + name) || name;
    const [activeTab, setActiveTab] = useState(accounts[0]?.id || null);

    const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const bankCount    = accounts.filter(a => a.type === "bank").length;
    const ewalletCount = accounts.filter(a => a.type === "ewallet").length;
    const cashCount    = accounts.filter(a => a.type === "cash").length;

    const activeAccount = accounts.find(a => a.id === activeTab) || accounts[0];
    const recentTx = activeAccount
        ? transactions
            .filter(tx => tx.account_name === activeAccount.name)
            .slice(0, 5)
        : [];

    return (
        <div style={{ animation: "fadeIn .4s", display: "flex", flexDirection: "column", gap: 22 }}>

            {/* ── Page Header ── */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
                        {t("acc.title") || "Akun & Saldo"}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                        {t("acc.subtitle") || "Kelola rekening dan pantau saldo Anda."}
                    </p>
                </div>
                <div style={{ background: "rgba(96,252,198,.08)", border: "1px solid rgba(96,252,198,.2)", borderRadius: 12, padding: "8px 18px", textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
                        {t("dash.totalBalance") || "Total Saldo"}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary)" }}>{fmtRp(totalBalance)}</div>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                {/* Total Saldo */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: "18px 20px", borderLeft: "4px solid #00C896" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                        {t("dash.totalBalance") || "Total Saldo"}
                    </p>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary)", margin: "0 0 4px" }}>{fmtRp(totalBalance)}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>
                        {accounts.length} {t("dash.accountsCount") || "rekening"}
                    </p>
                </div>
                {/* Jumlah Rekening */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: "18px 20px", borderLeft: "4px solid #a78bfa" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                        {t("acc.totalAccounts") || "Jumlah Rekening"}
                    </p>
                    <h3 style={{ fontSize: 32, fontWeight: 800, color: "#a78bfa", margin: "0 0 4px", lineHeight: 1 }}>{accounts.length}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>
                        {t("acc.allTypes") || "Bank, E-Wallet, Tunai"}
                    </p>
                </div>
                {/* Bank */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: "18px 20px", borderLeft: "4px solid #00C896" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Bank</p>
                    <h3 style={{ fontSize: 32, fontWeight: 800, color: "var(--color-primary)", margin: "0 0 4px", lineHeight: 1 }}>{bankCount}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>
                        {fmtRp(accounts.filter(a => a.type === "bank").reduce((s, a) => s + a.balance, 0))}
                    </p>
                </div>
                {/* E-Wallet */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: "18px 20px", borderLeft: "4px solid #a78bfa" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>E-Wallet</p>
                    <h3 style={{ fontSize: 32, fontWeight: 800, color: "#a78bfa", margin: "0 0 4px", lineHeight: 1 }}>{ewalletCount}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>
                        {fmtRp(accounts.filter(a => a.type === "ewallet").reduce((s, a) => s + a.balance, 0))}
                    </p>
                </div>
                {/* Tunai */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: "18px 20px", borderLeft: "4px solid #f59e0b" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{t("acc.cash") || "Tunai"}</p>
                    <h3 style={{ fontSize: 32, fontWeight: 800, color: "#f59e0b", margin: "0 0 4px", lineHeight: 1 }}>{cashCount}</h3>
                    <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>
                        {fmtRp(accounts.filter(a => a.type === "cash").reduce((s, a) => s + a.balance, 0))}
                    </p>
                </div>
            </div>

            {/* ── Account Cards Grid ── */}
            <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: "0 0 14px" }}>
                    {t("acc.allAccounts") || "Semua Rekening"}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                    {accounts.map(a => {
                        const color   = accentColor(a.type);
                        const txCount = transactions.filter(tx => tx.account_name === a.name).length;
                        const acctBalance = accounts.find(ac => ac.id === a.id)?.balance || 0;
                        return (
                            <div
                                key={a.id}
                                style={{ ...card }}
                                onMouseOver={e => {
                                    e.currentTarget.style.transform = "translateY(-3px)";
                                    e.currentTarget.style.boxShadow = `0 12px 40px ${color}18`;
                                    e.currentTarget.style.borderColor = `${color}40`;
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,.06)";
                                }}
                            >
                                {/* Top: badge + icon */}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                                    <span style={typeBadgeStyle(a.type)}>{typeLabel(a.type)}</span>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14,
                                        background: `${color}15`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 24,
                                    }}>
                                        {a.icon}
                                    </div>
                                </div>

                                {/* Middle: name */}
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 2 }}>{a.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                                        {txCount} {t("tx.summary") || "transaksi"}
                                    </div>
                                </div>

                                {/* Balance */}
                                <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.5px", marginBottom: 16 }}>
                                    {fmtRp(acctBalance)}
                                </div>

                                {/* Bottom: action buttons */}
                                <div style={{ display: "flex", gap: 8, borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 14 }}>
                                    <button
                                        onClick={() => setActiveMenu && setActiveMenu("transaksi")}
                                        style={{
                                            flex: 1, padding: "8px 0", borderRadius: 9,
                                            border: `1px solid ${color}30`,
                                            background: "transparent",
                                            color, fontSize: 11, fontWeight: 600,
                                            cursor: "pointer", fontFamily: "inherit",
                                            transition: "background .15s",
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = `${color}10`}
                                        onMouseOut={e => e.currentTarget.style.background = "transparent"}
                                    >
                                        {t("acc.viewTx") || "Lihat Transaksi"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* ── Add Account Card ── */}
                    <div
                        onClick={() => setShowAddAccount(true)}
                        style={{
                            minHeight: 210, borderRadius: 18,
                            border: "2px dashed rgba(96,252,198,.2)",
                            background: "transparent",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            cursor: "pointer", gap: 10,
                            transition: "border-color .2s, background .2s",
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.borderColor = "rgba(96,252,198,.45)";
                            e.currentTarget.style.background = "rgba(96,252,198,.03)";
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.borderColor = "rgba(96,252,198,.2)";
                            e.currentTarget.style.background = "transparent";
                        }}
                    >
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(96,252,198,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--color-primary)" }}>+</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>{t("acc.addNew")?.replace("+ ", "") || "Tambah Rekening"}</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{t("acc.addNewSub") || "Bank, e-wallet, atau tunai"}</div>
                    </div>
                </div>
            </div>

            {/* ── Recent Transactions per Account ── */}
            {accounts.length > 0 && (
                <div style={{ background: "var(--bg-surface)", borderRadius: 18, padding: "22px 22px 18px", border: "1px solid rgba(255,255,255,.06)" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: "0 0 16px" }}>
                        {t("acc.recentTxPerAccount") || "Transaksi Terbaru per Rekening"}
                    </h3>

                    {/* Account tabs */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 4, flexWrap: "wrap" }}>
                        {accounts.map(a => {
                            const isActive = activeTab === a.id;
                            const color = accentColor(a.type);
                            return (
                                <button
                                    key={a.id}
                                    onClick={() => setActiveTab(a.id)}
                                    style={{
                                        padding: "7px 16px", borderRadius: 9999,
                                        border: isActive ? `1px solid ${color}50` : "1px solid rgba(255,255,255,.07)",
                                        background: isActive ? `${color}15` : "transparent",
                                        color: isActive ? color : "var(--color-muted)",
                                        fontSize: 12, fontWeight: isActive ? 700 : 400,
                                        cursor: "pointer", fontFamily: "inherit",
                                        transition: "all .15s",
                                        whiteSpace: "nowrap",
                                        display: "flex", alignItems: "center", gap: 6,
                                    }}
                                >
                                    <span style={{ fontSize: 14 }}>{a.icon}</span>
                                    <span>{a.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Transactions list */}
                    {recentTx.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: "#475569" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                            <p style={{ fontSize: 12, margin: 0, color: "var(--color-muted)" }}>{t("tx.noTxPeriod") || "Belum ada transaksi"}</p>
                        </div>
                    ) : (
                        <>
                            {recentTx.map((tx, idx) => {
                                const isIncome   = tx.type === "income";
                                const isTransfer = tx.type === "transfer";
                                const amtColor   = isIncome ? "var(--color-primary)" : isTransfer ? "#4FC3F7" : "#ff716c";
                                const sign       = isIncome ? "+" : isTransfer ? "↔ " : "-";
                                const iconBg     = isIncome ? "rgba(96,252,198,.1)" : isTransfer ? "rgba(79,195,247,.1)" : "rgba(255,113,108,.08)";
                                return (
                                    <div key={tx.id} style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                        padding: "11px 10px", borderRadius: 10,
                                        background: idx % 2 === 0 ? "rgba(19,19,26,.8)" : "rgba(37,37,47,.2)",
                                        marginBottom: 2, gap: 10,
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                            <div style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                                                {tx.icon}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.note}</div>
                                                <div style={{ fontSize: 10, color: "var(--color-subtle)" }}>{fmtDate(tx.date)} · {tCat(tx.category)}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: amtColor, flexShrink: 0, whiteSpace: "nowrap" }}>
                                            {sign}{fmtRp(tx.amount)}
                                        </div>
                                    </div>
                                );
                            })}
                            <button
                                onClick={() => setActiveMenu && setActiveMenu("transaksi")}
                                style={{ width: "100%", marginTop: 12, padding: "9px 0", borderRadius: 10, border: "1px dashed rgba(96,252,198,.2)", background: "transparent", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >
                                {t("dash.viewAll") || "Lihat Semua"} →
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AkunView;
