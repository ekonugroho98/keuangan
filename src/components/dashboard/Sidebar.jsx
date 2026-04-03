import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useTheme } from "../../i18n/ThemeContext";

const AVATAR_COLORS = [
    "#60fcc6","#4FC3F7","#f59e0b","#ff716c",
    "#a855f7","#ec4899","#14b8a6","#f97316",
];

const Sidebar = ({
    open, activeMenu, setActiveMenu, user, onAddTx,
    onToggleSidebar, onLogout,
    onUpdateName, onUpdatePassword, onExportCSV, onDeleteAccount,
}) => {
    const { t, lang, setLang, languages } = useLanguage();
    const { themeId, toggleTheme } = useTheme();
    const [showLangPicker,   setShowLangPicker]   = useState(false);
    const [showProfileMenu,  setShowProfileMenu]  = useState(false);
    const [profileView,      setProfileView]      = useState("menu"); // "menu"|"name"|"password"|"color"|"menus"|"delete"
    const [hiddenMenus,      setHiddenMenus]      = useState(
        () => JSON.parse(localStorage.getItem("karaya_hidden_menus") || "[]")
    );
    const [newName,          setNewName]          = useState(user.name);
    const [newPass,          setNewPass]          = useState("");
    const [confirmPass,      setConfirmPass]      = useState("");
    const [passError,        setPassError]        = useState("");
    const [isSaving,         setIsSaving]        = useState(false);
    const [avatarColor,      setAvatarColor]      = useState(
        () => localStorage.getItem("karaya_avatar_color") || "var(--color-primary)"
    );

    const isDark = themeId === "dark";

    /* ── handlers ── */
    const handleUpdateName = async () => {
        if (!newName.trim() || isSaving) return;
        setIsSaving(true);
        await onUpdateName(newName.trim());
        setIsSaving(false);
        setProfileView("menu");
    };

    const handleUpdatePass = async () => {
        if (isSaving) return;
        if (newPass.length < 6) { setPassError("Password minimal 6 karakter"); return; }
        if (newPass !== confirmPass) { setPassError("Password tidak cocok"); return; }
        setPassError("");
        setIsSaving(true);
        await onUpdatePassword(newPass);
        setIsSaving(false);
        setNewPass(""); setConfirmPass("");
        setProfileView("menu");
    };

    const handleAvatarColor = (color) => {
        setAvatarColor(color);
        localStorage.setItem("karaya_avatar_color", color);
    };

    const closeProfile = () => { setShowProfileMenu(false); setProfileView("menu"); };

    const toggleHideMenu = (id) => {
        setHiddenMenus(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            localStorage.setItem("karaya_hidden_menus", JSON.stringify(next));
            return next;
        });
    };

    /* ── nav items (semua menu, sebelum difilter) ── */
    const allSidebarItems = [
        { group: t("nav.summary"),  items: [{ id: "dasbor",    label: t("nav.dashboard"),    icon: "📊" }] },
        { group: t("nav.transactions"), items: [
            { id: "transaksi", label: t("nav.transaction"), icon: "💳" },
            { id: "akun",      label: t("nav.accounts"),    icon: "🏦" },
            { id: "kategori",  label: t("nav.categories"),  icon: "🏷️" },
            { id: "berulang",  label: t("nav.recurring"),   icon: "🔄" },
            { id: "splitbill", label: t("nav.splitbill"),   icon: "🧾" },
        ]},
        { group: t("nav.planning"), items: [
            { id: "goals",     label: t("nav.goals"),       icon: "🎯" },
            { id: "hutang",    label: t("nav.debts"),       icon: "📋" },
            { id: "investasi", label: t("nav.investments"), icon: "📈" },
            { id: "anggaran",  label: t("nav.budgets"),     icon: "💰" },
        ]},
        { group: t("nav.insight"), items: [
            { id: "laporan",   label: t("nav.reports"),     icon: "📉" },
            { id: "ai",        label: t("nav.ai"),          icon: "🤖" },
            { id: "prediksi",  label: t("nav.prediksi"),    icon: "🔮" },
        ]},
    ];

    /* Filter hidden menus (dasbor tidak bisa disembunyikan) */
    const sidebarItems = allSidebarItems.map(g => ({
        ...g,
        items: g.items.filter(item => item.id === "dasbor" || !hiddenMenus.includes(item.id)),
    })).filter(g => g.items.length > 0);

    const planLabel = (plan, expiresAt) => {
        const expired = expiresAt ? new Date() > new Date(expiresAt) : false;
        if (!plan || plan === "trial") return { text: expired ? "Trial Expired" : "Free Trial", color: expired ? "#f87171" : "#64748b" };
        if (plan === "starter") return { text: "Starter 🚀", color: "#6ee7b7" };
        if (plan === "pro")     return { text: "Pro ⭐",     color: "#fcd34d" };
        return { text: plan, color: "#64748b" };
    };

    const { text: planText, color: planColor } = planLabel(user.plan, user.expiresAt);
    const currentLang = languages.find(l => l.code === lang);

    /* ── shared input style ── */
    const inputSt = {
        width: "100%", boxSizing: "border-box",
        padding: "9px 12px", borderRadius: 9,
        border: "1px solid var(--color-border)",
        background: "var(--bg-surface-low)",
        color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none",
    };
    const menuBtn = (danger = false) => ({
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "9px 10px", borderRadius: 8,
        border: "none", background: "transparent",
        color: danger ? "#ff716c" : "var(--color-muted)",
        fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        transition: "background .15s",
    });

    /* ── profile popup content ── */
    const renderProfilePanel = () => {
        /* Name editor */
        if (profileView === "name") return (
            <div style={{ padding: "4px 4px 0" }}>
                <button onClick={() => setProfileView("menu")} style={{ ...menuBtn(), marginBottom: 8, color: "var(--color-subtle)", fontSize: 11 }}>← Kembali</button>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-subtle)", marginBottom: 6 }}>NAMA TAMPILAN</div>
                <input value={newName} onChange={e => setNewName(e.target.value)} style={{ ...inputSt, marginBottom: 10 }} placeholder="Nama kamu" onKeyDown={e => e.key === "Enter" && handleUpdateName()} />
                <button onClick={handleUpdateName} disabled={!newName.trim() || isSaving}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: isSaving ? .5 : 1 }}>
                    {isSaving ? "Menyimpan..." : "Simpan Nama"}
                </button>
            </div>
        );

        /* Password editor */
        if (profileView === "password") return (
            <div style={{ padding: "4px 4px 0" }}>
                <button onClick={() => { setProfileView("menu"); setPassError(""); setNewPass(""); setConfirmPass(""); }} style={{ ...menuBtn(), marginBottom: 8, color: "var(--color-subtle)", fontSize: 11 }}>← Kembali</button>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-subtle)", marginBottom: 6 }}>GANTI PASSWORD</div>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} style={{ ...inputSt, marginBottom: 8 }} placeholder="Password baru (min. 6 karakter)" />
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={{ ...inputSt, marginBottom: passError ? 6 : 10 }} placeholder="Konfirmasi password" onKeyDown={e => e.key === "Enter" && handleUpdatePass()} />
                {passError && <div style={{ fontSize: 11, color: "#ff716c", marginBottom: 8 }}>{passError}</div>}
                <button onClick={handleUpdatePass} disabled={!newPass || !confirmPass || isSaving}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: (!newPass || !confirmPass || isSaving) ? .5 : 1 }}>
                    {isSaving ? "Menyimpan..." : "Update Password"}
                </button>
            </div>
        );

        /* Avatar color picker */
        if (profileView === "color") return (
            <div style={{ padding: "4px 4px 0" }}>
                <button onClick={() => setProfileView("menu")} style={{ ...menuBtn(), marginBottom: 8, color: "var(--color-subtle)", fontSize: 11 }}>← Kembali</button>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-subtle)", marginBottom: 10 }}>WARNA AVATAR</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {AVATAR_COLORS.map(c => (
                        <button key={c} onClick={() => handleAvatarColor(c)}
                            style={{ width: 32, height: 32, borderRadius: "50%", border: avatarColor === c ? "3px solid var(--color-text)" : "2px solid transparent", background: c, cursor: "pointer", flexShrink: 0, transition: "border .15s" }} />
                    ))}
                </div>
            </div>
        );

        /* Kelola Menu */
        if (profileView === "menus") return (
            <div style={{ padding: "4px 4px 0" }}>
                <button onClick={() => setProfileView("menu")} style={{ ...menuBtn(), marginBottom: 8, color: "var(--color-subtle)", fontSize: 11 }}>← Kembali</button>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-subtle)", marginBottom: 10 }}>TAMPILKAN / SEMBUNYIKAN MENU</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
                    {allSidebarItems.flatMap(g => g.items).filter(item => item.id !== "dasbor").map(item => {
                        const isHidden = hiddenMenus.includes(item.id);
                        return (
                            <button key={item.id} onClick={() => toggleHideMenu(item.id)}
                                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .15s" }}
                                onMouseOver={e => e.currentTarget.style.background = "var(--color-border-soft)"}
                                onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{item.icon}</span>
                                <span style={{ flex: 1, fontSize: 12, color: isHidden ? "var(--color-subtle)" : "var(--color-text)", textDecoration: isHidden ? "line-through" : "none" }}>{item.label}</span>
                                {/* Toggle pill */}
                                <div style={{ width: 32, height: 17, borderRadius: 9, background: isHidden ? "var(--color-border-soft)" : "var(--color-primary)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                                    <div style={{ position: "absolute", top: 2, left: isHidden ? 2 : 15, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                                </div>
                            </button>
                        );
                    })}
                </div>
                {hiddenMenus.length > 0 && (
                    <button onClick={() => { setHiddenMenus([]); localStorage.removeItem("karaya_hidden_menus"); }}
                        style={{ marginTop: 10, width: "100%", padding: "7px 0", borderRadius: 8, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-subtle)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        Reset — Tampilkan Semua
                    </button>
                )}
            </div>
        );

        /* Delete confirm */
        if (profileView === "delete") return (
            <div style={{ padding: "4px 4px 0" }}>
                <button onClick={() => setProfileView("menu")} style={{ ...menuBtn(), marginBottom: 8, color: "var(--color-subtle)", fontSize: 11 }}>← Kembali</button>
                <div style={{ fontSize: 13, color: "#ff716c", fontWeight: 700, marginBottom: 8 }}>⚠️ Hapus Akun</div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 14, lineHeight: 1.6 }}>
                    Semua data kamu (transaksi, akun, anggaran) akan <strong>dihapus permanen</strong>. Tindakan ini tidak bisa dibatalkan.
                </div>
                <button onClick={async () => { closeProfile(); await onDeleteAccount(); }}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Ya, Hapus Akun Saya
                </button>
            </div>
        );

        /* Main menu */
        return (
            <>
                {/* User header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 4px 12px", borderBottom: "1px solid var(--color-border-soft)", marginBottom: 6 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontWeight: 800, flexShrink: 0 }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                        <div style={{ fontSize: 10, color: planColor, fontWeight: 600 }}>{planText}</div>
                    </div>
                </div>

                {/* Menu items */}
                {[
                    { icon: "✏️", label: "Ganti Nama",       action: () => { setNewName(user.name); setProfileView("name"); } },
                    { icon: "🔑", label: "Ganti Password",   action: () => setProfileView("password") },
                    { icon: "🎨", label: "Warna Avatar",     action: () => setProfileView("color") },
                    { icon: "📤", label: "Export Data CSV",  action: () => { onExportCSV(); closeProfile(); } },
                    { icon: "☰",  label: "Kelola Menu",      action: () => setProfileView("menus") },
                ].map(item => (
                    <button key={item.label} onClick={item.action} style={menuBtn()}
                        onMouseOver={e => e.currentTarget.style.background = "var(--color-border-soft)"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                ))}

                {/* Danger zone */}
                <div style={{ borderTop: "1px solid var(--color-border-soft)", marginTop: 6, paddingTop: 6 }}>
                    <button onClick={() => setProfileView("delete")} style={menuBtn(true)}
                        onMouseOver={e => e.currentTarget.style.background = "rgba(255,113,108,.06)"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>🗑️</span>
                        <span>Hapus Akun</span>
                    </button>
                    <button onClick={() => { closeProfile(); onLogout(); }} style={menuBtn(true)}
                        onMouseOver={e => e.currentTarget.style.background = "rgba(255,113,108,.06)"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>🚪</span>
                        <span>Keluar</span>
                    </button>
                </div>
            </>
        );
    };

    return (
        <aside style={{
            width: open ? 240 : 0,
            background: "var(--bg-deep)",
            borderRight: "1px solid var(--color-border)",
            height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 50,
            transition: "width 0.3s", overflow: "hidden",
            display: "flex", flexDirection: "column",
        }}>
            {/* Logo */}
            <div style={{ padding: "24px 24px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "var(--color-on-primary)" }}>K</div>
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: 0, lineHeight: 1 }}>Karaya</h1>
                    <p style={{ fontSize: 9, color: "var(--color-primary)", letterSpacing: 3, textTransform: "uppercase", margin: "3px 0 0" }}>Wealth Ledger</p>
                </div>
            </div>

            {/* + Transaksi Button */}
            <div style={{ padding: "0 16px 20px" }}>
                <button onClick={onAddTx}
                    style={{ width: "100%", padding: "12px 0", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 13, borderRadius: 12, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit", transition: "opacity .2s" }}
                    onMouseOver={e => e.currentTarget.style.opacity = ".85"}
                    onMouseOut={e => e.currentTarget.style.opacity = "1"}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                    <span>{t("nav.transaction")}</span>
                </button>
            </div>

            {/* Nav items */}
            <nav style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
                {sidebarItems.map(g => (
                    <div key={g.group} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-subtle)", letterSpacing: 1.5, padding: "0 12px", marginBottom: 4 }}>{g.group.toUpperCase()}</div>
                        {g.items.map(item => {
                            const isActive = activeMenu === item.id;
                            return (
                                <button key={item.id} onClick={() => setActiveMenu(item.id)}
                                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 0, border: "none", borderRight: isActive ? `2px solid var(--color-primary)` : "2px solid transparent", background: isActive ? "var(--nav-active-bg)" : "transparent", color: isActive ? "var(--color-primary)" : "var(--color-muted)", fontSize: 13, fontWeight: isActive ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", textAlign: "left" }}>
                                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Language picker */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid var(--color-border-soft)", position: "relative" }}>
                <button onClick={() => setShowLangPicker(v => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", color: "var(--color-muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 15 }}>🌐</span>
                    <span style={{ flex: 1, textAlign: "left" }}>{currentLang?.flag} {currentLang?.label}</span>
                    <span style={{ fontSize: 9, opacity: .6 }}>{showLangPicker ? "▲" : "▼"}</span>
                </button>

                {showLangPicker && (
                    <div style={{ position: "absolute", bottom: "100%", left: 12, right: 12, background: "var(--bg-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 6, zIndex: 100, boxShadow: "0 -8px 24px rgba(0,0,0,.3)" }}>
                        {languages.map(l => (
                            <button key={l.code} onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: lang === l.code ? "var(--nav-active-bg)" : "transparent", color: lang === l.code ? "var(--color-primary)" : "var(--color-muted)", fontSize: 12, fontWeight: lang === l.code ? 600 : 400, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                <span style={{ fontSize: 14 }}>{l.flag}</span>
                                <span>{l.label}</span>
                                {lang === l.code && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-primary)" }}>✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── User profile bar ── */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--color-border-soft)", position: "relative" }}>

                {/* Profile popup */}
                {showProfileMenu && (
                    <>
                        {/* Backdrop */}
                        <div onClick={closeProfile} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
                        <div style={{
                            position: "absolute", bottom: "calc(100% + 8px)", left: 12, right: 12,
                            background: "var(--bg-surface)", border: "1px solid var(--color-border)",
                            borderRadius: 14, padding: 10, zIndex: 99,
                            boxShadow: "0 -12px 32px rgba(0,0,0,.35)",
                        }}>
                            {renderProfilePanel()}
                        </div>
                    </>
                )}

                {/* Profile row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Avatar — click to open profile menu */}
                    <button onClick={() => { setShowProfileMenu(v => !v); setProfileView("menu"); }}
                        title="Pengaturan Profil"
                        style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor, border: showProfileMenu ? "2px solid var(--color-text)" : "2px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0, cursor: "pointer", transition: "border .15s", padding: 0 }}>
                        {user.name.charAt(0).toUpperCase()}
                    </button>

                    {/* Name + plan — click to open profile menu */}
                    <button onClick={() => { setShowProfileMenu(v => !v); setProfileView("menu"); }}
                        style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                        <div style={{ fontSize: 10, color: planColor, fontWeight: 600 }}>{planText}</div>
                    </button>

                    {/* Dark/Light toggle */}
                    <button onClick={toggleTheme} title={isDark ? "Mode Terang" : "Mode Gelap"}
                        style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: "none", background: isDark ? "rgba(96,252,198,.2)" : "rgba(0,184,122,.15)", cursor: "pointer", position: "relative", transition: "background .3s", padding: 0 }}>
                        <div style={{ position: "absolute", top: 3, left: isDark ? 3 : 17, width: 14, height: 14, borderRadius: "50%", background: "var(--color-primary)", transition: "left .3s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>
                            {isDark ? "🌙" : "☀️"}
                        </div>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
