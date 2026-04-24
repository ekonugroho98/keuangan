import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useTheme } from "../../i18n/ThemeContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { AI_PROVIDERS, PROVIDER_ORDER, DEFAULT_MODEL } from "../../services/aiService";
import { APP_NAME, APP_TAGLINE } from "../../config/app";
import { PASSWORD_MIN_LENGTH } from "../../constants/validation";

const AVATAR_COLORS = [
    "#60fcc6","#4FC3F7","#f59e0b","#ff716c",
    "#a855f7","#ec4899","#14b8a6","#f97316",
];

const Sidebar = ({
    open, activeMenu, setActiveMenu, user, onAddTx,
    onToggleSidebar, onLogout,
    onUpdateName, onUpdatePassword, onExportCSV, onDeleteAccount,
    userSettings, onSaveSettings,
    aiConfig, onSaveAiConfig,
    aiSettingsTrigger,
}) => {
    const { t, lang, setLang, languages } = useLanguage();
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
    const [newName,     setNewName]     = useState(user.name);
    const [newPass,     setNewPass]     = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [passError,   setPassError]   = useState("");
    const [isSaving,    setIsSaving]    = useState(false);
    const [avatarColor, setAvatarColor] = useState(
        () => localStorage.getItem("karaya_avatar_color") || "var(--color-primary)"
    );
    const [appName,    setAppName]    = useState(
        () => localStorage.getItem("karaya_app_name")    || APP_NAME
    );
    const [appTagline, setAppTagline] = useState(
        () => localStorage.getItem("karaya_app_tagline") || APP_TAGLINE
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
        if (userSettings.avatar_color) setAvatarColor(userSettings.avatar_color);
        if (userSettings.hidden_menus) setHiddenMenus(userSettings.hidden_menus);
        if (userSettings.app_name)    { setAppName(userSettings.app_name);    localStorage.setItem("karaya_app_name", userSettings.app_name); }
        if (userSettings.app_tagline) { setAppTagline(userSettings.app_tagline); localStorage.setItem("karaya_app_tagline", userSettings.app_tagline); }
        if (userSettings.ai_config?.provider) { setAiProvider(userSettings.ai_config.provider); setAiModel(userSettings.ai_config.model || DEFAULT_MODEL[userSettings.ai_config.provider]); }
        if (userSettings.ai_config?.apiKey)   setAiKey(userSettings.ai_config.apiKey);
        if (userSettings.ai_config?.disabled !== undefined) setAiDisabled(userSettings.ai_config.disabled);
    }, [userSettings]);

    /* sync browser tab title with custom app name on mount */
    useEffect(() => {
        if (appName !== APP_NAME) document.title = `${appName} — Duit Lu, Kendali Lu`;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        document.title = `${name} — Duit Lu, Kendali Lu`;
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
            { id: "piutang",   label: t("nav.piutang"),      icon: "🤝" },
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
                {(appName !== APP_NAME || appTagline !== APP_TAGLINE) && (
                    <button onClick={() => {
                        setAppName(APP_NAME); setAppTagline(APP_TAGLINE);
                        localStorage.removeItem("karaya_app_name");
                        localStorage.removeItem("karaya_app_tagline");
                        document.title = "Karaya — Duit Lu, Kendali Lu";
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
                                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border-soft)"}`, background: active ? "rgba(96,252,198,.1)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--color-primary)" : "var(--color-text)" }}>{p.label}</span>
                                        {p.badge && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: "rgba(96,252,198,.15)", color: "var(--color-primary)", border: "1px solid rgba(96,252,198,.3)", borderRadius: 4, padding: "1px 5px" }}>{p.badge}</span>}
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
                        style={{ width: "100%", padding: 11, borderRadius: 10, border: "none", background: (!aiKey.trim() || aiSaving) ? "var(--color-border-soft)" : "linear-gradient(135deg,#60fcc6,#19ce9b)", color: (!aiKey.trim() || aiSaving) ? "var(--color-muted)" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: (!aiKey.trim() || aiSaving) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!aiKey.trim() || aiSaving) ? 0.5 : 1 }}>
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

        /* ── Main Menu ── */
        const aiStatus = aiConfig?.apiKey ? `${AI_PROVIDERS[aiConfig.provider]?.label || ""} · Aktif` : "Belum diatur";
        const menuItems = [
            { icon: "✏️", label: "Ganti Nama",      sub: user.name,        action: () => { setNewName(user.name); setProfileView("name"); } },
            { icon: "🔑", label: "Ganti Password",  sub: "••••••••",       action: () => setProfileView("password") },
            { icon: "🎨", label: "Warna Avatar",    sub: "Personalisasi",  action: () => setProfileView("color") },
            { icon: "🤖", label: "AI Coach",        sub: aiStatus,         action: () => { setAiProvider(aiConfig?.provider || "groq"); setAiModel(aiConfig?.model || DEFAULT_MODEL[aiConfig?.provider || "groq"]); setAiKey(aiConfig?.apiKey || ""); setProfileView("ai"); } },
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
                        width: 264,
                        background: "var(--glass-2, rgba(28,28,38,.85))",
                        backdropFilter: "var(--glass-blur)",
                        WebkitBackdropFilter: "var(--glass-blur)",
                        border: "1px solid var(--glass-border-strong)",
                        borderRadius: 18,
                        padding: "14px 12px",
                        zIndex: 201,
                        boxShadow: "var(--glass-highlight), 0 16px 48px rgba(0,0,0,.5)",
                        maxHeight: "80vh",
                        overflowY: "auto",
                    }}>
                        {renderPanel()}
                    </div>
                )}
            </>
        )}

        <aside className="glass-sidebar" style={{
            width: open ? 248 : 0,
            height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 50,
            transition: "width 0.35s cubic-bezier(.2,.8,.2,1)", overflow: "hidden",
            display: "flex", flexDirection: "column",
            backgroundImage: "radial-gradient(600px 400px at -20% 0%, rgba(96,252,198,.06), transparent 60%)",
        }}>
            {/* Logo */}
            <div style={{ padding: "22px 20px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg,var(--color-primary),var(--color-primary-deep))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 6px 20px rgba(96,252,198,.3), inset 0 1px 0 rgba(255,255,255,.3)",
                    position: "relative", overflow: "hidden",
                }}>
                    <img src="/favicon.svg" alt={appName} style={{ width: 24, height: 24, filter: "brightness(0) invert(1) opacity(.95)" }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h1 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: 0, lineHeight: 1, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{appName}</h1>
                    <p style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 2.4, textTransform: "uppercase", margin: "4px 0 0", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{appTagline}</p>
                </div>
            </div>

            {/* + Transaksi */}
            <div style={{ padding: "0 14px 14px" }}>
                <button onClick={onAddTx}
                    style={{
                        width: "100%", padding: "11px 0",
                        background: "linear-gradient(135deg,var(--color-primary),var(--color-primary-deep))",
                        color: "var(--color-on-primary)",
                        fontWeight: 700, fontSize: 13, borderRadius: 12, border: "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        cursor: "pointer", fontFamily: "inherit",
                        letterSpacing: "-.01em",
                        boxShadow: "0 6px 18px rgba(96,252,198,.25), inset 0 1px 0 rgba(255,255,255,.3)",
                        transition: "transform .2s, box-shadow .25s",
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(96,252,198,.4), inset 0 1px 0 rgba(255,255,255,.4)"; }}
                    onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 6px 18px rgba(96,252,198,.25), inset 0 1px 0 rgba(255,255,255,.3)"; }}>
                    <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 800 }}>+</span>
                    <span>{t("nav.transaction")}</span>
                </button>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: "auto", padding: "4px 10px 12px" }}>
                {sidebarItems.map(g => (
                    <div key={g.group} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-subtle)", letterSpacing: 2, padding: "10px 14px 6px", textTransform: "uppercase" }}>{g.group}</div>
                        {g.items.map(item => {
                            const isActive = activeMenu === item.id;
                            return (
                                <button key={item.id} onClick={() => setActiveMenu(item.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        width: "100%", padding: "8px 10px",
                                        borderRadius: 10, border: "none",
                                        background: isActive ? "var(--color-primary-soft)" : "transparent",
                                        color: isActive ? "var(--color-primary)" : "var(--color-muted)",
                                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                                        cursor: "pointer", fontFamily: "inherit",
                                        transition: "all .2s cubic-bezier(.2,.8,.2,1)",
                                        textAlign: "left", position: "relative",
                                        letterSpacing: "-.01em",
                                    }}
                                    onMouseOver={e => { if (!isActive) { e.currentTarget.style.background = "var(--color-border-soft)"; e.currentTarget.style.color = "var(--color-text)"; } }}
                                    onMouseOut={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-muted)"; } }}>
                                    <span style={{
                                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 14,
                                        background: isActive
                                            ? "linear-gradient(135deg,rgba(96,252,198,.18),rgba(96,252,198,.08))"
                                            : "var(--bg-surface-low)",
                                        boxShadow: isActive ? "inset 0 0 0 1px rgba(96,252,198,.25)" : "inset 0 0 0 1px var(--color-border-soft)",
                                        transition: "all .2s",
                                    }}>{item.icon}</span>
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {isActive && (
                                        <span style={{
                                            width: 4, height: 4, borderRadius: 99,
                                            background: "var(--color-primary)",
                                            boxShadow: "0 0 10px var(--color-primary)",
                                            animation: "glow-pulse 2s ease-in-out infinite",
                                        }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Install App — tucked in, mint-glow */}
            {!isInstalled && installPrompt && (
                <div style={{ padding: "6px 14px 4px" }}>
                    <button onClick={handleInstallFromSidebar} style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "9px 12px", borderRadius: 10,
                        border: "1px solid rgba(96,252,198,.22)",
                        background: "linear-gradient(135deg, rgba(96,252,198,.08), rgba(96,252,198,.03))",
                        color: "var(--color-primary)",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        transition: "all .2s",
                    }}
                    onMouseOver={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,252,198,.14), rgba(96,252,198,.06))"}
                    onMouseOut={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(96,252,198,.08), rgba(96,252,198,.03))"}>
                        <span style={{ fontSize: 14 }}>⬇️</span>
                        <span>Install {APP_NAME}</span>
                    </button>
                </div>
            )}

            {/* Bottom control strip — language, theme */}
            <div style={{ padding: "8px 14px", display: "flex", gap: 6, position: "relative" }}>
                <button onClick={() => setShowLangPicker(v => !v)}
                    style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "8px 10px", borderRadius: 10,
                        border: "1px solid var(--glass-border)",
                        background: showLangPicker ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.025)",
                        backdropFilter: "var(--glass-blur-sm)",
                        WebkitBackdropFilter: "var(--glass-blur-sm)",
                        color: "var(--color-muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                        transition: "background .2s",
                    }}>
                    <span style={{ fontSize: 13 }}>{currentLang?.flag}</span>
                    <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 10 }}>{currentLang?.code}</span>
                </button>
                <button onClick={toggleTheme} title={isDark ? "Mode Terang" : "Mode Gelap"}
                    style={{
                        flexShrink: 0, width: 38, height: 34, borderRadius: 10,
                        border: "1px solid var(--glass-border)",
                        background: "rgba(255,255,255,.025)",
                        backdropFilter: "var(--glass-blur-sm)",
                        WebkitBackdropFilter: "var(--glass-blur-sm)",
                        cursor: "pointer", padding: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all .2s",
                    }}
                    onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                    onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,.025)"}>
                    <span style={{ fontSize: 13 }}>{isDark ? "🌙" : "☀️"}</span>
                </button>

                {showLangPicker && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 14, right: 14, background: "var(--bg-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 6, zIndex: 100, boxShadow: "var(--shadow-lg)", backdropFilter: "blur(12px)" }}>
                        {languages.map(l => (
                            <button key={l.code} onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: lang === l.code ? "var(--color-primary-soft)" : "transparent", color: lang === l.code ? "var(--color-primary)" : "var(--color-muted)", fontSize: 12, fontWeight: lang === l.code ? 600 : 400, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .15s" }}
                                onMouseOver={e => { if (lang !== l.code) e.currentTarget.style.background = "var(--color-border-soft)"; }}
                                onMouseOut={e => { if (lang !== l.code) e.currentTarget.style.background = "transparent"; }}>
                                <span style={{ fontSize: 14 }}>{l.flag}</span>
                                <span>{l.label}</span>
                                {lang === l.code && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-primary)" }}>✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Profile card — elevated ── */}
            <div style={{ padding: "8px 14px 14px" }}>
                <button onClick={() => { setShowProfileMenu(v => !v); setProfileView("menu"); }}
                    style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 14,
                        background: "var(--glass-2, rgba(255,255,255,.04))",
                        backdropFilter: "var(--glass-blur-sm)",
                        WebkitBackdropFilter: "var(--glass-blur-sm)",
                        border: `1px solid ${showProfileMenu ? "rgba(96,252,198,.35)" : "var(--glass-border)"}`,
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                        transition: "border .2s, transform .2s",
                        boxShadow: "var(--glass-highlight), 0 2px 8px rgba(0,0,0,.1)",
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseOut={e => { e.currentTarget.style.transform = ""; }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                        background: `linear-gradient(135deg, ${avatarColor}, color-mix(in srgb, ${avatarColor} 70%, black))`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: "#fff", fontWeight: 800,
                        boxShadow: `0 4px 12px color-mix(in srgb, ${avatarColor} 40%, transparent), inset 0 1px 0 rgba(255,255,255,.3)`,
                    }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-.01em" }}>{user.name}</div>
                        <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 2, fontWeight: 500 }}>Pengaturan akun</div>
                    </div>
                    <span style={{ fontSize: 14, color: "var(--color-subtle)" }}>⚙</span>
                </button>
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
