import { useState, useEffect } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useTheme } from "../../i18n/ThemeContext";
import { useIsMobile } from "../../hooks/useIsMobile";

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
    const isMobile = useIsMobile();

    const [showLangPicker,  setShowLangPicker]  = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [profileView,     setProfileView]     = useState("menu");
    const [hiddenMenus,     setHiddenMenus]     = useState(
        () => JSON.parse(localStorage.getItem("karaya_hidden_menus") || "[]")
    );
    const [newName,     setNewName]     = useState(user.name);
    const [newPass,     setNewPass]     = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [passError,   setPassError]   = useState("");
    const [isSaving,    setIsSaving]    = useState(false);
    const [avatarColor, setAvatarColor] = useState(
        () => localStorage.getItem("karaya_avatar_color") || "var(--color-primary)"
    );
    const [appName,    setAppName]    = useState(
        () => localStorage.getItem("karaya_app_name")    || "Karaya"
    );
    const [appTagline, setAppTagline] = useState(
        () => localStorage.getItem("karaya_app_tagline") || "Wealth Ledger"
    );
    const [editAppName,    setEditAppName]    = useState("");
    const [editAppTagline, setEditAppTagline] = useState("");

    const isDark = themeId === "dark";

    /* sync browser tab title with custom app name on mount */
    useEffect(() => {
        if (appName !== "Karaya") document.title = `${appName} — Duit Lu, Kendali Lu`;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleAvatarColor = (c) => {
        setAvatarColor(c);
        localStorage.setItem("karaya_avatar_color", c);
    };

    const handleSaveAppName = () => {
        const name    = editAppName.trim()    || "Karaya";
        const tagline = editAppTagline.trim() || "Wealth Ledger";
        setAppName(name);
        setAppTagline(tagline);
        localStorage.setItem("karaya_app_name",    name);
        localStorage.setItem("karaya_app_tagline", tagline);
        document.title = `${name} — Duit Lu, Kendali Lu`;
        setProfileView("menu");
    };

    const closeProfile = () => { setShowProfileMenu(false); setProfileView("menu"); };

    const toggleHideMenu = (id) => {
        setHiddenMenus(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            localStorage.setItem("karaya_hidden_menus", JSON.stringify(next));
            return next;
        });
    };

    /* ── nav config ── */
    const allSidebarItems = [
        { group: t("nav.summary"), items: [
            { id: "dasbor",    label: t("nav.dashboard"),    icon: "📊" },
        ]},
        { group: t("nav.transactions"), items: [
            { id: "transaksi", label: t("nav.transaction"),  icon: "💳" },
            { id: "akun",      label: t("nav.accounts"),     icon: "🏦" },
            { id: "kategori",  label: t("nav.categories"),   icon: "🏷️" },
            { id: "berulang",  label: t("nav.recurring"),    icon: "🔄" },
            { id: "splitbill", label: t("nav.splitbill"),    icon: "🧾" },
        ]},
        { group: t("nav.planning"), items: [
            { id: "goals",     label: t("nav.goals"),        icon: "🎯" },
            { id: "hutang",    label: t("nav.debts"),        icon: "📋" },
            { id: "investasi", label: t("nav.investments"),  icon: "📈" },
            { id: "anggaran",  label: t("nav.budgets"),      icon: "💰" },
        ]},
        { group: t("nav.insight"), items: [
            { id: "laporan",   label: t("nav.reports"),      icon: "📉" },
            { id: "ai",        label: t("nav.ai"),           icon: "🤖" },
            { id: "prediksi",  label: t("nav.prediksi"),     icon: "🔮" },
        ]},
    ];

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

    /* ── shared styles ── */
    const inputSt = {
        width: "100%", boxSizing: "border-box",
        padding: isMobile ? "13px 14px" : "10px 12px",
        borderRadius: 10, border: "1px solid var(--color-border)",
        background: "var(--bg-surface-low)",
        color: "var(--color-text)", fontSize: 14, fontFamily: "inherit", outline: "none",
    };

    const rowBtn = (danger = false) => ({
        display: "flex", alignItems: "center", gap: 14,
        width: "100%", padding: isMobile ? "14px 16px" : "10px 12px",
        borderRadius: 10, border: "none", background: "transparent",
        color: danger ? "#ff716c" : "var(--color-text)",
        fontSize: isMobile ? 15 : 13,
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        transition: "background .15s",
    });

    const backBtn = {
        display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", cursor: "pointer",
        color: "var(--color-muted)", fontSize: 13,
        fontFamily: "inherit", padding: "0 0 12px 0",
        fontWeight: 600,
    };

    const sectionLabel = {
        fontSize: 11, fontWeight: 700,
        color: "var(--color-subtle)", letterSpacing: 0.8,
        marginBottom: 10,
    };

    const primaryBtn = (disabled = false) => ({
        width: "100%", padding: isMobile ? "14px 0" : "10px 0",
        borderRadius: 10, border: "none",
        background: disabled ? "var(--color-border-soft)" : "var(--color-primary)",
        color: disabled ? "var(--color-subtle)" : "var(--color-on-primary)",
        fontSize: isMobile ? 15 : 13, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? .6 : 1,
    });

    /* ── profile panel content ── */
    const renderPanel = () => {
        /* ── Ganti Nama ── */
        if (profileView === "name") return (
            <div>
                <button style={backBtn} onClick={() => setProfileView("menu")}>← Kembali</button>
                <div style={sectionLabel}>NAMA TAMPILAN</div>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                    style={{ ...inputSt, marginBottom: 12 }}
                    placeholder="Nama kamu"
                    onKeyDown={e => e.key === "Enter" && handleUpdateName()} />
                <button style={primaryBtn(!newName.trim() || isSaving)} onClick={handleUpdateName}>
                    {isSaving ? "Menyimpan..." : "Simpan Nama"}
                </button>
            </div>
        );

        /* ── Ganti Password ── */
        if (profileView === "password") return (
            <div>
                <button style={backBtn} onClick={() => { setProfileView("menu"); setPassError(""); setNewPass(""); setConfirmPass(""); }}>← Kembali</button>
                <div style={sectionLabel}>GANTI PASSWORD</div>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                    style={{ ...inputSt, marginBottom: 10 }} placeholder="Password baru (min. 6 karakter)" />
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                    style={{ ...inputSt, marginBottom: passError ? 8 : 12 }} placeholder="Konfirmasi password"
                    onKeyDown={e => e.key === "Enter" && handleUpdatePass()} />
                {passError && <div style={{ fontSize: 12, color: "#ff716c", marginBottom: 10 }}>⚠️ {passError}</div>}
                <button style={primaryBtn(!newPass || !confirmPass || isSaving)} onClick={handleUpdatePass}>
                    {isSaving ? "Menyimpan..." : "Update Password"}
                </button>
            </div>
        );

        /* ── Warna Avatar ── */
        if (profileView === "color") return (
            <div>
                <button style={backBtn} onClick={() => setProfileView("menu")}>← Kembali</button>
                <div style={sectionLabel}>WARNA AVATAR</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {AVATAR_COLORS.map(c => (
                        <button key={c} onClick={() => handleAvatarColor(c)}
                            style={{ aspectRatio: "1", borderRadius: "50%", border: avatarColor === c ? "3px solid var(--color-text)" : "3px solid transparent", background: c, cursor: "pointer", transition: "border .15s" }} />
                    ))}
                </div>
                {/* Preview */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", background: "var(--bg-surface-low)", borderRadius: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 800 }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{user.name}</div>
                        <div style={{ fontSize: 11, color: planColor }}>{planText}</div>
                    </div>
                </div>
            </div>
        );

        /* ── Kelola Menu ── */
        if (profileView === "menus") return (
            <div>
                <button style={backBtn} onClick={() => setProfileView("menu")}>← Kembali</button>
                <div style={sectionLabel}>TAMPILKAN / SEMBUNYIKAN MENU</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {allSidebarItems.flatMap(g => g.items).filter(item => item.id !== "dasbor").map(item => {
                        const hidden = hiddenMenus.includes(item.id);
                        return (
                            <button key={item.id} onClick={() => toggleHideMenu(item.id)}
                                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: isMobile ? "13px 10px" : "9px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                                onMouseOver={e => e.currentTarget.style.background = "var(--color-border-soft)"}
                                onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{item.icon}</span>
                                <span style={{ flex: 1, fontSize: isMobile ? 15 : 13, color: hidden ? "var(--color-subtle)" : "var(--color-text)", textDecoration: hidden ? "line-through" : "none" }}>
                                    {item.label}
                                </span>
                                {/* Toggle switch */}
                                <div style={{ width: 40, height: 22, borderRadius: 11, background: hidden ? "var(--color-border)" : "var(--color-primary)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                                    <div style={{ position: "absolute", top: 3, left: hidden ? 3 : 19, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                                </div>
                            </button>
                        );
                    })}
                </div>
                {hiddenMenus.length > 0 && (
                    <button onClick={() => { setHiddenMenus([]); localStorage.removeItem("karaya_hidden_menus"); }}
                        style={{ marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                        ↺ Reset — Tampilkan Semua
                    </button>
                )}
            </div>
        );

        /* ── Hapus Akun ── */
        if (profileView === "delete") return (
            <div>
                <button style={backBtn} onClick={() => setProfileView("menu")}>← Kembali</button>
                <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>🗑️</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ff716c", marginBottom: 8 }}>Hapus Akun</div>
                    <div style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.7 }}>
                        Semua data kamu (transaksi, akun, anggaran, hutang) akan
                        <strong style={{ color: "var(--color-text)" }}> dihapus permanen</strong>.
                        Tindakan ini <strong>tidak bisa dibatalkan</strong>.
                    </div>
                </div>
                <button onClick={async () => { closeProfile(); await onDeleteAccount(); }}
                    style={{ width: "100%", padding: isMobile ? "15px 0" : "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "#fff", fontSize: isMobile ? 15 : 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Ya, Hapus Akun Saya
                </button>
            </div>
        );

        /* ── Nama Aplikasi ── */
        if (profileView === "appname") return (
            <div>
                <button style={backBtn} onClick={() => setProfileView("menu")}>← Kembali</button>
                <div style={sectionLabel}>NAMA APLIKASI</div>
                <input
                    value={editAppName}
                    onChange={e => setEditAppName(e.target.value)}
                    style={{ ...inputSt, marginBottom: 10 }}
                    placeholder={`Nama aplikasi (default: Karaya)`}
                    maxLength={24}
                />
                <div style={sectionLabel}>TAGLINE / SUBTITLE</div>
                <input
                    value={editAppTagline}
                    onChange={e => setEditAppTagline(e.target.value)}
                    style={{ ...inputSt, marginBottom: 16 }}
                    placeholder={`Tagline (default: Wealth Ledger)`}
                    maxLength={32}
                    onKeyDown={e => e.key === "Enter" && handleSaveAppName()}
                />
                {/* Preview */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-surface-low)", borderRadius: 10, marginBottom: 14 }}>
                    <img src="/favicon.svg" alt="icon" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", lineHeight: 1 }}>
                            {editAppName.trim() || appName}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--color-primary)", letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>
                            {editAppTagline.trim() || appTagline}
                        </div>
                    </div>
                </div>
                <button style={primaryBtn(false)} onClick={handleSaveAppName}>
                    Simpan
                </button>
                {(appName !== "Karaya" || appTagline !== "Wealth Ledger") && (
                    <button onClick={() => {
                        setAppName("Karaya"); setAppTagline("Wealth Ledger");
                        localStorage.removeItem("karaya_app_name");
                        localStorage.removeItem("karaya_app_tagline");
                        document.title = "Karaya — Duit Lu, Kendali Lu";
                        setProfileView("menu");
                    }} style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                        ↺ Reset ke Default
                    </button>
                )}
            </div>
        );

        /* ── Main Menu ── */
        const menuItems = [
            { icon: "✏️", label: "Ganti Nama",      sub: user.name,        action: () => { setNewName(user.name); setProfileView("name"); } },
            { icon: "🔑", label: "Ganti Password",  sub: "••••••••",       action: () => setProfileView("password") },
            { icon: "🎨", label: "Warna Avatar",    sub: "Personalisasi",  action: () => setProfileView("color") },
            { icon: "📱", label: "Nama Aplikasi",   sub: appName,          action: () => { setEditAppName(appName); setEditAppTagline(appTagline); setProfileView("appname"); } },
            { icon: "📤", label: "Export Data CSV", sub: "Unduh transaksi",action: () => { onExportCSV(); closeProfile(); } },
            { icon: "☰",  label: "Kelola Menu",     sub: `${hiddenMenus.length} tersembunyi`, action: () => setProfileView("menus") },
        ];

        return (
            <div>
                {/* User header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: isMobile ? "0 0 16px" : "0 0 12px", borderBottom: "1px solid var(--color-border-soft)", marginBottom: 8 }}>
                    <div style={{ width: isMobile ? 48 : 40, height: isMobile ? 48 : 40, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 20 : 17, color: "#fff", fontWeight: 800, flexShrink: 0 }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: isMobile ? 16 : 14, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                        <div style={{ fontSize: isMobile ? 12 : 11, color: planColor, fontWeight: 600 }}>{planText}</div>
                    </div>
                </div>

                {/* Menu items */}
                {menuItems.map(item => (
                    <button key={item.label} onClick={item.action} style={rowBtn()}
                        onMouseOver={e => e.currentTarget.style.background = "var(--color-border-soft)"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: isMobile ? 20 : 17, width: isMobile ? 28 : 22, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: isMobile ? 15 : 13, fontWeight: 600, color: "var(--color-text)" }}>{item.label}</div>
                            <div style={{ fontSize: isMobile ? 12 : 11, color: "var(--color-subtle)", marginTop: 1 }}>{item.sub}</div>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--color-subtle)" }}>›</span>
                    </button>
                ))}

                {/* Danger zone */}
                <div style={{ borderTop: "1px solid var(--color-border-soft)", marginTop: 8, paddingTop: 8 }}>
                    {[
                        { icon: "🗑️", label: "Hapus Akun", action: () => setProfileView("delete") },
                        { icon: "🚪", label: "Keluar",     action: () => { closeProfile(); onLogout(); } },
                    ].map(item => (
                        <button key={item.label} onClick={item.action} style={rowBtn(true)}
                            onMouseOver={e => e.currentTarget.style.background = "rgba(255,113,108,.06)"}
                            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                            <span style={{ fontSize: isMobile ? 20 : 17, width: isMobile ? 28 : 22, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                            <span style={{ fontSize: isMobile ? 15 : 13, fontWeight: 600 }}>{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <>
        {/* ── Profile modal — Bottom sheet (mobile) / Popup (desktop) ── */}
        {showProfileMenu && (
            <>
                {/* Backdrop */}
                <div onClick={closeProfile} style={{ position: "fixed", inset: 0, zIndex: 200, background: isMobile ? "rgba(0,0,0,.5)" : "transparent", backdropFilter: isMobile ? "blur(4px)" : "none" }} />

                {isMobile ? (
                    /* ── MOBILE: Bottom sheet ── */
                    <div style={{
                        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
                        background: "var(--bg-surface)",
                        borderRadius: "20px 20px 0 0",
                        border: "1px solid var(--color-border)",
                        borderBottom: "none",
                        padding: "0 0 env(safe-area-inset-bottom)",
                        boxShadow: "0 -16px 48px rgba(0,0,0,.4)",
                        animation: "slideUp .25s ease",
                        maxHeight: "90vh",
                        overflowY: "auto",
                    }}>
                        {/* Handle bar */}
                        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
                            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-border)" }} />
                        </div>
                        <div style={{ padding: "12px 20px 24px" }}>
                            {renderPanel()}
                        </div>
                    </div>
                ) : (
                    /* ── DESKTOP: Popup above profile bar ── */
                    <div style={{
                        position: "fixed",
                        bottom: 70, left: 12,
                        width: 260,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 16,
                        padding: "14px 12px",
                        zIndex: 201,
                        boxShadow: "0 -8px 32px rgba(0,0,0,.35)",
                        maxHeight: "80vh",
                        overflowY: "auto",
                    }}>
                        {renderPanel()}
                    </div>
                )}
            </>
        )}

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
                <img src="/favicon.svg" alt={appName} style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: 0, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{appName}</h1>
                    <p style={{ fontSize: 9, color: "var(--color-primary)", letterSpacing: 3, textTransform: "uppercase", margin: "3px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{appTagline}</p>
                </div>
            </div>

            {/* + Transaksi */}
            <div style={{ padding: "0 16px 20px" }}>
                <button onClick={onAddTx}
                    style={{ width: "100%", padding: "12px 0", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 13, borderRadius: 12, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit", transition: "opacity .2s" }}
                    onMouseOver={e => e.currentTarget.style.opacity = ".85"}
                    onMouseOut={e => e.currentTarget.style.opacity = "1"}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                    <span>{t("nav.transaction")}</span>
                </button>
            </div>

            {/* Nav */}
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

            {/* ── Profile bar ── */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--color-border-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Avatar */}
                    <button onClick={() => { setShowProfileMenu(v => !v); setProfileView("menu"); }}
                        title="Pengaturan Profil"
                        style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor, border: showProfileMenu ? "2px solid var(--color-text)" : "2px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0, cursor: "pointer", transition: "border .15s", padding: 0 }}>
                        {user.name.charAt(0).toUpperCase()}
                    </button>

                    {/* Name */}
                    <button onClick={() => { setShowProfileMenu(v => !v); setProfileView("menu"); }}
                        style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                        <div style={{ fontSize: 10, color: planColor, fontWeight: 600 }}>{planText}</div>
                    </button>

                    {/* Theme toggle */}
                    <button onClick={toggleTheme} title={isDark ? "Mode Terang" : "Mode Gelap"}
                        style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: "none", background: isDark ? "rgba(96,252,198,.2)" : "rgba(0,184,122,.15)", cursor: "pointer", position: "relative", transition: "background .3s", padding: 0 }}>
                        <div style={{ position: "absolute", top: 3, left: isDark ? 3 : 17, width: 14, height: 14, borderRadius: "50%", background: "var(--color-primary)", transition: "left .3s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>
                            {isDark ? "🌙" : "☀️"}
                        </div>
                    </button>
                </div>
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
