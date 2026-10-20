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
        e.target.style.borderColor = "#3F5142";
        e.target.style.background = "#FFFDF9";
    };
    const handleBlur = e => {
        e.target.style.borderColor = error ? "#B83B2A" : "#E5DEC9";
        e.target.style.background = "#F7F3EB";
    };

    return (
        <Modal open={open} onClose={handleClose}>
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
                        onClick={handleClose}
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
                                background: sent ? "#3F5142" : "#9E472D",
                                color: "#FFFDF9",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20, fontWeight: 700,
                                fontFamily: "'Fredoka', sans-serif",
                            }}>{sent ? "OK" : "?"}</div>
                            <h2 style={{
                                fontSize: "clamp(22px, 3vw, 26px)",
                                fontWeight: 600,
                                color: "#1F2922",
                                letterSpacing: "-.02em",
                                margin: 0,
                                fontFamily: "'Fredoka', sans-serif",
                            }}>{sent ? "Periksa Kotak Masuk Email" : "Atur Ulang Kata Sandi"}</h2>
                            <p style={{ fontSize: 14, color: "#4A584D", marginTop: 6, lineHeight: 1.5 }}>
                                {sent
                                    ? "Tautan pemulihan kata sandi sudah dikirim ke alamat email Anda."
                                    : "Masukkan alamat email yang terdaftar untuk menerima tautan pemulihan kata sandi."}
                            </p>
                        </div>

                        {sent ? (
                            <div>
                                <div style={{
                                    padding: 16, borderRadius: 14,
                                    background: "#F7F3EB",
                                    border: "1px solid #E5DEC9",
                                    textAlign: "center", marginBottom: 20,
                                }}>
                                    <p style={{ color: "#4A584D", fontSize: 12, margin: 0, marginBottom: 6 }}>
                                        Tautan pemulihan dikirim ke:
                                    </p>
                                    <p style={{ color: "#3F5142", fontSize: 14, fontWeight: 700, margin: 0, wordBreak: "break-all" }}>
                                        {email}
                                    </p>
                                </div>
                                <p style={{ fontSize: 13, color: "#4A584D", lineHeight: 1.5, textAlign: "center", marginBottom: 0 }}>
                                    Buka tautan di dalam email untuk membuat kata sandi baru. Jika belum masuk dalam 2 menit, periksa folder Spam atau Promosi.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div style={{ marginBottom: 16 }}>
                                    <label htmlFor="reset-email" style={{
                                        fontSize: 12, fontWeight: 700,
                                        color: "#4A584D",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        display: "block", marginBottom: 8,
                                    }}>Alamat Email Terdaftar</label>
                                    <input
                                        id="reset-email"
                                        type="email"
                                        placeholder="nama@keluarga.com"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(""); }}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                        style={{
                                            width: "100%", padding: "13px 16px", fontSize: 15,
                                            borderRadius: 12,
                                            border: `1px solid ${error ? "#B83B2A" : "#E5DEC9"}`,
                                            background: "#F7F3EB",
                                            color: "#1F2922",
                                            fontFamily: "inherit", outline: "none",
                                            minHeight: 48,
                                            transition: "all .2s",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    {error && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 6 }}>
                                            {error}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                    style={{
                                        width: "100%", minHeight: 48, fontSize: 15, fontWeight: 700,
                                        background: "#3F5142", color: "#FFFDF9", border: "none", borderRadius: 12,
                                        cursor: isLoading ? "not-allowed" : "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                        fontFamily: "'Fredoka', sans-serif",
                                    }}
                                >
                                    {isLoading ? "Mengirim tautan..." : "Kirim Tautan Pemulihan"}
                                </button>
                            </>
                        )}

                        {/* Divider + back */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 16px" }}>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                            <span style={{ fontSize: 11, color: "#4A584D", fontWeight: 700, letterSpacing: "0.08em" }}>ATAU</span>
                            <div style={{ flex: 1, height: 1, background: "#E5DEC9" }} />
                        </div>

                        <div style={{ textAlign: "center", fontSize: 14, color: "#4A584D" }}>
                            <button
                                type="button"
                                onClick={() => { handleClose(); onBackToLogin(); }}
                                style={{ background: "none", border: "none", color: "#3F5142", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: "4px" }}
                            >Kembali ke Halaman Masuk</button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ForgotPasswordModal;
