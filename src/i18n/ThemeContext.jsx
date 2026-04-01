import { createContext, useContext, useState, useEffect } from "react";

export const THEMES = {
    dark: {
        id: "dark", name: "Gelap", icon: "🌙",
        vars: {
            "--bg-app": "#0e0e15", "--bg-deep": "#0f0f1a",
            "--bg-surface": "#1f1f28", "--bg-surface-low": "#13131a",
            "--bg-surface-hover": "#191921", "--bg-glass": "rgba(31,31,38,.6)",
            "--bg-alt-row": "rgba(37,37,47,.35)",
            "--color-text": "#efecf7", "--color-muted": "#acaab4", "--color-subtle": "#76747e",
            "--color-primary": "#60fcc6", "--color-on-primary": "#005e44",
            "--color-border": "rgba(255,255,255,.07)", "--color-border-soft": "rgba(255,255,255,.04)",
            "--color-expense": "#ff716c", "--color-transfer": "#4FC3F7",
            "--color-purple": "#a78bfa", "--color-amber": "#f59e0b",
            "--scrollbar-bg": "#0e0e15", "--scrollbar-thumb": "#60fcc6",
            "--nav-active-bg": "rgba(27,27,34,.5)",
        },
    },
    light: {
        id: "light", name: "Terang", icon: "☀️",
        vars: {
            "--bg-app": "#f0f2f5", "--bg-deep": "#ffffff",
            "--bg-surface": "#ffffff", "--bg-surface-low": "#f0f2f5",
            "--bg-surface-hover": "#e8ebf0", "--bg-glass": "rgba(255,255,255,.9)",
            "--bg-alt-row": "rgba(0,0,0,.02)",
            "--color-text": "#111827", "--color-muted": "#6b7280", "--color-subtle": "#9ca3af",
            "--color-primary": "#059669", "--color-on-primary": "#ffffff",
            "--color-border": "rgba(0,0,0,.09)", "--color-border-soft": "rgba(0,0,0,.05)",
            "--color-expense": "#dc2626", "--color-transfer": "#2563eb",
            "--color-purple": "#7c3aed", "--color-amber": "#d97706",
            "--scrollbar-bg": "#f0f2f5", "--scrollbar-thumb": "#059669",
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
