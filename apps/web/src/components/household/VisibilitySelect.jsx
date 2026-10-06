const OPTIONS = [
    { v: "shared", l: "Shared", sub: "Semua anggota bisa lihat & catat", icon: "🌐" },
    { v: "private", l: "Privat", sub: "Hanya pemilik yang bisa lihat & catat", icon: "🔒" },
];

/**
 * Toggle shared/private untuk akun (visibility di CreateAccountBodySchema/UpdateAccountBodySchema).
 * Akun privat wajib punya pemilik (private_requires_owner di apps/api) — komponen pemanggil
 * sebaiknya paksa owner terisi dulu sebelum mengizinkan pilih "Privat".
 */
export default function VisibilitySelect({ value, onChange, disabled = false }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8, display: "block", letterSpacing: 0.8 }}>
                VISIBILITAS
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {OPTIONS.map((o) => {
                    const active = value === o.v;
                    return (
                        <button
                            key={o.v}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(o.v)}
                            style={{
                                padding: "10px 12px", borderRadius: 12, textAlign: "left",
                                border: `1px solid ${active ? "color-mix(in srgb, var(--color-primary) 40%, transparent)" : "var(--glass-border)"}`,
                                background: active
                                    ? "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 14%, transparent), color-mix(in srgb, var(--color-primary) 4%, transparent))"
                                    : "rgba(255,255,255,.02)",
                                color: active ? "var(--color-primary)" : "var(--color-muted)",
                                cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
                                opacity: disabled ? 0.5 : 1,
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{o.icon} {o.l}</div>
                            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>{o.sub}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
