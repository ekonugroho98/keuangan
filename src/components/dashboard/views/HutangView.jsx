import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";
import AmountInput from "../../ui/AmountInput";

const EMOJI_OPTIONS = ["🏦","🏠","🚗","💳","📱","💻","🎓","💍","🏪","🛒","💰","🔧","🏋️","🎮","📚","⚡","🌍","✈️","🍕","☕"];
const COLOR_OPTIONS = ["#ff716c","#f97316","#f59e0b","var(--color-primary)","var(--color-primary)","#4FC3F7","var(--color-primary)","#ec4899","#14b8a6","var(--color-subtle)","#a855f7","#22c55e"];

const emptyForm = () => ({ name: "", icon: "🏦", color: "#ff716c", total: "", remaining: "", monthly: "", due_date: "" });

const HutangView = ({ debts, onAdd, onEdit, onDelete, onPayDebt, accounts = [] }) => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [payTarget, setPayTarget] = useState(null);
    const [payAmount, setPayAmount] = useState("");
    const [payAccount, setPayAccount] = useState("");

    const openAdd = () => {
        setEditTarget(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEdit = (d) => {
        setEditTarget(d);
        setForm({ name: d.name, icon: d.icon, color: d.color, total: d.total, remaining: d.remaining, monthly: d.monthly, due_date: d.due_date || "" });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !form.total || !form.remaining) return;
        const payload = {
            name: form.name.trim(),
            icon: form.icon,
            color: form.color,
            total: parseInt(form.total),
            remaining: parseInt(form.remaining),
            monthly: parseInt(form.monthly || 0),
            due_date: form.due_date || "",
        };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    const canSubmit = form.name.trim() && form.total && form.remaining;

    const totalSisa = debts.reduce((a, d) => a + d.remaining, 0);
    const totalCicilan = debts.reduce((a, d) => a + (d.monthly || 0), 0);

    // Due date helpers
    const today = new Date().toISOString().slice(0, 10);

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>KEWAJIBAN</div>
                    <h2 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>{t("debt.title")}</h2>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        {debts.length} {t("debt.active")} · {t("debt.totalSisa")} <span className="num-tight mono">{fmtRp(totalSisa)}</span>
                    </p>
                </div>
                <button onClick={openAdd} className="btn-primary" style={{ padding: "10px 18px", fontSize: 13, minHeight: 42 }}>
                    {t("debt.addNew")}
                </button>
            </div>

            {/* Summary cards */}
            {debts.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, marginBottom: 20 }}>
                    <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "22px 24px", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)", position: "relative", overflow: "hidden" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 8 }}>{t("debt.totalSisa")}</div>
                        <div className="num-tight mono" style={{ fontSize: "clamp(22px, 2.8vw, 30px)", fontWeight: 900, color: "var(--color-expense, #ff716c)", letterSpacing: "-.03em", lineHeight: 1 }}>{fmtRp(totalSisa)}</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>Sisa pokok seluruh hutang</div>
                    </div>
                    <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "22px 24px", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)", position: "relative", overflow: "hidden" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 8 }}>{t("debt.totalCicilan")}</div>
                        <div className="num-tight mono" style={{ fontSize: "clamp(22px, 2.8vw, 30px)", fontWeight: 900, color: "var(--color-amber, #f59e0b)", letterSpacing: "-.03em", lineHeight: 1 }}>{fmtRp(totalCicilan)}</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>Beban cicilan per bulan</div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {debts.length === 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: .4 }}>🎉</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>{t("debt.noData")}</div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 16 }}>{t("debt.noDataSub")}</div>
                    <button onClick={openAdd} className="btn-primary" style={{ padding: "10px 24px", fontSize: 13 }}>
                        + {t("debt.addFirst")}
                    </button>
                </div>
            )}

            {/* Debts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
                {debts.map(d => {
                    const paid = d.total - d.remaining;
                    const pct = d.total > 0 ? Math.min(100, Math.round((paid / d.total) * 100)) : 0;
                    const lunas = d.remaining <= 0;

                    // Due status
                    const overdue = !lunas && d.due_date && d.due_date < today;
                    const dueSoon = !lunas && !overdue && d.due_date && (new Date(d.due_date) - new Date(today)) / 86400000 <= 7;

                    return (
                        <div key={d.id} style={{
                            background: "var(--glass-1)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: `1px solid ${lunas ? "rgba(96,252,198,.4)" : overdue ? "rgba(255,113,108,.35)" : "var(--glass-border)"}`,
                            borderRadius: 20, padding: 22, position: "relative", overflow: "hidden",
                            boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                        }}>
                            {lunas && (
                                <span className="chip chip-mint" style={{ position: "absolute", top: 14, right: 14 }}>
                                    {t("debt.paid_badge")}
                                </span>
                            )}
                            {!lunas && overdue && (
                                <span className="chip chip-red" style={{ position: "absolute", top: 14, right: 14 }}>
                                    Jatuh tempo
                                </span>
                            )}
                            {!lunas && !overdue && dueSoon && (
                                <span className="chip chip-amber" style={{ position: "absolute", top: 14, right: 14 }}>
                                    Segera bayar
                                </span>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingRight: lunas || overdue || dueSoon ? 80 : 0 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 14, background: d.color + "18", border: `1px solid ${d.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{d.icon}</div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                                    {d.monthly > 0 && (
                                        <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                                            <span className="chip chip-amber">{fmtRp(d.monthly)} / bln</span>
                                            {d.due_date && <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>· {t("debt.dueDate")}: {d.due_date}</span>}
                                        </div>
                                    )}
                                    {(!d.monthly || d.monthly <= 0) && d.due_date && (
                                        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{t("debt.dueDate")}: {d.due_date}</div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{t("debt.paid")} <span className="num-tight">{pct}%</span></span>
                                <span className="num-tight mono" style={{ fontSize: 12, color: d.color, fontWeight: 600 }}>{fmtRp(paid)} / {fmtRp(d.total)}</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: "var(--bg-sunk, var(--color-border-soft))", marginBottom: 12, overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 4, background: lunas ? "var(--color-primary)" : d.color, width: `${pct}%`, transition: "width 1s", boxShadow: `0 0 10px ${lunas ? "var(--color-primary)" : d.color}55` }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
                                <span style={{ color: "var(--color-subtle)" }}>{t("debt.total")}: <span className="num-tight mono">{fmtRp(d.total)}</span></span>
                                <span className="num-tight mono" style={{ color: lunas ? "var(--color-primary)" : "var(--color-expense, #ff716c)", fontWeight: 700 }}>{t("debt.remaining")}: {fmtRp(d.remaining)}</span>
                            </div>
                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {!lunas && (
                                    <button
                                        onClick={() => { setPayTarget(d); setPayAmount(d.monthly > 0 ? String(d.monthly) : ""); setPayAccount(accounts[0]?.name || ""); }}
                                        className="btn-primary"
                                        style={{ flex: 1, minHeight: 42, fontSize: 12, padding: "8px 10px" }}
                                    >Bayar</button>
                                )}
                                <button onClick={() => openEdit(d)} className="btn-ghost" style={{ flex: 1, minHeight: 42, fontSize: 12, padding: "8px 10px" }}>{t("common.edit")}</button>
                                <button onClick={() => setConfirmDelete(d)} aria-label="Delete debt" style={{ minHeight: 42, minWidth: 42, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,113,108,.18)", background: "rgba(255,113,108,.06)", color: "var(--color-expense, #ff716c)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Tambah/Edit */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 17, margin: 0 }}>{editTarget ? t("debt.editTitle") : t("debt.addTitle")}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{form.name || t("debt.nameLabel")}</div>
                                <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>{t("debt.remaining")}: {form.remaining ? fmtRp(parseInt(form.remaining)) : "Rp 0"}</div>
                            </div>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("debt.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t("debt.namePlaceholder")} maxLength={40}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("debt.totalLabel")}</label>
                        <AmountInput value={form.total} onChange={v => setForm(p => ({ ...p, total: v }))} placeholder="50.000.000" inputStyle={{ marginBottom: 16 }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("debt.remainingLabel")}</label>
                        <AmountInput value={form.remaining} onChange={v => setForm(p => ({ ...p, remaining: v }))} placeholder="35.000.000" inputStyle={{ marginBottom: 16 }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("debt.monthlyLabel")}</label>
                        <AmountInput value={form.monthly} onChange={v => setForm(p => ({ ...p, monthly: v }))} placeholder="1.500.000" inputStyle={{ marginBottom: 16 }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("debt.dueDateLabel")}</label>
                        <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", colorScheme: "normal" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("inv.iconLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#ff716c55" : "var(--color-border-soft)"}`, background: form.icon === e ? "rgba(255,113,108,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("inv.colorLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "var(--color-border-soft)" : "var(--color-expense)", color: !canSubmit ? "var(--color-muted)" : "#fff", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("common.saveChanges") : t("debt.submitAdd")}
                        </button>
                    </div>
                </div>
            )}

            {/* Bayar Cicilan Modal */}
            {payTarget && (
                <div onClick={() => setPayTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div>
                                <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: 0 }}>💳 Bayar Cicilan</h3>
                                <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "4px 0 0" }}>{payTarget.name}</p>
                            </div>
                            <button onClick={() => setPayTarget(null)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>
                        <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--color-muted)" }}>
                            Sisa hutang: <strong style={{ color: "#fbbf24" }}>{fmtRp(payTarget.remaining)}</strong>
                        </div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>JUMLAH BAYAR (Rp)</label>
                        <AmountInput value={payAmount} onChange={v => setPayAmount(v)} placeholder={String(payTarget.monthly || payTarget.remaining)} inputStyle={{ background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", fontSize: 14, fontWeight: 700, marginBottom: 16 }} />
                        {accounts.length > 0 && (
                            <>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>DARI AKUN</label>
                            <select value={payAccount} onChange={e => setPayAccount(e.target.value)}
                                style={{ width: "100%", padding: "10px 14px", background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 20, boxSizing: "border-box" }}>
                                {accounts.map(a => <option key={a.id} value={a.name}>{a.icon} {a.name} — {fmtRp(a.balance)}</option>)}
                            </select>
                            </>
                        )}
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setPayTarget(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Batal</button>
                            <button
                                disabled={!payAmount || parseInt(payAmount) <= 0}
                                onClick={() => {
                                    if (!payAmount || parseInt(payAmount) <= 0) return;
                                    onPayDebt && onPayDebt(payTarget, parseInt(payAmount), payAccount);
                                    setPayTarget(null);
                                    setPayAmount("");
                                }}
                                style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: !payAmount ? "var(--color-border-soft)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: !payAmount ? "var(--color-muted)" : "#fff", fontSize: 13, fontWeight: 700, cursor: !payAmount ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                            >✅ Bayar Sekarang</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("debt.deleteConfirm")}</h3>
                        <p style={{ color: "var(--color-subtle)", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#ff716c" }}>{confirmDelete.name}</strong> — {t("debt.deleteMsg")}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "var(--color-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HutangView;
