import { useRef, useEffect } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { AI_PROVIDERS, PROVIDER_ORDER } from "../../../services/aiService";
import { APP_AI_NAME } from "../../../config/app";

// ── Setup screen ketika belum ada AI config ───────────────────────────────
function AiSetupScreen({ onOpenSettings }) {
    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 960 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text)", margin: "0 0 8px" }}>AI Coach Belum Aktif</h2>
                <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 28, lineHeight: 1.6 }}>
                    Hubungkan AI Coach dengan API key milikmu sendiri.<br/>
                    Mendukung berbagai model AI populer.
                </p>

                {/* Provider list */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 28 }}>
                    {PROVIDER_ORDER.map(id => {
                        const p = AI_PROVIDERS[id];
                        return (
                            <div key={id} style={{ background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                                <div style={{ fontSize: 22, marginBottom: 4 }}>{p.icon}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{p.label}</div>
                                {p.badge && (
                                    <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(96,252,198,.15)", color: "var(--color-primary)", border: "1px solid rgba(96,252,198,.3)", borderRadius: 4, padding: "2px 6px", display: "inline-block", marginTop: 4 }}>{p.badge}</span>
                                )}
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 4 }}>
                                    {p.models.length} model
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ background: "rgba(96,252,198,.06)", border: "1px solid rgba(96,252,198,.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "var(--color-muted)", textAlign: "left" }}>
                    💡 <strong>Groq</strong> menyediakan API key <strong>gratis</strong> dengan model Llama 3 & Mixtral — cocok untuk mulai tanpa biaya.
                </div>

                <button onClick={onOpenSettings}
                    style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "var(--color-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ⚙️ Atur API Key di Settings
                </button>
            </div>
        </div>
    );
}

// ── Main AiView ───────────────────────────────────────────────────────────
const AiView = ({ aiChat, aiTyping, aiInput, setAiInput, handleAi, aiConfig, onOpenAiSettings }) => {
    const { t } = useLanguage();
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [aiChat, aiTyping]);

    // Belum setup → tampil setup screen
    if (!aiConfig?.apiKey) {
        return <AiSetupScreen onOpenSettings={onOpenAiSettings} />;
    }

    const provider = AI_PROVIDERS[aiConfig.provider];
    const modelLabel = provider?.models.find(m => m.id === aiConfig.model)?.label || aiConfig.model;

    // t() returns the key itself when translation not found → fallback ke string default
    const tq = (key, fallback) => { const v = t(key); return v === key ? fallback : v; };
    const quickQuestions = [
        tq("ai.q1", "Analisis pengeluaran bulan ini"),
        tq("ai.q2", "Tips hemat bulan ini"),
        tq("ai.q3", "Cek kondisi hutangku"),
        tq("ai.q4", "Gimana saving rate-ku?"),
    ];

    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 960 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 24 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--color-border-soft)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                            {provider?.icon || "🤖"}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>{APP_AI_NAME} Financial Coach</div>
                            <div style={{ fontSize: 11, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                                ● {provider?.label} · {modelLabel}
                            </div>
                        </div>
                    </div>
                    <button onClick={onOpenAiSettings}
                        style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-muted)", cursor: "pointer", fontFamily: "inherit" }}>
                        ⚙️ Ganti
                    </button>
                </div>

                {/* Chat */}
                <div style={{ height: 500, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {aiChat.map((m, i) => {
                        if (m.role === "thinking") return (
                            <div key={i} style={{
                                alignSelf: "flex-start", maxWidth: "75%",
                                padding: "8px 14px", borderRadius: "12px 12px 12px 4px",
                                background: "rgba(96,252,198,.05)",
                                border: "1px dashed rgba(96,252,198,.3)",
                                color: "var(--color-primary)", fontSize: 12, lineHeight: 1.5,
                                animation: "slideUp .3s", display: "flex", alignItems: "center", gap: 8,
                            }}>
                                <span style={{ display: "inline-flex", gap: 3 }}>
                                    {[0,1,2].map(j => (
                                        <span key={j} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-primary)", display: "inline-block", animation: `bounce .9s ${j * 0.15}s ease-in-out infinite` }} />
                                    ))}
                                </span>
                                <span style={{ opacity: 0.8 }}>{m.text}</span>
                            </div>
                        );
                        return (
                        <div key={i} style={{
                            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                            maxWidth: "75%", padding: "12px 16px",
                            borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            background: m.role === "user"
                                ? "linear-gradient(135deg,#60fcc6,#19ce9b)"
                                : m.role === "error"
                                    ? "rgba(255,113,108,.08)"
                                    : "var(--bg-surface-low)",
                            border: m.role === "user" ? "none"
                                : m.role === "error" ? "1px solid rgba(255,113,108,.2)"
                                : "1px solid var(--color-border-soft)",
                            color: m.role === "user" ? "var(--color-on-primary)"
                                : m.role === "error" ? "#ff716c"
                                : "var(--color-text)",
                            fontSize: 14, lineHeight: 1.7, animation: "slideUp .3s",
                            whiteSpace: "pre-wrap",
                        }}>{m.text}</div>
                        );
                    })}
                    {aiTyping && (
                        <div style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)" }}>
                            <span style={{ display: "inline-flex", gap: 4 }}>
                                {[0,1,2].map(i => (
                                    <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-primary)", display: "inline-block", animation: `bounce .9s ${i * 0.15}s ease-in-out infinite` }} />
                                ))}
                            </span>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAi()}
                        placeholder={t("ai.placeholder")}
                        disabled={aiTyping}
                        style={{ flex: 1, background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 16px", color: "var(--color-text)", fontSize: 14, outline: "none", fontFamily: "inherit", opacity: aiTyping ? 0.6 : 1 }}
                    />
                    <button
                        onClick={handleAi}
                        disabled={!aiInput.trim() || aiTyping}
                        style={{ width: 48, height: 48, borderRadius: 12, background: aiInput.trim() && !aiTyping ? "linear-gradient(135deg,#60fcc6,#19ce9b)" : "var(--bg-surface-low)", border: "none", color: aiInput.trim() && !aiTyping ? "var(--color-on-primary)" : "var(--color-muted)", fontSize: 20, cursor: aiInput.trim() && !aiTyping ? "pointer" : "not-allowed", transition: "all .2s" }}>
                        ↑
                    </button>
                </div>

                {/* Quick questions */}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {quickQuestions.map((q, i) => (
                        <button key={i} onClick={() => setAiInput(q)} disabled={aiTyping}
                            style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid var(--color-border)", background: "rgba(96,252,198,.05)", color: "var(--color-primary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: aiTyping ? 0.5 : 1 }}>
                            {q}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bounce animation */}
            <style>{`
                @keyframes bounce {
                    0%,100% { transform: translateY(0); opacity:.4; }
                    50% { transform: translateY(-5px); opacity:1; }
                }
            `}</style>
        </div>
    );
};

export default AiView;
