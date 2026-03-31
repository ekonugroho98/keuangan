import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { categoryIcons, categoryColors } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";

const EMOJI_OPTIONS = ["📦","🍔","🚗","🏠","🎬","🛍️","⚡","💊","📚","❤️","💰","💼","📊","📈","🔄","✈️","🎮","🐾","🌿","☕","🍕","🏋️","💇","🎵","📱","🖥️","🏦","🎁","🚀","🌟","🔧","🏪"];
const COLOR_OPTIONS = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#64748b","#a855f7","#22c55e"];

const KategoriView = ({ catTotals, customCategories, onAddCategory, onEditCategory, onDeleteCategory }) => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null); // null = add, object = edit
    const [form, setForm] = useState({ name: "", icon: "📦", type: "expense", color: "#6366f1" });
    const [confirmDelete, setConfirmDelete] = useState(null);

    const openAdd = () => {
        setEditTarget(null);
        setForm({ name: "", icon: "📦", type: "expense", color: "#6366f1" });
        setShowModal(true);
    };

    const openEdit = (cat) => {
        setEditTarget(cat);
        setForm({ name: cat.name, icon: cat.icon, type: cat.type, color: cat.color });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!form.name.trim()) return;
        if (editTarget) {
            onEditCategory(editTarget.id, form);
        } else {
            onAddCategory(form);
        }
        setShowModal(false);
    };

    // Kategori default (dari constants)
    const defaultCats = Object.entries(categoryIcons).map(([name, icon]) => ({
        id: null, name, icon,
        color: categoryColors[name] || "#64748b",
        isDefault: true,
    }));

    // Semua kategori: default + custom
    const allCats = [
        ...defaultCats,
        ...(customCategories || []).map(c => ({ ...c, isDefault: false })),
    ];

    const expenseCats = allCats.filter(c => c.isDefault ? !["Gaji","Freelance","Bisnis","Investasi","Transfer"].includes(c.name) : c.type !== "income");
    const incomeCats = allCats.filter(c => c.isDefault ? ["Gaji","Freelance","Bisnis","Investasi","Transfer"].includes(c.name) : c.type !== "expense");

    const renderSection = (title, cats, icon) => (
        <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1, marginBottom: 12 }}>
                {icon} {title.toUpperCase()} — {cats.length} {t("cat.custom").replace(/\d+ /, "")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                {cats.map((c, i) => {
                    const amt = catTotals[c.name] || 0;
                    return (
                        <div
                            key={c.id || c.name}
                            style={{
                                background: "rgba(255,255,255,.03)",
                                border: `1px solid ${amt > 0 ? c.color + "33" : "rgba(255,255,255,.05)"}`,
                                borderRadius: 12, padding: "12px 14px",
                                display: "flex", alignItems: "center", gap: 10,
                                position: "relative",
                                transition: "border-color .2s",
                            }}
                        >
                            <div style={{
                                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                background: c.color + "18",
                                border: `1px solid ${c.color}33`,
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                            }}>
                                {c.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                                <div style={{ fontSize: 10, color: amt > 0 ? "#94a3b8" : "#475569" }}>
                                    {amt > 0 ? fmtRp(amt) : t("cat.noTx")}
                                </div>
                            </div>
                            {/* Badge custom */}
                            {!c.isDefault && (
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                    <button
                                        onClick={() => openEdit(c)}
                                        title="Edit"
                                        style={{ background: "rgba(99,102,241,.12)", border: "none", color: "#818cf8", width: 24, height: 24, borderRadius: 6, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >✏️</button>
                                    <button
                                        onClick={() => setConfirmDelete(c)}
                                        title="Hapus"
                                        style={{ background: "rgba(239,68,68,.1)", border: "none", color: "#f87171", width: 24, height: 24, borderRadius: 6, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >🗑️</button>
                                </div>
                            )}
                            {c.isDefault && (
                                <div style={{ fontSize: 9, color: "#334155", fontWeight: 600, flexShrink: 0 }}>DEFAULT</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{t("cat.title")}</h3>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
                        {allCats.length} {t("cat.total")} · {(customCategories || []).length} {t("cat.custom")}
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    style={{
                        padding: "9px 18px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                        color: "#fff", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: 6,
                    }}
                >
                    {t("cat.addNew")}
                </button>
            </div>

            <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22 }}>
                {renderSection(t("cat.expense"), expenseCats, "💸")}
                {renderSection(t("cat.income"), incomeCats, "💵")}
            </div>

            {/* Modal Tambah/Edit */}
            {showModal && (
                <div
                    onClick={() => setShowModal(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420 }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: 0 }}>
                                {editTarget ? t("cat.editTitle") : t("cat.addTitle")}
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{form.name || "Nama Kategori"}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>{form.type === "expense" ? t("cat.expense") : form.type === "income" ? t("cat.income") : t("cat.typeBoth")}</div>
                            </div>
                        </div>

                        {/* Nama */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("cat.nameLabel")}</label>
                        <input
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder={t("cat.namePlaceholder")}
                            maxLength={30}
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }}
                        />

                        {/* Tipe */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("cat.typeLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            {[{ v: "expense", l: t("cat.expense"), c: "#ef4444" }, { v: "income", l: t("cat.income"), c: "#10b981" }, { v: "both", l: t("cat.typeBoth"), c: "#6366f1" }].map(tp => (
                                <button key={tp.v} onClick={() => setForm(p => ({ ...p, type: tp.v }))}
                                    style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${form.type === tp.v ? tp.c + "55" : "rgba(255,255,255,.06)"}`, background: form.type === tp.v ? tp.c + "15" : "transparent", color: form.type === tp.v ? tp.c : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                    {tp.l}
                                </button>
                            ))}
                        </div>

                        {/* Icon */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("cat.iconLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#6366f155" : "rgba(255,255,255,.06)"}`, background: form.icon === e ? "rgba(99,102,241,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        {/* Warna */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("cat.colorLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!form.name.trim()}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !form.name.trim() ? "rgba(255,255,255,.05)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: !form.name.trim() ? "not-allowed" : "pointer", opacity: !form.name.trim() ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("cat.submitEdit") : t("cat.submitAdd")}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div
                    onClick={() => setConfirmDelete(null)}
                    style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: "#0f0f1a", border: "1px solid rgba(239,68,68,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}
                    >
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("cat.deleteConfirm")}</h3>
                        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#f87171" }}>{confirmDelete.name}</strong> — {t("cat.deleteMsg")}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "transparent", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDeleteCategory(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KategoriView;
