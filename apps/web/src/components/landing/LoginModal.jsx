import { useState } from "react";
import Modal from "../ui/Modal";
import GoogleAuthButton from "./GoogleAuthButton";

const LoginModal = ({ open, onClose, form, setForm, errors, onSubmit, isLoading, onSwitchToSignup, onForgotPassword, redirectTo }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [oauthError, setOauthError] = useState("");

    const handleFocus = e => {
        e.target.style.borderColor = "#3F5142";
        e.target.style.background = "#FFFDF9";
    };
    const handleBlur = e => {
        e.target.style.borderColor = "#E5DEC9";
        e.target.style.background = "#F7F3EB";
    };

    const hasTopError = errors.general || errors.auth || oauthError;

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
                    {/* Close button */}
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
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
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
                            }}>Masuk ke Akun Keluarga</h2>
                            <p style={{ fontSize: 14, color: "#4A584D", marginTop: 6 }}>
                                Buka buku kas rumah tangga dan anggaran bersama pasangan.
                            </p>
                        </div>

                        {/* Top-level error banner */}
                        {hasTopError && (
                            <div style={{ width: "100%", marginBottom: 16, padding: "10px 14px", borderRadius: 12, background: "#FDF2F0", border: "1px solid #E6B3A8", color: "#9E3B24", fontSize: 13, fontWeight: 600 }}>
                                {errors.general || errors.auth || oauthError}
                            </div>
                        )}

                        {/* Google OAuth 1-Click */}
                        <GoogleAuthButton
                            label="Masuk dengan Google"
                            redirectTo={redirectTo}
                            onError={(msg) => setOauthError(msg)}
                        />

                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                            <span style={{ fontSize: 11, color: "#4A584D", fontWeight: 700, letterSpacing: "0.08em" }}>ATAU DENGAN EMAIL</span>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                        </div>

                        {/* Email */}
                        <div style={{ marginBottom: 16 }}>
                            <label htmlFor="login-email" style={{
                                fontSize: 12, fontWeight: 700,
                                color: "#4A584D",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                display: "block", marginBottom: 8,
                            }}>Alamat Email</label>
                            <input
                                id="login-email"
                                type="email"
                                placeholder="nama@keluarga.com"
                                value={form.email}
                                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                style={{
                                    width: "100%", padding: "13px 16px", fontSize: 15,
                                    borderRadius: 12,
                                    border: `1px solid ${errors.email ? "#B83B2A" : "#E5DEC9"}`,
                                    background: "#F7F3EB",
                                    color: "#1F2922",
                                    fontFamily: "inherit", outline: "none",
                                    minHeight: 48,
                                    transition: "all .2s",
                                    boxSizing: "border-box",
                                }}
                            />
                            {errors.email && (
                                <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 6 }}>
                                    {errors.email}
                                </div>
                            )}
                        </div>

                        {/* Password with show/hide */}
                        <div style={{ marginBottom: 8 }}>
                            <label htmlFor="login-password" style={{
                                fontSize: 12, fontWeight: 700,
                                color: "#4A584D",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                display: "block", marginBottom: 8,
                            }}>Kata Sandi</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Masukkan kata sandi"
                                    value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    style={{
                                        width: "100%", padding: "13px 68px 13px 16px", fontSize: 15,
                                        borderRadius: 12,
                                        border: `1px solid ${errors.password ? "#B83B2A" : "#E5DEC9"}`,
                                        background: "#F7F3EB",
                                        color: "#1F2922",
                                        fontFamily: "inherit", outline: "none",
                                        minHeight: 48,
                                        transition: "all .2s",
                                        boxSizing: "border-box",
                                    }}
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

                        {/* Forgot password */}
                        <div style={{ textAlign: "right", marginBottom: 20 }}>
                            <button
                                type="button"
                                onClick={onForgotPassword}
                                style={{ background: "none", border: "none", color: "#3F5142", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "6px 0", minHeight: 36 }}
                            >
                                Lupa kata sandi?
                            </button>
                        </div>

                        {/* Primary CTA */}
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={isLoading}
                            style={{
                                width: "100%", marginTop: 4, minHeight: 48, fontSize: 15, fontWeight: 700,
                                background: "#3F5142", color: "#FFFDF9", border: "none", borderRadius: 12,
                                cursor: isLoading ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                fontFamily: "'Fredoka', sans-serif",
                            }}
                        >
                            {isLoading ? "Memverifikasi akun..." : "Masuk ke Dasbor Keluarga"}
                        </button>

                        {/* Divider + switch */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                            <span style={{ fontSize: 11, color: "#4A584D", fontWeight: 700, letterSpacing: "0.08em" }}>ATAU</span>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                        </div>

                        <div style={{ textAlign: "center", fontSize: 14, color: "#4A584D" }}>
                            Belum punya akun keluarga?{" "}
                            <button
                                type="button"
                                onClick={onSwitchToSignup}
                                style={{ background: "none", border: "none", color: "#3F5142", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: "4px" }}
                            >
                                Buat Akun Baru
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default LoginModal;
