import FadeIn from "../ui/FadeIn";
import GlowCard from "../ui/GlowCard";
import { useLanguage } from "../../i18n/LanguageContext";

const FEATURE_ICONS  = ["🏦", "🤖", "🎯", "📊", "🔀", "🔮"];
const FEATURE_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

const FeaturesSection = () => {
    const { t } = useLanguage();

    const features = [1, 2, 3, 4, 5, 6].map((n, i) => ({
        i: FEATURE_ICONS[i],
        t: t(`lp.features.f${n}t`),
        d: t(`lp.features.f${n}d`),
        c: FEATURE_COLORS[i],
    }));

    return (
        <section id="fitur" style={{ padding: "80px 24px", position: "relative" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <FadeIn>
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <span className="tag" style={{ background: "rgba(99,102,241,.1)", color: "#818cf8" }}>{t("lp.features.tag")}</span>
                        <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, marginTop: 16, color: "#fff" }}>
                            {t("lp.features.h2")} <span className="gradient-text">{t("lp.features.h2g")}</span>
                        </h2>
                    </div>
                </FadeIn>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>
                    {features.map((f, i) => (
                        <FadeIn key={i} delay={i * .07}>
                            <GlowCard glowColor={`${f.c}22`}>
                                <div style={{ padding: 28 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${f.c}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{f.i}</div>
                                        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{f.t}</h3>
                                    </div>
                                    <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: 14 }}>{f.d}</p>
                                </div>
                            </GlowCard>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;
