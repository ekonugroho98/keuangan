import Modal from "../ui/Modal";
import InputField from "../ui/InputField";

const AddAccountModal = ({ open, onClose, accForm, setAccForm, onSubmit }) => (
    <Modal open={open} onClose={onClose}>
        <div style={{ background: "linear-gradient(135deg,#0f0f1e,#1a1a2e)", borderRadius: "20px 20px 0 0", border: "1px solid rgba(99,102,241,.2)", borderBottom: "none", padding: "24px 20px 36px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Tambah Akun</h3>
                <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <InputField label="NAMA AKUN" icon="🏷️" placeholder="contoh: BCA, GoPay, Cash" value={accForm.name} onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))} />

            <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block" }}>TIPE</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[{ v: "bank", l: "🏦 Bank" }, { v: "ewallet", l: "📱 E-Wallet" }, { v: "cash", l: "💵 Cash" }, { v: "crypto", l: "₿ Crypto" }].map(t => (
                    <button
                        key={t.v}
                        onClick={() => setAccForm(p => ({ ...p, type: t.v }))}
                        style={{
                            padding: "6px 14px", borderRadius: 8,
                            border: `1px solid ${accForm.type === t.v ? "#6366f155" : "rgba(255,255,255,.06)"}`,
                            background: accForm.type === t.v ? "rgba(99,102,241,.15)" : "transparent",
                            color: accForm.type === t.v ? "#818cf8" : "#94a3b8",
                            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        }}
                    >{t.l}</button>
                ))}
            </div>

            <InputField label="SALDO AWAL (Rp)" icon="💰" type="number" placeholder="0" value={accForm.balance} onChange={e => setAccForm(p => ({ ...p, balance: e.target.value }))} />

            <button
                onClick={onSubmit}
                disabled={!accForm.name || !accForm.balance}
                style={{
                    width: "100%", padding: 13, borderRadius: 12, border: "none",
                    background: !accForm.name || !accForm.balance ? "rgba(255,255,255,.05)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    color: "#fff", fontWeight: 700, fontSize: 13,
                    cursor: !accForm.name || !accForm.balance ? "not-allowed" : "pointer",
                    opacity: !accForm.name || !accForm.balance ? .4 : 1, fontFamily: "inherit",
                }}
            >Simpan Akun</button>
        </div>
    </Modal>
);

export default AddAccountModal;
