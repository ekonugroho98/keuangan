import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

const EMOJI_OPTIONS = ["🏠","🚗","✈️","📱","💻","🎓","💍","🏖️","💰","🏋️","🎮","📚","🌟","🏦","🎁","🚀","🛍️","🍕","☕","🌿","❤️","🔧","🏪","🎵","🐾","⚡","🎬","💊","🌍","🏆"];
const COLOR_OPTIONS = ["#60fcc6","#19ce9b","#4FC3F7","#60fcc6","#f59e0b","#ff716c","#ec4899","#14b8a6","#f97316","#76747e","#a855f7","#22c55e"];

const emptyForm = () => ({ name: "", icon: "🏠", color: "#60fcc6", target: "", current: "" });

const GoalsView = ({ goals, onAdd, onEdit, onDelete }) => {
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

    const openEdit = (g) => {
        setEditTarget(g);
        setForm({ name: g.name, icon: g.icon, color: g.color, target: g.target, current: g.current });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !form.target) return;
        const payload = {
            name: form.name.trim(),
            icon: form.icon,
            color: form.color,
            target: parseInt(form.target),
            current: parseInt(form.current || 0),
        };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    const canSubmit = form.name.trim() && form.target;

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{t("goals.title")}</h3>
                    <p style={{ fontSize: 12, color: "#76747e", margin: "4px 0 0" }}>
                        {goals.length} · {goals.filter(g => g.current >= g.target).length} {t("goals.achieved")}
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    style={{
                        padding: "9px 18px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg,#60fcc6,#19ce9b)",
                        color: "#fff", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                    }}
                >
                    {t("goals.addNew")}
                </button>
            </div>

            {/* Empty state */}
            {goals.length === 0 && (
                <div style={{ background: "rgba(25,25,33,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#acaab4", marginBottom: 6 }}>{t("goals.noData")}</div>
                    <div style={{ fontSize: 13, color: "#48474f", marginBottom: 20 }}>{t("goals.noDataSub")}</div>
                    <button onClick={openAdd} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("goals.addFirst")}
                    </button>
                </div>
            )}

            {/* Goals grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {goals.map(g => {
                    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                    const done = g.current >= g.target;
                    return (
                        <div key={g.id} style={{
                            background: "rgba(25,25,33,.6)",
                            border: `1px solid ${done ? g.color + "44" : "rgba(255,255,255,.06)"}`,
                            borderRadius: 16, padding: 24, position: "relative",
                        }}>
                            {done && (
                                <div style={{ position: "absolute", top: 12, right: 12, background: g.color + "20", border: `1px solid ${g.color}44`, borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: g.color }}>
                                    {t("goals.achieved_badge")}
                                </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: g.color + "18", border: `1px solid ${g.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{g.icon}</div>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{g.name}</div>
                                        <div style={{ fontSize: 11, color: "#76747e" }}>{t("goals.target")}: {fmtRp(g.target)}</div>
                                    </div>
                                </div>
                                {!done && <div style={{ fontSize: 22, fontWeight: 800, color: g.color }}>{pct}%</div>}
                            </div>
                            <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,.04)", marginBottom: 12 }}>
                                <div style={{ height: "100%", borderRadius: 5, background: `linear-gradient(135deg,${g.color},${g.color}88)`, width: `${pct}%`, transition: "width 1s" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 14 }}>
                                <span style={{ color: "#acaab4" }}>{t("goals.collected")}: <span style={{ color: "#fff", fontWeight: 600 }}>{fmtRp(g.current)}</span></span>
                                {!done && <span style={{ color: g.color, fontWeight: 600 }}>{t("goals.remaining")}: {fmtRp(g.target - g.current)}</span>}
                            </div>
                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => openEdit(g)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid rgba(96,252,198,.2)", background: "rgba(96,252,198,.08)", color: "#60fcc6", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
                                <button onClick={() => setConfirmDelete(g)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,113,108,.15)", background: "rgba(255,113,108,.06)", color: "#ff716c", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Tambah/Edit */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: 0 }}>{editTarget ? t("goals.editTitle") : t("goals.addTitle")}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#acaab4", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{form.name || "Nama Target"}</div>
                                <div style={{ fontSize: 11, color: "#76747e" }}>Target: {form.target ? fmtRp(parseInt(form.target)) : "Rp 0"}</div>
                            </div>
                        </div>

                        {/* Nama */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#acaab4", display: "block", marginBottom: 6 }}>{t("goals.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Beli Rumah, Dana Darurat..." maxLength={40}
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        {/* Jumlah target */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#acaab4", display: "block", marginBottom: 6 }}>{t("goals.targetLabel")}</label>
                        <input type="number" value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} placeholder="5000000"
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        {/* Dana terkumpul */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#acaab4", display: "block", marginBottom: 6 }}>{t("goals.currentLabel")}</label>
                        <input type="number" value={form.current} onChange={e => setForm(p => ({ ...p, current: e.target.value }))} placeholder="0"
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        {/* Icon */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#acaab4", display: "block", marginBottom: 8 }}>ICON</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#60fcc655" : "rgba(255,255,255,.06)"}`, background: form.icon === e ? "rgba(96,252,198,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        {/* Warna */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#acaab4", display: "block", marginBottom: 8 }}>WARNA</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "rgba(255,255,255,.05)" : "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("common.saveChanges") : t("goals.submitAdd")}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(255,113,108,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("goals.deleteConfirm")}</h3>
                        <p style={{ color: "#76747e", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#ff716c" }}>{confirmDelete.name}</strong> — {t("goals.deleteMsg")}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "transparent", color: "#acaab4", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoalsView;
