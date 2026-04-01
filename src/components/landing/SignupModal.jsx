import Modal from "../ui/Modal";
import InputField from "../ui/InputField";

const SignupModal = ({ open, onClose, form, setForm, errors, setErrors, step, setStep, onSubmit, isLoading, onSwitchToLogin, selectedPlan }) => {
    const validateStep1 = () => {
        const err = {};
        if (!form.name.trim()) err.name = "Wajib";
        if (!form.email.trim()) err.email = "Wajib";
        else if (!/\S+@\S+\.\S+/.test(form.email)) err.email = "Format email salah";
        return err;
    };

    return (
        <Modal open={open} onClose={onClose}>
            {({ isDesktop }) => (
                <div style={{
                    background: "linear-gradient(135deg,#13131a,#1f1f28)",
                    borderRadius: isDesktop ? 20 : "20px 20px 0 0",
                    border: "1px solid rgba(96,252,198,.2)",
                    borderBottom: isDesktop ? "1px solid rgba(96,252,198,.2)" : "none",
                    padding: "28px 20px 36px",
                    position: "relative", overflow: "hidden",
                }}>
                    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% 20%,rgba(96,252,198,.1),transparent 50%)", pointerEvents: "none" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <div>
                                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Daftar Gratis</h2>
                                <p style={{ color: "#76747e", fontSize: 12, marginTop: 4 }}>{selectedPlan ? `Paket: ${selectedPlan.name}` : "Mulai trial 14 hari"}</p>
                            </div>
                            <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        <div style={{ display: "flex", gap: 8, margin: "16px 0 24px" }}>
                            {[1, 2].map(s => <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? "linear-gradient(135deg,#60fcc6,#19ce9b)" : "rgba(255,255,255,.06)" }} />)}
                        </div>

                        {step === 1 ? (
                            <div style={{ animation: "slideUp .3s" }}>
                                <InputField label="NAMA LENGKAP" icon="👤" placeholder="Nama lu" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} error={errors.name} />
                                <InputField label="EMAIL" icon="📧" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} error={errors.email} />
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        const err = validateStep1();
                                        if (Object.keys(err).length) { setErrors(err); return; }
                                        setErrors({});
                                        setStep(2);
                                    }}
                                    style={{ width: "100%", padding: 13 }}
                                >Lanjut →</button>
                            </div>
                        ) : (
                            <div style={{ animation: "slideUp .3s" }}>
                                <InputField label="PASSWORD" icon="🔒" type="password" placeholder="Min 8 karakter" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} error={errors.password} />
                                <InputField label="KONFIRMASI" icon="🔒" type="password" placeholder="Ketik ulang" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button className="btn-secondary" onClick={() => setStep(1)} style={{ flex: 1, padding: 13 }}>←</button>
                                    <button
                                        className="btn-primary"
                                        onClick={onSubmit}
                                        disabled={isLoading}
                                        style={{ flex: 2, padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                                    >
                                        {isLoading
                                            ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />Proses...</>
                                            : "Buat Akun 🚀"}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                            <span style={{ color: "#76747e", fontSize: 12 }}>Sudah punya akun? </span>
                            <button className="link-btn" onClick={onSwitchToLogin}>Masuk</button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default SignupModal;
