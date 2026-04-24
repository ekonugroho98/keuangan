import FadeIn from "../ui/FadeIn";
import { useLanguage } from "../../i18n/LanguageContext";

/* Bento feature cards — asymmetric grid, hero feature spans 2 cols */
const FEATURES_META = [
    { icon: "🏦", grad: "linear-gradient(135deg,#60fcc6,#19ce9b)", tint: "rgba(96,252,198,.12)", stat: "12+", statLabel: "Bank & e-wallet", span: 2 },
    { icon: "🤖", grad: "linear-gradient(135deg,#a78bfa,#7c3aed)", tint: "rgba(167,139,250,.12)", stat: "24/7", statLabel: "AI Coach", span: 1 },
    { icon: "🎯", grad: "linear-gradient(135deg,#4FC3F7,#0284c7)", tint: "rgba(79,195,247,.12)", stat: null, span: 1 },
    { icon: "📊", grad: "linear-gradient(135deg,#fbbf24,#f59e0b)", tint: "rgba(251,191,36,.12)", stat: null, span: 1 },
    { icon: "🔀", grad: "linear-gradient(135deg,#ff716c,#e11d48)", tint: "rgba(255,113,108,.12)", stat: null, span: 1 },
    { icon: "🔮", grad: "linear-gradient(135deg,#60fcc6,#4FC3F7)", tint: "rgba(96,252,198,.12)", stat: "AI", statLabel: "Prediction", span: 2 },
];

const FeatureCard = ({ feature, meta, featured }) => (
    <div
        className="bento bento-hover"
        style={{
            padding: featured ? 36 : 28,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            cursor: "default",
        }}
        onMouseOver={e => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.borderColor = "rgba(96,252,198,.35)";
        }}
        onMouseOut={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "";
        }}
    >
        {/* Decorative glow */}
        <div style={{
            position: "absolute", top: -60, right: -60, width: 180, height: 180,
            background: `radial-gradient(circle, ${meta.tint}, transparent 70%)`,
            pointerEvents: "none", filter: "blur(30px)",
        }} />

        <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: meta.grad,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
            boxShadow: `0 12px 28px ${meta.tint}`,
            position: "relative", zIndex: 1,
        }}>{meta.icon}</div>

        <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <h3 style={{
                fontSize: featured ? "clamp(20px,2vw,26px)" : 18,
                fontWeight: 800,
                color: "var(--color-text)",
                marginBottom: 10,
                letterSpacing: "-.02em",
                lineHeight: 1.2,
            }}>{feature.t}</h3>
            <p style={{
                color: "var(--color-muted)",
                lineHeight: 1.65,
                fontSize: featured ? 15 : 13.5,
                margin: 0,
            }}>{feature.d}</p>
        </div>

        {meta.stat && (
            <div style={{
                display: "flex", alignItems: "baseline", gap: 8,
                paddingTop: 16,
                borderTop: "1px solid var(--color-border-soft)",
                position: "relative", zIndex: 1,
            }}>
                <span className="num-tight" style={{ fontSize: 26, fontWeight: 900, color: "var(--color-text)" }}>{meta.stat}</span>
                <span style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>{meta.statLabel}</span>
            </div>
        )}
    </div>
);

const FeaturesSection = () => {
    const { t } = useLanguage();

    const features = [1, 2, 3, 4, 5, 6].map((n, i) => ({
        i: FEATURES_META[i].icon,
        t: t(`lp.features.f${n}t`),
        d: t(`lp.features.f${n}d`),
    }));

    return (
        <section id="fitur" style={{ padding: "100px 24px", position: "relative", overflow: "hidden" }}>
            {/* Ambient aurora */}
            <div aria-hidden style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(600px 400px at 15% 20%, rgba(96,252,198,.06), transparent 60%), radial-gradient(500px 300px at 85% 80%, rgba(167,139,250,.05), transparent 60%)",
            }} />

            <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 1 }}>
                <FadeIn>
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "6px 14px", borderRadius: 99,
                            background: "rgba(96,252,198,.08)",
                            border: "1px solid rgba(96,252,198,.22)",
                            marginBottom: 20, backdropFilter: "blur(12px)",
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-primary)", animation: "pulse 2s infinite" }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", letterSpacing: 1.2 }}>{t("lp.features.tag")}</span>
                        </div>
                        <h2 style={{
                            fontSize: "clamp(32px, 5vw, 56px)",
                            fontWeight: 900, letterSpacing: "-.04em",
                            color: "var(--color-text)", lineHeight: 1.05, marginBottom: 16,
                        }}>
                            {t("lp.features.h2")}<br />
                            <span className="gradient-text">{t("lp.features.h2g")}</span>
                        </h2>
                        <p style={{
                            fontSize: "clamp(14px, 1.5vw, 17px)",
                            color: "var(--color-muted)",
                            maxWidth: 620, margin: "0 auto", lineHeight: 1.65,
                        }}>
                            {t("lp.features.desc") || ""}
                        </p>
                    </div>
                </FadeIn>

                <div
                    className="features-bento-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 20,
                    }}
                >
                    {features.map((f, i) => {
                        const meta = FEATURES_META[i];
                        const featured = meta.span === 2;
                        return (
                            <div key={i} style={{ gridColumn: `span ${meta.span}` }} className={featured ? "features-bento-span2" : "features-bento-span1"}>
                                <FadeIn delay={i * .06}>
                                    <FeatureCard feature={f} meta={meta} featured={featured} />
                                </FadeIn>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @media (max-width: 900px) {
                    .features-bento-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    .features-bento-span2 { grid-column: span 2 !important; }
                    .features-bento-span1 { grid-column: span 1 !important; }
                }
                @media (max-width: 640px) {
                    .features-bento-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
                    .features-bento-span2, .features-bento-span1 { grid-column: span 1 !important; }
                    section#fitur { padding: 60px 20px !important; }
                }
            `}</style>
        </section>
    );
};

export default FeaturesSection;
