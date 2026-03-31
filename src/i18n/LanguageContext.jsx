import { createContext, useContext, useState } from "react";
import translations from "./translations";

const LANGUAGES = [
    { code: "id", label: "Indonesia",  flag: "🇮🇩" },
    { code: "en", label: "English",    flag: "🇬🇧" },
    { code: "ar", label: "العربية",    flag: "🇸🇦", rtl: true },
    { code: "es", label: "Español",    flag: "🇪🇸" },
    { code: "zh", label: "中文",       flag: "🇨🇳" },
    { code: "ja", label: "日本語",     flag: "🇯🇵" },
];

const LanguageContext = createContext(null);

const LanguageProvider = ({ children }) => {
    const [lang, setLangState] = useState(() => localStorage.getItem("karaya_lang") || "id");

    const setLang = (code) => {
        setLangState(code);
        localStorage.setItem("karaya_lang", code);
        const isRTL = LANGUAGES.find(l => l.code === code)?.rtl || false;
        document.documentElement.dir = isRTL ? "rtl" : "ltr";
    };

    const t = (key) => translations[lang]?.[key] ?? translations["id"]?.[key] ?? key;

    const isRTL = LANGUAGES.find(l => l.code === lang)?.rtl || false;

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, isRTL, languages: LANGUAGES }}>
            {children}
        </LanguageContext.Provider>
    );
};

const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
    return ctx;
};

export { LanguageProvider, useLanguage, LANGUAGES };
