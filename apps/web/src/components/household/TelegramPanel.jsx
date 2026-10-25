import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "../../auth/HouseholdProvider";
import { useHouseholdInfo } from "../../hooks/useHouseholdInfo";
import { useMembers } from "../../hooks/useMembers";
import { useApiKeys } from "../../hooks/useApiKeys";

const DIRECT_TG_BASE = "https://9router.cortex-ai.my.id";
const DIRECT_TG_TOKEN = "kb-wa-bridge-internal-2026-v1";

const backBtn = {
    background: "none",
    border: "none",
    color: "var(--color-primary)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    marginBottom: 12,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
};

const sectionLabel = {
    fontSize: 10,
    fontWeight: 800,
    color: "var(--color-muted)",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
};

const cardBox = {
    padding: "13px 14px",
    borderRadius: 14,
    background: "var(--bg-surface-low)",
    border: "1px solid var(--glass-border)",
    marginBottom: 12,
};

const inputSt = {
    width: "100%",
    padding: "9px 11px",
    background: "var(--bg-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    color: "var(--color-text)",
    fontSize: 12.5,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
};

const ROLE_PRESETS = [
    { id: "Ayah", label: "👨 Suami / Ayah" },
    { id: "Ibu", label: "👩 Istri / Ibu" },
];

export default function TelegramPanel({ onBack, showToast, aiKey = "", onOpenAiSettings }) {
    const { activeHouseholdId, activeMember } = useHousehold();
    const { household } = useHouseholdInfo();
    const { members } = useMembers();
    const { createApiKey } = useApiKeys();
    const isOwner = activeMember?.role === "owner";

    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyAction, setBusyAction] = useState("");

    const [selectedRole, setSelectedRole] = useState("Ayah");
    const [selectedMemberId, setSelectedMemberId] = useState("me");
    const [generatedPair, setGeneratedPair] = useState(null);

    const toast = useCallback((msg, type) => showToast?.(msg, type), [showToast]);

    const callTgEndpoint = useCallback(
        async (path, method = "GET", bodyObj = null) => {
            if (!activeHouseholdId) throw new Error("Household belum aktif");
            const url = new URL(path, DIRECT_TG_BASE);
            url.searchParams.set("household_id", activeHouseholdId);
            const trimmedKey = (aiKey || "").trim();

            const resp = await fetch(url.toString(), {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "X-WA-Internal-Token": DIRECT_TG_TOKEN,
                    "X-Household-Id": activeHouseholdId,
                    ...(trimmedKey.startsWith("sk-kb-") ? { "X-AI-Api-Key": trimmedKey } : {}),
                },
                ...(method === "POST"
                    ? {
                          body: JSON.stringify({
                              household_id: activeHouseholdId,
                              ...(trimmedKey.startsWith("sk-kb-") ? { ai_api_key: trimmedKey } : {}),
                              ...(bodyObj || {}),
                          }),
                      }
                    : {}),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data?.ok === false) {
                throw new Error(data?.error || `Gagal menghubungi server Telegram (${resp.status})`);
            }
            return data;
        },
        [activeHouseholdId]
    );

    const fetchStatus = useCallback(
        async (silent = false) => {
            if (!activeHouseholdId) return;
            if (!silent) {
                setLoading(true);
                setError("");
            }
            try {
                const data = await callTgEndpoint("/v1/telegram/status", "GET");
                setStatusData(data);
            } catch (err) {
                if (!silent) setError(err.message || "Gagal memuat status Telegram");
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [activeHouseholdId, callTgEndpoint]
    );

    useEffect(() => {
        fetchStatus(false);
    }, [activeHouseholdId, fetchStatus]);

    // Auto-poll every 3.5s while a pairing link is displayed so the user sees it turn green immediately
    useEffect(() => {
        if (!generatedPair) return undefined;
        const timer = setInterval(() => {
            fetchStatus(true);
        }, 3500);
        return () => clearInterval(timer);
    }, [generatedPair, fetchStatus]);

    // Sync aiKey automatically if user already has an sk-kb-* key
    useEffect(() => {
        const trimmed = (aiKey || "").trim();
        if (!activeHouseholdId || !trimmed.startsWith("sk-kb-")) return;
        callTgEndpoint("/v1/telegram/sync-ai-key", "POST", { ai_api_key: trimmed }).catch(() => {});
    }, [activeHouseholdId, aiKey, callTgEndpoint]);

    const handleCreatePairLink = async (mode = "private") => {
        if (busyAction) return;
        setBusyAction(mode);
        setError("");
        try {
            const roleLabel = mode === "group" ? "Grup Suami-Istri" : selectedRole;
            const keyName = `Telegram - ${roleLabel} (${new Date().toLocaleDateString("id-ID")})`;
            const { secret } = await createApiKey({
                name: keyName,
                scope: "write",
                member: isOwner ? selectedMemberId : "me",
            });

            const pairRes = await callTgEndpoint("/v1/telegram/pair-init", "POST", {
                household_name: household?.name || "Keluarga",
                member_id: selectedMemberId === "me" ? activeMember?.id || "" : selectedMemberId,
                member_role: selectedRole,
                karaya_api_key: secret,
                ai_api_key: (aiKey || "").trim(),
            });

            setGeneratedPair({ ...pairRes, mode });

            if (mode === "private") {
                window.open(pairRes.private_url, "_blank", "noopener,noreferrer");
                toast("Membuka @KelolaKeluargaBot — klik Start di Telegram!");
            } else if (mode === "group") {
                window.open(pairRes.group_url, "_blank", "noopener,noreferrer");
                toast("Pilih Grup Telegram Suami-Istri Anda di Telegram!");
            } else if (mode === "spouse") {
                await navigator.clipboard.writeText(pairRes.private_url).catch(() => {});
                toast("✅ Link undangan pasangan berhasil dibuat & disalin!");
            }
        } catch (err) {
            setError(err.message || "Gagal membuat link penghubung Telegram");
            toast(err.message || "Gagal membuat link Telegram", "error");
        } finally {
            setBusyAction("");
        }
    };

    const handleDisconnect = async (chatId, title) => {
        setBusyAction(`del:${chatId}`);
        try {
            await callTgEndpoint("/v1/telegram/disconnect", "POST", { chat_id: String(chatId) });
            toast(`Koneksi ${title || chatId} diputus`);
            fetchStatus(true);
        } catch (err) {
            toast(err.message || "Gagal memutuskan koneksi", "error");
        } finally {
            setBusyAction("");
        }
    };

    const links = statusData?.links || [];
    const botUsername = statusData?.bot_username || "KelolaKeluargaBot";

    return (
        <div>
            <button style={backBtn} onClick={onBack}>
                ← Kembali ke Menu Profil
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)" }}>
                    ✈️ Bot Telegram Suami-Istri
                </div>
                <span
                    style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 99,
                        background: links.length > 0 ? "rgba(16,185,129,.16)" : "var(--color-border-soft)",
                        color: links.length > 0 ? "#10b981" : "var(--color-muted)",
                    }}
                >
                    {links.length > 0 ? `${links.length} Terhubung` : "Belum Terhubung"}
                </span>
            </div>

            <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: 12 }}>
                Hubungkan buku keuangan keluarga Anda ke bot resmi{" "}
                <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--color-primary)", fontWeight: 700, textDecoration: "none" }}
                >
                    @{botUsername}
                </a>{" "}
                dalam 1 klik. Suami & Istri bisa mencatat pengeluaran atau kirim foto struk lewat{" "}
                <strong>chat pribadi masing-masing</strong> maupun di <strong>1 Grup Telegram berdua</strong>!
            </div>

            {error && (
                <div
                    style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(239,68,68,.12)",
                        border: "1px solid rgba(239,68,68,.3)",
                        color: "#f87171",
                        fontSize: 12,
                        marginBottom: 12,
                    }}
                >
                    ⚠️ {error}
                </div>
            )}

            {/* ── Langkah 1: Hubungkan Sekarang (atau Paywall jika belum berlangganan) ── */}
            {!loading && statusData && statusData.entitled === false ? (
                <div
                    style={{
                        ...cardBox,
                        border: "1.5px solid rgba(212,157,63,.45)",
                        background: "linear-gradient(145deg, rgba(212,157,63,.12), rgba(212,157,63,.04))",
                        padding: "16px 14px",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>🔒</span>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--color-text)" }}>
                            Fitur Khusus Paket Asisten AI (Mulai Rp 9.000)
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: 12 }}>
                        Akun gratis dapat menggunakan seluruh fitur pencatatan mandiri di Web Keuangan sepuasnya. Untuk
                        menghubungkan <strong>Bot Telegram Suami-Istri (@{botUsername})</strong> serta fitur{" "}
                        <strong>Scan Foto Struk Belanja AI</strong>, silakan aktifkan Paket Asisten AI terlebih dahulu:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <a
                            href="https://keluargaberkembang.com/#paket"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "block",
                                textAlign: "center",
                                padding: "11px 14px",
                                borderRadius: 10,
                                background: "var(--color-primary)",
                                color: "var(--color-on-primary)",
                                fontSize: 12.5,
                                fontWeight: 800,
                                textDecoration: "none",
                            }}
                        >
                            🛒 Pilih Paket Asisten AI (Mulai Rp 9.000 / 7 Hari)
                        </a>
                    </div>
                </div>
            ) : (
                <>
                    <div style={sectionLabel}>1. PILIH PERAN & HUBUNGKAN</div>
                    <div style={cardBox}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
                            Siapa yang akan dihubungkan?
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                            {ROLE_PRESETS.map((r) => {
                                const active = selectedRole === r.id;
                                return (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setSelectedRole(r.id)}
                                        style={{
                                            padding: "8px 10px",
                                            borderRadius: 10,
                                            border: active
                                                ? "1.5px solid var(--color-primary)"
                                                : "1px solid var(--color-border)",
                                            background: active ? "var(--color-primary-soft)" : "var(--bg-surface)",
                                            color: active ? "var(--color-primary)" : "var(--color-text)",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        {r.label}
                                    </button>
                                );
                            })}
                        </div>

                        {isOwner && members && members.length > 1 && (
                            <div style={{ marginBottom: 10 }}>
                                <select
                                    value={selectedMemberId}
                                    onChange={(e) => setSelectedMemberId(e.target.value)}
                                    style={inputSt}
                                >
                                    <option value="me">Akun Anggota: Saya ({activeMember?.display_name || "Owner"})</option>
                                    {members
                                        .filter((m) => !m.is_me)
                                        .map((m) => (
                                            <option key={m.id} value={m.id}>
                                                Akun Anggota: {m.display_name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button
                                type="button"
                                disabled={!!busyAction || loading}
                                onClick={() => handleCreatePairLink("private")}
                                style={{
                                    width: "100%",
                                    padding: "11px 14px",
                                    borderRadius: 10,
                                    border: "none",
                                    background: "var(--color-primary)",
                                    color: "var(--color-on-primary)",
                                    fontSize: 12.5,
                                    fontWeight: 800,
                                    cursor: busyAction || loading ? "wait" : "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                {busyAction === "private"
                                    ? "⏳ Menyiapkan Koneksi..."
                                    : `✈️ Hubungkan Telegram Saya (${selectedRole})`}
                            </button>

                            <button
                                type="button"
                                disabled={!!busyAction || loading}
                                onClick={() => handleCreatePairLink("spouse")}
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid var(--color-border)",
                                    background: "var(--bg-surface)",
                                    color: "var(--color-text)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: busyAction || loading ? "wait" : "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                {busyAction === "spouse"
                                    ? "⏳ Membuat Link..."
                                    : `💌 Buat Link Undangan untuk HP ${selectedRole}`}
                            </button>

                            <button
                                type="button"
                                disabled={!!busyAction || loading}
                                onClick={() => handleCreatePairLink("group")}
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid var(--color-primary)",
                                    background: "var(--color-primary-soft)",
                                    color: "var(--color-primary)",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    cursor: busyAction || loading ? "wait" : "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                {busyAction === "group"
                                    ? "⏳ Menyiapkan Grup..."
                                    : "👨‍👩‍👧 Masukkan Bot ke Grup Telegram Suami-Istri"}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Hasil Link / Kode Pairing ── */}
            {generatedPair && (
                <div
                    style={{
                        ...cardBox,
                        border: "1.5px solid var(--color-primary)",
                        background: "var(--color-primary-soft)",
                    }}
                >
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-primary)", marginBottom: 6 }}>
                        ✅ Tautan Penghubung Siap ({generatedPair.member_role})
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--color-text)", lineHeight: 1.5, marginBottom: 8 }}>
                        {generatedPair.mode === "group" ? (
                            <>
                                Klik tombol di bawah untuk memilih <strong>Grup Telegram Suami-Istri</strong> Anda,
                                atau ketik perintah <code>{generatedPair.manual_command}</code> di dalam grup Telegram
                                yang sudah ada <strong>@{botUsername}</strong>:
                            </>
                        ) : (
                            <>
                                Kirim tautan di bawah ini ke HP <strong>{generatedPair.member_role}</strong>, lalu klik{" "}
                                <strong>Start</strong> di aplikasi Telegram:
                            </>
                        )}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            fontFamily: "monospace",
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(0,0,0,.18)",
                            color: "var(--color-text)",
                            wordBreak: "break-all",
                            marginBottom: 8,
                            userSelect: "all",
                        }}
                    >
                        {generatedPair.mode === "group" ? generatedPair.manual_command : generatedPair.private_url}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <a
                            href={generatedPair.mode === "group" ? generatedPair.group_url : generatedPair.private_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                flex: 1,
                                textAlign: "center",
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: "var(--color-primary)",
                                color: "var(--color-on-primary)",
                                fontSize: 11.5,
                                fontWeight: 700,
                                textDecoration: "none",
                            }}
                        >
                            🚀 Buka di Telegram
                        </a>
                        <button
                            type="button"
                            onClick={async () => {
                                const textToCopy =
                                    generatedPair.mode === "group"
                                        ? generatedPair.manual_command
                                        : generatedPair.private_url;
                                await navigator.clipboard.writeText(textToCopy).catch(() => {});
                                toast("✅ Disalin ke clipboard!");
                            }}
                            style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: "1px solid var(--glass-border)",
                                background: "var(--bg-surface)",
                                color: "var(--color-text)",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            📋 Salin
                        </button>
                    </div>
                </div>
            )}

            {/* ── Daftar Akun & Grup Telegram yang Terhubung ── */}
            <div style={sectionLabel}>2. TELEGRAM YANG SUDAH TERHUBUNG</div>
            {loading ? (
                <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: 14 }}>
                    Memuat status koneksi...
                </div>
            ) : links.length === 0 ? (
                <div
                    style={{
                        ...cardBox,
                        textAlign: "center",
                        color: "var(--color-muted)",
                        fontSize: 12,
                        padding: "16px 12px",
                    }}
                >
                    Belum ada akun atau grup Telegram yang terhubung. Klik salah satu tombol di atas untuk mulai!
                </div>
            ) : (
                links.map((item) => {
                    const isGroup = item.chat_type === "group";
                    return (
                        <div
                            key={item.chat_id}
                            style={{
                                ...cardBox,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                marginBottom: 8,
                            }}
                        >
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                    <span style={{ fontSize: 14 }}>{isGroup ? "👨‍👩‍👧" : "✈️"}</span>
                                    <span
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 800,
                                            color: "var(--color-text)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {item.chat_title || item.chat_id}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: "2px 7px",
                                            borderRadius: 99,
                                            background: "var(--color-primary-soft)",
                                            color: "var(--color-primary)",
                                        }}
                                    >
                                        {item.member_role}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                                    {item.tg_username ? `@${item.tg_username} · ` : ""}
                                    {item.ai_key_masked ? "🟢 Asisten AI Aktif" : "🟡 Paket AI Belum Aktif"}
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={busyAction === `del:${item.chat_id}`}
                                onClick={() => handleDisconnect(item.chat_id, item.chat_title)}
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,113,108,.3)",
                                    background: "rgba(255,113,108,.08)",
                                    color: "#ff716c",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                Putuskan
                            </button>
                        </div>
                    );
                })
            )}
        </div>
    );
}
