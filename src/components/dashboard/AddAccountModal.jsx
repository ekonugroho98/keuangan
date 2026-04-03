import Modal from "../ui/Modal";
import InputField from "../ui/InputField";
import AmountInput from "../ui/AmountInput";

const AddAccountModal = ({ open, onClose, accForm, setAccForm, onSubmit }) => (
    <Modal open={open} onClose={onClose}>
        <div style={{ background: "var(--bg-surface-low)", borderRadius: "20px 20px 0 0", border: "1px solid var(--color-border)", borderBottom: "none", padding: "24px 20px 36px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>Tambah Akun</h3>
                <button onClick={onClose} style={{ background: "var(--color-border-soft)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <InputField label="NAMA AKUN" icon="🏷️" placeholder="contoh: BCA, GoPay, Cash" value={accForm.name} onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))} />

            <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block" }}>TIPE</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[{ v: "bank", l: "🏦 Bank" }, { v: "ewallet", l: "📱 E-Wallet" }, { v: "cash", l: "💵 Cash" }, { v: "tabungan", l: "🪙 Tabungan" }, { v: "crypto", l: "₿ Crypto" }].map(t => (
                    <button
                        key={t.v}
                        onClick={() => setAccForm(p => ({ ...p, type: t.v }))}
                        style={{
                            padding: "6px 14px", borderRadius: 8,
                            border: `1px solid ${accForm.type === t.v ? "#60fcc655" : "var(--color-border-soft)"}`,
                            background: accForm.type === t.v ? "rgba(96,252,198,.15)" : "transparent",
                            color: accForm.type === t.v ? "var(--color-primary)" : "var(--color-muted)",
                            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        }}
                    >{t.l}</button>
                ))}
            </div>

            <AmountInput label="SALDO AWAL (Rp)" icon="💰" placeholder="0" value={accForm.balance} onChange={v => setAccForm(p => ({ ...p, balance: v }))} />

            <button
                onClick={onSubmit}
                disabled={!accForm.name || !accForm.balance}
                style={{
                    width: "100%", padding: 13, borderRadius: 9999, border: "none",
                    background: !accForm.name || !accForm.balance ? "var(--color-border-soft)" : "linear-gradient(135deg,#60fcc6,#19ce9b)",
                    color: !accForm.name || !accForm.balance ? "#94a3b8" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13,
                    cursor: !accForm.name || !accForm.balance ? "not-allowed" : "pointer",
                    opacity: !accForm.name || !accForm.balance ? .4 : 1, fontFamily: "inherit",
                }}
            >Simpan Akun</button>
        </div>
    </Modal>
);

export default AddAccountModal;
