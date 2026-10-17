/**
 * Pil kecil menampilkan pemilik akun/aset: nama anggota (owner tidak null) atau "Bersama"
 * (owner null = shared/joint). Dipakai di AkunView, GoalsView, HutangView, PiutangView,
 * InvestasiView (07-frontend.md §F5-T4/T5).
 */
export default function OwnerBadge({ owner, visibility, size = "sm" }) {
    const label = owner?.display_name || "Bersama";
    const isJoint = !owner;
    const isPrivate = visibility === "private";
    const fontSize = size === "sm" ? 10 : 12;
    const padding = size === "sm" ? "3px 8px" : "4px 10px";

    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding,
                    borderRadius: 999,
                    fontSize,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    background: isJoint ? "rgba(255,255,255,.06)" : "color-mix(in srgb, var(--color-primary) 16%, transparent)",
                    color: isJoint ? "var(--color-muted)" : "var(--color-primary)",
                    border: `1px solid ${isJoint ? "var(--glass-border)" : "color-mix(in srgb, var(--color-primary) 30%, transparent)"}`,
                    whiteSpace: "nowrap",
                }}
            >
                {isJoint ? "🤝" : "👤"} {label}
            </span>
            {isPrivate && (
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding,
                        borderRadius: 999,
                        fontSize,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        background: "rgba(245,158,11,.12)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245,158,11,.3)",
                        whiteSpace: "nowrap",
                    }}
                >
                    🔒 Privat
                </span>
            )}
        </span>
    );
}
