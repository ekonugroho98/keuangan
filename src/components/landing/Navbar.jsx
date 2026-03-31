import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

const Navbar = ({ scrollY, onLogin, onSignup }) => {
    const { t, lang, setLang, languages } = useLanguage();
    const [showLang, setShowLang] = useState(false);
    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    const currentLang = languages.find(l => l.code === lang);

    const navLinks = [
        { label: t("lp.nav.features"), id: "fitur" },
        { label: t("lp.nav.ai"),       id: "ai" },
        { label: t("lp.nav.pricing"),  id: "harga" },
        { label: t("lp.nav.faq"),      id: "faq" },
    ];

    return (
        <nav style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
            padding: "14px 24px",
            background: scrollY > 50 ? "rgba(6,6,14,.85)" : "transparent",
            backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
            borderBottom: scrollY > 50 ? "1px solid rgba(255,255,255,.05)" : "none",
            transition: "all .3s",
        }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>S</div>
                    <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Karaya</span>
                </div>

                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {navLinks.map(l => (
                        <button key={l.id} className="nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>
                    ))}

                    {/* Language Picker */}
                    <div style={{ position: "relative", marginLeft: 4 }}>
                        <button
                            onClick={() => setShowLang(v => !v)}
                            className="nav-link"
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 10px" }}
                        >
                            <span style={{ fontSize: 14 }}>{currentLang?.flag}</span>
                            <span style={{ fontSize: 10, opacity: .6 }}>{showLang ? "▲" : "▼"}</span>
                        </button>
                        {showLang && (
                            <div style={{
                                position: "absolute", top: "calc(100% + 8px)", right: 0,
                                background: "rgba(10,10,20,.98)", border: "1px solid rgba(255,255,255,.1)",
                                borderRadius: 12, padding: 6, minWidth: 160, zIndex: 200,
                                boxShadow: "0 8px 24px rgba(0,0,0,.5)",
                            }}>
                                {languages.map(l => (
                                    <button
                                        key={l.code}
                                        onClick={() => { setLang(l.code); setShowLang(false); }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            width: "100%", padding: "8px 10px", borderRadius: 8,
                                            border: "none",
                                            background: lang === l.code ? "rgba(99,102,241,.15)" : "transparent",
                                            color: lang === l.code ? "#a5b4fc" : "#94a3b8",
                                            fontSize: 12, fontWeight: lang === l.code ? 600 : 400,
                                            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                        }}
                                    >
                                        <span style={{ fontSize: 14 }}>{l.flag}</span>
                                        <span>{l.label}</span>
                                        {lang === l.code && <span style={{ marginLeft: "auto", fontSize: 10, color: "#6366f1" }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className="btn-secondary" onClick={onLogin} style={{ marginLeft: 4, padding: "9px 18px", fontSize: 13 }}>{t("lp.nav.login")}</button>
                    <button className="btn-primary" onClick={onSignup} style={{ marginLeft: 4, padding: "9px 22px", fontSize: 13 }}>{t("lp.nav.signup")}</button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
