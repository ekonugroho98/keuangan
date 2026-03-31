import Modal from "../ui/Modal";
import InputField from "../ui/InputField";
import { expenseCategories, incomeCategories } from "../../constants/categories";

const TYPES = [
    { v: "expense", l: "Pengeluaran", c: "#ef4444" },
    { v: "income",  l: "Pemasukan",  c: "#10b981" },
    { v: "transfer", l: "Transfer",  c: "#06b6d4" },
];

const AddTransactionModal = ({ open, onClose, txForm, setTxForm, onSubmit, onTransfer, accounts, customCategories = [] }) => {
    const extraExpense = customCategories.filter(c => c.type !== "income").map(c => c.name);
    const extraIncome  = customCategories.filter(c => c.type !== "expense").map(c => c.name);
    const allExpense = [...expenseCategories, ...extraExpense];
    const allIncome  = [...incomeCategories,  ...extraIncome];

    const isTransfer = txForm.type === "transfer";
    const canSubmit = isTransfer
        ? txForm.amount && txForm.account && txForm.toAccount && txForm.account !== txForm.toAccount
        : !!txForm.amount;

    const handleSubmit = () => {
        if (isTransfer) onTransfer();
        else onSubmit();
    };

    return (
    <Modal open={open} onClose={onClose}>
        <div style={{ background: "linear-gradient(135deg,#0f0f1e,#1a1a2e)", borderRadius: 20, border: "1px solid rgba(99,102,241,.2)", padding: 28, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Tambah Transaksi</h3>
                <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Tipe */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {TYPES.map(t => (
                    <button key={t.v} onClick={() => setTxForm(p => ({ ...p, type: t.v, toAccount: "" }))}
                        style={{
                            flex: 1, padding: 10, borderRadius: 10,
                            border: `1px solid ${txForm.type === t.v ? t.c + "55" : "rgba(255,255,255,.06)"}`,
                            background: txForm.type === t.v ? t.c + "15" : "transparent",
                            color: txForm.type === t.v ? t.c : "#64748b",
                            fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                        }}
                    >{t.l}</button>
                ))}
            </div>

            {/* Jumlah */}
            <InputField label="JUMLAH (Rp)" icon="💰" type="number" placeholder="150000" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} />

            {isTransfer ? (
                /* ── Mode Transfer ── */
                <>
                    {/* Akun Asal */}
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block" }}>DARI AKUN</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => {
                            const selected = txForm.account === a.name;
                            const isDestination = txForm.toAccount === a.name;
                            return (
                                <button key={a.name}
                                    onClick={() => !isDestination && setTxForm(p => ({ ...p, account: a.name }))}
                                    disabled={isDestination}
                                    style={{
                                        padding: "6px 14px", borderRadius: 8,
                                        border: `1px solid ${selected ? "#06b6d455" : "rgba(255,255,255,.06)"}`,
                                        background: selected ? "rgba(6,182,212,.15)" : "transparent",
                                        color: selected ? "#06b6d4" : isDestination ? "#334155" : "#94a3b8",
                                        fontSize: 11, fontWeight: 600, cursor: isDestination ? "not-allowed" : "pointer", fontFamily: "inherit",
                                        opacity: isDestination ? 0.4 : 1,
                                    }}
                                >{a.icon} {a.name}</button>
                            );
                        })}
                    </div>

                    {/* Panah */}
                    <div style={{ textAlign: "center", fontSize: 20, marginBottom: 16, color: "#06b6d4" }}>↓</div>

                    {/* Akun Tujuan */}
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block" }}>KE AKUN</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => {
                            const selected = txForm.toAccount === a.name;
                            const isSource = txForm.account === a.name;
                            return (
                                <button key={a.name}
                                    onClick={() => !isSource && setTxForm(p => ({ ...p, toAccount: a.name }))}
                                    disabled={isSource}
                                    style={{
                                        padding: "6px 14px", borderRadius: 8,
                                        border: `1px solid ${selected ? "#10b98155" : "rgba(255,255,255,.06)"}`,
                                        background: selected ? "rgba(16,185,129,.15)" : "transparent",
                                        color: selected ? "#10b981" : isSource ? "#334155" : "#94a3b8",
                                        fontSize: 11, fontWeight: 600, cursor: isSource ? "not-allowed" : "pointer", fontFamily: "inherit",
                                        opacity: isSource ? 0.4 : 1,
                                    }}
                                >{a.icon} {a.name}</button>
                            );
                        })}
                    </div>

                    {/* Preview transfer */}
                    {txForm.account && txForm.toAccount && txForm.amount && (
                        <div style={{ background: "rgba(6,182,212,.08)", border: "1px solid rgba(6,182,212,.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>DARI</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{txForm.account}</div>
                                <div style={{ fontSize: 11, color: "#f87171" }}>-Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                            <div style={{ fontSize: 20 }}>→</div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>KE</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>{txForm.toAccount}</div>
                                <div style={{ fontSize: 11, color: "#10b981" }}>+Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                        </div>
                    )}

                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                </>
            ) : (
                /* ── Mode Normal ── */
                <>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block" }}>KATEGORI</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {(txForm.type === "expense" ? allExpense : allIncome).map(c => (
                            <button key={c} onClick={() => setTxForm(p => ({ ...p, category: c }))}
                                style={{
                                    padding: "6px 14px", borderRadius: 8,
                                    border: `1px solid ${txForm.category === c ? "#6366f155" : "rgba(255,255,255,.06)"}`,
                                    background: txForm.category === c ? "rgba(99,102,241,.15)" : "transparent",
                                    color: txForm.category === c ? "#818cf8" : "#94a3b8",
                                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                }}
                            >{c}</button>
                        ))}
                    </div>

                    <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block" }}>AKUN</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => (
                            <button key={a.name} onClick={() => setTxForm(p => ({ ...p, account: a.name }))}
                                style={{
                                    padding: "6px 14px", borderRadius: 8,
                                    border: `1px solid ${txForm.account === a.name ? a.color + "55" : "rgba(255,255,255,.06)"}`,
                                    background: txForm.account === a.name ? a.color + "15" : "transparent",
                                    color: txForm.account === a.name ? a.color : "#94a3b8",
                                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                }}
                            >{a.icon} {a.name}</button>
                        ))}
                    </div>

                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                </>
            )}

            <button onClick={handleSubmit} disabled={!canSubmit}
                style={{
                    width: "100%", padding: 13, borderRadius: 12, border: "none",
                    background: !canSubmit
                        ? "rgba(255,255,255,.05)"
                        : isTransfer
                            ? "linear-gradient(135deg,#06b6d4,#0891b2)"
                            : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    color: "#fff", fontWeight: 700, fontSize: 13,
                    cursor: !canSubmit ? "not-allowed" : "pointer",
                    opacity: !canSubmit ? .4 : 1, fontFamily: "inherit",
                }}
            >
                {isTransfer ? "🔄 Transfer Dana" : "Simpan Transaksi"}
            </button>
        </div>
    </Modal>
    );
};

export default AddTransactionModal;
