import FadeIn from "../ui/FadeIn";
import CountUp from "../ui/CountUp";
import { useLanguage } from "../../i18n/LanguageContext";

/* ─────────────────────────────────────────────────────────────
 * Floating bento cards — replaces the single phone mockup
 * with an asymmetric collage that feels modern & alive.
 * ───────────────────────────────────────────────────────────── */
const FloatingBento = () => (
    <div style={{ position: "relative", width: "100%", maxWidth: 520, margin: "0 auto", aspectRatio: "1/1" }}>
        {/* Ambient orb */}
        <div style={{
            position: "absolute", inset: "-10%",
            background: "radial-gradient(circle at 60% 40%, rgba(96,252,198,.18), transparent 55%), radial-gradient(circle at 20% 80%, rgba(79,195,247,.08), transparent 60%)",
            pointerEvents: "none",
            filter: "blur(20px)",
        }} />

        {/* Big hero card — net worth */}
        <div style={{
            position: "absolute", top: "6%", left: "4%", width: "62%",
            background: "linear-gradient(145deg, rgba(25,25,35,.95), rgba(20,20,28,.9))",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "0 40px 80px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)",
            backdropFilter: "blur(20px)",
            animation: "float 6s ease-in-out infinite",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: "#60fcc6", boxShadow: "0 0 10px #60fcc6", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 10, color: "#acaab4", letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 700 }}>Kekayaan bersih</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                Rp 124,5 <span style={{ color: "#acaab4", fontWeight: 700 }}>jt</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 12, padding: "4px 10px", background: "rgba(96,252,198,.12)", border: "1px solid rgba(96,252,198,.22)", borderRadius: 99, fontSize: 11, fontWeight: 700, color: "#60fcc6" }}>↑ +8,4% bulan ini</div>
            {/* Mini sparkline */}
            <svg viewBox="0 0 200 40" style={{ width: "100%", height: 40, marginTop: 14, display: "block" }}>
                <defs>
                    <linearGradient id="heroSpark" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#60fcc6" stopOpacity=".35" />
                        <stop offset="100%" stopColor="#60fcc6" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d="M 0 30 C 25 28, 40 18, 60 20 S 100 12, 130 10 S 180 4, 200 6 L 200 40 L 0 40 Z" fill="url(#heroSpark)" />
                <path d="M 0 30 C 25 28, 40 18, 60 20 S 100 12, 130 10 S 180 4, 200 6" stroke="#60fcc6" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
        </div>

        {/* Saving rate ring card */}
        <div style={{
            position: "absolute", top: "2%", right: "2%", width: "36%",
            background: "linear-gradient(145deg, rgba(20,20,28,.95), rgba(16,16,22,.9))",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 20,
            padding: "18px",
            boxShadow: "0 30px 60px rgba(0,0,0,.4)",
            backdropFilter: "blur(20px)",
            animation: "float 7s ease-in-out infinite .5s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
            <div style={{ position: "relative", width: 80, height: 80 }}>
                <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="40" cy="40" r="34" fill="transparent" stroke="rgba(255,255,255,.05)" strokeWidth="6" />
                    <circle cx="40" cy="40" r="34" fill="transparent" stroke="#60fcc6" strokeWidth="6"
                        strokeDasharray="160 213" strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 8px rgba(96,252,198,.5))" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-.03em" }}>32%</span>
                </div>
            </div>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#acaab4", textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>Rasio Tabungan</div>
                <div style={{ fontSize: 10, color: "#60fcc6", fontWeight: 700, marginTop: 4 }}>Mantap 👍</div>
            </div>
        </div>

        {/* Transaction card */}
        <div style={{
            position: "absolute", bottom: "6%", right: "6%", width: "58%",
            background: "linear-gradient(145deg, rgba(22,22,30,.95), rgba(17,17,24,.9))",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 20,
            padding: "18px 20px",
            boxShadow: "0 40px 70px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)",
            backdropFilter: "blur(20px)",
            animation: "float 8s ease-in-out infinite 1s",
        }}>
            <div style={{ fontSize: 10, color: "#acaab4", textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 12 }}>Aktivitas Terbaru</div>
            {[
                { icon: "💰", name: "Gaji Maret", amount: "+Rp 8,5 jt", color: "#60fcc6", bg: "rgba(96,252,198,.1)" },
                { icon: "🍽️", name: "Makan siang", amount: "−Rp 45K", color: "#ff716c", bg: "rgba(255,113,108,.08)" },
                { icon: "🛵", name: "Gojek", amount: "−Rp 25K", color: "#ff716c", bg: "rgba(255,113,108,.08)" },
            ].map((tx, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: tx.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{tx.icon}</div>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#efecf7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: tx.color, fontVariantNumeric: "tabular-nums" }}>{tx.amount}</span>
                </div>
            ))}
        </div>

        {/* Small category pill card */}
        <div style={{
            position: "absolute", bottom: "20%", left: "2%", width: "36%",
            background: "linear-gradient(145deg, rgba(20,20,28,.95), rgba(15,15,22,.9))",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 18,
            padding: "16px 18px",
            boxShadow: "0 30px 60px rgba(0,0,0,.4)",
            backdropFilter: "blur(20px)",
            animation: "float 7.5s ease-in-out infinite .8s",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>🎯</span>
                <span style={{ fontSize: 10, color: "#acaab4", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Target</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-.02em" }}>Beli Laptop</div>
            <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,.06)", marginBottom: 6 }}>
                <div style={{ width: "68%", height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #a78bfa, rgba(167,139,250,.6))" }} />
            </div>
            <div style={{ fontSize: 10, color: "#acaab4", fontWeight: 600 }}>68% tercapai</div>
        </div>
    </div>
);

const HeroSection = ({ onSignup, onDemo }) => {
    const { t } = useLanguage();

    const stats = [
        { v: 500, s: "+", l: t("lp.hero.users") },
        { v: 98, s: "%", l: t("lp.hero.satisfaction") },
        { v: 2, s: "M+", l: t("lp.hero.tx") },
    ];

    return (
        <section style={{
            minHeight: "100vh", display: "flex", alignItems: "center",
            position: "relative", overflow: "hidden",
            padding: "120px 24px 80px",
            backgroundImage:
                "radial-gradient(1200px 600px at 10% -10%, rgba(96,252,198,.08), transparent 60%)," +
                "radial-gradient(900px 500px at 110% 110%, rgba(79,195,247,.05), transparent 60%)," +
                "radial-gradient(rgba(96,252,198,.06) 1px,transparent 1px)",
            backgroundSize: "auto, auto, 28px 28px",
        }}>
            {/* Grain overlay */}
            <div style={{ position: "absolute", inset: 0, opacity: .02, pointerEvents: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

            <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", position: "relative", zIndex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
                    {/* Left */}
                    <div>
                        <FadeIn>
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: 10,
                                padding: "6px 14px 6px 6px", borderRadius: 99,
                                background: "rgba(96,252,198,.06)",
                                border: "1px solid rgba(96,252,198,.2)",
                                marginBottom: 28,
                                backdropFilter: "blur(20px)",
                            }}>
                                <span style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "3px 10px", borderRadius: 99,
                                    background: "linear-gradient(135deg, #60fcc6, #19ce9b)",
                                    color: "#003828", fontSize: 10, fontWeight: 800, letterSpacing: .5,
                                }}>BARU</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#60fcc6", letterSpacing: "-.01em" }}>{t("lp.hero.badge")}</span>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.1}>
                            <h1 style={{
                                fontSize: "clamp(40px,5.5vw,72px)",
                                fontWeight: 900, lineHeight: 1.02,
                                marginBottom: 24,
                                letterSpacing: "-.04em", color: "#fff",
                            }}>
                                {t("lp.hero.h1")}<br />
                                <span className="gradient-text">{t("lp.hero.h1g")}</span>
                            </h1>
                        </FadeIn>

                        <FadeIn delay={0.2}>
                            <p style={{
                                fontSize: "clamp(15px,1.5vw,17px)",
                                color: "var(--color-muted)",
                                maxWidth: 500, marginBottom: 36,
                                lineHeight: 1.65, letterSpacing: "-.01em",
                            }}>
                                {t("lp.hero.desc")}
                            </p>
                        </FadeIn>

                        <FadeIn delay={0.3}>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
                                <button className="btn-primary" style={{ fontSize: 15, padding: "15px 34px" }} onClick={onSignup}>{t("lp.hero.cta")}</button>
                                <button className="btn-secondary" style={{ fontSize: 15, padding: "15px 34px" }} onClick={onDemo}>
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
                                background: "rgba(255,255,255,.04)",
                                border: "1px solid rgba(255,255,255,.06)",
                                overflow: "hidden",
                                maxWidth: 520,
                            }}>
                                {stats.map((s, i) => (
                                    <div key={i} style={{
                                        padding: "16px 18px",
                                        background: "rgba(14,14,21,.6)",
                                        backdropFilter: "blur(10px)",
                                    }}>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                                            <CountUp end={s.v} suffix={s.s} />
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1.8, fontWeight: 700, marginTop: 6 }}>{s.l}</div>
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
        </section>
    );
};

export default HeroSection;
