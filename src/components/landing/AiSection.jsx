import FadeIn from "../ui/FadeIn";
import { useLanguage } from "../../i18n/LanguageContext";
import { APP_AI_NAME } from "../../config/app";

const SAMPLE_PROMPTS = [
    "Berapa sisa budget makan?",
    "Analisa spending bulan ini",
    "Bikinin target tabungan",
];

const AiSection = ({ chatMessages, chatInput, setChatInput, isTyping, handleChat }) => {
    const { t } = useLanguage();

    const aiFeatures = [
        t("lp.ai.f1"),
        t("lp.ai.f2"),
        t("lp.ai.f3"),
        t("lp.ai.f4"),
    ];

    return (
        <section id="ai" style={{ padding: "100px 24px", position: "relative", overflow: "hidden" }}>
            {/* Ambient aurora */}
            <div aria-hidden style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(700px 500px at 85% 30%, rgba(167,139,250,.10), transparent 60%), radial-gradient(500px 400px at 10% 80%, rgba(96,252,198,.06), transparent 60%)",
            }} />

            <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 1 }}>
                <div className="ai-grid" style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 64,
                    alignItems: "center",
                }}>
                    {/* Left: Narrative */}
                    <FadeIn direction="right">
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "6px 14px", borderRadius: 99,
                            background: "rgba(167,139,250,.10)",
                            border: "1px solid rgba(167,139,250,.26)",
                            marginBottom: 20, backdropFilter: "blur(12px)",
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: "#a78bfa", animation: "pulse 2s infinite" }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", letterSpacing: 1.2 }}>{t("lp.ai.tag")}</span>
                        </div>

                        <h2 style={{
                            fontSize: "clamp(32px,4.5vw,52px)",
                            fontWeight: 900, letterSpacing: "-.04em",
                            color: "var(--color-text)", lineHeight: 1.05, marginBottom: 20,
                        }}>
                            {t("lp.ai.h2")}<br />
                            <span className="gradient-text">{t("lp.ai.h2g")}</span>
                        </h2>

                        <p style={{
                            color: "var(--color-muted)",
                            lineHeight: 1.7, fontSize: "clamp(14px,1.4vw,16px)",
                            marginBottom: 32, maxWidth: 520,
                        }}>{t("lp.ai.desc")}</p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                            {aiFeatures.map((f, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{
                                        width: 26, height: 26, borderRadius: 8,
                                        background: "linear-gradient(135deg, rgba(96,252,198,.22), rgba(25,206,155,.14))",
                                        border: "1px solid rgba(96,252,198,.3)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 13, color: "var(--color-primary)", fontWeight: 900,
                                        flexShrink: 0,
                                    }}>✓</span>
                                    <span style={{ color: "var(--color-text)", fontSize: 14.5, fontWeight: 500 }}>{f}</span>
                                </div>
                            ))}
                        </div>
                    </FadeIn>

                    {/* Right: Chat preview */}
                    <FadeIn direction="left">
                        <div className="bento bento-glow" style={{
                            padding: 24,
                            borderRadius: 24,
                            background: "linear-gradient(145deg, rgba(30,30,40,.7), rgba(20,20,28,.6))",
                            backdropFilter: "blur(24px)",
                            boxShadow: "0 40px 90px rgba(0,0,0,.45)",
                            position: "relative",
                        }}>
                            {/* Header */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: 12,
                                paddingBottom: 16, marginBottom: 16,
                                borderBottom: "1px solid var(--color-border-soft)",
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 18,
                                    boxShadow: "0 8px 20px rgba(167,139,250,.35)",
                                }}>🤖</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--color-text)", letterSpacing: "-.01em" }}>{APP_AI_NAME}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-primary)", fontWeight: 600, marginTop: 2 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary)" }} />
                                        {t("lp.ai.online")}
                                    </div>
                                </div>
                            </div>

                            {/* Sample prompts */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                                {SAMPLE_PROMPTS.map((p, i) => (
                                    <span key={i} className="chip chip-ghost" style={{ fontSize: 10.5 }}>{p}</span>
                                ))}
                            </div>

                            {/* Chat */}
                            <div style={{
                                height: 240, overflowY: "auto",
                                display: "flex", flexDirection: "column", gap: 10,
                                marginBottom: 14, paddingRight: 4,
                            }}>
                                {chatMessages.map((m, i) => (
                                    <div key={i} style={{
                                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                                        maxWidth: "85%",
                                        padding: "11px 15px",
                                        borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                                        background: m.role === "user"
                                            ? "linear-gradient(135deg,#60fcc6,#19ce9b)"
                                            : "rgba(255,255,255,.06)",
                                        border: m.role === "user" ? "none" : "1px solid var(--color-border-soft)",
                                        color: m.role === "user" ? "#003828" : "var(--color-text)",
                                        fontSize: 12.5, lineHeight: 1.6,
                                        fontWeight: m.role === "user" ? 600 : 500,
                                        animation: "slideUp .3s",
                                        boxShadow: m.role === "user"
                                            ? "0 6px 18px rgba(96,252,198,.25)"
                                            : "0 4px 12px rgba(0,0,0,.15)",
                                    }}>{m.text}</div>
                                ))}
                                {isTyping && (
                                    <div style={{
                                        alignSelf: "flex-start", padding: "11px 15px",
                                        borderRadius: "16px 16px 16px 4px",
                                        background: "rgba(255,255,255,.06)",
                                        border: "1px solid var(--color-border-soft)",
                                        color: "var(--color-muted)", fontSize: 12,
                                    }}>
                                        <span style={{ animation: "pulse 1s ease infinite" }}>●●●</span>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleChat()}
                                    placeholder={t("lp.ai.placeholder")}
                                    style={{
                                        flex: 1,
                                        background: "rgba(255,255,255,.04)",
                                        border: "1px solid var(--color-border-soft)",
                                        borderRadius: 12, padding: "12px 16px",
                                        color: "var(--color-text)", fontSize: 13,
                                        outline: "none", fontFamily: "inherit",
                                    }}
                                />
                                <button
                                    onClick={handleChat}
                                    aria-label="Send message"
                                    style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: "linear-gradient(135deg,#60fcc6,#19ce9b)",
                                        border: "none", color: "#003828",
                                        fontSize: 18, fontWeight: 900, cursor: "pointer",
                                        boxShadow: "0 6px 18px rgba(96,252,198,.35)",
                                        transition: "transform .2s",
                                    }}
                                    onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
                                    onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
                                >↑</button>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>

            <style>{`
                @media (max-width: 900px) {
                    .ai-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
                }
                @media (max-width: 640px) {
                    section#ai { padding: 60px 20px !important; }
                }
            `}</style>
        </section>
    );
};

export default AiSection;
