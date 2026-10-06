import { useState } from "react";
import { useHousehold } from "../../auth/HouseholdProvider";
import { useHouseholdInfo } from "../../hooks/useHouseholdInfo";
import { useMembers } from "../../hooks/useMembers";
import { useInvitations } from "../../hooks/useInvitations";

const backBtn = {
    background: "none", border: "none", color: "var(--color-primary)", fontSize: 12, fontWeight: 700,
    cursor: "pointer", padding: 0, marginBottom: 14, fontFamily: "inherit", display: "block",
};
const sectionLabel = {
    fontSize: 10, fontWeight: 800, color: "var(--color-muted)", letterSpacing: 1, textTransform: "uppercase",
    marginTop: 18, marginBottom: 8,
};
const inputSt = {
    width: "100%", padding: "9px 12px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)",
    borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const rowCard = {
    display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 10,
    background: "rgba(255,255,255,.03)", border: "1px solid var(--glass-border)", marginBottom: 6,
};
const smallBtn = (danger = false) => ({
    padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
    border: danger ? "1px solid rgba(255,113,108,.25)" : "1px solid var(--glass-border)",
    background: danger ? "rgba(255,113,108,.08)" : "var(--color-border-soft)",
    color: danger ? "#ff716c" : "var(--color-text)",
});

/**
 * Panel Settings → Household (F5-T3): switcher (kalau >1 membership), ubah nama/timezone (owner),
 * daftar anggota (ubah role/hapus, owner saja; keluar sendiri selalu boleh), buat & kelola undangan
 * (owner saja). Self-contained lewat hook sendiri supaya Sidebar.jsx tidak perlu thread props baru.
 */
export default function HouseholdPanel({ onBack, showToast }) {
    const { memberships, activeHouseholdId, activeMember, switchHousehold } = useHousehold();
    const { household, updateHouseholdInfo } = useHouseholdInfo();
    const { members, updateMember, removeMember, leaveHousehold } = useMembers();
    const { invitations, createInvitation, revokeInvitation } = useInvitations();

    const isOwner = activeMember?.role === "owner";
    const [tab, setTab] = useState("info");
    const [nameDraft, setNameDraft] = useState("");
    const [editingName, setEditingName] = useState(false);
    const [inviteRole, setInviteRole] = useState("owner");
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [busy, setBusy] = useState(false);

    const toast = (msg, type) => showToast?.(msg, type);

    const saveName = async () => {
        if (!nameDraft.trim()) return;
        setBusy(true);
        try {
            await updateHouseholdInfo({ name: nameDraft.trim() });
            setEditingName(false);
            toast?.("✅ Nama household diperbarui");
        } catch (err) {
            toast?.(err.message || "Gagal mengubah nama", "error");
        } finally {
            setBusy(false);
        }
    };

    const handleInvite = async () => {
        setBusy(true);
        try {
            const inv = await createInvitation({ role: inviteRole });
            await navigator.clipboard?.writeText(`${window.location.origin}${inv.accept_url}`).catch(() => {});
            toast?.(`✅ Kode undangan: ${inv.code} (link disalin)`);
        } catch (err) {
            toast?.(err.message || "Gagal membuat undangan", "error");
        } finally {
            setBusy(false);
        }
    };

    const handleRoleChange = async (member, role) => {
        try {
            await updateMember(member.id, { role });
            toast?.(`✅ ${member.display_name} sekarang ${role}`);
        } catch (err) {
            toast?.(err.message || "Gagal ubah peran", "error");
        }
    };

    const handleRemove = async (member) => {
        try {
            await removeMember(member.id);
            toast?.(`${member.display_name} dikeluarkan dari household`);
        } catch (err) {
            toast?.(err.message || "Gagal menghapus anggota", "error");
        } finally {
            setConfirmRemove(null);
        }
    };

    const handleLeave = async () => {
        try {
            await leaveHousehold();
            toast?.("Kamu keluar dari household");
        } catch (err) {
            toast?.(err.message || "Gagal keluar household", "error");
        }
    };

    return (
        <div>
            <button style={backBtn} onClick={onBack}>← Kembali</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>🏠 Household</div>

            {memberships.length > 1 && (
                <>
                    <div style={sectionLabel}>Household aktif</div>
                    {memberships.map((m) => (
                        <button
                            key={m.household_id}
                            onClick={() => switchHousehold(m.household_id)}
                            style={{
                                ...rowCard, width: "100%", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                borderColor: m.household_id === activeHouseholdId ? "color-mix(in srgb, var(--color-primary) 40%, transparent)" : "var(--glass-border)",
                            }}
                        >
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{m.household_name}</span>
                            {m.household_id === activeHouseholdId && <span style={{ fontSize: 11, color: "var(--color-primary)" }}>✓ Aktif</span>}
                        </button>
                    ))}
                </>
            )}

            <div style={sectionLabel}>Nama household</div>
            {editingName ? (
                <div style={{ display: "flex", gap: 6 }}>
                    <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={inputSt} autoFocus />
                    <button style={smallBtn()} onClick={saveName} disabled={busy}>Simpan</button>
                </div>
            ) : (
                <div style={{ ...rowCard, cursor: isOwner ? "pointer" : "default" }} onClick={() => { if (isOwner) { setNameDraft(household?.name || ""); setEditingName(true); } }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--color-text)" }}>{household?.name || "..."}</span>
                    {isOwner && <span style={{ fontSize: 11, color: "var(--color-muted)" }}>✏️</span>}
                </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                <button style={{ ...smallBtn(), flex: 1, background: tab === "members" ? "var(--color-primary-soft)" : "var(--color-border-soft)" }} onClick={() => setTab("members")}>Anggota ({members.length})</button>
                {isOwner && (
                    <button style={{ ...smallBtn(), flex: 1, background: tab === "invite" ? "var(--color-primary-soft)" : "var(--color-border-soft)" }} onClick={() => setTab("invite")}>Undangan</button>
                )}
            </div>

            {tab === "members" && (
                <div style={{ marginTop: 10 }}>
                    {members.map((m) => (
                        <div key={m.id} style={rowCard}>
                            <span style={{ flex: 1, fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>
                                {m.display_name} {m.is_me && <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>(saya)</span>}
                            </span>
                            {isOwner && !m.is_me ? (
                                <select
                                    value={m.role}
                                    onChange={(e) => handleRoleChange(m, e.target.value)}
                                    style={{ ...inputSt, width: "auto", padding: "4px 6px", fontSize: 11 }}
                                >
                                    <option value="owner">owner</option>
                                    <option value="member">member</option>
                                    <option value="viewer">viewer</option>
                                </select>
                            ) : (
                                <span style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 700 }}>{m.role}</span>
                            )}
                            {isOwner && !m.is_me && (
                                confirmRemove === m.id ? (
                                    <>
                                        <button style={smallBtn(true)} onClick={() => handleRemove(m)}>Yakin?</button>
                                        <button style={smallBtn()} onClick={() => setConfirmRemove(null)}>Batal</button>
                                    </>
                                ) : (
                                    <button style={smallBtn(true)} onClick={() => setConfirmRemove(m.id)}>Hapus</button>
                                )
                            )}
                        </div>
                    ))}
                    {members.length > 1 && (
                        <button style={{ ...smallBtn(true), width: "100%", marginTop: 8 }} onClick={handleLeave}>
                            🚪 Keluar dari household ini
                        </button>
                    )}
                </div>
            )}

            {tab === "invite" && isOwner && (
                <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ ...inputSt, flex: 1 }}>
                            <option value="owner">Undang sebagai owner</option>
                            <option value="member">Undang sebagai member</option>
                            <option value="viewer">Undang sebagai viewer</option>
                        </select>
                        <button style={smallBtn()} onClick={handleInvite} disabled={busy}>+ Buat</button>
                    </div>
                    {invitations.filter((i) => i.status === "pending").map((inv) => (
                        <div key={inv.id} style={rowCard}>
                            <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", color: "var(--color-text)" }}>{inv.code}</span>
                            <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{inv.role}</span>
                            <button style={smallBtn(true)} onClick={() => revokeInvitation(inv.id)}>Cabut</button>
                        </div>
                    ))}
                    {invitations.filter((i) => i.status === "pending").length === 0 && (
                        <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 10 }}>Belum ada undangan pending</div>
                    )}
                </div>
            )}
        </div>
    );
}
