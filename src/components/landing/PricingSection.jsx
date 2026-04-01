import FadeIn from "../ui/FadeIn";
import GlowCard from "../ui/GlowCard";
import { plans } from "../../constants/plans";
import { useLanguage } from "../../i18n/LanguageContext";

const PricingSection = ({ onSelectPlan }) => {
    const { t } = useLanguage();

    return (
        <section id="harga" style={{ padding: "80px 24px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <FadeIn>
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                        <span className="tag" style={{ background: "rgba(79,195,247,.1)", color: "#4FC3F7" }}>{t("lp.pricing.tag")}</span>
                        <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, marginTop: 16, color: "#fff" }}>
                            {t("lp.pricing.h2")} <span className="gradient-text">{t("lp.pricing.h2g")}</span>
                        </h2>
                    </div>
                </FadeIn>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
                    {plans.map((p, i) => (
                        <FadeIn key={i} delay={i * .08}>
                            <div style={{ position: "relative" }}>
                                {p.best && (
                                    <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "5px 18px", borderRadius: 20, background: "linear-gradient(135deg,#4FC3F7,#60fcc6)", fontSize: 10, fontWeight: 700, color: "#fff", zIndex: 2, whiteSpace: "nowrap" }}>🔥 BEST VALUE</div>
                                )}
                                <GlowCard glowColor={`${p.color}22`}>
                                    <div style={{ padding: 28, textAlign: "center", border: p.best ? `1px solid ${p.color}44` : "none", borderRadius: 20 }}>
                                        <span className="tag" style={{ background: `${p.color}15`, color: p.color }}>{p.badge}</span>
                                        <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 14 }}>{p.name}</h3>
                                        <div style={{ fontSize: 12, color: "#76747e", marginTop: 4 }}>{p.duration}</div>
                                        <div style={{ margin: "20px 0" }}>
                                            <span style={{ fontSize: 13, color: "#76747e", textDecoration: "line-through" }}>Rp {p.original.toLocaleString()}</span>
                                            <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginTop: 4 }}>{p.price === 0 ? "GRATIS" : `Rp ${p.price.toLocaleString()}`}</div>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, textAlign: "left" }}>
                                            {p.features.map((f, j) => (
                                                <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#c5c5d9" }}>
                                                    <span style={{ color: p.color }}>✓</span> {f}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => onSelectPlan(p)}
                                            style={{ width: "100%", padding: 12, borderRadius: 12, border: p.best ? "none" : "1px solid rgba(255,255,255,.1)", background: p.best ? `linear-gradient(135deg,${p.color},#60fcc6)` : "rgba(255,255,255,.05)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all .3s" }}
                                        >{p.price === 0 ? t("lp.pricing.free") : t("lp.pricing.paid")}</button>
                                    </div>
                                </GlowCard>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default PricingSection;
