const plans = [
    {
        id: "trial",
        name: "Free Trial",
        price: "Gratis",
        period: "14 hari",
        color: "#6366f1",
        gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)",
        features: [
            "✅ Semua fitur dasar",
            "✅ Catat transaksi",
            "✅ Kelola akun & kategori",
            "✅ Dashboard & ringkasan",
            "❌ Laporan lanjutan",
            "❌ AI Coach",
            "❌ Ekspor laporan",
        ],
        cta: "Paket saat ini",
        disabled: true,
    },
    {
        id: "starter",
        name: "Starter",
        price: "Rp 29.000",
        period: "/bulan",
        color: "#10b981",
        gradient: "linear-gradient(135deg,#10b981,#059669)",
        badge: "Populer",
        features: [
            "✅ Semua fitur Free Trial",
            "✅ Laporan & Analitik lengkap",
            "✅ Target Finansial (Goals)",
            "✅ Hutang & Cicilan",
            "✅ Transaksi Berulang",
            "❌ AI Coach",
            "❌ Investasi & Aset",
        ],
        cta: "Pilih Starter",
        disabled: false,
    },
    {
        id: "pro",
        name: "Pro",
        price: "Rp 79.000",
        period: "/3 bulan",
        color: "#f59e0b",
        gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
        badge: "Terbaik",
        features: [
            "✅ Semua fitur Starter",
            "✅ AI Coach (analisis pintar)",
            "✅ Investasi & Aset",
            "✅ Ekspor laporan PDF/Excel",
            "✅ Multi-device sync",
            "✅ Prioritas support",
            "✅ Fitur eksklusif baru",
        ],
        cta: "Pilih Pro",
        disabled: false,
    },
];

const PricingModal = ({ open, onClose, currentPlan }) => {
    if (!open) return null;

    const handleChoose = (planId) => {
        // TODO: Integrasikan dengan Midtrans payment gateway
        // Sementara tampilkan info
        alert(`Pembayaran untuk paket ${planId.toUpperCase()} akan segera tersedia!\n\nHubungi admin untuk upgrade manual.`);
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 20,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: "#0f0f1a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 20,
                    padding: "32px 28px",
                    width: "100%",
                    maxWidth: 860,
                    maxHeight: "90vh",
                    overflowY: "auto",
                }}
            >
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>💎</div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
                        Pilih Paket Langganan
                    </h2>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                        Akses semua fitur Karaya dan kelola keuangan lebih cerdas
                    </p>
                </div>

                {/* Plans Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
                    {plans.map(plan => {
                        const isActive = currentPlan === plan.id || (!currentPlan && plan.id === "trial");
                        return (
                            <div
                                key={plan.id}
                                style={{
                                    background: isActive
                                        ? `linear-gradient(180deg, rgba(${plan.id === "starter" ? "16,185,129" : plan.id === "pro" ? "245,158,11" : "99,102,241"},.12) 0%, transparent 100%)`
                                        : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${isActive ? plan.color + "55" : "rgba(255,255,255,0.06)"}`,
                                    borderRadius: 16,
                                    padding: 24,
                                    position: "relative",
                                    transition: "transform 0.2s",
                                    cursor: "default",
                                }}
                            >
                                {/* Badge */}
                                {plan.badge && (
                                    <div style={{
                                        position: "absolute", top: -10, right: 16,
                                        background: plan.gradient,
                                        color: "#fff", fontSize: 10, fontWeight: 700,
                                        padding: "3px 10px", borderRadius: 20,
                                        letterSpacing: 0.5,
                                    }}>
                                        {plan.badge}
                                    </div>
                                )}

                                {/* Active badge */}
                                {isActive && (
                                    <div style={{
                                        position: "absolute", top: -10, left: 16,
                                        background: "rgba(99,102,241,.8)",
                                        color: "#fff", fontSize: 10, fontWeight: 700,
                                        padding: "3px 10px", borderRadius: 20,
                                    }}>
                                        ✓ Aktif
                                    </div>
                                )}

                                {/* Plan name */}
                                <div style={{ fontSize: 16, fontWeight: 700, color: plan.color, marginBottom: 4 }}>
                                    {plan.name}
                                </div>

                                {/* Price */}
                                <div style={{ marginBottom: 20 }}>
                                    <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{plan.price}</span>
                                    <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>{plan.period}</span>
                                </div>

                                {/* Features */}
                                <div style={{ marginBottom: 20 }}>
                                    {plan.features.map((f, i) => (
                                        <div key={i} style={{
                                            fontSize: 12, color: f.startsWith("❌") ? "#475569" : "#94a3b8",
                                            padding: "4px 0",
                                            lineHeight: 1.5,
                                        }}>
                                            {f}
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Button */}
                                <button
                                    onClick={() => !plan.disabled && handleChoose(plan.id)}
                                    disabled={plan.disabled || isActive}
                                    style={{
                                        width: "100%",
                                        padding: "10px 0",
                                        borderRadius: 10,
                                        border: "none",
                                        background: isActive
                                            ? "rgba(255,255,255,0.05)"
                                            : plan.disabled
                                                ? "rgba(255,255,255,0.05)"
                                                : plan.gradient,
                                        color: isActive || plan.disabled ? "#475569" : "#fff",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: isActive || plan.disabled ? "default" : "pointer",
                                        fontFamily: "inherit",
                                        transition: "opacity 0.2s",
                                    }}
                                >
                                    {isActive ? "✓ Paket Aktif" : plan.cta}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer note */}
                <div style={{ textAlign: "center", fontSize: 12, color: "#475569", marginBottom: 20 }}>
                    🔒 Pembayaran aman via Midtrans · Bisa dibatalkan kapan saja · Support 24/7
                </div>

                {/* Close button */}
                <div style={{ textAlign: "center" }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: "8px 28px", borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "transparent", color: "#64748b",
                            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                        }}
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PricingModal;
