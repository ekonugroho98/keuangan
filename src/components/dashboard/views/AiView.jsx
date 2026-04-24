import { useRef, useEffect } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { AI_PROVIDERS, PROVIDER_ORDER } from "../../../services/aiService";
import { APP_AI_NAME } from "../../../config/app";

// ── Setup screen ketika belum ada AI config ───────────────────────────────
function AiSetupScreen({ onOpenSettings }) {
    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 960 }}>
            <div style={{
                background: "var(--glass-hero)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
                borderRadius: 24, padding: "clamp(24px, 4vw, 40px)", textAlign: "center",
                boxShadow: "var(--glass-highlight), 0 6px 24px rgba(0,0,0,.1)",
                position: "relative", overflow: "hidden",
            }}>
                <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>🤖</div>
                <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 8px", letterSpacing: "-.025em" }}>AI Coach Belum Aktif</h2>
                <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 28, lineHeight: 1.6 }}>
                    Hubungkan AI Coach dengan API key milikmu sendiri.<br/>
                    Mendukung berbagai model AI populer.
                </p>

                {/* Provider list */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 10, marginBottom: 28 }}>
                    {PROVIDER_ORDER.map(id => {
                        const p = AI_PROVIDERS[id];
                        return (
                            <div key={id} style={{
                                background: "var(--glass-2)",
                                backdropFilter: "var(--glass-blur)",
                                WebkitBackdropFilter: "var(--glass-blur)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: 14, padding: "14px 10px", textAlign: "center",
                            }}>
                                <div style={{ fontSize: 22, marginBottom: 4 }}>{p.icon}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{p.label}</div>
                                {p.badge && (
                                    <span className="chip chip-mint" style={{ fontSize: 9, marginTop: 4, display: "inline-block" }}>{p.badge}</span>
                                )}
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 4 }}>
                                    {p.models.length} model
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ background: "var(--color-primary-soft)", border: "1px solid var(--glass-border)", borderRadius: 14, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "var(--color-muted)", textAlign: "left" }}>
                    💡 <strong>Groq</strong> menyediakan API key <strong>gratis</strong> dengan model Llama 3 & Mixtral — cocok untuk mulai tanpa biaya.
                </div>

                <button onClick={onOpenSettings} className="btn-primary" style={{ minHeight: 44 }}>
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
        "Bandingkan pengeluaran bulan ini vs bulan lalu",
        "Tren keuangan 6 bulan terakhir",
        "Kategori apa yang paling boros bulan ini?",
        "Cari transaksi listrik",
    ];

    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 960 }}>
            <div style={{
                background: "var(--glass-1)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
                borderRadius: 20, padding: "clamp(16px, 3vw, 24px)",
                boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                position: "relative", overflow: "hidden",
            }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--color-border-soft)", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,var(--color-primary),var(--color-primary-deep))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                            {provider?.icon || "🤖"}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)", letterSpacing: "-.01em" }}>{APP_AI_NAME} Financial Coach</div>
                            <div style={{ fontSize: 11, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                                ● {provider?.label} · {modelLabel}
                            </div>
                        </div>
                    </div>
                    <button onClick={onOpenAiSettings} className="btn-ghost" aria-label="Ganti provider AI"
                        style={{ fontSize: 11, minHeight: 36, padding: "6px 12px" }}>
                        ⚙️ Ganti
                    </button>
                </div>

                {/* Chat */}
                <div style={{ height: "min(60vh, 500px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {aiChat.map((m, i) => {
                        if (m.role === "thinking") return (
                            <div key={i} style={{
                                alignSelf: "flex-start", maxWidth: "min(85%, 560px)",
                                padding: "8px 14px", borderRadius: "14px 14px 14px 4px",
                                background: "var(--color-primary-soft)",
                                border: "1px dashed var(--glass-border)",
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
                            maxWidth: "min(85%, 560px)", padding: "12px 16px",
                            borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                            background: m.role === "user"
                                ? "linear-gradient(135deg,var(--color-primary),var(--color-primary-deep))"
                                : m.role === "error"
                                    ? "var(--color-expense-soft)"
                                    : "var(--glass-2)",
                            backdropFilter: m.role === "user" ? "none" : "var(--glass-blur)",
                            WebkitBackdropFilter: m.role === "user" ? "none" : "var(--glass-blur)",
                            border: m.role === "user" ? "none"
                                : m.role === "error" ? "1px solid var(--color-expense-soft)"
                                : "1px solid var(--glass-border)",
                            boxShadow: m.role === "user" ? "0 2px 8px rgba(0,0,0,.1)" : "var(--glass-highlight)",
                            color: m.role === "user" ? "var(--color-on-primary)"
                                : m.role === "error" ? "var(--color-expense)"
                                : "var(--color-text)",
                            fontSize: 14, lineHeight: 1.7, animation: "slideUp .3s",
                            whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}>{m.text}</div>
                        );
                    })}
                    {aiTyping && (
                        <div style={{
                            alignSelf: "flex-start", padding: "12px 16px",
                            borderRadius: "18px 18px 18px 4px",
                            background: "var(--glass-2)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: "1px solid var(--glass-border)",
                        }}>
                            <span style={{ display: "inline-flex", gap: 4 }}>
                                {[0,1,2].map(i => (
                                    <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-primary)", display: "inline-block", animation: `bounce .9s ${i * 0.15}s ease-in-out infinite` }} />
                                ))}
                            </span>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input — elevated glass pill */}
                <div style={{
                    position: "sticky", bottom: 0,
                    display: "flex", gap: 8, alignItems: "center",
                    padding: 6, borderRadius: 999,
                    background: "var(--glass-2)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-highlight), 0 4px 14px rgba(0,0,0,.08)",
                }}>
                    <input
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAi()}
                        placeholder={t("ai.placeholder")}
                        disabled={aiTyping}
                        aria-label="Ketik pesan ke AI"
                        style={{ flex: 1, background: "transparent", border: "none", borderRadius: 999, padding: "10px 16px", color: "var(--color-text)", fontSize: 14, outline: "none", fontFamily: "inherit", opacity: aiTyping ? 0.6 : 1, minWidth: 0, minHeight: 42 }}
                    />
                    <button
                        onClick={handleAi}
                        disabled={!aiInput.trim() || aiTyping}
                        aria-label="Kirim pesan"
                        style={{ width: 42, height: 42, borderRadius: "50%", background: aiInput.trim() && !aiTyping ? "linear-gradient(135deg,var(--color-primary),var(--color-primary-deep))" : "var(--bg-surface-low)", border: "none", color: aiInput.trim() && !aiTyping ? "var(--color-on-primary)" : "var(--color-muted)", fontSize: 20, cursor: aiInput.trim() && !aiTyping ? "pointer" : "not-allowed", transition: "all .2s", flexShrink: 0, boxShadow: aiInput.trim() && !aiTyping ? "0 2px 8px rgba(0,0,0,.15)" : "none" }}>
                        ↑
                    </button>
                </div>

                {/* Quick questions — chip style (scrollable on narrow screens) */}
                <div style={{
                    display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap",
                    overflowX: "auto",
                    paddingBottom: 2,
                    maskImage: "linear-gradient(to right, black calc(100% - 30px), transparent)",
                    WebkitMaskImage: "linear-gradient(to right, black calc(100% - 30px), transparent)",
                }}>
                    {quickQuestions.map((q, i) => (
                        <button key={i} onClick={() => setAiInput(q)} disabled={aiTyping}
                            className="chip chip-mint"
                            style={{ cursor: aiTyping ? "not-allowed" : "pointer", opacity: aiTyping ? 0.5 : 1, border: "1px solid var(--glass-border)", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
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
