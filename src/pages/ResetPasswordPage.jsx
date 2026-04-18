import { useState } from "react";
import { supabase } from "../lib/supabase";
import { PASSWORD_MIN_LENGTH } from "../constants/validation";
import InputField from "../components/ui/InputField";

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

    const darkVars = {
        "--bg-app": "#0e0e15", "--bg-surface": "#1f1f28",
        "--bg-surface-low": "#13131a", "--color-text": "#efecf7",
        "--color-muted": "#acaab4", "--color-subtle": "#76747e",
        "--color-primary": "#60fcc6", "--color-on-primary": "#005e44",
        "--color-border": "rgba(255,255,255,.07)",
        "--nav-active-bg": "rgba(27,27,34,.5)",
    };

    return (
        <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            background: "#0e0e15", fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif",
            padding: 20, ...darkVars,
        }}>
            <div style={{
                width: "100%", maxWidth: 400,
                background: "linear-gradient(135deg,#13131a,#1f1f28)",
                borderRadius: 20, border: "1px solid var(--color-border)",
                padding: "32px 24px", animation: "scaleIn .3s ease",
            }}>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Buat Password Baru</h2>
                    <p style={{ color: "#76747e", fontSize: 12, marginTop: 4 }}>Masukkan password baru untuk akun kamu</p>
                </div>

                <InputField
                    label="PASSWORD BARU"
                    icon="🔒"
                    type="password"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    error={errors.password}
                />
                <InputField
                    label="KONFIRMASI PASSWORD"
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
                    style={{ width: "100%", padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                    {isLoading
                        ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />Menyimpan...</>
                        : "Simpan Password Baru →"}
                </button>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
