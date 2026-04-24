import { useState, useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { expenseCategories } from "../../../constants/categories";
import Modal from "../../ui/Modal";
import InputField from "../../ui/InputField";
import AmountInput from "../../ui/AmountInput";

const statusColor = (pct) => {
    if (pct >= 100) return "var(--color-expense)";
    if (pct >= 80)  return "var(--color-amber)";
    return "var(--color-primary)";
};

const statusChipClass = (pct) => {
    if (pct >= 100) return "chip chip-red";
    if (pct >= 80)  return "chip chip-amber";
    return "chip chip-mint";
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
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>BUDGET</div>
                    <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>
                        {t("budget.title") || "Anggaran"}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        {t("budget.subtitle") || "Atur batas pengeluaran agar tidak melebihi rencana."}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={overCount > 0 ? "chip chip-red" : "chip chip-mint"}>
                        {monthBudgets.length} {t("budget.categories") || "kategori"} · {overCount > 0 ? `${overCount} ${t("budget.overLimit") || "melebihi batas"}` : t("budget.allSafe") || "Semua dalam batas"}
                    </span>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        aria-label="Pilih bulan"
                        style={{
                            padding: "9px 14px", borderRadius: 12, minHeight: 42,
                            border: "1px solid var(--glass-border)",
                            background: "var(--glass-1)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            color: "var(--color-text)", fontSize: 12, fontFamily: "inherit", outline: "none", cursor: "pointer",
                        }}
                    >
                        {months.map(mo => <option key={mo.val} value={mo.val}>{mo.label}</option>)}
                    </select>
                    <button
                        onClick={openAdd}
                        disabled={availableCats.length === 0}
                        className="btn-primary"
                        style={{ minHeight: 42, opacity: availableCats.length === 0 ? 0.5 : 1, cursor: availableCats.length === 0 ? "not-allowed" : "pointer" }}
                    >
                        + Anggaran
                    </button>
                </div>
            </div>

            {/* Copy from prev month banner */}
            {canCopy && (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "var(--color-primary-soft)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 14, padding: "12px 16px", marginBottom: 20, gap: 12, flexWrap: "wrap",
                    boxShadow: "var(--glass-highlight)",
                }}>
                    <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
                        📋 Belum ada anggaran di <strong style={{ color: "var(--color-text)" }}>{monthLabel(selectedMonth)}</strong>.
                        Salin dari <strong style={{ color: "var(--color-primary)" }}>{monthLabel(prev)}</strong>?
                    </div>
                    <button
                        onClick={() => onCopyMonth(prevBudgets, selectedMonth)}
                        className="btn-secondary"
                        style={{ minHeight: 42, whiteSpace: "nowrap" }}
                    >
                        Salin Anggaran
                    </button>
                </div>
            )}

            {/* Summary cards */}
            {monthBudgets.length > 0 && (
                <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12, marginBottom: 16 }}>
                    {[
                        { label: t("budget.totalBudget") || "Total Anggaran", value: fmtRp(totalBudget), color: "var(--color-primary)" },
                        { label: t("budget.totalSpent")  || "Total Terpakai", value: fmtRp(totalSpent),  color: totalSpent > totalBudget ? "var(--color-expense)" : "var(--color-text)" },
                        { label: t("budget.remaining")   || "Sisa",           value: fmtRp(Math.max(0, totalBudget - totalSpent)), color: totalSpent > totalBudget ? "var(--color-expense)" : "var(--color-primary)" },
                    ].map(card => (
                        <div key={card.label} style={{
                            background: "var(--glass-1)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: 20, padding: "22px 24px",
                            boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                            position: "relative", overflow: "hidden",
                        }}>
                            <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 800, letterSpacing: 1.6, marginBottom: 6, textTransform: "uppercase" }}>{card.label}</div>
                            <div className="num-tight mono" style={{ fontSize: "clamp(16px, 2.4vw, 20px)", fontWeight: 900, color: card.color, letterSpacing: "-.02em", lineHeight: 1.1 }}>{card.value}</div>
                        </div>
                    ))}
                </div>

                {/* Overall progress */}
                <div style={{
                    background: "var(--glass-1)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 20, padding: "22px 24px", marginBottom: 20,
                    boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{t("budget.totalUsage") || "Total Penggunaan"}</span>
                        <span className="num-tight" style={{ fontSize: 14, fontWeight: 800, color: statusColor(totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0) }}>
                            {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%
                        </span>
                    </div>
                    <div style={{ height: 10, background: "var(--color-border-soft)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0}%`, background: statusColor(totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0), borderRadius: 99, transition: "width .5s" }} />
                    </div>
                </div>
                </>
            )}

            {/* Empty state — no budgets this month */}
            {monthBudgets.length === 0 && !canCopy && (
                <div style={{
                    background: "var(--glass-1)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 20, padding: "60px 24px", textAlign: "center",
                    boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>💰</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 6, letterSpacing: "-.01em" }}>
                        {t("budget.noData") || "Belum ada anggaran"} — {monthLabel(selectedMonth)}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20 }}>{t("budget.noDataSub") || "Atur batas pengeluaran per kategori agar tidak boros"}</div>
                    <button onClick={openAdd} className="btn-primary" style={{ minHeight: 44 }}>
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
                        <div key={b.id} style={{
                            background: "var(--glass-1)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: `1px solid ${pct >= 100 ? "var(--color-expense-soft)" : pct >= 80 ? "var(--color-amber-soft)" : "var(--glass-border)"}`,
                            borderRadius: 20, padding: "22px 24px",
                            boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                            position: "relative", overflow: "hidden",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                        background: pct >= 100 ? "var(--color-expense-soft)" : pct >= 80 ? "var(--color-amber-soft)" : "var(--color-primary-soft)",
                                        border: "1px solid var(--glass-border)",
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                                    }}>
                                        {pct >= 100 ? "🚨" : pct >= 80 ? "⚠️" : "✅"}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-.01em" }}>{tCat(b.category)}</div>
                                        <div className="num-tight mono" style={{ fontSize: 11, color: "var(--color-subtle)" }}>{fmtRp(spent)} / {fmtRp(b.amount)}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span className={statusChipClass(pct)} style={{ fontWeight: 800 }}>{pct}%</span>
                                    <button onClick={() => openEdit(b)} aria-label={`Edit ${tCat(b.category)}`}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--glass-border)", background: "var(--glass-2)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", color: "var(--color-muted)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✏️</button>
                                    <button onClick={() => setConfirmDelete(b)} aria-label={`Hapus ${tCat(b.category)}`}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--color-expense-soft)", background: "var(--color-expense-soft)", color: "var(--color-expense)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
                                </div>
                            </div>

                            <div style={{ height: 8, background: "var(--color-border-soft)", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                                <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 99, transition: "width .5s" }} />
                            </div>

                            <div className="num-tight" style={{ fontSize: 11, color: remaining < 0 ? "var(--color-expense)" : "var(--color-subtle)" }}>
                                {remaining < 0 ? `⚠️ Melebihi anggaran ${fmtRp(Math.abs(remaining))}` : `Sisa ${fmtRp(remaining)}`}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Add/Edit Modal */}
        <Modal open={showModal} onClose={() => setShowModal(false)}>
            <div style={{
                background: "var(--glass-hero)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                borderRadius: "24px 24px 0 0",
                border: "1px solid var(--glass-border)", borderBottom: "none",
                padding: "24px 20px 36px", maxHeight: "90vh", overflowY: "auto",
                boxShadow: "var(--glass-highlight), 0 -4px 20px rgba(0,0,0,.12)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, gap: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: 0, letterSpacing: "-.015em" }}>
                        {editTarget ? "Edit Anggaran" : "Tambah Anggaran"}
                    </h3>
                    <button onClick={() => setShowModal(false)} aria-label="Tutup"
                        style={{ background: "var(--glass-2)", border: "1px solid var(--glass-border)", color: "var(--color-muted)", width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>

                <label style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", marginBottom: 6, display: "block", letterSpacing: 1.4, textTransform: "uppercase" }}>📅 Bulan</label>
                <select
                    value={form.month}
                    onChange={e => setForm(p => ({ ...p, month: e.target.value }))}
                    disabled={!!editTarget}
                    style={{ width: "100%", padding: "12px 14px", minHeight: 44, borderRadius: 12, border: "1px solid var(--glass-border)", background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", color: "var(--color-text)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", opacity: editTarget ? .6 : 1 }}
                >
                    {months.map(mo => <option key={mo.val} value={mo.val}>{mo.label}</option>)}
                </select>

                <label style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", marginBottom: 6, display: "block", letterSpacing: 1.4, textTransform: "uppercase" }}>Kategori</label>
                <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    disabled={!!editTarget}
                    style={{ width: "100%", padding: "12px 14px", minHeight: 44, borderRadius: 12, border: "1px solid var(--glass-border)", background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", color: "var(--color-text)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", opacity: editTarget ? .6 : 1 }}
                >
                    {(editTarget ? [editTarget.category] : availableCats).map(c => (
                        <option key={c} value={c}>{tCat(c)}</option>
                    ))}
                </select>

                <AmountInput label="BATAS ANGGARAN (Rp)" icon="💰" placeholder="500.000" value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))} />

                <button
                    onClick={handleSubmit}
                    disabled={!form.category || !form.amount}
                    className="btn-primary"
                    style={{ width: "100%", minHeight: 46, opacity: !form.category || !form.amount ? .5 : 1, cursor: !form.category || !form.amount ? "not-allowed" : "pointer" }}
                >
                    {editTarget ? `✅ ${t("common.saveChanges") || "Simpan Perubahan"}` : t("budget.addNew") || "Tambah Anggaran"}
                </button>
            </div>
        </Modal>

        {/* Delete confirm Modal */}
        <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
            <div style={{
                background: "var(--glass-hero)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                borderRadius: "24px 24px 0 0",
                border: "1px solid var(--glass-border)", borderBottom: "none",
                padding: "24px 20px 36px",
                boxShadow: "var(--glass-highlight), 0 -4px 20px rgba(0,0,0,.12)",
            }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", marginTop: 0, letterSpacing: "-.015em" }}>Hapus Anggaran?</h3>
                <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
                    Anggaran <strong style={{ color: "var(--color-text)" }}>{tCat(confirmDelete?.category || "")}</strong> bulan <strong style={{ color: "var(--color-text)" }}>{monthLabel(selectedMonth)}</strong> akan dihapus.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => setConfirmDelete(null)} className="btn-ghost" style={{ flex: 1, minHeight: 46, minWidth: 120 }}>Batal</button>
                    <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
                        style={{ flex: 1, minHeight: 46, minWidth: 120, padding: 12, borderRadius: 12, border: "1px solid var(--color-expense-soft)", background: "var(--color-expense-soft)", color: "var(--color-expense)", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Ya, Hapus</button>
                </div>
            </div>
        </Modal>
        </>
    );
};

export default AnggaranView;
