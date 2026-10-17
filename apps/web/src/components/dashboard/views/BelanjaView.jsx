import { useState, useMemo, useEffect, useCallback } from "react";
import { useShopping, useShoppingSuggestions, comparePrices, mergeProducts } from "../../../hooks/useShopping";
import { fmtRp } from "../../../utils/formatters";
import { useHouseholdInfo } from "../../../hooks/useHouseholdInfo";

const glassCard = {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    padding: "22px 24px",
    background: "var(--glass-1)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-highlight), 0 2px 8px rgba(0,0,0,.08)",
};

const eyebrow = {
    fontSize: 10,
    fontWeight: 800,
    color: "var(--color-subtle)",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    lineHeight: 1,
};

const itemCard = {
    padding: "12px 14px",
    borderRadius: 14,
    background: "var(--bg-surface-low)",
    border: "1px solid var(--glass-border)",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 12,
    transition: "border-color .15s, background .15s",
};

const checkBtn = (checked) => ({
    width: 24,
    height: 24,
    borderRadius: 8,
    flexShrink: 0,
    cursor: "pointer",
    border: "2px solid " + (checked ? "var(--color-primary)" : "var(--glass-border)"),
    background: checked ? "var(--color-primary)" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    color: "var(--color-on-primary)",
    fontWeight: 800,
});

const inputSt = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    borderRadius: 12,
    border: "1px solid var(--color-border)",
    background: "var(--bg-surface-low)",
    color: "var(--color-text)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
};

const modalOverlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
    padding: 16,
};

const modalBox = {
    background: "var(--bg-surface)",
    borderRadius: 18,
    padding: 22,
    width: "100%",
    maxWidth: 420,
    border: "1px solid var(--glass-border)",
    boxShadow: "0 20px 50px rgba(0,0,0,.35)",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const shortDate = (d) => {
    const [, m, day] = (d || "").split("-");
    return day ? `${Number(day)} ${MONTHS[Number(m) - 1] || m}` : "";
};
const basisShort = (b) => (b || "").replace("per ", "/");

/** Baris "termurah di …" untuk item daftar belanja (field `cheapest` dari GET /v1/shopping). */
const CheapestLine = ({ c, onCompare }) => {
    if (!c) return null;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 600 }}>
                💰 {c.stores > 1 ? "Termurah" : "Terakhir"} di <strong>{c.merchant}</strong>: {fmtRp(c.price)}
                {c.size ? ` (${c.size})` : ""} · {fmtRp(c.per_unit_price)}{basisShort(c.compare_basis)} · {shortDate(c.last_date)}
                {c.stores > 1 ? ` · ${c.stores} toko` : ""}
            </span>
            {onCompare && (
                <button
                    onClick={onCompare}
                    style={{
                        padding: "2px 8px",
                        borderRadius: 99,
                        border: "1px solid var(--color-primary-soft)",
                        background: "var(--color-primary-soft)",
                        color: "var(--color-primary)",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    ⚖️ Bandingkan
                </button>
            )}
        </div>
    );
};

/**
 * Panel Banding Harga Antar Toko (10-fitur-opsional-keluarga.md §6.8).
 * Mendukung mode Katalog otomatis (tanpa ketik query), filter >1 toko, indikator tren historis,
 * dan penggabungan nama produk (mergeProducts / POST /v1/prices/aliases + product_knowledge global).
 */
const PriceComparePanel = ({ toast, quickItems = [], externalQuery, onExternalQueryHandled, onAliasSaved }) => {
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [filterMode, setFilterMode] = useState("all"); // "all" | "multi"
    const [showMerge, setShowMerge] = useState(false);
    const [mergeItem, setMergeItem] = useState("");
    const [mergeTarget, setMergeTarget] = useState("");
    const [merging, setMerging] = useState(false);

    const runQuery = useCallback(async (rawQuery) => {
        const query = (rawQuery ?? "").trim();
        if (query.length === 1) {
            toast("Masukkan minimal 2 huruf untuk mencari produk, atau kosongkan untuk melihat katalog.", "error");
            return;
        }
        setQ(query);
        setLoading(true);
        try {
            setResult(await comparePrices(query));
        } catch (err) {
            toast(err.message || "Gagal memuat perbandingan harga", "error");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // Muat katalog otomatis saat pertama kali dibuka
    useEffect(() => {
        runQuery("");
    }, [runQuery]);

    useEffect(() => {
        if (externalQuery && externalQuery !== q && !loading) {
            const target = externalQuery;
            onExternalQueryHandled?.();
            runQuery(target);
        }
    }, [externalQuery, q, loading, onExternalQueryHandled, runQuery]);

    const handleMergeSubmit = async () => {
        const item = mergeItem.trim();
        const sameAs = mergeTarget.trim();
        if (item.length < 2 || sameAs.length < 2) {
            toast("Nama item struk dan nama produk tujuan minimal 2 huruf.", "error");
            return;
        }
        setMerging(true);
        try {
            const res = await mergeProducts(item, sameAs);
            toast(`✅ "${res.keyword}" disamakan menjadi "${res.canonical_name}"`);
            setMergeItem("");
            setMergeTarget("");
            setShowMerge(false);
            await runQuery(q);
            onAliasSaved?.();
        } catch (err) {
            toast(err.message || "Gagal menyamakan produk", "error");
        } finally {
            setMerging(false);
        }
    };

    const cleanChipName = (name) =>
        name.replace(/\s*\([^)]*\)\s*/g, "").trim();

    const allProducts = result?.products ?? [];
    const multiStoreCount = allProducts.filter((p) => p.stores.length > 1).length;
    const displayedProducts = filterMode === "multi"
        ? allProducts.filter((p) => p.stores.length > 1)
        : allProducts;

    return (
        <div style={glassCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div>
                    <div style={eyebrow}>RIWAYAT STRUK &amp; KAMUS PRODUK</div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: "6px 0 6px", letterSpacing: "-.02em" }}>
                        ⚖️ Banding Harga Antar Toko
                    </h3>
                </div>
                <button
                    onClick={() => setShowMerge((v) => !v)}
                    style={{
                        padding: "6px 11px",
                        borderRadius: 10,
                        border: "1px solid var(--glass-border)",
                        background: showMerge ? "var(--color-primary-soft)" : "var(--bg-surface-low)",
                        color: showMerge ? "var(--color-primary)" : "var(--color-muted)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                    }}
                    title="Gabungkan dua nama barang berbeda di struk menjadi satu produk yang sama"
                >
                    🔗 Samakan Nama
                </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 14, lineHeight: 1.5 }}>
                Dihitung per satuan (<span className="mono">100g</span> / <span className="mono">100ml</span> / <span className="mono">pcs</span>) dari struk belanja supaya beda ukuran kemasan tetap adil. Kamus singkatan produk otomatis dibagi lintas keluarga.
            </div>

            {/* Form Samakan / Gabungkan Nama Produk */}
            {showMerge && (
                <div style={{ padding: 14, borderRadius: 14, background: "rgba(131,155,122,.08)", border: "1px solid rgba(131,155,122,.28)", marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text)", marginBottom: 4 }}>
                        🔗 Gabungkan Singkatan Struk ke Produk yang Sama
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.4 }}>
                        Jika 1 produk yang sama tertulis beda di struk (mis. <span className="mono">LFBY BS 85G</span> vs <span className="mono">lifebuoy sabun batang</span>), samakan di sini agar harganya diadu dalam 1 kartu.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                            style={{ ...inputSt, padding: "9px 12px", fontSize: 12 }}
                            placeholder="Nama/singkatan di struk (mis. LFBY BS 85G atau INDM GRG)..."
                            value={mergeItem}
                            onChange={(e) => setMergeItem(e.target.value)}
                        />
                        <input
                            style={{ ...inputSt, padding: "9px 12px", fontSize: 12 }}
                            placeholder="Samakan dengan nama produk (mis. lifebuoy sabun batang)..."
                            value={mergeTarget}
                            onChange={(e) => setMergeTarget(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleMergeSubmit(); }}
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setShowMerge(false)}
                                style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid var(--glass-border)", background: "transparent", color: "var(--color-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleMergeSubmit}
                                disabled={merging}
                                style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                            >
                                {merging ? "Menyimpan..." : "Simpan & Gabungkan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                    style={inputSt}
                    placeholder="Cari produk (mis. kecap, susu, minyak) atau kosongkan..."
                    value={q}
                    onChange={(e) => {
                        const val = e.target.value;
                        setQ(val);
                        if (val.trim() === "") runQuery("");
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") runQuery(q); }}
                />
                {q && (
                    <button
                        onClick={() => runQuery("")}
                        title="Reset ke katalog semua produk"
                        style={{
                            padding: "0 12px",
                            borderRadius: 12,
                            border: "1px solid var(--glass-border)",
                            background: "var(--bg-surface-low)",
                            color: "var(--color-muted)",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        ✕
                    </button>
                )}
                <button
                    onClick={() => runQuery(q)}
                    disabled={loading}
                    style={{
                        padding: "0 18px",
                        borderRadius: 12,
                        border: "1px solid var(--color-primary)",
                        background: "var(--color-primary-soft)",
                        color: "var(--color-primary)",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                    }}
                >
                    {loading ? "..." : "Cek Harga"}
                </button>
            </div>

            {/* Filter Mode Tabs (Semua vs Bisa Hemat >1 Toko) */}
            {allProducts.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button
                            onClick={() => setFilterMode("all")}
                            style={{
                                padding: "5px 11px",
                                borderRadius: 99,
                                border: filterMode === "all" ? "1px solid var(--color-primary)" : "1px solid var(--glass-border)",
                                background: filterMode === "all" ? "var(--color-primary-soft)" : "var(--bg-surface-low)",
                                color: filterMode === "all" ? "var(--color-primary)" : "var(--color-muted)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Semua Produk ({allProducts.length})
                        </button>
                        <button
                            onClick={() => setFilterMode("multi")}
                            style={{
                                padding: "5px 11px",
                                borderRadius: 99,
                                border: filterMode === "multi" ? "1px solid var(--color-primary)" : "1px solid var(--glass-border)",
                                background: filterMode === "multi" ? "var(--color-primary-soft)" : "var(--bg-surface-low)",
                                color: filterMode === "multi" ? "var(--color-primary)" : "var(--color-muted)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            🔥 Beda Toko / Bisa Hemat ({multiStoreCount})
                        </button>
                    </div>
                    {result?.query && (
                        <button
                            onClick={() => runQuery("")}
                            style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        >
                            ↺ Lihat Katalog Semua
                        </button>
                    )}
                </div>
            )}

            {quickItems.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-subtle)", marginBottom: 6 }}>
                        CEK CEPAT DARI DAFTAR BELANJA:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {quickItems.slice(0, 8).map((item) => {
                            const label = cleanChipName(item.name);
                            if (label.length < 2) return null;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => runQuery(label)}
                                    style={{
                                        padding: "4px 10px",
                                        borderRadius: 99,
                                        border: "1px solid var(--glass-border)",
                                        background: "var(--bg-surface-low)",
                                        color: "var(--color-muted)",
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    🔍 {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--color-muted)", fontSize: 12 }}>
                    Memuat data perbandingan harga...
                </div>
            )}

            {!loading && displayedProducts.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--color-muted)", padding: "18px 14px", borderRadius: 12, background: "var(--bg-surface-low)", border: "1px solid var(--glass-border)", textAlign: "center" }}>
                    {filterMode === "multi" && allProducts.length > 0 ? (
                        <>
                            Belum ada produk yang tercatat di 2 toko berbeda untuk pencarian ini. Klik <strong>Semua Produk ({allProducts.length})</strong> untuk melihat riwayat harga 1 toko.
                        </>
                    ) : result?.query ? (
                        <>
                            Belum ada riwayat harga untuk <strong>"{result.query}"</strong>. Harga tercatat otomatis setiap kali struk belanja disimpan atau transaksi diberi nama toko <span className="mono">[Nama Toko] Nama Barang</span>.
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.45 }}>🏷️</div>
                            Belum ada riwayat harga produk. Scan struk belanja atau catat pengeluaran dengan nama toko untuk mulai membangun database harga keluarga.
                        </>
                    )}
                </div>
            )}

            {!loading && displayedProducts.map((p) => (
                <div key={`${p.product_name}-${p.unit}`} style={{ ...itemCard, display: "block", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", textTransform: "capitalize" }}>
                                {p.product_name}
                            </div>
                            <span style={{ fontSize: 10, color: "var(--color-subtle)", padding: "2px 7px", borderRadius: 99, background: "rgba(255,255,255,.04)", border: "1px solid var(--glass-border)" }}>
                                {p.compare_basis}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {p.savings_pct ? (
                                <span className="chip chip-mint" style={{ fontSize: 10, padding: "3px 9px" }}>
                                    Hemat {p.savings_pct}%
                                </span>
                            ) : null}
                            <button
                                onClick={() => {
                                    setShowMerge(true);
                                    if (!mergeItem) setMergeItem(p.product_name);
                                    else setMergeTarget(p.product_name);
                                }}
                                title="Samakan produk ini dengan nama item lain"
                                style={{
                                    background: "none",
                                    border: "1px solid var(--glass-border)",
                                    borderRadius: 99,
                                    padding: "2px 7px",
                                    fontSize: 10,
                                    color: "var(--color-muted)",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                🔗
                            </button>
                        </div>
                    </div>
                    {p.stores.map((s, i) => {
                        const isHistoricalLow = s.observations > 1 && s.per_unit_price <= s.lowest_per_unit_price;
                        const isAboveHistoricalLow = s.observations > 1 && s.per_unit_price > s.lowest_per_unit_price;
                        return (
                            <div
                                key={s.merchant}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 12,
                                    padding: "7px 0",
                                    borderTop: i ? "1px solid var(--glass-border)" : "none",
                                }}
                            >
                                <div style={{ color: "var(--color-text)", minWidth: 0 }}>
                                    <div>
                                        <span style={{ fontWeight: i === 0 ? 800 : 600 }}>
                                            {i === 0 && p.stores.length > 1 ? "🏆 " : ""}{s.merchant}
                                        </span>
                                        <span style={{ color: "var(--color-muted)" }}>
                                            {" "}· {fmtRp(s.price)}{s.size ? ` (${s.size})` : ""} · {shortDate(s.last_date)}
                                            {s.observations > 1 ? ` · ${s.observations}x beli` : ""}
                                        </span>
                                    </div>
                                    {isHistoricalLow && (
                                        <div style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 700, marginTop: 2 }}>
                                            🔥 Harga termurah historis di toko ini
                                        </div>
                                    )}
                                    {isAboveHistoricalLow && (
                                        <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, marginTop: 2 }}>
                                            ↗ Naik dari rekor termurah {fmtRp(s.lowest_per_unit_price)}{basisShort(p.compare_basis)}
                                        </div>
                                    )}
                                </div>
                                <div className="mono num-tight" style={{ fontWeight: 800, color: i === 0 ? "var(--color-primary)" : "var(--color-text)", whiteSpace: "nowrap" }}>
                                    {fmtRp(s.per_unit_price)}{basisShort(p.compare_basis)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

const BelanjaView = ({ showToast, setActiveMenu }) => {
    const { household } = useHouseholdInfo();
    const enabled = !!household?.features?.shopping_stock?.enabled;
    const { needed, bought, shoppingLoading, addItem, updateItem, markBought, markNeeded, deleteItem } = useShopping(enabled);
    const { suggestions } = useShoppingSuggestions(enabled);

    const [newName, setNewName] = useState("");
    const [newQty, setNewQty] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [search, setSearch] = useState("");
    const [storeFilter, setStoreFilter] = useState("");
    const [showBought, setShowBought] = useState(false);
    const [editModal, setEditModal] = useState(null);
    const [compareTarget, setCompareTarget] = useState("");

    const stats = useMemo(() => {
        let estTotal = 0;
        let pricedCount = 0;
        const byStore = new Map();
        for (const item of needed) {
            if (item.cheapest?.price) {
                estTotal += item.cheapest.price;
                pricedCount += 1;
                const m = item.cheapest.merchant;
                const cur = byStore.get(m) || { merchant: m, count: 0, total: 0, items: [] };
                cur.count += 1;
                cur.total += item.cheapest.price;
                cur.items.push(item.name);
                byStore.set(m, cur);
            }
        }
        const storeRecommendations = [...byStore.values()].sort((a, b) => b.count - a.count || a.total - b.total);
        return { estTotal, pricedCount, storeRecommendations };
    }, [needed]);

    const filteredNeeded = useMemo(() => {
        const q = search.trim().toLowerCase();
        return needed.filter((i) => {
            if (storeFilter && i.cheapest?.merchant !== storeFilter) return false;
            if (!q) return true;
            return (
                i.name.toLowerCase().includes(q) ||
                (i.qty_text && i.qty_text.toLowerCase().includes(q)) ||
                (i.notes && i.notes.toLowerCase().includes(q))
            );
        });
    }, [needed, search, storeFilter]);

    const toast = (msg, type) => showToast?.(msg, type);

    if (household && !enabled) {
        return (
            <div style={{ animation: "fadeIn .4s" }}>
                <div style={{ marginBottom: 20 }}>
                    <div style={{ ...eyebrow, marginBottom: 8 }}>KELUARGA &amp; RUMAH</div>
                    <h1 style={{ fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", margin: 0 }}>
                        ⚖️ Banding Harga Antar Toko
                    </h1>
                    <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        Bandingkan harga satuan barang dari riwayat struk belanja keluarga. Untuk mengaktifkan Daftar Belanja &amp; Stok Kulkas, buka <strong>Profil → Household → Fitur Opsional</strong>.
                    </div>
                </div>
                <PriceComparePanel toast={toast} />
            </div>
        );
    }

    const handleAdd = async (nameOverride, qtyOverride, notesOverride) => {
        const trimmed = (nameOverride ?? newName).trim();
        if (!trimmed) return;
        try {
            await addItem({
                name: trimmed,
                qty_text: (qtyOverride ?? newQty).trim() || undefined,
                notes: (notesOverride ?? newNotes).trim() || "",
            });
            if (nameOverride === undefined) {
                setNewName("");
                setNewQty("");
                setNewNotes("");
            }
        } catch (err) {
            toast(err.message || "Gagal menambah item", "error");
        }
    };

    const handleEditSave = async () => {
        if (!editModal || !editModal.name.trim()) return;
        try {
            await updateItem(editModal.id, {
                name: editModal.name.trim(),
                qty_text: editModal.qty_text.trim() || null,
                notes: editModal.notes.trim(),
            });
            setEditModal(null);
        } catch (err) {
            toast(err.message || "Gagal menyimpan perubahan", "error");
        }
    };

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            <style>{`
                .belanja-grid {
                    display: grid;
                    grid-template-columns: 7fr 5fr;
                    gap: 16px;
                    align-items: start;
                }
                @media (max-width: 960px) {
                    .belanja-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ ...eyebrow, marginBottom: 8 }}>KELUARGA &amp; RUMAH</div>
                    <h1 style={{ fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", margin: 0 }}>
                        🛒 Belanja &amp; Harga
                    </h1>
                    <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        Daftar belanja keluarga yang terhubung otomatis ke stok rumah &amp; perbandingan harga struk.
                    </div>
                </div>
                {setActiveMenu && (
                    <button
                        onClick={() => setActiveMenu("pantry")}
                        style={{
                            padding: "10px 16px",
                            borderRadius: 12,
                            border: "1px solid var(--glass-border)",
                            background: "var(--glass-1)",
                            color: "var(--color-text)",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        🧊 Buka Stok Kulkas &amp; Rumah →
                    </button>
                )}
            </div>

            {/* KPI Summary Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
                <div style={{ ...glassCard, padding: "18px 20px", background: "linear-gradient(145deg, rgba(131,155,122,.1), rgba(131,155,122,.02))", border: "1px solid rgba(131,155,122,.2)" }}>
                    <div style={eyebrow}>Perlu Dibeli</div>
                    <div className="num-tight" style={{ fontSize: 32, fontWeight: 900, color: "var(--color-text)", marginTop: 8 }}>
                        {needed.length} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>item</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 6 }}>
                        {bought.length} item sudah terbeli
                    </div>
                </div>

                <div style={{ ...glassCard, padding: "18px 20px" }}>
                    <div style={eyebrow}>Estimasi Harga Riwayat</div>
                    <div className="num-tight mono" style={{ fontSize: 28, fontWeight: 900, color: "var(--color-primary)", marginTop: 8 }}>
                        {stats.estTotal > 0 ? fmtRp(stats.estTotal) : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 6 }}>
                        {stats.pricedCount > 0
                            ? `Dari ${stats.pricedCount} item yang punya riwayat struk`
                            : "Otomatis terisi saat ada riwayat struk"}
                    </div>
                </div>

                <div style={{ ...glassCard, padding: "18px 20px", background: suggestions.length > 0 ? "linear-gradient(145deg, rgba(245,158,11,.1), rgba(245,158,11,.02))" : "var(--glass-1)", border: suggestions.length > 0 ? "1px solid rgba(245,158,11,.25)" : "1px solid var(--glass-border)" }}>
                    <div style={eyebrow}>Stok Rumah Menipis</div>
                    <div className="num-tight" style={{ fontSize: 32, fontWeight: 900, color: suggestions.length > 0 ? "#f59e0b" : "var(--color-text)", marginTop: 8 }}>
                        {suggestions.length} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>saran</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 6 }}>
                        {suggestions.length > 0 ? "Klik saran di bawah untuk masuk daftar" : "Semua stok di atas batas minimum"}
                    </div>
                </div>
            </div>

            <div className="belanja-grid">
                {/* LEFT COLUMN: Shopping List */}
                <div style={glassCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                        <div>
                            <div style={eyebrow}>DAFTAR AKTIF</div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: "6px 0 0", letterSpacing: "-.02em" }}>
                                Daftar Belanja Keluarga
                            </h3>
                        </div>
                    </div>

                    {/* Add Form */}
                    <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,255,255,.02)", border: "1px solid var(--glass-border)", marginBottom: 16 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                            <input
                                style={{ ...inputSt, flex: "2 1 180px" }}
                                placeholder="Nama barang (mis. Susu UHT, Telur)..."
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                            />
                            <input
                                style={{ ...inputSt, flex: "1 1 100px" }}
                                placeholder="Jumlah (mis. 4 kotak, 1 kg)"
                                value={newQty}
                                onChange={(e) => setNewQty(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <input
                                style={{ ...inputSt, flex: "3 1 200px" }}
                                placeholder="Catatan opsional (merk, ukuran, atau titipan siapa)..."
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                            />
                            <button
                                onClick={() => handleAdd()}
                                style={{
                                    padding: "10px 20px",
                                    minHeight: 42,
                                    flex: "1 0 auto",
                                    borderRadius: 12,
                                    border: "none",
                                    background: "var(--color-primary)",
                                    color: "var(--color-on-primary)",
                                    fontWeight: 800,
                                    fontSize: 13,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                + Tambah
                            </button>
                        </div>
                    </div>

                    {/* Suggestions Banner */}
                    {suggestions.length > 0 && (
                        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 8 }}>
                                💡 Stok di kulkas/rumah menipis — klik untuk masukkan ke daftar belanja:
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {suggestions.map((s) => (
                                    <button
                                        key={s.pantry_item_id}
                                        onClick={() => handleAdd(s.name, s.min_qty ? `${s.min_qty} ${s.unit || ""}`.trim() : "1", "")}
                                        style={{
                                            padding: "5px 11px",
                                            borderRadius: 999,
                                            border: "1px solid rgba(245,158,11,.35)",
                                            background: "rgba(245,158,11,.14)",
                                            color: "var(--color-text)",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        + {s.name} <span style={{ opacity: 0.75 }}>(sisa {s.qty}/{s.min_qty})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Smart Basket: Rekomendasi Toko Termurah untuk Daftar Belanja */}
                    {stats.storeRecommendations.length > 0 && (
                        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(131,155,122,.08)", border: "1px solid rgba(131,155,122,.25)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-primary)" }}>
                                    🏪 Rekomendasi Toko untuk Daftar Belanja Ini (klik toko untuk filter):
                                </div>
                                {storeFilter && (
                                    <button
                                        onClick={() => setStoreFilter("")}
                                        style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                                    >
                                        ✕ Tampilkan Semua Toko
                                    </button>
                                )}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {stats.storeRecommendations.map((sr) => {
                                    const active = storeFilter === sr.merchant;
                                    return (
                                        <button
                                            key={sr.merchant}
                                            onClick={() => setStoreFilter(active ? "" : sr.merchant)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 10,
                                                border: active ? "1px solid var(--color-primary)" : "1px solid var(--glass-border)",
                                                background: active ? "var(--color-primary-soft)" : "var(--bg-surface-low)",
                                                color: "var(--color-text)",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            <span>🏆 {sr.merchant}</span>
                                            <span className="mono" style={{ color: "var(--color-primary)", fontWeight: 800 }}>
                                                {sr.count} item · {fmtRp(sr.total)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Search filter if many items */}
                    {needed.length > 5 && (
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={{ ...inputSt, padding: "9px 12px", fontSize: 12 }}
                                placeholder="🔍 Filter item di daftar belanja..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    )}

                    {shoppingLoading && (
                        <div style={{ textAlign: "center", padding: 30, color: "var(--color-muted)" }}>Memuat daftar belanja...</div>
                    )}

                    {!shoppingLoading && filteredNeeded.length === 0 && (
                        <div style={{ textAlign: "center", padding: 32, color: "var(--color-muted)", fontSize: 13 }}>
                            {search || storeFilter ? "Tidak ada item yang cocok dengan filter." : "Daftar belanja kosong 🎉"}
                        </div>
                    )}

                    {filteredNeeded.map((item) => (
                        <div key={item.id} style={itemCard}>
                            <div
                                style={checkBtn(false)}
                                title="Tandai sudah dibeli"
                                onClick={() => markBought(item.id).catch((e) => toast(e.message, "error"))}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                                        {item.name}
                                    </span>
                                    {item.qty_text && (
                                        <span
                                            className="mono"
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                padding: "2px 8px",
                                                borderRadius: 99,
                                                background: "rgba(131,155,122,.12)",
                                                color: "var(--color-primary)",
                                                border: "1px solid rgba(131,155,122,.25)",
                                            }}
                                        >
                                            {item.qty_text}
                                        </span>
                                    )}
                                </div>
                                {item.notes && (
                                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 3 }}>
                                        📝 {item.notes}
                                    </div>
                                )}
                                <CheapestLine
                                    c={item.cheapest}
                                    onCompare={() => setCompareTarget(item.name.replace(/\s*\([^)]*\)\s*/g, "").trim())}
                                />
                            </div>
                            <button
                                onClick={() =>
                                    setEditModal({
                                        id: item.id,
                                        name: item.name,
                                        qty_text: item.qty_text || "",
                                        notes: item.notes || "",
                                    })
                                }
                                title="Edit item"
                                style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 14, padding: 4 }}
                            >
                                ✎
                            </button>
                            <button
                                onClick={() => deleteItem(item.id).catch((e) => toast(e.message, "error"))}
                                title="Hapus item"
                                style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 14, padding: 4 }}
                            >
                                ✕
                            </button>
                        </div>
                    ))}

                    {bought.length > 0 && (
                        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--glass-border)" }}>
                            <button
                                onClick={() => setShowBought((v) => !v)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--color-muted)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    padding: 0,
                                }}
                            >
                                {showBought ? "▾" : "▸"} Sudah dibeli ({bought.length})
                            </button>
                            {showBought &&
                                bought.map((item) => (
                                    <div key={item.id} style={{ ...itemCard, opacity: 0.58, marginTop: 8 }}>
                                        <div
                                            style={checkBtn(true)}
                                            title="Kembalikan ke daftar belanja"
                                            onClick={() => markNeeded(item.id).catch((e) => toast(e.message, "error"))}
                                        >
                                            ✓
                                        </div>
                                        <div style={{ flex: 1, fontSize: 13, color: "var(--color-text)", textDecoration: "line-through" }}>
                                            {item.name}
                                            {item.qty_text ? ` (${item.qty_text})` : ""}
                                        </div>
                                        <button
                                            onClick={() => deleteItem(item.id).catch((e) => toast(e.message, "error"))}
                                            style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 13, padding: 4 }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Price Comparison */}
                <PriceComparePanel
                    toast={toast}
                    quickItems={needed}
                    externalQuery={compareTarget}
                    onExternalQueryHandled={() => setCompareTarget("")}
                />
            </div>

            {/* Edit Modal */}
            {editModal && (
                <div style={modalOverlay} onClick={() => setEditModal(null)}>
                    <div style={modalBox} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", marginBottom: 14 }}>
                            Edit Item Belanja
                        </div>
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Nama Barang</div>
                            <input
                                style={inputSt}
                                value={editModal.name}
                                onChange={(e) => setEditModal((m) => ({ ...m, name: e.target.value }))}
                                autoFocus
                            />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Jumlah / Kemasan</div>
                            <input
                                style={inputSt}
                                placeholder="mis. 4 kotak, 10 pcs, 2 kg"
                                value={editModal.qty_text}
                                onChange={(e) => setEditModal((m) => ({ ...m, qty_text: e.target.value }))}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Catatan</div>
                            <input
                                style={inputSt}
                                placeholder="Catatan merk / ukuran / titipan"
                                value={editModal.notes}
                                onChange={(e) => setEditModal((m) => ({ ...m, notes: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => setEditModal(null)}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--glass-border)", background: "transparent", color: "var(--color-text)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleEditSave}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                            >
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BelanjaView;
