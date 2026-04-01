import Modal from "../ui/Modal";

const DemoModal = ({ open, onClose, onSignup }) => (
    <Modal open={open} onClose={onClose}>
        <div style={{ background: "linear-gradient(135deg,#13131a,#1f1f28)", borderRadius: "20px 20px 0 0", border: "1px solid rgba(96,252,198,.2)", borderBottom: "none", padding: "28px 20px 36px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Preview Dashboard ✨</h2>
                <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#acaab4", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 14, padding: 18, border: "1px solid rgba(255,255,255,.06)", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#76747e", fontWeight: 600 }}>TOTAL BALANCE</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>Rp 9.270.000</div>
                <div style={{ fontSize: 11, color: "#60fcc6", marginBottom: 16 }}>↑ Saving rate 27%</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[{ l: "Income", v: "Rp 10.5jt", c: "#60fcc6" }, { l: "Expense", v: "Rp 2.8jt", c: "#ff716c" }, { l: "Goals", v: "3 aktif", c: "#60fcc6" }].map((m, i) => (
                        <div key={i} style={{ background: "rgba(255,255,255,.03)", borderRadius: 10, padding: 10, textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: m.c }}>{m.v}</div>
                            <div style={{ fontSize: 9, color: "#76747e" }}>{m.l}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" onClick={onClose} style={{ flex: 1, padding: 11, fontSize: 12 }}>Tutup</button>
                <button className="btn-primary" onClick={() => { onClose(); onSignup(); }} style={{ flex: 2, padding: 11, fontSize: 12 }}>Coba Sekarang →</button>
            </div>
        </div>
    </Modal>
);

export default DemoModal;
