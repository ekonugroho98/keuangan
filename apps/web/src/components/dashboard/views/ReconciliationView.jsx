import { useState, useEffect, useMemo } from "react";
import { fmtRp } from "@karaya/shared/format";
import { useReconciliation, useReconciliationDetail } from "../../../hooks/useReconciliation";
import { useHouseholdInfo } from "../../../hooks/useHouseholdInfo";
import { useIsMobile } from "../../../hooks/useIsMobile";

const SOURCE_LABELS = {
    bca_csv: "CSV BCA (KlikBCA / myBCA)",
    bri_csv: "CSV BRI (BRImo)",
    mandiri_csv: "CSV Mandiri (Livin')",
    gopay_csv: "CSV GoPay",
    vision: "Screenshot M-Banking (AI)",
    manual: "Input Teks / Manual",
};

const STATUS_BADGE = {
    unmatched: {
        label: "Belum Tercatat (Lupa Catat)",
        bg: "rgba(217, 119, 6, 0.14)",
        color: "#b45309",
        border: "rgba(217, 119, 6, 0.35)",
    },
    suggested: {
        label: "Mirip · Perlu Konfirmasi",
        bg: "rgba(37, 99, 235, 0.12)",
        color: "#1d4ed8",
        border: "rgba(37, 99, 235, 0.32)",
    },
    matched: {
        label: "Sudah Cocok",
        bg: "rgba(22, 163, 74, 0.13)",
        color: "#15803d",
        border: "rgba(22, 163, 74, 0.32)",
    },
    created: {
        label: "Sudah Dicatat dari Mutasi",
        bg: "rgba(13, 148, 136, 0.14)",
        color: "#0f766e",
        border: "rgba(13, 148, 136, 0.34)",
    },
    ignored: {
        label: "Diabaikan",
        bg: "rgba(100, 116, 139, 0.14)",
        color: "var(--color-muted)",
        border: "rgba(100, 116, 139, 0.28)",
    },
};

const ReconciliationView = ({ accounts = [], categories = [], onAdjustAccountBalance, showToast }) => {
    const isMobile = useIsMobile();
    const { household, isOwner, updateHousehold } = useHouseholdInfo();
    const reconEnabled = !!household?.features?.reconciliation?.enabled;

    const [selectedAccountId, setSelectedAccountId] = useState(() => accounts[0]?.id || "");
    const [inputMode, setInputMode] = useState("csv"); // "csv" | "vision" | "paste"
    const [csvText, setCsvText] = useState("");
    const [filename, setFilename] = useState("");
    const [busyImport, setBusyImport] = useState(false);
    const [busyToggle, setBusyToggle] = useState(false);
    const [activeImportId, setActiveImportId] = useState(null);
    const [statusFilter, setStatusFilter] = useState("all"); // "all" | "unmatched" | "suggested" | "matched" | "ignored"
    const [lineBusyId, setLineBusyId] = useState(null);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [lineDrafts, setLineDrafts] = useState({}); // { [lineId]: { category, note } }

    useEffect(() => {
        if (!selectedAccountId && accounts.length > 0) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts, selectedAccountId]);

    const {
        imports,
        importsLoading,
        importStatement,
        scanStatementImage,
        confirmLine,
        acceptLine,
        ignoreLine,
    } = useReconciliation(reconEnabled, undefined);

    useEffect(() => {
        if (!activeImportId && imports.length > 0) {
            setActiveImportId(imports[0].id);
        }
    }, [imports, activeImportId]);

    const { detail, detailLoading } = useReconciliationDetail(activeImportId, reconEnabled && !!activeImportId);

    const expenseCategories = useMemo(
        () => categories.filter((c) => !c.type || c.type === "expense" || c.type === "both"),
        [categories]
    );
    const incomeCategories = useMemo(
        () => categories.filter((c) => c.type === "income" || c.type === "both"),
        [categories]
    );

    const handleToggleFeature = async () => {
        if (!isOwner || busyToggle) return;
        setBusyToggle(true);
        try {
            const nextVal = !reconEnabled;
            await updateHousehold({
                features: {
                    reconciliation: { enabled: nextVal },
                },
            });
            showToast?.(
                nextVal
                    ? "Fitur Cek Mutasi Bank diaktifkan"
                    : "Fitur Cek Mutasi Bank dinonaktifkan"
            );
        } catch (e) {
            showToast?.(e.message || "Gagal mengubah pengaturan fitur", "error");
        } finally {
            setBusyToggle(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            setCsvText(text);
            setFilename(file.name);
            showToast?.(`File "${file.name}" siap dicocokkan`);
        } catch {
            showToast?.("Gagal membaca file CSV", "error");
        }
    };

    const handleLoadSampleCsv = () => {
        const today = new Date().toISOString().slice(0, 10);
        const y = today.slice(0, 4);
        const m = today.slice(5, 7);
        const sample = [
            "Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo",
            `${y}-${m}-05,"QRIS INDOMARET BELANJA DAPUR",0000,"68,500.00 DB","4,850,000.00"`,
            `${y}-${m}-08,"TRSF E-BANKING DB WARUNG SAYUR BU YANI",0000,"45,000.00 DB","4,805,000.00"`,
            `${y}-${m}-12,"BIAYA ADM BANK BULANAN",0000,"15,000.00 DB","4,790,000.00"`,
            `${y}-${m}-15,"QRIS KOPI KENANGAN",0000,"28,000.00 DB","4,762,000.00"`,
        ].join("\n");
        setCsvText(sample);
        setFilename(`contoh-mutasi-bca-${y}-${m}.csv`);
        setInputMode("paste");
        showToast?.("Contoh mutasi BCA dimuat — klik 'Cocokkan Mutasi Sekarang'");
    };

    const handleRunCsvImport = async () => {
        if (!selectedAccountId) {
            showToast?.("Pilih rekening bank / e-wallet terlebih dahulu", "error");
            return;
        }
        if (!csvText.trim()) {
            showToast?.("Pilih file CSV atau tempel isi mutasi terlebih dahulu", "error");
            return;
        }
        setBusyImport(true);
        try {
            const res = await importStatement({
                account_id: selectedAccountId,
                filename: filename || "mutasi-bank.csv",
                csv_text: csvText,
            });
            if (res?.import?.id) {
                setActiveImportId(res.import.id);
                setStatusFilter("all");
            }
            const s = res?.summary;
            showToast?.(
                `Selesai! ${s?.matched ?? 0} cocok otomatis, ${s?.unmatched_statement ?? 0} belum tercatat.`
            );
        } catch (e) {
            showToast?.(e.message || "Gagal memproses mutasi bank", "error");
        } finally {
            setBusyImport(false);
        }
    };

    const handleVisionUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!selectedAccountId) {
            showToast?.("Pilih rekening bank / e-wallet terlebih dahulu", "error");
            return;
        }
        setBusyImport(true);
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const str = String(reader.result || "");
                    resolve(str.includes(",") ? str.split(",")[1] : str);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const scanned = await scanStatementImage({
                image_base64: base64,
                mime_type: file.type || "image/jpeg",
            });
            const res = await importStatement({
                account_id: selectedAccountId,
                source: "vision",
                filename: file.name || "screenshot-mutasi.jpg",
                lines: scanned.lines,
            });
            if (res?.import?.id) {
                setActiveImportId(res.import.id);
                setStatusFilter("all");
            }
            showToast?.(
                `Berhasil membaca ${scanned.lines?.length || 0} baris mutasi dari gambar!`
            );
        } catch (e) {
            showToast?.(e.message || "Gagal membaca screenshot mutasi", "error");
        } finally {
            setBusyImport(false);
            e.target.value = "";
        }
    };

    const getDraft = (line) => {
        if (lineDrafts[line.id]) return lineDrafts[line.id];
        const defaultCat =
            line.direction === "in"
                ? incomeCategories[0]?.name || "Lainnya"
                : expenseCategories.find((c) => /lainnya/i.test(c.name))?.name ||
                  expenseCategories[0]?.name ||
                  "Lainnya";
        return {
            category: defaultCat,
            note: `[REKON] ${line.description}`,
        };
    };

    const updateDraft = (lineId, patch, line) => {
        setLineDrafts((prev) => ({
            ...prev,
            [lineId]: { ...getDraft(line), ...(prev[lineId] || {}), ...patch },
        }));
    };

    const handleAcceptLine = async (line) => {
        const draft = getDraft(line);
        setLineBusyId(line.id);
        try {
            await acceptLine(line.id, {
                category: draft.category,
                note: draft.note,
            });
            showToast?.(`Transaksi "${line.description}" berhasil dicatat!`);
        } catch (e) {
            showToast?.(e.message || "Gagal mencatat transaksi", "error");
        } finally {
            setLineBusyId(null);
        }
    };

    const handleConfirmLine = async (line) => {
        if (!line.matched_transaction?.id) return;
        setLineBusyId(line.id);
        try {
            await confirmLine(line.id, line.matched_transaction.id);
            showToast?.("Pasangan transaksi dikonfirmasi cocok");
        } catch (e) {
            showToast?.(e.message || "Gagal mengonfirmasi", "error");
        } finally {
            setLineBusyId(null);
        }
    };

    const handleIgnoreLine = async (line) => {
        setLineBusyId(line.id);
        try {
            await ignoreLine(line.id);
            showToast?.("Baris mutasi diabaikan");
        } catch (e) {
            showToast?.(e.message || "Gagal mengabaikan baris", "error");
        } finally {
            setLineBusyId(null);
        }
    };

    const handleAcceptAllUnmatched = async () => {
        const unmatched = (detail?.lines || []).filter((l) => l.match_status === "unmatched");
        if (unmatched.length === 0 || bulkBusy) return;
        setBulkBusy(true);
        let okCount = 0;
        let failMsg = "";
        // Urutkan uang masuk ('in') terlebih dahulu agar saldo akun mencukupi sebelum uang keluar ('out')
        const sorted = [...unmatched].sort((a, b) => (a.direction === "in" ? -1 : 1) - (b.direction === "in" ? -1 : 1));
        for (const line of sorted) {
            try {
                const draft = getDraft(line);
                await acceptLine(line.id, {
                    category: draft.category,
                    note: draft.note,
                });
                okCount++;
            } catch (e) {
                failMsg = e.message || "Sebagian gagal dicatat";
            }
        }
        setBulkBusy(false);
        if (okCount > 0) {
            showToast?.(`Berhasil mencatat ${okCount} transaksi yang terlewat!`);
        } else if (failMsg) {
            showToast?.(failMsg, "error");
        }
    };

    const filteredLines = useMemo(() => {
        const list = detail?.lines || [];
        if (statusFilter === "all") return list;
        if (statusFilter === "matched") {
            return list.filter((l) => l.match_status === "matched" || l.match_status === "created");
        }
        return list.filter((l) => l.match_status === statusFilter);
    }, [detail, statusFilter]);

    return (
        <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 40 }}>
            {/* Header & Saklar Aktif/Nonaktif */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                <div>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 800, color: "var(--color-text)" }}>
                        🔍 Cek Mutasi Bank & E-Wallet
                    </h2>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                        Temukan pengeluaran yang lupa dicatat dengan mencocokkan CSV atau screenshot mutasi BCA, BRI, Mandiri, & GoPay.
                    </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                        type="button"
                        disabled={!isOwner || busyToggle}
                        onClick={handleToggleFeature}
                        style={{
                            padding: "7px 14px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isOwner ? "pointer" : "not-allowed",
                            border: reconEnabled
                                ? "1px solid rgba(22, 163, 74, 0.4)"
                                : "1px solid var(--glass-border)",
                            background: reconEnabled
                                ? "rgba(22, 163, 74, 0.14)"
                                : "var(--bg-surface-low)",
                            color: reconEnabled ? "#15803d" : "var(--color-muted)",
                        }}
                    >
                        {reconEnabled ? "✓ Fitur Aktif" : "Nonaktif (Klik untuk Aktifkan)"}
                    </button>
                </div>
            </div>

            {!reconEnabled ? (
                <div
                    style={{
                        padding: 24,
                        borderRadius: 16,
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        textAlign: "center",
                    }}
                >
                    <div style={{ fontSize: 34, marginBottom: 8 }}>🏦</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
                        Fitur Rekonsiliasi Mutasi Bank Sedang Nonaktif
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-muted)", maxWidth: 520, margin: "0 auto 16px", lineHeight: 1.5 }}>
                        Aktifkan fitur ini saat Anda ingin mencocokkan mutasi rekening akhir bulan agar tidak ada pengeluaran keluarga yang terlewat.
                    </div>
                    {isOwner && (
                        <button
                            type="button"
                            onClick={handleToggleFeature}
                            disabled={busyToggle}
                            style={{
                                padding: "10px 20px",
                                borderRadius: 10,
                                border: "none",
                                background: "var(--color-primary)",
                                color: "var(--color-on-primary)",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {busyToggle ? "Mengaktifkan..." : "Aktifkan Cek Mutasi Bank Sekarang"}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Panel Impor Mutasi */}
                    <div
                        style={{
                            padding: isMobile ? 14 : 18,
                            borderRadius: 16,
                            background: "var(--glass-bg)",
                            border: "1px solid var(--glass-border)",
                            marginBottom: 18,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 12,
                                alignItems: "flex-end",
                                marginBottom: 14,
                            }}
                        >
                            <div style={{ flex: "1 1 220px" }}>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--color-muted)",
                                        marginBottom: 5,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    1. Pilih Rekening yang Mau Dicek
                                </label>
                                <select
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: "1px solid var(--color-border)",
                                        background: "var(--bg-surface-low)",
                                        color: "var(--color-text)",
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}
                                >
                                    {accounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({fmtRp(acc.balance || 0)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {[
                                    { id: "csv", label: "📄 File CSV Bank" },
                                    { id: "vision", label: "📸 Screenshot M-Banking" },
                                    { id: "paste", label: "✍️ Tempel Teks / Coba Contoh" },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setInputMode(tab.id)}
                                        style={{
                                            padding: "9px 13px",
                                            borderRadius: 10,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            border:
                                                inputMode === tab.id
                                                    ? "1px solid var(--color-primary)"
                                                    : "1px solid var(--glass-border)",
                                            background:
                                                inputMode === tab.id
                                                    ? "var(--color-primary)"
                                                    : "var(--bg-surface-low)",
                                            color:
                                                inputMode === tab.id
                                                    ? "var(--color-on-primary)"
                                                    : "var(--color-text)",
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {inputMode === "csv" && (
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: 14,
                                    borderRadius: 12,
                                    background: "var(--bg-surface-low)",
                                    border: "1px dashed var(--color-border)",
                                }}
                            >
                                <div style={{ flex: "1 1 260px" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                                        Pilih File CSV Mutasi Rekening (KlikBCA, myBCA, BRImo, Livin' Mandiri, GoPay)
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 3 }}>
                                        {filename
                                            ? `Terpilih: ${filename} (${csvText.split("\n").length} baris)`
                                            : "Format kolom tanggal, keterangan, dan nominal otomatis dikenali."}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <label
                                        style={{
                                            padding: "9px 14px",
                                            borderRadius: 10,
                                            border: "1px solid var(--color-border)",
                                            background: "var(--glass-bg)",
                                            color: "var(--color-text)",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        📂 Pilih File CSV
                                        <input
                                            type="file"
                                            accept=".csv,.txt"
                                            onChange={handleFileChange}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleLoadSampleCsv}
                                        style={{
                                            padding: "9px 12px",
                                            borderRadius: 10,
                                            border: "1px solid var(--glass-border)",
                                            background: "transparent",
                                            color: "var(--color-muted)",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        📋 Coba Contoh CSV BCA
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!csvText.trim() || busyImport}
                                        onClick={handleRunCsvImport}
                                        style={{
                                            padding: "9px 16px",
                                            borderRadius: 10,
                                            border: "none",
                                            background: "var(--color-primary)",
                                            color: "var(--color-on-primary)",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: !csvText.trim() || busyImport ? "not-allowed" : "pointer",
                                            opacity: !csvText.trim() || busyImport ? 0.6 : 1,
                                        }}
                                    >
                                        {busyImport ? "Memproses..." : "🔍 Cocokkan Mutasi Sekarang"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {inputMode === "vision" && (
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: 14,
                                    borderRadius: 12,
                                    background: "var(--bg-surface-low)",
                                    border: "1px dashed var(--color-border)",
                                }}
                            >
                                <div style={{ flex: "1 1 260px" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                                        📸 Upload Screenshot Mutasi dari HP (m-BCA / BRImo / Livin' / GoPay)
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 3 }}>
                                        Malas ekspor CSV? Cukup screenshot halaman riwayat mutasi di aplikasi bank Anda, AI akan membacakan barisnya otomatis.
                                    </div>
                                </div>
                                <label
                                    style={{
                                        padding: "10px 16px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: "var(--color-primary)",
                                        color: "var(--color-on-primary)",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: busyImport ? "not-allowed" : "pointer",
                                        opacity: busyImport ? 0.6 : 1,
                                    }}
                                >
                                    {busyImport ? "⏳ Membaca Gambar..." : "📸 Pilih Screenshot Mutasi"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        disabled={busyImport}
                                        onChange={handleVisionUpload}
                                        style={{ display: "none" }}
                                    />
                                </label>
                            </div>
                        )}

                        {inputMode === "paste" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <textarea
                                    rows={5}
                                    value={csvText}
                                    onChange={(e) => setCsvText(e.target.value)}
                                    placeholder={'Tempel isi CSV atau ketik per baris:\nTanggal,Keterangan,Jumlah\n2026-10-15,QRIS INDOMARET,45000 DB'}
                                    style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        padding: 12,
                                        borderRadius: 10,
                                        border: "1px solid var(--color-border)",
                                        background: "var(--bg-surface-low)",
                                        color: "var(--color-text)",
                                        fontSize: 12,
                                        fontFamily: "monospace",
                                    }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                    <button
                                        type="button"
                                        onClick={handleLoadSampleCsv}
                                        style={{
                                            padding: "8px 12px",
                                            borderRadius: 8,
                                            border: "1px solid var(--glass-border)",
                                            background: "transparent",
                                            color: "var(--color-muted)",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        📋 Isi dengan Contoh Mutasi BCA
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!csvText.trim() || busyImport}
                                        onClick={handleRunCsvImport}
                                        style={{
                                            padding: "9px 18px",
                                            borderRadius: 10,
                                            border: "none",
                                            background: "var(--color-primary)",
                                            color: "var(--color-on-primary)",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: !csvText.trim() || busyImport ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        {busyImport ? "Memproses..." : "🔍 Cocokkan Mutasi Sekarang"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pemilih Riwayat Impor */}
                    {imports.length > 0 && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                overflowX: "auto",
                                paddingBottom: 8,
                                marginBottom: 14,
                            }}
                        >
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                                Riwayat Cek:
                            </span>
                            {imports.map((imp) => {
                                const active = imp.id === activeImportId;
                                return (
                                    <button
                                        key={imp.id}
                                        type="button"
                                        onClick={() => setActiveImportId(imp.id)}
                                        style={{
                                            padding: "7px 12px",
                                            borderRadius: 999,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            whiteSpace: "nowrap",
                                            cursor: "pointer",
                                            border: active
                                                ? "1px solid var(--color-primary)"
                                                : "1px solid var(--glass-border)",
                                            background: active ? "var(--color-primary)" : "var(--glass-bg)",
                                            color: active ? "var(--color-on-primary)" : "var(--color-text)",
                                        }}
                                    >
                                        🏦 {imp.account?.name} · {imp.period_from || ""} ({imp.line_count} baris)
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Detail Hasil Pencocokan */}
                    {detailLoading || importsLoading ? (
                        <div style={{ padding: 30, textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
                            Memuat hasil pencocokan mutasi...
                        </div>
                    ) : detail ? (
                        <div>
                            {/* Kartu Ringkasan 4 Kotak */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
                                    gap: 10,
                                    marginBottom: 14,
                                }}
                            >
                                <div
                                    onClick={() => setStatusFilter("unmatched")}
                                    style={{
                                        padding: 14,
                                        borderRadius: 14,
                                        background: "rgba(217, 119, 6, 0.1)",
                                        border:
                                            statusFilter === "unmatched"
                                                ? "2px solid #d97706"
                                                : "1px solid rgba(217, 119, 6, 0.3)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>
                                        ⚠️ BELUM TERCATAT (LUPA CATAT)
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: "#b45309", marginTop: 4 }}>
                                        {detail.summary?.unmatched_statement ?? 0}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                                        Ada di bank, belum ada di aplikasi
                                    </div>
                                </div>

                                <div
                                    onClick={() => setStatusFilter("suggested")}
                                    style={{
                                        padding: 14,
                                        borderRadius: 14,
                                        background: "rgba(37, 99, 235, 0.08)",
                                        border:
                                            statusFilter === "suggested"
                                                ? "2px solid #2563eb"
                                                : "1px solid rgba(37, 99, 235, 0.25)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>
                                        🤔 MIRIP / KONFIRMASI
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: "#1d4ed8", marginTop: 4 }}>
                                        {detail.summary?.suggested ?? 0}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                                        Nominal sama, tanggal beda tipis
                                    </div>
                                </div>

                                <div
                                    onClick={() => setStatusFilter("matched")}
                                    style={{
                                        padding: 14,
                                        borderRadius: 14,
                                        background: "rgba(22, 163, 74, 0.09)",
                                        border:
                                            statusFilter === "matched"
                                                ? "2px solid #16a34a"
                                                : "1px solid rgba(22, 163, 74, 0.28)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>
                                        ✅ SUDAH COCOK / TERCATAT
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d", marginTop: 4 }}>
                                        {(detail.summary?.matched ?? 0) + (detail.summary?.created ?? 0)}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                                        Klop antara bank & aplikasi
                                    </div>
                                </div>

                                <div
                                    onClick={() => setStatusFilter("all")}
                                    style={{
                                        padding: 14,
                                        borderRadius: 14,
                                        background: "var(--glass-bg)",
                                        border:
                                            statusFilter === "all"
                                                ? "2px solid var(--color-primary)"
                                                : "1px solid var(--glass-border)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)" }}>
                                        📋 TOTAL BARIS MUTASI
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                                        {detail.lines?.length ?? 0}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                                        {SOURCE_LABELS[detail.import?.source] || detail.import?.source}
                                    </div>
                                </div>
                            </div>

                            {/* Perbandingan Saldo Akhir Bank vs Saldo Aplikasi */}
                            {detail.balance_comparison?.statement_ending_balance != null && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 10,
                                        padding: "12px 16px",
                                        borderRadius: 12,
                                        background: "var(--bg-surface-low)",
                                        border: "1px solid var(--glass-border)",
                                        marginBottom: 14,
                                    }}
                                >
                                    <div style={{ fontSize: 12, color: "var(--color-text)" }}>
                                        Saldo Akhir di Mutasi Bank:{" "}
                                        <strong>{fmtRp(detail.balance_comparison.statement_ending_balance)}</strong>
                                        {" · "}
                                        Saldo {detail.import?.account?.name} di Aplikasi:{" "}
                                        <strong>{fmtRp(detail.balance_comparison.karaya_balance)}</strong>
                                        {detail.balance_comparison.diff !== 0 && (
                                            <span style={{ color: "#b45309", fontWeight: 700, marginLeft: 8 }}>
                                                (Selisih {fmtRp(Math.abs(detail.balance_comparison.diff))})
                                            </span>
                                        )}
                                    </div>
                                    {detail.balance_comparison.diff !== 0 && onAdjustAccountBalance && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await onAdjustAccountBalance(
                                                        detail.import.account.id,
                                                        detail.balance_comparison.statement_ending_balance,
                                                        "Penyesuaian saldo akhir rekonsiliasi mutasi bank"
                                                    );
                                                    showToast?.("Saldo rekening disamakan dengan saldo akhir mutasi bank!");
                                                } catch (e) {
                                                    showToast?.(e.message || "Gagal menyamakan saldo", "error");
                                                }
                                            }}
                                            style={{
                                                padding: "7px 12px",
                                                borderRadius: 8,
                                                border: "1px solid var(--color-primary)",
                                                background: "transparent",
                                                color: "var(--color-primary)",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            ⚖️ Samakan Saldo ke {fmtRp(detail.balance_comparison.statement_ending_balance)}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Bar Filter & Tombol Catat Semua yang Terlewat */}
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    marginBottom: 12,
                                }}
                            >
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {[
                                        { id: "all", label: "Semua Baris" },
                                        { id: "unmatched", label: `Belum Tercatat (${detail.summary?.unmatched_statement ?? 0})` },
                                        { id: "suggested", label: `Perlu Konfirmasi (${detail.summary?.suggested ?? 0})` },
                                        { id: "matched", label: `Sudah Cocok (${(detail.summary?.matched ?? 0) + (detail.summary?.created ?? 0)})` },
                                        { id: "ignored", label: `Diabaikan (${detail.summary?.ignored ?? 0})` },
                                    ].map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => setStatusFilter(f.id)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 999,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                border:
                                                    statusFilter === f.id
                                                        ? "1px solid var(--color-primary)"
                                                        : "1px solid var(--glass-border)",
                                                background:
                                                    statusFilter === f.id
                                                        ? "var(--color-primary)"
                                                        : "var(--bg-surface-low)",
                                                color:
                                                    statusFilter === f.id
                                                        ? "var(--color-on-primary)"
                                                        : "var(--color-text)",
                                            }}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {(detail.summary?.unmatched_statement ?? 0) > 0 && (
                                    <button
                                        type="button"
                                        disabled={bulkBusy}
                                        onClick={handleAcceptAllUnmatched}
                                        style={{
                                            padding: "8px 14px",
                                            borderRadius: 10,
                                            border: "none",
                                            background: "var(--color-primary)",
                                            color: "var(--color-on-primary)",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: bulkBusy ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        {bulkBusy
                                            ? "Mencatat Semua..."
                                            : `⚡ Catat Semua yang Terlewat (${detail.summary.unmatched_statement})`}
                                    </button>
                                )}
                            </div>

                            {/* Daftar Baris Mutasi */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {filteredLines.map((line) => {
                                    const badge = STATUS_BADGE[line.match_status] || STATUS_BADGE.unmatched;
                                    const draft = getDraft(line);
                                    const catOptions = line.direction === "in" ? incomeCategories : expenseCategories;
                                    const isBusy = lineBusyId === line.id;

                                    return (
                                        <div
                                            key={line.id}
                                            style={{
                                                padding: isMobile ? 12 : 14,
                                                borderRadius: 14,
                                                background: "var(--glass-bg)",
                                                border: "1px solid var(--glass-border)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 10,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 8,
                                                }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            padding: "3px 8px",
                                                            borderRadius: 6,
                                                            background: "var(--bg-surface-low)",
                                                            color: "var(--color-muted)",
                                                        }}
                                                    >
                                                        📅 {line.date}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            padding: "3px 9px",
                                                            borderRadius: 999,
                                                            background: badge.bg,
                                                            color: badge.color,
                                                            border: `1px solid ${badge.border}`,
                                                        }}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                </div>

                                                <div
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: 800,
                                                        color: line.direction === "in" ? "#15803d" : "var(--color-text)",
                                                    }}
                                                >
                                                    {line.direction === "in" ? "+" : "-"}
                                                    {fmtRp(line.amount)}
                                                </div>
                                            </div>

                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                                                {line.description}
                                            </div>

                                            {/* Jika sudah cocok atau suggested, tampilkan pasangan transaksi Karaya */}
                                            {line.matched_transaction && (
                                                <div
                                                    style={{
                                                        padding: "8px 12px",
                                                        borderRadius: 10,
                                                        background: "var(--bg-surface-low)",
                                                        fontSize: 12,
                                                        color: "var(--color-muted)",
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <span>
                                                        🔗 Catatan Aplikasi:{" "}
                                                        <strong style={{ color: "var(--color-text)" }}>
                                                            {line.matched_transaction.note}
                                                        </strong>{" "}
                                                        ({line.matched_transaction.category_name} · {line.matched_transaction.date})
                                                    </span>
                                                    {line.match_confidence != null && (
                                                        <span style={{ fontSize: 11 }}>
                                                            Skor kemiripan: {line.match_confidence}%
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Aksi untuk baris yang belum selesai (unmatched / suggested) */}
                                            {(line.match_status === "unmatched" || line.match_status === "suggested") && (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        paddingTop: 6,
                                                        borderTop: "1px solid var(--glass-border)",
                                                    }}
                                                >
                                                    {line.match_status === "suggested" && line.matched_transaction && (
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            onClick={() => handleConfirmLine(line)}
                                                            style={{
                                                                padding: "7px 12px",
                                                                borderRadius: 8,
                                                                border: "none",
                                                                background: "#2563eb",
                                                                color: "#fff",
                                                                fontSize: 12,
                                                                fontWeight: 700,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            ✓ Ya, Ini Transaksi yang Sama
                                                        </button>
                                                    )}

                                                    <select
                                                        value={draft.category}
                                                        onChange={(e) =>
                                                            updateDraft(line.id, { category: e.target.value }, line)
                                                        }
                                                        style={{
                                                            padding: "7px 10px",
                                                            borderRadius: 8,
                                                            border: "1px solid var(--color-border)",
                                                            background: "var(--bg-surface-low)",
                                                            color: "var(--color-text)",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {catOptions.map((c) => (
                                                            <option key={c.id || c.name} value={c.name}>
                                                                {c.icon ? `${c.icon} ` : ""}
                                                                {c.name}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <input
                                                        type="text"
                                                        value={draft.note}
                                                        onChange={(e) =>
                                                            updateDraft(line.id, { note: e.target.value }, line)
                                                        }
                                                        placeholder="Catatan transaksi..."
                                                        style={{
                                                            flex: "1 1 180px",
                                                            padding: "7px 10px",
                                                            borderRadius: 8,
                                                            border: "1px solid var(--color-border)",
                                                            background: "var(--bg-surface-low)",
                                                            color: "var(--color-text)",
                                                            fontSize: 12,
                                                        }}
                                                    />

                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => handleAcceptLine(line)}
                                                        style={{
                                                            padding: "7px 13px",
                                                            borderRadius: 8,
                                                            border: "none",
                                                            background: "var(--color-primary)",
                                                            color: "var(--color-on-primary)",
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        {isBusy ? "Menyimpan..." : "+ Catat ke Transaksi"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => handleIgnoreLine(line)}
                                                        style={{
                                                            padding: "7px 11px",
                                                            borderRadius: 8,
                                                            border: "1px solid var(--glass-border)",
                                                            background: "transparent",
                                                            color: "var(--color-muted)",
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Abaikan
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                padding: 28,
                                borderRadius: 16,
                                background: "var(--glass-bg)",
                                border: "1px solid var(--glass-border)",
                                textAlign: "center",
                                color: "var(--color-muted)",
                                fontSize: 13,
                            }}
                        >
                            Belum ada mutasi bank yang diimpor. Pilih rekening di atas lalu unggah CSV mutasi, screenshot M-Banking, atau klik{" "}
                            <strong
                                onClick={handleLoadSampleCsv}
                                style={{ color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" }}
                            >
                                Coba Contoh CSV BCA
                            </strong>{" "}
                            untuk melihat cara kerjanya!
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ReconciliationView;
