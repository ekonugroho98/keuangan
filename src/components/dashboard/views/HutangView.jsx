import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

const EMOJI_OPTIONS = ["🏦","🏠","🚗","💳","📱","💻","🎓","💍","🏪","🛒","💰","🔧","🏋️","🎮","📚","⚡","🌍","✈️","🍕","☕"];
const COLOR_OPTIONS = ["#ff716c","#f97316","#f59e0b","var(--color-primary)","var(--color-primary)","#4FC3F7","var(--color-primary)","#ec4899","#14b8a6","var(--color-subtle)","#a855f7","#22c55e"];

const emptyForm = () => ({ name: "", icon: "🏦", color: "#ff716c", total: "", remaining: "", monthly: "", due_date: "" });

const HutangView = ({ debts, onAdd, onEdit, onDelete }) => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);

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

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{t("debt.title")}</h3>
                    <p style={{ fontSize: 12, color: "var(--color-subtle)", margin: "4px 0 0" }}>
                        {debts.length} {t("debt.active")} · {t("debt.totalSisa")} {fmtRp(totalSisa)}
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    style={{
                        padding: "9px 18px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg,#ff716c,#e04f4f)",
                        color: "var(--color-text)", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                    }}
                >
                    {t("debt.addNew")}
                </button>
            </div>

            {/* Summary cards */}
            {debts.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div style={{ background: "rgba(255,113,108,.08)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 12, padding: "14px 18px" }}>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>{t("debt.totalSisa")}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#ff716c" }}>{fmtRp(totalSisa)}</div>
                    </div>
                    <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 12, padding: "14px 18px" }}>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>{t("debt.totalCicilan")}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>{fmtRp(totalCicilan)}</div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {debts.length === 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>{t("debt.noData")}</div>
                    <div style={{ fontSize: 13, color: "#48474f", marginBottom: 20 }}>{t("debt.noDataSub")}</div>
                    <button onClick={openAdd} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("debt.addFirst")}
                    </button>
                </div>
            )}

            {/* Debts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {debts.map(d => {
                    const paid = d.total - d.remaining;
                    const pct = d.total > 0 ? Math.min(100, Math.round((paid / d.total) * 100)) : 0;
                    const lunas = d.remaining <= 0;
                    return (
                        <div key={d.id} style={{
                            background: "var(--bg-surface)",
                            border: `1px solid ${lunas ? "#60fcc633" : d.color + "22"}`,
                            borderRadius: 16, padding: 24, position: "relative",
                        }}>
                            {lunas && (
                                <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(96,252,198,.15)", border: "1px solid rgba(96,252,198,.3)", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "var(--color-primary)" }}>
                                    {t("debt.paid_badge")}
                                </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: d.color + "18", border: `1px solid ${d.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{d.icon}</div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>{d.name}</div>
                                    {d.monthly > 0 && <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>{t("debt.monthly")}: {fmtRp(d.monthly)}/bln</div>}
                                    {d.due_date ? <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{t("debt.dueDate")}: {d.due_date}</div> : null}
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{t("debt.paid")} {pct}%</span>
                                <span style={{ fontSize: 12, color: d.color, fontWeight: 600 }}>{fmtRp(paid)} / {fmtRp(d.total)}</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: "var(--color-border-soft)", marginBottom: 12 }}>
                                <div style={{ height: "100%", borderRadius: 4, background: lunas ? "var(--color-primary)" : d.color, width: `${pct}%`, transition: "width 1s" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 14 }}>
                                <span style={{ color: "var(--color-subtle)" }}>{t("debt.total")}: {fmtRp(d.total)}</span>
                                <span style={{ color: lunas ? "var(--color-primary)" : "#ff716c", fontWeight: 700 }}>{t("debt.remaining")}: {fmtRp(d.remaining)}</span>
                            </div>
                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => openEdit(d)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--color-border)", background: "rgba(96,252,198,.08)", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️ {t("common.edit")}</button>
                                <button onClick={() => setConfirmDelete(d)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,113,108,.15)", background: "rgba(255,113,108,.06)", color: "#ff716c", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
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
                        <input type="number" value={form.total} onChange={e => setForm(p => ({ ...p, total: e.target.value }))} placeholder="50000000"
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("debt.remainingLabel")}</label>
                        <input type="number" value={form.remaining} onChange={e => setForm(p => ({ ...p, remaining: e.target.value }))} placeholder="35000000"
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("debt.monthlyLabel")}</label>
                        <input type="number" value={form.monthly} onChange={e => setForm(p => ({ ...p, monthly: e.target.value }))} placeholder="1500000"
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

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
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "var(--color-border-soft)" : "var(--color-expense)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("common.saveChanges") : t("debt.submitAdd")}
                        </button>
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
