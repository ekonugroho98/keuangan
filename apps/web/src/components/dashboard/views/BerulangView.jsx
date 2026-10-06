import { useState, useMemo } from "react";
import { fmtRp } from "../../../utils/formatters";
import { categoryIcons, allCategories } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";
import AmountInput from "../../ui/AmountInput";

const EMOJI_OPTIONS = ["🔄","🏠","🎬","🎵","⚡","💊","📚","🚗","🍔","📱","🛍️","💰","📊","🏋️","☕","🌿","🐾","🎮","🔧","🎁"];
const INCOME_CATS   = ["Gaji","Freelance","Bisnis","Investasi","Transfer"];

const nextDateFromFreq = (freq, from = new Date()) => {
    const d = new Date(from);
    if (freq === "daily")   d.setDate(d.getDate() + 1);
    if (freq === "weekly")  d.setDate(d.getDate() + 7);
    if (freq === "monthly") d.setMonth(d.getMonth() + 1);
    if (freq === "yearly")  d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
};

const daysUntil = (dateStr) => Math.ceil((new Date(dateStr) - new Date()) / 86400000);

const isThisMonth = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/* Hitung tanggal eksekusi terakhir berdasarkan next_date - 1 periode */
const lastExecutedDate = (r) => {
    const d = new Date(r.next_date);
    if (r.frequency === "daily")   d.setDate(d.getDate() - 1);
    if (r.frequency === "weekly")  d.setDate(d.getDate() - 7);
    if (r.frequency === "monthly") d.setMonth(d.getMonth() - 1);
    if (r.frequency === "yearly")  d.setFullYear(d.getFullYear() - 1);
    return d;
};

/* True jika transaksi sudah dieksekusi bulan ini (next_date sudah loncat ke depan) */
const isPaidThisMonth = (r) => {
    const last = lastExecutedDate(r);
    const now  = new Date();
    return last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth();
};

const toMonthly = (r) => {
    if (r.frequency === "monthly") return r.amount;
    if (r.frequency === "yearly")  return Math.round(r.amount / 12);
    if (r.frequency === "weekly")  return r.amount * 4;
    if (r.frequency === "daily")   return r.amount * 30;
    return r.amount;
};

const emptyForm = () => ({
    name: "", amount: "", icon: "🔄", category: "Lainnya",
    account_name: "", frequency: "monthly",
    next_date: nextDateFromFreq("monthly"), notes: "", debt_id: null,
});

const inputStyle = {
    width: "100%", padding: "10px 14px", boxSizing: "border-box",
    background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)",
    borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none",
};

/* ─── SummaryCard ─── */
const SCard = ({ label, value, sub, color, icon }) => (
    <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "22px 24px", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)", borderLeft: `4px solid ${color}`, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.6 }}>{label}</div>
            <span style={{ fontSize: 18, opacity: .7 }}>{icon}</span>
        </div>
        <div className="num-tight mono" style={{ fontSize: "clamp(18px, 2.4vw, 24px)", fontWeight: 900, color, margin: 0, lineHeight: 1, letterSpacing: "-.03em" }}>{value}</div>
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>{sub}</div>
    </div>
);

/* ─── MAIN ─── */
const BerulangView = ({ recurrings = [], accounts = [], debts = [], onAdd, onEdit, onDelete, customCategories = [] }) => {
    const { t, lang } = useLanguage();
    const tCat = (name) => { const k = "cat.name." + name; const v = t(k); return v === k ? name : v; };

    const mergedCategories = [
        ...allCategories,
        ...customCategories.map(c => c.name).filter(n => !allCategories.includes(n)),
    ];

    const FREQ_OPTIONS = [
        { v: "daily",   l: t("rec.freq.daily"),   icon: "📅" },
        { v: "weekly",  l: t("rec.freq.weekly"),  icon: "📆" },
        { v: "monthly", l: t("rec.freq.monthly"), icon: "🗓️" },
        { v: "yearly",  l: t("rec.freq.yearly"),  icon: "📅" },
    ];
    const FREQ_LABEL = {
        daily: t("rec.freq.daily"), weekly: t("rec.freq.weekly"),
        monthly: t("rec.freq.monthly"), yearly: t("rec.freq.yearly"),
    };

    const [showModal,     setShowModal]     = useState(false);
    const [editTarget,    setEditTarget]    = useState(null);
    const [form,          setForm]          = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [filterStatus,  setFilterStatus]  = useState("all");
    const [search,        setSearch]        = useState("");
    const [hoveredId,     setHoveredId]     = useState(null);

    /* ── computed ── */
    const expenseRecs = recurrings.filter(r => !INCOME_CATS.includes(r.category));
    const incomeRecs  = recurrings.filter(r => INCOME_CATS.includes(r.category));
    const overdueRecs = recurrings.filter(r => daysUntil(r.next_date) < 0);
    const dueSoonRecs = recurrings.filter(r => daysUntil(r.next_date) >= 0 && isThisMonth(r.next_date));
    const paidRecs    = recurrings.filter(isPaidThisMonth);

    const monthlyExpense = expenseRecs.reduce((s, r) => s + toMonthly(r), 0);
    const monthlyIncome  = incomeRecs.reduce((s, r) => s + toMonthly(r), 0);

    const displayed = useMemo(() => {
        let list = [...recurrings];
        if (filterStatus === "overdue") list = list.filter(r => daysUntil(r.next_date) < 0);
        if (filterStatus === "soon")    list = list.filter(r => daysUntil(r.next_date) >= 0 && isThisMonth(r.next_date));
        if (filterStatus === "paid")    list = list.filter(isPaidThisMonth);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(r => r.name.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q) || r.account_name?.toLowerCase().includes(q));
        }
        return list.sort((a, b) => new Date(a.next_date) - new Date(b.next_date));
    }, [recurrings, filterStatus, search]);

    /* ── modal ── */
    const openAdd = () => {
        setEditTarget(null);
        const f = emptyForm();
        if (accounts.length > 0) f.account_name = accounts[0].name;
        setForm(f);
        setShowModal(true);
    };
    const openEdit = (r) => {
        setEditTarget(r);
        setForm({ name: r.name, amount: String(r.amount), icon: r.icon, category: r.category, account_name: r.account_name, frequency: r.frequency, next_date: r.next_date, notes: r.notes || "", debt_id: r.debt_id || null });
        setShowModal(true);
    };
    const handleFreqChange = (freq) => setForm(p => ({ ...p, frequency: freq, next_date: nextDateFromFreq(freq) }));
    const handleSubmit = () => {
        if (!form.name.trim() || !form.amount || !form.account_name) return;
        const payload = { name: form.name.trim(), amount: parseInt(form.amount), icon: form.icon, category: form.category, account_name: form.account_name, frequency: form.frequency, next_date: form.next_date, notes: form.notes.trim(), debt_id: form.debt_id || null };
        editTarget ? onEdit(editTarget.id, payload) : onAdd(payload);
        setShowModal(false);
    };
    const canSubmit = form.name.trim() && form.amount && form.account_name;

    const STATUS_TABS = [
        { id: "all",     label: t("tx.all") || "Semua",             count: recurrings.length },
        { id: "soon",    label: t("rec.thisMonth") || "Bulan Ini",   count: dueSoonRecs.length },
        { id: "paid",    label: t("rec.paid") || "Terbayar",         count: paidRecs.length,    accent: "var(--color-primary)" },
        { id: "overdue", label: t("rec.overdue") || "Sudah Lewat",   count: overdueRecs.length, accent: "#ff716c" },
    ];

    /* ── row color by urgency ── */
    const rowAccent = (r) => {
        const d = daysUntil(r.next_date);
        if (d < 0)  return "#ff716c";                                       // overdue → red
        if (d <= 3) return "#f59e0b";                                       // ≤3 days → amber
        if (d <= 7) return INCOME_CATS.includes(r.category) ? "var(--color-primary)" : "#f59e0b"; // 4–7 days → amber/green
        return INCOME_CATS.includes(r.category) ? "var(--color-primary)" : "#a78bfa";   // normal → green/purple
    };
    const amtColor = (r) => INCOME_CATS.includes(r.category) ? "var(--color-primary)" : "#ff716c";
    const amtSign  = (r) => INCOME_CATS.includes(r.category) ? "+" : "-";

    return (
        <div style={{ animation: "fadeIn .4s", display: "flex", flexDirection: "column", gap: 22 }}>

            {/* ── Confirm Delete ── */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 38, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("rec.deleteConfirm")}</h3>
                        <p style={{ color: "var(--color-subtle)", fontSize: 13, margin: "0 0 24px" }}><strong style={{ color: "#ff716c" }}>{confirmDelete.name}</strong></p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "var(--color-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add/Edit Modal ── */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 17, margin: 0 }}>{editTarget ? t("rec.editTitle") : t("rec.addTitle")}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("rec.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Netflix, Bayar Kos..." maxLength={50} style={{ ...inputStyle, marginBottom: 16 }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("tx.category")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {mergedCategories.map(cat => {
                                const customCat = customCategories.find(c => c.name === cat);
                                const icon = customCat?.icon || categoryIcons[cat] || "📦";
                                const isSel = form.category === cat;
                                return (
                                    <button key={cat} onClick={() => setForm(p => ({ ...p, category: cat }))}
                                        style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${isSel ? "rgba(96,252,198,.5)" : "var(--color-border-soft)"}`, background: isSel ? "rgba(96,252,198,.15)" : "transparent", color: isSel ? "var(--color-primary)" : "var(--color-muted)", fontSize: 12, fontWeight: isSel ? 700 : 400, display: "flex", alignItems: "center", gap: 5 }}>
                                        <span>{icon}</span><span>{cat}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("rec.amountLabel")}</label>
                        <AmountInput value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))} placeholder="150.000" inputStyle={{ ...inputStyle, marginBottom: 16 }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("rec.accountLabel")}</label>
                        {accounts.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#ff716c", marginBottom: 16 }}>{t("rec.noAccount")}</div>
                        ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                                {accounts.map(a => (
                                    <button key={a.id} onClick={() => setForm(p => ({ ...p, account_name: a.name }))}
                                        style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${form.account_name === a.name ? (a.color||"var(--color-primary)") + "55" : "var(--color-border-soft)"}`, background: form.account_name === a.name ? (a.color||"var(--color-primary)") + "18" : "transparent", color: form.account_name === a.name ? (a.color||"var(--color-primary)") : "var(--color-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                                        {a.icon} {a.name} <span style={{ fontSize: 10, opacity: .7 }}>({fmtRp(a.balance)})</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("rec.freqLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            {FREQ_OPTIONS.map(f => (
                                <button key={f.v} onClick={() => handleFreqChange(f.v)}
                                    style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${form.frequency === f.v ? "#60fcc655" : "var(--color-border-soft)"}`, background: form.frequency === f.v ? "rgba(96,252,198,.15)" : "transparent", color: form.frequency === f.v ? "var(--color-primary)" : "var(--color-subtle)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                                    <div style={{ marginBottom: 3 }}>{f.icon}</div><div>{f.l}</div>
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("rec.nextDateLabel")}</label>
                        <input type="date" value={form.next_date} onChange={e => setForm(p => ({ ...p, next_date: e.target.value }))} style={{ ...inputStyle, marginBottom: 16, colorScheme: "normal" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("rec.iconLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#60fcc655" : "var(--color-border-soft)"}`, background: form.icon === e ? "rgba(96,252,198,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("rec.notesLabel")}</label>
                        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opsional..." style={{ ...inputStyle, marginBottom: 16 }} />

                        {debts.length > 0 && (
                            <>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("rec.linkedDebt")}</label>
                                <div style={{ fontSize: 11, color: "#48474f", marginBottom: 8 }}>{t("rec.linkedDebtSub")}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                                    <button onClick={() => setForm(p => ({ ...p, debt_id: null }))}
                                        style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${!form.debt_id ? "rgba(100,116,139,.5)" : "var(--color-border-soft)"}`, background: !form.debt_id ? "rgba(100,116,139,.15)" : "transparent", color: !form.debt_id ? "var(--color-muted)" : "#48474f", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                        {t("rec.noLinked")}
                                    </button>
                                    {debts.map(d => (
                                        <button key={d.id} onClick={() => setForm(p => ({ ...p, debt_id: d.id }))}
                                            style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${form.debt_id === d.id ? (d.color||"var(--color-primary)") + "55" : "var(--color-border-soft)"}`, background: form.debt_id === d.id ? (d.color||"var(--color-primary)") + "15" : "transparent", color: form.debt_id === d.id ? (d.color||"var(--color-primary)") : "var(--color-subtle)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                            {d.icon} {d.name} <span style={{ fontSize: 10, opacity: .7, marginLeft: 4 }}>({fmtRp(d.remaining)} {t("rec.remaining")})</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                        {debts.length === 0 && <div style={{ marginBottom: 8 }} />}

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "var(--color-border-soft)" : "var(--color-primary)", color: !canSubmit ? "#94a3b8" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("common.saveChanges") : t("rec.addTitle")}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Page Header ── */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>
                        TRANSAKSI BERULANG
                    </div>
                    <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", margin: 0, letterSpacing: "-.025em" }}>
                        {t("rec.title")}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        {t("rec.subtitle") || "Otomasi tagihan dan pembayaran rutin Anda."}
                    </p>
                </div>
                <button onClick={openAdd} className="btn-primary"
                    style={{ padding: "10px 22px", minHeight: 42, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                    + {t("rec.addNew")?.replace("+ ","") || "Tambah Berulang"}
                </button>
            </div>

            {/* ── Summary Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                <SCard label={t("rec.totalRecurring") || "Total Berulang"}   value={recurrings.length}     sub={`${recurrings.length} ${t("tx.summary")||"item"}`}      color="var(--color-primary)" icon="🔄" />
                <SCard label={t("rec.monthlyBill") || "Tagihan / Bulan"}     value={fmtRp(monthlyExpense)} sub={`${expenseRecs.length} ${t("rec.items")||"item"}`}       color="#ff716c" icon="📉" />
                <SCard label={t("rec.monthlyIncome") || "Pemasukan / Bulan"} value={fmtRp(monthlyIncome)}  sub={`${incomeRecs.length} ${t("rec.items")||"item"}`}        color="#a78bfa" icon="📈" />
                <SCard label={t("rec.overdueLabel") || "Lewat Jatuh Tempo"}  value={overdueRecs.length}    sub={`${dueSoonRecs.length} ${t("rec.dueSoon")||"mendatang"}` } color="#f59e0b" icon="⚠️" />
            </div>

            {/* ── Filter Bar ── */}
            <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 16, padding: "12px 14px", boxShadow: "var(--glass-highlight)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "var(--bg-surface-low)", borderRadius: 10, padding: 4, gap: 2, overflowX: "auto", maxWidth: "100%", scrollSnapType: "x mandatory" }}>
                    {STATUS_TABS.map(tab => {
                        const isActive  = filterStatus === tab.id;
                        const tabColor  = tab.accent || "var(--color-primary)";
                        const activeBg  = tab.id === "overdue" ? "#ff716c" : tab.id === "paid" ? "var(--color-primary)" : "var(--color-primary)";
                        const activeClr = tab.id === "overdue" ? "#fff" : "var(--color-on-primary)";
                        /* badge color when inactive: tinted for paid/overdue */
                        const badgeBg   = isActive
                            ? (tab.id === "overdue" ? "rgba(255,255,255,.25)" : "rgba(0,94,68,.2)")
                            : tab.id === "overdue" && tab.count > 0
                                ? "rgba(255,113,108,.2)"
                                : tab.id === "paid" && tab.count > 0
                                    ? "rgba(96,252,198,.15)"
                                    : "rgba(255,255,255,.07)";
                        const badgeClr  = isActive ? (tab.id === "overdue" ? "#fff" : "var(--color-on-primary)")
                            : tab.id === "overdue" && tab.count > 0 ? "#ff716c"
                            : tab.id === "paid"    && tab.count > 0 ? "var(--color-primary)"
                            : "var(--color-muted)";
                        return (
                            <button key={tab.id} onClick={() => setFilterStatus(tab.id)}
                                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: isActive ? activeBg : "transparent", color: isActive ? activeClr : "var(--color-muted)", fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", minHeight: 36, scrollSnapAlign: "start" }}>
                                {tab.label}
                                <span style={{ fontSize: 10, background: badgeBg, color: badgeClr, borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>{tab.count}</span>
                            </button>
                        );
                    })}
                </div>
                <div style={{ position: "relative", flex: "1 1 160px", minWidth: "min(60vw, 160px)" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: .4, pointerEvents: "none" }}>🔍</span>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("rec.search") || "Cari transaksi berulang..."}
                        style={{ background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 10, color: "var(--color-text)", fontSize: 12, fontFamily: "inherit", padding: "10px 12px 10px 28px", outline: "none", width: "100%", boxSizing: "border-box", minHeight: 42 }} />
                </div>
            </div>

            {/* ── Empty State ── */}
            {recurrings.length === 0 ? (
                <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "52px 24px", textAlign: "center", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.05)" }}>
                    <div style={{ fontSize: 48, marginBottom: 14, opacity: .4 }}>🔄</div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 8px" }}>{t("rec.noData")}</h3>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 24px" }}>{t("rec.noDataSub")}</p>
                    <button onClick={openAdd} className="btn-primary"
                        style={{ padding: "10px 24px", minHeight: 42, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("rec.addFirst")}
                    </button>
                </div>
            ) : displayed.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-subtle)" }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: .4 }}>🔍</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>Tidak ada hasil</div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{t("tx.noTxPeriod")}</div>
                </div>
            ) : (
                /* ── Recurring List ── */
                <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid var(--color-border-soft)" }}>
                    {displayed.map((r, idx) => {
                        const days    = daysUntil(r.next_date);
                        const paid    = isPaidThisMonth(r);
                        const accent  = paid ? "var(--color-primary)" : rowAccent(r);
                        const isHov   = hoveredId === r.id;
                        const account = accounts.find(a => a.name === r.account_name);
                        const rowBg   = isHov ? "var(--bg-surface-hover)"
                            : paid ? "rgba(96,252,198,.04)"
                            : idx % 2 === 0 ? "var(--bg-surface-low)" : "var(--bg-alt-row)";
                        const lastExec = lastExecutedDate(r);
                        const dueText = paid
                            ? `✅ ${t("rec.paidOn") || "Dibayar"} ${lastExec.toLocaleDateString(lang || "id-ID", { day: "numeric", month: "short" })}`
                            : days < 0
                                ? `⚠️ ${t("rec.overdue") || "Lewat"} ${Math.abs(days)} hari`
                                : days === 0
                                    ? `🔔 ${t("rec.today") || "Hari ini"}`
                                    : days <= 3
                                        ? `⏰ ${days} ${t("rec.daysLeft") || "hari lagi"}`
                                        : `${days} ${t("rec.daysLeft") || "hari lagi"}`;
                        const dueColor = paid ? "var(--color-primary)" : days < 0 ? "#ff716c" : days <= 3 ? "#f59e0b" : "var(--color-subtle)";

                        return (
                            <div key={r.id}
                                onMouseEnter={() => setHoveredId(r.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: rowBg, borderLeft: `4px solid ${accent}`, transition: "background .15s", gap: 12 }}>

                                {/* Left: icon + info */}
                                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                                    <div style={{ width: 46, height: 46, borderRadius: 13, background: accent + "15", border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, transition: "transform .2s", transform: isHov ? "scale(1.08)" : "scale(1)" }}>
                                        {r.icon}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        {/* Name + freq badge */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: paid ? "var(--color-muted)" : "var(--color-text)" }}>{r.name}</span>
                                            <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 9999, background: accent + "18", color: accent, letterSpacing: 0.5, textTransform: "uppercase" }}>
                                                {FREQ_LABEL[r.frequency]}
                                            </span>
                                            {paid && (
                                                <span className="chip chip-mint">✓ {t("rec.paid") || "TERBAYAR"}</span>
                                            )}
                                            {!paid && days < 0 && (
                                                <span className="chip chip-red">overdue</span>
                                            )}
                                            {!paid && days >= 0 && days <= 3 && (
                                                <span className="chip chip-amber">due soon</span>
                                            )}
                                            {r.debt_id && debts.find(d => d.id === r.debt_id) && (
                                                <span className="chip chip-red">🔗 {debts.find(d => d.id === r.debt_id).name}</span>
                                            )}
                                        </div>
                                        {/* Meta row */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            {/* Due date */}
                                            <span style={{ fontSize: 11, color: dueColor, fontWeight: days <= 3 ? 600 : 400 }}>{dueText}</span>
                                            <span style={{ opacity: .3, fontSize: 10 }}>·</span>
                                            {/* Category */}
                                            <span style={{ fontSize: 10, color: "var(--color-muted)", background: "var(--color-border-soft)", padding: "1px 7px", borderRadius: 5 }}>
                                                {categoryIcons[r.category] || "📦"} {tCat(r.category)}
                                            </span>
                                            <span style={{ opacity: .3, fontSize: 10 }}>·</span>
                                            {/* Account */}
                                            <span style={{ fontSize: 10, color: account?.color || "var(--color-subtle)" }}>
                                                {account?.icon || "💳"} {r.account_name}
                                            </span>
                                            {/* Next date */}
                                            <span style={{ opacity: .3, fontSize: 10 }}>·</span>
                                            <span style={{ fontSize: 10, color: "var(--color-muted)" }}>
                                                {new Date(r.next_date).toLocaleDateString(lang || "id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: amount + actions */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                                    <div style={{ textAlign: "right" }}>
                                        <div className="num-tight mono" style={{ fontSize: "clamp(14px, 2vw, 16px)", fontWeight: 800, color: amtColor(r), whiteSpace: "nowrap", letterSpacing: "-.02em" }}>
                                            {amtSign(r)}{fmtRp(r.amount)}
                                        </div>
                                        <div className="num-tight mono" style={{ fontSize: 9, color: "var(--color-muted)", marginTop: 2 }}>
                                            ≈ {fmtRp(toMonthly(r))}{t("rec.perMonth") || "/bln"}
                                        </div>
                                    </div>
                                    {/* Action buttons — on hover */}
                                    <div style={{ display: "flex", gap: 4, opacity: isHov ? 1 : 0, transition: "opacity .15s", pointerEvents: isHov ? "auto" : "none" }}>
                                        <button aria-label="Edit" onClick={() => openEdit(r)}
                                            style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "var(--color-primary-soft)", color: "var(--color-primary)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>✏️</button>
                                        <button aria-label="Hapus" onClick={() => setConfirmDelete(r)}
                                            style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "var(--color-expense-soft)", color: "var(--color-expense)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>🗑️</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default BerulangView;
