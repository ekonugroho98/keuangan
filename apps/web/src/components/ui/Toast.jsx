import { useEffect, useState } from "react";

/*
 * Toast — aurora-glass notification
 * variants: success (mint) · error (red) · warning (amber) · info (blue)
 * Keeps original prop signature: { message, show, type }
 * Extra optional props (non-breaking): duration, onClose
 */
const VARIANTS = {
    success: {
        stripe: "var(--color-primary)",
        text: "var(--color-primary)",
        tint: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
        icon: "✓",
    },
    error: {
        stripe: "var(--color-expense)",
        text: "var(--color-expense)",
        tint: "color-mix(in srgb, var(--color-expense) 12%, transparent)",
        icon: "!",
    },
    warning: {
        stripe: "var(--color-amber)",
        text: "var(--color-amber)",
        tint: "color-mix(in srgb, var(--color-amber) 12%, transparent)",
        icon: "!",
    },
    info: {
        stripe: "var(--color-transfer)",
        text: "var(--color-transfer)",
        tint: "color-mix(in srgb, var(--color-transfer) 12%, transparent)",
        icon: "i",
    },
};

const Toast = ({ message, show, type = "success", duration = 3000, onClose }) => {
    const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);

    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);

    if (!show) return null;
    const v = VARIANTS[type] || VARIANTS.info;

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: "fixed",
                top: isMobile ? 12 : 24,
                right: isMobile ? 12 : 24,
                left: isMobile ? 12 : "auto",
                zIndex: 10000,
                maxWidth: isMobile ? "none" : 380,
                animation: isMobile
                    ? "slideDown .4s cubic-bezier(0.16,1,0.3,1)"
                    : "slideInRight .4s cubic-bezier(0.16,1,0.3,1)",
                pointerEvents: "auto",
            }}
        >
            <div
                style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 16,
                    background: "var(--glass-hero)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-highlight), 0 12px 32px rgba(0,0,0,.35)",
                    display: "flex",
                    alignItems: "stretch",
                    minHeight: 56,
                }}
            >
                {/* Colored stripe */}
                <div
                    style={{
                        width: 4,
                        background: v.stripe,
                        flexShrink: 0,
                    }}
                />
                {/* Content */}
                <div
                    style={{
                        flex: 1,
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: v.tint,
                    }}
                >
                    <span
                        aria-hidden
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 10,
                            background: `color-mix(in srgb, ${v.stripe} 22%, transparent)`,
                            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${v.stripe} 40%, transparent)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 14,
                            color: v.text,
                            flexShrink: 0,
                        }}
                    >
                        {v.icon}
                    </span>
                    <span
                        style={{
                            color: "var(--color-text)",
                            fontSize: 13,
                            fontWeight: 600,
                            lineHeight: 1.45,
                            flex: 1,
                            minWidth: 0,
                            wordBreak: "break-word",
                        }}
                    >
                        {message}
                    </span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            aria-label="Dismiss"
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 8,
                                border: "1px solid var(--glass-border)",
                                background: "transparent",
                                color: "var(--color-muted)",
                                cursor: "pointer",
                                fontSize: 11,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
                                flexShrink: 0,
                                fontFamily: "inherit",
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
                {/* Progress bar */}
                {duration > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            left: 4,
                            right: 0,
                            bottom: 0,
                            height: 2,
                            background: "rgba(255,255,255,.06)",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                height: "100%",
                                width: "100%",
                                background: v.stripe,
                                transformOrigin: "left center",
                                animation: `toastProgress ${duration}ms linear forwards`,
                            }}
                        />
                    </div>
                )}
            </div>
            <style>{`
                @keyframes toastProgress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default Toast;
