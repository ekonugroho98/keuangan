import FadeIn from "../ui/FadeIn";
import { useLanguage } from "../../i18n/LanguageContext";

const CtaSection = ({ onSignup }) => {
    const { t } = useLanguage();

    const stats = [
        { v: "500+", l: t("lp.hero.users") || "Pengguna Aktif" },
        { v: "2M+", l: t("lp.hero.tx") || "Transaksi Tercatat" },
        { v: "98%", l: t("lp.hero.satisfaction") || "Kepuasan" },
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
                            background: "linear-gradient(145deg, rgba(30,30,40,.7), rgba(16,18,24,.6))",
                            backdropFilter: "blur(24px)",
                            borderColor: "rgba(96,252,198,.35)",
                            boxShadow: "0 40px 100px rgba(0,0,0,.5), 0 0 0 1px rgba(96,252,198,.3)",
                        }}
                    >
                        {/* Ambient aurora orbs */}
                        <div aria-hidden style={{
                            position: "absolute", top: "-40%", left: "-10%",
                            width: "60%", height: "180%",
                            background: "radial-gradient(circle, rgba(96,252,198,.25), transparent 60%)",
                            filter: "blur(80px)", pointerEvents: "none",
                        }} />
                        <div aria-hidden style={{
                            position: "absolute", bottom: "-40%", right: "-10%",
                            width: "60%", height: "180%",
                            background: "radial-gradient(circle, rgba(79,195,247,.22), transparent 60%)",
                            filter: "blur(80px)", pointerEvents: "none",
                        }} />
                        <div aria-hidden style={{
                            position: "absolute", top: "20%", right: "20%",
                            width: 200, height: 200,
                            background: "radial-gradient(circle, rgba(167,139,250,.18), transparent 60%)",
                            filter: "blur(60px)", pointerEvents: "none",
                        }} />

                        <div style={{ position: "relative", zIndex: 1 }}>
                            {/* Eyebrow */}
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: 8,
                                padding: "6px 14px", borderRadius: 99,
                                background: "rgba(96,252,198,.12)",
                                border: "1px solid rgba(96,252,198,.3)",
                                marginBottom: 24, backdropFilter: "blur(12px)",
                            }}>
                                <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-primary)", animation: "pulse 2s infinite" }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", letterSpacing: 1.2 }}>
                                    {t("lp.cta.tag") || "MULAI SEKARANG"}
                                </span>
                            </div>

                            <h2 style={{
                                fontSize: "clamp(32px, 5.5vw, 64px)",
                                fontWeight: 900, letterSpacing: "-.04em",
                                color: "var(--color-text)", lineHeight: 1.02,
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
                                <button
                                    className="btn-secondary"
                                    style={{ fontSize: 16, padding: "16px 32px" }}
                                    onClick={() => {
                                        const el = document.getElementById("harga");
                                        if (el) el.scrollIntoView({ behavior: "smooth" });
                                    }}
                                >{t("lp.cta.btn2") || "Lihat Paket"}</button>
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
                                    background: "rgba(255,255,255,.05)",
                                    border: "1px solid var(--color-border-soft)",
                                    overflow: "hidden",
                                }}
                            >
                                {stats.map((s, i) => (
                                    <div key={i} style={{
                                        padding: "18px 14px",
                                        background: "rgba(14,14,21,.5)",
                                        backdropFilter: "blur(10px)",
                                    }}>
                                        <div className="num-tight" style={{
                                            fontSize: "clamp(20px, 2.4vw, 28px)",
                                            fontWeight: 900, color: "var(--color-text)",
                                            lineHeight: 1, letterSpacing: "-.03em",
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
