import { createContext, useContext, useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────
 * Design tokens — bento grid minimal
 * Surface tiers, refined borders, shadow system, radius scale.
 * Legacy variables preserved so existing views keep rendering.
 * ───────────────────────────────────────────────────────────── */
export const THEMES = {
    dark: {
        id: "dark", name: "Gelap", icon: "🌙",
        vars: {
            /* Base surfaces — --bg-surface is now translucent glass tint.
             * Solid alternatives: --bg-surface-low (inputs), --bg-surface-hover (hover states). */
            "--bg-app": "#0a0a10",
            "--bg-deep": "#0c0c14",
            "--bg-surface": "rgba(22,22,30,.58)",
            "--bg-surface-low": "#101018",
            "--bg-surface-hover": "#1b1b25",
            "--bg-glass": "rgba(21,21,29,.72)",
            "--bg-alt-row": "rgba(37,37,47,.35)",

            /* NEW tiered surfaces for bento cards */
            "--bg-elevated": "#181821",
            "--bg-sunk": "#0b0b12",
            "--bg-highlight": "rgba(96,252,198,.06)",
            "--bg-mesh-1": "radial-gradient(1200px 600px at 15% -10%, rgba(96,252,198,.08), transparent 60%)",
            "--bg-mesh-2": "radial-gradient(900px 500px at 110% 110%, rgba(79,195,247,.05), transparent 60%)",

            /* Text */
            "--color-text": "#f0eef7",
            "--color-muted": "#a3a1ad",
            "--color-subtle": "#6d6b76",
            "--color-faint": "#3e3c46",

            /* Brand */
            "--color-primary": "#60fcc6",
            "--color-primary-deep": "#19ce9b",
            "--color-primary-soft": "rgba(96,252,198,.12)",
            "--color-on-primary": "#003828",

            /* Signals */
            "--color-expense": "#ff716c",
            "--color-expense-soft": "rgba(255,113,108,.1)",
            "--color-transfer": "#4FC3F7",
            "--color-transfer-soft": "rgba(79,195,247,.1)",
            "--color-purple": "#a78bfa",
            "--color-purple-soft": "rgba(167,139,250,.1)",
            "--color-amber": "#f59e0b",
            "--color-amber-soft": "rgba(245,158,11,.1)",

            /* Borders */
            "--color-border": "rgba(255,255,255,.07)",
            "--color-border-soft": "rgba(255,255,255,.04)",
            "--color-border-strong": "rgba(255,255,255,.14)",

            /* Shadows */
            "--shadow-sm": "0 1px 2px rgba(0,0,0,.4)",
            "--shadow-md": "0 8px 24px rgba(0,0,0,.35)",
            "--shadow-lg": "0 20px 60px rgba(0,0,0,.55)",
            "--shadow-glow": "0 0 80px rgba(96,252,198,.14)",
            "--shadow-inset": "inset 0 1px 0 rgba(255,255,255,.04)",

            /* Radii */
            "--r-xs": "10px",
            "--r-sm": "14px",
            "--r-md": "20px",
            "--r-lg": "28px",
            "--r-xl": "36px",
            "--r-pill": "9999px",

            /* ═══ Aurora Glass System ═══ */
            "--glass-1": "rgba(22,22,30,.55)",
            "--glass-2": "rgba(28,28,38,.6)",
            "--glass-hero": "rgba(24,24,34,.52)",
            "--glass-sidebar": "rgba(12,12,20,.72)",
            "--glass-blur": "saturate(180%) blur(28px)",
            "--glass-blur-sm": "saturate(160%) blur(14px)",
            "--glass-border": "rgba(255,255,255,.08)",
            "--glass-border-strong": "rgba(255,255,255,.14)",
            "--glass-highlight": "inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 0 1px rgba(255,255,255,.02)",
            "--aurora-1": "rgba(96,252,198,.32)",
            "--aurora-2": "rgba(167,139,250,.22)",
            "--aurora-3": "rgba(79,195,247,.2)",
            "--aurora-4": "rgba(255,113,108,.14)",
            "--grain-opacity": ".025",

            /* Scrollbar & nav */
            "--scrollbar-bg": "#0a0a10",
            "--scrollbar-thumb": "#60fcc6",
            "--nav-active-bg": "rgba(96,252,198,.1)",
        },
    },
    light: {
        id: "light", name: "Terang", icon: "☀️",
        vars: {
            /* Mint whisper — soft near-white with faint mint echo.
             * --bg-surface is now translucent so views auto-glass. */
            "--bg-app": "#f6fbf9",
            "--bg-deep": "#ffffff",
            "--bg-surface": "rgba(255,255,255,.72)",
            "--bg-surface-low": "#ecf3ef",
            "--bg-surface-hover": "#e3ece7",
            "--bg-glass": "rgba(255,255,255,.78)",
            "--bg-alt-row": "rgba(15,23,42,.022)",

            "--bg-elevated": "#ffffff",
            "--bg-sunk": "#e3ece7",
            "--bg-highlight": "rgba(5,150,105,.1)",
            "--bg-mesh-1": "radial-gradient(1200px 600px at 10% -10%, rgba(5,150,105,.2), transparent 60%)",
            "--bg-mesh-2": "radial-gradient(900px 500px at 110% 110%, rgba(37,99,235,.12), transparent 60%)",

            "--color-text": "#0b1120",
            "--color-muted": "#475569",
            "--color-subtle": "#7a8699",
            "--color-faint": "#a8b3c4",

            "--color-primary": "#059669",
            "--color-primary-deep": "#047857",
            "--color-primary-soft": "rgba(5,150,105,.1)",
            "--color-on-primary": "#ffffff",

            "--color-expense": "#dc2626",
            "--color-expense-soft": "rgba(220,38,38,.08)",
            "--color-transfer": "#2563eb",
            "--color-transfer-soft": "rgba(37,99,235,.08)",
            "--color-purple": "#7c3aed",
            "--color-purple-soft": "rgba(124,58,237,.08)",
            "--color-amber": "#d97706",
            "--color-amber-soft": "rgba(217,119,6,.08)",

            "--color-border": "rgba(15,23,42,.12)",
            "--color-border-soft": "rgba(15,23,42,.07)",
            "--color-border-strong": "rgba(15,23,42,.18)",

            "--shadow-sm": "0 1px 3px rgba(15,23,42,.06)",
            "--shadow-md": "0 6px 24px rgba(15,23,42,.1)",
            "--shadow-lg": "0 20px 56px rgba(15,23,42,.15)",
            "--shadow-glow": "0 0 60px rgba(5,150,105,.12)",
            "--shadow-inset": "inset 0 1px 0 rgba(255,255,255,.7)",

            "--r-xs": "10px",
            "--r-sm": "14px",
            "--r-md": "20px",
            "--r-lg": "28px",
            "--r-xl": "36px",
            "--r-pill": "9999px",

            /* Tinted glass — crisp on mint whisper, text stays razor-sharp */
            "--glass-1": "rgba(255,255,255,.72)",
            "--glass-2": "rgba(255,255,255,.82)",
            "--glass-hero": "rgba(255,255,255,.66)",
            "--glass-sidebar": "rgba(255,255,255,.76)",
            "--glass-blur": "saturate(180%) blur(24px)",
            "--glass-blur-sm": "saturate(160%) blur(12px)",
            "--glass-border": "rgba(15,60,45,.08)",
            "--glass-border-strong": "rgba(15,60,45,.16)",
            "--glass-highlight": "inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 1px rgba(255,255,255,.35)",
            /* Aurora — softer on mint whisper so it feels calm not tropical */
            "--aurora-1": "rgba(16,185,129,.28)",
            "--aurora-2": "rgba(139,92,246,.22)",
            "--aurora-3": "rgba(59,130,246,.18)",
            "--aurora-4": "rgba(244,114,182,.18)",
            "--grain-opacity": ".014",

            "--scrollbar-bg": "#eef1f5",
            "--scrollbar-thumb": "#059669",
            "--nav-active-bg": "rgba(5,150,105,.08)",
        },
    },
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [themeId, setThemeId] = useState(() => localStorage.getItem("karaya_theme") || "dark");

    const applyTheme = (id) => {
        const theme = THEMES[id] || THEMES.dark;
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
        localStorage.setItem("karaya_theme", id);
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
