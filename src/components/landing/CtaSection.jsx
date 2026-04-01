import FadeIn from "../ui/FadeIn";
import { useLanguage } from "../../i18n/LanguageContext";

const CtaSection = ({ onSignup }) => {
    const { t } = useLanguage();

    return (
        <section style={{ padding: "80px 24px" }}>
            <div style={{ maxWidth: 750, margin: "0 auto" }}>
                <FadeIn>
                    <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", padding: "56px 36px", textAlign: "center" }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(96,252,198,.15),rgba(79,195,247,.08))", border: "1px solid rgba(96,252,198,.25)", borderRadius: 24 }} />
                        <div style={{ position: "relative", zIndex: 1 }}>
                            <h2 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 800, color: "#fff", marginBottom: 14 }}>{t("lp.cta.h2")}</h2>
                            <p style={{ color: "#94a3b8", fontSize: 16, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.7 }}>{t("lp.cta.desc")}</p>
                            <button className="btn-primary" style={{ fontSize: 16, padding: "16px 44px" }} onClick={onSignup}>{t("lp.cta.btn")}</button>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
};

export default CtaSection;
