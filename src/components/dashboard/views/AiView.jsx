import { useRef, useEffect } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";

const AiView = ({ aiChat, aiTyping, aiInput, setAiInput, handleAi }) => {
    const { t } = useLanguage();
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [aiChat, aiTyping]);

    const quickQuestions = [
        t("ai.q1") || "Analisis spending gue",
        t("ai.q2") || "Tips hemat bulan ini",
        t("ai.q3") || "Cek hutang gue",
        t("ai.q4") || "Gimana saving rate gue?",
    ];

    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 700 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--color-border-soft)" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>Karaya AI Financial Coach</div>
                        <div style={{ fontSize: 11, color: "var(--color-primary)" }}>● {t("lp.ai.online") || "Online"}</div>
                    </div>
                </div>

                <div style={{ height: 350, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {aiChat.map((m, i) => (
                        <div key={i} style={{
                            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                            maxWidth: "80%", padding: "12px 16px",
                            borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            background: m.role === "user" ? "linear-gradient(135deg,#60fcc6,#19ce9b)" : "var(--bg-surface-low)",
                            border: m.role === "user" ? "none" : "1px solid var(--color-border-soft)",
                            color: m.role === "user" ? "var(--color-on-primary)" : "var(--color-text)",
                            fontSize: 14, lineHeight: 1.7, animation: "slideUp .3s",
                        }}>{m.text}</div>
                    ))}
                    {aiTyping && (
                        <div style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", color: "var(--color-muted)" }}>
                            <span style={{ animation: "pulse 1s ease infinite" }}>●●●</span>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAi()}
                        placeholder={t("lp.ai.placeholder") || "Tanya keuangan..."}
                        style={{ flex: 1, background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 16px", color: "var(--color-text)", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                    />
                    <button
                        onClick={handleAi}
                        disabled={!aiInput.trim()}
                        style={{ width: 48, height: 48, borderRadius: 12, background: aiInput.trim() ? "linear-gradient(135deg,#60fcc6,#19ce9b)" : "var(--bg-surface-low)", border: "none", color: aiInput.trim() ? "var(--color-on-primary)" : "var(--color-muted)", fontSize: 20, cursor: aiInput.trim() ? "pointer" : "not-allowed", transition: "all .2s" }}
                    >↑</button>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {quickQuestions.map((q, i) => (
                        <button key={i} onClick={() => setAiInput(q)} style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid var(--color-border)", background: "rgba(96,252,198,.05)", color: "var(--color-primary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{q}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AiView;
