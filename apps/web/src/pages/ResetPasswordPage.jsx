import { useState } from "react";
import { supabase } from "../lib/supabase";
import { PASSWORD_MIN_LENGTH } from "../constants/validation";
import InputField from "../components/ui/InputField";

/**
 * ResetPasswordPage — full-page glass-hero aesthetic matching the landing
 * auth modals (aurora background, frosted card, gradient CTA).
 */
const ResetPasswordPage = ({ showToast, onDone }) => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        const err = {};
        if (!password) err.password = "Password wajib diisi";
        else if (password.length < PASSWORD_MIN_LENGTH) err.password = `Minimal ${PASSWORD_MIN_LENGTH} karakter`;
        if (password !== confirmPassword) err.confirmPassword = "Password tidak cocok";
        setErrors(err);
        if (Object.keys(err).length > 0) return;

        setIsLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setIsLoading(false);

        if (error) {
            showToast(error.message, "info");
            return;
        }

        showToast("Password berhasil direset! 🎉");
        onDone();
    };

    return (
        <div
            style={{
                position: "relative",
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-app, #0e0e15)",
                color: "var(--color-text, #efecf7)",
                fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif",
                padding: "clamp(16px, 4vw, 40px)",
                overflow: "hidden",
            }}
        >
            {/* Aurora ambient orbs */}
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    top: "-20%",
                    left: "-10%",
                    width: 520,
                    height: 520,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(96,252,198,.22), transparent 65%)",
                    filter: "blur(60px)",
                    pointerEvents: "none",
                }}
            />
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    bottom: "-25%",
                    right: "-15%",
                    width: 600,
                    height: 600,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(167,139,250,.18), transparent 65%)",
                    filter: "blur(60px)",
                    pointerEvents: "none",
                }}
            />

            {/* Glass hero card */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 440,
                    padding: "clamp(28px, 4vw, 40px) clamp(22px, 3vw, 32px)",
                    borderRadius: 24,
                    background: "var(--glass-hero, rgba(22,22,30,.72))",
                    backdropFilter: "var(--glass-blur, saturate(180%) blur(24px))",
                    WebkitBackdropFilter: "var(--glass-blur, saturate(180%) blur(24px))",
                    border: "1px solid var(--glass-border, rgba(255,255,255,.08))",
                    boxShadow:
                        "var(--glass-highlight, inset 0 1px 0 rgba(255,255,255,.06)), 0 30px 80px rgba(0,0,0,.45)",
                    animation: "scaleIn .35s cubic-bezier(.2,.8,.2,1)",
                }}
            >
                {/* Corner flare */}
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: -60,
                        right: -40,
                        width: 220,
                        height: 220,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(96,252,198,.18), transparent 70%)",
                        filter: "blur(20px)",
                        pointerEvents: "none",
                    }}
                />

                <div style={{ position: "relative", textAlign: "center", marginBottom: 28 }}>
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 18,
                            margin: "0 auto 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 30,
                            background: "linear-gradient(135deg, rgba(96,252,198,.2), rgba(96,252,198,.05))",
                            border: "1px solid rgba(96,252,198,.25)",
                            boxShadow: "0 10px 30px rgba(96,252,198,.15), inset 0 1px 0 rgba(255,255,255,.1)",
                        }}
                    >
                        🔐
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: "var(--color-subtle, #76747e)",
                            textTransform: "uppercase",
                            letterSpacing: 1.8,
                            marginBottom: 8,
                        }}
                    >
                        Reset Password
                    </div>
                    <h2
                        style={{
                            fontSize: "clamp(22px, 3vw, 28px)",
                            fontWeight: 800,
                            color: "var(--color-text, #efecf7)",
                            letterSpacing: "-.025em",
                            margin: 0,
                        }}
                    >
                        Buat Password Baru
                    </h2>
                    <p
                        style={{
                            color: "var(--color-muted, #acaab4)",
                            fontSize: 13,
                            marginTop: 8,
                            marginBottom: 0,
                            fontWeight: 500,
                        }}
                    >
                        Masukkan password baru untuk akun kamu
                    </p>
                </div>

                <div style={{ position: "relative" }}>
                    <InputField
                        label="Password Baru"
                        icon="🔒"
                        type="password"
                        placeholder={`Minimal ${PASSWORD_MIN_LENGTH} karakter`}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        error={errors.password}
                    />
                    <InputField
                        label="Konfirmasi Password"
                        icon="🔒"
                        type="password"
                        placeholder="Ulangi password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        error={errors.confirmPassword}
                    />

                    <button
                        className="btn-primary"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        style={{
                            width: "100%",
                            padding: "14px 16px",
                            marginTop: 8,
                            borderRadius: 14,
                            border: "none",
                            background:
                                "linear-gradient(135deg, var(--color-primary, #60fcc6), var(--color-primary-deep, #19ce9b))",
                            color: "var(--color-on-primary, #005e44)",
                            fontSize: 14,
                            fontWeight: 800,
                            letterSpacing: "-.01em",
                            cursor: isLoading ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                            opacity: isLoading ? 0.7 : 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            boxShadow:
                                "0 8px 24px rgba(96,252,198,.25), inset 0 1px 0 rgba(255,255,255,.35)",
                            transition: "transform .15s, box-shadow .15s",
                        }}
                    >
                        {isLoading ? (
                            <>
                                <span
                                    style={{
                                        width: 16,
                                        height: 16,
                                        border: "2px solid rgba(0,94,68,.3)",
                                        borderTopColor: "var(--color-on-primary, #005e44)",
                                        borderRadius: "50%",
                                        display: "inline-block",
                                        animation: "spin .8s linear infinite",
                                    }}
                                />
                                Menyimpan...
                            </>
                        ) : (
                            <>Simpan Password Baru →</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
