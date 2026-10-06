import { useState } from "react";
import { useHousehold } from "../../auth/HouseholdProvider";
import { useMembers } from "../../hooks/useMembers";
import { useApiKeys } from "../../hooks/useApiKeys";

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
    display: "flex", flexDirection: "column", gap: 4, padding: "9px 10px", borderRadius: 10,
    background: "rgba(255,255,255,.03)", border: "1px solid var(--glass-border)", marginBottom: 6,
};
const smallBtn = (danger = false) => ({
    padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
    border: danger ? "1px solid rgba(255,113,108,.25)" : "1px solid var(--glass-border)",
    background: danger ? "rgba(255,113,108,.08)" : "var(--color-border-soft)",
    color: danger ? "#ff716c" : "var(--color-text)",
});
const primaryBtn = (disabled = false) => ({
    width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
    background: disabled ? "var(--color-border-soft)" : "var(--color-primary)",
    color: disabled ? "var(--color-subtle)" : "var(--color-on-primary)",
    fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    opacity: disabled ? .6 : 1,
});

/**
 * Settings → API Key (F6-T1/T3 UI, sebelumnya belum dibangun — cuma backend). Owner bisa bikin
 * key untuk diri sendiri atau anggota lain (dipakai agent/Hermes per-orang, supaya recorded_by
 * benar); non-owner cuma bisa bikin & lihat key miliknya sendiri (ditegakkan juga di backend lewat
 * create_api_key()/listApiKeys()). Secret HANYA ditampilkan sekali tepat setelah dibuat.
 */
export default function ApiKeysPanel({ onBack, showToast }) {
    const { activeMember } = useHousehold();
    const { members } = useMembers();
    const { apiKeys, apiKeysLoading, createApiKey, revokeApiKey } = useApiKeys();
    const isOwner = activeMember?.role === "owner";

    const [name, setName] = useState("");
    const [scope, setScope] = useState("write");
    const [targetMember, setTargetMember] = useState("me");
    const [busy, setBusy] = useState(false);
    const [justCreated, setJustCreated] = useState(null); // { secret, name }
    const [confirmRevoke, setConfirmRevoke] = useState(null);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            const { api_key, secret } = await createApiKey({ name: name.trim(), scope, member: targetMember });
            setJustCreated({ secret, name: api_key.name });
            setName("");
            setScope("write");
            setTargetMember("me");
        } catch (err) {
            showToast?.(err.message || "Gagal membuat API key", "error");
        } finally {
            setBusy(false);
        }
    };

    const handleCopySecret = async () => {
        try {
            await navigator.clipboard.writeText(justCreated.secret);
            showToast?.("✅ Key disalin ke clipboard");
        } catch {
            showToast?.("Gagal auto-copy — salin manual dari kotak di bawah", "error");
        }
    };

    const handleRevoke = async (id) => {
        try {
            await revokeApiKey(id);
            showToast?.("Key dicabut");
        } catch (err) {
            showToast?.(err.message || "Gagal mencabut key", "error");
        } finally {
            setConfirmRevoke(null);
        }
    };

    return (
        <div>
            <button style={backBtn} onClick={onBack}>← Kembali</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>🔑 API Key</div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
                Dipakai agent/Hermes untuk akses API Karaya atas nama anggota tertentu — catat sendiri siapa yang record
                transaksi lewat key masing-masing, bukan satu key dipakai bersama.
            </div>

            {justCreated && (
                <div style={{
                    padding: 12, borderRadius: 10, marginBottom: 14,
                    background: "rgba(96,252,198,.08)", border: "1px solid rgba(96,252,198,.25)",
                }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6 }}>
                        ✅ Key "{justCreated.name}" dibuat — salin SEKARANG, tidak akan ditampilkan lagi
                    </div>
                    <div style={{
                        fontSize: 11, fontFamily: "monospace", color: "var(--color-text)", wordBreak: "break-all",
                        userSelect: "all", padding: 8, background: "rgba(0,0,0,.2)", borderRadius: 8, marginBottom: 8,
                    }}>
                        {justCreated.secret}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button style={smallBtn()} onClick={handleCopySecret}>Salin</button>
                        <button style={smallBtn()} onClick={() => setJustCreated(null)}>Tutup</button>
                    </div>
                </div>
            )}

            <div style={sectionLabel}>BUAT KEY BARU</div>
            <input
                value={name} onChange={(e) => setName(e.target.value)}
                style={{ ...inputSt, marginBottom: 8 }}
                placeholder='Nama key, mis. "Hermes - Ayah"'
            />
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ ...inputSt, flex: 1 }}>
                    <option value="read">Scope: Read</option>
                    <option value="write">Scope: Write</option>
                    {isOwner && <option value="admin">Scope: Admin</option>}
                </select>
                {isOwner && members.length > 1 && (
                    <select value={targetMember} onChange={(e) => setTargetMember(e.target.value)} style={{ ...inputSt, flex: 1 }}>
                        <option value="me">Untuk: saya</option>
                        {members.filter((m) => !m.is_me).map((m) => (
                            <option key={m.id} value={m.id}>Untuk: {m.display_name}</option>
                        ))}
                    </select>
                )}
            </div>
            <button style={primaryBtn(!name.trim() || busy)} onClick={handleCreate} disabled={!name.trim() || busy}>
                {busy ? "Membuat..." : "+ Buat Key"}
            </button>

            <div style={sectionLabel}>KEY AKTIF</div>
            {apiKeysLoading && <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 10 }}>Memuat...</div>}
            {!apiKeysLoading && apiKeys.filter((k) => !k.revoked_at).length === 0 && (
                <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 10 }}>Belum ada API key</div>
            )}
            {apiKeys.filter((k) => !k.revoked_at).map((k) => (
                <div key={k.id} style={rowCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{k.name}</span>
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 700 }}>{k.scope}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace" }}>
                        {k.key_prefix}… · {k.member.display_name}
                        {k.last_used_at ? ` · dipakai terakhir ${new Date(k.last_used_at).toLocaleDateString("id-ID")}` : " · belum pernah dipakai"}
                    </div>
                    <div style={{ marginTop: 4 }}>
                        {confirmRevoke === k.id ? (
                            <>
                                <button style={smallBtn(true)} onClick={() => handleRevoke(k.id)}>Yakin cabut?</button>
                                <button style={{ ...smallBtn(), marginLeft: 6 }} onClick={() => setConfirmRevoke(null)}>Batal</button>
                            </>
                        ) : (
                            <button style={smallBtn(true)} onClick={() => setConfirmRevoke(k.id)}>Cabut</button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
