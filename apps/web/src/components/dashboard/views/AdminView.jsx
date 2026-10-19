import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../../api/client";
import { useIsMobile } from "../../../hooks/useIsMobile";

const PAID_FEATURES_META = [
  {
    key: "api_access",
    icon: "🤖",
    label: "Bot AI & CLI (API Key)",
    desc: "Akses pencatatan via Telegram/WA Hermes & CLI karaya",
  },
  {
    key: "receipt_storage",
    icon: "🧾",
    label: "Cloud Bukti Struk (WebP)",
    desc: "Simpan & lihat lampiran foto struk/nota di transaksi",
  },
  {
    key: "price_compare",
    icon: "⚖️",
    label: "Banding Harga Antar Toko",
    desc: "Perbandingan harga satuan & deteksi promo minimarket",
  },
  {
    key: "multi_member",
    icon: "👨‍👩‍👧",
    label: "Kolaborasi Pasangan",
    desc: "Undang pasangan/anggota keluarga & akun Shared/Privat",
  },
  {
    key: "shopping_stock",
    icon: "🛒",
    label: "Belanja & Stok Kulkas",
    desc: "Daftar belanja pintar & manajemen stok dapur/pantry",
  },
  {
    key: "beneficiary",
    icon: "🎁",
    label: 'Penerima Manfaat ("Untuk Siapa")',
    desc: "Alokasi pengeluaran per anak/orang tua/aset",
  },
  {
    key: "excel_export",
    icon: "📊",
    label: "Export Excel (.xlsx 4-Sheet)",
    desc: "Unduh laporan keuangan profesional 4 tab",
  },
];

const TIER_BADGE = {
  lifetime: {
    label: "👑 LIFETIME",
    bg: "rgba(212, 157, 63, 0.16)",
    border: "rgba(212, 157, 63, 0.45)",
    color: "#D49D3F",
  },
  pro: {
    label: "✨ PRO",
    bg: "var(--color-primary-soft)",
    border: "var(--color-border-strong)",
    color: "var(--color-primary)",
  },
  free: {
    label: "🌱 FREE",
    bg: "var(--color-border-soft)",
    border: "var(--color-border)",
    color: "var(--color-muted)",
  },
};

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeTime(iso) {
  if (!iso) return "Belum ada";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return "Baru saja";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}j lalu`;
  const days = Math.floor(diffSec / 86400);
  if (days <= 30) return `${days}h lalu`;
  return formatDateShort(iso);
}

function formatCompactTokens(num) {
  const n = Number(num || 0);
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const val = (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2);
    return `${val} Jt`;
  }
  if (abs >= 1_000) {
    const val = (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1);
    return `${val}rb`;
  }
  return n.toLocaleString("id-ID");
}

function toInputDateValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function addDaysToInputDate(days) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export default function AdminView({ showToast }) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [cleaningIdem, setCleaningIdem] = useState(false);

  // Modal state untuk Kelola Paket, Fitur & Kuota Token AI per Household
  const [editingHh, setEditingHh] = useState(null);
  const [modalTier, setModalTier] = useState("pro");
  const [modalExpiresDate, setModalExpiresDate] = useState("");
  const [modalOverrides, setModalOverrides] = useState({});
  const [savingPlan, setSavingPlan] = useState(false);

  // State Token Gatekeeper di dalam Modal Household
  const [modalTokenDelta, setModalTokenDelta] = useState(0);
  const [modalAutoInjectKey, setModalAutoInjectKey] = useState(true);
  const [modalForceNewKey, setModalForceNewKey] = useState(false);
  const [savingHhTokens, setSavingHhTokens] = useState(false);
  const [lastProvisionedKey, setLastProvisionedKey] = useState(null);

  // State Panel Dompet Lintas Produk & Voucher (Standalone Gatekeeper)
  const [gkTab, setGkTab] = useState("wallets"); // "wallets" | "vouchers"
  const [standaloneOwnerId, setStandaloneOwnerId] = useState("");
  const [standaloneDisplayName, setStandaloneDisplayName] = useState("");
  const [standaloneAliases, setStandaloneAliases] = useState("");
  const [standaloneDeltaTokens, setStandaloneDeltaTokens] = useState(500000);
  const [savingStandalone, setSavingStandalone] = useState(false);
  const [standaloneCreatedKey, setStandaloneCreatedKey] = useState(null);

  const [voucherTokens, setVoucherTokens] = useState(1000000);
  const [voucherCount, setVoucherCount] = useState(1);
  const [voucherNote, setVoucherNote] = useState("");
  const [creatingVouchers, setCreatingVouchers] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => unwrap(await api.GET("/v1/admin/overview")),
    staleTime: 30_000,
  });

  const householdsQuery = useQuery({
    queryKey: ["admin-households", searchQuery.trim(), tierFilter],
    queryFn: async () =>
      unwrap(
        await api.GET("/v1/admin/households", {
          params: {
            query: {
              ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
              plan_tier: tierFilter,
              limit: 100,
              offset: 0,
            },
          },
        }),
      ),
    staleTime: 20_000,
  });

  const overview = overviewQuery.data;
  const householdsData = householdsQuery.data;
  const households = householdsData?.items ?? [];
  const gkOverview = overview?.token_gatekeeper;

  const receiptQuotaStats = useMemo(() => {
    const usedKb = overview?.storage_and_db?.estimated_receipt_kb ?? 0;
    const limitKb = overview?.storage_and_db?.quota_limit_kb ?? 1048576;
    const usedMb = (usedKb / 1024).toFixed(2);
    const limitMb = Math.round(limitKb / 1024);
    const pct = Math.min(100, Math.max(0, (usedKb / limitKb) * 100));
    return { usedMb, limitMb, pct };
  }, [overview]);

  const handleRefreshAll = () => {
    overviewQuery.refetch();
    householdsQuery.refetch();
    showToast?.("🔄 Data Superadmin & Token Gatekeeper diperbarui");
  };

  const handleCleanupIdempotency = async () => {
    if (cleaningIdem) return;
    setCleaningIdem(true);
    try {
      const res = await unwrap(
        await api.POST("/v1/admin/maintenance/cleanup-idempotency", {
          body: { older_than_days: 7 },
        }),
      );
      showToast?.(`🧹 ${res.deleted_count} idempotency keys kedaluwarsa (>7 hari) dibersihkan!`);
      overviewQuery.refetch();
    } catch (err) {
      showToast?.(`❌ Gagal membersihkan idempotency keys: ${err.message}`);
    } finally {
      setCleaningIdem(false);
    }
  };

  const openManageModal = (hh) => {
    setEditingHh(hh);
    setModalTier(hh.plan_tier || "pro");
    setModalExpiresDate(toInputDateValue(hh.plan_expires_at));
    const currentOverrides = hh.entitlements_override || {};
    const nextOverrides = {};
    for (const f of PAID_FEATURES_META) {
      if (typeof currentOverrides[f.key] === "boolean") {
        nextOverrides[f.key] = currentOverrides[f.key];
      } else {
        nextOverrides[f.key] = null; // null = ikut default paket
      }
    }
    setModalOverrides(nextOverrides);
    setModalTokenDelta(0);
    setModalAutoInjectKey(true);
    setModalForceNewKey(false);
    setLastProvisionedKey(null);
  };

  const handleProvisionHouseholdTokens = async () => {
    if (!editingHh || savingHhTokens) return;
    setSavingHhTokens(true);
    try {
      const res = await unwrap(
        await api.POST("/v1/admin/households/{id}/tokens", {
          params: { path: { id: editingHh.id } },
          body: {
            delta_tokens: Number(modalTokenDelta) || 0,
            auto_inject_key: modalAutoInjectKey,
            force_new_key: modalForceNewKey,
            model: "kb-auto",
          },
        }),
      );

      if (res.created_api_key) {
        setLastProvisionedKey(res.created_api_key);
      }
      setModalTokenDelta(0);
      setModalForceNewKey(false);
      setEditingHh((prev) =>
        prev
          ? {
              ...prev,
              token_wallet: res.wallet || prev.token_wallet,
              ai_config_summary: res.injected
                ? {
                    ...prev.ai_config_summary,
                    configured_members: res.injected.updated_members,
                    provider: res.injected.provider,
                    model: res.injected.model,
                    is_gatekeeper: true,
                    key_prefix: res.injected.key_prefix,
                  }
                : prev.ai_config_summary,
            }
          : prev,
      );

      const injectedMsg = res.injected
        ? ` & Key dipasang ke ${res.injected.updated_members} anggota`
        : "";
      showToast?.(
        `💎 Saldo token "${editingHh.name}": ${Number(
          res.wallet?.token_balance ?? 0,
        ).toLocaleString("id-ID")} token${injectedMsg}!`,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-households"] }),
        queryClient.invalidateQueries({ queryKey: ["me-settings"] }),
      ]);
    } catch (err) {
      showToast?.(`❌ Gagal memproses token household: ${err.message}`);
    } finally {
      setSavingHhTokens(false);
    }
  };

  const handleSavePlan = async () => {
    if (!editingHh || savingPlan) return;
    setSavingPlan(true);
    try {
      const expiresIso =
        modalExpiresDate && modalTier === "pro"
          ? new Date(`${modalExpiresDate}T23:59:59.000Z`).toISOString()
          : null;

      await unwrap(
        await api.PATCH("/v1/admin/households/{id}/plan", {
          params: { path: { id: editingHh.id } },
          body: {
            plan_tier: modalTier,
            plan_expires_at: expiresIso,
            entitlements_override: modalOverrides,
          },
        }),
      );

      if (Number(modalTokenDelta) !== 0 || modalForceNewKey) {
        await unwrap(
          await api.POST("/v1/admin/households/{id}/tokens", {
            params: { path: { id: editingHh.id } },
            body: {
              delta_tokens: Number(modalTokenDelta) || 0,
              auto_inject_key: modalAutoInjectKey,
              force_new_key: modalForceNewKey,
              model: "kb-auto",
            },
          }),
        );
      }

      showToast?.(`✅ Paket & fitur "${editingHh.name}" berhasil diperbarui!`);
      setEditingHh(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-households"] }),
        queryClient.invalidateQueries({ queryKey: ["household-current"] }),
        queryClient.invalidateQueries({ queryKey: ["me-settings"] }),
      ]);
    } catch (err) {
      showToast?.(`❌ Gagal menyimpan paket: ${err.message}`);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleProvisionStandaloneWallet = async (e) => {
    e?.preventDefault();
    if (!standaloneOwnerId.trim() || savingStandalone) return;
    setSavingStandalone(true);
    setStandaloneCreatedKey(null);
    try {
      const aliasesList = standaloneAliases
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await unwrap(
        await api.POST("/v1/admin/tokens/wallets/provision", {
          body: {
            owner_id: standaloneOwnerId.trim(),
            display_name: standaloneDisplayName.trim() || standaloneOwnerId.trim(),
            aliases: aliasesList,
            delta_tokens: Number(standaloneDeltaTokens) || 0,
            create_key_if_missing: true,
            force_new_key: false,
            key_name: standaloneDisplayName.trim() || standaloneOwnerId.trim(),
          },
        }),
      );
      if (res.created_api_key) {
        setStandaloneCreatedKey(res.created_api_key);
      }
      showToast?.(
        `💎 Dompet "${res.wallet?.owner_id}" siap! Saldo: ${Number(
          res.wallet?.token_balance ?? 0,
        ).toLocaleString("id-ID")} token`,
      );
      setStandaloneOwnerId("");
      setStandaloneDisplayName("");
      setStandaloneAliases("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-households"] }),
      ]);
    } catch (err) {
      showToast?.(`❌ Gagal membuat/top-up dompet: ${err.message}`);
    } finally {
      setSavingStandalone(false);
    }
  };

  const handleCreateVouchers = async (e) => {
    e?.preventDefault();
    if (creatingVouchers) return;
    setCreatingVouchers(true);
    try {
      const res = await unwrap(
        await api.POST("/v1/admin/tokens/vouchers", {
          body: {
            tokens: Number(voucherTokens) || 1000000,
            count: Number(voucherCount) || 1,
            prefix: "KB",
            notes: voucherNote.trim(),
          },
        }),
      );
      const codes = (res.vouchers || []).map((v) => v.code).filter(Boolean);
      showToast?.(`🎟️ ${codes.length} voucher berhasil dibuat: ${codes.join(", ")}`);
      setVoucherNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      showToast?.(`❌ Gagal membuat voucher: ${err.message}`);
    } finally {
      setCreatingVouchers(false);
    }
  };

  if (overviewQuery.isError) {
    return (
      <div className="bento" style={{ padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
        <h3 style={{ fontSize: 18, marginBottom: 6 }}>Akses Superadmin Ditolak</h3>
        <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
          {overviewQuery.error?.message || "Hanya Superadmin yang dapat membuka halaman ini."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ═══ HEADER BANNER ═══ */}
      <div
        className="bento-hero"
        style={{
          padding: isMobile ? "18px 16px" : "22px 24px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24 }}>🛡️</span>
            <h2 style={{ fontSize: isMobile ? 20 : 24, margin: 0 }}>
              Superadmin Control Center
            </h2>
            {overview?.runtime && (
              <span
                className="chip"
                style={{
                  background: overview.runtime.enforce_paid_features
                    ? "rgba(212, 157, 63, 0.18)"
                    : "var(--color-primary-soft)",
                  color: overview.runtime.enforce_paid_features
                    ? "#D49D3F"
                    : "var(--color-primary)",
                  border: `1px solid ${
                    overview.runtime.enforce_paid_features
                      ? "rgba(212, 157, 63, 0.45)"
                      : "var(--color-border-strong)"
                  }`,
                }}
              >
                {overview.runtime.enforce_paid_features
                  ? "🔒 Mode Komersial Aktif (Enforce Paid)"
                  : "🎉 Mode Early-Adopter (Semua Fitur Terbuka)"}
              </span>
            )}
            {gkOverview && (
              <span
                className={`chip ${
                  gkOverview.online
                    ? "chip-mint"
                    : gkOverview.configured
                    ? "chip-red"
                    : "chip-ghost"
                }`}
              >
                {gkOverview.online
                  ? `💎 Gatekeeper Online (${gkOverview.summary?.total_wallets ?? 0} dompet)`
                  : gkOverview.configured
                  ? "🔴 Gatekeeper Offline"
                  : "⚪ Gatekeeper Token Belum Diset"}
              </span>
            )}
            {overview?.runtime?.storage_provider && (
              <span className="chip chip-ghost">
                ☁️ Storage: {overview.runtime.storage_provider.toUpperCase()}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--color-muted)",
              margin: "6px 0 0",
              lineHeight: 1.5,
            }}
          >
            Pantau pertumbuhan keluarga terdaftar, status langganan (`plan_tier` & add-on{" "}
            `entitlements`), kuota Token AI (`sk-kb-*` lintas produk via API terpisah), dan
            kesehatan database dalam satu layar.
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          className="btn-ghost"
          style={{
            padding: "9px 16px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span>🔄</span>
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* ═══ 5 KPI BENTO CARDS ═══ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(5, 1fr)",
          gap: 12,
        }}
      >
        {/* KPI 1: Keluarga & Pengguna */}
        <div className="bento" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            👨‍👩‍👧 KELUARGA & USER
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div className="mono" style={{ fontSize: 28, fontWeight: 800 }}>
              {overview?.households?.total ?? "—"}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>keluarga</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
            <span className="chip chip-mint">
              +{overview?.households?.new_7d ?? 0} (7h)
            </span>
            <span className="chip chip-ghost">
              +{overview?.households?.new_30d ?? 0} (30h)
            </span>
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--color-border-soft)",
              fontSize: 11.5,
              color: "var(--color-muted)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div>
              👤 Anggota:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.members?.total_active ?? 0}
              </strong>{" "}
              ({overview?.members?.unique_users ?? 0} unik)
            </div>
            <div>
              💑 Pasangan:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.households?.multi_member_count ?? 0} keluarga
              </strong>
            </div>
          </div>
        </div>

        {/* KPI 2: Monetisasi & Paket */}
        <div className="bento" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            👑 PAKET (PLAN TIER)
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div className="mono" style={{ fontSize: 28, fontWeight: 800 }}>
              {(overview?.plans?.lifetime_total ?? 0) + (overview?.plans?.pro_active ?? 0)}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>Pro / Lifetime</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
            <span
              className="chip"
              style={{
                background: TIER_BADGE.lifetime.bg,
                color: TIER_BADGE.lifetime.color,
                border: `1px solid ${TIER_BADGE.lifetime.border}`,
              }}
            >
              👑 {overview?.plans?.lifetime_total ?? 0}
            </span>
            <span className="chip chip-mint">
              ✨ Pro: {overview?.plans?.pro_active ?? 0}
            </span>
            <span className="chip chip-ghost">
              🌱 Free: {overview?.plans?.free_total ?? 0}
            </span>
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--color-border-soft)",
              fontSize: 11.5,
              color: "var(--color-muted)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div>
              ⏰ Exp ≤7h:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.plans?.pro_expiring_7d ?? 0}
              </strong>{" "}
              · Expired:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.plans?.pro_expired ?? 0}
              </strong>
            </div>
            <div>
              🧩 Add-on:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.plans?.custom_entitlements_count ?? 0} keluarga
              </strong>
            </div>
          </div>
        </div>

        {/* KPI 3: Token Gatekeeper AI */}
        <div className="bento" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            💎 TOKEN AI (GATEKEEPER)
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div
              className="mono"
              style={{ fontSize: 26, fontWeight: 800, color: "var(--color-primary)" }}
            >
              {gkOverview?.online
                ? formatCompactTokens(gkOverview.summary?.total_balance_tokens ?? 0)
                : "—"}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>sisa token</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
            <span className="chip chip-mint">
              Pakai: {formatCompactTokens(gkOverview?.summary?.total_used_tokens ?? 0)}
            </span>
            <span className="chip chip-ghost">
              {gkOverview?.summary?.total_requests ?? 0} req
            </span>
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--color-border-soft)",
              fontSize: 11.5,
              color: "var(--color-muted)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div>
              👛 Dompet aktif:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {gkOverview?.summary?.active_wallets ?? 0}
              </strong>{" "}
              · Key:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {gkOverview?.summary?.active_keys ?? 0}
              </strong>
            </div>
            <div>
              🎟️ Voucher siap klaim:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {gkOverview?.summary?.unclaimed_vouchers ?? 0} kode
              </strong>
            </div>
          </div>
        </div>

        {/* KPI 4: Aktivitas & Retensi Transaksi */}
        <div className="bento" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            📈 AKTIVITAS TRANSAKSI
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div className="mono" style={{ fontSize: 28, fontWeight: 800 }}>
              {overview?.transactions?.total ?? "—"}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>transaksi</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
            <span className="chip chip-mint">
              Hari ini: +{overview?.transactions?.today ?? 0}
            </span>
            <span className="chip chip-ghost">
              7h: +{overview?.transactions?.last_7d ?? 0}
            </span>
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--color-border-soft)",
              fontSize: 11.5,
              color: "var(--color-muted)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div>
              🌐 Web:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.transactions?.by_source?.web ?? 0}
              </strong>{" "}
              · 🤖 Bot:{" "}
              <strong style={{ color: "var(--color-primary)" }}>
                {overview?.transactions?.by_source?.api_key ?? 0}
              </strong>
            </div>
            <div>
              🔥 Keluarga aktif 7h:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.households?.active_7d ?? 0} klg
              </strong>
            </div>
          </div>
        </div>

        {/* KPI 5: Kuota Struk Cloud & DB */}
        <div className="bento" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            🧾 STRUK & BARIS DB
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div className="mono" style={{ fontSize: 25, fontWeight: 800 }}>
              {overview?.storage_and_db?.receipt_count ?? 0}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
              struk (~{receiptQuotaStats.usedMb}/{receiptQuotaStats.limitMb}MB)
            </span>
          </div>

          <div
            style={{
              width: "100%",
              height: 6,
              borderRadius: 99,
              background: "var(--color-border-soft)",
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: `${Math.max(2, receiptQuotaStats.pct)}%`,
                height: "100%",
                borderRadius: 99,
                background:
                  receiptQuotaStats.pct > 80
                    ? "var(--color-expense)"
                    : "var(--color-primary)",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 9,
              fontSize: 11,
              color: "var(--color-muted)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px 6px",
            }}
          >
            <div>
              Harga:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.storage_and_db?.table_rows?.product_prices ?? 0}
              </strong>
            </div>
            <div>
              Kamus:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {overview?.storage_and_db?.table_rows?.product_knowledge ?? 0}
              </strong>
            </div>
          </div>

          <button
            onClick={handleCleanupIdempotency}
            disabled={cleaningIdem}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--bg-surface-low)",
              color: "var(--color-text)",
              fontSize: 11,
              fontWeight: 700,
              cursor: cleaningIdem ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {cleaningIdem
              ? "Membersihkan..."
              : `🧹 Cleanup Idem (${overview?.storage_and_db?.table_rows?.expired_idempotency_keys ?? 0})`}
          </button>
        </div>
      </div>

      {/* ═══ MANAJEMEN KELUARGA & USER ═══ */}
      <div className="bento" style={{ padding: isMobile ? 14 : 20 }}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, margin: 0 }}>
              Daftar Keluarga Terdaftar ({householdsData?.total ?? households.length})
            </h3>
            <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "3px 0 0" }}>
              Klik <strong>Kelola Paket & Token AI</strong> untuk mengubah tier, masa aktif,
              top-up kuota Token AI, atau auto-pasang key <code>sk-kb-*</code> ke semua anggota.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 8,
              alignItems: isMobile ? "stretch" : "center",
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Cari keluarga, nama, email, ID..."
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: "1px solid var(--color-border)",
                background: "var(--bg-surface-low)",
                color: "var(--color-text)",
                fontSize: 13,
                minWidth: isMobile ? "100%" : 250,
              }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "all", label: "Semua" },
                { id: "lifetime", label: "👑 Lifetime" },
                { id: "pro", label: "✨ Pro" },
                { id: "free", label: "🌱 Free" },
                { id: "expired", label: "⏰ Expired" },
              ].map((tab) => {
                const active = tierFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTierFilter(tab.id)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 99,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      border: `1px solid ${
                        active ? "var(--color-primary)" : "var(--color-border-soft)"
                      }`,
                      background: active ? "var(--color-primary-soft)" : "transparent",
                      color: active ? "var(--color-primary)" : "var(--color-muted)",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Household Cards / Rows */}
        {householdsQuery.isLoading ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
            Memuat daftar keluarga...
          </div>
        ) : households.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
            Tidak ada keluarga yang cocok dengan filter pencarian.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {households.map((hh) => {
              const badge = TIER_BADGE[hh.plan_tier] || TIER_BADGE.free;
              const overrideEntries = Object.entries(hh.entitlements_override || {}).filter(
                ([, val]) => typeof val === "boolean",
              );
              const isExpired =
                hh.plan_tier === "pro" &&
                hh.plan?.effective_tier === "free" &&
                hh.plan_expires_at;
              const wallet = hh.token_wallet;
              const aiCfg = hh.ai_config_summary;

              return (
                <div
                  key={hh.id}
                  style={{
                    padding: isMobile ? 14 : 16,
                    borderRadius: 14,
                    border: "1px solid var(--color-border-soft)",
                    background: "var(--bg-surface-low)",
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "stretch" : "center",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  {/* Kolom Kiri: Identitas Keluarga & Anggota */}
                  <div style={{ flex: 1.3, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 15.5, fontWeight: 800, color: "var(--color-text)" }}>
                        {hh.name}
                      </span>
                      <span
                        className="chip"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          padding: "3px 10px",
                          fontSize: 10.5,
                        }}
                      >
                        {badge.label}
                      </span>
                      {isExpired && (
                        <span className="chip chip-red" style={{ padding: "3px 9px", fontSize: 10 }}>
                          ⏰ EXPIRED
                        </span>
                      )}
                      {hh.plan_expires_at && (
                        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                          s.d. {formatDateShort(hh.plan_expires_at)}
                        </span>
                      )}

                      {/* Badge Status AI Keluarga */}
                      {aiCfg?.is_gatekeeper ? (
                        <span
                          className="chip chip-mint"
                          style={{ padding: "2px 9px", fontSize: 10.5 }}
                          title={`Key ${aiCfg.key_prefix || "sk-kb-*"} aktif di ${aiCfg.configured_members}/${aiCfg.total_members} anggota`}
                        >
                          💎 AI Gatekeeper ({aiCfg.configured_members}/{aiCfg.total_members})
                        </span>
                      ) : aiCfg?.configured_members > 0 ? (
                        <span
                          className="chip chip-ghost"
                          style={{ padding: "2px 9px", fontSize: 10.5 }}
                        >
                          ⚡ BYOK {(aiCfg.provider || "AI").toUpperCase()} ({aiCfg.configured_members}/{aiCfg.total_members})
                        </span>
                      ) : (
                        <span
                          className="chip chip-ghost"
                          style={{ padding: "2px 8px", fontSize: 10, opacity: 0.75 }}
                        >
                          ⚪ AI Belum Diset
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-subtle)",
                        marginTop: 4,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className="mono"
                        style={{ cursor: "pointer" }}
                        title="Klik untuk menyalin ID Household"
                        onClick={() => {
                          navigator.clipboard?.writeText(hh.id);
                          showToast?.(`📋 ID Household disalin: ${hh.id.slice(0, 8)}...`);
                        }}
                      >
                        ID: {hh.id.slice(0, 8)}…
                      </span>
                      <span>📅 Daftar: {formatDateShort(hh.created_at)}</span>
                      <span>⏱️ Aktif: {formatRelativeTime(hh.stats?.last_tx_at)}</span>
                      {wallet && (
                        <span className="mono" style={{ color: "var(--color-primary)" }}>
                          👛 Wallet: {wallet.owner_id}
                        </span>
                      )}
                    </div>

                    {/* Daftar Anggota */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 9,
                      }}
                    >
                      {(hh.members || []).map((m) => (
                        <div
                          key={m.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: "var(--bg-surface)",
                            border: "1px solid var(--color-border-soft)",
                            fontSize: 11.5,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: m.color || "var(--color-primary)",
                            }}
                          />
                          <strong style={{ color: "var(--color-text)" }}>{m.display_name}</strong>
                          <span style={{ color: "var(--color-muted)", fontSize: 10.5 }}>
                            ({m.role})
                          </span>
                          {m.email && (
                            <span className="mono" style={{ color: "var(--color-subtle)", fontSize: 10.5 }}>
                              · {m.email}
                            </span>
                          )}
                          {m.has_ai_key && (
                            <span
                              title={`AI aktif (${m.ai_provider || "configured"})`}
                              style={{ fontSize: 10 }}
                            >
                              {m.ai_provider === "gatekeeper" ? "💎" : "⚡"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Override Add-ons jika ada */}
                    {overrideEntries.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                        {overrideEntries.map(([k, v]) => (
                          <span
                            key={k}
                            className={`chip ${v ? "chip-mint" : "chip-red"}`}
                            style={{ padding: "2px 8px", fontSize: 10 }}
                          >
                            {v ? "✅ Add-on:" : "🚫 Off:"} {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kolom Tengah: Statistik Pemakaian + Sisa Token AI */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "repeat(3, minmax(70px, 1fr))"
                        : "repeat(5, minmax(72px, 1fr))",
                      gap: 8,
                      padding: isMobile ? "10px 0 0" : "0 12px",
                      borderTop: isMobile ? "1px solid var(--color-border-soft)" : "none",
                      borderLeft: isMobile ? "none" : "1px solid var(--color-border-soft)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 700 }}>
                        SISA TOKEN AI
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          marginTop: 2,
                          color: wallet
                            ? wallet.token_balance > 0
                              ? "var(--color-primary)"
                              : "var(--color-expense)"
                            : "var(--color-muted)",
                        }}
                      >
                        {wallet ? formatCompactTokens(wallet.token_balance) : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--color-muted)" }}>
                        {wallet
                          ? `Pakai: ${formatCompactTokens(wallet.lifetime_tokens_used)}`
                          : "Belum ada"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 700 }}>
                        TOTAL TX
                      </div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                        {hh.stats?.tx_total ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--color-muted)" }}>
                        +{hh.stats?.tx_7d ?? 0} (7d)
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 700 }}>
                        WEB / BOT
                      </div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                        {hh.stats?.tx_web ?? 0} / {hh.stats?.tx_api_key ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--color-muted)" }}>
                        Rutin: {hh.stats?.tx_recurring ?? 0}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 700 }}>
                        FOTO STRUK
                      </div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                        {hh.stats?.receipt_count ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--color-muted)" }}>
                        ~{((hh.stats?.receipt_count ?? 0) * 0.08).toFixed(1)} MB
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 700 }}>
                        API KEY BOT
                      </div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                        {hh.stats?.active_api_keys ?? 0}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--color-muted)" }}>
                        {hh.stats?.last_api_key_used_at
                          ? formatRelativeTime(hh.stats.last_api_key_used_at)
                          : "Belum dipakai"}
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan: Tombol Aksi */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => openManageModal(hh)}
                      style={{
                        width: isMobile ? "100%" : "auto",
                        padding: "9px 15px",
                        borderRadius: 10,
                        border: "1px solid var(--color-border-strong)",
                        background: "var(--color-primary-soft)",
                        color: "var(--color-primary)",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ⚙️ Kelola Paket & Token AI
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ DOMPET TOKEN LINTAS PRODUK & GENERATOR VOUCHER (GATEKEEPER) ═══ */}
      <div className="bento" style={{ padding: isMobile ? 14 : 20 }}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 17, margin: 0 }}>
                💎 Token Gatekeeper — Dompet Lintas Produk & Voucher
              </h3>
              <span className="chip chip-ghost" style={{ fontSize: 10.5 }}>
                DB Terpisah via API ({gkOverview?.base_url || "9router.cortex-ai.my.id"})
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "3px 0 0" }}>
              Kelola dompet token AI bukan hanya untuk <code>hh:&lt;uuid&gt;</code>, tapi juga user{" "}
              <code>tg:&lt;id&gt;</code>, <code>email:&lt;user&gt;</code>, atau{" "}
              <code>ws:&lt;slot&gt;</code> beserta kode voucher top-up.
            </p>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {[
              {
                id: "wallets",
                label: `👛 Semua Dompet (${gkOverview?.wallets?.length ?? 0})`,
              },
              {
                id: "vouchers",
                label: `🎟️ Voucher Token (${gkOverview?.vouchers?.length ?? 0})`,
              },
            ].map((t) => {
              const active = gkTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setGkTab(t.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: `1px solid ${
                      active ? "var(--color-primary)" : "var(--color-border-soft)"
                    }`,
                    background: active ? "var(--color-primary-soft)" : "transparent",
                    color: active ? "var(--color-primary)" : "var(--color-muted)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {gkTab === "wallets" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Form Provision Dompet Lintas Produk */}
            <form
              onSubmit={handleProvisionStandaloneWallet}
              style={{
                padding: 14,
                borderRadius: 12,
                background: "var(--bg-surface-low)",
                border: "1px solid var(--color-border-soft)",
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1.2fr 0.9fr auto",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)" }}>
                  OWNER ID (BEBAS LINTAS PRODUK)
                </label>
                <input
                  type="text"
                  value={standaloneOwnerId}
                  onChange={(e) => setStandaloneOwnerId(e.target.value)}
                  placeholder="mis. tg:628123 / email:user@x.com / ws:002"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-text)",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)" }}>
                  NAMA TAMPILAN
                </label>
                <input
                  type="text"
                  value={standaloneDisplayName}
                  onChange={(e) => setStandaloneDisplayName(e.target.value)}
                  placeholder="mis. Bot Telegram Budi"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-text)",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)" }}>
                  ALIAS TAMBAHAN (PISAH KOMA)
                </label>
                <input
                  type="text"
                  value={standaloneAliases}
                  onChange={(e) => setStandaloneAliases(e.target.value)}
                  placeholder="budi@gmail.com, tg:998877"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-text)",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)" }}>
                  TAMBAH TOKEN (+/-)
                </label>
                <input
                  type="number"
                  step="50000"
                  value={standaloneDeltaTokens}
                  onChange={(e) => setStandaloneDeltaTokens(Number(e.target.value))}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-text)",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={savingStandalone || !standaloneOwnerId.trim()}
                className="btn-primary"
                style={{ padding: "9px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}
              >
                {savingStandalone ? "Memproses..." : "➕ Buat / Top-Up"}
              </button>
            </form>

            {standaloneCreatedKey && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--color-primary-soft)",
                  border: "1px solid var(--color-border-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 12 }}>
                  🔑 <strong>API Key Baru Dibuat:</strong>{" "}
                  <code className="mono">{standaloneCreatedKey}</code>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(standaloneCreatedKey);
                    showToast?.("📋 API Key sk-kb-* disalin ke clipboard!");
                  }}
                  className="btn-ghost"
                  style={{ padding: "5px 12px", fontSize: 11.5 }}
                >
                  📋 Salin Key
                </button>
              </div>
            )}

            {/* Daftar Dompet di Gatekeeper */}
            {(gkOverview?.wallets || []).length === 0 ? (
              <div style={{ padding: 18, textAlign: "center", color: "var(--color-muted)", fontSize: 12.5 }}>
                {gkOverview?.online
                  ? "Belum ada dompet token terdaftar di Gatekeeper."
                  : "Token Gatekeeper belum terhubung (pastikan GATEKEEPER_ADMIN_TOKEN aktif)."}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                  gap: 10,
                }}
              >
                {(gkOverview?.wallets || []).map((w) => (
                  <div
                    key={w.owner_id}
                    style={{
                      padding: 12,
                      borderRadius: 11,
                      background: "var(--bg-surface-low)",
                      border: "1px solid var(--color-border-soft)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 13.5 }}>{w.display_name || w.owner_id}</strong>
                        <span className="mono chip chip-ghost" style={{ fontSize: 10, padding: "2px 7px" }}>
                          {w.owner_id}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "var(--color-muted)",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        🔗 Alias: {(w.aliases || []).slice(0, 4).join(", ")}
                        {(w.aliases || []).length > 4 ? ` +${w.aliases.length - 4}` : ""}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        className="mono"
                        style={{ fontSize: 15, fontWeight: 800, color: "var(--color-primary)" }}
                      >
                        {formatCompactTokens(w.token_balance)}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--color-muted)" }}>
                        Pakai: {formatCompactTokens(w.lifetime_tokens_used)} ({w.lifetime_requests} req)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Form Buat Voucher */}
            <form
              onSubmit={handleCreateVouchers}
              style={{
                padding: 14,
                borderRadius: 12,
                background: "var(--bg-surface-low)",
                border: "1px solid var(--color-border-soft)",
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 0.7fr 1.4fr auto",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)" }}>
                  NOMINAL TOKEN PER VOUCHER
                </label>
                <select
                  value={voucherTokens}
                  onChange={(e) => setVoucherTokens(Number(e.target.value))}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-text)",
                    fontSize: 12.5,
                  }}
                >
                  <option value={250000}>250.000 Token (Starter)</option>
                  <option value={500000}>500.000 Token (Keluarga Hemat)</option>
                  <option value={1000000}>1.000.000 Token (1 Juta - Standar)</option>
                  <option value={2500000}>2.500.000 Token (2,5 Juta - Pro)</option>
                  <option value={5000000}>5.000.000 Token (5 Juta - Sultan)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)" }}>
                  JUMLAH KODE
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={voucherCount}
                  onChange={(e) => setVoucherCount(Number(e.target.value))}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-text)",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)" }}>
                  CATATAN BATCH (OPSIONAL)
                </label>
                <input
                  type="text"
                  value={voucherNote}
                  onChange={(e) => setVoucherNote(e.target.value)}
                  placeholder="mis. Pembeli Lynk.id Batch Oktober"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--color-border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-text)",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={creatingVouchers}
                className="btn-primary"
                style={{ padding: "9px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}
              >
                {creatingVouchers ? "Membuat..." : "🎟️ Generate Voucher"}
              </button>
            </form>

            {/* Daftar Voucher */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {(gkOverview?.vouchers || []).slice(0, 18).map((v) => (
                <div
                  key={v.code}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--bg-surface-low)",
                    border: "1px solid var(--color-border-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: v.is_claimed ? "var(--color-muted)" : "var(--color-primary)",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        navigator.clipboard?.writeText(v.code);
                        showToast?.(`📋 Kode voucher disalin: ${v.code}`);
                      }}
                    >
                      {v.code}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--color-muted)" }}>
                      {formatCompactTokens(v.token_amount ?? v.tokens ?? 0)} token ·{" "}
                      {v.is_claimed ? `Diklaim (${v.claimed_by})` : "Belum diklaim"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(v.code);
                      showToast?.(`📋 Kode voucher disalin: ${v.code}`);
                    }}
                    className="btn-ghost"
                    style={{ padding: "4px 9px", fontSize: 11 }}
                  >
                    📋
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ MODAL KELOLA PAKET, FITUR & TOKEN AI (PER HOUSEHOLD) ═══ */}
      {editingHh && (
        <div
          onClick={() => !savingPlan && !savingHhTokens && setEditingHh(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(0, 0, 0, 0.58)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bento"
            style={{
              width: "100%",
              maxWidth: 650,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: isMobile ? 18 : 24,
              background: "var(--bg-surface)",
              border: "1px solid var(--color-border-strong)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div>
                <div className="eyebrow">KELOLA PAKET, ENTITLEMENT & TOKEN AI KELUARGA</div>
                <h3 style={{ fontSize: 19, margin: "4px 0 0" }}>{editingHh.name}</h3>
              </div>
              <button
                onClick={() => setEditingHh(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "var(--color-muted)",
                }}
              >
                ✕
              </button>
            </div>

            {/* 1. Pilih Plan Tier */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8 }}>
                1. PILIH PAKET UTAMA (PLAN TIER)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { id: "free", title: "🌱 Free", sub: "Fitur dasar manual" },
                  { id: "pro", title: "✨ Pro", sub: "Langganan aktif semua fitur" },
                  { id: "lifetime", title: "👑 Lifetime", sub: "Aktif permanen selamanya" },
                ].map((opt) => {
                  const active = modalTier === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setModalTier(opt.id)}
                      style={{
                        padding: "11px 10px",
                        borderRadius: 12,
                        border: `1.5px solid ${
                          active ? "var(--color-primary)" : "var(--color-border-soft)"
                        }`,
                        background: active ? "var(--color-primary-soft)" : "var(--bg-surface-low)",
                        color: "var(--color-text)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{opt.title}</div>
                      <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 3 }}>
                        {opt.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Masa Aktif (khusus Pro) */}
            {modalTier === "pro" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--bg-surface-low)",
                  border: "1px solid var(--color-border-soft)",
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8 }}>
                  2. BATAS WAKTU AKTIF PRO (PLAN_EXPIRES_AT)
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {[
                    { label: "+30 Hari", val: addDaysToInputDate(30) },
                    { label: "+90 Hari", val: addDaysToInputDate(90) },
                    { label: "+1 Tahun", val: addDaysToInputDate(365) },
                    { label: "♾️ Tanpa Batas Waktu", val: "" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setModalExpiresDate(preset.val)}
                      style={{
                        padding: "6px 11px",
                        borderRadius: 8,
                        border: "1px solid var(--color-border)",
                        background:
                          modalExpiresDate === preset.val
                            ? "var(--color-primary-soft)"
                            : "var(--bg-surface)",
                        color:
                          modalExpiresDate === preset.val
                            ? "var(--color-primary)"
                            : "var(--color-text)",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="date"
                    value={modalExpiresDate}
                    onChange={(e) => setModalExpiresDate(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 9,
                      border: "1px solid var(--color-border)",
                      background: "var(--bg-surface)",
                      color: "var(--color-text)",
                      fontSize: 13,
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
                    {modalExpiresDate
                      ? `Aktif s.d. ${modalExpiresDate} 23:59 UTC`
                      : "Kosong = Aktif selamanya tanpa tanggal kedaluwarsa"}
                  </span>
                </div>
              </div>
            )}

            {/* 3. Kuota Token AI Keluarga & Auto-Inject Key (Zero-Setup) */}
            <div
              style={{
                marginBottom: 18,
                padding: 14,
                borderRadius: 12,
                background: "var(--bg-surface-low)",
                border: "1px solid var(--color-border-strong)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--color-primary)" }}>
                  💎 KUOTA TOKEN AI KELUARGA & ZERO-SETUP KEY (SK-KB-*)
                </div>
                <div className="mono" style={{ fontSize: 12.5, fontWeight: 800 }}>
                  Saldo:{" "}
                  <span style={{ color: "var(--color-primary)" }}>
                    {Number(editingHh.token_wallet?.token_balance ?? 0).toLocaleString("id-ID")}
                  </span>{" "}
                  token · Terpakai:{" "}
                  {Number(editingHh.token_wallet?.lifetime_tokens_used ?? 0).toLocaleString("id-ID")}
                </div>
              </div>

              <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 10 }}>
                Dompet otomatis ditautkan ke <code>hh:{editingHh.id.slice(0, 8)}…</code> dan seluruh
                email anggota keluarga ini. Saat <strong>Auto-pasang API Key</strong> dicentang,
                suami & istri langsung bisa pakai Scan Struk & Chat AI tanpa perlu setting API Key!
              </div>

              {/* Tombol Preset Top-Up */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {[
                  { label: "0 (Hanya Sync Key)", val: 0 },
                  { label: "+100rb Token", val: 100000 },
                  { label: "+500rb Token", val: 500000 },
                  { label: "+1 Juta Token", val: 1000000 },
                  { label: "+5 Juta Token", val: 5000000 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setModalTokenDelta(preset.val)}
                    style={{
                      padding: "6px 11px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      background:
                        Number(modalTokenDelta) === preset.val
                          ? "var(--color-primary-soft)"
                          : "var(--bg-surface)",
                      color:
                        Number(modalTokenDelta) === preset.val
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: isMobile ? "stretch" : "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    step="50000"
                    value={modalTokenDelta}
                    onChange={(e) => setModalTokenDelta(Number(e.target.value))}
                    placeholder="Nominal tambah/kurang token (mis. 500000)"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 9,
                      border: "1px solid var(--color-border)",
                      background: "var(--bg-surface)",
                      color: "var(--color-text)",
                      fontSize: 13,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleProvisionHouseholdTokens}
                  disabled={savingHhTokens}
                  className="btn-primary"
                  style={{ padding: "9px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}
                >
                  {savingHhTokens
                    ? "Memproses..."
                    : Number(modalTokenDelta) !== 0
                    ? `💎 Top-Up ${
                        modalTokenDelta > 0 ? `+${formatCompactTokens(modalTokenDelta)}` : formatCompactTokens(modalTokenDelta)
                      } & Pasang Key`
                    : "⚡ Sinkronkan Dompet & Pasang Key AI"}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={modalAutoInjectKey}
                    onChange={(e) => setModalAutoInjectKey(e.target.checked)}
                  />
                  <span>
                    <strong>Auto-pasang API Key <code>sk-kb-*</code></strong> ke seluruh anggota
                    keluarga ini ({editingHh.members?.length ?? 0} orang)
                  </span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={modalForceNewKey}
                    onChange={(e) => setModalForceNewKey(e.target.checked)}
                  />
                  <span style={{ color: "var(--color-muted)" }}>
                    Generate kunci <code>sk-kb-*</code> baru (rotasi/tambah kunci baru di Gatekeeper)
                  </span>
                </label>
              </div>

              {lastProvisionedKey && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "9px 12px",
                    borderRadius: 9,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--color-border-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    🔑 {lastProvisionedKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(lastProvisionedKey);
                      showToast?.("📋 API Key sk-kb-* disalin!");
                    }}
                    className="btn-ghost"
                    style={{ padding: "4px 10px", fontSize: 11 }}
                  >
                    📋 Salin
                  </button>
                </div>
              )}
            </div>

            {/* 4. Override Add-on Satuan per Fitur */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>
                4. OVERRIDE FITUR SATUAN / ADD-ON (ENTITLEMENTS JSONB)
              </div>
              <div style={{ fontSize: 11.5, color: "var(--color-subtle)", marginBottom: 10 }}>
                Pilih <strong>Ikut Paket</strong> untuk mengikuti status tier di atas, atau{" "}
                <strong>Add-on Aktif</strong> untuk membuka fitur tertentu pada keluarga{" "}
                <code>free</code>.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PAID_FEATURES_META.map((feat) => {
                  const val = modalOverrides[feat.key] ?? null;
                  return (
                    <div
                      key={feat.key}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 11,
                        background: "var(--bg-surface-low)",
                        border: "1px solid var(--color-border-soft)",
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        alignItems: isMobile ? "stretch" : "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ fontSize: 18 }}>{feat.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{feat.label}</div>
                          <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{feat.desc}</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {[
                          { v: null, label: "Ikut Paket" },
                          { v: true, label: "✅ Add-on" },
                          { v: false, label: "🚫 Off" },
                        ].map((choice) => {
                          const selected = val === choice.v;
                          return (
                            <button
                              key={String(choice.v)}
                              type="button"
                              onClick={() =>
                                setModalOverrides((prev) => ({
                                  ...prev,
                                  [feat.key]: choice.v,
                                }))
                              }
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                border: `1px solid ${
                                  selected ? "var(--color-primary)" : "var(--color-border-soft)"
                                }`,
                                background: selected
                                  ? "var(--color-primary-soft)"
                                  : "var(--bg-surface)",
                                color: selected ? "var(--color-primary)" : "var(--color-muted)",
                              }}
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setEditingHh(null)}
                disabled={savingPlan || savingHhTokens}
                className="btn-ghost"
                style={{ padding: "10px 18px" }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={savingPlan || savingHhTokens}
                className="btn-primary"
                style={{ padding: "10px 22px", fontSize: 13.5 }}
              >
                {savingPlan ? "Menyimpan..." : "💾 Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
