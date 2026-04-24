import { useState, useEffect } from "react";
import { APP_NAME } from "../../config/app";

/**
 * InstallBanner — glass pill with gradient mint border, slide-in animation,
 * dismissable (persisted 3 days in localStorage).
 */
export default function InstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [show, setShow]                     = useState(false);
    const [isIOS, setIsIOS]                   = useState(false);
    const [dismissed, setDismissed]           = useState(false);

    useEffect(() => {
        // Don't show if dismissed < 3 days ago
        const prev = localStorage.getItem("pwa_banner_dismissed");
        if (prev && Date.now() - Number(prev) < 3 * 24 * 60 * 60 * 1000) return;

        // iOS Safari has no beforeinstallprompt — show manual hint
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
        const inStandaloneMode = window.matchMedia("(display-mode: standalone)").matches
            || window.navigator.standalone;

        if (ios && !inStandaloneMode) {
            setIsIOS(true);
            setShow(true);
            return;
        }

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShow(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        window.addEventListener("appinstalled", () => setShow(false));

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setShow(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShow(false);
        setDismissed(true);
        localStorage.setItem("pwa_banner_dismissed", String(Date.now()));
    };

    if (!show || dismissed) return null;

    return (
        <div
            role="dialog"
            aria-label="Install app"
            style={{
                position: "fixed",
                bottom: "calc(16px + env(safe-area-inset-bottom))",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 9999,
                width: "min(480px, calc(100vw - 32px))",
                background: "var(--glass-hero, rgba(22,22,30,.78))",
                backdropFilter: "var(--glass-blur, saturate(180%) blur(20px))",
                WebkitBackdropFilter: "var(--glass-blur, saturate(180%) blur(20px))",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: "1px solid transparent",
                backgroundImage:
                    "linear-gradient(var(--glass-hero, rgba(22,22,30,.78)), var(--glass-hero, rgba(22,22,30,.78))), linear-gradient(135deg, rgba(96,252,198,.55), rgba(167,139,250,.35))",
                backgroundOrigin: "border-box",
                backgroundClip: "padding-box, border-box",
                boxShadow:
                    "0 18px 42px rgba(0,0,0,.35), 0 0 0 1px rgba(96,252,198,.08), inset 0 1px 0 rgba(255,255,255,.06)",
                animation: "installSlideIn .45s cubic-bezier(.2,.8,.2,1)",
            }}
        >
            <style>{`
                @keyframes installSlideIn {
                    from { transform: translateX(-50%) translateY(28px); opacity: 0; }
                    to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
                }
                @keyframes installGlow {
                    0%,100% { box-shadow: 0 0 0 0 rgba(96,252,198,.35); }
                    50%     { box-shadow: 0 0 0 6px rgba(96,252,198,0); }
                }
            `}</style>

            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: "linear-gradient(135deg, var(--color-primary, #60fcc6), var(--color-primary-deep, #19ce9b))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 17,
                        fontWeight: 800,
                        color: "var(--color-on-primary, #005e44)",
                        animation: "installGlow 2.4s ease-in-out infinite",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)",
                    }}
                >
                    {APP_NAME[0]}
                </div>
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: "var(--color-text, #efecf7)",
                            letterSpacing: "-.01em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Install {APP_NAME} app?
                    </div>
                    {isIOS ? (
                        <div style={{ fontSize: 11, color: "var(--color-muted, #94a3b8)", marginTop: 2 }}>
                            Tap <b style={{ color: "var(--color-primary, #60fcc6)" }}>⎋ Share</b> lalu{" "}
                            <b style={{ color: "var(--color-primary, #60fcc6)" }}>Add to Home Screen</b>
                        </div>
                    ) : (
                        <div style={{ fontSize: 11, color: "var(--color-muted, #94a3b8)", marginTop: 2 }}>
                            Akses lebih cepat dari home screen / taskbar
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {!isIOS && (
                    <button
                        onClick={handleInstall}
                        style={{
                            padding: "8px 16px",
                            borderRadius: 9999,
                            border: "none",
                            background: "linear-gradient(135deg, var(--color-primary, #60fcc6), var(--color-primary-deep, #19ce9b))",
                            color: "var(--color-on-primary, #005e44)",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            letterSpacing: "-.01em",
                            boxShadow: "0 4px 14px rgba(96,252,198,.28), inset 0 1px 0 rgba(255,255,255,.35)",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        ⬇ Install
                    </button>
                )}
                <button
                    aria-label="Dismiss install banner"
                    onClick={handleDismiss}
                    style={{
                        background: "rgba(255,255,255,.06)",
                        border: "1px solid var(--glass-border, rgba(255,255,255,.08))",
                        color: "var(--color-muted, #94a3b8)",
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        cursor: "pointer",
                        fontSize: 13,
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background .15s, color .15s",
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.color = "var(--color-text)"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.color = "var(--color-muted, #94a3b8)"; }}
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
