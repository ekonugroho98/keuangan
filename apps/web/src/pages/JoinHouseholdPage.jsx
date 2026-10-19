import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PASSWORD_MIN_LENGTH } from "../constants/validation";
import LoginModal from "../components/landing/LoginModal";
import SignupModal from "../components/landing/SignupModal";
import { previewInvitationApi, acceptInvitationApi } from "../hooks/useInvitations";

/**
 * Halaman /join/:code (F5-T3, 07-frontend.md §4): preview undangan tanpa login, lalu login/daftar
 * kalau belum, lalu terima undangan. Dipasang di App.jsx berdasarkan window.location.pathname
 * (app ini tidak pakai router, lihat ResetPasswordPage untuk pola serupa berbasis auth event).
 */
export default function JoinHouseholdPage({ code, session, showToast }) {
    const [preview, setPreview] = useState(undefined); // undefined = loading, null = error
    const [previewError, setPreviewError] = useState("");
    const [showLogin, setShowLogin] = useState(false);
    const [showSignup, setShowSignup] = useState(false);
    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
    const [formErrors, setFormErrors] = useState({});
    const [formStep, setFormStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [mode, setMode] = useState("fresh");
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        previewInvitationApi(code)
            .then(setPreview)
            .catch((err) => { setPreview(null); setPreviewError(err.message || "Kode undangan tidak valid"); });
    }, [code]);

    useEffect(() => {
        if (session?.user) setDisplayName(session.user.user_metadata?.full_name || session.user.email.split("@")[0]);
    }, [session]);

    const handleLogin = async () => {
        const err = {};
        if (!loginForm.email.trim()) err.email = "Email wajib diisi";
        if (!loginForm.password) err.password = "Password wajib diisi";
        setFormErrors(err);
        if (Object.keys(err).length > 0) return;
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email: loginForm.email, password: loginForm.password });
        setIsLoading(false);
        if (error) { showToast(error.message, "error"); return; }
        setShowLogin(false);
    };

    const handleSignup = async () => {
        const err = {};
        if (!signupForm.name.trim()) err.name = "Nama wajib diisi";
        if (!signupForm.email.trim()) err.email = "Email wajib diisi";
        else if (!/\S+@\S+\.\S+/.test(signupForm.email)) err.email = "Format email tidak valid";
        if (!signupForm.password) err.password = "Password wajib diisi";
        else if (signupForm.password.length < PASSWORD_MIN_LENGTH) err.password = `Minimal ${PASSWORD_MIN_LENGTH} karakter`;
        if (signupForm.password !== signupForm.confirmPassword) err.confirmPassword = "Password tidak cocok";
        setFormErrors(err);
        if (Object.keys(err).length > 0) return;

        setIsLoading(true);
        const { error } = await supabase.auth.signUp({
            email: signupForm.email,
            password: signupForm.password,
            options: {
                emailRedirectTo: window.location.href,
                data: { full_name: signupForm.name },
            },
        });
        setIsLoading(false);
        if (error) {
            if (error.message.includes("already registered")) setFormErrors({ email: "Email sudah terdaftar, silakan login" });
            else showToast(error.message, "error");
            return;
        }
        setShowSignup(false);
        showToast("Akun dibuat! Cek email untuk konfirmasi, lalu buka link undangan ini lagi 📧", "info");
    };

    const handleAccept = async () => {
        if (!displayName.trim()) return;
        setAccepting(true);
        try {
            await acceptInvitationApi(code, { display_name: displayName.trim(), mode });
            window.location.href = "/";
        } catch (err) {
            showToast(err.message || "Gagal menerima undangan", "error");
        } finally {
            setAccepting(false);
        }
    };

    const card = {
        width: "100%", maxWidth: 420, background: "var(--bg-surface, #12151c)", borderRadius: 16,
        padding: 28, border: "1px solid var(--color-border-soft, rgba(255,255,255,.08))",
    };
    const wrap = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" };
    const inputStyle = {
        width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 14,
        border: "1px solid var(--color-border-soft, rgba(255,255,255,.12))",
        background: "var(--bg-surface-low, rgba(255,255,255,.04))", color: "var(--color-text, #fff)", fontSize: 14, boxSizing: "border-box",
    };
    const btn = (disabled) => ({
        width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
        background: "var(--color-primary, #46634E)", color: "var(--color-on-primary, #fff)", fontWeight: 700,
        fontSize: 14, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
    });

    if (preview === undefined || session === undefined) {
        return <div style={wrap}><div style={{ color: "var(--color-muted)" }}>Memuat undangan...</div></div>;
    }

    if (preview === null) {
        return (
            <div style={wrap}>
                <div style={card}>
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>Undangan tidak valid</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)" }}>{previewError}</p>
                    <a href="/" style={{ display: "inline-block", marginTop: 16, color: "var(--color-primary)", fontSize: 13, fontWeight: 700 }}>← Kembali ke beranda</a>
                </div>
            </div>
        );
    }

    return (
        <div style={wrap}>
            <div style={card}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 6 }}>UNDANGAN RUMAH TANGGA</div>
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
                    {preview.inviter_name} mengundangmu ke "{preview.household_name}"
                </h1>
                <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20 }}>
                    Peran: <strong>{preview.role}</strong>{preview.email_locked ? " · Terkunci untuk email tertentu" : ""}
                </p>

                {!session ? (
                    <>
                        <button style={btn(false)} onClick={() => setShowLogin(true)}>Login untuk bergabung</button>
                        <button
                            onClick={() => setShowSignup(true)}
                            style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-text)", fontSize: 13, cursor: "pointer" }}
                        >
                            Belum punya akun? Daftar
                        </button>
                    </>
                ) : (
                    <>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>Nama kamu di rumah tangga ini</label>
                        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />

                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>Data keuanganmu saat ini</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            <button
                                onClick={() => setMode("fresh")}
                                style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${mode === "fresh" ? "var(--color-primary)" : "var(--color-border-soft)"}`, background: mode === "fresh" ? "var(--color-primary-soft)" : "transparent", color: mode === "fresh" ? "var(--color-primary)" : "var(--color-muted)" }}
                            >
                                Mulai baru
                            </button>
                            <button
                                onClick={() => setMode("merge")}
                                style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${mode === "merge" ? "var(--color-primary)" : "var(--color-border-soft)"}`, background: mode === "merge" ? "var(--color-primary-soft)" : "transparent", color: mode === "merge" ? "var(--color-primary)" : "var(--color-muted)" }}
                            >
                                Gabungkan data lama
                            </button>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: -8, marginBottom: 16 }}>
                            {mode === "merge"
                                ? "Akun, transaksi, dan data lain di household kamu saat ini akan dipindah ke sini."
                                : "Household kamu saat ini (kalau ada) tidak berubah; kamu cuma jadi anggota baru di household ini."}
                        </p>
                        <button style={btn(!displayName.trim() || accepting)} onClick={handleAccept} disabled={!displayName.trim() || accepting}>
                            {accepting ? "Memproses..." : "Gabung sekarang"}
                        </button>
                    </>
                )}
            </div>

            <LoginModal
                open={showLogin} onClose={() => setShowLogin(false)}
                form={loginForm} setForm={setLoginForm} errors={formErrors}
                onSubmit={handleLogin} isLoading={isLoading}
                onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }}
            />
            <SignupModal
                open={showSignup} onClose={() => setShowSignup(false)}
                form={signupForm} setForm={setSignupForm} errors={formErrors} setErrors={setFormErrors}
                step={formStep} setStep={setFormStep}
                onSubmit={handleSignup} isLoading={isLoading}
                onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }}
            />
        </div>
    );
}
