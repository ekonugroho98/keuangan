import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { categoryIcons } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";

const EMOJI_OPTIONS = ["🔄","🏠","🎬","🎵","⚡","💊","📚","🚗","🍔","📱","🛍️","💰","📊","🏋️","☕","🌿","🐾","🎮","🔧","🎁"];

const nextDateFromFreq = (freq, from = new Date()) => {
    const d = new Date(from);
    if (freq === "daily")   d.setDate(d.getDate() + 1);
    if (freq === "weekly")  d.setDate(d.getDate() + 7);
    if (freq === "monthly") d.setMonth(d.getMonth() + 1);
    if (freq === "yearly")  d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
};

const daysUntil = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / 86400000);
};

const emptyForm = () => ({
    name: "", amount: "", icon: "🔄", category: "Lainnya",
    account_name: "", frequency: "monthly",
    next_date: nextDateFromFreq("monthly"), notes: "", debt_id: null,
});

const BerulangView = ({ recurrings = [], accounts = [], debts = [], onAdd, onEdit, onDelete }) => {
    const { t } = useLanguage();

    const FREQ_OPTIONS = [
        { v: "daily",   l: t("rec.freq.daily"),   icon: "📅" },
        { v: "weekly",  l: t("rec.freq.weekly"),  icon: "📆" },
        { v: "monthly", l: t("rec.freq.monthly"), icon: "🗓️" },
        { v: "yearly",  l: t("rec.freq.yearly"),  icon: "📅" },
    ];
    const FREQ_LABEL = {
        daily:   t("rec.freq.daily"),
        weekly:  t("rec.freq.weekly"),
        monthly: t("rec.freq.monthly"),
        yearly:  t("rec.freq.yearly"),
    };

    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);

    const openAdd = () => {
        setEditTarget(null);
        const f = emptyForm();
        if (accounts.length > 0) f.account_name = accounts[0].name;
        setForm(f);
        setShowModal(true);
    };

    const openEdit = (r) => {
        setEditTarget(r);
        setForm({
            name: r.name, amount: String(r.amount), icon: r.icon,
            category: r.category, account_name: r.account_name,
            frequency: r.frequency, next_date: r.next_date, notes: r.notes || "",
            debt_id: r.debt_id || null,
        });
        setShowModal(true);
    };

    const handleFreqChange = (freq) => {
        setForm(p => ({ ...p, frequency: freq, next_date: nextDateFromFreq(freq) }));
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !form.amount || !form.account_name) return;
        const payload = {
            name: form.name.trim(), amount: parseInt(form.amount),
            icon: form.icon, category: form.category,
            account_name: form.account_name, frequency: form.frequency,
            next_date: form.next_date, notes: form.notes.trim(),
            debt_id: form.debt_id || null,
        };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    const canSubmit = form.name.trim() && form.amount && form.account_name;

    const totalMonthly = recurrings.reduce((sum, r) => {
        if (r.frequency === "monthly") return sum + r.amount;
        if (r.frequency === "yearly")  return sum + Math.round(r.amount / 12);
        if (r.frequency === "weekly")  return sum + r.amount * 4;
        if (r.frequency === "daily")   return sum + r.amount * 30;
        return sum;
    }, 0);

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{t("rec.title")}</h3>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
                        {recurrings.length} {t("tx.summary")} · {t("rec.estimasi")} {fmtRp(totalMonthly)}{t("rec.perMonth")}
                    </p>
                </div>
                <button onClick={openAdd}
                    style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                    {t("rec.addNew")}
                </button>
            </div>

            {recurrings.length === 0 ? (
                <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 22, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>{t("rec.noData")}</div>
                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 20 }}>{t("rec.noDataSub")}</div>
                    <button onClick={openAdd}
                        style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("rec.addFirst")}
                    </button>
                </div>
            ) : (
                <div style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, overflow: "hidden" }}>
                    {recurrings.map((r, i) => {
                        const days = daysUntil(r.next_date);
                        const isUrgent = days <= 3;
                        const account = accounts.find(a => a.name === r.account_name);
                        return (
                            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderTop: i > 0 ? "1px solid rgba(255,255,255,.04)" : "none", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                                    {/* Icon */}
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                                        {r.icon}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 3 }}>{r.name}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            {/* Frekuensi badge */}
                                            <span style={{ fontSize: 10, fontWeight: 600, color: "#818cf8", background: "rgba(99,102,241,.12)", padding: "2px 8px", borderRadius: 20 }}>
                                                {FREQ_LABEL[r.frequency]}
                                            </span>
                                            {/* Akun badge */}
                                            <span style={{ fontSize: 10, fontWeight: 600, color: account?.color || "#64748b", background: (account?.color || "#64748b") + "15", padding: "2px 8px", borderRadius: 20 }}>
                                                {account?.icon || "💳"} {r.account_name}
                                            </span>
                                            {/* Tanggal */}
                                            <span style={{ fontSize: 10, color: isUrgent ? "#fbbf24" : "#64748b" }}>
                                                {isUrgent ? "⚠️ " : ""}
                                                {days === 0 ? t("rec.today") : days < 0 ? t("rec.overdue") : `${days} ${t("rec.daysLeft")}`}
                                                {" · "}{new Date(r.next_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                            </span>
                                            {/* Linked debt badge */}
                                            {r.debt_id && debts.find(d => d.id === r.debt_id) && (
                                                <span style={{ fontSize: 10, fontWeight: 600, color: "#f87171", background: "rgba(239,68,68,.1)", padding: "2px 8px", borderRadius: 20 }}>
                                                    🔗 {debts.find(d => d.id === r.debt_id).name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>-{fmtRp(r.amount)}</div>
                                    <button onClick={() => openEdit(r)} style={{ background: "rgba(99,102,241,.1)", border: "none", color: "#818cf8", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 13 }}>✏️</button>
                                    <button onClick={() => setConfirmDelete(r)} style={{ background: "rgba(239,68,68,.08)", border: "none", color: "#f87171", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🗑️</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Tambah/Edit */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: 0 }}>{editTarget ? t("rec.editTitle") : t("rec.addTitle")}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Nama */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("rec.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Bayar Kos, Netflix..." maxLength={50}
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        {/* Jumlah */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("rec.amountLabel")}</label>
                        <input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="150000" type="number"
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        {/* Akun */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("rec.accountLabel")}</label>
                        {accounts.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 16 }}>{t("rec.noAccount")}</div>
                        ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                                {accounts.map(a => (
                                    <button key={a.id} onClick={() => setForm(p => ({ ...p, account_name: a.name }))}
                                        style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${form.account_name === a.name ? a.color + "55" : "rgba(255,255,255,.06)"}`, background: form.account_name === a.name ? a.color + "18" : "transparent", color: form.account_name === a.name ? a.color : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                                        {a.icon} {a.name}
                                        <span style={{ fontSize: 10, opacity: .7 }}>({fmtRp(a.balance)})</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Frekuensi */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("rec.freqLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            {FREQ_OPTIONS.map(f => (
                                <button key={f.v} onClick={() => handleFreqChange(f.v)}
                                    style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${form.frequency === f.v ? "#6366f155" : "rgba(255,255,255,.06)"}`, background: form.frequency === f.v ? "rgba(99,102,241,.15)" : "transparent", color: form.frequency === f.v ? "#818cf8" : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                                    <div>{f.icon}</div>
                                    <div>{f.l}</div>
                                </button>
                            ))}
                        </div>

                        {/* Tanggal berikutnya */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("rec.nextDateLabel")}</label>
                        <input type="date" value={form.next_date} onChange={e => setForm(p => ({ ...p, next_date: e.target.value }))}
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", colorScheme: "dark" }} />

                        {/* Icon */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>{t("rec.iconLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#6366f155" : "rgba(255,255,255,.06)"}`, background: form.icon === e ? "rgba(99,102,241,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        {/* Catatan */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("rec.notesLabel")}</label>
                        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opsional..."
                            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        {/* Terkait Hutang */}
                        {debts.length > 0 && (
                            <>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6 }}>{t("rec.linkedDebt")}</label>
                                <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>{t("rec.linkedDebtSub")}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                                    <button
                                        onClick={() => setForm(p => ({ ...p, debt_id: null }))}
                                        style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${!form.debt_id ? "rgba(100,116,139,.5)" : "rgba(255,255,255,.06)"}`, background: !form.debt_id ? "rgba(100,116,139,.15)" : "transparent", color: !form.debt_id ? "#94a3b8" : "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                        {t("rec.noLinked")}
                                    </button>
                                    {debts.map(d => (
                                        <button key={d.id}
                                            onClick={() => setForm(p => ({ ...p, debt_id: d.id }))}
                                            style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${form.debt_id === d.id ? d.color + "55" : "rgba(255,255,255,.06)"}`, background: form.debt_id === d.id ? d.color + "15" : "transparent", color: form.debt_id === d.id ? d.color : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                            {d.icon} {d.name}
                                            <span style={{ fontSize: 10, opacity: .7, marginLeft: 4 }}>({fmtRp(d.remaining)} {t("rec.remaining")})</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                        {debts.length === 0 && <div style={{ marginBottom: 24 }} />}

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "rgba(255,255,255,.05)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("common.saveChanges") : t("rec.addTitle")}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(239,68,68,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("rec.deleteConfirm")}</h3>
                        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#f87171" }}>{confirmDelete.name}</strong>
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

export default BerulangView;
