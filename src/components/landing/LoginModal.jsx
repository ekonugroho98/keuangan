import Modal from "../ui/Modal";
import InputField from "../ui/InputField";

const LoginModal = ({ open, onClose, form, setForm, errors, onSubmit, isLoading, onSwitchToSignup }) => (
    <Modal open={open} onClose={onClose}>
        <div style={{ background: "linear-gradient(135deg,#0f0f1e,#1a1a2e)", borderRadius: 24, border: "1px solid rgba(99,102,241,.2)", padding: "32px 28px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Selamat Datang! 👋</h2>
                        <p style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Masuk ke akun lu</p>
                    </div>
                    <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>

                <InputField label="EMAIL" icon="📧" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} error={errors.email} />
                <InputField label="PASSWORD" icon="🔒" type="password" placeholder="Password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} error={errors.password} />

                <button
                    className="btn-primary"
                    onClick={onSubmit}
                    disabled={isLoading}
                    style={{ width: "100%", padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                    {isLoading ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />Masuk...</> : "Masuk →"}
                </button>

                <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                    <span style={{ color: "#64748b", fontSize: 12 }}>Belum punya akun? </span>
                    <button className="link-btn" onClick={onSwitchToSignup}>Daftar gratis</button>
                </div>
            </div>
        </div>
    </Modal>
);

export default LoginModal;
