import { useLanguage } from "../../i18n/LanguageContext";
import { APP_NAME } from "../../config/app";

const Footer = () => {
    const { t } = useLanguage();

    const productLinks = [
        { label: t("lp.nav.features") || "Fitur", href: "#fitur" },
        { label: t("lp.nav.ai") || "AI Coach", href: "#ai" },
        { label: t("lp.nav.faq") || "FAQ", href: "#faq" },
    ];

    const resourceLinks = [
        { label: "Blog", href: "#" },
        { label: "Changelog", href: "#" },
        { label: "Roadmap", href: "#" },
        { label: "Status", href: "#" },
    ];

    const legalLinks = [
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
        { label: "Security", href: "#" },
        { label: "Telegram Komunitas", href: "https://t.me/keluargaberkembang" },
    ];

    const socials = [
        { icon: "TG", label: "Telegram @keluargaberkembang", href: "https://t.me/keluargaberkembang" },
        { icon: "IG", label: "Instagram", href: "#" },
        { icon: "YT", label: "YouTube", href: "#" },
        { icon: "𝕏", label: "Twitter", href: "#" },
    ];

    return (
        <footer style={{
            position: "relative",
            padding: "72px 24px 36px",
            overflow: "hidden",
        }}>
            {/* Top glass border */}
            <div aria-hidden style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 1,
                background: "linear-gradient(90deg, transparent, var(--color-border), transparent)",
            }} />

            {/* Ambient */}
            <div aria-hidden style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(800px 300px at 50% 0%, rgba(70,99,78,.06), transparent 70%)",
            }} />

            <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 1 }}>
                {/* Top grid */}
                <div
                    className="footer-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr",
                        gap: 48,
                        paddingBottom: 48,
                    }}
                >
                    {/* Brand */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <img
                                src="/logo-icon.png"
                                alt={APP_NAME}
                                style={{
                                    width: 38, height: 38, borderRadius: 11,
                                    objectFit: "cover",
                                    border: "1px solid var(--color-border)",
                                    boxShadow: "0 4px 12px rgba(63,81,66,.15)",
                                }}
                            />
                            <div style={{ lineHeight: 1.05 }}>
                                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, letterSpacing: ".02em" }}>
                                    <span style={{ color: "var(--color-soil, #7D513B)" }}>KELUARGA </span>
                                    <span style={{ color: "var(--color-primary)" }}>BERKEMBANG</span>
                                </div>
                                <div style={{ fontFamily: "var(--font-hand, 'Caveat', cursive)", fontSize: 13.5, color: "var(--color-muted)" }}>
                                    Berkembang Bersama dalam Kehangatan
                                </div>
                            </div>
                        </div>
                        <p style={{
                            color: "var(--color-muted)", fontSize: 13.5,
                            lineHeight: 1.65, maxWidth: 340, marginBottom: 20,
                        }}>
                            {t("lp.footer.tagline") || "Rumah digital keluarga hangat — kelola keuangan suami-istri, daftar belanja, dan stok kulkas bersama."}
                        </p>
                        {/* Socials */}
                        <div style={{ display: "flex", gap: 8 }}>
                            {socials.map((s, i) => (
                                <a
                                    key={i}
                                    href={s.href}
                                    aria-label={s.label}
                                    style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: "var(--bg-surface)",
                                        border: "1px solid var(--color-border-soft)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "var(--color-muted)", fontSize: 12, fontWeight: 700,
                                        textDecoration: "none",
                                        transition: "all .25s",
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.color = "var(--color-primary)";
                                        e.currentTarget.style.borderColor = "var(--color-border)";
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.color = "var(--color-muted)";
                                        e.currentTarget.style.borderColor = "var(--color-border-soft)";
                                        e.currentTarget.style.transform = "translateY(0)";
                                    }}
                                >{s.icon}</a>
                            ))}
                        </div>
                    </div>

                    {/* Product */}
                    <FooterCol title={t("lp.footer.product") || "Produk"} links={productLinks} />
                    {/* Resources */}
                    <FooterCol title={t("lp.footer.resources") || "Sumber Daya"} links={resourceLinks} />
                    {/* Legal */}
                    <FooterCol title={t("lp.footer.legal") || "Legal"} links={legalLinks} />
                </div>

                {/* Divider */}
                <div style={{
                    height: 1,
                    background: "linear-gradient(90deg, transparent, var(--color-border-soft), transparent)",
                }} />

                {/* Bottom strip */}
                <div
                    className="footer-bottom"
                    style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        paddingTop: 24,
                        flexWrap: "wrap", gap: 16,
                    }}
                >
                    <p style={{ color: "var(--color-subtle)", fontSize: 12, margin: 0 }}>
                        {t("lp.footer.rights")}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            color: "var(--color-muted)",
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary)" }} />
                            {t("lp.footer.status") || "Semua sistem operasional"}
                        </span>
                        <span style={{ color: "var(--color-subtle)" }}>·</span>
                        <span style={{ color: "var(--color-muted)" }}>🇮🇩 Indonesia</span>
                    </div>
                </div>
            </div>

            <style>{`
                @media (max-width: 900px) {
                    .footer-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 32px !important; }
                }
                @media (max-width: 640px) {
                    .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
                    .footer-bottom { flex-direction: column; align-items: flex-start !important; }
                    footer { padding: 48px 20px 28px !important; }
                }
            `}</style>
        </footer>
    );
};

const FooterCol = ({ title, links }) => (
    <div>
        <div style={{
            fontSize: 11, fontWeight: 800,
            letterSpacing: 1.6, textTransform: "uppercase",
            color: "var(--color-subtle)",
            marginBottom: 16,
        }}>{title}</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {links.map((l, i) => (
                <li key={i}>
                    <a
                        href={l.href}
                        style={{
                            color: "var(--color-muted)",
                            fontSize: 13.5,
                            textDecoration: "none",
                            transition: "color .2s",
                            display: "inline-block",
                            minHeight: 24,
                        }}
                        onMouseOver={e => e.currentTarget.style.color = "var(--color-text)"}
                        onMouseOut={e => e.currentTarget.style.color = "var(--color-muted)"}
                    >{l.label}</a>
                </li>
            ))}
        </ul>
    </div>
);

export default Footer;
