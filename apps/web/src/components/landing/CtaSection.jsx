import FadeIn from "../ui/FadeIn";
import { useLanguage } from "../../i18n/LanguageContext";

const CtaSection = ({ onSignup }) => {
    const { t } = useLanguage();

    const stats = [
        { v: "100%", l: t("lp.hero.users") || "Privasi Keluarga" },
        { v: "24/7", l: t("lp.hero.satisfaction") || "Asisten AI Siaga" },
        { v: "1 Atap", l: t("lp.hero.tx") || "Keuangan & Rumah" },
    ];

    return (
        <section style={{ padding: "100px 24px", position: "relative", overflow: "hidden" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
                <FadeIn>
                    <div
                        className="bento bento-glow"
                        style={{
                            position: "relative",
                            padding: "clamp(40px, 6vw, 72px) clamp(24px, 5vw, 56px)",
                            borderRadius: 32,
                            textAlign: "center",
                            overflow: "hidden",
                            background: "var(--bg-elevated)",
                            backdropFilter: "blur(24px)",
                            borderColor: "var(--color-border)",
                            boxShadow: "0 24px 64px rgba(35,46,38,.12), 0 0 0 1px var(--color-border-soft)",
                        }}
                    >
                        {/* Ambient aurora orbs */}
                        <div aria-hidden style={{
                            position: "absolute", top: "-40%", left: "-10%",
                            width: "60%", height: "180%",
                            background: "radial-gradient(circle, rgba(70,99,78,.14), transparent 60%)",
                            filter: "blur(80px)", pointerEvents: "none",
                        }} />
                        <div aria-hidden style={{
                            position: "absolute", bottom: "-40%", right: "-10%",
                            width: "60%", height: "180%",
                            background: "radial-gradient(circle, rgba(181,105,74,.14), transparent 60%)",
                            filter: "blur(80px)", pointerEvents: "none",
                        }} />
                        <div aria-hidden style={{
                            position: "absolute", top: "20%", right: "20%",
                            width: 200, height: 200,
                            background: "radial-gradient(circle, rgba(131,155,122,.16), transparent 60%)",
                            filter: "blur(60px)", pointerEvents: "none",
                        }} />

                        <div style={{ position: "relative", zIndex: 1 }}>
                            {/* Eyebrow */}
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: 8,
                                padding: "6px 14px", borderRadius: 99,
                                background: "var(--bg-surface-low)",
                                border: "1px solid var(--color-border)",
                                marginBottom: 24, backdropFilter: "blur(12px)",
                            }}>
                                <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-primary)", animation: "pulse 2s infinite" }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", letterSpacing: 1.2 }}>
                                    {t("lp.cta.tag") || "MULAI SEKARANG"}
                                </span>
                            </div>

                            <h2 style={{
                                fontSize: "clamp(32px, 5.5vw, 60px)",
                                fontWeight: 600, letterSpacing: "-.03em",
                                color: "var(--color-text)", lineHeight: 1.08,
                                marginBottom: 20,
                            }}>
                                {t("lp.cta.h2")}
                            </h2>

                            <p style={{
                                color: "var(--color-muted)",
                                fontSize: "clamp(14px, 1.6vw, 18px)",
                                maxWidth: 560, margin: "0 auto 36px",
                                lineHeight: 1.65,
                            }}>{t("lp.cta.desc")}</p>

                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 48 }}>
                                <button
                                    className="btn-primary"
                                    style={{ fontSize: 16, padding: "16px 40px" }}
                                    onClick={onSignup}
                                >{t("lp.cta.btn")}</button>
                            </div>

                            {/* Stats ribbon */}
                            <div
                                className="cta-stats"
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
                                    gap: 1, padding: 1,
                                    maxWidth: 620, margin: "0 auto",
                                    borderRadius: 20,
                                    background: "var(--color-border-soft)",
                                    border: "1px solid var(--color-border-soft)",
                                    overflow: "hidden",
                                }}
                            >
                                {stats.map((s, i) => (
                                    <div key={i} style={{
                                        padding: "18px 14px",
                                        background: "var(--bg-surface-low)",
                                        backdropFilter: "blur(10px)",
                                    }}>
                                        <div className="num-tight" style={{
                                            fontSize: "clamp(20px, 2.4vw, 28px)",
                                            fontWeight: 700, color: "var(--color-text)",
                                            lineHeight: 1, letterSpacing: "-.02em",
                                        }}>{s.v}</div>
                                        <div style={{
                                            fontSize: 10.5, color: "var(--color-muted)",
                                            textTransform: "uppercase", letterSpacing: 1.6,
                                            fontWeight: 700, marginTop: 6,
                                        }}>{s.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>

            <style>{`
                @media (max-width: 640px) {
                    .cta-stats { grid-template-columns: 1fr !important; }
                    section { padding: 60px 20px !important; }
                }
            `}</style>
        </section>
    );
};

export default CtaSection;
