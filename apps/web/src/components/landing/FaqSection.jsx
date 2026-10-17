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
        <section id="faq" style={{ padding: "100px 24px", position: "relative", overflow: "hidden" }}>
            {/* Ambient aurora */}
            <div aria-hidden style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(600px 400px at 85% 20%, rgba(200,150,62,.08), transparent 60%), radial-gradient(500px 300px at 10% 80%, rgba(70,99,78,.07), transparent 60%)",
            }} />

            <div style={{ maxWidth: 820, margin: "0 auto", position: "relative", zIndex: 1 }}>
                <FadeIn>
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "6px 14px", borderRadius: 99,
                            background: "rgba(200,150,62,.12)",
                            border: "1px solid rgba(200,150,62,.28)",
                            marginBottom: 20, backdropFilter: "blur(12px)",
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-amber, #C8963E)", animation: "pulse 2s infinite" }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-amber, #C8963E)", letterSpacing: 1.2 }}>{t("lp.faq.tag")}</span>
                        </div>
                        <h2 style={{
                            fontSize: "clamp(32px, 5vw, 52px)",
                            fontWeight: 600, letterSpacing: "-.03em",
                            color: "var(--color-text)", lineHeight: 1.08, marginBottom: 16,
                        }}>
                            {t("lp.faq.h2")}{" "}
                            <span className="gradient-text">{t("lp.faq.h2g")}</span>
                        </h2>
                        <p style={{
                            fontSize: "clamp(14px, 1.5vw, 16px)",
                            color: "var(--color-muted)",
                            maxWidth: 560, margin: "0 auto", lineHeight: 1.65,
                        }}>
                            {t("lp.faq.desc") || ""}
                        </p>
                    </div>
                </FadeIn>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {faqs.map((f, i) => {
                        const isOpen = activeFaq === i;
                        return (
                            <FadeIn key={i} delay={i * .05}>
                                <div
                                    onClick={() => setActiveFaq(isOpen ? null : i)}
                                    className="bento"
                                    style={{
                                        padding: "20px 24px",
                                        cursor: "pointer",
                                        transition: "all .3s cubic-bezier(.2,.8,.2,1)",
                                        borderColor: isOpen ? "var(--color-primary)" : undefined,
                                        background: isOpen ? "var(--bg-surface-low)" : undefined,
                                    }}
                                    role="button"
                                    aria-expanded={isOpen}
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveFaq(isOpen ? null : i); } }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                                        <h3 style={{
                                            fontSize: 15, fontWeight: 600,
                                            color: "var(--color-text)",
                                            lineHeight: 1.4,
                                            letterSpacing: "-.01em",
                                            margin: 0,
                                        }}>{f.q}</h3>
                                        <span style={{
                                            width: 32, height: 32, borderRadius: 10,
                                            background: isOpen ? "var(--color-border)" : "var(--color-border-soft)",
                                            border: `1px solid ${isOpen ? "var(--color-primary)" : "transparent"}`,
                                            color: isOpen ? "var(--color-primary)" : "var(--color-muted)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 18, fontWeight: 400,
                                            transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                                            transition: "all .3s cubic-bezier(.2,.8,.2,1)",
                                            flexShrink: 0,
                                        }}>+</span>
                                    </div>

                                    <div style={{
                                        overflow: "hidden",
                                        maxHeight: isOpen ? 400 : 0,
                                        opacity: isOpen ? 1 : 0,
                                        marginTop: isOpen ? 14 : 0,
                                        transition: "max-height .4s cubic-bezier(.2,.8,.2,1), opacity .3s, margin-top .3s",
                                    }}>
                                        <p style={{
                                            color: "var(--color-muted)",
                                            lineHeight: 1.7, fontSize: 14, margin: 0,
                                            paddingTop: 2,
                                        }}>{f.a}</p>
                                    </div>
                                </div>
                            </FadeIn>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @media (max-width: 640px) {
                    section#faq { padding: 60px 20px !important; }
                }
            `}</style>
        </section>
    );
};

export default FaqSection;
