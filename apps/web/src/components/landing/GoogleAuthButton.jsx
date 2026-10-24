import { useState } from "react";
import { supabase } from "../../lib/supabase";

export function getGoogleRedirectUrl(customRedirectTo) {
    if (customRedirectTo) return customRedirectTo;
    if (typeof window === "undefined") return "https://kelola.keluargaberkembang.com";
    const { hostname, origin, pathname, search } = window.location;
    if (pathname.startsWith("/join/")) {
        return `${origin}${pathname}${search}`;
    }
    if (hostname === "keluargaberkembang.com" || hostname === "www.keluargaberkembang.com") {
        return "https://kelola.keluargaberkembang.com";
    }
    return origin;
}

export default function GoogleAuthButton({
    label = "Lanjutkan dengan Google",
    redirectTo,
    onError,
    variant = "light",
}) {
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const targetRedirect = getGoogleRedirectUrl(redirectTo);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: targetRedirect,
                    queryParams: {
                        prompt: "select_account",
                    },
                },
            });
            if (error) {
                setLoading(false);
                if (onError) onError(error.message || "Gagal menghubungkan ke Google");
            }
        } catch (err) {
            setLoading(false);
            if (onError) onError(err?.message || "Gagal menghubungkan ke Google");
        }
    };

    const isDarkSurface = variant === "surface";

    return (
        <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
                width: "100%",
                minHeight: 48,
                padding: "12px 16px",
                borderRadius: 12,
                border: isDarkSurface
                    ? "1px solid var(--color-border, rgba(255,255,255,.16))"
                    : "1px solid #D5CCB8",
                background: isDarkSurface ? "var(--bg-surface-low, #FFFFFF)" : "#FFFFFF",
                color: isDarkSurface ? "var(--color-text, #1F2922)" : "#1F2922",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Quicksand', -apple-system, sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow: "0 2px 6px rgba(31, 41, 34, 0.06)",
                transition: "all .2s ease",
                boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
                if (!loading) {
                    e.currentTarget.style.borderColor = "#3F5142";
                    e.currentTarget.style.background = "#F7F3EB";
                }
            }}
            onMouseLeave={(e) => {
                if (!loading) {
                    e.currentTarget.style.borderColor = isDarkSurface
                        ? "var(--color-border, rgba(255,255,255,.16))"
                        : "#D5CCB8";
                    e.currentTarget.style.background = isDarkSurface
                        ? "var(--bg-surface-low, #FFFFFF)"
                        : "#FFFFFF";
                }
            }}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
            </svg>
            <span>{loading ? "Menghubungkan ke Google..." : label}</span>
        </button>
    );
}
