import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

const Sidebar = ({ open, activeMenu, setActiveMenu, user }) => {
    const { t, lang, setLang, languages } = useLanguage();
    const [showLangPicker, setShowLangPicker] = useState(false);

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
            width: open ? 260 : 0,
            background: "rgba(10,10,20,0.95)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 50,
            transition: "width 0.3s", overflow: "hidden",
            display: "flex", flexDirection: "column",
        }}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>S</div>
                <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Karaya</span>
                <span style={{ fontSize: 10, color: "#818cf8", marginLeft: 2 }}>.</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
                {sidebarItems.map(g => (
                    <div key={g.group} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 1, padding: "4px 12px", marginBottom: 4 }}>{g.group.toUpperCase()}</div>
                        {g.items.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveMenu(item.id)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    width: "100%", padding: "10px 12px", borderRadius: 10,
                                    border: "none",
                                    background: activeMenu === item.id ? "rgba(99,102,241,.12)" : "transparent",
                                    color: activeMenu === item.id ? "#a5b4fc" : "#94a3b8",
                                    fontSize: 13, fontWeight: activeMenu === item.id ? 600 : 400,
                                    cursor: "pointer", fontFamily: "inherit",
                                    transition: "all .2s", textAlign: "left",
                                }}
                            >
                                <span style={{ fontSize: 16 }}>{item.icon}</span> {item.label}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            {/* Language Picker */}
            <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,.05)", position: "relative" }}>
                <button
                    onClick={() => setShowLangPicker(v => !v)}
                    style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "8px 10px", borderRadius: 10,
                        border: "1px solid rgba(255,255,255,.06)",
                        background: showLangPicker ? "rgba(99,102,241,.1)" : "rgba(255,255,255,.02)",
                        color: "#94a3b8", fontSize: 12, cursor: "pointer",
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
                        background: "rgba(15,15,30,.98)", border: "1px solid rgba(255,255,255,.1)",
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
                                    background: lang === l.code ? "rgba(99,102,241,.15)" : "transparent",
                                    color: lang === l.code ? "#a5b4fc" : "#94a3b8",
                                    fontSize: 12, fontWeight: lang === l.code ? 600 : 400,
                                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                    transition: "all .15s",
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

            {/* User info */}
            <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 700 }}>
                    {user.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                    <div style={{ fontSize: 10, color: planColor, fontWeight: 600 }}>{planText}</div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
