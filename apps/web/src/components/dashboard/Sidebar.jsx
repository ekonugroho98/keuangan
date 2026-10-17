import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useTheme } from "../../i18n/ThemeContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { AI_PROVIDERS, PROVIDER_ORDER, DEFAULT_MODEL } from "../../services/aiService";
import { APP_NAME, APP_TAGLINE } from "../../config/app";
import { PASSWORD_MIN_LENGTH } from "../../constants/validation";
import HouseholdPanel from "../household/HouseholdPanel";
import ApiKeysPanel from "../household/ApiKeysPanel";
import { useHouseholdInfo } from "../../hooks/useHouseholdInfo";

const AVATAR_COLORS = [
    "#3F5142","#839B7A","#7D513B","#B06443",
    "#D49D3F","#4A6F7C","#6B8E63","#965032",
];

const Sidebar = ({
    open, activeMenu, setActiveMenu, user, onAddTx,
    onToggleSidebar, onLogout,
    onUpdateName, onUpdatePassword, onExportCSV, onExportExcel, txCount = 0, onDeleteAccount,
    userSettings, onSaveSettings,
    aiConfig, onSaveAiConfig,
    aiSettingsTrigger, showToast,
}) => {
    const { t, lang, setLang, languages } = useLanguage();
    // 10-fitur-opsional-keluarga.md §2.3.1: grup "Rumah" hanya muncul kalau flag shopping_stock
    // aktif. react-query dedupe dengan panggilan yang sama di HouseholdPanel (queryKey sama), jadi
    // ini TIDAK menambah request baru di layar yang sudah membuka HouseholdPanel.
    const { household } = useHouseholdInfo();
    const features = household?.features;
    const { themeId, toggleTheme } = useTheme();
    const isMobile = useIsMobile();
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled]     = useState(false);

    useEffect(() => {
        if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
            setIsInstalled(true); return;
        }
        const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
        window.addEventListener("beforeinstallprompt", handler);
        window.addEventListener("appinstalled", () => setIsInstalled(true));
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstallFromSidebar = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
    };

    const [showLangPicker,  setShowLangPicker]  = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [profileView,     setProfileView]     = useState("menu");
    const [hiddenMenus,     setHiddenMenus]     = useState(
        () => JSON.parse(localStorage.getItem("karaya_hidden_menus") || "[]")
    );
    const [collapsedGroups, setCollapsedGroups] = useState(
        () => JSON.parse(localStorage.getItem("karaya_collapsed_groups") || "[]")
    );
    const [newName,     setNewName]     = useState(user.name);
    const [newPass,     setNewPass]     = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [passError,   setPassError]   = useState("");
    const [isSaving,    setIsSaving]    = useState(false);
    const normalizeAvatarColor = (c) => {
        if (!c) return "#46634E";
        const low = String(c).trim().toLowerCase();
        if (["#60fcc6", "#19ce9b", "#10b981", "#00d4aa", "#34d399", "#00e5a3"].includes(low)) {
            return "#46634E";
        }
        return c;
    };
    const [avatarColor, setAvatarColor] = useState(
        () => normalizeAvatarColor(localStorage.getItem("karaya_avatar_color"))
    );
    const normalizeBrandName = (v) => (!v || v === "Karaya" || v === "Eko Nugroho") ? APP_NAME : v;
    const normalizeTagline = (v) => (!v || v === "Wealth Ledger" || v === "Catatan Keuangan Pribadi") ? APP_TAGLINE : v;
    const [appName,    setAppName]    = useState(
        () => normalizeBrandName(localStorage.getItem("karaya_app_name"))
    );
    const [appTagline, setAppTagline] = useState(
        () => normalizeTagline(localStorage.getItem("karaya_app_tagline"))
    );
    const [editAppName,    setEditAppName]    = useState("");
    const [editAppTagline, setEditAppTagline] = useState("");

    // AI Config state
    const [aiProvider,  setAiProvider]  = useState(() => aiConfig?.provider || "groq");
    const [aiModel,     setAiModel]     = useState(() => aiConfig?.model    || DEFAULT_MODEL["groq"]);
    const [aiKey,       setAiKey]       = useState(() => aiConfig?.apiKey   || "");
    const [aiDisabled,  setAiDisabled]  = useState(() => aiConfig?.disabled || false);
    const [aiKeyShow,   setAiKeyShow]   = useState(false);
    const [aiSaving,    setAiSaving]    = useState(false);
    const [aiTestMsg,   setAiTestMsg]   = useState("");

    const isDark = themeId === "dark";

    /* sync state from DB when userSettings loads (overrides localStorage cache) */
    useEffect(() => {
        if (!userSettings) return;
        if (userSettings.avatar_color) {
            const normColor = normalizeAvatarColor(userSettings.avatar_color);
            setAvatarColor(normColor);
            localStorage.setItem("karaya_avatar_color", normColor);
        }
        if (userSettings.hidden_menus) setHiddenMenus(userSettings.hidden_menus);
        if (userSettings.app_name)    { const n = normalizeBrandName(userSettings.app_name); setAppName(n);    localStorage.setItem("karaya_app_name", n); }
        if (userSettings.app_tagline) { const tl = normalizeTagline(userSettings.app_tagline); setAppTagline(tl); localStorage.setItem("karaya_app_tagline", tl); }
        if (userSettings.ai_config?.provider) { setAiProvider(userSettings.ai_config.provider); setAiModel(userSettings.ai_config.model || DEFAULT_MODEL[userSettings.ai_config.provider]); }
        if (userSettings.ai_config?.apiKey)   setAiKey(userSettings.ai_config.apiKey);
        if (userSettings.ai_config?.disabled !== undefined) setAiDisabled(userSettings.ai_config.disabled);
    }, [userSettings]);

    /* sync browser tab title with custom app name on mount */
    useEffect(() => {
        document.title = `${appName} — ${appTagline}`;
    }, [appName, appTagline]);

    /* open AI settings panel when triggered externally (from AiView "⚙️ Ganti" button) */
    useEffect(() => {
        if (!aiSettingsTrigger) return;
        setShowProfileMenu(true);
        setProfileView("ai");
    }, [aiSettingsTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (newPass.length < PASSWORD_MIN_LENGTH) { setPassError(`Password minimal ${PASSWORD_MIN_LENGTH} karakter`); return; }
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
        onSaveSettings?.({ avatar_color: c });
    };

    const handleSaveAppName = () => {
        const name    = editAppName.trim()    || APP_NAME;
        const tagline = editAppTagline.trim() || APP_TAGLINE;
        setAppName(name);
        setAppTagline(tagline);
        localStorage.setItem("karaya_app_name",    name);
        localStorage.setItem("karaya_app_tagline", tagline);
        document.title = `${name} — ${tagline}`;
        onSaveSettings?.({ app_name: name, app_tagline: tagline });
        setProfileView("menu");
    };

    const closeProfile = () => { setShowProfileMenu(false); setProfileView("menu"); };

    const toggleHideMenu = (id) => {
        setHiddenMenus(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            localStorage.setItem("karaya_hidden_menus", JSON.stringify(next));
            onSaveSettings?.({ hidden_menus: next });
            return next;
        });
    };

    const toggleCollapseGroup = (groupName) => {
        setCollapsedGroups(prev => {
            const next = prev.includes(groupName)
                ? prev.filter(x => x !== groupName)
                : [...prev, groupName];
            localStorage.setItem("karaya_collapsed_groups", JSON.stringify(next));
            return next;
        });
    };

    /* ── nav config — Ringkasan (Dasbor + Laporan & Evaluasi), Keluarga & Rumah, Transaksi, Perencanaan ── */
    const allSidebarItems = [
        { key: "summary", group: t("nav.summary"), collapsible: false, items: [
            { id: "dasbor",    label: t("nav.dashboard"),    icon: "📊" },
            { id: "laporan",   label: t("nav.reports"),      icon: "📑" },
        ]},
        { key: "home", group: t("nav.home"), collapsible: true, highlight: true, items: features?.shopping_stock?.enabled ? [
            { id: "belanja",   label: t("nav.shopping"),     icon: "🛒" },
            { id: "pantry",    label: t("nav.pantry"),       icon: "🧊" },
        ] : []},
        { key: "transactions", group: t("nav.transactions"), collapsible: true, items: [
            { id: "transaksi", label: t("nav.transaction"),  icon: "💳" },
            { id: "akun",      label: t("nav.accounts"),     icon: "🏦" },
            { id: "kategori",  label: t("nav.categories"),   icon: "🏷️" },
            { id: "berulang",  label: t("nav.recurring"),    icon: "🔄" },
            { id: "splitbill", label: t("nav.splitbill"),    icon: "🧾" },
        ]},
        { key: "planning", group: t("nav.planning"), collapsible: true, items: [
            { id: "anggaran",  label: t("nav.budgets"),      icon: "💰" },
            { id: "goals",     label: t("nav.goals"),        icon: "🎯" },
            { id: "hutang",    label: t("nav.debts"),        icon: "📋" },
            { id: "piutang",   label: t("nav.piutang"),      icon: "🤝" },
            { id: "investasi", label: t("nav.investments"),  icon: "📈" },
        ]},
    ];

    const sidebarItems = allSidebarItems.map(g => ({
        ...g,
        items: g.items.filter(item => item.id === "dasbor" || !hiddenMenus.includes(item.id)),
    })).filter(g => g.items.length > 0);

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
        /* ── Household: anggota & undangan ── */
        if (profileView === "household") return (
            <HouseholdPanel onBack={() => setProfileView("menu")} showToast={showToast} />
        );

        /* ── API Key (F6-T1/T3) ── */
        if (profileView === "apikeys") return (
            <ApiKeysPanel onBack={() => setProfileView("menu")} showToast={showToast} />
        );

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
                    <button onClick={() => { setHiddenMenus([]); localStorage.removeItem("karaya_hidden_menus"); onSaveSettings?.({ hidden_menus: [] }); }}
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
                    placeholder={`Nama aplikasi (default: ${APP_NAME})`}
                    maxLength={24}
                />
                <div style={sectionLabel}>TAGLINE / SUBTITLE</div>
                <input
                    value={editAppTagline}
                    onChange={e => setEditAppTagline(e.target.value)}
                    style={{ ...inputSt, marginBottom: 16 }}
                    placeholder={`Tagline (default: ${APP_TAGLINE})`}
                    maxLength={48}
                    onKeyDown={e => e.key === "Enter" && handleSaveAppName()}
                />
                {/* Preview */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-surface-low)", borderRadius: 10, marginBottom: 14 }}>
                    <img src="/logo-icon.png" alt="icon" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, objectFit: "cover" }} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", lineHeight: 1, fontFamily: "var(--font-display)" }}>
                            {editAppName.trim() || appName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-primary)", fontFamily: "var(--font-hand)", marginTop: 3 }}>
                            {editAppTagline.trim() || appTagline}
                        </div>
                    </div>
                </div>
                <button style={primaryBtn(false)} onClick={handleSaveAppName}>
                    Simpan
                </button>
                {(appName !== APP_NAME || appTagline !== APP_TAGLINE) && (
                    <button onClick={() => {
                        setAppName(APP_NAME); setAppTagline(APP_TAGLINE);
                        localStorage.removeItem("karaya_app_name");
                        localStorage.removeItem("karaya_app_tagline");
                        document.title = `${APP_NAME} — ${APP_TAGLINE}`;
                        onSaveSettings?.({ app_name: APP_NAME, app_tagline: APP_TAGLINE });
                        setProfileView("menu");
                    }} style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                        ↺ Reset ke Default
                    </button>
                )}
            </div>
        );

        /* ── AI Settings Panel ── */
        if (profileView === "ai") {
            const currentProvider = AI_PROVIDERS[aiProvider];
            const handleSaveAi = async () => {
                if (!aiKey.trim() && !aiDisabled) { setAiTestMsg("❌ API key tidak boleh kosong"); return; }
                setAiSaving(true); setAiTestMsg("");
                const cfg = { provider: aiProvider, model: aiModel, apiKey: aiKey.trim(), disabled: aiDisabled };
                await onSaveAiConfig(cfg);
                setAiTestMsg("✅ Tersimpan!");
                setAiSaving(false);
                setTimeout(() => { setAiTestMsg(""); setProfileView("menu"); }, 1200);
            };
            const inputSt = { width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
            return (
                <div>
                    <button style={backBtn} onClick={() => { setAiTestMsg(""); setProfileView("menu"); }}>← Kembali</button>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>🤖 AI Coach Settings</div>

                    {/* Provider */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 8 }}>PROVIDER</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                        {PROVIDER_ORDER.map(id => {
                            const p = AI_PROVIDERS[id];
                            const active = aiProvider === id;
                            return (
                                <button key={id} onClick={() => { setAiProvider(id); setAiModel(DEFAULT_MODEL[id]); setAiTestMsg(""); }}
                                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border-soft)"}`, background: active ? "var(--color-primary-soft)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--color-primary)" : "var(--color-text)" }}>{p.label}</span>
                                        {p.badge && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: "var(--color-primary-soft)", color: "var(--color-primary)", border: "1px solid var(--color-border-strong)", borderRadius: 4, padding: "1px 5px" }}>{p.badge}</span>}
                                    </div>
                                    {active && <span style={{ color: "var(--color-primary)", fontSize: 14 }}>✓</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Model */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>MODEL</div>
                    <select value={aiModel} onChange={e => setAiModel(e.target.value)} style={{ ...inputSt, marginBottom: 16, cursor: "pointer" }}>
                        {currentProvider?.models.map(m => (
                            <option key={m.id} value={m.id}>{m.label} — {m.note}</option>
                        ))}
                    </select>

                    {/* API Key */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>
                        API KEY
                        <a href={currentProvider?.docsUrl} target="_blank" rel="noopener noreferrer"
                            style={{ marginLeft: 8, fontSize: 10, color: "var(--color-primary)", textDecoration: "none" }}>
                            Dapatkan key →
                        </a>
                    </div>
                    <div style={{ position: "relative", marginBottom: 6 }}>
                        <input type={aiKeyShow ? "text" : "password"} value={aiKey} onChange={e => setAiKey(e.target.value)} placeholder={currentProvider?.keyHint || "sk-..."} style={{ ...inputSt, paddingRight: 44 }} />
                        <button onClick={() => setAiKeyShow(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--color-muted)" }}>
                            {aiKeyShow ? "🙈" : "👁️"}
                        </button>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 16 }}>🔒 Disimpan terenkripsi di database, hanya kamu yang bisa akses.</div>

                    {/* Toggle nonaktifkan AI */}
                    <div onClick={() => setAiDisabled(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1px solid ${aiDisabled ? "rgba(255,113,108,.25)" : "var(--color-border-soft)"}`, background: aiDisabled ? "rgba(255,113,108,.06)" : "transparent", cursor: "pointer", marginBottom: 14, userSelect: "none" }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: aiDisabled ? "#ff716c" : "var(--color-text)" }}>
                                {aiDisabled ? "🚫 AI Dinonaktifkan" : "✅ AI Aktif"}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2 }}>
                                {aiDisabled ? "Scan struk pakai OCR saja" : "Scan struk pakai AI vision"}
                            </div>
                        </div>
                        <div style={{ width: 36, height: 20, borderRadius: 10, background: aiDisabled ? "#ff716c" : "var(--color-primary)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                            <div style={{ position: "absolute", top: 3, left: aiDisabled ? 3 : 17, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                        </div>
                    </div>

                    {aiTestMsg && (
                        <div style={{ fontSize: 12, color: aiTestMsg.startsWith("✅") ? "var(--color-primary)" : "#ff716c", marginBottom: 10, fontWeight: 600 }}>{aiTestMsg}</div>
                    )}

                    <button onClick={handleSaveAi} disabled={aiSaving || (!aiKey.trim() && !aiDisabled)}
                        style={{ width: "100%", padding: 11, borderRadius: 10, border: "none", background: (!aiKey.trim() || aiSaving) ? "var(--color-border-soft)" : "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))", color: (!aiKey.trim() || aiSaving) ? "var(--color-muted)" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: (!aiKey.trim() || aiSaving) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!aiKey.trim() || aiSaving) ? 0.5 : 1 }}>
                        {aiSaving ? "Menyimpan..." : "Simpan"}
                    </button>
                    {aiKey.trim() && (
                        <button onClick={() => { setAiKey(""); onSaveAiConfig({ provider: aiProvider, model: aiModel, apiKey: "" }); setAiTestMsg(""); setProfileView("menu"); }}
                            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid rgba(255,113,108,.2)", background: "rgba(255,113,108,.06)", color: "#ff716c", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                            Hapus API Key
                        </button>
                    )}
                </div>
            );
        }

        /* ── Export Data (Excel & CSV) ── */
        if (profileView === "export") {
            return (
                <div>
                    <button style={backBtn} onClick={() => setProfileView("menu")}>← Kembali</button>
                    <div style={sectionLabel}>EXPORT DATA KEUANGAN</div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 14, lineHeight: 1.5 }}>
                        Unduh seluruh riwayat transaksi ({txCount} transaksi) ke format spreadsheet pilihanmu.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <button
                            onClick={() => { if (onExportExcel) onExportExcel(); closeProfile(); }}
                            disabled={txCount === 0}
                            style={{
                                display: "flex", alignItems: "center", gap: 12,
                                width: "100%", padding: "14px 16px", borderRadius: 12,
                                border: "1px solid var(--color-border-strong)",
                                background: "var(--color-primary-soft)",
                                color: "var(--color-text)", cursor: txCount === 0 ? "not-allowed" : "pointer",
                                fontFamily: "inherit", textAlign: "left", opacity: txCount === 0 ? 0.5 : 1,
                            }}>
                            <span style={{ fontSize: 22 }}>📊</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-primary)" }}>
                                    Unduh Excel (.xlsx)
                                </div>
                                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                                    2 Sheet: Ringkasan Kategori, Saldo Rekening & Daftar Transaksi
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => { if (onExportCSV) onExportCSV(); closeProfile(); }}
                            disabled={txCount === 0}
                            style={{
                                display: "flex", alignItems: "center", gap: 12,
                                width: "100%", padding: "14px 16px", borderRadius: 12,
                                border: "1px solid var(--glass-border)",
                                background: "rgba(255,255,255,.03)",
                                color: "var(--color-text)", cursor: txCount === 0 ? "not-allowed" : "pointer",
                                fontFamily: "inherit", textAlign: "left", opacity: txCount === 0 ? 0.5 : 1,
                            }}>
                            <span style={{ fontSize: 22 }}>📄</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 800 }}>
                                    Unduh CSV (.csv)
                                </div>
                                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                                    Format tabel standar (Google Sheets, Numbers, Excel)
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            );
        }

        /* ── Main Menu — premium bento tiles ── */
        const aiStatus = aiConfig?.apiKey ? `${AI_PROVIDERS[aiConfig.provider]?.label || ""} · Aktif` : "Belum diatur";
        const aiActive = !!aiConfig?.apiKey;

        /* Each tile: SVG icon + gradient tile background per category */
        const tiles = [
            {
                id: "household",
                label: "Household",
                sub: "Anggota & undangan",
                grad: "linear-gradient(135deg, #46634E, #364E3D)",
                tint: "rgba(70,99,78,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" /></svg>),
                action: () => setProfileView("household"),
            },
            {
                id: "apikeys",
                label: "API Key",
                sub: "Agent & Hermes",
                grad: "linear-gradient(135deg, #D49D3F, #B58129)",
                tint: "rgba(212,157,63,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.5 12.5 19 4M17 6l2 2M14 9l2 2"/></svg>),
                action: () => setProfileView("apikeys"),
            },
            {
                id: "name",
                label: "Ganti Nama",
                sub: user.name,
                grad: "linear-gradient(135deg, #839B7A, #5F7A56)",
                tint: "rgba(131,155,122,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>),
                action: () => { setNewName(user.name); setProfileView("name"); },
            },
            {
                id: "password",
                label: "Password",
                sub: "••••••••",
                grad: "linear-gradient(135deg, #7D513B, #5E3B29)",
                tint: "rgba(125,81,59,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
                action: () => setProfileView("password"),
            },
            {
                id: "color",
                label: "Warna Avatar",
                sub: "Personalisasi",
                grad: "linear-gradient(135deg, #B06443, #965032)",
                tint: "rgba(176,100,67,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="10" cy="19" r="2.5"/><path d="M12 2a10 10 0 1 0 0 20"/></svg>),
                action: () => setProfileView("color"),
            },
            {
                id: "appname",
                label: "Nama App",
                sub: appName,
                grad: "linear-gradient(135deg, #73638A, #594B6D)",
                tint: "rgba(115,99,138,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 18h.01"/></svg>),
                action: () => { setEditAppName(appName); setEditAppTagline(appTagline); setProfileView("appname"); },
            },
            {
                id: "export",
                label: "Export Data",
                sub: "Excel (.xlsx) & CSV",
                grad: "linear-gradient(135deg, #46634E, #2D3B30)",
                tint: "rgba(70,99,78,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
                action: () => setProfileView("export"),
            },
            {
                id: "menus",
                label: "Kelola Menu",
                sub: `${hiddenMenus.length} tersembunyi`,
                grad: "linear-gradient(135deg, #C8963E, #A37628)",
                tint: "rgba(200,150,62,.14)",
                iconColor: "#FFFDF8",
                icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>),
                action: () => setProfileView("menus"),
            },
        ];

        const tileStyle = {
            position: "relative", overflow: "hidden",
            padding: "12px 12px",
            borderRadius: 14,
            background: "rgba(255,255,255,.025)",
            border: "1px solid var(--glass-border)",
            cursor: "pointer", fontFamily: "inherit",
            textAlign: "left",
            transition: "transform .2s, border-color .2s, background .2s",
            display: "flex", flexDirection: "column", gap: 8,
            minHeight: 68,
        };

        return (
            <div>
                {/* ═══ PROFILE HERO — big centered avatar + chip ═══ */}
                <div style={{
                    position: "relative", overflow: "hidden",
                    padding: "20px 16px 16px",
                    marginBottom: 14,
                    borderRadius: 16,
                    background: `linear-gradient(145deg, color-mix(in srgb, ${avatarColor} 14%, transparent), color-mix(in srgb, ${avatarColor} 2%, transparent))`,
                    border: `1px solid color-mix(in srgb, ${avatarColor} 22%, transparent)`,
                    display: "flex", alignItems: "center", gap: 14,
                }}>
                    {/* Ambient orb */}
                    <div style={{ position: "absolute", top: -40, right: -20, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, color-mix(in srgb, ${avatarColor} 28%, transparent), transparent 70%)`, pointerEvents: "none", filter: "blur(6px)" }} />
                    <div style={{
                        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                        background: `linear-gradient(135deg, ${avatarColor}, color-mix(in srgb, ${avatarColor} 60%, black))`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, color: "#fff", fontWeight: 900,
                        boxShadow: `0 8px 20px color-mix(in srgb, ${avatarColor} 40%, transparent), inset 0 1px 0 rgba(255,255,255,.35)`,
                        position: "relative", zIndex: 1,
                    }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, position: "relative", zIndex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.02em", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", letterSpacing: 1.4, textTransform: "uppercase", marginTop: 6 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, background: "var(--color-primary-soft)", border: "1px solid var(--color-border-strong)", color: "var(--color-primary)" }}>
                                <span style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor", animation: "glow-pulse 2s infinite" }} />
                                AKTIF
                            </span>
                        </div>
                    </div>
                </div>

                {/* ═══ SETTINGS TILES — 2-col grid ═══ */}
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--color-subtle)", letterSpacing: 1.8, textTransform: "uppercase", padding: "2px 4px 8px" }}>Pengaturan</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {tiles.map(tile => (
                        <button key={tile.id} onClick={tile.action} style={tileStyle}
                            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "var(--color-border-strong)"; e.currentTarget.style.background = tile.tint; }}
                            onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.background = "rgba(255,255,255,.025)"; }}>
                            {/* Icon tile */}
                            <div style={{
                                width: 32, height: 32, borderRadius: 10,
                                background: tile.grad,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: tile.iconColor,
                                boxShadow: `0 4px 12px color-mix(in srgb, ${tile.tint.replace('rgba(','rgb(').replace(',.14)',')')} 50%, transparent), inset 0 1px 0 rgba(255,255,255,.3)`,
                                flexShrink: 0, position: "relative",
                            }}>
                                {tile.icon}
                                {tile.badge && (
                                    <span style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: 99, background: "var(--color-primary)", border: "2px solid var(--glass-2, var(--bg-surface))", boxShadow: "0 0 6px var(--color-primary)" }} />
                                )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.01em", lineHeight: 1.2 }}>{tile.label}</div>
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 3, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tile.sub}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* ═══ DANGER ZONE — tinted red card ═══ */}
                <div style={{
                    padding: 8, borderRadius: 14,
                    background: "linear-gradient(145deg, rgba(255,113,108,.05), rgba(255,113,108,.01))",
                    border: "1px solid rgba(255,113,108,.15)",
                }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#ff716c", letterSpacing: 1.8, textTransform: "uppercase", padding: "4px 8px 6px", opacity: .8 }}>Zona Berbahaya</div>
                    {[
                        {
                            icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>),
                            label: "Hapus Akun",
                            sub: "Permanen, tidak bisa dibatalkan",
                            action: () => setProfileView("delete"),
                        },
                        {
                            icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
                            label: "Keluar",
                            sub: "Sign out dari sesi ini",
                            action: () => { closeProfile(); onLogout(); },
                        },
                    ].map(item => (
                        <button key={item.label} onClick={item.action}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                width: "100%", padding: "10px 10px",
                                borderRadius: 10, border: "none",
                                background: "transparent",
                                color: "#ff716c",
                                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                transition: "background .15s",
                                minHeight: 44,
                            }}
                            onMouseOver={e => e.currentTarget.style.background = "rgba(255,113,108,.1)"}
                            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                            <span style={{
                                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                                background: "rgba(255,113,108,.12)",
                                border: "1px solid rgba(255,113,108,.2)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#ff716c",
                            }}>{item.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.2 }}>{item.label}</div>
                                <div style={{ fontSize: 10, color: "rgba(255,113,108,.7)", marginTop: 2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sub}</div>
                            </div>
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
                    /* ── MOBILE: Glass bottom sheet ── */
                    <div style={{
                        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
                        background: "var(--glass-2, rgba(28,28,38,.85))",
                        backdropFilter: "var(--glass-blur)",
                        WebkitBackdropFilter: "var(--glass-blur)",
                        borderRadius: "24px 24px 0 0",
                        border: "1px solid var(--glass-border)",
                        borderBottom: "none",
                        padding: "0 0 env(safe-area-inset-bottom)",
                        boxShadow: "var(--glass-highlight), 0 -24px 64px rgba(0,0,0,.45)",
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
                    /* ── DESKTOP: Glass popup above profile bar ── */
                    <div style={{
                        position: "fixed",
                        bottom: 70, left: 12,
                        width: 320,
                        background: "var(--glass-2, rgba(28,28,38,.88))",
                        backdropFilter: "var(--glass-blur)",
                        WebkitBackdropFilter: "var(--glass-blur)",
                        border: "1px solid var(--glass-border-strong)",
                        borderRadius: 20,
                        padding: "14px 14px",
                        zIndex: 201,
                        boxShadow: "var(--glass-highlight), 0 24px 64px rgba(0,0,0,.55)",
                        maxHeight: "85vh",
                        overflowY: "auto",
                    }}>
                        {renderPanel()}
                    </div>
                )}
            </>
        )}

        <aside className="glass-sidebar" style={{
            width: open ? 256 : 0,
            height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 50,
            transition: "width 0.35s cubic-bezier(.2,.8,.2,1)", overflow: "hidden",
            display: "flex", flexDirection: "column",
            backgroundImage: "radial-gradient(500px 300px at 0% 0%, rgba(131,155,122,.12), transparent 55%), radial-gradient(400px 300px at 100% 100%, rgba(176,100,67,.07), transparent 60%)",
        }}>
            {/* ═══ Workspace brand row — Keluarga Berkembang (utuh tanpa terpotong) ═══ */}
            <div style={{
                padding: "14px 14px 12px",
                display: "flex", alignItems: "center", gap: 11,
                borderBottom: "1px solid var(--glass-border)",
            }}>
                <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: "#FFFDF8",
                    border: "1px solid rgba(125,81,59,.20)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(63,81,66,.12)",
                    overflow: "hidden",
                }}>
                    <img src="/logo-icon.png" alt={appName} style={{ width: 38, height: 38, objectFit: "contain" }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    {appName.toLowerCase() === "keluarga berkembang" ? (
                        <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 13.5, fontWeight: 600, margin: 0, lineHeight: 1.15, letterSpacing: ".01em" }}>
                            <span style={{ color: "var(--color-soil, #7D513B)" }}>KELUARGA </span>
                            <span style={{ color: "var(--color-primary, #46634E)" }}>BERKEMBANG</span>
                        </h1>
                    ) : (
                        <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--color-text)", margin: 0, lineHeight: 1.15 }}>{appName}</h1>
                    )}
                    <p className="font-quote" style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0", fontWeight: 500, lineHeight: 1.15 }}>
                        {appTagline}
                    </p>
                </div>
            </div>

            {/* ═══ Add Transaction — Warm Terracotta (#B06443) CTA pill ═══ */}
            <div style={{ padding: "12px 12px 6px" }}>
                <button onClick={onAddTx}
                    style={{
                        width: "100%", padding: "10px 14px",
                        background: "linear-gradient(135deg, #B06443, #965032)",
                        color: "#FAF5EA",
                        fontWeight: 600, fontSize: 13, borderRadius: 12, border: "none",
                        display: "flex", alignItems: "center", gap: 10,
                        cursor: "pointer", fontFamily: "'Fredoka', inherit",
                        letterSpacing: ".01em",
                        boxShadow: "0 4px 14px rgba(176,100,67,.26), inset 0 1px 0 rgba(255,255,255,.25)",
                        transition: "transform .2s, box-shadow .25s",
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(176,100,67,.36), inset 0 1px 0 rgba(255,255,255,.35)"; }}
                    onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 14px rgba(176,100,67,.26), inset 0 1px 0 rgba(255,255,255,.25)"; }}>
                    <span style={{
                        width: 20, height: 20, borderRadius: 7,
                        background: "rgba(255,255,255,.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, lineHeight: 1, flexShrink: 0,
                    }}>+</span>
                    <span style={{ flex: 1, textAlign: "left" }}>{t("nav.transaction")}</span>
                    <kbd style={{
                        fontSize: 9, fontFamily: "inherit", fontWeight: 700,
                        padding: "2px 6px", borderRadius: 5,
                        background: "rgba(0,0,0,.18)", color: "rgba(255,255,255,.88)",
                        letterSpacing: .5,
                    }}>⌘N</kbd>
                </button>
            </div>

            {/* ═══ Nav — collapsible groups + soft icon badges ═══ */}
            <nav style={{
                flex: 1, overflowY: "auto",
                padding: "4px 10px 12px",
            }}>
                {sidebarItems.map((g, gi) => {
                    const hasActiveChild = g.items.some(item => item.id === activeMenu);
                    const isCollapsed = g.collapsible && collapsedGroups.includes(g.key) && !hasActiveChild;
                    return (
                        <div key={g.key || g.group} style={{
                            marginBottom: 6,
                            ...(g.highlight ? {
                                background: "var(--bg-surface-low)",
                                border: "1px solid var(--color-border-soft)",
                                borderRadius: 12,
                                padding: "4px 6px 6px",
                                marginTop: 4,
                            } : {}),
                        }}>
                            {/* Group header (clickable when collapsible) */}
                            <button
                                type="button"
                                onClick={() => g.collapsible && toggleCollapseGroup(g.key)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    width: "100%",
                                    padding: g.highlight ? "6px 8px 4px" : (gi === 0 ? "6px 10px 4px" : "10px 10px 4px"),
                                    background: "transparent", border: "none",
                                    cursor: g.collapsible ? "pointer" : "default",
                                    fontFamily: "inherit", textAlign: "left",
                                }}
                            >
                                <span style={{
                                    fontSize: 9.5, fontWeight: 800,
                                    color: g.highlight ? "var(--color-primary)" : "var(--color-subtle)",
                                    letterSpacing: 1.3, textTransform: "uppercase",
                                }}>{g.group}</span>
                                <span style={{ flex: 1, height: 1, background: "linear-gradient(to right, var(--glass-border), transparent)" }} />
                                {g.collapsible && (
                                    <span style={{
                                        fontSize: 10, color: "var(--color-subtle)",
                                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                                        transition: "transform .2s ease",
                                        lineHeight: 1,
                                    }}>▾</span>
                                )}
                            </button>

                            {!isCollapsed && g.items.map(item => {
                                const isActive = activeMenu === item.id;
                                return (
                                    <button key={item.id} onClick={() => setActiveMenu(item.id)}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 10,
                                            width: "100%", padding: "7px 10px 7px 12px",
                                            borderRadius: 10, border: "none",
                                            background: isActive ? "var(--color-primary-soft)" : "transparent",
                                            color: isActive ? "var(--color-primary)" : "var(--color-text)",
                                            opacity: isActive ? 1 : 0.86,
                                            fontSize: 13, fontWeight: isActive ? 700 : 500,
                                            cursor: "pointer", fontFamily: "inherit",
                                            transition: "all .15s",
                                            textAlign: "left", position: "relative",
                                            letterSpacing: "-.01em",
                                            minHeight: 36,
                                            marginTop: 1,
                                        }}
                                        onMouseOver={e => { if (!isActive) { e.currentTarget.style.background = "var(--color-border-soft)"; e.currentTarget.style.opacity = "1"; } }}
                                        onMouseOut={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "0.86"; } }}>
                                        {/* Left accent bar */}
                                        <span style={{
                                            position: "absolute", left: 3, top: "50%",
                                            transform: `translateY(-50%) scaleY(${isActive ? 1 : 0})`,
                                            width: 3, height: 18, borderRadius: 99,
                                            background: "var(--color-primary)",
                                            transition: "transform .25s cubic-bezier(.2,.8,.2,1)",
                                            transformOrigin: "center",
                                        }} />
                                        {/* Soft icon badge — keeps dark emojis like 🛒 clearly visible in dark & light themes */}
                                        <span style={{
                                            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                            background: isActive
                                                ? "var(--color-primary-soft)"
                                                : (isDark ? "rgba(229, 236, 231, 0.08)" : "rgba(70, 99, 78, 0.07)"),
                                            border: isActive
                                                ? "1px solid var(--color-border-strong)"
                                                : "1px solid var(--color-border-soft)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 14,
                                            transition: "all .2s",
                                        }}>{item.icon}</span>
                                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            {/* ═══ Install prompt — compact, subtle ═══ */}
            {!isInstalled && installPrompt && (
                <div style={{ padding: "6px 12px 4px" }}>
                    <button onClick={handleInstallFromSidebar} style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "9px 12px", borderRadius: 10,
                        border: "1px dashed var(--color-border-strong)",
                        background: "transparent",
                        color: "var(--color-primary)",
                        fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        transition: "all .2s", textAlign: "left",
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = "var(--color-primary-soft)"; e.currentTarget.style.borderStyle = "solid"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderStyle = "dashed"; }}>
                        <span style={{
                            width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                            background: "var(--color-primary-soft)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11,
                        }}>⬇</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "-.01em" }}>Pasang {APP_NAME}</div>
                            <div style={{ fontSize: 9, color: "var(--color-subtle)", marginTop: 1, fontWeight: 500 }}>PWA · akses cepat</div>
                        </div>
                    </button>
                </div>
            )}

            {/* ═══ Unified footer — profile + theme + lang in one row ═══ */}
            <div style={{
                padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
                borderTop: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,.04)",
                position: "relative",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Profile button — the main element */}
                    <button onClick={() => { setShowProfileMenu(v => !v); setProfileView("menu"); }}
                        style={{
                            flex: 1, display: "flex", alignItems: "center", gap: 9,
                            padding: "6px 8px 6px 6px", borderRadius: 10,
                            background: showProfileMenu ? "var(--color-primary-soft)" : "transparent",
                            border: "1px solid transparent",
                            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                            transition: "background .2s, border .2s",
                            minWidth: 0,
                        }}
                        onMouseOver={e => { if (!showProfileMenu) e.currentTarget.style.background = "var(--color-border-soft)"; }}
                        onMouseOut={e => { if (!showProfileMenu) e.currentTarget.style.background = "transparent"; }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            background: `linear-gradient(135deg, ${avatarColor}, color-mix(in srgb, ${avatarColor} 65%, black))`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, color: "#fff", fontWeight: 800,
                            boxShadow: `0 2px 8px color-mix(in srgb, ${avatarColor} 35%, transparent), inset 0 1px 0 rgba(255,255,255,.3)`,
                        }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-.01em", lineHeight: 1.2 }}>{user.name}</div>
                            <div style={{ fontSize: 9, color: "var(--color-subtle)", marginTop: 2, fontWeight: 600, letterSpacing: ".3px" }}>Pengaturan</div>
                        </div>
                    </button>

                    {/* Theme toggle */}
                    <button onClick={toggleTheme} title={isDark ? "Mode Terang" : "Mode Gelap"} aria-label="Toggle theme"
                        style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                            border: "1px solid var(--glass-border)",
                            background: "transparent",
                            cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all .2s", fontSize: 13,
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = "var(--color-border-soft)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                        onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--glass-border)"; }}>
                        {isDark ? "🌙" : "☀️"}
                    </button>

                    {/* Lang button */}
                    <button onClick={() => setShowLangPicker(v => !v)} aria-label="Change language"
                        style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                            border: "1px solid var(--glass-border)",
                            background: showLangPicker ? "var(--color-primary-soft)" : "transparent",
                            cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all .2s", fontSize: 13,
                        }}
                        onMouseOver={e => { if (!showLangPicker) e.currentTarget.style.background = "var(--color-border-soft)"; }}
                        onMouseOut={e => { if (!showLangPicker) e.currentTarget.style.background = "transparent"; }}>
                        {currentLang?.flag}
                    </button>
                </div>

                {/* Lang picker popup */}
                {showLangPicker && (
                    <div style={{
                        position: "absolute", bottom: "calc(100% + 4px)", right: 10, left: 10,
                        background: "var(--glass-2, var(--bg-surface))",
                        backdropFilter: "var(--glass-blur)",
                        WebkitBackdropFilter: "var(--glass-blur)",
                        border: "1px solid var(--glass-border-strong)",
                        borderRadius: 12, padding: 6, zIndex: 100,
                        boxShadow: "var(--glass-highlight), var(--shadow-lg)",
                    }}>
                        {languages.map(l => (
                            <button key={l.code} onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: lang === l.code ? "var(--color-primary-soft)" : "transparent", color: lang === l.code ? "var(--color-primary)" : "var(--color-text)", fontSize: 12, fontWeight: lang === l.code ? 700 : 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .15s" }}
                                onMouseOver={e => { if (lang !== l.code) e.currentTarget.style.background = "var(--color-border-soft)"; }}
                                onMouseOut={e => { if (lang !== l.code) e.currentTarget.style.background = "transparent"; }}>
                                <span style={{ fontSize: 14 }}>{l.flag}</span>
                                <span style={{ flex: 1 }}>{l.label}</span>
                                {lang === l.code && <span style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 700 }}>✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
