import { useMembers } from "../../hooks/useMembers";
import { useAccounts } from "../../hooks/useAccounts";

const pillStyle = (active) => ({
    padding: "7px 13px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: `1px solid ${active ? "color-mix(in srgb, var(--color-primary) 40%, transparent)" : "var(--glass-border)"}`,
    background: active
        ? "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 16%, transparent), color-mix(in srgb, var(--color-primary) 4%, transparent))"
        : "rgba(255,255,255,.02)",
    color: active ? "var(--color-primary)" : "var(--color-muted)",
});

const selectStyle = {
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    border: "1px solid var(--glass-border)",
    background: "rgba(255,255,255,.02)",
    color: "var(--color-muted)",
    cursor: "pointer",
};

/**
 * Toggle Household / per-anggota / per-akun untuk laporan (F5-T5). `value` = {scope, member,
 * account}, `onChange(next)` dipanggil dengan bentuk yang sama. Tidak render apa pun untuk
 * household beranggota 1 (satu-satunya kasus mayoritas pengguna) — tidak ada yang perlu di-switch.
 */
export default function ScopeSwitcher({ value, onChange, showAccounts = true }) {
    const { members } = useMembers();
    const { accounts } = useAccounts();

    if (members.length <= 1) return null;

    const isAccountScope = value.scope === "account";

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <button type="button" style={pillStyle(value.scope === "household")} onClick={() => onChange({ scope: "household" })}>
                🏠 Household
            </button>
            {members.map((m) => (
                <button
                    key={m.id}
                    type="button"
                    style={pillStyle(value.scope === "member" && value.member === m.display_name)}
                    onClick={() => onChange({ scope: "member", member: m.display_name })}
                >
                    👤 {m.display_name}{m.is_me ? " (saya)" : ""}
                </button>
            ))}
            {showAccounts && accounts.length > 0 && (
                <select
                    value={isAccountScope ? value.account ?? "" : ""}
                    onChange={(e) => {
                        if (e.target.value) onChange({ scope: "account", account: e.target.value });
                    }}
                    style={{ ...selectStyle, color: isAccountScope ? "var(--color-primary)" : "var(--color-muted)" }}
                >
                    <option value="" disabled>📂 Per akun...</option>
                    {accounts.map((a) => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                </select>
            )}
        </div>
    );
}
