import { useState } from "react";
import Modal from "../ui/Modal";
import InputField from "../ui/InputField";

const ForgotPasswordModal = ({ open, onClose, onBackToLogin }) => {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleClose = () => {
        setEmail("");
        setError("");
        setSent(false);
        onClose();
    };

    const handleSubmit = async () => {
        if (!email.trim()) { setError("Email wajib diisi"); return; }
        if (!/\S+@\S+\.\S+/.test(email)) { setError("Format email tidak valid"); return; }
        setError("");
        setIsLoading(true);

        const { supabase } = await import("../../lib/supabase");
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        setIsLoading(false);

        if (err) { setError(err.message); return; }
        setSent(true);
    };

    return (
        <Modal open={open} onClose={handleClose}>
            {({ isDesktop }) => (
                <div style={{
                    background: "linear-gradient(135deg,#13131a,#1f1f28)",
                    borderRadius: isDesktop ? 20 : "20px 20px 0 0",
                    border: "1px solid var(--color-border)",
                    borderBottom: isDesktop ? "1px solid rgba(96,252,198,.2)" : "none",
                    padding: "28px 20px 36px",
                    position: "relative", overflow: "hidden",
                }}>
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                            <div>
                                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
                                    {sent ? "Email Terkirim! 📧" : "Lupa Password? 🔑"}
                                </h2>
                                <p style={{ color: "#76747e", fontSize: 12, marginTop: 4 }}>
                                    {sent ? "Cek inbox atau spam kamu" : "Reset password via email"}
                                </p>
                            </div>
                            <button onClick={handleClose} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {sent ? (
                            <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
                                <p style={{ color: "var(--color-text)", fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
                                    Link reset password sudah dikirim ke
                                </p>
                                <p style={{ color: "var(--color-primary)", fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
                                    {email}
                                </p>
                                <p style={{ color: "#76747e", fontSize: 12, lineHeight: 1.5 }}>
                                    Klik link di email untuk membuat password baru. Kalau tidak ada di inbox, cek folder spam.
                                </p>
                            </div>
                        ) : (
                            <InputField
                                label="EMAIL"
                                icon="📧"
                                type="email"
                                placeholder="email@example.com"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(""); }}
                                error={error}
                            />
                        )}

                        {!sent && (
                            <button
                                className="btn-primary"
                                onClick={handleSubmit}
                                disabled={isLoading}
                                style={{ width: "100%", padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                            >
                                {isLoading
                                    ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />Mengirim...</>
                                    : "Kirim Link Reset →"}
                            </button>
                        )}

                        <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                            <button className="link-btn" onClick={() => { handleClose(); onBackToLogin(); }}>
                                ← Kembali ke Login
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ForgotPasswordModal;
