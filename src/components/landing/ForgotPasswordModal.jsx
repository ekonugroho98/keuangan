import { useState } from "react";
import Modal from "../ui/Modal";

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

    const handleFocus = e => {
        e.target.style.borderColor = "var(--color-primary)";
        e.target.style.background = "var(--color-primary-soft)";
    };
    const handleBlur = e => {
        e.target.style.borderColor = error ? "var(--color-expense)" : "var(--glass-border)";
        e.target.style.background = "rgba(255,255,255,.03)";
    };

    return (
        <Modal open={open} onClose={handleClose}>
            {({ isDesktop }) => (
                <div style={{
                    background: "var(--glass-hero)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: isDesktop ? 28 : "28px 28px 0 0",
                    padding: isDesktop ? "36px 36px 32px" : "28px 22px calc(32px + env(safe-area-inset-bottom))",
                    maxHeight: "92vh", overflowY: "auto",
                    boxShadow: "var(--glass-highlight), 0 32px 80px rgba(0,0,0,.45)",
                    position: "relative", overflow: "hidden",
                }}>
                    {/* Ambient aurora orbs */}
                    <div style={{ position: "absolute", top: -110, right: -70, width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,.14), transparent 70%)", pointerEvents: "none", filter: "blur(12px)" }} />
                    <div style={{ position: "absolute", bottom: -120, left: -70, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,252,198,.14), transparent 70%)", pointerEvents: "none", filter: "blur(12px)" }} />

                    {/* Close */}
                    <button
                        onClick={handleClose}
                        aria-label="Close"
                        style={{
                            position: "absolute", top: 16, right: 16, zIndex: 3,
                            background: "rgba(255,255,255,.06)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--color-muted)",
                            width: 34, height: 34, borderRadius: 12,
                            cursor: "pointer", fontSize: 16,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    >✕</button>

                    <div style={{ position: "relative", zIndex: 1 }}>
                        {/* Header */}
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                            <div style={{
                                width: 56, height: 56, margin: "0 auto 16px",
                                borderRadius: 18,
                                background: sent
                                    ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))"
                                    : "linear-gradient(135deg, var(--color-amber), #f59e0b)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 26,
                                boxShadow: sent
                                    ? "0 8px 24px rgba(96,252,198,.3), inset 0 1px 0 rgba(255,255,255,.35)"
                                    : "0 8px 24px rgba(251,191,36,.3), inset 0 1px 0 rgba(255,255,255,.35)",
                            }}>{sent ? "✉️" : "🔑"}</div>
                            <h2 style={{
                                fontSize: "clamp(22px, 3vw, 28px)",
                                fontWeight: 900,
                                color: "var(--color-text)",
                                letterSpacing: "-.03em",
                                margin: 0,
                            }}>{sent ? "Cek email kamu" : "Lupa password?"}</h2>
                            <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.5 }}>
                                {sent
                                    ? "Link reset sudah dikirim. Cek inbox atau folder spam."
                                    : "Masukin email yang terdaftar, kita kirim link buat reset password."}
                            </p>
                        </div>

                        {sent ? (
                            <div>
                                <div className="chip chip-mint" style={{ width: "100%", padding: "14px 16px", justifyContent: "flex-start", marginBottom: 16 }}>
                                    <span style={{ marginRight: 8 }}>✓</span>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>Email terkirim</span>
                                </div>
                                <div style={{
                                    padding: 16, borderRadius: 16,
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--glass-border)",
                                    textAlign: "center", marginBottom: 20,
                                }}>
                                    <p style={{ color: "var(--color-muted)", fontSize: 12, margin: 0, marginBottom: 6 }}>
                                        Link dikirim ke
                                    </p>
                                    <p style={{ color: "var(--color-primary)", fontSize: 14, fontWeight: 800, margin: 0, wordBreak: "break-all" }}>
                                        {email}
                                    </p>
                                </div>
                                <p style={{ fontSize: 12, color: "var(--color-subtle)", lineHeight: 1.5, textAlign: "center", marginBottom: 0 }}>
                                    Klik link di email untuk membuat password baru.
                                    Kalau belum masuk dalam 2 menit, cek folder spam.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{
                                        fontSize: 11, fontWeight: 700,
                                        color: "var(--color-subtle)",
                                        textTransform: "uppercase",
                                        letterSpacing: 1.4,
                                        display: "block", marginBottom: 8,
                                    }}>Email</label>
                                    <input
                                        type="email"
                                        placeholder="email@example.com"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(""); }}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                        style={{
                                            width: "100%", padding: "14px 16px", fontSize: 15,
                                            borderRadius: 14,
                                            border: `1px solid ${error ? "var(--color-expense)" : "var(--glass-border)"}`,
                                            background: "rgba(255,255,255,.03)",
                                            color: "var(--color-text)",
                                            fontFamily: "inherit", outline: "none",
                                            minHeight: 48,
                                            transition: "all .2s",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    {error && (
                                        <div style={{ fontSize: 12, color: "var(--color-expense)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>⚠</span>{error}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="btn-primary"
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                    style={{ width: "100%", minHeight: 50, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                                >
                                    {isLoading
                                        ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />Mengirim...</>
                                        : "Kirim link reset"}
                                </button>
                            </>
                        )}

                        {/* Divider + back */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 16px" }}>
                            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                            <span style={{ fontSize: 11, color: "var(--color-subtle)", fontWeight: 600, letterSpacing: 1 }}>ATAU</span>
                            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                        </div>

                        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-muted)" }}>
                            <button
                                className="link-btn"
                                onClick={() => { handleClose(); onBackToLogin(); }}
                            >← Kembali ke login</button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ForgotPasswordModal;
