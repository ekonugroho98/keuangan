import { useEffect, useState } from "react";
import { useHouseholdInfo } from "../../hooks/useHouseholdInfo";

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID || "ca-pub-8774599188370439";
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT_ID || "";

function hasActivePaidAiKey() {
    try {
        const raw = localStorage.getItem("karaya_ai_config");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        const key = (parsed?.apiKey || parsed?.key || "").trim();
        return key.startsWith("sk-kb-");
    } catch {
        return false;
    }
}

export default function FreeTierAdBanner({ onUpgrade, compact = false }) {
    const { household, householdLoading } = useHouseholdInfo();
    const [dismissed, setDismissed] = useState(false);
    const [hasPaidKey, setHasPaidKey] = useState(() => hasActivePaidAiKey());

    useEffect(() => {
        const sync = () => setHasPaidKey(hasActivePaidAiKey());
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, []);

    const isFreeTier = !householdLoading && (!household?.plan || household.plan === "free") && !hasPaidKey;

    useEffect(() => {
        if (!isFreeTier || !ADSENSE_SLOT) return;
        try {
            if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
                const s = document.createElement("script");
                s.async = true;
                s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
                s.crossOrigin = "anonymous";
                document.head.appendChild(s);
            }
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
            // AdBlocker or AdSense not yet approved
        }
    }, [isFreeTier]);

    if (!isFreeTier || dismissed) return null;

    return (
        <div
            style={{
                width: "100%",
                marginBottom: compact ? 10 : 16,
                padding: compact ? "10px 12px" : "12px 18px",
                borderRadius: compact ? 14 : 18,
                background: "var(--glass-1, rgba(255,253,249,.85))",
                border: "1px solid var(--color-border, rgba(63,81,66,.18))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                boxShadow: "0 2px 10px rgba(31,41,34,.06)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 220 }}>
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "3px 7px",
                        borderRadius: 6,
                        background: "var(--color-primary-soft, rgba(63,81,66,.12))",
                        color: "var(--color-primary, #3F5142)",
                        flexShrink: 0,
                    }}
                >
                    IKLAN · AKUN GRATIS
                </span>
                <div style={{ fontSize: compact ? 12 : 13, color: "var(--color-text)", lineHeight: 1.45 }}>
                    <strong>Capek ketik struk satu-satu?</strong> Foto struk minimarket & catat via{" "}
                    <strong>@KelolaKeluargaBot</strong> otomatis + <strong>Bebas Iklan</strong> mulai{" "}
                    <strong>Rp 19.000</strong>.
                </div>
            </div>

            {ADSENSE_SLOT && (
                <ins
                    className="adsbygoogle"
                    style={{ display: "block", width: "100%", maxHeight: 90 }}
                    data-ad-client={ADSENSE_CLIENT}
                    data-ad-slot={ADSENSE_SLOT}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                />
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {onUpgrade ? (
                    <button
                        type="button"
                        onClick={onUpgrade}
                        style={{
                            padding: "7px 14px",
                            borderRadius: 999,
                            border: "none",
                            background: "var(--color-primary, #3F5142)",
                            color: "var(--color-on-primary, #FFFDF9)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "'Fredoka', inherit",
                            minHeight: 34,
                        }}
                    >
                        ✨ Hapus Iklan & Aktifkan AI
                    </button>
                ) : (
                    <a
                        href="https://keluargaberkembang.com/#pricing"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            padding: "7px 14px",
                            borderRadius: 999,
                            background: "var(--color-primary, #3F5142)",
                            color: "var(--color-on-primary, #FFFDF9)",
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: "none",
                            fontFamily: "'Fredoka', inherit",
                        }}
                    >
                        ✨ Hapus Iklan & Aktifkan AI
                    </a>
                )}
                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    aria-label="Sembunyikan sementara"
                    title="Sembunyikan sementara"
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--color-muted)",
                        cursor: "pointer",
                        fontSize: 13,
                        padding: "4px 6px",
                        minHeight: 28,
                    }}
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
