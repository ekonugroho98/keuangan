import { useState, useEffect } from "react";
import { fmtRp } from "../../../utils/formatters";

const glassCard = {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: "22px 26px",
    background: "var(--glass-1)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-highlight), 0 2px 8px rgba(0,0,0,.08)",
};

const eyebrow = {
    fontSize: 10,
    fontWeight: 800,
    color: "var(--color-subtle)",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    lineHeight: 1,
};

const sectionTitle = {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--color-text)",
    letterSpacing: "-.02em",
    margin: 0,
    lineHeight: 1.2,
};

// Fallback kurasi sembako & promo akhir pekan (JSM / Gajian) terhemat
const CURATED_PROMOS = [
    {
        id: "cur-1",
        store: "Superindo",
        storeColor: "#15803d",
        name: "Mangga Alpukat Fresh",
        unit: "per 100g",
        normal_price: 4990,
        promo_price: 1990,
        discount_percent: 60,
        tag: "Buah Segar",
    },
    {
        id: "cur-2",
        store: "Superindo",
        storeColor: "#15803d",
        name: "Minyak Goreng Tropical 2L",
        unit: "Pouch 2L",
        normal_price: 42000,
        promo_price: 33900,
        discount_percent: 19,
        tag: "Sembako Dapur",
    },
    {
        id: "cur-3",
        store: "Alfamart",
        storeColor: "#dc2626",
        name: "Gentle Gen Detergen Breeze",
        unit: "Pouch 700g",
        normal_price: 19900,
        promo_price: 12900,
        discount_percent: 35,
        tag: "Kebersihan",
    },
    {
        id: "cur-4",
        store: "Superindo",
        storeColor: "#15803d",
        name: "365 Telur Ayam Omega 10s",
        unit: "Pack 10 butir",
        normal_price: 34900,
        promo_price: 27900,
        discount_percent: 20,
        tag: "Nutrisi Anak",
    },
];

export default function PromoRadarWidget({ onOpenShopping }) {
    const [promos, setPromos] = useState(CURATED_PROMOS);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchLivePromos = async () => {
            try {
                const apiBase = import.meta.env.VITE_PRICES_API_BASE_URL || "https://karaya-api-jec2.vercel.app";
                const res = await fetch(`${apiBase}/api/promos/alfagift?limit=4`, {
                    signal: AbortSignal.timeout(3500),
                });
                if (!res.ok) return;
                const json = await res.json();
                if (isMounted && Array.isArray(json.data) && json.data.length > 0) {
                    const mapped = json.data.map((item, idx) => ({
                        id: item.id || `live-${idx}`,
                        store: "Alfamart",
                        storeColor: "#dc2626",
                        name: item.name,
                        unit: "Alfagift Live",
                        normal_price: item.normal_price,
                        promo_price: item.promo_price,
                        discount_percent: item.discount_percent,
                        tag: item.category ? item.category.replace("_", " ") : "Promo Hemat",
                    }));
                    // Gabungkan live dengan rekomendasi Superindo
                    const mixed = [CURATED_PROMOS[0], CURATED_PROMOS[1], mapped[0], mapped[1]].filter(Boolean);
                    setPromos(mixed.slice(0, 4));
                    setIsLive(true);
                }
            } catch {
                // Silently fallback ke kurasi lokal
            }
        };

        fetchLivePromos();
        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div
            className="b-promo"
            style={{
                ...glassCard,
                background: "linear-gradient(135deg, rgba(21,128,61,0.06), rgba(30,58,138,0.04))",
                border: "1px solid rgba(21,128,61,0.18)",
            }}
        >
            {/* Header Widget */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 16,
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={eyebrow}>Radar Belanja Swalayan</span>
                        <span
                            className="chip chip-mint"
                            style={{
                                fontSize: 9.5,
                                padding: "2px 8px",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                            }}
                        >
                            {isLive ? "🟢 Data Terkini" : "🏷️ Promo Weekend (JSM)"}
                        </span>
                    </div>
                    <h3 style={{ ...sectionTitle, fontSize: 17, marginTop: 6 }}>
                        🛒 Rekomendasi Diskon Sembako & Kebutuhan Rumah Tangga
                    </h3>
                </div>

                {onOpenShopping && (
                    <button
                        type="button"
                        onClick={onOpenShopping}
                        style={{
                            padding: "7px 14px",
                            borderRadius: 99,
                            background: "var(--color-primary-soft)",
                            border: "1px solid var(--color-primary)",
                            color: "var(--color-primary)",
                            fontSize: 11.5,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            transition: "background .2s, transform .1s",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                        onMouseOut={(e) => (e.currentTarget.style.transform = "")}
                    >
                        ⚖️ Bandingkan Toko & Keranjang →
                    </button>
                )}
            </div>

            {/* List 4 Deal Chips */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                }}
            >
                {promos.map((item) => (
                    <div
                        key={item.id}
                        style={{
                            padding: "14px 16px",
                            borderRadius: 16,
                            background: "var(--bg-surface-low)",
                            border: "1px solid var(--glass-border)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: 10,
                        }}
                    >
                        {/* Store Tag & Discount */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: item.storeColor,
                                    background: `${item.storeColor}18`,
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                }}
                            >
                                {item.store}
                            </span>
                            {item.discount_percent > 0 && (
                                <span
                                    className="chip chip-amber"
                                    style={{ fontSize: 10, fontWeight: 900, padding: "2px 6px" }}
                                >
                                    Diskon {item.discount_percent}%
                                </span>
                            )}
                        </div>

                        {/* Product Title */}
                        <div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--color-text)",
                                    lineHeight: 1.3,
                                    marginBottom: 4,
                                }}
                            >
                                {item.name}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--color-subtle)" }}>{item.unit}</div>
                        </div>

                        {/* Price Details */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                            <span
                                className="num-tight mono"
                                style={{
                                    fontSize: 18,
                                    fontWeight: 900,
                                    color: "var(--color-primary)",
                                    letterSpacing: "-.02em",
                                }}
                            >
                                {fmtRp(item.promo_price)}
                            </span>
                            {item.normal_price && item.normal_price > item.promo_price && (
                                <span
                                    className="mono"
                                    style={{
                                        fontSize: 11,
                                        color: "var(--color-subtle)",
                                        textDecoration: "line-through",
                                    }}
                                >
                                    {fmtRp(item.normal_price)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Smart Tip Bar */}
            <div
                style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px dashed var(--glass-border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 11.5,
                    color: "var(--color-muted)",
                    lineHeight: 1.4,
                }}
            >
                <span style={{ fontSize: 16 }}>💡</span>
                <span>
                    <strong style={{ color: "var(--color-text)" }}>Tips Belanja Cerdas:</strong> Bandingkan harga
                    sebelum belanja mingguan. Memilah komoditas segar di Superindo dan detergen promo di Alfamart bisa
                    menghemat hingga <strong style={{ color: "var(--color-primary)" }}>Rp 35.000</strong> per minggu!
                </span>
            </div>
        </div>
    );
}
