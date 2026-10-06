import { useMembers } from "../../hooks/useMembers";

const selectStyle = {
    width: "100%", padding: "10px 12px", fontSize: 13,
    borderRadius: 10, border: "1px solid var(--glass-border)",
    background: "rgba(255,255,255,.02)", color: "var(--color-text)",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

/**
 * Dropdown pemilik: "Bersama" (shared/joint) + satu opsi per anggota household. `value` adalah
 * member id (string uuid) atau "joint"; dipakai apa adanya sebagai field `owner` saat submit ke
 * API (resolveOwnerMemberId menerima uuid langsung, lihat apps/api/src/services/resolver.ts).
 * Household beranggota 1 (belum pernah undang siapa pun) otomatis tidak menampilkan apa-apa
 * (komponen pemanggil sebaiknya skip render kalau members.length <= 1).
 */
export default function OwnerSelect({ value, onChange, label = "PEMILIK", disabled = false }) {
    const { members } = useMembers();
    if (members.length <= 1) return null;

    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8, display: "block", letterSpacing: 0.8 }}>
                {label}
            </label>
            <select value={value ?? "joint"} onChange={(e) => onChange(e.target.value)} style={selectStyle} disabled={disabled}>
                <option value="joint">🤝 Bersama</option>
                {members.map((m) => (
                    <option key={m.id} value={m.id}>👤 {m.display_name}{m.is_me ? " (saya)" : ""}</option>
                ))}
            </select>
        </div>
    );
}
