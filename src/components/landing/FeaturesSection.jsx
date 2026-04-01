import FadeIn from "../ui/FadeIn";
import { useLanguage } from "../../i18n/LanguageContext";

const FEATURE_ICONS  = ["🏦", "🤖", "🎯", "📊", "🔀", "🔮"];

const FeaturesSection = () => {
    const { t } = useLanguage();

    const features = [1, 2, 3, 4, 5, 6].map((n, i) => ({
        i: FEATURE_ICONS[i],
        t: t(`lp.features.f${n}t`),
        d: t(`lp.features.f${n}d`),
    }));

    return (
        <section id="fitur" style={{ padding: "96px 24px", background: "#13131a", position: "relative" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <FadeIn>
                    <div style={{ marginBottom: 56 }}>
                        <span style={{ color: "#60fcc6", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontSize: 13, display: "block", marginBottom: 12 }}>{t("lp.features.tag")}</span>
                        <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.15 }}>
                            {t("lp.features.h2")} <br />
                            <span style={{ background: "linear-gradient(90deg,#60fcc6,#19ce9b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t("lp.features.h2g")}</span>
                        </h2>
                    </div>
                </FadeIn>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
                    {features.map((f, i) => (
                        <FadeIn key={i} delay={i * .07}>
                            <div style={{
                                background: "rgba(255,255,255,.04)",
                                backdropFilter: "blur(20px)",
                                border: "1px solid rgba(255,255,255,.07)",
                                borderRadius: 16,
                                padding: 32,
                                transition: "border-color .25s",
                                cursor: "default",
                            }}
                            onMouseOver={e => e.currentTarget.style.borderColor = "rgba(96,252,198,.35)"}
                            onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,.07)"}
                            >
                                <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(96,252,198,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 20, transition: "transform .2s" }}>
                                    {f.i}
                                </div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{f.t}</h3>
                                <p style={{ color: "#acaab4", lineHeight: 1.7, fontSize: 14, margin: 0 }}>{f.d}</p>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;
