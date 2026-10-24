import { useState } from "react";
import Modal from "../ui/Modal";
import GoogleAuthButton from "./GoogleAuthButton";

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
    "#E5DEC9",
    "#B83B2A",
    "#9E472D",
    "#3F5142",
    "#2E3D30",
];

const SignupModal = ({ open, onClose, form, setForm, errors, setErrors, step, setStep, onSubmit, isLoading, onSwitchToLogin, redirectTo }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [oauthError, setOauthError] = useState("");

    const validateStep1 = () => {
        const err = {};
        if (!form.name.trim()) err.name = "Nama wajib diisi";
        if (!form.email.trim()) err.email = "Email wajib diisi";
        else if (!/\S+@\S+\.\S+/.test(form.email)) err.email = "Format email tidak valid";
        return err;
    };

    const strength = calcPasswordStrength(form.password || "");

    const handleFocus = e => {
        e.target.style.borderColor = "#3F5142";
        e.target.style.background = "#FFFDF9";
    };
    const handleBlur = e => {
        e.target.style.borderColor = "#E5DEC9";
        e.target.style.background = "#F7F3EB";
    };

    const labelStyle = {
        fontSize: 12, fontWeight: 700,
        color: "#4A584D",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        display: "block", marginBottom: 8,
    };

    const inputStyle = (hasError) => ({
        width: "100%", padding: "13px 16px", fontSize: 15,
        borderRadius: 12,
        border: `1px solid ${hasError ? "#B83B2A" : "#E5DEC9"}`,
        background: "#F7F3EB",
        color: "#1F2922",
        fontFamily: "inherit", outline: "none",
        minHeight: 48,
        transition: "all .2s",
        boxSizing: "border-box",
    });

    return (
        <Modal open={open} onClose={onClose}>
            {({ isDesktop }) => (
                <div style={{
                    background: "#FFFDF9",
                    border: "1px solid #E5DEC9",
                    borderRadius: isDesktop ? 24 : "24px 24px 0 0",
                    padding: isDesktop ? "36px 36px 32px" : "28px 22px calc(32px + env(safe-area-inset-bottom))",
                    maxHeight: "92vh", overflowY: "auto",
                    boxShadow: "0 24px 64px rgba(31, 41, 34, 0.25)",
                    position: "relative", overflow: "hidden",
                    color: "#1F2922",
                }}>
                    {/* Close */}
                    <button
                        onClick={onClose}
                        aria-label="Tutup dialog"
                        style={{
                            position: "absolute", top: 14, right: 14, zIndex: 3,
                            background: "#F7F3EB",
                            border: "1px solid #E5DEC9",
                            color: "#4A584D",
                            width: 44, height: 44, borderRadius: 12,
                            cursor: "pointer", fontSize: 16, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    >✕</button>

                    <div style={{ position: "relative", zIndex: 1 }}>
                        {/* Header */}
                        <div style={{ textAlign: "center", marginBottom: 20 }}>
                            <div style={{
                                width: 52, height: 52, margin: "0 auto 14px",
                                borderRadius: 16,
                                background: "#3F5142",
                                color: "#FFFDF9",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 22, fontWeight: 700,
                                fontFamily: "'Fredoka', sans-serif",
                            }}>KB</div>
                            <h2 style={{
                                fontSize: "clamp(22px, 3vw, 26px)",
                                fontWeight: 600,
                                color: "#1F2922",
                                letterSpacing: "-.02em",
                                margin: 0,
                                fontFamily: "'Fredoka', sans-serif",
                            }}>Buat Akun Keluarga</h2>
                            <p style={{ fontSize: 14, color: "#4A584D", marginTop: 6 }}>
                                {step === 1 ? "Mulai rapikan buku kas rumah tangga berdua." : "Buat kata sandi untuk mengamankan akun keluarga."}
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
                                            background: done || active ? "#3F5142" : "#E5DEC9",
                                            transition: "all .3s",
                                        }} />
                                    </div>
                                );
                            })}
                            <span style={{ fontSize: 11, color: "#4A584D", fontWeight: 700, letterSpacing: "0.06em", marginLeft: 6 }}>
                                TAHAP {step}/2
                            </span>
                        </div>

                        {step === 1 ? (
                            <div style={{ animation: "slideUp .25s" }}>
                                {oauthError && (
                                    <div style={{ width: "100%", marginBottom: 14, padding: "10px 14px", borderRadius: 12, background: "#FDF2F0", border: "1px solid #E6B3A8", color: "#9E3B24", fontSize: 13, fontWeight: 600 }}>
                                        {oauthError}
                                    </div>
                                )}

                                <GoogleAuthButton
                                    label="Daftar 1-Klik dengan Google"
                                    redirectTo={redirectTo}
                                    onError={(msg) => setOauthError(msg)}
                                />

                                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                                    <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                                    <span style={{ fontSize: 11, color: "#4A584D", fontWeight: 700, letterSpacing: "0.08em" }}>ATAU DAFTAR DENGAN EMAIL</span>
                                    <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                                </div>

                                {/* Name */}
                                <div style={{ marginBottom: 16 }}>
                                    <label htmlFor="signup-name" style={labelStyle}>Nama Panggilan / Lengkap</label>
                                    <input
                                        id="signup-name"
                                        type="text"
                                        placeholder="Contoh: Budi & Siti"
                                        value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                        style={inputStyle(!!errors.name)}
                                    />
                                    {errors.name && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 6 }}>
                                            {errors.name}
                                        </div>
                                    )}
                                </div>

                                {/* Email */}
                                <div style={{ marginBottom: 20 }}>
                                    <label htmlFor="signup-email" style={labelStyle}>Alamat Email</label>
                                    <input
                                        id="signup-email"
                                        type="email"
                                        placeholder="nama@keluarga.com"
                                        value={form.email}
                                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                        style={inputStyle(!!errors.email)}
                                    />
                                    {errors.email && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 6 }}>
                                            {errors.email}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const err = validateStep1();
                                        if (Object.keys(err).length) { setErrors(err); return; }
                                        setErrors({});
                                        setStep(2);
                                    }}
                                    style={{
                                        width: "100%", minHeight: 48, fontSize: 15, fontWeight: 700,
                                        background: "#3F5142", color: "#FFFDF9", border: "none", borderRadius: 12,
                                        cursor: "pointer", fontFamily: "'Fredoka', sans-serif",
                                    }}
                                >Lanjut ke Kata Sandi</button>
                            </div>
                        ) : (
                            <div style={{ animation: "slideUp .25s" }}>
                                {/* Password */}
                                <div style={{ marginBottom: 12 }}>
                                    <label htmlFor="signup-password" style={labelStyle}>Kata Sandi Baru</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            id="signup-password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Minimal 8 karakter"
                                            value={form.password}
                                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            style={{ ...inputStyle(!!errors.password), paddingRight: 68 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(s => !s)}
                                            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                            style={{
                                                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                                                background: "transparent", border: "none",
                                                color: "#3F5142",
                                                minWidth: 44, minHeight: 44, padding: "0 8px", borderRadius: 8,
                                                cursor: "pointer", fontSize: 12, fontWeight: 700,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}
                                        >{showPassword ? "Tutup" : "Lihat"}</button>
                                    </div>
                                    {errors.password && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 6 }}>
                                            {errors.password}
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
                                                    background: i <= strength ? STRENGTH_COLOR[strength] : "#E5DEC9",
                                                    transition: "background .2s",
                                                }} />
                                            ))}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#4A584D", display: "flex", justifyContent: "space-between" }}>
                                            <span>Kekuatan kata sandi</span>
                                            <span style={{ color: STRENGTH_COLOR[strength], fontWeight: 700 }}>{STRENGTH_LABEL[strength]}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Confirm */}
                                <div style={{ marginBottom: 20 }}>
                                    <label htmlFor="signup-confirm" style={labelStyle}>Konfirmasi Kata Sandi</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            id="signup-confirm"
                                            type={showConfirm ? "text" : "password"}
                                            placeholder="Ketik ulang kata sandi"
                                            value={form.confirmPassword}
                                            onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            style={{ ...inputStyle(!!errors.confirmPassword), paddingRight: 68 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm(s => !s)}
                                            aria-label={showConfirm ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                            style={{
                                                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                                                background: "transparent", border: "none",
                                                color: "#3F5142",
                                                minWidth: 44, minHeight: 44, padding: "0 8px", borderRadius: 8,
                                                cursor: "pointer", fontSize: 12, fontWeight: 700,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}
                                        >{showConfirm ? "Tutup" : "Lihat"}</button>
                                    </div>
                                    {errors.confirmPassword && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 6 }}>
                                            {errors.confirmPassword}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        style={{
                                            flex: 1, minHeight: 48, fontSize: 14, fontWeight: 700,
                                            background: "#F7F3EB", color: "#1F2922", border: "1px solid #D5CCB8", borderRadius: 12,
                                            cursor: "pointer",
                                        }}
                                    >Kembali</button>
                                    <button
                                        type="button"
                                        onClick={onSubmit}
                                        disabled={isLoading}
                                        style={{
                                            flex: 2, minHeight: 48, fontSize: 15, fontWeight: 700,
                                            background: "#3F5142", color: "#FFFDF9", border: "none", borderRadius: 12,
                                            cursor: isLoading ? "not-allowed" : "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                            fontFamily: "'Fredoka', sans-serif",
                                        }}
                                    >
                                        {isLoading ? "Memproses..." : "Buat Akun Keluarga"}
                                    </button>
                                </div>

                                <p style={{ fontSize: 12, color: "#4A584D", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
                                    Dengan mendaftar, Anda menyetujui{" "}
                                    <a href="/tos" style={{ color: "#3F5142", fontWeight: 700, textDecoration: "underline" }}>Syarat & Ketentuan</a>{" "}
                                    serta{" "}
                                    <a href="/privacy" style={{ color: "#3F5142", fontWeight: 700, textDecoration: "underline" }}>Kebijakan Privasi</a>{" "}
                                    Keluarga Berkembang.
                                </p>
                            </div>
                        )}

                        {/* Divider + switch */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 16px" }}>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                            <span style={{ fontSize: 11, color: "#4A584D", fontWeight: 700, letterSpacing: "0.08em" }}>ATAU</span>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                        </div>

                        <div style={{ textAlign: "center", fontSize: 14, color: "#4A584D" }}>
                            Sudah punya akun?{" "}
                            <button
                                type="button"
                                onClick={onSwitchToLogin}
                                style={{ background: "none", border: "none", color: "#3F5142", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: "4px" }}
                            >
                                Masuk di Sini
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default SignupModal;
