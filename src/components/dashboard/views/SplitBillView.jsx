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
    width: "100%", padding: "12px 14px", minHeight: 44,
    background: "var(--glass-2)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border)",
    borderRadius: 12, color: "var(--color-text)", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

const selectStyle = {
    padding: "10px 12px", minHeight: 44,
    background: "var(--glass-2)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border)", borderRadius: 12,
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
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>SPLIT BILL</div>
                    <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>{t("split.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        {splitBills.length} {t("split.activeBills") || "tagihan aktif"}
                    </p>
                </div>
                <button onClick={openAdd} className="btn-primary" style={{ minHeight: 42 }}>
                    {t("split.addNew")}
                </button>
            </div>

            {/* Empty state */}
            {splitBills.length === 0 && (
                <div style={{
                    background: "var(--glass-1)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 20, padding: "48px 24px", textAlign: "center",
                    boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🧾</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 6, letterSpacing: "-.01em" }}>{t("split.noData")}</div>
                    <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20 }}>{t("split.noDataSub")}</div>
                    <button onClick={openAdd} className="btn-primary" style={{ minHeight: 44 }}>
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
                            background: "var(--glass-1)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: 20, overflow: "hidden",
                            boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                            position: "relative",
                        }}>
                            {/* Card header — clickable */}
                            <div
                                onClick={() => toggleExpand(bill.id)}
                                style={{ padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14, minHeight: 42 }}
                            >
                                <div style={{
                                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                                    background: "var(--color-primary-soft)",
                                    border: "1px solid var(--glass-border)",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                                }}>
                                    🧾
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-.01em" }}>{bill.title}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span className="num-tight mono" style={{ fontSize: 14, fontWeight: 800, color: "var(--color-primary)" }}>{fmtRp(bill.total_amount)}</span>
                                            <span style={{ fontSize: 12, color: "var(--color-subtle)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 8 }}>
                                        {formatDate(bill.date)} · {members.length} peserta
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ height: 8, borderRadius: 99, background: "var(--color-border-soft)", marginBottom: 6, overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%", borderRadius: 99,
                                            background: pct === 100 ? "linear-gradient(90deg,var(--color-primary),var(--color-primary-deep))" : "linear-gradient(90deg,var(--color-transfer),var(--color-primary))",
                                            width: `${pct}%`, transition: "width .5s",
                                        }} />
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, gap: 8, flexWrap: "wrap" }}>
                                        <span style={{ color: "var(--color-muted)" }}>
                                            <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>{paidCount}</span>/{members.length} sudah bayar
                                        </span>
                                        <span className="num-tight" style={{ color: pct === 100 ? "var(--color-primary)" : "var(--color-expense)", fontWeight: 700 }}>
                                            {pct === 100 ? "Lunas!" : `${fmtRp(bill.total_amount - paidAmount)} belum`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <div style={{
                                    borderTop: "1px solid var(--color-border-soft)",
                                    background: "var(--glass-2)",
                                    backdropFilter: "var(--glass-blur)",
                                    WebkitBackdropFilter: "var(--glass-blur)",
                                    padding: "16px 20px",
                                }}>
                                    {bill.note && (
                                        <div style={{
                                            fontSize: 12, color: "var(--color-muted)",
                                            background: "var(--bg-surface-low)",
                                            border: "1px solid var(--color-border-soft)",
                                            borderRadius: 10,
                                            padding: "10px 12px", marginBottom: 14,
                                        }}>
                                            {bill.note}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", letterSpacing: 1.6, marginBottom: 10, textTransform: "uppercase" }}>Peserta</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                        {members.map(m => (
                                            <div key={m.id} style={{
                                                display: "flex", alignItems: "center", gap: 10,
                                                padding: "10px 12px", borderRadius: 12,
                                                background: m.paid ? "var(--color-primary-soft)" : "var(--glass-1)",
                                                backdropFilter: "var(--glass-blur)",
                                                WebkitBackdropFilter: "var(--glass-blur)",
                                                border: `1px solid ${m.paid ? "var(--glass-border)" : "var(--color-border-soft)"}`,
                                                minHeight: 52, flexWrap: "wrap",
                                            }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                                    background: m.paid ? "var(--color-primary-soft)" : "var(--bg-surface-low)",
                                                    border: "1px solid var(--glass-border)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 13, fontWeight: 800, color: m.paid ? "var(--color-primary)" : "var(--color-muted)",
                                                }}>
                                                    {m.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{m.name}</div>
                                                    <div className="num-tight mono" style={{ fontSize: 11, color: "var(--color-subtle)" }}>{fmtRp(m.amount)}</div>
                                                </div>
                                                {m.paid && (
                                                    <span className="chip chip-mint">LUNAS</span>
                                                )}
                                                <button
                                                    onClick={() => onTogglePaid(m.id, !m.paid)}
                                                    aria-label={m.paid ? `Tandai ${m.name} belum bayar` : `Tandai ${m.name} sudah bayar`}
                                                    style={{
                                                        width: 42, height: 42, borderRadius: 10,
                                                        border: `1px solid ${m.paid ? "var(--glass-border)" : "var(--color-border)"}`,
                                                        background: m.paid ? "var(--color-primary-soft)" : "var(--glass-2)",
                                                        backdropFilter: "var(--glass-blur)",
                                                        WebkitBackdropFilter: "var(--glass-blur)",
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
                                            width: "100%", padding: "11px 0", minHeight: 42, borderRadius: 12,
                                            border: "1px solid var(--color-expense-soft)",
                                            background: "var(--color-expense-soft)",
                                            color: "var(--color-expense)", fontSize: 12, fontWeight: 700,
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
                        background: "rgba(0,0,0,.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: "var(--glass-hero)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: 24, padding: "clamp(20px, 4vw, 28px)", width: "100%", maxWidth: 480,
                            maxHeight: "90vh", overflowY: "auto",
                            boxShadow: "var(--glass-highlight), 0 12px 40px rgba(0,0,0,.2)",
                        }}
                    >
                        {/* Modal header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, gap: 8 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 800, fontSize: 18, margin: 0, letterSpacing: "-.015em" }}>{t("split.addTitle")}</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                aria-label="Tutup"
                                style={{
                                    background: "var(--glass-2)", border: "1px solid var(--glass-border)",
                                    color: "var(--color-muted)", width: 36, height: 36, borderRadius: 10,
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
                                            aria-label={`Hapus peserta ${idx + 1}`}
                                            style={{
                                                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                                                border: "1px solid var(--color-expense-soft)",
                                                background: "var(--color-expense-soft)",
                                                color: "var(--color-expense)", cursor: "pointer", fontSize: 14,
                                            }}
                                        >✕</button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addMember}
                            style={{
                                width: "100%", padding: "11px 0", minHeight: 44, borderRadius: 12,
                                border: "1px dashed var(--color-border)",
                                background: "var(--glass-2)",
                                backdropFilter: "var(--glass-blur)",
                                WebkitBackdropFilter: "var(--glass-blur)",
                                color: "var(--color-muted)",
                                fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 20,
                            }}
                        >
                            {t("split.addMember")}
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="btn-primary"
                            style={{
                                width: "100%", minHeight: 46,
                                cursor: !canSubmit ? "not-allowed" : "pointer",
                                opacity: !canSubmit ? .4 : 1,
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
                        background: "rgba(0,0,0,.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: "var(--glass-hero)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: "1px solid var(--color-expense-soft)",
                            borderRadius: 24, padding: "clamp(20px, 4vw, 28px)", width: "100%", maxWidth: 360, textAlign: "center",
                            boxShadow: "var(--glass-highlight), 0 12px 40px rgba(0,0,0,.2)",
                        }}
                    >
                        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🗑️</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 800, fontSize: 17, margin: "0 0 8px", letterSpacing: "-.015em" }}>{t("split.deleteConfirm")}</h3>
                        <p style={{ color: "var(--color-muted)", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "var(--color-expense)" }}>{confirmDelete.title}</strong> akan dihapus permanen.
                        </p>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="btn-ghost"
                                style={{ flex: 1, minHeight: 44, minWidth: 110 }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); setExpanded(null); }}
                                style={{
                                    flex: 1, minHeight: 44, minWidth: 110, padding: 11, borderRadius: 12, border: "1px solid var(--color-expense-soft)",
                                    background: "var(--color-expense-soft)",
                                    color: "var(--color-expense)", fontSize: 13, fontWeight: 800,
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
