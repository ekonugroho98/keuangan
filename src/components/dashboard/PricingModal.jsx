import { useEffect, useState } from "react";
import { APP_NAME } from "../../config/app";

const useIsDesktop = () => {
    const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 640);
    useEffect(() => {
        const handler = () => setIsDesktop(window.innerWidth >= 640);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);
    return isDesktop;
};

const plans = [
    {
        id: "trial",
        name: "Free Trial",
        tagline: "Mulai tanpa biaya",
        price: "Gratis",
        period: "14 hari",
        color: "var(--color-muted)",
        gradient: "linear-gradient(135deg,#76747e,#48474f)",
        features: [
            { ok: true, text: "Semua fitur dasar" },
            { ok: true, text: "Catat transaksi" },
            { ok: true, text: "Kelola akun & kategori" },
            { ok: true, text: "Dashboard & ringkasan" },
            { ok: false, text: "Laporan lanjutan" },
            { ok: false, text: "AI Coach" },
            { ok: false, text: "Ekspor laporan" },
        ],
        cta: "Paket saat ini",
        disabled: true,
    },
    {
        id: "starter",
        name: "Starter",
        tagline: "Untuk pengguna harian",
        price: "Rp 29.000",
        period: "/bulan",
        color: "var(--color-primary)",
        gradient: "linear-gradient(135deg,#60fcc6,#19ce9b)",
        badge: "Populer",
        features: [
            { ok: true, text: "Semua fitur Free Trial" },
            { ok: true, text: "Laporan & Analitik lengkap" },
            { ok: true, text: "Target Finansial (Goals)" },
            { ok: true, text: "Hutang & Cicilan" },
            { ok: true, text: "Transaksi Berulang" },
            { ok: false, text: "AI Coach" },
            { ok: false, text: "Investasi & Aset" },
        ],
        cta: "Pilih Starter",
        disabled: false,
    },
    {
        id: "pro",
        name: "Pro",
        tagline: "Full power, AI coach aktif",
        price: "Rp 79.000",
        period: "/3 bulan",
        color: "var(--color-amber)",
        gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
        badge: "Terbaik",
        featured: true,
        features: [
            { ok: true, text: "Semua fitur Starter" },
            { ok: true, text: "AI Coach (analisis pintar)" },
            { ok: true, text: "Investasi & Aset" },
            { ok: true, text: "Ekspor laporan PDF/Excel" },
            { ok: true, text: "Multi-device sync" },
            { ok: true, text: "Prioritas support" },
            { ok: true, text: "Fitur eksklusif baru" },
        ],
        cta: "Pilih Pro",
        disabled: false,
    },
];

const Check = ({ ok, color }) => (
    <span
        aria-hidden
        style={{
            width: 20,
            height: 20,
            borderRadius: 7,
            background: ok
                ? `color-mix(in srgb, ${color} 18%, transparent)`
                : "rgba(255,255,255,.04)",
            boxShadow: ok ? `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` : "inset 0 0 0 1px var(--glass-border)",
            color: ok ? color : "var(--color-faint)",
            fontSize: 11,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        }}
    >
        {ok ? "✓" : "–"}
    </span>
);

const PricingModal = ({ open, onClose, currentPlan }) => {
    const isDesktop = useIsDesktop();
    if (!open) return null;

    const handleChoose = (planId) => {
        alert(`Pembayaran untuk paket ${planId.toUpperCase()} akan segera tersedia!\n\nHubungi admin untuk upgrade manual.`);
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: isDesktop ? "center" : "flex-end",
                justifyContent: "center",
                overflowY: "auto",
                animation: "fadeIn 0.3s",
                padding: isDesktop ? 20 : "20px 0 0",
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: 920,
                    animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
                    background: "var(--glass-hero)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: isDesktop ? 28 : "28px 28px 0 0",
                    padding: isDesktop ? "36px 32px 32px" : "28px 18px calc(32px + env(safe-area-inset-bottom))",
                    maxHeight: "92vh",
                    overflowY: "auto",
                    boxShadow: "var(--glass-highlight), 0 30px 80px rgba(0,0,0,.55)",
                    position: "relative",
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: "absolute", top: 16, right: 16,
                        width: 36, height: 36, borderRadius: 12,
                        background: "var(--color-border-soft)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--color-muted)", cursor: "pointer", fontSize: 16,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "inherit", zIndex: 2,
                    }}
                >
                    ✕
                </button>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 28, padding: "0 8px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                        UPGRADE
                    </div>
                    <h2
                        style={{
                            fontSize: "clamp(26px, 4vw, 38px)",
                            fontWeight: 800,
                            letterSpacing: "-.03em",
                            margin: "0 0 10px",
                            background: "linear-gradient(135deg, var(--color-primary), var(--color-amber))",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                        }}
                    >
                        Upgrade ke Pro
                    </h2>
                    <p style={{ fontSize: 14, color: "var(--color-muted)", margin: 0, maxWidth: 440, marginInline: "auto", lineHeight: 1.5 }}>
                        Akses penuh {APP_NAME} — laporan, AI Coach, investasi, dan support prioritas.
                    </p>
                </div>

                {/* Plan cards */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
                        gap: 16,
                        marginBottom: 24,
                    }}
                >
                    {plans.map(plan => {
                        const isActive = currentPlan === plan.id || (!currentPlan && plan.id === "trial");
                        const featured = plan.featured;
                        return (
                            <div
                                key={plan.id}
                                style={{
                                    position: "relative",
                                    background: featured
                                        ? `linear-gradient(180deg, color-mix(in srgb, ${plan.color} 14%, transparent), color-mix(in srgb, ${plan.color} 3%, transparent))`
                                        : "rgba(255,255,255,.02)",
                                    border: `1px solid ${featured ? `color-mix(in srgb, ${plan.color} 40%, transparent)` : "var(--glass-border)"}`,
                                    borderRadius: 22,
                                    padding: "24px 20px 20px",
                                    boxShadow: featured
                                        ? `0 0 0 1px color-mix(in srgb, ${plan.color} 15%, transparent), 0 20px 48px color-mix(in srgb, ${plan.color} 18%, transparent)`
                                        : "var(--glass-highlight)",
                                    display: "flex",
                                    flexDirection: "column",
                                    minHeight: 0,
                                }}
                            >
                                {/* Featured glow border accent */}
                                {featured && (
                                    <div
                                        aria-hidden
                                        style={{
                                            position: "absolute",
                                            inset: -1,
                                            borderRadius: 22,
                                            padding: 1,
                                            background: plan.gradient,
                                            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                            WebkitMaskComposite: "xor",
                                            maskComposite: "exclude",
                                            pointerEvents: "none",
                                            opacity: 0.7,
                                        }}
                                    />
                                )}

                                {/* Badges */}
                                {plan.badge && (
                                    <div
                                        style={{
                                            position: "absolute", top: -12, right: 16,
                                            background: plan.gradient,
                                            color: "#0b0d13",
                                            fontSize: 10,
                                            fontWeight: 800,
                                            padding: "5px 12px",
                                            borderRadius: 20,
                                            letterSpacing: 0.8,
                                            textTransform: "uppercase",
                                            boxShadow: "0 6px 18px rgba(0,0,0,.35)",
                                        }}
                                    >
                                        {plan.badge}
                                    </div>
                                )}
                                {isActive && (
                                    <div
                                        className="chip chip-mint"
                                        style={{
                                            position: "absolute", top: -12, left: 16,
                                            fontSize: 10, letterSpacing: 0.6,
                                        }}
                                    >
                                        ✓ Aktif
                                    </div>
                                )}

                                {/* Plan header */}
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: plan.color, letterSpacing: 0.2 }}>
                                        {plan.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 2 }}>
                                        {plan.tagline}
                                    </div>
                                </div>

                                {/* Price */}
                                <div style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 6 }}>
                                    <span
                                        className="num-tight"
                                        style={{
                                            fontSize: 30,
                                            fontWeight: 800,
                                            color: "var(--color-text)",
                                            letterSpacing: "-.025em",
                                        }}
                                    >
                                        {plan.price}
                                    </span>
                                    <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                                        {plan.period}
                                    </span>
                                </div>

                                {/* Features */}
                                <ul
                                    style={{
                                        listStyle: "none",
                                        padding: 0,
                                        margin: "0 0 20px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 10,
                                        flex: 1,
                                    }}
                                >
                                    {plan.features.map((f, i) => (
                                        <li
                                            key={i}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                                fontSize: 12.5,
                                                color: f.ok ? "var(--color-text)" : "var(--color-faint)",
                                                lineHeight: 1.45,
                                                opacity: f.ok ? 1 : 0.55,
                                            }}
                                        >
                                            <Check ok={f.ok} color={plan.color} />
                                            <span>{f.text}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => !plan.disabled && !isActive && handleChoose(plan.id)}
                                    disabled={plan.disabled || isActive}
                                    className={featured && !isActive && !plan.disabled ? "btn-primary" : "btn-secondary"}
                                    style={{
                                        width: "100%",
                                        minHeight: 44,
                                        fontSize: 13,
                                        cursor: isActive || plan.disabled ? "default" : "pointer",
                                        opacity: isActive || plan.disabled ? 0.6 : 1,
                                        ...(featured && !isActive && !plan.disabled
                                            ? { background: plan.gradient, color: "#0b0d13" }
                                            : {}),
                                    }}
                                >
                                    {isActive ? "✓ Paket Aktif" : plan.cta}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div
                    style={{
                        textAlign: "center",
                        fontSize: 12,
                        color: "var(--color-subtle)",
                        padding: "12px 16px",
                        borderRadius: 14,
                        background: "rgba(255,255,255,.02)",
                        border: "1px solid var(--glass-border)",
                    }}
                >
                    🔒 Pembayaran aman via Midtrans · Bisa dibatalkan kapan saja · Support 24/7
                </div>
            </div>
        </div>
    );
};

export default PricingModal;
