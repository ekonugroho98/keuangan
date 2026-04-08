import { useState, useEffect } from "react";
import { APP_NAME } from "../../config/app";

export default function InstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [show, setShow]                     = useState(false);
    const [isIOS, setIsIOS]                   = useState(false);
    const [dismissed, setDismissed]           = useState(false);

    useEffect(() => {
        // Jangan tampilkan lagi kalau dismiss belum 3 hari
        const dismissed = localStorage.getItem("pwa_banner_dismissed");
        if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 60 * 60 * 1000) return;

        // Deteksi iOS (Safari tidak punya beforeinstallprompt)
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
        const inStandaloneMode = window.matchMedia("(display-mode: standalone)").matches
            || window.navigator.standalone;

        if (ios && !inStandaloneMode) {
            setIsIOS(true);
            setShow(true);
            return;
        }

        // Android / Desktop — tangkap event beforeinstallprompt
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShow(true);
        };
        window.addEventListener("beforeinstallprompt", handler);

        // Sembunyikan kalau sudah terinstall
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
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
            background: "#0d0d1a",
            borderBottom: "1px solid rgba(96,252,198,.2)",
            padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            animation: "slideDown .3s ease",
        }}>
            <style>{`@keyframes slideDown { from { transform: translateY(-100%); opacity:0; } to { transform: translateY(0); opacity:1; } }`}</style>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "linear-gradient(135deg,#60fcc6,#19ce9b)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 800, color: "#005e44",
                }}>
                    {APP_NAME[0]}
                </div>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                        Install {APP_NAME} app?
                    </div>
                    {isIOS
                        ? <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            Tap <b style={{ color: "#60fcc6" }}>⎋ Share</b> lalu <b style={{ color: "#60fcc6" }}>Add to Home Screen</b>
                          </div>
                        : <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            Akses lebih cepat dari home screen / taskbar
                          </div>
                    }
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {!isIOS && (
                    <button onClick={handleInstall} style={{
                        padding: "7px 16px", borderRadius: 8, border: "none",
                        background: "linear-gradient(135deg,#60fcc6,#19ce9b)",
                        color: "#005e44", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: 6,
                    }}>
                        ⬇️ Install
                    </button>
                )}
                <button onClick={handleDismiss} style={{
                    background: "rgba(255,255,255,.07)", border: "none",
                    color: "#94a3b8", width: 28, height: 28, borderRadius: 6,
                    cursor: "pointer", fontSize: 14, fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    ✕
                </button>
            </div>
        </div>
    );
}
