import { useState } from "react";
import FadeIn from "../ui/FadeIn";
import { useLanguage } from "../../i18n/LanguageContext";

const FaqSection = () => {
    const { t } = useLanguage();
    const [activeFaq, setActiveFaq] = useState(null);

    const faqs = [1, 2, 3, 4, 5].map(n => ({
        q: t(`lp.faq.${n}q`),
        a: t(`lp.faq.${n}a`),
    }));

    return (
        <section id="faq" style={{ padding: "80px 24px" }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
                <FadeIn>
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                        <span className="tag" style={{ background: "rgba(245,158,11,.1)", color: "#fbbf24" }}>{t("lp.faq.tag")}</span>
                        <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, marginTop: 16, color: "#fff" }}>
                            {t("lp.faq.h2")} <span className="gradient-text">{t("lp.faq.h2g")}</span>
                        </h2>
                    </div>
                </FadeIn>
                {faqs.map((f, i) => (
                    <FadeIn key={i} delay={i * .05}>
                        <div
                            onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                            style={{ background: "rgba(25,25,33,.6)", border: `1px solid ${activeFaq === i ? "rgba(96,252,198,.3)" : "rgba(255,255,255,.06)"}`, borderRadius: 14, padding: "18px 22px", cursor: "pointer", transition: "all .3s", marginBottom: 10 }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{f.q}</h3>
                                <span style={{ color: "#60fcc6", fontSize: 18, transform: activeFaq === i ? "rotate(45deg)" : "none", transition: "transform .3s", flexShrink: 0, marginLeft: 16 }}>+</span>
                            </div>
                            {activeFaq === i && <p style={{ marginTop: 14, color: "var(--color-muted)", lineHeight: 1.7, fontSize: 13, animation: "slideUp .3s" }}>{f.a}</p>}
                        </div>
                    </FadeIn>
                ))}
            </div>
        </section>
    );
};

export default FaqSection;
