import { useRef, useEffect } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { AI_PROVIDERS, PROVIDER_ORDER } from "../../../services/aiService";
import { APP_AI_NAME } from "../../../config/app";
import { AiMessage } from "../../ai/AiMessage";

// ── Setup screen ketika belum ada AI config ───────────────────────────────
function AiSetupScreen() {
    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 960 }}>
            <div style={{
                background: "var(--glass-hero)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
                borderRadius: 24, padding: "clamp(20px, 4vw, 36px)",
                boxShadow: "var(--glass-highlight), 0 6px 24px rgba(0,0,0,.1)",
                position: "relative", overflow: "hidden",
            }}>
                <div style={{ textAlign: "center", marginBottom: 22 }}>
                    <div style={{ fontSize: 38, marginBottom: 10 }}>🤖</div>
                    <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 8px", letterSpacing: "-.025em" }}>
                        Aktifkan Asisten AI Keluarga Berkembang
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 auto", maxWidth: "56ch", lineHeight: 1.6 }}>
                        Tanya sisa anggaran harian, cek pengeluaran terbesar, dan baca foto struk belanja otomatis dalam 5 detik.
                    </p>
                </div>

                {/* Primary Recommended Card: Paket Resmi Keluarga Berkembang */}
                <div style={{
                    background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 16%, transparent), color-mix(in srgb, var(--color-primary) 6%, transparent))",
                    border: "1.5px solid var(--color-primary)",
                    borderRadius: 18,
                    padding: "clamp(18px, 3vw, 24px)",
                    textAlign: "left",
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                            padding: "4px 10px", borderRadius: 99,
                            background: "var(--color-primary)", color: "var(--color-on-primary)",
                        }}>
                            Resmi · Siap Pakai
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", fontFamily: "var(--font-mono, monospace)" }}>
                            Paket Sachet Mulai Rp 9.000
                        </span>
                    </div>

                    <h3 style={{ fontSize: "clamp(16px, 2.2vw, 19px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 8px" }}>
                        💎 Paket Asisten AI Keluarga Berkembang (Mulai Rp 9.000)
                    </h3>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
                        Aktifkan tanya-jawab asisten keuangan 24 jam, catat pengeluaran lewat chat, dan baca foto struk belanja otomatis di Web, Telegram, maupun Grup WhatsApp Suami-Istri.
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                        <a
                            href="https://keluargaberkembang.com/#paket"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{ minHeight: 44, padding: "10px 18px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                        >
                            💎 Ambil Paket Asisten AI (Mulai Rp 9.000)
                        </a>
                        <a
                            href="https://t.me/KelolaKeluargaBot"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                minHeight: 44, padding: "10px 16px", borderRadius: 12,
                                border: "1px solid var(--glass-border)",
                                background: "var(--glass-2)",
                                color: "var(--color-text)", fontSize: 13, fontWeight: 700,
                                textDecoration: "none",
                            }}
                        >
                            ✈️ Aktifkan via @KelolaKeluargaBot
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main AiView ───────────────────────────────────────────────────────────
const AiView = ({ aiChat, aiTyping, aiInput, setAiInput, handleAi, stopAi, aiConfig }) => {
    const { t } = useLanguage();
    const chatEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const isNearBottomRef = useRef(true);

    const handleChatScroll = () => {
        const el = chatContainerRef.current;
        if (!el) return;
        isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
    };

    useEffect(() => {
        if (isNearBottomRef.current) {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [aiChat, aiTyping]);

    // Belum setup → tampil setup screen
    if (!aiConfig?.apiKey) {
        return <AiSetupScreen />;
    }

    const provider = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.gatekeeper;

    // t() returns the key itself when translation not found → fallback ke string default
    const tq = (key, fallback) => { const v = t(key); return v === key ? fallback : v; };
    const quickQuestions = [
        tq("ai.q1", "Analisis pengeluaran rumah tangga bulan ini"),
        tq("ai.q2", "Berapa jatah harian aman sisa bulan ini?"),
        "Cek daftar belanja & stok kulkas yang menipis",
        "Bandingkan pengeluaran bulan ini vs bulan lalu",
        tq("ai.q3", "Cek kondisi cicilan & hutang keluarga"),
        "Kategori apa yang paling besar bulan ini?",
        "Tren keuangan keluarga 6 bulan terakhir",
        "Cari transaksi belanja dapur atau listrik",
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
                            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)", letterSpacing: "-.01em", fontFamily: "var(--font-display)" }}>{APP_AI_NAME} · Asisten Keluarga & Keuangan</div>
                            <div style={{ fontSize: 11, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                                ● Asisten AI Resmi Keluarga Berkembang · Aktif
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chat */}
                <div
                    ref={chatContainerRef}
                    onScroll={handleChatScroll}
                    style={{ height: "min(60vh, 500px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}
                >
                    {aiChat.map((m, i) => (
                        <div key={i} style={{
                            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                            maxWidth: "min(85%, 560px)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            animation: "slideUp .3s",
                        }}>
                            {m.role === "ai" && m.streaming && m.status && (
                                <div style={{
                                    fontSize: 11,
                                    color: "var(--color-muted)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    paddingLeft: 4,
                                }}>
                                    <span style={{ display: "inline-block", animation: "bounce 1.1s ease-in-out infinite" }}>⚙️</span>
                                    <span>{m.status}</span>
                                </div>
                            )}
                            <div style={{
                                padding: "12px 16px",
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
                                fontSize: 14, lineHeight: 1.7,
                                whiteSpace: m.role === "ai" ? "normal" : "pre-wrap", wordBreak: "break-word",
                            }}>
                                {m.role === "ai" ? (
                                    <>
                                        {m.text ? <AiMessage text={m.text} variant="page" /> : null}
                                        {m.streaming && (
                                            <span style={{
                                                display: "inline-block",
                                                marginLeft: m.text ? 2 : 0,
                                                color: "var(--color-primary)",
                                                animation: "bounce 0.8s ease-in-out infinite",
                                                fontWeight: 700,
                                            }}>▍</span>
                                        )}
                                        {m.stopped && (
                                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4, fontStyle: "italic" }}>
                                                {t("ai.stopped")}
                                            </div>
                                        )}
                                        {m.streamError && (
                                            <div style={{ fontSize: 11, color: "var(--color-expense)", marginTop: 4 }}>
                                                {m.streamError}
                                            </div>
                                        )}
                                    </>
                                ) : m.text}
                            </div>
                        </div>
                    ))}
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
                    {aiTyping ? (
                        <button
                            type="button"
                            onClick={() => stopAi?.()}
                            aria-label={t("ai.stop")}
                            title={t("ai.stop")}
                            style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--color-expense)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .2s", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            ■
                        </button>
                    ) : (
                        <button
                            onClick={() => handleAi()}
                            disabled={!aiInput.trim()}
                            aria-label="Kirim pesan"
                            style={{ width: 42, height: 42, borderRadius: "50%", background: aiInput.trim() ? "linear-gradient(135deg,var(--color-primary),var(--color-primary-deep))" : "var(--bg-surface-low)", border: "none", color: aiInput.trim() ? "var(--color-on-primary)" : "var(--color-muted)", fontSize: 20, cursor: aiInput.trim() ? "pointer" : "not-allowed", transition: "all .2s", flexShrink: 0, boxShadow: aiInput.trim() ? "0 2px 8px rgba(0,0,0,.15)" : "none" }}>
                            ↑
                        </button>
                    )}
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
