import { useState } from "react";
import { useHousehold } from "../../auth/HouseholdProvider";
import { useHouseholdInfo } from "../../hooks/useHouseholdInfo";
import { useMembers } from "../../hooks/useMembers";
import { useInvitations } from "../../hooks/useInvitations";
import { useBeneficiaries } from "../../hooks/useBeneficiaries";

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
const toggleTrack = (on) => ({
    width: 36, height: 20, borderRadius: 999, padding: 2, cursor: "pointer", flexShrink: 0,
    background: on ? "var(--color-primary)" : "var(--color-border-soft)",
    border: "1px solid " + (on ? "transparent" : "var(--glass-border)"),
    transition: "background .15s", display: "flex", justifyContent: on ? "flex-end" : "flex-start",
});
const toggleThumb = { width: 14, height: 14, borderRadius: "50%", background: "#fff" };
const featureCard = {
    padding: "12px 12px", borderRadius: 12, background: "rgba(255,255,255,.03)",
    border: "1px solid var(--glass-border)", marginBottom: 10,
};

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
            const link = `${window.location.origin}${inv.accept_url}`;
            let copied = false;
            try {
                await navigator.clipboard.writeText(link);
                copied = true;
            } catch {
                copied = false;
            }
            toast?.(copied ? `✅ Link disalin: ${link}` : `✅ Undangan dibuat (gagal auto-copy): ${link}`);
        } catch (err) {
            toast?.(err.message || "Gagal membuat undangan", "error");
        } finally {
            setBusy(false);
        }
    };

    const copyInviteLink = async (inv) => {
        const link = `${window.location.origin}${inv.accept_url}`;
        try {
            await navigator.clipboard.writeText(link);
            toast?.(`✅ Link disalin: ${link}`);
        } catch {
            toast?.(`Link undangan: ${link}`);
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

    // Fitur opsional (10-fitur-opsional-keluarga.md §2.3): PATCH partial-merge per fitur, bukan
    // replace total — menyalakan beneficiary tidak menyentuh monthly_report/shopping_stock dkk.
    const [featureBusy, setFeatureBusy] = useState(null);
    const patchFeature = async (key, patch) => {
        setFeatureBusy(key);
        try {
            await updateHouseholdInfo({ features: { [key]: patch } });
        } catch (err) {
            toast?.(err.message || "Gagal mengubah fitur", "error");
        } finally {
            setFeatureBusy(null);
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
                    {household?.plan && (
                        <span style={{
                            fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                            background: household.plan.effective_tier === "lifetime"
                                ? "rgba(250,204,21,.15)"
                                : household.plan.effective_tier === "pro"
                                    ? "rgba(131,155,122,.18)"
                                    : "rgba(148,163,184,.12)",
                            color: household.plan.effective_tier === "lifetime"
                                ? "#facc15"
                                : household.plan.effective_tier === "pro"
                                    ? "var(--color-primary)"
                                    : "var(--color-muted)",
                            border: "1px solid currentColor",
                            textTransform: "uppercase", letterSpacing: 0.6,
                        }}>
                            {household.plan.effective_tier === "lifetime"
                                ? "👑 Lifetime"
                                : household.plan.effective_tier === "pro"
                                    ? "✨ Pro"
                                    : "Starter"}
                        </span>
                    )}
                    {isOwner && <span style={{ fontSize: 11, color: "var(--color-muted)" }}>✏️</span>}
                </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                <button style={{ ...smallBtn(), flex: 1, background: tab === "members" ? "var(--color-primary-soft)" : "var(--color-border-soft)" }} onClick={() => setTab("members")}>Anggota ({members.length})</button>
                {isOwner && (
                    <button style={{ ...smallBtn(), flex: 1, background: tab === "invite" ? "var(--color-primary-soft)" : "var(--color-border-soft)" }} onClick={() => setTab("invite")}>Undangan</button>
                )}
                <button style={{ ...smallBtn(), flex: 1, background: tab === "fitur" ? "var(--color-primary-soft)" : "var(--color-border-soft)" }} onClick={() => setTab("fitur")}>Fitur opsional</button>
                <button style={{ ...smallBtn(), flex: 1, background: tab === "plan" ? "var(--color-primary-soft)" : "var(--color-border-soft)" }} onClick={() => setTab("plan")}>👑 Paket</button>
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
                        <div key={inv.id} style={{ ...rowCard, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", color: "var(--color-text)" }}>{inv.code}</span>
                                <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{inv.role}</span>
                                <button style={smallBtn()} onClick={() => copyInviteLink(inv)}>Salin link</button>
                                <button style={smallBtn(true)} onClick={() => revokeInvitation(inv.id)}>Cabut</button>
                            </div>
                            <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-muted)", wordBreak: "break-all", userSelect: "all" }}>
                                {window.location.origin}{inv.accept_url}
                            </div>
                        </div>
                    ))}
                    {invitations.filter((i) => i.status === "pending").length === 0 && (
                        <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 10 }}>Belum ada undangan pending</div>
                    )}
                </div>
            )}

            {tab === "fitur" && (
                <FeaturesTab
                    features={household?.features}
                    plan={household?.plan}
                    isOwner={isOwner}
                    busy={featureBusy}
                    onPatch={patchFeature}
                    toast={toast}
                />
            )}

            {tab === "plan" && (
                <PlanTab plan={household?.plan} />
            )}
        </div>
    );
}

const PLAN_ENTITLEMENT_ITEMS = [
    { key: "api_access", icon: "🤖", label: "Integrasi Bot AI Telegram & WhatsApp", desc: "1 Household API Key untuk catat keuangan & struk via chat" },
    { key: "receipt_storage", icon: "🧾", label: "Cloud Storage Bukti Struk (WebP)", desc: "Simpan & lihat foto struk belanja langsung di daftar transaksi" },
    { key: "price_compare", icon: "⚖️", label: "Banding Harga & Diskon Antar Toko", desc: "Lacak harga termurah, harga asli sebelum diskon, & toko yang sering promo" },
    { key: "multi_member", icon: "💑", label: "Kolaborasi Pasangan & Akun Privat", desc: "Gabungkan pembukuan suami-istri dengan dukungan dompet Shared & 🔒 Privat" },
    { key: "shopping_stock", icon: "🛒", label: "Daftar Belanja & Stok Kulkas/Dapur", desc: "Otomatis coret daftar belanja & tambah stok rumah dari struk" },
    { key: "beneficiary", icon: "👶", label: "Atribusi Untuk Siapa (Beneficiary)", desc: "Pisahkan laporan pengeluaran untuk Anak, Orang Tua, atau Aset" },
    { key: "excel_export", icon: "📊", label: "Export Laporan Profesional (.xlsx 4-Sheet)", desc: "Unduh laporan keuangan bulanan rapi 4 tab siap cetak/audit" },
];

function PlanTab({ plan }) {
    if (!plan) return <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 10 }}>Memuat info paket...</div>;
    const tierLabel = plan.effective_tier === "lifetime"
        ? "👑 Lifetime Founder"
        : plan.effective_tier === "pro"
            ? "✨ Keluarga Berkembang Pro"
            : "🌱 Starter (Gratis)";
    return (
        <div style={{ marginTop: 10 }}>
            <div style={{
                ...featureCard,
                background: "linear-gradient(135deg, rgba(131,155,122,.14), rgba(79,195,247,.06))",
                border: "1px solid rgba(131,155,122,.35)",
            }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-primary)", letterSpacing: 1, textTransform: "uppercase" }}>
                    PAKET HOUSEHOLD AKTIF
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                    {tierLabel}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4, lineHeight: 1.45 }}>
                    {plan.effective_tier === "lifetime"
                        ? "Seluruh fitur pintar, kolaborasi keluarga, dan penyimpanan bukti struk aktif permanen tanpa batas waktu."
                        : plan.expires_at
                            ? `Aktif hingga ${new Date(plan.expires_at).toLocaleDateString("id-ID")}.`
                            : "Seluruh fitur keluarga & integrasi AI aktif untuk household ini."}
                </div>
            </div>

            <div style={sectionLabel}>Hak Akses Fitur (Entitlements)</div>
            {PLAN_ENTITLEMENT_ITEMS.map((item) => {
                const unlocked = plan.entitlements?.[item.key] !== false;
                return (
                    <div key={item.key} style={{ ...rowCard, alignItems: "flex-start", padding: "10px 12px" }}>
                        <span style={{ fontSize: 16, lineHeight: 1.2 }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{item.label}</div>
                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>{item.desc}</div>
                        </div>
                        <span style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, flexShrink: 0,
                            background: unlocked ? "rgba(131,155,122,.16)" : "rgba(255,113,108,.12)",
                            color: unlocked ? "var(--color-primary)" : "#ff716c",
                        }}>
                            {unlocked ? "✓ Aktif" : "🔒 Pro"}
                        </span>
                    </div>
                );
            })}

            <div style={{
                ...featureCard,
                marginTop: 14,
                background: "var(--color-primary-soft)",
                border: "1px solid var(--glass-border)",
                padding: "14px 14px",
            }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", marginBottom: 6 }}>
                    🤖 Ingin Catat Otomatis dari Grup WhatsApp & Foto Struk?
                </div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: 12 }}>
                    Pencatatan manual di Web dan aplikasi Android <strong>Gratis Selamanya (Rp 0)</strong>. Jika malas ketik satu per satu, aktifkan Asisten Grup WA suami-istri & baca foto struk belanja otomatis mulai <strong>Rp 9.000</strong> (Paket Sachet 7 hari) atau <strong>Rp 29.000/bulan</strong> (Paket Lengkap Grup WA).
                </div>
                <a
                    href="https://t.me/KelolaKeluargaBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "100%", boxSizing: "border-box", minHeight: 40, padding: "9px 12px",
                        borderRadius: 10, background: "var(--color-primary)", color: "var(--color-on-primary)",
                        fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center",
                    }}
                >
                    Buka @KelolaKeluargaBot di Telegram
                </a>
            </div>
        </div>
    );
}

function Toggle({ on, disabled, onClick }) {
    return (
        <div
            role="switch" aria-checked={on}
            onClick={disabled ? undefined : onClick}
            style={{ ...toggleTrack(on), opacity: disabled ? .5 : 1, cursor: disabled ? "default" : "pointer" }}
        >
            <div style={toggleThumb} />
        </div>
    );
}

const fieldLabel = { fontSize: 11, color: "var(--color-muted)", marginBottom: 4, display: "block" };
const miniInputSt = { ...inputSt, padding: "6px 8px", fontSize: 12 };

const BENEFICIARY_KINDS = [
    { v: "child", l: "👶 Anak", icon: "👶" },
    { v: "relative", l: "👵 Ortu/Kerabat", icon: "👵" },
    { v: "property", l: "🏠 Aset/Properti", icon: "🏠" },
    { v: "other", l: "✨ Lainnya", icon: "✨" },
];

/**
 * Tab "Fitur opsional" (10-fitur-opsional-keluarga.md §2.3): toggle per-fitur, PARTIAL merge
 * (setiap onPatch hanya mengirim satu fitur, backend menjaga yang lain tidak ikut berubah).
 * `reconciliation` (F-C) SENGAJA tidak ditampilkan — belum ada implementasinya sama sekali
 * (backend-nya pun belum dibangun, lihat PROGRESS.md), jadi toggle untuk itu hanya akan membingungkan.
 * Teks di tab ini (dan BelanjaView/PantryView) sengaja hardcode Bahasa Indonesia, BUKAN lewat t() —
 * mengikuti pola HouseholdPanel/ApiKeysPanel yang sudah ada (i18n 6 bahasa untuk UI household/fitur
 * baru dicatat sebagai utang teknis di PROGRESS.md, bukan konvensi baru yang disengaja di sini).
 */
function FeaturesTab({ features, plan, isOwner, busy, onPatch, toast }) {
    const ben = features?.beneficiary ?? { enabled: false };
    const { beneficiaries, addBeneficiary, deleteBeneficiary } = useBeneficiaries(
        !!ben.enabled && plan?.entitlements?.beneficiary !== false,
    );
    const [newBenName, setNewBenName] = useState("");
    const [newBenKind, setNewBenKind] = useState("child");
    const [benBusy, setBenBusy] = useState(false);

    if (!features) return <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 10 }}>Memuat...</div>;

    const report = features.monthly_report ?? { enabled: false, day: 1, hour: 8, channel: "both" };
    const recon = features.reconciliation ?? { enabled: false };
    const stock = features.shopping_stock ?? {
        enabled: false,
        auto_stock: { enabled: false, create_new_items: true },
        expiry_reminder: { enabled: false, hour: 7, days_before: 2 },
    };
    const autoStock = stock.auto_stock ?? { enabled: false, create_new_items: true };
    const expiry = stock.expiry_reminder ?? { enabled: false, hour: 7, days_before: 2 };

    const handleAddBen = async () => {
        const trimmed = newBenName.trim();
        if (!trimmed || benBusy) return;
        setBenBusy(true);
        try {
            const kMeta = BENEFICIARY_KINDS.find(k => k.v === newBenKind);
            await addBeneficiary({ name: trimmed, kind: newBenKind, icon: kMeta?.icon });
            setNewBenName("");
            toast?.(`✅ "${trimmed}" ditambahkan ke daftar penerima`);
        } catch (err) {
            toast?.(err.message || "Gagal menambah penerima", "error");
        } finally {
            setBenBusy(false);
        }
    };

    const handleDeleteBen = async (b) => {
        if (benBusy) return;
        setBenBusy(true);
        try {
            await deleteBeneficiary(b.id);
            toast?.(`Penerima "${b.name}" dihapus`);
        } catch (err) {
            toast?.(err.message || "Gagal menghapus penerima", "error");
        } finally {
            setBenBusy(false);
        }
    };

    return (
        <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                Fitur tambahan di luar keuangan inti. Mati = tidak ada yang berubah dari biasanya.
                {!isOwner && " Hanya owner yang bisa mengubah."}
            </div>

            <div style={featureCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>👪 Untuk siapa (beneficiary)</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>Catat pengeluaran untuk anak, orang tua, dst. Bisa dilihat per penerima di Laporan & Evaluasi.</div>
                    </div>
                    <Toggle on={ben.enabled} disabled={!isOwner || busy === "beneficiary"} onClick={() => onPatch("beneficiary", { enabled: !ben.enabled })} />
                </div>

                {ben.enabled && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--glass-border)" }}>
                        <label style={fieldLabel}>Daftar Penerima ({beneficiaries.length})</label>
                        {beneficiaries.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                {beneficiaries.map((b) => (
                                    <span key={b.id} style={{
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        padding: "4px 9px", borderRadius: 99,
                                        background: "var(--color-primary-soft)",
                                        border: "1px solid var(--glass-border)",
                                        fontSize: 11, fontWeight: 700, color: "var(--color-text)",
                                    }}>
                                        <span>{b.icon || "👤"} {b.name}</span>
                                        <button
                                            onClick={() => handleDeleteBen(b)}
                                            disabled={benBusy}
                                            title={`Hapus ${b.name}`}
                                            style={{
                                                background: "none", border: "none", padding: 0,
                                                color: "var(--color-muted)", cursor: "pointer", fontSize: 11, lineHeight: 1,
                                            }}
                                        >✕</button>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 8 }}>
                                Belum ada nama penerima (contoh: Adik, Kakak, Ibu, Mobil). Tambahkan di bawah:
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <select
                                value={newBenKind}
                                onChange={(e) => setNewBenKind(e.target.value)}
                                style={{ ...miniInputSt, width: "auto", flex: "0 0 auto" }}
                            >
                                {BENEFICIARY_KINDS.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
                            </select>
                            <input
                                value={newBenName}
                                onChange={(e) => setNewBenName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddBen()}
                                placeholder="Nama (mis. Kakak Dinda)..."
                                style={{ ...miniInputSt, flex: 1, minWidth: 110 }}
                            />
                            <button
                                style={smallBtn()}
                                onClick={handleAddBen}
                                disabled={!newBenName.trim() || benBusy}
                            >+ Tambah</button>
                        </div>
                    </div>
                )}
            </div>

            <div style={featureCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>📊 Laporan bulanan otomatis</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>Hermes kirim ringkasan ke chat tiap bulan (perlu Hermes dikonfigurasi terpisah).</div>
                    </div>
                    <Toggle on={report.enabled} disabled={!isOwner || busy === "monthly_report"} onClick={() => onPatch("monthly_report", { enabled: !report.enabled })} />
                </div>
                {report.enabled && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <div style={{ flex: 1 }}>
                            <label style={fieldLabel}>Tanggal kirim</label>
                            <select disabled={!isOwner || busy === "monthly_report"} style={miniInputSt} value={report.day} onChange={(e) => onPatch("monthly_report", { day: Number(e.target.value) })}>
                                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={fieldLabel}>Jam (WIB)</label>
                            <select disabled={!isOwner || busy === "monthly_report"} style={miniInputSt} value={report.hour} onChange={(e) => onPatch("monthly_report", { hour: Number(e.target.value) })}>
                                {Array.from({ length: 24 }, (_, i) => i).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={fieldLabel}>Kanal</label>
                            <select disabled={!isOwner || busy === "monthly_report"} style={miniInputSt} value={report.channel} onChange={(e) => onPatch("monthly_report", { channel: e.target.value })}>
                                <option value="both">Telegram + WA</option>
                                <option value="telegram">Telegram</option>
                                <option value="whatsapp">WhatsApp</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <div style={featureCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>🛒 Belanja & Stok</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>Daftar belanja + stok rumah (kulkas/freezer/lemari). Menu "Rumah" muncul di sidebar saat aktif.</div>
                    </div>
                    <Toggle on={stock.enabled} disabled={!isOwner || busy === "shopping_stock"} onClick={() => onPatch("shopping_stock", { enabled: !stock.enabled })} />
                </div>
                {stock.enabled && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--glass-border)" }}>
                        {/* Auto-Stok dari Transaksi Belanja */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: autoStock.enabled ? 8 : 10 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>🍗 Auto-Stok dari Transaksi Belanja</div>
                                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                                    Belanja bahan makanan (ayam, sayur, telur, bumbu) otomatis masuk ke Stok Rumah.
                                </div>
                            </div>
                            <Toggle
                                on={!!autoStock.enabled}
                                disabled={!isOwner || busy === "shopping_stock"}
                                onClick={() =>
                                    onPatch("shopping_stock", {
                                        auto_stock: { ...autoStock, enabled: !autoStock.enabled },
                                    })
                                }
                            />
                        </div>
                        {autoStock.enabled && (
                            <div style={{ marginBottom: 12 }}>
                                <label style={fieldLabel}>Mode penambahan stok otomatis</label>
                                <select
                                    disabled={!isOwner || busy === "shopping_stock"}
                                    style={miniInputSt}
                                    value={autoStock.create_new_items !== false ? "all" : "existing_only"}
                                    onChange={(e) =>
                                        onPatch("shopping_stock", {
                                            auto_stock: {
                                                ...autoStock,
                                                create_new_items: e.target.value === "all",
                                            },
                                        })
                                    }
                                >
                                    <option value="all">Otomatis Penuh (Buat item baru + tebak lokasi kulkas/freezer)</option>
                                    <option value="existing_only">Hanya Barang yang Sudah Terdaftar di Stok</option>
                                </select>
                            </div>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8, borderTop: "1px solid var(--glass-border)" }}>
                            <div style={{ flex: 1, fontSize: 12, color: "var(--color-text)" }}>Pengingat kedaluwarsa harian</div>
                            <Toggle
                                on={expiry.enabled} disabled={!isOwner || busy === "shopping_stock"}
                                onClick={() => onPatch("shopping_stock", { expiry_reminder: { ...expiry, enabled: !expiry.enabled } })}
                            />
                        </div>
                        {expiry.enabled && (
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={fieldLabel}>Jam (WIB)</label>
                                    <select disabled={!isOwner || busy === "shopping_stock"} style={miniInputSt} value={expiry.hour} onChange={(e) => onPatch("shopping_stock", { expiry_reminder: { ...expiry, hour: Number(e.target.value) } })}>
                                        {Array.from({ length: 24 }, (_, i) => i).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={fieldLabel}>Ingatkan (hari sebelum)</label>
                                    <select disabled={!isOwner || busy === "shopping_stock"} style={miniInputSt} value={expiry.days_before} onChange={(e) => onPatch("shopping_stock", { expiry_reminder: { ...expiry, days_before: Number(e.target.value) } })}>
                                        {[0, 1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} hari</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={featureCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>🔍 Cek Mutasi Bank (Rekonsiliasi Akhir Bulan)</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                            Cocokkan CSV atau screenshot mutasi BCA, BRI, Mandiri, & GoPay untuk menemukan transaksi yang lupa dicatat. Menu "Cek Mutasi Bank" muncul di sidebar saat aktif.
                        </div>
                    </div>
                    <Toggle
                        on={!!recon.enabled}
                        disabled={!isOwner || busy === "reconciliation"}
                        onClick={() => onPatch("reconciliation", { enabled: !recon.enabled })}
                    />
                </div>
            </div>
        </div>
    );
}
