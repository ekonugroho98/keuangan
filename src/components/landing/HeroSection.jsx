import FadeIn from "../ui/FadeIn";
import CountUp from "../ui/CountUp";
import { useLanguage } from "../../i18n/LanguageContext";

const HeroSection = ({ onSignup, onDemo }) => {
    const { t } = useLanguage();

    const stats = [
        { v: 500, s: "+",  l: t("lp.hero.users") },
        { v: 98,  s: "%",  l: t("lp.hero.satisfaction") },
        { v: 2,   s: "M+", l: t("lp.hero.tx") },
    ];

    return (
        <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "120px 24px 80px" }}>
            <div style={{ position: "absolute", top: "10%", left: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,.15),transparent 70%)", animation: "float 8s ease-in-out infinite", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "15%", right: "10%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,.12),transparent 70%)", animation: "float 10s ease-in-out infinite 2s", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(99,102,241,.08) 1px,transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

            <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
                <FadeIn>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 50, background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.2)", marginBottom: 32 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "pulse 2s ease infinite" }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#a5b4fc" }}>{t("lp.hero.badge")}</span>
                    </div>
                </FadeIn>

                <FadeIn delay={0.1}>
                    <h1 style={{ fontSize: "clamp(40px,7vw,72px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 24, letterSpacing: "-.03em" }}>
                        {t("lp.hero.h1")}<br /><span className="gradient-text">{t("lp.hero.h1g")}</span>
                    </h1>
                </FadeIn>

                <FadeIn delay={0.2}>
                    <p style={{ fontSize: "clamp(16px,2.5vw,20px)", color: "#94a3b8", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
                        {t("lp.hero.desc")}
                    </p>
                </FadeIn>

                <FadeIn delay={0.3}>
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                        <button className="btn-primary" style={{ fontSize: 16, padding: "16px 40px" }} onClick={onSignup}>{t("lp.hero.cta")}</button>
                        <button className="btn-secondary" style={{ fontSize: 16, padding: "16px 40px" }} onClick={onDemo}>{t("lp.hero.demo")}</button>
                    </div>
                </FadeIn>

                <FadeIn delay={0.4}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 48, marginTop: 64, flexWrap: "wrap" }}>
                        {stats.map((s, i) => (
                            <div key={i} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 32, fontWeight: 800, color: "#fff" }}><CountUp end={s.v} suffix={s.s} /></div>
                                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{s.l}</div>
                            </div>
                        ))}
                    </div>
                </FadeIn>
            </div>
        </section>
    );
};

export default HeroSection;
