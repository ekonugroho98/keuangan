import { useState, useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { expenseCategories } from "../../../constants/categories";
import Modal from "../../ui/Modal";
import InputField from "../../ui/InputField";

const statusColor = (pct) => {
    if (pct >= 100) return "#ff716c";
    if (pct >= 80)  return "#f59e0b";
    return "var(--color-primary)";
};

const fmtRp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

const monthLabel = (val) => {
    const [y, m] = val.split("-");
    return new Date(parseInt(y), parseInt(m) - 1, 1)
        .toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

const prevMonth = (val) => {
    const [y, m] = val.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const AnggaranView = ({ budgets, transactions, onAdd, onEdit, onDelete, onCopyMonth, customCategories = [] }) => {
    const { t } = useLanguage();

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [showModal, setShowModal]     = useState(false);
    const [editTarget, setEditTarget]   = useState(null);
    const [form, setForm]               = useState({ category: "", amount: "" });
    const [confirmDelete, setConfirmDelete] = useState(null);

    /* months dropdown: current + 5 future + 12 past = 18 options */
    const months = useMemo(() => {
        const result = [];
        const now = new Date();
        for (let i = -12; i <= 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            result.push({ val, label: monthLabel(val) });
        }
        return result;
    }, []);

    /* budgets for selected month only */
    const monthBudgets = useMemo(
        () => budgets.filter(b => b.month === selectedMonth),
        [budgets, selectedMonth]
    );

    /* spending for selected month */
    const spending = useMemo(() => {
        const [y, m] = selectedMonth.split("-");
        const map = {};
        transactions.forEach(tx => {
            if (tx.type !== "expense") return;
            if (!(tx.date || "").startsWith(`${y}-${m}`)) return;
            map[tx.category] = (map[tx.category] || 0) + tx.amount;
        });
        return map;
    }, [transactions, selectedMonth]);

    /* categories already budgeted this month */
    const budgetedCats = useMemo(() => new Set(monthBudgets.map(b => b.category)), [monthBudgets]);

    const extraExpense = customCategories.filter(c => c.type !== "income").map(c => c.name);
    const allCats = [...expenseCategories, ...extraExpense];
    const availableCats = allCats.filter(c => !budgetedCats.has(c) || (editTarget && editTarget.category === c));

    /* summary */
    const totalBudget = monthBudgets.reduce((s, b) => s + b.amount, 0);
    const totalSpent  = monthBudgets.reduce((s, b) => s + (spending[b.category] || 0), 0);
    const overCount   = monthBudgets.filter(b => (spending[b.category] || 0) >= b.amount).length;

    /* prev month budgets — for copy button */
    const prev = prevMonth(selectedMonth);
    const prevBudgets = budgets.filter(b => b.month === prev);
    const canCopy = monthBudgets.length === 0 && prevBudgets.length > 0;

    const tCat = (name) => { const k = "cat.name." + name; const v = t(k); return v === k ? name : v; };

    const openAdd  = () => { setEditTarget(null); setForm({ category: availableCats[0] || "", amount: "", month: selectedMonth }); setShowModal(true); };
    const openEdit = (b) => { setEditTarget(b); setForm({ category: b.category, amount: String(b.amount), month: b.month }); setShowModal(true); };

    const handleSubmit = () => {
        if (!form.category || !form.amount || !form.month) return;
        const payload = { category: form.category, amount: parseInt(form.amount), month: form.month };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    return (
        <>
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
                        {t("budget.title") || "Anggaran"}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                        {t("budget.subtitle") || "Atur batas pengeluaran agar tidak melebihi rencana."}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: overCount > 0 ? "#ff716c" : "var(--color-primary)", fontWeight: 600, background: overCount > 0 ? "rgba(255,113,108,.08)" : "rgba(96,252,198,.08)", border: `1px solid ${overCount > 0 ? "rgba(255,113,108,.2)" : "rgba(96,252,198,.2)"}`, borderRadius: 20, padding: "4px 10px" }}>
                        {monthBudgets.length} {t("budget.categories") || "kategori"} · {overCount > 0 ? `${overCount} ${t("budget.overLimit") || "melebihi batas"}` : t("budget.allSafe") || "Semua dalam batas"}
                    </span>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--bg-surface-low)", color: "var(--color-text)", fontSize: 12, fontFamily: "inherit", outline: "none", cursor: "pointer" }}
                    >
                        {months.map(mo => <option key={mo.val} value={mo.val}>{mo.label}</option>)}
                    </select>
                    <button
                        onClick={openAdd}
                        disabled={availableCats.length === 0}
                        style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: availableCats.length === 0 ? "rgba(255,255,255,.07)" : "linear-gradient(135deg,#60fcc6,#19ce9b)", color: availableCats.length === 0 ? "#94a3b8" : "var(--color-on-primary)", fontSize: 13, fontWeight: 600, cursor: availableCats.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                    >
                        + Anggaran
                    </button>
                </div>
            </div>

            {/* Copy from prev month banner */}
            {canCopy && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(96,252,198,.08)", border: "1px solid rgba(96,252,198,.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
                        📋 Belum ada anggaran di <strong style={{ color: "var(--color-text)" }}>{monthLabel(selectedMonth)}</strong>.
                        Salin dari <strong style={{ color: "var(--color-primary)" }}>{monthLabel(prev)}</strong>?
                    </div>
                    <button
                        onClick={() => onCopyMonth(prevBudgets, selectedMonth)}
                        style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(96,252,198,.3)", background: "rgba(96,252,198,.1)", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                    >
                        Salin Anggaran
                    </button>
                </div>
            )}

            {/* Summary cards */}
            {monthBudgets.length > 0 && (
                <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                    {[
                        { label: t("budget.totalBudget") || "Total Anggaran", value: fmtRp(totalBudget), color: "var(--color-primary)" },
                        { label: t("budget.totalSpent")  || "Total Terpakai", value: fmtRp(totalSpent),  color: totalSpent > totalBudget ? "#ff716c" : "var(--color-text)" },
                        { label: t("budget.remaining")   || "Sisa",           value: fmtRp(Math.max(0, totalBudget - totalSpent)), color: totalSpent > totalBudget ? "#ff716c" : "var(--color-primary)" },
                    ].map(card => (
                        <div key={card.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 14, padding: "14px 16px" }}>
                            <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>{card.label.toUpperCase()}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: card.color }}>{card.value}</div>
                        </div>
                    ))}
                </div>

                {/* Overall progress */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{t("budget.totalUsage") || "Total Penggunaan"}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: statusColor(totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0) }}>
                            {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%
                        </span>
                    </div>
                    <div style={{ height: 8, background: "var(--color-border)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0}%`, background: statusColor(totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0), borderRadius: 99, transition: "width .5s" }} />
                    </div>
                </div>
                </>
            )}

            {/* Empty state — no budgets this month */}
            {monthBudgets.length === 0 && !canCopy && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: "60px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>
                        {t("budget.noData") || "Belum ada anggaran"} — {monthLabel(selectedMonth)}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-subtle)", marginBottom: 20 }}>{t("budget.noDataSub") || "Atur batas pengeluaran per kategori agar tidak boros"}</div>
                    <button onClick={openAdd} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("budget.addFirst") || "+ Tambah Anggaran Pertama"}
                    </button>
                </div>
            )}

            {/* Budget cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {monthBudgets.map(b => {
                    const spent     = spending[b.category] || 0;
                    const pct       = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
                    const color     = statusColor(pct);
                    const remaining = b.amount - spent;
                    return (
                        <div key={b.id} style={{ background: "var(--bg-surface)", border: `1px solid ${pct >= 100 ? "rgba(255,113,108,.3)" : pct >= 80 ? "rgba(245,158,11,.2)" : "var(--color-border-soft)"}`, borderRadius: 14, padding: "16px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: pct >= 100 ? "rgba(255,113,108,.12)" : pct >= 80 ? "rgba(245,158,11,.1)" : "rgba(96,252,198,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                                        {pct >= 100 ? "🚨" : pct >= 80 ? "⚠️" : "✅"}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{tCat(b.category)}</div>
                                        <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>{fmtRp(spent)} / {fmtRp(b.amount)}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color, minWidth: 40, textAlign: "right" }}>{pct}%</span>
                                    <button onClick={() => openEdit(b)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✏️</button>
                                    <button onClick={() => setConfirmDelete(b)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,113,108,.2)", background: "rgba(255,113,108,.06)", color: "#ff716c", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
                                </div>
                            </div>

                            <div style={{ height: 6, background: "var(--color-border)", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                                <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 99, transition: "width .5s" }} />
                            </div>

                            <div style={{ fontSize: 11, color: remaining < 0 ? "#ff716c" : "var(--color-subtle)" }}>
                                {remaining < 0 ? `⚠️ Melebihi anggaran ${fmtRp(Math.abs(remaining))}` : `Sisa ${fmtRp(remaining)}`}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Add/Edit Modal */}
        <Modal open={showModal} onClose={() => setShowModal(false)}>
            <div style={{ background: "var(--bg-surface-low)", borderRadius: "20px 20px 0 0", border: "1px solid var(--color-border)", borderBottom: "none", padding: "24px 20px 36px", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                        {editTarget ? "Edit Anggaran" : "Tambah Anggaran"}
                    </h3>
                    <button onClick={() => setShowModal(false)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>

                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block", letterSpacing: 0.5 }}>📅 BULAN</label>
                <select
                    value={form.month}
                    onChange={e => setForm(p => ({ ...p, month: e.target.value }))}
                    disabled={!!editTarget}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-surface-low)", color: "var(--color-text)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", opacity: editTarget ? .6 : 1 }}
                >
                    {months.map(mo => <option key={mo.val} value={mo.val}>{mo.label}</option>)}
                </select>

                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block", letterSpacing: 0.5 }}>KATEGORI</label>
                <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    disabled={!!editTarget}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--bg-surface-low)", color: "var(--color-text)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", opacity: editTarget ? .6 : 1 }}
                >
                    {(editTarget ? [editTarget.category] : availableCats).map(c => (
                        <option key={c} value={c}>{tCat(c)}</option>
                    ))}
                </select>

                <InputField label="BATAS ANGGARAN (Rp)" icon="💰" type="number" placeholder="500000" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />

                <button
                    onClick={handleSubmit}
                    disabled={!form.category || !form.amount}
                    style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: !form.category || !form.amount ? "rgba(255,255,255,.07)" : "linear-gradient(135deg,#60fcc6,#19ce9b)", color: !form.category || !form.amount ? "#94a3b8" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: !form.category || !form.amount ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: !form.category || !form.amount ? .5 : 1 }}
                >
                    {editTarget ? `✅ ${t("common.saveChanges") || "Simpan Perubahan"}` : t("budget.addNew") || "Tambah Anggaran"}
                </button>
            </div>
        </Modal>

        {/* Delete confirm Modal */}
        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
            <div style={{ background: "var(--bg-surface-low)", borderRadius: "20px 20px 0 0", border: "1px solid var(--color-border)", borderBottom: "none", padding: "24px 20px 36px" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", marginTop: 0 }}>Hapus Anggaran?</h3>
                <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
                    Anggaran <strong style={{ color: "var(--color-text)" }}>{tCat(confirmDelete?.category || "")}</strong> bulan <strong style={{ color: "var(--color-text)" }}>{monthLabel(selectedMonth)}</strong> akan dihapus.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-muted)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Batal</button>
                    <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "rgba(255,113,108,.15)", color: "#ff716c", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Ya, Hapus</button>
                </div>
            </div>
        </Modal>
        </>
    );
};

export default AnggaranView;
