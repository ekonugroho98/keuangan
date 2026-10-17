import { useState, useMemo } from "react";
import { useShopping, useShoppingSuggestions, comparePrices } from "../../../hooks/useShopping";
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
 */
const PriceComparePanel = ({ toast, quickItems = [], externalQuery, onExternalQueryHandled }) => {
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const runQuery = async (rawQuery) => {
        const query = (rawQuery ?? q).trim();
        if (query.length < 2) return;
        setQ(query);
        setLoading(true);
        try {
            setResult(await comparePrices(query));
        } catch (err) {
            toast(err.message || "Gagal membandingkan harga", "error");
        } finally {
            setLoading(false);
        }
    };

    if (externalQuery && externalQuery !== q && !loading) {
        const target = externalQuery;
        onExternalQueryHandled?.();
        setTimeout(() => runQuery(target), 0);
    }

    const cleanChipName = (name) =>
        name.replace(/\s*\([^)]*\)\s*/g, "").trim();

    return (
        <div style={glassCard}>
            <div style={eyebrow}>RIWAYAT STRUK KELUARGA</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: "6px 0 6px", letterSpacing: "-.02em" }}>
                ⚖️ Banding Harga Antar Toko
            </h3>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 14, lineHeight: 1.5 }}>
                Dihitung per satuan (<span className="mono">100g</span> / <span className="mono">100ml</span> / <span className="mono">pcs</span>) dari struk belanja keluarga supaya beda ukuran kemasan tetap adil.
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                    style={inputSt}
                    placeholder="Cari produk (mis. kecap, susu, minyak goreng)..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runQuery(q); }}
                />
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

            {quickItems.length > 0 && (
                <div style={{ marginBottom: 16 }}>
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

            {!result && !loading && (
                <div style={{ textAlign: "center", padding: "28px 12px", color: "var(--color-subtle)", fontSize: 12, borderRadius: 14, border: "1px dashed var(--glass-border)" }}>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.45 }}>🏷️</div>
                    Ketik nama barang atau klik chip di atas untuk melihat toko mana yang paling murah.
                </div>
            )}

            {result && result.products.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--color-muted)", padding: "14px", borderRadius: 12, background: "var(--bg-surface-low)", border: "1px solid var(--glass-border)" }}>
                    Belum ada riwayat harga untuk <strong>"{result.query}"</strong>. Harga tercatat otomatis setiap kali struk belanja disimpan.
                </div>
            )}

            {result?.products.map((p) => (
                <div key={`${p.product_name}-${p.unit}`} style={{ ...itemCard, display: "block", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", textTransform: "capitalize" }}>
                            {p.product_name}
                        </div>
                        {p.savings_pct ? (
                            <span className="chip chip-mint" style={{ fontSize: 10, padding: "3px 9px" }}>
                                Hemat {p.savings_pct}%
                            </span>
                        ) : null}
                    </div>
                    {p.stores.map((s, i) => (
                        <div
                            key={s.merchant}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                                padding: "6px 0",
                                borderTop: i ? "1px solid var(--glass-border)" : "none",
                            }}
                        >
                            <div style={{ color: "var(--color-text)", minWidth: 0 }}>
                                <span style={{ fontWeight: i === 0 ? 800 : 600 }}>
                                    {i === 0 && p.stores.length > 1 ? "🏆 " : ""}{s.merchant}
                                </span>
                                <span style={{ color: "var(--color-muted)" }}>
                                    {" "}· {fmtRp(s.price)}{s.size ? ` (${s.size})` : ""} · {shortDate(s.last_date)}
                                </span>
                            </div>
                            <div className="mono num-tight" style={{ fontWeight: 800, color: i === 0 ? "var(--color-primary)" : "var(--color-text)", whiteSpace: "nowrap" }}>
                                {fmtRp(s.per_unit_price)}{basisShort(p.compare_basis)}
                            </div>
                        </div>
                    ))}
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
    const [showBought, setShowBought] = useState(false);
    const [editModal, setEditModal] = useState(null);
    const [compareTarget, setCompareTarget] = useState("");

    const stats = useMemo(() => {
        let estTotal = 0;
        let pricedCount = 0;
        for (const item of needed) {
            if (item.cheapest?.price) {
                estTotal += item.cheapest.price;
                pricedCount += 1;
            }
        }
        return { estTotal, pricedCount };
    }, [needed]);

    const filteredNeeded = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return needed;
        return needed.filter(
            (i) =>
                i.name.toLowerCase().includes(q) ||
                (i.qty_text && i.qty_text.toLowerCase().includes(q)) ||
                (i.notes && i.notes.toLowerCase().includes(q))
        );
    }, [needed, search]);

    if (household && !enabled) {
        return (
            <div style={{ textAlign: "center", padding: 40, color: "var(--color-muted)", fontSize: 13 }}>
                Fitur Belanja &amp; Stok belum aktif. Buka Settings → Household → Fitur opsional untuk menyalakannya.
            </div>
        );
    }

    const toast = (msg, type) => showToast?.(msg, type);

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
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                style={{ ...inputSt, flex: 1 }}
                                placeholder="Catatan opsional (merk, ukuran, atau titipan siapa)..."
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                            />
                            <button
                                onClick={() => handleAdd()}
                                style={{
                                    padding: "0 20px",
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
                            {search ? "Tidak ada item yang cocok dengan pencarian." : "Daftar belanja kosong 🎉"}
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
