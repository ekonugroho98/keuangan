import { useState } from "react";
import { api, unwrap } from "../../api/client";
import { useHousehold } from "../../auth/HouseholdProvider";

/**
 * Ditampilkan saat user login tapi belum jadi anggota household mana pun (07-frontend.md §3,
 * App.jsx). Memanggil POST /v1/households (onboarding, 05-api.md §4.2). Setelah sukses, refetch
 * /v1/me supaya HouseholdProvider mendeteksi household baru dan merender <Dashboard> normal.
 */
export default function OnboardingHousehold({ userEmail, userFullName, onLogout }) {
    const { refetchMe } = useHousehold();
    const [name, setName] = useState("Keluarga");
    const [displayName, setDisplayName] = useState(userFullName || userEmail?.split("@")[0] || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !displayName.trim() || loading) return;
        setLoading(true);
        setError("");
        try {
            await unwrap(
                await api.POST("/v1/households", {
                    body: { name: name.trim(), timezone: "Asia/Jakarta", display_name: displayName.trim() },
                }),
            );
            await refetchMe();
        } catch (err) {
            setError(err.message || "Gagal membuat household");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <form
                onSubmit={submit}
                style={{
                    width: "100%", maxWidth: 420, background: "var(--bg-surface, #12151c)", borderRadius: 16,
                    padding: 28, border: "1px solid var(--color-border-soft, rgba(255,255,255,.08))",
                }}
            >
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--color-text, #fff)", fontFamily: "var(--font-display)" }}>
                    Selamat datang di Keluarga Berkembang 👋
                </h1>
                <p style={{ fontSize: 13, color: "var(--color-muted, #9aa)", marginBottom: 20, lineHeight: 1.5 }}>
                    Buat ruang rumah tangga untuk mulai mencatat keuangan, belanja dapur, dan stok kulkas. Kamu bisa mengundang pasangan belakangan di Pengaturan.
                </p>

                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted, #9aa)", display: "block", marginBottom: 6 }}>
                    Nama panggilanmu
                </label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ayah / Bunda"
                    style={inputStyle}
                    required
                />

                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted, #9aa)", display: "block", margin: "14px 0 6px" }}>
                    Nama Rumah Tangga
                </label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Keluarga Harmonis"
                    style={inputStyle}
                    required
                />

                {error && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-expense, #ff716c)" }}>{error}</div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 10, border: "none",
                        background: "var(--color-primary, #46634E)", color: "var(--color-on-primary, #fff)", fontWeight: 700,
                        fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading ? "Membuat..." : "Mulai Rumah Tangga"}
                </button>

                {onLogout && (
                    <button
                        type="button"
                        onClick={onLogout}
                        style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, border: "none", background: "transparent", color: "var(--color-muted, #9aa)", fontSize: 12, cursor: "pointer" }}
                    >
                        Logout
                    </button>
                )}
            </form>
        </div>
    );
}

const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid var(--color-border-soft, rgba(255,255,255,.12))",
    background: "var(--bg-surface-low, rgba(255,255,255,.04))", color: "var(--color-text, #fff)", fontSize: 14,
};
