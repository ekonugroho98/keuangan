import { useState } from "react";
import Modal from "../ui/Modal";

const calcPasswordStrength = (pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
};

const STRENGTH_LABEL = ["", "Lemah", "Sedang", "Kuat", "Sangat kuat"];
const STRENGTH_COLOR = [
    "var(--glass-border)",
    "var(--color-expense)",
    "var(--color-amber)",
    "var(--color-primary)",
    "var(--color-primary-deep)",
];

const SignupModal = ({ open, onClose, form, setForm, errors, setErrors, step, setStep, onSubmit, isLoading, onSwitchToLogin }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const validateStep1 = () => {
        const err = {};
        if (!form.name.trim()) err.name = "Wajib";
        if (!form.email.trim()) err.email = "Wajib";
        else if (!/\S+@\S+\.\S+/.test(form.email)) err.email = "Format email salah";
        return err;
    };

    const strength = calcPasswordStrength(form.password || "");

    const handleFocus = e => {
        e.target.style.borderColor = "var(--color-primary)";
        e.target.style.background = "var(--color-primary-soft)";
    };
    const handleBlur = e => {
        e.target.style.borderColor = "var(--glass-border)";
        e.target.style.background = "rgba(255,255,255,.03)";
    };

    const labelStyle = {
        fontSize: 11, fontWeight: 700,
        color: "var(--color-subtle)",
        textTransform: "uppercase",
        letterSpacing: 1.4,
        display: "block", marginBottom: 8,
    };

    const inputStyle = (hasError) => ({
        width: "100%", padding: "14px 16px", fontSize: 15,
        borderRadius: 14,
        border: `1px solid ${hasError ? "var(--color-expense)" : "var(--glass-border)"}`,
        background: "rgba(255,255,255,.03)",
        color: "var(--color-text)",
        fontFamily: "inherit", outline: "none",
        minHeight: 48,
        transition: "all .2s",
        boxSizing: "border-box",
    });

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
                    <div style={{ position: "absolute", top: -120, left: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,252,198,.2), transparent 70%)", pointerEvents: "none", filter: "blur(12px)" }} />
                    <div style={{ position: "absolute", bottom: -140, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,.15), transparent 70%)", pointerEvents: "none", filter: "blur(14px)" }} />

                    {/* Close */}
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
                        <div style={{ textAlign: "center", marginBottom: 20 }}>
                            <div style={{
                                width: 56, height: 56, margin: "0 auto 16px",
                                borderRadius: 18,
                                background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 26,
                                boxShadow: "0 8px 24px rgba(96,252,198,.3), inset 0 1px 0 rgba(255,255,255,.35)",
                            }}>✨</div>
                            <h2 style={{
                                fontSize: "clamp(22px, 3vw, 28px)",
                                fontWeight: 900,
                                color: "var(--color-text)",
                                letterSpacing: "-.03em",
                                margin: 0,
                            }}>Daftar gratis</h2>
                            <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                                {step === 1 ? "Kenalan dulu yuk 🚀" : "Amanin akun lu dengan password 🔒"}
                            </p>
                        </div>

                        {/* Progress dots */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
                            {[1, 2].map(s => {
                                const active = step === s;
                                const done = step > s;
                                return (
                                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{
                                            width: active ? 26 : 10,
                                            height: 10,
                                            borderRadius: 5,
                                            background: done || active
                                                ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))"
                                                : "rgba(255,255,255,.12)",
                                            boxShadow: active ? "0 0 12px rgba(96,252,198,.5)" : "none",
                                            transition: "all .3s",
                                        }} />
                                    </div>
                                );
                            })}
                            <span style={{ fontSize: 11, color: "var(--color-subtle)", fontWeight: 700, letterSpacing: 1, marginLeft: 6 }}>
                                STEP {step}/2
                            </span>
                        </div>

                        {step === 1 ? (
                            <div style={{ animation: "slideUp .3s" }}>
                                {/* Name */}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={labelStyle}>Nama lengkap</label>
                                    <input
                                        type="text"
                                        placeholder="Nama lu"
                                        value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                        style={inputStyle(!!errors.name)}
                                    />
                                    {errors.name && (
                                        <div style={{ fontSize: 12, color: "var(--color-expense)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>⚠</span>{errors.name}
                                        </div>
                                    )}
                                </div>

                                {/* Email */}
                                <div style={{ marginBottom: 20 }}>
                                    <label style={labelStyle}>Email</label>
                                    <input
                                        type="email"
                                        placeholder="email@example.com"
                                        value={form.email}
                                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                        style={inputStyle(!!errors.email)}
                                    />
                                    {errors.email && (
                                        <div style={{ fontSize: 12, color: "var(--color-expense)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>⚠</span>{errors.email}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        const err = validateStep1();
                                        if (Object.keys(err).length) { setErrors(err); return; }
                                        setErrors({});
                                        setStep(2);
                                    }}
                                    style={{ width: "100%", minHeight: 50, fontSize: 15 }}
                                >Lanjut →</button>
                            </div>
                        ) : (
                            <div style={{ animation: "slideUp .3s" }}>
                                {/* Password */}
                                <div style={{ marginBottom: 12 }}>
                                    <label style={labelStyle}>Password</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Min 8 karakter"
                                            value={form.password}
                                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            style={{ ...inputStyle(!!errors.password), paddingRight: 52 }}
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

                                {/* Strength meter */}
                                {form.password && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} style={{
                                                    flex: 1, height: 4, borderRadius: 2,
                                                    background: i <= strength ? STRENGTH_COLOR[strength] : "rgba(255,255,255,.08)",
                                                    transition: "background .2s",
                                                }} />
                                            ))}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--color-subtle)", display: "flex", justifyContent: "space-between" }}>
                                            <span>Kekuatan password</span>
                                            <span style={{ color: STRENGTH_COLOR[strength], fontWeight: 700 }}>{STRENGTH_LABEL[strength]}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Confirm */}
                                <div style={{ marginBottom: 20 }}>
                                    <label style={labelStyle}>Konfirmasi password</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showConfirm ? "text" : "password"}
                                            placeholder="Ketik ulang"
                                            value={form.confirmPassword}
                                            onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            style={{ ...inputStyle(!!errors.confirmPassword), paddingRight: 52 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm(s => !s)}
                                            aria-label={showConfirm ? "Hide password" : "Show password"}
                                            style={{
                                                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                                background: "transparent", border: "none",
                                                color: "var(--color-muted)",
                                                width: 36, height: 36, borderRadius: 10,
                                                cursor: "pointer", fontSize: 16,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}
                                        >{showConfirm ? "🙈" : "👁"}</button>
                                    </div>
                                    {errors.confirmPassword && (
                                        <div style={{ fontSize: 12, color: "var(--color-expense)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>⚠</span>{errors.confirmPassword}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setStep(1)}
                                        style={{ flex: 1, minHeight: 50, fontSize: 15 }}
                                    >← Kembali</button>
                                    <button
                                        className="btn-primary"
                                        onClick={onSubmit}
                                        disabled={isLoading}
                                        style={{ flex: 2, minHeight: 50, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                                    >
                                        {isLoading
                                            ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />Memproses...</>
                                            : "Daftar sekarang"}
                                    </button>
                                </div>

                                <p style={{ fontSize: 11, color: "var(--color-subtle)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
                                    Dengan daftar, lu setuju dengan <span style={{ color: "var(--color-muted)", fontWeight: 600 }}>Syarat & Ketentuan</span> serta <span style={{ color: "var(--color-muted)", fontWeight: 600 }}>Kebijakan Privasi</span> kami.
                                </p>
                            </div>
                        )}

                        {/* Divider + switch */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 16px" }}>
                            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                            <span style={{ fontSize: 11, color: "var(--color-subtle)", fontWeight: 600, letterSpacing: 1 }}>ATAU</span>
                            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
                        </div>

                        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-muted)" }}>
                            Sudah punya akun? <button className="link-btn" onClick={onSwitchToLogin}>Masuk →</button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default SignupModal;
