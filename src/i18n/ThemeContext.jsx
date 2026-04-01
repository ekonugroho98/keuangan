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
            "--color-border": "rgba(72,71,79,.15)", "--color-border-soft": "rgba(255,255,255,.06)",
            "--color-expense": "#ff716c", "--color-transfer": "#4FC3F7",
            "--color-purple": "#a78bfa", "--color-amber": "#f59e0b",
            "--scrollbar-bg": "#0e0e15", "--scrollbar-thumb": "#60fcc6",
            "--nav-active-bg": "rgba(27,27,34,.5)",
        },
    },
    light: {
        id: "light", name: "Terang", icon: "☀️",
        vars: {
            "--bg-app": "#f2f2f7", "--bg-deep": "#e8e8f0",
            "--bg-surface": "#ffffff", "--bg-surface-low": "#f5f5fa",
            "--bg-surface-hover": "#ededf5", "--bg-glass": "rgba(255,255,255,.85)",
            "--bg-alt-row": "rgba(0,0,0,.025)",
            "--color-text": "#1a1a2e", "--color-muted": "#5c5c72", "--color-subtle": "#8888a0",
            "--color-primary": "#00b87a", "--color-on-primary": "#ffffff",
            "--color-border": "rgba(0,0,0,.07)", "--color-border-soft": "rgba(0,0,0,.05)",
            "--color-expense": "#e53935", "--color-transfer": "#1565c0",
            "--color-purple": "#6d28d9", "--color-amber": "#d97706",
            "--scrollbar-bg": "#f2f2f7", "--scrollbar-thumb": "#00b87a",
            "--nav-active-bg": "rgba(0,184,122,.08)",
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
