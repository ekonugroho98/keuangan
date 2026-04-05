import { useLanguage } from "../../i18n/LanguageContext";
import { APP_NAME } from "../../config/app";

const Footer = () => {
    const { t } = useLanguage();

    return (
        <footer style={{ borderTop: "1px solid rgba(255,255,255,.05)", padding: "40px 24px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: "#fff" }}>K</div>
                        <span style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{APP_NAME}</span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: 12 }}>{t("lp.footer.rights")}</p>
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
                    <a href="#" style={{ color: "#64748b", textDecoration: "none" }}>Privacy</a>
                    <a href="#" style={{ color: "#64748b", textDecoration: "none" }}>Terms</a>
                    <a href="#" style={{ color: "#64748b", textDecoration: "none" }}>info@karaya.co.id</a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
