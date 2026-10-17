import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useTheme } from "../../i18n/ThemeContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { APP_NAME, APP_TAGLINE } from "../../config/app";

const Navbar = ({ scrollY, onLogin, onSignup }) => {
    const { t, lang, setLang, languages } = useLanguage();
    const { themeId, toggleTheme } = useTheme();
    const [showLang, setShowLang] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const isMobile = useIsMobile();
    const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMobileOpen(false); };
    const currentLang = languages.find(l => l.code === lang);

    const navLinks = [
        { label: t("lp.nav.features"), id: "fitur" },
        { label: t("lp.nav.ai"),       id: "ai" },
        { label: t("lp.nav.faq"),      id: "faq" },
    ];

    return (
        <>
            <nav style={{
                position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
                padding: isMobile ? "12px 16px" : "14px 24px",
                background: (scrollY > 50 || mobileOpen) ? "var(--bg-glass)" : "transparent",
                backdropFilter: (scrollY > 50 || mobileOpen) ? "saturate(160%) blur(20px)" : "none",
                WebkitBackdropFilter: (scrollY > 50 || mobileOpen) ? "saturate(160%) blur(20px)" : "none",
                borderBottom: (scrollY > 50 || mobileOpen) ? "1px solid var(--color-border)" : "none",
                transition: "all .3s",
            }}>
                <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {/* Logo — Keluarga Berkembang */}
                    <div style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }} onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setMobileOpen(false); }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: "#FFFDF8",
                            border: "1px solid var(--color-border)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "var(--shadow-sm)",
                            overflow: "hidden",
                        }}>
                            <img src="/logo-icon.png" alt={APP_NAME} style={{ width: 36, height: 36, objectFit: "contain" }} />
                        </div>
                        <div>
                            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: isMobile ? 16 : 18, letterSpacing: "-.01em", lineHeight: 1.1 }}>
                                <span style={{ color: "var(--color-soil, #7D513B)" }}>KELUARGA </span>
                                <span style={{ color: "var(--color-primary, #46634E)" }}>BERKEMBANG</span>
                            </div>
                            {!isMobile && (
                                <div className="font-quote" style={{ fontSize: 13.5, color: "var(--color-muted)", lineHeight: 1.1, marginTop: 1 }}>
                                    {APP_TAGLINE}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop Nav */}
                    {!isMobile && (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {navLinks.map(l => (
                                <button key={l.id} className="nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>
                            ))}

                            {/* Theme Toggle (Soft Sage Light vs Dark Sage) */}
                            <button
                                onClick={toggleTheme}
                                title={themeId === "dark" ? "Mode Sejuk (Terang)" : "Mode Teduh (Gelap)"}
                                className="nav-link"
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", marginLeft: 4 }}
                            >
                                <span style={{ fontSize: 15 }}>{themeId === "dark" ? "🌿" : "🌙"}</span>
                            </button>

                            {/* Language Picker */}
                            <div style={{ position: "relative" }}>
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
                                        background: "var(--bg-elevated)", border: "1px solid var(--color-border)",
                                        borderRadius: 12, padding: 6, minWidth: 160, zIndex: 200,
                                        boxShadow: "var(--shadow-lg)",
                                    }}>
                                        {languages.map(l => (
                                            <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    width: "100%", padding: "8px 10px", borderRadius: 8, border: "none",
                                                    background: lang === l.code ? "var(--color-primary-soft)" : "transparent",
                                                    color: lang === l.code ? "var(--color-primary)" : "var(--color-muted)",
                                                    fontSize: 12, fontWeight: lang === l.code ? 700 : 500,
                                                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                                }}>
                                                <span style={{ fontSize: 14 }}>{l.flag}</span>
                                                <span>{l.label}</span>
                                                {lang === l.code && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-primary)" }}>✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button className="btn-secondary" onClick={onLogin} style={{ marginLeft: 4, padding: "9px 18px", fontSize: 13 }}>{t("lp.nav.login")}</button>
                            <button className="btn-primary" onClick={onSignup} style={{ marginLeft: 4, padding: "9px 22px", fontSize: 13 }}>{t("lp.nav.signup")}</button>
                        </div>
                    )}

                    {/* Mobile: Theme + Lang + Hamburger */}
                    {isMobile && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                                onClick={toggleTheme}
                                style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center" }}
                            >
                                <span>{themeId === "dark" ? "🌿" : "🌙"}</span>
                            </button>
                            <button
                                onClick={() => { setShowLang(v => !v); setMobileOpen(false); }}
                                style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", gap: 4 }}
                            >
                                <span>{currentLang?.flag}</span>
                            </button>
                            <button
                                onClick={() => { setMobileOpen(v => !v); setShowLang(false); }}
                                style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "var(--color-text)", fontSize: 18, display: "flex", alignItems: "center" }}
                            >
                                {mobileOpen ? "✕" : "☰"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile lang dropdown */}
                {isMobile && showLang && (
                    <div style={{ maxWidth: 1200, margin: "8px auto 0", padding: "0 4px" }}>
                        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 6 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                                {languages.map(l => (
                                    <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 6,
                                            padding: "8px 10px", borderRadius: 8, border: "none",
                                            background: lang === l.code ? "var(--color-primary-soft)" : "transparent",
                                            color: lang === l.code ? "var(--color-primary)" : "var(--color-muted)",
                                            fontSize: 12, fontWeight: lang === l.code ? 700 : 500,
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
                        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 4, boxShadow: "var(--shadow-lg)" }}>
                            {navLinks.map(l => (
                                <button key={l.id} onClick={() => scrollTo(l.id)}
                                    style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "none", background: "transparent", color: "var(--color-text)", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                    {l.label}
                                </button>
                            ))}
                            <div style={{ borderTop: "1px solid var(--color-border-soft)", marginTop: 4, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
