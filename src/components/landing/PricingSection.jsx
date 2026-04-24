import FadeIn from "../ui/FadeIn";
import { plans } from "../../constants/plans";
import { useLanguage } from "../../i18n/LanguageContext";

const PricingSection = ({ onSelectPlan }) => {
    const { t } = useLanguage();

    return (
        <section id="harga" style={{ padding: "100px 24px", position: "relative", overflow: "hidden" }}>
            {/* Ambient aurora */}
            <div aria-hidden style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(700px 500px at 50% 0%, rgba(96,252,198,.08), transparent 60%), radial-gradient(500px 400px at 90% 80%, rgba(79,195,247,.06), transparent 60%)",
            }} />

            <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 1 }}>
                <FadeIn>
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "6px 14px", borderRadius: 99,
                            background: "rgba(79,195,247,.10)",
                            border: "1px solid rgba(79,195,247,.26)",
                            marginBottom: 20, backdropFilter: "blur(12px)",
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: "#4FC3F7", animation: "pulse 2s infinite" }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#4FC3F7", letterSpacing: 1.2 }}>{t("lp.pricing.tag")}</span>
                        </div>
                        <h2 style={{
                            fontSize: "clamp(32px, 5vw, 56px)",
                            fontWeight: 900, letterSpacing: "-.04em",
                            color: "var(--color-text)", lineHeight: 1.05, marginBottom: 16,
                        }}>
                            {t("lp.pricing.h2")}<br />
                            <span className="gradient-text">{t("lp.pricing.h2g")}</span>
                        </h2>
                        <p style={{
                            fontSize: "clamp(14px, 1.5vw, 17px)",
                            color: "var(--color-muted)",
                            maxWidth: 620, margin: "0 auto", lineHeight: 1.65,
                        }}>
                            {t("lp.pricing.desc") || ""}
                        </p>
                    </div>
                </FadeIn>

                <div className="pricing-grid" style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${plans.length}, 1fr)`,
                    gap: 18,
                    alignItems: "stretch",
                }}>
                    {plans.map((p, i) => {
                        const isBest = p.best;
                        const save = p.original && p.price ? Math.round((1 - p.price / p.original) * 100) : 0;
                        return (
                            <FadeIn key={i} delay={i * .08}>
                                <div
                                    className={`bento${isBest ? " bento-glow" : ""}`}
                                    style={{
                                        position: "relative",
                                        padding: 28,
                                        height: "100%",
                                        display: "flex", flexDirection: "column",
                                        transform: isBest ? "translateY(-8px)" : "none",
                                        boxShadow: isBest
                                            ? "0 28px 60px rgba(6,182,212,.25), 0 0 0 1px rgba(96,252,198,.35)"
                                            : undefined,
                                        borderColor: isBest ? "rgba(96,252,198,.4)" : undefined,
                                    }}
                                >
                                    {isBest && (
                                        <div style={{
                                            position: "absolute", top: -14, left: "50%",
                                            transform: "translateX(-50%)",
                                            padding: "5px 16px", borderRadius: 99,
                                            background: "linear-gradient(135deg,#60fcc6,#19ce9b)",
                                            fontSize: 10.5, fontWeight: 900, color: "#003828",
                                            letterSpacing: 1, whiteSpace: "nowrap",
                                            boxShadow: "0 10px 24px rgba(96,252,198,.45)",
                                            zIndex: 2,
                                        }}>POPULAR</div>
                                    )}

                                    {/* Badge */}
                                    <div style={{
                                        display: "inline-flex", alignSelf: "flex-start",
                                        padding: "4px 12px", borderRadius: 99,
                                        background: `${p.color}18`,
                                        border: `1px solid ${p.color}44`,
                                        color: p.color,
                                        fontSize: 10.5, fontWeight: 800, letterSpacing: .6,
                                        marginBottom: 16,
                                    }}>{p.badge}</div>

                                    {/* Name */}
                                    <h3 style={{
                                        fontSize: 24, fontWeight: 900,
                                        color: "var(--color-text)",
                                        marginBottom: 4, letterSpacing: "-.02em",
                                    }}>{p.name}</h3>
                                    <div style={{ fontSize: 12.5, color: "var(--color-muted)", marginBottom: 22 }}>{p.duration}</div>

                                    {/* Price */}
                                    <div style={{ marginBottom: 24 }}>
                                        {p.original > 0 && (
                                            <div style={{
                                                fontSize: 12, color: "var(--color-subtle)",
                                                textDecoration: "line-through",
                                                marginBottom: 2,
                                            }}>Rp {p.original.toLocaleString()}</div>
                                        )}
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                                            <span className="num-tight" style={{
                                                fontSize: "clamp(32px,3.5vw,44px)",
                                                fontWeight: 900, color: "var(--color-text)",
                                                lineHeight: 1, letterSpacing: "-.03em",
                                            }}>
                                                {p.price === 0 ? "GRATIS" : `Rp ${p.price.toLocaleString()}`}
                                            </span>
                                            {save > 0 && (
                                                <span className="chip chip-mint" style={{ fontSize: 10, padding: "3px 8px" }}>−{save}%</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Features */}
                                    <div style={{
                                        display: "flex", flexDirection: "column", gap: 12,
                                        marginBottom: 28, flex: 1,
                                    }}>
                                        {p.features.map((f, j) => (
                                            <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--color-text)" }}>
                                                <span style={{
                                                    width: 18, height: 18, borderRadius: 6,
                                                    background: `${p.color}22`,
                                                    color: p.color,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 10, fontWeight: 900, flexShrink: 0,
                                                    marginTop: 1,
                                                }}>✓</span>
                                                <span style={{ lineHeight: 1.5 }}>{f}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* CTA */}
                                    <button
                                        onClick={() => onSelectPlan(p)}
                                        className={isBest ? "btn-primary" : "btn-secondary"}
                                        style={{
                                            width: "100%",
                                            fontSize: 14,
                                            padding: "14px 20px",
                                            justifyContent: "center",
                                        }}
                                    >{p.price === 0 ? t("lp.pricing.free") : t("lp.pricing.paid")}</button>
                                </div>
                            </FadeIn>
                        );
                    })}
                </div>

                {/* Guarantee strip */}
                <FadeIn delay={.4}>
                    <div style={{
                        textAlign: "center", marginTop: 48,
                        display: "inline-flex", alignItems: "center", gap: 10,
                        padding: "10px 20px", borderRadius: 99,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--color-border-soft)",
                        backdropFilter: "blur(12px)",
                        width: "fit-content", marginLeft: "50%", transform: "translateX(-50%)",
                    }}>
                        <span style={{ fontSize: 16 }}>🛡️</span>
                        <span style={{ fontSize: 13, color: "var(--color-muted)", fontWeight: 500 }}>
                            {t("lp.pricing.guarantee") || "Jaminan uang kembali 14 hari · Tanpa kontrak · Batalkan kapan saja"}
                        </span>
                    </div>
                </FadeIn>
            </div>

            <style>{`
                @media (max-width: 1024px) {
                    .pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
                }
                @media (max-width: 640px) {
                    .pricing-grid { grid-template-columns: 1fr !important; }
                    section#harga { padding: 60px 20px !important; }
                }
            `}</style>
        </section>
    );
};

export default PricingSection;
