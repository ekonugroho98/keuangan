import FadeIn from "../ui/FadeIn";
import GlowCard from "../ui/GlowCard";
import { useLanguage } from "../../i18n/LanguageContext";
import { APP_AI_NAME } from "../../config/app";

const AiSection = ({ chatMessages, chatInput, setChatInput, isTyping, handleChat }) => {
    const { t } = useLanguage();

    const aiFeatures = [
        t("lp.ai.f1"),
        t("lp.ai.f2"),
        t("lp.ai.f3"),
        t("lp.ai.f4"),
    ];

    return (
        <section id="ai" style={{ padding: "80px 24px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48, alignItems: "center" }}>
                <FadeIn direction="right">
                    <span className="tag" style={{ background: "rgba(25,206,155,.1)", color: "#a78bfa" }}>{t("lp.ai.tag")}</span>
                    <h2 style={{ fontSize: "clamp(28px,4vw,38px)", fontWeight: 800, marginTop: 16, marginBottom: 20, color: "#fff" }}>
                        {t("lp.ai.h2")} <span className="gradient-text">{t("lp.ai.h2g")}</span>
                    </h2>
                    <p style={{ color: "var(--color-muted)", lineHeight: 1.8, fontSize: 15, marginBottom: 28 }}>{t("lp.ai.desc")}</p>
                    {aiFeatures.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(96,252,198,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#60fcc6" }}>✓</span>
                            <span style={{ color: "#c5c5d9", fontSize: 14 }}>{f}</span>
                        </div>
                    ))}
                </FadeIn>

                <FadeIn direction="left">
                    <GlowCard glowColor="rgba(25,206,155,.15)">
                        <div style={{ padding: 22 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🤖</div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{APP_AI_NAME}</div>
                                    <div style={{ fontSize: 10, color: "#60fcc6" }}>{t("lp.ai.online")}</div>
                                </div>
                            </div>

                            <div style={{ height: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                                {chatMessages.map((m, i) => (
                                    <div key={i} style={{
                                        alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
                                        padding: "10px 14px",
                                        borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                        background: m.role === "user" ? "linear-gradient(135deg,#60fcc6,#19ce9b)" : "rgba(255,255,255,.05)",
                                        color: "#e2e8f0", fontSize: 12, lineHeight: 1.6, animation: "slideUp .3s",
                                    }}>{m.text}</div>
                                ))}
                                {isTyping && (
                                    <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "rgba(255,255,255,.05)", color: "var(--color-muted)", fontSize: 12 }}>
                                        <span style={{ animation: "pulse 1s ease infinite" }}>●●●</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleChat()}
                                    placeholder={t("lp.ai.placeholder")}
                                    style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "10px 14px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit" }}
                                />
                                <button onClick={handleChat} style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}>↑</button>
                            </div>
                        </div>
                    </GlowCard>
                </FadeIn>
            </div>
        </section>
    );
};

export default AiSection;
