import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useIsMobile } from "../../hooks/useIsMobile";

const Navbar = ({ scrollY, onLogin, onSignup }) => {
    const { t, lang, setLang, languages } = useLanguage();
    const [showLang, setShowLang] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const isMobile = useIsMobile();
    const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMobileOpen(false); };
    const currentLang = languages.find(l => l.code === lang);

    const navLinks = [
        { label: t("lp.nav.features"), id: "fitur" },
        { label: t("lp.nav.ai"),       id: "ai" },
        { label: t("lp.nav.pricing"),  id: "harga" },
        { label: t("lp.nav.faq"),      id: "faq" },
    ];

    return (
        <>
            <nav style={{
                position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
                padding: isMobile ? "12px 16px" : "14px 24px",
                background: (scrollY > 50 || mobileOpen) ? "rgba(14,14,21,.95)" : "transparent",
                backdropFilter: (scrollY > 50 || mobileOpen) ? "blur(20px)" : "none",
                borderBottom: (scrollY > 50 || mobileOpen) ? "1px solid rgba(255,255,255,.05)" : "none",
                transition: "all .3s",
            }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {/* Logo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setMobileOpen(false); }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#005e44" }}>K</div>
                        <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Karaya</span>
                    </div>

                    {/* Desktop Nav */}
                    {!isMobile && (
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
                                        background: "rgba(14,14,21,.98)", border: "1px solid rgba(255,255,255,.1)",
                                        borderRadius: 12, padding: 6, minWidth: 160, zIndex: 200,
                                        boxShadow: "0 8px 24px rgba(0,0,0,.5)",
                                    }}>
                                        {languages.map(l => (
                                            <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    width: "100%", padding: "8px 10px", borderRadius: 8, border: "none",
                                                    background: lang === l.code ? "rgba(96,252,198,.15)" : "transparent",
                                                    color: lang === l.code ? "#60fcc6" : "var(--color-muted)",
                                                    fontSize: 12, fontWeight: lang === l.code ? 600 : 400,
                                                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                                }}>
                                                <span style={{ fontSize: 14 }}>{l.flag}</span>
                                                <span>{l.label}</span>
                                                {lang === l.code && <span style={{ marginLeft: "auto", fontSize: 10, color: "#60fcc6" }}>✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button className="btn-secondary" onClick={onLogin} style={{ marginLeft: 4, padding: "9px 18px", fontSize: 13 }}>{t("lp.nav.login")}</button>
                            <button className="btn-primary" onClick={onSignup} style={{ marginLeft: 4, padding: "9px 22px", fontSize: 13 }}>{t("lp.nav.signup")}</button>
                        </div>
                    )}

                    {/* Mobile: Lang + Hamburger */}
                    {isMobile && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Mobile lang flag */}
                            <button
                                onClick={() => { setShowLang(v => !v); setMobileOpen(false); }}
                                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", gap: 4 }}
                            >
                                <span>{currentLang?.flag}</span>
                            </button>
                            {/* Hamburger */}
                            <button
                                onClick={() => { setMobileOpen(v => !v); setShowLang(false); }}
                                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "#fff", fontSize: 18, display: "flex", alignItems: "center" }}
                            >
                                {mobileOpen ? "✕" : "☰"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile lang dropdown */}
                {isMobile && showLang && (
                    <div style={{ maxWidth: 1200, margin: "8px auto 0", padding: "0 4px" }}>
                        <div style={{ background: "rgba(14,14,21,.98)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: 6 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                                {languages.map(l => (
                                    <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 6,
                                            padding: "8px 10px", borderRadius: 8, border: "none",
                                            background: lang === l.code ? "rgba(96,252,198,.15)" : "transparent",
                                            color: lang === l.code ? "#60fcc6" : "#94a3b8",
                                            fontSize: 12, fontWeight: lang === l.code ? 600 : 400,
                                            cursor: "pointer", fontFamily: "inherit",
                                        }}>
                                        <span style={{ fontSize: 14 }}>{l.flag}</span>
                                        <span>{l.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile menu */}
                {isMobile && mobileOpen && (
                    <div style={{ maxWidth: 1200, margin: "12px auto 0", padding: "0 4px", animation: "slideUp .2s" }}>
                        <div style={{ background: "rgba(10,10,20,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                            {navLinks.map(l => (
                                <button key={l.id} onClick={() => scrollTo(l.id)}
                                    style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "none", background: "transparent", color: "#cbd5e1", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                                    {l.label}
                                </button>
                            ))}
                            <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", marginTop: 4, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                <button className="btn-secondary" onClick={() => { onLogin(); setMobileOpen(false); }} style={{ width: "100%", padding: "12px", fontSize: 14 }}>{t("lp.nav.login")}</button>
                                <button className="btn-primary" onClick={() => { onSignup(); setMobileOpen(false); }} style={{ width: "100%", padding: "12px", fontSize: 14 }}>{t("lp.nav.signup")}</button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Backdrop for lang dropdown on desktop */}
            {showLang && !isMobile && (
                <div onClick={() => setShowLang(false)} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
            )}
        </>
    );
};

export default Navbar;
