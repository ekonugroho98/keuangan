import { useState, useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";

const fmtRp = (n) => "Rp " + (n || 0).toLocaleString("id-ID");

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
    { v: "01", l: "Januari" }, { v: "02", l: "Februari" }, { v: "03", l: "Maret" },
    { v: "04", l: "April" }, { v: "05", l: "Mei" }, { v: "06", l: "Juni" },
    { v: "07", l: "Juli" }, { v: "08", l: "Agustus" }, { v: "09", l: "September" },
    { v: "10", l: "Oktober" }, { v: "11", l: "November" }, { v: "12", l: "Desember" },
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const emptyForm = () => ({
    title: "",
    total_amount: "",
    note: "",
    day: String(new Date().getDate()).padStart(2, "0"),
    month: String(new Date().getMonth() + 1).padStart(2, "0"),
    year: String(new Date().getFullYear()),
    members: [
        { id: genId(), name: "", amount: "" },
        { id: genId(), name: "", amount: "" },
    ],
});

const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)",
    borderRadius: 10, color: "var(--color-text)", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

const selectStyle = {
    padding: "9px 10px", background: "var(--color-border-soft)",
    border: "1px solid var(--color-border-soft)", borderRadius: 10,
    color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none",
    cursor: "pointer",
};

const SplitBillView = ({ splitBills, onAdd, onDelete, onTogglePaid }) => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [expanded, setExpanded] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const openAdd = () => { setForm(emptyForm()); setShowModal(true); };

    const addMember = () => {
        setForm(p => ({ ...p, members: [...p.members, { id: genId(), name: "", amount: "" }] }));
    };

    const removeMember = (id) => {
        setForm(p => ({ ...p, members: p.members.filter(m => m.id !== id) }));
    };

    const updateMember = (id, field, val) => {
        setForm(p => ({
            ...p,
            members: p.members.map(m => m.id === id ? { ...m, [field]: val } : m),
        }));
    };

    const totalMemberAmount = useMemo(() =>
        form.members.reduce((s, m) => s + (parseInt(m.amount) || 0), 0),
        [form.members]
    );

    const canSubmit = form.title.trim() && form.total_amount && form.members.some(m => m.name.trim());

    const handleSubmit = () => {
        if (!canSubmit) return;
        const date = `${form.year}-${form.month}-${String(form.day).padStart(2, "0")}`;
        const validMembers = form.members
            .filter(m => m.name.trim())
            .map(m => ({ name: m.name.trim(), amount: parseInt(m.amount) || 0, paid: false }));
        const payload = {
            title: form.title.trim(),
            total_amount: parseInt(form.total_amount),
            date,
            note: form.note.trim(),
            members: validMembers,
        };
        onAdd(payload);
        setShowModal(false);
    };

    const toggleExpand = (id) => setExpanded(p => p === id ? null : id);

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    };

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{t("split.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                        {splitBills.length} {t("split.activeBills") || "tagihan aktif"}
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    style={{
                        padding: "9px 18px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg,#60fcc6,#19ce9b)",
                        color: "var(--color-on-primary)", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                    }}
                >
                    {t("split.addNew")}
                </button>
            </div>

            {/* Empty state */}
            {splitBills.length === 0 && (
                <div style={{
                    background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)",
                    borderRadius: 16, padding: "48px 24px", textAlign: "center",
                }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>{t("split.noData")}</div>
                    <div style={{ fontSize: 13, color: "var(--color-subtle)", marginBottom: 20 }}>{t("split.noDataSub")}</div>
                    <button
                        onClick={openAdd}
                        style={{
                            padding: "10px 24px", borderRadius: 10, border: "none",
                            background: "var(--color-primary)", color: "var(--color-on-primary)",
                            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        }}
                    >
                        {t("split.addFirst")}
                    </button>
                </div>
            )}

            {/* Bills list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {splitBills.map(bill => {
                    const members = bill.split_bill_members || bill.members || [];
                    const paidCount = members.filter(m => m.paid).length;
                    const paidAmount = members.filter(m => m.paid).reduce((s, m) => s + m.amount, 0);
                    const pct = members.length > 0 ? Math.round((paidCount / members.length) * 100) : 0;
                    const isExpanded = expanded === bill.id;

                    return (
                        <div key={bill.id} style={{
                            background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)",
                            borderRadius: 16, overflow: "hidden",
                            boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                        }}>
                            {/* Card header — clickable */}
                            <div
                                onClick={() => toggleExpand(bill.id)}
                                style={{ padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}
                            >
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                    background: "rgba(96,252,198,.12)", border: "1px solid rgba(96,252,198,.25)",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                                }}>
                                    🧾
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>{bill.title}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>{fmtRp(bill.total_amount)}</span>
                                            <span style={{ fontSize: 12, color: "var(--color-subtle)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 8 }}>
                                        {formatDate(bill.date)} · {members.length} peserta
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ height: 6, borderRadius: 3, background: "var(--color-border-soft)", marginBottom: 6 }}>
                                        <div style={{
                                            height: "100%", borderRadius: 3,
                                            background: pct === 100 ? "linear-gradient(90deg,#60fcc6,#19ce9b)" : "linear-gradient(90deg,#4FC3F7,#60fcc6)",
                                            width: `${pct}%`, transition: "width .5s",
                                        }} />
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                        <span style={{ color: "var(--color-muted)" }}>
                                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{paidCount}</span>/{members.length} sudah bayar
                                        </span>
                                        <span style={{ color: pct === 100 ? "var(--color-primary)" : "#ff716c", fontWeight: 600 }}>
                                            {pct === 100 ? "Lunas!" : `${fmtRp(bill.total_amount - paidAmount)} belum`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <div style={{
                                    borderTop: "1px solid var(--color-border-soft)",
                                    background: "var(--bg-surface-low)",
                                    padding: "16px 20px",
                                }}>
                                    {bill.note && (
                                        <div style={{
                                            fontSize: 12, color: "var(--color-subtle)",
                                            background: "var(--color-border-soft)", borderRadius: 8,
                                            padding: "8px 12px", marginBottom: 14,
                                        }}>
                                            {bill.note}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-subtle)", letterSpacing: 1, marginBottom: 10 }}>PESERTA</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                        {members.map(m => (
                                            <div key={m.id} style={{
                                                display: "flex", alignItems: "center", gap: 10,
                                                padding: "10px 12px", borderRadius: 10,
                                                background: m.paid ? "rgba(96,252,198,.06)" : "var(--bg-surface)",
                                                border: `1px solid ${m.paid ? "rgba(96,252,198,.2)" : "var(--color-border-soft)"}`,
                                            }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                                                    background: m.paid ? "rgba(96,252,198,.15)" : "var(--color-border-soft)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 13, fontWeight: 700, color: m.paid ? "var(--color-primary)" : "var(--color-muted)",
                                                }}>
                                                    {m.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{m.name}</div>
                                                    <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>{fmtRp(m.amount)}</div>
                                                </div>
                                                {m.paid && (
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 700, color: "var(--color-primary)",
                                                        background: "rgba(96,252,198,.12)", border: "1px solid rgba(96,252,198,.25)",
                                                        borderRadius: 6, padding: "3px 8px",
                                                    }}>
                                                        LUNAS
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => onTogglePaid(m.id, !m.paid)}
                                                    title={m.paid ? "Tandai belum bayar" : "Tandai sudah bayar"}
                                                    style={{
                                                        width: 32, height: 32, borderRadius: 8,
                                                        border: `1px solid ${m.paid ? "rgba(96,252,198,.3)" : "var(--color-border)"}`,
                                                        background: m.paid ? "rgba(96,252,198,.12)" : "transparent",
                                                        color: m.paid ? "var(--color-primary)" : "var(--color-muted)",
                                                        cursor: "pointer", fontSize: 16, flexShrink: 0,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                    }}
                                                >
                                                    {m.paid ? "✅" : "○"}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Delete button */}
                                    <button
                                        onClick={() => setConfirmDelete(bill)}
                                        style={{
                                            width: "100%", padding: "9px 0", borderRadius: 10,
                                            border: "1px solid rgba(255,113,108,.2)",
                                            background: "rgba(255,113,108,.06)",
                                            color: "#ff716c", fontSize: 12, fontWeight: 600,
                                            cursor: "pointer", fontFamily: "inherit",
                                        }}
                                    >
                                        🗑️ Hapus Tagihan
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal Tambah Tagihan */}
            {showModal && (
                <div
                    onClick={() => setShowModal(false)}
                    style={{
                        position: "fixed", inset: 0, zIndex: 100,
                        background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)",
                            borderRadius: 20, padding: 28, width: "100%", maxWidth: 480,
                            maxHeight: "90vh", overflowY: "auto",
                        }}
                    >
                        {/* Modal header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 17, margin: 0 }}>{t("split.addTitle")}</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: "var(--color-border-soft)", border: "none",
                                    color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8,
                                    cursor: "pointer", fontSize: 16,
                                }}
                            >✕</button>
                        </div>

                        {/* Nama tagihan */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                            {t("split.titleLabel")}
                        </label>
                        <input
                            value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            placeholder="Contoh: Makan Malam, Liburan Bali..."
                            maxLength={60}
                            style={{ ...inputStyle, marginBottom: 16 }}
                        />

                        {/* Total */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                            {t("split.total")} (Rp)
                        </label>
                        <input
                            type="number"
                            value={form.total_amount}
                            onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))}
                            placeholder="150000"
                            style={{ ...inputStyle, marginBottom: 16 }}
                        />

                        {/* Tanggal */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                            TANGGAL
                        </label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            <select value={form.day} onChange={e => setForm(p => ({ ...p, day: e.target.value }))} style={selectStyle}>
                                {DAYS.map(d => <option key={d} value={String(d).padStart(2, "0")}>{d}</option>)}
                            </select>
                            <select value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} style={{ ...selectStyle, flex: 1 }}>
                                {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                            </select>
                            <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} style={selectStyle}>
                                {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
                            </select>
                        </div>

                        {/* Catatan */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                            CATATAN (opsional)
                        </label>
                        <input
                            value={form.note}
                            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                            placeholder="Contoh: Resto XYZ, Lantai 3..."
                            maxLength={80}
                            style={{ ...inputStyle, marginBottom: 20 }}
                        />

                        {/* Peserta */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)" }}>DAFTAR PESERTA</label>
                            <span style={{ fontSize: 11, color: totalMemberAmount !== parseInt(form.total_amount || 0) ? "#ff716c" : "var(--color-primary)" }}>
                                Total share: {fmtRp(totalMemberAmount)}
                            </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                            {form.members.map((m, idx) => (
                                <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input
                                        value={m.name}
                                        onChange={e => updateMember(m.id, "name", e.target.value)}
                                        placeholder={`${t("split.memberName")} ${idx + 1}`}
                                        style={{ ...inputStyle, flex: 2 }}
                                    />
                                    <input
                                        type="number"
                                        value={m.amount}
                                        onChange={e => updateMember(m.id, "amount", e.target.value)}
                                        placeholder={t("split.memberAmount")}
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    {form.members.length > 1 && (
                                        <button
                                            onClick={() => removeMember(m.id)}
                                            style={{
                                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                                border: "1px solid rgba(255,113,108,.25)",
                                                background: "rgba(255,113,108,.08)",
                                                color: "#ff716c", cursor: "pointer", fontSize: 14,
                                            }}
                                        >✕</button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addMember}
                            style={{
                                width: "100%", padding: "9px 0", borderRadius: 10,
                                border: "1px dashed var(--color-border)",
                                background: "transparent", color: "var(--color-muted)",
                                fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 20,
                            }}
                        >
                            {t("split.addMember")}
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            style={{
                                width: "100%", padding: 12, borderRadius: 12, border: "none",
                                background: !canSubmit ? "var(--color-border-soft)" : "var(--color-primary)",
                                color: "var(--color-on-primary)", fontWeight: 700, fontSize: 13,
                                cursor: !canSubmit ? "not-allowed" : "pointer",
                                opacity: !canSubmit ? .4 : 1, fontFamily: "inherit",
                            }}
                        >
                            Buat Tagihan
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm delete */}
            {confirmDelete && (
                <div
                    onClick={() => setConfirmDelete(null)}
                    style={{
                        position: "fixed", inset: 0, zIndex: 110,
                        background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: "var(--bg-deep)", border: "1px solid rgba(255,113,108,.2)",
                            borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center",
                        }}
                    >
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("split.deleteConfirm")}</h3>
                        <p style={{ color: "var(--color-subtle)", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#ff716c" }}>{confirmDelete.title}</strong> akan dihapus permanen.
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button
                                onClick={() => setConfirmDelete(null)}
                                style={{
                                    flex: 1, padding: 11, borderRadius: 10,
                                    border: "1px solid var(--color-border-soft)",
                                    background: "transparent", color: "var(--color-muted)",
                                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); setExpanded(null); }}
                                style={{
                                    flex: 1, padding: 11, borderRadius: 10, border: "none",
                                    background: "linear-gradient(135deg,#ff716c,#e04f4f)",
                                    color: "#fff", fontSize: 13, fontWeight: 700,
                                    cursor: "pointer", fontFamily: "inherit",
                                }}
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SplitBillView;
