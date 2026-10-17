import FadeIn from "../ui/FadeIn";
import CountUp from "../ui/CountUp";
import { useLanguage } from "../../i18n/LanguageContext";

/* ─────────────────────────────────────────────────────────────
 * Floating bento cards — Keluarga Berkembang
 * Menampilkan Keuangan Keluarga, Transfer Pasangan, Belanja & Stok Rumah
 * ───────────────────────────────────────────────────────────── */
const FloatingBento = () => (
    <div className="hero-bento-stage" style={{ position: "relative", width: "100%", maxWidth: 520, margin: "0 auto", aspectRatio: "1/1" }}>
        {/* Ambient orb */}
        <div className="hero-bento-orb" style={{
            position: "absolute", inset: "-10%",
            background: "radial-gradient(circle at 60% 40%, rgba(131,155,122,.20), transparent 55%), radial-gradient(circle at 20% 80%, rgba(181,105,74,.10), transparent 60%)",
            pointerEvents: "none",
            filter: "blur(24px)",
        }} />

        {/* Big hero card — Kas & Aset Keluarga */}
        <div className="hero-bento-card hero-bento-main" style={{
            position: "absolute", top: "5%", left: "3%", width: "63%",
            background: "var(--bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "var(--shadow-lg)",
            backdropFilter: "blur(20px)",
            animation: "float 6s ease-in-out infinite",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary)", animation: "pulse 2s infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "var(--color-subtle)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>🏠 Kas &amp; Tabungan Keluarga</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                Rp 124,5 <span style={{ color: "var(--color-muted)", fontWeight: 600 }}>jt</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 12, padding: "4px 10px", background: "var(--color-primary-soft)", border: "1px solid var(--color-border)", borderRadius: 99, fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}>↑ +8,4% bulan ini · Ayah &amp; Ibu</div>
            {/* Mini sparkline */}
            <svg viewBox="0 0 200 40" style={{ width: "100%", height: 40, marginTop: 14, display: "block" }}>
                <defs>
                    <linearGradient id="heroSpark" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#839B7A" stopOpacity=".35" />
                        <stop offset="100%" stopColor="#839B7A" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d="M 0 30 C 25 28, 40 18, 60 20 S 100 12, 130 10 S 180 4, 200 6 L 200 40 L 0 40 Z" fill="url(#heroSpark)" />
                <path d="M 0 30 C 25 28, 40 18, 60 20 S 100 12, 130 10 S 180 4, 200 6" stroke="var(--color-primary)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            </svg>
        </div>

        {/* Saving rate ring card */}
        <div className="hero-bento-card hero-bento-ring" style={{
            position: "absolute", top: "2%", right: "2%", width: "36%",
            background: "var(--bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 20,
            padding: "18px",
            boxShadow: "var(--shadow-md)",
            backdropFilter: "blur(20px)",
            animation: "float 7s ease-in-out infinite .5s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
            <div style={{ position: "relative", width: 78, height: 78 }}>
                <svg width="78" height="78" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="39" cy="39" r="33" fill="transparent" stroke="var(--color-border)" strokeWidth="6" />
                    <circle cx="39" cy="39" r="33" fill="transparent" stroke="var(--color-primary)" strokeWidth="6"
                        strokeDasharray="155 210" strokeLinecap="round" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 19, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.02em" }}>32%</span>
                </div>
            </div>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Tabungan Keluarga</div>
                <div style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 700, marginTop: 3 }}>Sehat &amp; Aman 🌱</div>
            </div>
        </div>

        {/* Small family goal card */}
        <div className="hero-bento-card hero-bento-goal" style={{
            position: "absolute", bottom: "18%", left: "1%", width: "37%",
            background: "var(--bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 18,
            padding: "16px 18px",
            boxShadow: "var(--shadow-md)",
            backdropFilter: "blur(20px)",
            animation: "float 7.5s ease-in-out infinite .8s",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🎓</span>
                <span style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase" }}>Target Anak</span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>Dana Pendidikan</div>
            <div style={{ height: 5, borderRadius: 99, background: "var(--color-border-soft)", marginBottom: 6 }}>
                <div style={{ width: "68%", height: "100%", borderRadius: 99, background: "linear-gradient(90deg, var(--color-primary), #839B7A)" }} />
            </div>
            <div style={{ fontSize: 10.5, color: "var(--color-muted)", fontWeight: 600 }}>68% tercapai</div>
        </div>

        {/* Family & Household Activity card */}
        <div className="hero-bento-card hero-bento-activity" style={{
            position: "absolute", bottom: "5%", right: "4%", width: "60%",
            background: "var(--bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 20,
            padding: "18px 20px",
            boxShadow: "var(--shadow-lg)",
            backdropFilter: "blur(20px)",
            animation: "float 8s ease-in-out infinite 1s",
        }}>
            <div style={{ fontSize: 10, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.3, fontWeight: 700, marginBottom: 10 }}>Aktivitas Rumah Tangga</div>
            {[
                { icon: "💸", name: "Transfer Belanja Istri", amount: "+Rp 5,8 jt", color: "var(--color-primary)", bg: "var(--color-primary-soft)" },
                { icon: "🛒", name: "Belanja Dapur & Susu Anak", amount: "−Rp 645K", color: "var(--color-expense)", bg: "var(--color-expense-soft)" },
                { icon: "🧊", name: "Stok Kulkas: Susu UHT", amount: "4 kotak", color: "var(--color-transfer)", bg: "var(--color-transfer-soft)" },
            ].map((tx, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i > 0 ? "1px solid var(--color-border-soft)" : "none" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: tx.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{tx.icon}</div>
                    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: tx.color, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{tx.amount}</span>
                </div>
            ))}
        </div>
    </div>
);

const HeroSection = ({ onSignup, onDemo }) => {
    const { t } = useLanguage();

    const stats = [
        { v: 100, s: "%", l: t("lp.hero.users") },
        { v: 24, s: "/7", l: t("lp.hero.satisfaction") },
        { v: 1, s: " Atap", l: t("lp.hero.tx") },
    ];

    return (
        <section className="hero-section" style={{
            minHeight: "100vh", display: "flex", alignItems: "center",
            position: "relative", overflow: "hidden",
            padding: "120px 24px 80px",
            backgroundImage:
                "radial-gradient(1200px 600px at 10% -10%, rgba(131,155,122,.12), transparent 60%)," +
                "radial-gradient(900px 500px at 110% 110%, rgba(181,105,74,.06), transparent 60%)",
        }}>
            <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", position: "relative", zIndex: 1 }}>
                <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
                    {/* Left */}
                    <div>
                        <FadeIn>
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: 10,
                                padding: "6px 14px 6px 6px", borderRadius: 99,
                                background: "var(--color-primary-soft)",
                                border: "1px solid var(--color-border)",
                                marginBottom: 24,
                                backdropFilter: "blur(12px)",
                                maxWidth: "100%",
                            }}>
                                <span style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "3px 10px", borderRadius: 99,
                                    background: "var(--color-primary)",
                                    color: "var(--color-on-primary)", fontSize: 10, fontWeight: 700, letterSpacing: .5,
                                    flexShrink: 0,
                                }}>KELUARGA</span>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)", lineHeight: 1.3 }}>{t("lp.hero.badge")}</span>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.1}>
                            <h1 style={{
                                fontSize: "clamp(36px,5vw,64px)",
                                fontWeight: 600, lineHeight: 1.06,
                                marginBottom: 22,
                                letterSpacing: "-.02em", color: "var(--color-text)",
                            }}>
                                {t("lp.hero.h1")}<br />
                                <span className="gradient-text">{t("lp.hero.h1g")}</span>
                            </h1>
                        </FadeIn>

                        <FadeIn delay={0.2}>
                            <p style={{
                                fontSize: "clamp(15px,1.5vw,17px)",
                                color: "var(--color-muted)",
                                maxWidth: 520, marginBottom: 30,
                                lineHeight: 1.7,
                            }}>
                                {t("lp.hero.desc")}
                            </p>
                        </FadeIn>

                        <FadeIn delay={0.3}>
                            <div className="hero-cta-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 38 }}>
                                <button className="btn-primary" style={{ fontSize: 15, padding: "15px 30px" }} onClick={onSignup}>{t("lp.hero.cta")}</button>
                                <button className="btn-secondary" style={{ fontSize: 15, padding: "15px 28px" }} onClick={onDemo}>
                                    <span style={{ marginRight: 6 }}>▶</span>{t("lp.hero.demo")}
                                </button>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.4}>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
                                gap: 1,
                                padding: 1,
                                borderRadius: 20,
                                background: "var(--color-border-soft)",
                                border: "1px solid var(--color-border)",
                                overflow: "hidden",
                                maxWidth: 520,
                                boxShadow: "var(--shadow-sm)",
                            }}>
                                {stats.map((s, i) => (
                                    <div key={i} className="hero-stat-cell" style={{
                                        padding: "16px 14px",
                                        background: "var(--bg-elevated)",
                                    }}>
                                        <div style={{ fontSize: "clamp(20px, 4.8vw, 26px)", fontWeight: 800, color: "var(--color-primary)", letterSpacing: "-.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                            <CountUp end={s.v} suffix={s.s} />
                                        </div>
                                        <div style={{ fontSize: 9.5, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1.1, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{s.l}</div>
                                    </div>
                                ))}
                            </div>
                        </FadeIn>
                    </div>

                    {/* Right: Floating bento cards */}
                    <FadeIn delay={0.2}>
                        <FloatingBento />
                    </FadeIn>
                </div>
            </div>
            <style>{`
                @media (max-width: 900px) {
                    .hero-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
                }
                @media (max-width: 640px) {
                    section.hero-section { padding: 92px 18px 48px !important; min-height: auto !important; }
                    .hero-cta-row { flex-direction: column; }
                    .hero-cta-row button { width: 100%; justify-content: center; }
                    .hero-stat-cell { padding: 14px 10px !important; }
                    .hero-bento-stage {
                        aspect-ratio: auto !important;
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 12px !important;
                    }
                    .hero-bento-orb { display: none !important; }
                    .hero-bento-card {
                        position: relative !important;
                        top: auto !important;
                        left: auto !important;
                        right: auto !important;
                        bottom: auto !important;
                        width: 100% !important;
                        animation: none !important;
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                    }
                    .hero-bento-main { grid-column: span 2 !important; padding: 20px !important; }
                    .hero-bento-ring { grid-column: span 1 !important; padding: 14px 12px !important; justify-content: center; }
                    .hero-bento-goal { grid-column: span 1 !important; padding: 14px !important; display: flex; flex-direction: column; justify-content: center; }
                    .hero-bento-activity { grid-column: span 2 !important; padding: 16px 18px !important; }
                }
            `}</style>
        </section>
    );
};

export default HeroSection;
