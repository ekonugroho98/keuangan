import FadeIn from "../ui/FadeIn";
import CountUp from "../ui/CountUp";
import { useLanguage } from "../../i18n/LanguageContext";

const PhoneMockup = () => (
    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        {/* Emerald orb behind phone */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle, rgba(96,252,198,.15) 0%, transparent 70%)", transform: "scale(1.5) translateX(20px)", zIndex: 0, pointerEvents: "none" }} />
        {/* Phone frame */}
        <div style={{
            width: 260, aspectRatio: "9/19",
            background: "#000", borderRadius: 48,
            padding: 10, border: "6px solid rgba(255,255,255,.1)",
            boxShadow: "0 32px 80px rgba(0,0,0,.6), 0 0 40px rgba(96,252,198,.08)",
            position: "relative", zIndex: 1,
        }}>
            <div style={{ height: "100%", background: "#191921", borderRadius: 38, overflow: "hidden", padding: 16 }}>
                {/* Phone header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <span style={{ fontSize: 18 }}>☰</span>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(96,252,198,.2)", border: "1px solid rgba(96,252,198,.4)" }} />
                </div>
                {/* Balance */}
                <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 9, color: "#acaab4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Saldo Total</p>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>Rp 24.500.000</h3>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9, fontWeight: 700, color: "#60fcc6", background: "rgba(96,252,198,.1)", padding: "2px 8px", borderRadius: 99, marginTop: 4 }}>↑ +2.3%</div>
                </div>
                {/* Account chips */}
                <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                    {["BCA", "GoPay", "Cash"].map(a => (
                        <div key={a} style={{ padding: "3px 10px", background: "#25252f", borderRadius: 99, fontSize: 9, fontWeight: 700, border: "1px solid rgba(255,255,255,.05)" }}>{a}</div>
                    ))}
                </div>
                {/* Transactions */}
                <p style={{ fontSize: 9, color: "#acaab4", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Transaksi Terbaru</p>
                {[
                    { icon: "🍽️", name: "Makan Siang", amount: "-Rp 45K", color: "#ff716c" },
                    { icon: "💰", name: "Gaji", amount: "+Rp 8.5M", color: "#60fcc6" },
                    { icon: "🛵", name: "Gojek", amount: "-Rp 25K", color: "#ff716c" },
                    { icon: "🏠", name: "Kos", amount: "-Rp 1.5M", color: "#ff716c" },
                ].map((tx, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 8, background: tx.color === "#60fcc6" ? "rgba(96,252,198,.1)" : "#25252f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{tx.icon}</div>
                            <span style={{ fontSize: 9, fontWeight: 700 }}>{tx.name}</span>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 800, color: tx.color }}>{tx.amount}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const HeroSection = ({ onSignup, onDemo }) => {
    const { t } = useLanguage();

    const stats = [
        { v: 500, s: "+",  l: t("lp.hero.users") },
        { v: 98,  s: "%",  l: t("lp.hero.satisfaction") },
        { v: 2,   s: "M+", l: t("lp.hero.tx") },
    ];

    return (
        <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden", padding: "120px 24px 80px", backgroundImage: "radial-gradient(rgba(96,252,198,.06) 1px,transparent 1px)", backgroundSize: "24px 24px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", position: "relative", zIndex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
                    {/* Left: Text */}
                    <div>
                        <FadeIn>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 99, background: "rgba(96,252,198,.1)", border: "1px solid rgba(96,252,198,.3)", marginBottom: 32 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#60fcc6", animation: "pulse 2s ease infinite", flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#60fcc6" }}>{t("lp.hero.badge")}</span>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.1}>
                            <h1 style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24, letterSpacing: "-.03em", color: "#fff" }}>
                                {t("lp.hero.h1")}<br /><span className="gradient-text">{t("lp.hero.h1g")}</span>
                            </h1>
                        </FadeIn>

                        <FadeIn delay={0.2}>
                            <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "#acaab4", maxWidth: 480, marginBottom: 40, lineHeight: 1.7 }}>
                                {t("lp.hero.desc")}
                            </p>
                        </FadeIn>

                        <FadeIn delay={0.3}>
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 56 }}>
                                <button className="btn-primary" style={{ fontSize: 16, padding: "16px 40px", boxShadow: "0 0 20px rgba(96,252,198,.3)" }} onClick={onSignup}>{t("lp.hero.cta")}</button>
                                <button style={{ fontSize: 16, padding: "16px 40px", borderRadius: 9999, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", backdropFilter: "blur(20px)", color: "#e7e4ee", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .3s" }} onClick={onDemo}>{t("lp.hero.demo")}</button>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.4}>
                            <div style={{ display: "flex", alignItems: "center", gap: 40, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,.05)", flexWrap: "wrap" }}>
                                {stats.map((s, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                        {i > 0 && <div style={{ width: 1, height: 40, background: "rgba(255,255,255,.1)" }} />}
                                        <div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}><CountUp end={s.v} suffix={s.s} /></div>
                                            <div style={{ fontSize: 11, color: "#acaab4", textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginTop: 2 }}>{s.l}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </FadeIn>
                    </div>

                    {/* Right: Phone Mockup */}
                    <FadeIn delay={0.2}>
                        <PhoneMockup />
                    </FadeIn>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
