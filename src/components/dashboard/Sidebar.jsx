import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useTheme } from "../../i18n/ThemeContext";

const Sidebar = ({ open, activeMenu, setActiveMenu, user, onAddTx }) => {
    const { t, lang, setLang, languages } = useLanguage();
    const { themeId, setTheme, themes } = useTheme();
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [showThemePicker, setShowThemePicker] = useState(false);

    const sidebarItems = [
        { group: t("nav.summary"),  items: [{ id: "dasbor",    label: t("nav.dashboard"),    icon: "📊" }] },
        { group: t("nav.transactions"), items: [
            { id: "transaksi", label: t("nav.transaction"), icon: "💳" },
            { id: "akun",      label: t("nav.accounts"),    icon: "🏦" },
            { id: "kategori",  label: t("nav.categories"),  icon: "🏷️" },
            { id: "berulang",  label: t("nav.recurring"),   icon: "🔄" },
        ]},
        { group: t("nav.planning"), items: [
            { id: "goals",     label: t("nav.goals"),       icon: "🎯" },
            { id: "hutang",    label: t("nav.debts"),       icon: "📋" },
            { id: "investasi", label: t("nav.investments"), icon: "📈" },
        ]},
        { group: t("nav.insight"), items: [
            { id: "laporan",   label: t("nav.reports"),     icon: "📉" },
            { id: "ai",        label: t("nav.ai"),          icon: "🤖" },
        ]},
    ];

    const planLabel = (plan, expiresAt) => {
        const expired = expiresAt ? new Date() > new Date(expiresAt) : false;
        if (!plan || plan === "trial") return { text: expired ? "Trial Expired" : "Free Trial", color: expired ? "#f87171" : "#64748b" };
        if (plan === "starter") return { text: "Starter 🚀", color: "#6ee7b7" };
        if (plan === "pro")     return { text: "Pro ⭐",     color: "#fcd34d" };
        return { text: plan, color: "#64748b" };
    };

    const { text: planText, color: planColor } = planLabel(user.plan, user.expiresAt);
    const currentLang = languages.find(l => l.code === lang);

    return (
        <aside style={{
            width: open ? 240 : 0,
            background: "#0F0F1A",
            height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 50,
            transition: "width 0.3s", overflow: "hidden",
            display: "flex", flexDirection: "column",
        }}>
            {/* Logo */}
            <div style={{ padding: "24px 24px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#19ce9b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#003d2b" }}>K</div>
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>Karaya</h1>
                    <p style={{ fontSize: 9, color: "#60fcc6", letterSpacing: 3, textTransform: "uppercase", margin: "3px 0 0" }}>Wealth Ledger</p>
                </div>
            </div>

            {/* + Transaksi Button */}
            <div style={{ padding: "0 16px 20px" }}>
                <button
                    onClick={onAddTx}
                    style={{
                        width: "100%", padding: "12px 0",
                        background: "#19ce9b", color: "#003d2b",
                        fontWeight: 700, fontSize: 13,
                        borderRadius: 12, border: "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "opacity .2s",
                    }}
                    onMouseOver={e => e.currentTarget.style.opacity = ".85"}
                    onMouseOut={e => e.currentTarget.style.opacity = "1"}
                >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                    <span>{t("nav.transaction")}</span>
                </button>
            </div>

            {/* Nav items */}
            <nav style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
                {sidebarItems.map(g => (
                    <div key={g.group} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#3d4456", letterSpacing: 1.5, padding: "0 12px", marginBottom: 4 }}>{g.group.toUpperCase()}</div>
                        {g.items.map(item => {
                            const isActive = activeMenu === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveMenu(item.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        width: "100%", padding: "10px 12px",
                                        borderRadius: 0,
                                        border: "none",
                                        borderRight: isActive ? "2px solid #00C896" : "2px solid transparent",
                                        background: isActive ? "rgba(27,27,34,.5)" : "transparent",
                                        color: isActive ? "#00C896" : "#8B8BA8",
                                        fontSize: 13, fontWeight: isActive ? 700 : 400,
                                        cursor: "pointer", fontFamily: "inherit",
                                        transition: "all .15s", textAlign: "left",
                                    }}
                                >
                                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Language Picker */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,.05)", position: "relative" }}>
                <button
                    onClick={() => { setShowLangPicker(v => !v); setShowThemePicker(false); }}
                    style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "8px 10px", borderRadius: 8,
                        border: "none",
                        background: "transparent",
                        color: "#8B8BA8", fontSize: 12, cursor: "pointer",
                        fontFamily: "inherit", transition: "all .2s",
                    }}
                >
                    <span style={{ fontSize: 15 }}>🌐</span>
                    <span style={{ flex: 1, textAlign: "left" }}>{currentLang?.flag} {currentLang?.label}</span>
                    <span style={{ fontSize: 9, opacity: .6 }}>{showLangPicker ? "▲" : "▼"}</span>
                </button>

                {showLangPicker && (
                    <div style={{
                        position: "absolute", bottom: "100%", left: 12, right: 12,
                        background: "rgba(25,25,33,.98)", border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 12, padding: 6, zIndex: 100,
                        boxShadow: "0 -8px 24px rgba(0,0,0,.5)",
                    }}>
                        {languages.map(l => (
                            <button
                                key={l.code}
                                onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    width: "100%", padding: "8px 10px", borderRadius: 8,
                                    border: "none",
                                    background: lang === l.code ? "rgba(96,252,198,.15)" : "transparent",
                                    color: lang === l.code ? "#60fcc6" : "var(--color-muted)",
                                    fontSize: 12, fontWeight: lang === l.code ? 600 : 400,
                                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                    transition: "all .15s",
                                }}
                            >
                                <span style={{ fontSize: 14 }}>{l.flag}</span>
                                <span>{l.label}</span>
                                {lang === l.code && <span style={{ marginLeft: "auto", fontSize: 10, color: "#60fcc6" }}>✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Theme Picker */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,.05)", position: "relative" }}>
                <button
                    onClick={() => { setShowThemePicker(v => !v); setShowLangPicker(false); }}
                    style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "8px 10px", borderRadius: 8,
                        border: "none",
                        background: "transparent",
                        color: "#8B8BA8", fontSize: 12, cursor: "pointer",
                        fontFamily: "inherit", transition: "all .2s",
                    }}
                >
                    <span style={{ fontSize: 15 }}>{themes[themeId]?.icon || "🎨"}</span>
                    <span style={{ flex: 1, textAlign: "left" }}>{themes[themeId]?.name || "Tema"}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                        {Object.values(themes).map(th => (
                            <div key={th.id} style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: th.preview[2],
                                opacity: themeId === th.id ? 1 : 0.35,
                                transition: "opacity .2s",
                            }} />
                        ))}
                    </div>
                </button>

                {showThemePicker && (
                    <div style={{
                        position: "absolute", bottom: "100%", left: 12, right: 12,
                        background: "rgba(25,25,33,.98)", border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 12, padding: 6, zIndex: 100,
                        boxShadow: "0 -8px 24px rgba(0,0,0,.5)",
                    }}>
                        {Object.values(themes).map(th => (
                            <button
                                key={th.id}
                                onClick={() => { setTheme(th.id); setShowThemePicker(false); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    width: "100%", padding: "8px 10px", borderRadius: 8,
                                    border: "none",
                                    background: themeId === th.id ? "rgba(255,255,255,.08)" : "transparent",
                                    color: themeId === th.id ? "#fff" : "#8B8BA8",
                                    fontSize: 12, fontWeight: themeId === th.id ? 600 : 400,
                                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                    transition: "all .15s",
                                }}
                            >
                                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                                    {th.preview.map((c, i) => (
                                        <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
                                    ))}
                                </div>
                                <span style={{ fontSize: 13 }}>{th.icon}</span>
                                <span style={{ flex: 1 }}>{th.name}</span>
                                {themeId === th.id && <span style={{ fontSize: 10, color: th.preview[2] }}>✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* User info */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1f1f26", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#60fcc6", fontWeight: 700, flexShrink: 0 }}>
                    {user.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                    <div style={{ fontSize: 10, color: planColor, fontWeight: 600 }}>{planText}</div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
