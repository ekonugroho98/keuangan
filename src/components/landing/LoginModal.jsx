import { useState } from "react";
import Modal from "../ui/Modal";

const LoginModal = ({ open, onClose, form, setForm, errors, onSubmit, isLoading, onSwitchToSignup, onForgotPassword }) => {
    const [showPassword, setShowPassword] = useState(false);

    const handleFocus = e => {
        e.target.style.borderColor = "var(--color-primary)";
        e.target.style.background = "var(--color-primary-soft)";
    };
    const handleBlur = e => {
        e.target.style.borderColor = "var(--glass-border)";
        e.target.style.background = "rgba(255,255,255,.03)";
    };

    const hasTopError = errors.general || errors.auth;

    return (
        <Modal open={open} onClose={onClose}>
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
                    <div style={{ position: "absolute", top: -100, right: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,252,198,.18), transparent 70%)", pointerEvents: "none", filter: "blur(10px)" }} />
                    <div style={{ position: "absolute", bottom: -120, left: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,.12), transparent 70%)", pointerEvents: "none", filter: "blur(12px)" }} />

                    {/* Close button */}
                    <button
                        onClick={onClose}
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
                                background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 26,
                                boxShadow: "0 8px 24px rgba(96,252,198,.3), inset 0 1px 0 rgba(255,255,255,.35)",
                            }}>🔐</div>
                            <h2 style={{
                                fontSize: "clamp(22px, 3vw, 28px)",
                                fontWeight: 900,
                                color: "var(--color-text)",
                                letterSpacing: "-.03em",
                                margin: 0,
                            }}>Masuk kembali</h2>
                            <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                                Welcome back, senang lihat lu lagi 👋
                            </p>
                        </div>

                        {/* Top-level error banner */}
                        {hasTopError && (
                            <div className="chip chip-red" style={{ width: "100%", marginBottom: 16, padding: "10px 14px", justifyContent: "flex-start" }}>
                                <span style={{ marginRight: 6 }}>⚠</span>
                                <span style={{ fontSize: 12 }}>{errors.general || errors.auth}</span>
                            </div>
                        )}

                        {/* Email */}
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
                                value={form.email}
                                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                style={{
                                    width: "100%", padding: "14px 16px", fontSize: 15,
                                    borderRadius: 14,
                                    border: `1px solid ${errors.email ? "var(--color-expense)" : "var(--glass-border)"}`,
                                    background: "rgba(255,255,255,.03)",
                                    color: "var(--color-text)",
                                    fontFamily: "inherit", outline: "none",
                                    minHeight: 48,
                                    transition: "all .2s",
                                    boxSizing: "border-box",
                                }}
                            />
                            {errors.email && (
                                <div style={{ fontSize: 12, color: "var(--color-expense)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>⚠</span>{errors.email}
                                </div>
                            )}
                        </div>

                        {/* Password with show/hide */}
                        <div style={{ marginBottom: 8 }}>
                            <label style={{
                                fontSize: 11, fontWeight: 700,
                                color: "var(--color-subtle)",
                                textTransform: "uppercase",
                                letterSpacing: 1.4,
                                display: "block", marginBottom: 8,
                            }}>Password</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    style={{
                                        width: "100%", padding: "14px 52px 14px 16px", fontSize: 15,
                                        borderRadius: 14,
                                        border: `1px solid ${errors.password ? "var(--color-expense)" : "var(--glass-border)"}`,
                                        background: "rgba(255,255,255,.03)",
                                        color: "var(--color-text)",
                                        fontFamily: "inherit", outline: "none",
                                        minHeight: 48,
                                        transition: "all .2s",
                                        boxSizing: "border-box",
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(s => !s)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    style={{
                                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                        background: "transparent", border: "none",
                                        color: "var(--color-muted)",
                                        width: 36, height: 36, borderRadius: 10,
                                        cursor: "pointer", fontSize: 16,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                >{showPassword ? "🙈" : "👁"}</button>
                            </div>
                            {errors.password && (
                                <div style={{ fontSize: 12, color: "var(--color-expense)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>⚠</span>{errors.password}
                                </div>
                            )}
                        </div>

                        {/* Forgot password */}
                        <div style={{ textAlign: "right", marginBottom: 20 }}>
                            <button className="link-btn" onClick={onForgotPassword} style={{ fontSize: 12 }}>
                                Lupa password?
                            </button>
                        </div>

                        {/* Primary CTA */}
                        <button
                            className="btn-primary"
                            onClick={onSubmit}
                            disabled={isLoading}
                            style={{ width: "100%", marginTop: 4, minHeight: 50, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                        >
                            {isLoading
                                ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />Memproses...</>
                                : "Masuk"}
                        </button>

                        {/* Divider + switch */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
                            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                            <span style={{ fontSize: 11, color: "var(--color-subtle)", fontWeight: 600, letterSpacing: 1 }}>ATAU</span>
                            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                        </div>

                        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-muted)" }}>
                            Belum punya akun? <button className="link-btn" onClick={onSwitchToSignup}>Daftar gratis →</button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default LoginModal;
