import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

const TYPE_KEYS = ["reksa_dana","saham","emas","crypto","deposito","properti","obligasi","lainnya"];
const TYPE_ICONS  = { reksa_dana:"📊", saham:"📈", emas:"🥇", crypto:"₿", deposito:"🏦", properti:"🏠", obligasi:"📜", lainnya:"💼" };
const TYPE_COLORS = { reksa_dana:"#6366f1", saham:"#10b981", emas:"#f59e0b", crypto:"#f97316", deposito:"#06b6d4", properti:"#8b5cf6", obligasi:"#ec4899", lainnya:"#64748b" };

const EMOJI_OPTIONS = ["📊","📈","🥇","₿","🏦","🏠","📜","💼","💎","🚀","⚡","🌿","🎯","💰","🔮","🏆","📱","🖥️","🚗","✈️"];
const COLOR_OPTIONS = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#f97316","#14b8a6","#64748b","#a855f7","#22c55e"];

const emptyForm = () => ({
    name: "", type: "reksa_dana", icon: "📊", color: "#6366f1",
    buy_price: "", current_value: "", quantity: "", unit: "unit",
    buy_date: "", notes: "",
});

const InvestasiView = ({ investments = [], onAdd, onEdit, onDelete }) => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);

    const TYPES = TYPE_KEYS.map(v => ({
        v, l: t(`inv.type.${v}`), icon: TYPE_ICONS[v], color: TYPE_COLORS[v],
    }));

    const openAdd = () => {
        setEditTarget(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEdit = (inv) => {
        setEditTarget(inv);
        setForm({
            name: inv.name, type: inv.type, icon: inv.icon, color: inv.color,
            buy_price: String(inv.buy_price), current_value: String(inv.current_value),
            quantity: inv.quantity ? String(inv.quantity) : "",
            unit: inv.unit || "unit",
            buy_date: inv.buy_date || "", notes: inv.notes || "",
        });
        setShowModal(true);
    };

    const handleTypeChange = (type) => {
        setForm(p => ({ ...p, type, icon: TYPE_ICONS[type] || "📊", color: TYPE_COLORS[type] || "#6366f1" }));
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !form.buy_price || !form.current_value) return;
        const payload = {
            name: form.name.trim(), type: form.type, icon: form.icon, color: form.color,
            buy_price: parseInt(form.buy_price),
            current_value: parseInt(form.current_value),
            quantity: form.quantity ? parseFloat(form.quantity) : null,
            unit: form.unit || "unit",
            buy_date: form.buy_date || null,
            notes: form.notes.trim(),
        };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    const canSubmit = form.name.trim() && form.buy_price && form.current_value;

    const totalModal   = investments.reduce((a, i) => a + i.buy_price, 0);
    const totalNilai   = investments.reduce((a, i) => a + i.current_value, 0);
    const totalGain    = totalNilai - totalModal;
    const totalReturnPct = totalModal > 0 ? ((totalGain / totalModal) * 100).toFixed(2) : 0;

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{t("inv.title")}</h3>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
                        {investments.length} {t("inv.assets")} · {t("inv.portfolio")} {fmtRp(totalNilai)}
                    </p>
                </div>
                <button onClick={openAdd} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t("inv.addNew")}
                </button>
            </div>

            {/* Summary cards */}
            {investments.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
                    {[
                        { l: t("inv.totalModal"),    v: fmtRp(totalModal),  c: "#94a3b8", bg: "rgba(148,163,184,.08)", border: "rgba(148,163,184,.15)" },
                        { l: t("inv.currentValue"),  v: fmtRp(totalNilai),  c: "#818cf8", bg: "rgba(99,102,241,.08)",  border: "rgba(99,102,241,.2)" },
                        { l: t("inv.gainLoss"),      v: (totalGain >= 0 ? "+" : "") + fmtRp(totalGain), c: totalGain >= 0 ? "#10b981" : "#ef4444", bg: totalGain >= 0 ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)", border: totalGain >= 0 ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)" },
                        { l: t("inv.return"),        v: `${totalGain >= 0 ? "+" : ""}${totalReturnPct}%`, c: totalGain >= 0 ? "#10b981" : "#ef4444", bg: totalGain >= 0 ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)", border: totalGain >= 0 ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)" },
                    ].map((s, i) => (
                        <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 18px" }}>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{s.l}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {investments.length === 0 && (
                <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>{t("inv.noData")}</div>
                    <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>{t("inv.noDataSub")}</div>
                    <button onClick={openAdd} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("inv.addFirst")}
                    </button>
                </div>
            )}

            {/* Investment cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {investments.map(inv => {
                    const gain = inv.current_value - inv.buy_price;
                    const returnPct = inv.buy_price > 0 ? ((gain / inv.buy_price) * 100).toFixed(2) : 0;
                    const isProfit = gain >= 0;
                    const typeInfo = TYPES.find(tp => tp.v === inv.type) || TYPES[7];
                    return (
                        <div key={inv.id} style={{ background: "rgba(15,15,30,.6)", border: `1px solid ${inv.color}22`, borderRadius: 16, padding: 22, position: "relative" }}>
                            <div style={{ position: "absolute", top: 14, right: 14, fontSize: 9, fontWeight: 700, color: typeInfo.color, background: typeInfo.color + "15", border: `1px solid ${typeInfo.color}30`, borderRadius: 6, padding: "2px 8px" }}>
                                {typeInfo.l.toUpperCase()}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: inv.color + "18", border: `1px solid ${inv.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                                    {inv.icon}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.name}</div>
                                    <div style={{ fontSize: 11, color: "#64748b" }}>
                                        {inv.quantity ? `${inv.quantity} ${inv.unit}` : ""}
                                        {inv.buy_date ? ` · ${t("inv.buy")} ${new Date(inv.buy_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                                <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 10, padding: "10px 12px" }}>
                                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{t("inv.modal").toUpperCase()}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>{fmtRp(inv.buy_price)}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 10, padding: "10px 12px" }}>
                                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{t("inv.currentValueLabel").toUpperCase()}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{fmtRp(inv.current_value)}</div>
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: isProfit ? "rgba(16,185,129,.06)" : "rgba(239,68,68,.06)", border: `1px solid ${isProfit ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)"}`, borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
                                <div style={{ fontSize: 12, color: "#64748b" }}>{t("inv.gainLoss")}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: isProfit ? "#10b981" : "#ef4444" }}>
                                        {isProfit ? "+" : ""}{fmtRp(gain)}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: isProfit ? "#10b981" : "#ef4444", background: isProfit ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)", padding: "2px 7px", borderRadius: 6 }}>
                                        {isProfit ? "▲" : "▼"} {Math.abs(returnPct)}%
                                    </span>
                                </div>
                            </div>

                            {inv.notes && (
                                <div style={{ fontSize: 11, color: "#475569", marginBottom: 14, fontStyle: "italic" }}>📝 {inv.notes}</div>
                            )}

                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => openEdit(inv)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid rgba(99,102,241,.2)", background: "rgba(99,102,241,.08)", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("inv.editBtn")}</button>
                                <button onClick={() => setConfirmDelete(inv)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,.15)", background: "rgba(239,68,68,.06)", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Tambah/Edit */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: 0 }}>{editTarget ? t("inv.submitEdit") : t("inv.addNew")}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{form.name || t("inv.previewDefault")}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>
                                    {form.current_value && form.buy_price ? (() => {
                                        const g = parseInt(form.current_value) - parseInt(form.buy_price);
                                        const p = parseInt(form.buy_price) > 0 ? ((g / parseInt(form.buy_price)) * 100).toFixed(1) : 0;
                                        return <span style={{ color: g >= 0 ? "#10b981" : "#ef4444" }}>{g >= 0 ? "+" : ""}{fmtRp(g)} ({p}%)</span>;
                                    })() : t("inv.previewModalDefault")}
                                </div>
                            </div>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("inv.typeLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {TYPES.map(tp => (
                                <button key={tp.v} onClick={() => handleTypeChange(tp.v)}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${form.type === tp.v ? tp.color + "55" : "rgba(255,255,255,.06)"}`, background: form.type === tp.v ? tp.color + "15" : "transparent", color: form.type === tp.v ? tp.color : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                    {tp.icon} {tp.l}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("inv.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t("inv.namePlaceholder")} maxLength={50}
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("inv.modalLabel")}</label>
                                <input type="number" value={form.buy_price} onChange={e => setForm(p => ({ ...p, buy_price: e.target.value }))} placeholder="5000000"
                                    style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("inv.currentValueInput")}</label>
                                <input type="number" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} placeholder="5500000"
                                    style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("inv.qtyLabel")}</label>
                                <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="10"
                                    style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("inv.unitLabel")}</label>
                                <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="unit / lot / gram"
                                    style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                            </div>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("inv.buyDateLabel")}</label>
                        <input type="date" value={form.buy_date} onChange={e => setForm(p => ({ ...p, buy_date: e.target.value }))}
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", colorScheme: "dark" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("inv.iconLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#6366f155" : "rgba(255,255,255,.06)"}`, background: form.icon === e ? "rgba(99,102,241,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("inv.colorLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("inv.notesLabel")}</label>
                        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="..."
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 24, boxSizing: "border-box" }} />

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "rgba(255,255,255,.05)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("inv.submitEdit") : t("inv.submitAdd")}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(239,68,68,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("inv.deleteConfirm")}</h3>
                        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#f87171" }}>{confirmDelete.name}</strong> — {t("inv.deleteMsg")}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "transparent", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvestasiView;
