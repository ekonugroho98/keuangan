import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "../../auth/HouseholdProvider";
import { api } from "../../api/client";

const DIRECT_WA_BASE = "https://9router.cortex-ai.my.id";
const DIRECT_WA_TOKEN = "kb-wa-bridge-internal-2026-v1";

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

export default function WhatsAppPanel({ onBack, showToast }) {
    const { activeHouseholdId, activeMember } = useHousehold();
    const isOwner = activeMember?.role === "owner";

    const [target, setTarget] = useState("");
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [pairingBusy, setPairingBusy] = useState(false);
    const [savingGroups, setSavingGroups] = useState(false);
    const [disconnectBusy, setDisconnectBusy] = useState(false);

    const [selectedGroups, setSelectedGroups] = useState([]);
    const [requireMention, setRequireMention] = useState(false);
    const [groupSearch, setGroupSearch] = useState("");
    const [customJid, setCustomJid] = useState("");
    const [dirtyGroups, setDirtyGroups] = useState(false);

    const toast = useCallback((msg, type) => showToast?.(msg, type), [showToast]);

    const callWaEndpoint = useCallback(
        async (path, method = "GET", bodyObj = null, queryTarget = "") => {
            if (!activeHouseholdId) throw new Error("Household belum aktif");
            const effectiveTarget = queryTarget || target || undefined;

            // Try Karaya API first, fallback directly to VPS Gatekeeper WA Controller
            try {
                if (method === "GET") {
                    const res = await api.GET(path, {
                        params: { query: effectiveTarget ? { target: effectiveTarget } : {} },
                    });
                    if (res?.data?.ok) return res.data;
                } else {
                    const res = await api.POST(path, {
                        body: { ...(bodyObj || {}), ...(effectiveTarget ? { target: effectiveTarget } : {}) },
                    });
                    if (res?.data?.ok) return res.data;
                }
            } catch {
                // Fallback to direct HTTPS endpoint on 9router.cortex-ai.my.id
            }

            const url = new URL(path, DIRECT_WA_BASE);
            url.searchParams.set("household_id", activeHouseholdId);
            if (effectiveTarget) url.searchParams.set("target", effectiveTarget);

            const resp = await fetch(url.toString(), {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "X-WA-Internal-Token": DIRECT_WA_TOKEN,
                    "X-Household-Id": activeHouseholdId,
                },
                ...(method === "POST"
                    ? {
                          body: JSON.stringify({
                              household_id: activeHouseholdId,
                              ...(effectiveTarget ? { target: effectiveTarget } : {}),
                              ...(bodyObj || {}),
                          }),
                      }
                    : {}),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data?.ok === false) {
                throw new Error(data?.error || `Gagal menghubungi server WhatsApp (${resp.status})`);
            }
            return data;
        },
        [activeHouseholdId, target]
    );

    const fetchStatus = useCallback(
        async (silent = false, overrideTarget = "") => {
            if (!activeHouseholdId) return;
            if (!silent) {
                setLoading(true);
                setError("");
            }
            try {
                const data = await callWaEndpoint("/v1/whatsapp/status", "GET", null, overrideTarget);
                setStatusData(data);
                if (!target && data.target) {
                    setTarget(data.target);
                }
                if (!dirtyGroups || !silent) {
                    setSelectedGroups(data.allowed_groups || []);
                    setRequireMention(Boolean(data.security?.require_mention));
                }
            } catch (err) {
                if (!silent) setError(err.message || "Gagal memuat status WhatsApp");
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [activeHouseholdId, callWaEndpoint, dirtyGroups, target]
    );

    useEffect(() => {
        fetchStatus(false);
    }, [activeHouseholdId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-poll every 2.2s while pairing is active (starting / qr / connected_saving)
    const pairingState = statusData?.pairing?.state || "idle";
    const isPairingActive = ["starting", "qr", "connected_saving"].includes(pairingState);

    useEffect(() => {
        if (!isPairingActive) return;
        const timer = setInterval(async () => {
            try {
                const data = await callWaEndpoint("/v1/whatsapp/status", "GET");
                const prevState = statusData?.pairing?.state;
                setStatusData(data);
                if (data?.pairing?.state === "connected" && prevState !== "connected") {
                    toast("✅ WhatsApp berhasil tertaut ke Hermes!");
                    setSelectedGroups(data.allowed_groups || []);
                    setDirtyGroups(false);
                }
            } catch {
                // ignore transient poll error
            }
        }, 2200);
        return () => clearInterval(timer);
    }, [isPairingActive, callWaEndpoint, statusData?.pairing?.state, toast]);

    const handleSwitchTarget = async (newTarget) => {
        setTarget(newTarget);
        setDirtyGroups(false);
        await fetchStatus(false, newTarget);
    };

    const handleStartPairing = async () => {
        if (pairingBusy) return;
        setPairingBusy(true);
        setError("");
        try {
            const res = await callWaEndpoint("/v1/whatsapp/pair/start", "POST", {});
            setStatusData((prev) => (prev ? { ...prev, pairing: res.pairing } : prev));
            await fetchStatus(true);
        } catch (err) {
            toast(err.message || "Gagal memulai sesi QR WhatsApp", "error");
        } finally {
            setPairingBusy(false);
        }
    };

    const handleCancelPairing = async () => {
        try {
            await callWaEndpoint("/v1/whatsapp/pair/cancel", "POST", {});
            await fetchStatus(true);
        } catch (err) {
            toast(err.message || "Gagal membatalkan pairing", "error");
        }
    };

    const handleDisconnect = async () => {
        if (disconnectBusy) return;
        if (!window.confirm("Putuskan koneksi nomor WhatsApp dari bot Hermes sekarang?")) return;
        setDisconnectBusy(true);
        try {
            const data = await callWaEndpoint("/v1/whatsapp/disconnect", "POST", {});
            setStatusData(data);
            toast("Koneksi WhatsApp telah diputuskan");
        } catch (err) {
            toast(err.message || "Gagal memutuskan WhatsApp", "error");
        } finally {
            setDisconnectBusy(false);
        }
    };

    const toggleGroupSelection = (jid) => {
        if (!isOwner) return;
        setDirtyGroups(true);
        setSelectedGroups((prev) =>
            prev.includes(jid) ? prev.filter((x) => x !== jid) : [...prev, jid]
        );
    };

    const handleAddCustomGroup = () => {
        const raw = customJid.trim();
        if (!raw) return;
        const formatted = raw.endsWith("@g.us") ? raw : `${raw.replace(/[^0-9-]/g, "")}@g.us`;
        if (!formatted || formatted === "@g.us") {
            toast("Masukkan ID Grup yang valid (contoh: 120363413119495028@g.us)", "error");
            return;
        }
        if (!selectedGroups.includes(formatted)) {
            setSelectedGroups((prev) => [...prev, formatted]);
            setDirtyGroups(true);
        }
        setCustomJid("");
    };

    const handleSaveGroups = async () => {
        if (savingGroups || !isOwner) return;
        setSavingGroups(true);
        try {
            const data = await callWaEndpoint("/v1/whatsapp/groups", "POST", {
                allowed_groups: selectedGroups,
                require_mention: requireMention,
            });
            setStatusData(data);
            setSelectedGroups(data.allowed_groups || []);
            setDirtyGroups(false);
            toast("✅ Pengaturan Grup WhatsApp disimpan & aktif");
        } catch (err) {
            toast(err.message || "Gagal menyimpan grup WhatsApp", "error");
        } finally {
            setSavingGroups(false);
        }
    };

    const availableTargets = statusData?.available_targets || [];
    const paired = Boolean(statusData?.paired);
    const bridgeStatus = statusData?.bridge_status || "stopped";
    const account = statusData?.account;
    const pairing = statusData?.pairing || { state: "idle" };

    // Merge known groups with any custom selected JIDs
    const allGroups = (() => {
        const base = Array.isArray(statusData?.groups) ? [...statusData.groups] : [];
        const seen = new Set(base.map((g) => g.jid));
        for (const jid of selectedGroups) {
            if (!seen.has(jid)) {
                base.push({ jid, name: jid.replace("@g.us", ""), participants_count: 0, allowed: true });
                seen.add(jid);
            }
        }
        // Filter out nameless 0-member newsletter/legacy IDs unless selected
        return base.filter(
            (g) =>
                selectedGroups.includes(g.jid) ||
                g.allowed ||
                g.participants_count > 0 ||
                !/^\d+$/.test(g.name)
        );
    })();

    const filteredGroups = allGroups.filter((g) => {
        const q = groupSearch.trim().toLowerCase();
        if (!q) return true;
        return g.name.toLowerCase().includes(q) || g.jid.toLowerCase().includes(q);
    });

    return (
        <div>
            {onBack && (
                <button style={backBtn} onClick={onBack}>
                    ← Kembali ke Pengaturan
                </button>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)" }}>
                        📱 WhatsApp Bot (Hermes)
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 2 }}>
                        Hubungkan WhatsApp lewat Scan QR & pilih Grup WA keluarga tanpa perlu lewat Telegram.
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => fetchStatus(false)}
                    disabled={loading}
                    title="Muat ulang status"
                    style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--glass-border)",
                        background: "var(--bg-surface-low)",
                        color: "var(--color-text)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    {loading ? "..." : "↻ Refresh"}
                </button>
            </div>

            {/* Target Switcher for Superadmin (Host Eko vs Customer Container Simulation) */}
            {availableTargets.length > 1 && (
                <div style={{ ...cardBox, background: "rgba(63,81,66,.08)", borderColor: "rgba(63,81,66,.25)" }}>
                    <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--color-primary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                        🎛️ Pilih Target Mesin Bot (Mode Admin & Simulasi Pelanggan)
                    </label>
                    <select
                        value={target}
                        onChange={(e) => handleSwitchTarget(e.target.value)}
                        style={{ ...inputSt, fontWeight: 700, cursor: "pointer" }}
                    >
                        {availableTargets.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.45 }}>
                        {target === "profile:eko"
                            ? "Sedang mengatur bot WhatsApp utama Anda di Host VPS (profil eko)."
                            : `Sedang menyimulasikan tampilan & mesin container pelanggan (${target.replace("incus:", "")}).`}
                    </div>
                </div>
            )}

            {error && (
                <div style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,113,108,.1)",
                    border: "1px solid rgba(255,113,108,.28)",
                    color: "#ff716c",
                    fontSize: 12,
                    marginBottom: 12,
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Status Card */}
            <div style={{
                ...cardBox,
                background: paired
                    ? "linear-gradient(145deg, rgba(46,107,71,.14), rgba(46,107,71,.04))"
                    : "var(--bg-surface-low)",
                border: paired
                    ? "1px solid rgba(46,107,71,.35)"
                    : "1px solid var(--glass-border)",
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <span style={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                background: paired && bridgeStatus === "connected"
                                    ? "#22c55e"
                                    : paired
                                        ? "#f59e0b"
                                        : "var(--color-subtle)",
                                boxShadow: paired && bridgeStatus === "connected" ? "0 0 8px rgba(34,197,94,.6)" : "none",
                            }} />
                            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: paired ? "var(--color-primary)" : "var(--color-muted)" }}>
                                {paired
                                    ? bridgeStatus === "connected"
                                        ? "Terhubung & Aktif 24 Jam"
                                        : `Tertaut (${bridgeStatus})`
                                    : "Belum Tertaut"}
                            </span>
                        </div>

                        {paired && account ? (
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)" }}>
                                    {account.name}
                                </div>
                                <div style={{ fontSize: 12.5, fontFamily: "monospace", fontWeight: 700, color: "var(--color-primary)", marginTop: 2 }}>
                                    {account.phone}
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5 }}>
                                Belum ada nomor WhatsApp yang ditautkan ke workspace ini. Klik tombol di bawah untuk memunculkan QR Code.
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                            type="button"
                            onClick={handleStartPairing}
                            disabled={!isOwner || pairingBusy || isPairingActive}
                            style={{
                                padding: "8px 13px",
                                borderRadius: 10,
                                border: "none",
                                background: "var(--color-primary)",
                                color: "var(--color-on-primary)",
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: !isOwner || pairingBusy || isPairingActive ? "not-allowed" : "pointer",
                                fontFamily: "inherit",
                                opacity: !isOwner || pairingBusy || isPairingActive ? 0.6 : 1,
                            }}
                        >
                            {pairingBusy
                                ? "⏳ Menyiapkan QR..."
                                : paired
                                    ? "🔄 Ganti / Pairing Ulang QR"
                                    : "📱 Generate QR WhatsApp"}
                        </button>
                        {paired && isOwner && (
                            <button
                                type="button"
                                onClick={handleDisconnect}
                                disabled={disconnectBusy}
                                style={{
                                    padding: "8px 11px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,113,108,.28)",
                                    background: "rgba(255,113,108,.08)",
                                    color: "#ff716c",
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                Putuskan
                            </button>
                        )}
                    </div>
                </div>

                {/* DM Protection Badge */}
                <div style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid var(--glass-border)",
                    fontSize: 11,
                    color: "var(--color-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    lineHeight: 1.45,
                }}>
                    <span>🛡️</span>
                    <span>
                        <strong style={{ color: "var(--color-text)" }}>Proteksi Japri Pribadi Aktif:</strong> Bot hanya membalas di Grup WA keluarga yang Anda centang di bawah. Chat pribadi (japri teman/kantor) 100% diabaikan.
                    </span>
                </div>
            </div>

            {/* Live QR Code Modal/Card when pairing is active */}
            {pairing.state !== "idle" && (
                <div style={{
                    ...cardBox,
                    border: "1.5px solid var(--color-primary)",
                    background: "var(--bg-surface)",
                    textAlign: "center",
                    padding: "16px 14px",
                }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", marginBottom: 6 }}>
                        {pairing.state === "starting" && "⏳ Menyiapkan kode QR WhatsApp..."}
                        {pairing.state === "qr" && `📱 Scan QR Code WhatsApp (QR #${pairing.qr_count || 1})`}
                        {pairing.state === "connected_saving" && "✅ Berhasil di-scan! Menyimpan sesi & mengaktifkan bot..."}
                        {pairing.state === "connected" && "🎉 WhatsApp Berhasil Terhubung!"}
                        {(pairing.state === "error" || pairing.state === "timeout") && "⚠️ Sesi Pairing Berhenti"}
                    </div>

                    {pairing.state === "qr" && pairing.qr_data_url && (
                        <div style={{
                            display: "inline-block",
                            padding: 12,
                            background: "#FFFFFF",
                            borderRadius: 16,
                            border: "1px solid #E5DEC9",
                            margin: "8px auto 10px",
                            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                        }}>
                            <img
                                src={pairing.qr_data_url}
                                alt="WhatsApp Pairing QR Code"
                                style={{ width: 230, height: 230, display: "block" }}
                            />
                        </div>
                    )}

                    {pairing.state === "starting" && (
                        <div style={{ padding: "24px 0", fontSize: 12, color: "var(--color-muted)" }}>
                            Sedang menghubungi jembatan WhatsApp Hermes (biasanya 2–4 detik)...
                        </div>
                    )}

                    {(pairing.state === "error" || pairing.state === "timeout") && (
                        <div style={{ fontSize: 12, color: "#ff716c", margin: "8px 0 12px" }}>
                            {pairing.error || "Waktu scan habis. Silakan klik Generate QR lagi."}
                        </div>
                    )}

                    <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.55, textAlign: "left", background: "var(--bg-surface-low)", padding: "10px 12px", borderRadius: 10, marginBottom: 10 }}>
                        <div><strong>Cara menautkan:</strong></div>
                        <div>1. Buka WhatsApp di HP → ketuk <strong>Setelan (⋮) → Perangkat Tertaut</strong>.</div>
                        <div>2. Ketuk <strong>Tautkan Perangkat</strong> lalu arahkan kamera ke QR di atas.</div>
                        <div>3. QR otomatis diperbarui tiap ~20 detik sampai berhasil di-scan.</div>
                    </div>

                    {isPairingActive && (
                        <button
                            type="button"
                            onClick={handleCancelPairing}
                            style={{
                                padding: "7px 14px",
                                borderRadius: 8,
                                border: "1px solid var(--glass-border)",
                                background: "var(--bg-surface-low)",
                                color: "var(--color-muted)",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Batalkan Scan QR
                        </button>
                    )}
                </div>
            )}

            {/* Group Allowlist Manager */}
            <div style={sectionLabel}>
                GRUP WHATSAPP KELUARGA YANG DIIZINKAN ({selectedGroups.length} AKTIF)
            </div>
            <div style={cardBox}>
                <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                    Centang grup WhatsApp mana saja yang boleh dilayani oleh asisten AI (catat pengeluaran, foto struk, cek anggaran).
                </div>

                {/* Require mention toggle */}
                <div
                    onClick={() => {
                        if (!isOwner) return;
                        setRequireMention((v) => !v);
                        setDirtyGroups(true);
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "9px 11px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--glass-border)",
                        marginBottom: 10,
                        cursor: isOwner ? "pointer" : "default",
                    }}
                >
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>
                            Hanya balas jika di-@mention / di-reply
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 1 }}>
                            {requireMention
                                ? "Aktif: Anggota grup harus @mention atau reply pesan bot."
                                : "Mati (Rekomendasi): Bot langsung merespons pesan catat keuangan & foto struk di grup keluarga."}
                        </div>
                    </div>
                    <div style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        background: requireMention ? "var(--color-primary)" : "var(--color-border)",
                        position: "relative",
                        flexShrink: 0,
                        transition: "background .2s",
                    }}>
                        <div style={{
                            position: "absolute",
                            top: 3,
                            left: requireMention ? 18 : 3,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left .2s",
                        }} />
                    </div>
                </div>

                {/* Search group */}
                {allGroups.length > 4 && (
                    <input
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        placeholder="🔍 Cari nama grup WhatsApp..."
                        style={{ ...inputSt, marginBottom: 8 }}
                    />
                )}

                {/* Group checklist */}
                <div style={{
                    maxHeight: 210,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 10,
                    paddingRight: 2,
                }}>
                    {filteredGroups.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: "var(--color-subtle)", textAlign: "center", padding: "12px 8px" }}>
                            Belum ada grup yang terdeteksi. Kirim 1 pesan apa saja di grup WA keluarga Anda lalu klik Refresh, atau masukkan ID grup di bawah.
                        </div>
                    ) : (
                        filteredGroups.map((g) => {
                            const checked = selectedGroups.includes(g.jid);
                            return (
                                <div
                                    key={g.jid}
                                    onClick={() => toggleGroupSelection(g.jid)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "8px 10px",
                                        borderRadius: 10,
                                        background: checked ? "var(--color-primary-soft)" : "var(--bg-surface)",
                                        border: checked ? "1px solid var(--color-primary)" : "1px solid var(--glass-border)",
                                        cursor: isOwner ? "pointer" : "default",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {}}
                                        disabled={!isOwner}
                                        style={{ width: 15, height: 15, accentColor: "var(--color-primary)", cursor: "pointer" }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            color: "var(--color-text)",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}>
                                            {g.name}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: "var(--color-muted)", fontFamily: "monospace" }}>
                                            {g.jid} {g.participants_count > 0 ? `· ${g.participants_count} anggota` : ""}
                                        </div>
                                    </div>
                                    {checked && (
                                        <span style={{
                                            fontSize: 10,
                                            fontWeight: 800,
                                            padding: "2px 7px",
                                            borderRadius: 99,
                                            background: "var(--color-primary)",
                                            color: "var(--color-on-primary)",
                                        }}>
                                            Aktif
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Add custom group JID */}
                {isOwner && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        <input
                            value={customJid}
                            onChange={(e) => setCustomJid(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddCustomGroup()}
                            placeholder="Tambah ID Grup manual (120363...@g.us)"
                            style={{ ...inputSt, flex: 1, fontSize: 11.5 }}
                        />
                        <button
                            type="button"
                            onClick={handleAddCustomGroup}
                            style={{
                                padding: "0 12px",
                                borderRadius: 10,
                                border: "1px solid var(--glass-border)",
                                background: "var(--bg-surface)",
                                color: "var(--color-text)",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            + Tambah
                        </button>
                    </div>
                )}

                {isOwner && (
                    <button
                        type="button"
                        onClick={handleSaveGroups}
                        disabled={savingGroups}
                        style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: dirtyGroups ? "var(--color-primary)" : "var(--bg-surface)",
                            color: dirtyGroups ? "var(--color-on-primary)" : "var(--color-text)",
                            fontSize: 12.5,
                            fontWeight: 800,
                            cursor: savingGroups ? "wait" : "pointer",
                            fontFamily: "inherit",
                            borderWidth: dirtyGroups ? 0 : 1,
                            borderStyle: "solid",
                            borderColor: "var(--glass-border)",
                        }}
                    >
                        {savingGroups ? "Menyimpan..." : dirtyGroups ? "💾 Simpan Pengaturan Grup WA" : "✓ Pengaturan Grup Tersimpan"}
                    </button>
                )}
            </div>
        </div>
    );
}
