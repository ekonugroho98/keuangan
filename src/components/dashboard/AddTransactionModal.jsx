import Modal from "../ui/Modal";
import InputField from "../ui/InputField";
import { expenseCategories, incomeCategories } from "../../constants/categories";
import { useLanguage } from "../../i18n/LanguageContext";

/* ── DatePicker: 3 selects (day/month/year) — works in all browsers/mobile ── */
const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const DatePicker = ({ value, onChange }) => {
    const [y, m, d] = (value || new Date().toISOString().slice(0,10)).split("-");
    const year = parseInt(y), month = parseInt(m), day = parseInt(d);
    const daysInMonth = new Date(year, month, 0).getDate();
    const years = Array.from({ length: 5 }, (_, i) => year - 2 + i);
    const sel = { padding: "9px 8px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--bg-surface-low)", color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", cursor: "pointer", flex: 1 };
    const set = (newY, newM, newD) => {
        const maxD = new Date(newY, newM, 0).getDate();
        const safeD = Math.min(newD, maxD);
        onChange(`${newY}-${String(newM).padStart(2,"0")}-${String(safeD).padStart(2,"0")}`);
    };
    return (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <select value={day} onChange={e => set(year, month, parseInt(e.target.value))} style={sel}>
                {Array.from({ length: daysInMonth }, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={month} onChange={e => set(year, parseInt(e.target.value), day)} style={{ ...sel, flex: 2 }}>
                {MONTHS_ID.map((mn, i) => <option key={i+1} value={i+1}>{mn}</option>)}
            </select>
            <select value={year} onChange={e => set(parseInt(e.target.value), month, day)} style={{ ...sel, flex: 2 }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    );
};

const TYPES = [
    { v: "expense",  l: "Pengeluaran", c: "#ff716c" },
    { v: "income",   l: "Pemasukan",   c: "var(--color-primary)" },
    { v: "transfer", l: "Antar Rekening", c: "#06b6d4" },
];

const AddTransactionModal = ({
    open, onClose,
    txForm, setTxForm,
    onSubmit, onTransfer,
    accounts, customCategories = [],
    // Edit mode
    editMode = false, onUpdate,
    // Loading state
    isSaving = false,
}) => {
    const { t } = useLanguage();

    /* ── Format angka dengan titik (1000000 → "1.000.000") ── */
    const fmtDisplay = (raw) => {
        if (!raw) return "";
        const n = parseInt(String(raw).replace(/\D/g, ""), 10);
        if (isNaN(n)) return "";
        return n.toLocaleString("id-ID");
    };
    const handleAmountChange = (e) => {
        const raw = e.target.value.replace(/\D/g, "");
        setTxForm(p => ({ ...p, amount: raw }));
    };

    /* Terjemahkan nama kategori default, custom tetap nama asli */
    const DEFAULT_CATS = new Set([...expenseCategories, ...incomeCategories]);
    const tCat = (name) => { if (!DEFAULT_CATS.has(name)) return name; const k = "cat.name." + name; const v = t(k); return v === k ? name : v; };

    const extraExpense = customCategories.filter(c => c.type !== "income").map(c => c.name);
    const extraIncome  = customCategories.filter(c => c.type !== "expense").map(c => c.name);
    const allExpense = [...expenseCategories, ...extraExpense];
    const allIncome  = [...incomeCategories,  ...extraIncome];

    const isTransfer = txForm.type === "transfer";
    const canSubmit = isTransfer
        ? txForm.amount && txForm.account && txForm.toAccount && txForm.account !== txForm.toAccount
        : !!txForm.amount;

    const handleSubmit = () => {
        if (editMode)   { onUpdate(); return; }
        if (isTransfer) { onTransfer(); return; }
        onSubmit();
    };

    const submitLabel = isSaving
        ? "Menyimpan..."
        : editMode
            ? "✅ Update Transaksi"
            : isTransfer ? "🔀 Pindah Antar Rekening" : "Simpan Transaksi";

    return (
    <Modal open={open} onClose={onClose}>
        <div style={{ background: "var(--bg-surface-low)", borderRadius: "20px 20px 0 0", border: "1px solid var(--color-border)", borderBottom: "none", padding: "24px 20px 36px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>
                        {editMode ? "✏️ Edit Transaksi" : "Tambah Transaksi"}
                    </h3>
                    {editMode && <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Ubah detail transaksi di bawah</p>}
                </div>
                <button onClick={onClose} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Tipe — tidak bisa ganti tipe saat edit transfer */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {TYPES.map(t => {
                    const disabled = editMode && isTransfer && t.v !== "transfer";
                    return (
                        <button key={t.v}
                            onClick={() => !disabled && !editMode && setTxForm(p => ({ ...p, type: t.v, toAccount: "" }))}
                            disabled={disabled || editMode}
                            style={{
                                flex: 1, padding: 10, borderRadius: 10,
                                border: `1px solid ${txForm.type === t.v ? t.c + "55" : "var(--color-border-soft)"}`,
                                background: txForm.type === t.v ? t.c + "15" : "transparent",
                                color: txForm.type === t.v ? t.c : "#475569",
                                fontWeight: 600, fontSize: 12,
                                cursor: (disabled || editMode) ? "default" : "pointer",
                                fontFamily: "inherit",
                                opacity: (disabled || (editMode && txForm.type !== t.v)) ? 0.35 : 1,
                            }}
                        >{t.l}</button>
                    );
                })}
            </div>

            {/* Transfer edit: only note editable */}
            {editMode && isTransfer ? (
                <>
                    <div style={{ background: "rgba(6,182,212,.06)", border: "1px solid rgba(6,182,212,.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6 }}>
                        ℹ️ Transfer hanya bisa diubah catatannya. Untuk mengubah akun / jumlah, <strong style={{ color: "#ff716c" }}>hapus dan buat ulang</strong>.
                    </div>
                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                    <div style={{ padding: "8px 12px", background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "var(--color-muted)" }}>
                        📅 Tanggal: <strong style={{ color: "var(--color-text)" }}>{txForm.date || "-"}</strong>
                    </div>
                </>
            ) : isTransfer ? (
                /* ── Mode Transfer (tambah baru) ── */
                <>
                    <InputField label="JUMLAH (Rp)" icon="💰" type="text" inputMode="numeric" placeholder="150.000" value={fmtDisplay(txForm.amount)} onChange={handleAmountChange} />

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>DARI AKUN</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => {
                            const selected = txForm.account === a.name;
                            const isDestination = txForm.toAccount === a.name;
                            return (
                                <button key={a.name}
                                    onClick={() => !isDestination && setTxForm(p => ({ ...p, account: a.name }))}
                                    disabled={isDestination}
                                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${selected ? "#06b6d455" : "var(--color-border-soft)"}`, background: selected ? "rgba(6,182,212,.15)" : "transparent", color: selected ? "#06b6d4" : isDestination ? "#334155" : "#94a3b8", fontSize: 11, fontWeight: 600, cursor: isDestination ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isDestination ? 0.4 : 1 }}
                                >{a.icon} {a.name}</button>
                            );
                        })}
                    </div>

                    <div style={{ textAlign: "center", fontSize: 20, marginBottom: 16, color: "#06b6d4" }}>↓</div>

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>KE AKUN</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => {
                            const selected = txForm.toAccount === a.name;
                            const isSource = txForm.account === a.name;
                            return (
                                <button key={a.name}
                                    onClick={() => !isSource && setTxForm(p => ({ ...p, toAccount: a.name }))}
                                    disabled={isSource}
                                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${selected ? "#60fcc655" : "var(--color-border-soft)"}`, background: selected ? "rgba(96,252,198,.15)" : "transparent", color: selected ? "var(--color-primary)" : isSource ? "#334155" : "var(--color-muted)", fontSize: 11, fontWeight: 600, cursor: isSource ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isSource ? 0.4 : 1 }}
                                >{a.icon} {a.name}</button>
                            );
                        })}
                    </div>

                    {txForm.account && txForm.toAccount && txForm.amount && (
                        <div style={{ background: "rgba(6,182,212,.08)", border: "1px solid rgba(6,182,212,.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>DARI</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#ff716c" }}>{txForm.account}</div>
                                <div style={{ fontSize: 11, color: "#ff716c" }}>-Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                            <div style={{ fontSize: 20 }}>→</div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>KE</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>{txForm.toAccount}</div>
                                <div style={{ fontSize: 11, color: "var(--color-primary)" }}>+Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                        </div>
                    )}
                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                    {/* Date for transfer */}
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>📅 TANGGAL</label>
                    <DatePicker value={txForm.date} onChange={date => setTxForm(p => ({ ...p, date }))} />
                </>
            ) : (
                /* ── Mode Normal (expense / income) ── */
                <>
                    <InputField label="JUMLAH (Rp)" icon="💰" type="text" inputMode="numeric" placeholder="150.000" value={fmtDisplay(txForm.amount)} onChange={handleAmountChange} />

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>{t("addTx.category") || "KATEGORI"}</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {(txForm.type === "expense" ? allExpense : allIncome).map(c => (
                            <button key={c} onClick={() => setTxForm(p => ({ ...p, category: c }))}
                                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${txForm.category === c ? "#60fcc655" : "var(--color-border-soft)"}`, background: txForm.category === c ? "rgba(96,252,198,.15)" : "transparent", color: txForm.category === c ? "var(--color-primary)" : "var(--color-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >{tCat(c)}</button>
                        ))}
                    </div>

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>AKUN SUMBER</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => (
                            <button key={a.name} onClick={() => setTxForm(p => ({ ...p, account: a.name }))}
                                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${txForm.account === a.name ? a.color + "55" : "var(--color-border-soft)"}`, background: txForm.account === a.name ? a.color + "15" : "transparent", color: txForm.account === a.name ? a.color : "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >{a.icon} {a.name}</button>
                        ))}
                    </div>

                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                    {/* Date for normal mode */}
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>📅 TANGGAL</label>
                    <DatePicker value={txForm.date} onChange={date => setTxForm(p => ({ ...p, date }))} />
                </>
            )}

            <button onClick={handleSubmit} disabled={(!canSubmit && !editMode) || isSaving}
                style={{
                    width: "100%", padding: 13, borderRadius: 12, border: "none",
                    background: ((!canSubmit && !editMode) || isSaving)
                        ? "rgba(255,255,255,.07)"
                        : editMode
                            ? "linear-gradient(135deg,#60fcc6,#19ce9b)"
                            : isTransfer
                                ? "linear-gradient(135deg,#06b6d4,#0891b2)"
                                : "linear-gradient(135deg,#60fcc6,#19ce9b)",
                    color: ((!canSubmit && !editMode) || isSaving) ? "#94a3b8" : isTransfer ? "#fff" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13,
                    cursor: ((!canSubmit && !editMode) || isSaving) ? "not-allowed" : "pointer",
                    opacity: ((!canSubmit && !editMode) || isSaving) ? .5 : 1,
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "opacity .2s, background .2s",
                }}
            >
                {isSaving && (
                    <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                )}
                {submitLabel}
            </button>
        </div>
    </Modal>
    );
};

export default AddTransactionModal;
