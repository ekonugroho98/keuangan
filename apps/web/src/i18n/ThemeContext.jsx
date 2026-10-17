import { createContext, useContext, useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────
 * Design tokens — Keluarga Berkembang (Eye-Friendly Soft Sage & Calm Forest)
 * Dirancang khusus untuk penggunaan layar lama (low eye-strain):
 * - Latar utama netral sejuk-hangat (#F3F5F2 Sage Mist), BUKAN kuning/sepia
 * - Kartu putih bersih lembut (#FFFFFF) dengan kontras natural terhadap input (#F7F9F6)
 * - Warna identitas Sage Forest (#46634E) & Mellow Sage (#839B7A)
 * - Aksen Terracotta (#B86B4B) & Mustard (#C9963E) lembut tidak menyengat
 * ───────────────────────────────────────────────────────────── */
export const THEMES = {
    light: {
        id: "light", name: "Sejuk (Soft Sage)", icon: "🌿",
        vars: {
            /* Base surfaces — Soft Alabaster Sage Mist (anti-silau & tidak kuning) */
            "--bg-app": "#F2F5F1",
            "--bg-deep": "#FFFFFF",
            "--bg-surface": "rgba(255, 255, 255, 0.94)",
            "--bg-surface-low": "#F7F9F6",
            "--bg-surface-hover": "#EDF2EC",
            "--bg-glass": "rgba(255, 255, 255, 0.92)",
            "--bg-alt-row": "rgba(63, 81, 66, 0.03)",

            /* Tiered surfaces for bento cards */
            "--bg-elevated": "#FFFFFF",
            "--bg-sunk": "#E9EFE8",
            "--bg-highlight": "rgba(131, 155, 122, 0.12)",
            "--bg-mesh-1": "radial-gradient(1200px 600px at 10% -10%, rgba(131, 155, 122, 0.12), transparent 60%)",
            "--bg-mesh-2": "radial-gradient(900px 500px at 110% 110%, rgba(74, 111, 124, 0.06), transparent 60%)",

            /* Text — Soft Charcoal Sage (nyaman dibaca, tidak terlalu hitam pekat) */
            "--color-text": "#232E26",
            "--color-muted": "#556459",
            "--color-subtle": "#78877C",
            "--color-faint": "#A3B0A6",

            /* Brand — Softened Sage Forest (#46634E) & Mellow Sage (#839B7A) */
            "--color-primary": "#46634E",
            "--color-primary-deep": "#364E3D",
            "--color-primary-soft": "rgba(70, 99, 78, 0.10)",
            "--color-on-primary": "#FFFFFF",

            /* Brand Accent Tokens */
            "--color-sage-mellow": "#839B7A",
            "--color-soil": "#7D513B",
            "--color-sand": "#E8D3A7",
            "--color-terracotta": "#B5694A",
            "--color-mustard": "#C8963E",

            /* Signals — Pastel/Muted Earth Tones (tidak menusuk mata) */
            "--color-expense": "#C25E4C",
            "--color-expense-soft": "rgba(194, 94, 76, 0.10)",
            "--color-transfer": "#4B7B8C",
            "--color-transfer-soft": "rgba(75, 123, 140, 0.10)",
            "--color-purple": "#73638A",
            "--color-purple-soft": "rgba(115, 99, 138, 0.10)",
            "--color-amber": "#C48B2C",
            "--color-amber-soft": "rgba(196, 139, 44, 0.12)",

            /* Borders — halus & bersih */
            "--color-border": "rgba(35, 46, 38, 0.10)",
            "--color-border-soft": "rgba(35, 46, 38, 0.06)",
            "--color-border-strong": "rgba(70, 99, 78, 0.24)",

            /* Shadows — sangat lembut */
            "--shadow-sm": "0 1px 3px rgba(35, 46, 38, 0.04)",
            "--shadow-md": "0 6px 20px rgba(35, 46, 38, 0.06)",
            "--shadow-lg": "0 16px 44px rgba(35, 46, 38, 0.10)",
            "--shadow-glow": "0 0 40px rgba(131, 155, 122, 0.14)",
            "--shadow-inset": "inset 0 1px 0 rgba(255, 255, 255, 0.9)",

            /* Radii */
            "--r-xs": "10px",
            "--r-sm": "14px",
            "--r-md": "20px",
            "--r-lg": "28px",
            "--r-xl": "36px",
            "--r-pill": "9999px",

            /* Clean Soft Glass System */
            "--glass-1": "rgba(255, 255, 255, 0.92)",
            "--glass-2": "rgba(255, 255, 255, 0.96)",
            "--glass-hero": "rgba(255, 255, 255, 0.95)",
            "--glass-sidebar": "rgba(248, 250, 247, 0.96)",
            "--glass-blur": "saturate(140%) blur(20px)",
            "--glass-blur-sm": "saturate(130%) blur(10px)",
            "--glass-border": "rgba(35, 46, 38, 0.08)",
            "--glass-border-strong": "rgba(70, 99, 78, 0.18)",
            "--glass-highlight": "inset 0 1px 0 rgba(255, 255, 255, 1)",
            "--aurora-1": "rgba(131, 155, 122, 0.10)",
            "--aurora-2": "rgba(131, 155, 122, 0.06)",
            "--aurora-3": "rgba(75, 123, 140, 0.05)",
            "--aurora-4": "rgba(131, 155, 122, 0.05)",
            "--grain-opacity": ".008",

            "--scrollbar-bg": "#E9EFE8",
            "--scrollbar-thumb": "#839B7A",
            "--nav-active-bg": "rgba(70, 99, 78, 0.10)",
        },
    },
    dark: {
        id: "dark", name: "Teduh (Dark Sage)", icon: "🌙",
        vars: {
            /* Base surfaces — Soft Matte Forest Slate (adem di mata saat malam) */
            "--bg-app": "#151B17",
            "--bg-deep": "#111613",
            "--bg-surface": "rgba(27, 35, 30, 0.88)",
            "--bg-surface-low": "#1F2822",
            "--bg-surface-hover": "#28332C",
            "--bg-glass": "rgba(24, 31, 27, 0.90)",
            "--bg-alt-row": "rgba(255, 255, 255, 0.025)",

            /* Tiered surfaces for bento cards */
            "--bg-elevated": "#202A23",
            "--bg-sunk": "#111613",
            "--bg-highlight": "rgba(131, 155, 122, 0.10)",
            "--bg-mesh-1": "radial-gradient(1200px 600px at 15% -10%, rgba(131, 155, 122, 0.10), transparent 60%)",
            "--bg-mesh-2": "radial-gradient(900px 500px at 110% 110%, rgba(75, 123, 140, 0.06), transparent 60%)",

            /* Text — Soft Sage Off-White (tidak menyilaukan di latar gelap) */
            "--color-text": "#E5ECE7",
            "--color-muted": "#9AA89E",
            "--color-subtle": "#6E7D72",
            "--color-faint": "#47544B",

            /* Brand — Mellow Sage (#839B7A) */
            "--color-primary": "#8CA882",
            "--color-primary-deep": "#6E8B65",
            "--color-primary-soft": "rgba(140, 168, 130, 0.15)",
            "--color-on-primary": "#131A15",

            /* Brand Accent Tokens */
            "--color-sage-mellow": "#839B7A",
            "--color-soil": "#B8876E",
            "--color-sand": "#E8D3A7",
            "--color-terracotta": "#C97A5B",
            "--color-mustard": "#D49D3F",

            /* Signals */
            "--color-expense": "#D97B6C",
            "--color-expense-soft": "rgba(217, 123, 108, 0.14)",
            "--color-transfer": "#6FA3B8",
            "--color-transfer-soft": "rgba(111, 163, 184, 0.14)",
            "--color-purple": "#A594BD",
            "--color-purple-soft": "rgba(165, 148, 189, 0.14)",
            "--color-amber": "#D49D3F",
            "--color-amber-soft": "rgba(212, 157, 63, 0.14)",

            /* Borders */
            "--color-border": "rgba(229, 236, 231, 0.09)",
            "--color-border-soft": "rgba(229, 236, 231, 0.05)",
            "--color-border-strong": "rgba(140, 168, 130, 0.25)",

            /* Shadows */
            "--shadow-sm": "0 1px 3px rgba(0, 0, 0, 0.3)",
            "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.3)",
            "--shadow-lg": "0 20px 56px rgba(0, 0, 0, 0.45)",
            "--shadow-glow": "0 0 60px rgba(131, 155, 122, 0.12)",
            "--shadow-inset": "inset 0 1px 0 rgba(255, 255, 255, 0.04)",

            /* Radii */
            "--r-xs": "10px",
            "--r-sm": "14px",
            "--r-md": "20px",
            "--r-lg": "28px",
            "--r-xl": "36px",
            "--r-pill": "9999px",

            /* Deep Sage Glass System */
            "--glass-1": "rgba(27, 35, 30, 0.85)",
            "--glass-2": "rgba(33, 42, 36, 0.90)",
            "--glass-hero": "rgba(30, 39, 33, 0.88)",
            "--glass-sidebar": "rgba(19, 25, 21, 0.94)",
            "--glass-blur": "saturate(140%) blur(22px)",
            "--glass-blur-sm": "saturate(130%) blur(12px)",
            "--glass-border": "rgba(229, 236, 231, 0.08)",
            "--glass-border-strong": "rgba(229, 236, 231, 0.16)",
            "--glass-highlight": "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
            "--aurora-1": "rgba(131, 155, 122, 0.12)",
            "--aurora-2": "rgba(70, 99, 78, 0.10)",
            "--aurora-3": "rgba(75, 123, 140, 0.08)",
            "--aurora-4": "rgba(176, 100, 67, 0.06)",
            "--grain-opacity": ".015",

            /* Scrollbar & nav */
            "--scrollbar-bg": "#151B17",
            "--scrollbar-thumb": "#46634E",
            "--nav-active-bg": "rgba(140, 168, 130, 0.14)",
        },
    },
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [themeId, setThemeId] = useState(() => localStorage.getItem("karaya_theme_kb") || "light");

    const applyTheme = (id) => {
        const theme = THEMES[id] || THEMES.light;
        const root = document.documentElement;
        Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
        let el = document.getElementById("karaya-theme-style");
        if (!el) { el = document.createElement("style"); el.id = "karaya-theme-style"; document.head.appendChild(el); }
        el.textContent = `
            body { background: ${theme.vars["--bg-app"]} !important; }
            ::-webkit-scrollbar-track { background: ${theme.vars["--scrollbar-bg"]} !important; }
            ::-webkit-scrollbar-thumb { background: ${theme.vars["--scrollbar-thumb"]} !important; }
        `;
        document.documentElement.setAttribute("data-theme", id);
    };

    useEffect(() => { applyTheme(themeId); }, [themeId]);

    const setTheme = (id) => {
        setThemeId(id);
        localStorage.setItem("karaya_theme_kb", id);
    };

    const toggleTheme = () => setTheme(themeId === "dark" ? "light" : "dark");

    return (
        <ThemeContext.Provider value={{ themeId, setTheme, toggleTheme, theme: THEMES[themeId] || THEMES.dark, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
    return ctx;
};
