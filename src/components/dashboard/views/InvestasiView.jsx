import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../../../services/goldPrice";

// ── Gold Price Panel ──────────────────────────────────────────────────────
function GoldPricePanel({ goldPrices, onRefresh, refreshing, onSelectPrice }) {
    const [open,   setOpen]   = useState(true);
    const [selCat, setSelCat] = useState("emas_batangan");

    if (!goldPrices) return null;

    const { categories = {}, tanggal, scraped_at } = goldPrices;
    const availCats  = CATEGORY_ORDER.filter(c => categories[c]?.length > 0);
    const activeCat  = availCats.includes(selCat) ? selCat : availCats[0];
    const items      = categories[activeCat] || [];

    const lastUpdate = scraped_at
        ? new Date(scraped_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "-";

    return (
        <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}
                onClick={() => setOpen(p => !p)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🥇</span>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                            Harga Emas Antam Hari Ini
                            {tanggal && (
                                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-muted)", fontWeight: 400 }}>
                                    · {tanggal.replace("Harga Emas Hari Ini, ", "")}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--color-muted)" }}>
                            Diperbarui: {lastUpdate} · Sumber: logammulia.com
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={e => { e.stopPropagation(); onRefresh(); }} disabled={refreshing}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(245,158,11,.35)", background: "transparent", color: "#f59e0b", cursor: refreshing ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: refreshing ? 0.6 : 1 }}>
                        {refreshing ? "⏳ Memuat..." : "🔄 Perbarui"}
                    </button>
                    <span style={{ color: "var(--color-muted)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
                </div>
            </div>

            {open && (
                <div style={{ padding: "0 18px 16px" }}>
                    {/* Category tabs */}
                    {availCats.length > 1 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                            {availCats.map(cat => (
                                <button key={cat} onClick={() => setSelCat(cat)}
                                    style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, transition: "background .15s",
                                        background: activeCat === cat ? "#f59e0b" : "rgba(245,158,11,.12)",
                                        color:      activeCat === cat ? "#fff"    : "#f59e0b" }}>
                                    {CATEGORY_LABELS[cat] || cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Price grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                        {items.map((item, i) => (
                            <button key={i} onClick={() => onSelectPrice(item, activeCat)}
                                style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "background .15s" }}
                                onMouseOver={e => e.currentTarget.style.background = "rgba(245,158,11,.2)"}
                                onMouseOut={e  => e.currentTarget.style.background = "rgba(245,158,11,.08)"}>
                                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginBottom: 4 }}>{item.weight}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>{fmtRp(item.buy_price)}</div>
                                {item.weight_grams > 0 && (
                                    <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2 }}>{fmtRp(item.price_per_gram)}/gram</div>
                                )}
                                {item.sell_price && (
                                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 1 }}>+Pajak: {fmtRp(item.sell_price)}</div>
                                )}
                                <div style={{ fontSize: 9, color: "rgba(245,158,11,.6)", marginTop: 4, fontWeight: 600 }}>Klik untuk isi form →</div>
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 10 }}>
                        💡 Klik harga untuk otomatis mengisi form · Harga diperbarui setiap hari
                    </div>
                </div>
            )}
        </div>
    );
}

const TYPE_KEYS = ["reksa_dana","saham","emas","crypto","deposito","properti","obligasi","lainnya"];
const TYPE_ICONS  = { reksa_dana:"📊", saham:"📈", emas:"🥇", crypto:"₿", deposito:"🏦", properti:"🏠", obligasi:"📜", lainnya:"💼" };
const TYPE_COLORS = { reksa_dana:"var(--color-primary)", saham:"var(--color-primary)", emas:"#f59e0b", crypto:"#f97316", deposito:"#4FC3F7", properti:"var(--color-primary)", obligasi:"#ec4899", lainnya:"var(--color-subtle)" };

const EMOJI_OPTIONS = ["📊","📈","🥇","₿","🏦","🏠","📜","💼","💎","🚀","⚡","🌿","🎯","💰","🔮","🏆","📱","🖥️","🚗","✈️"];
const COLOR_OPTIONS = ["var(--color-primary)","var(--color-primary)","#4FC3F7","var(--color-primary)","#f59e0b","#ff716c","#ec4899","#f97316","#14b8a6","var(--color-subtle)","#a855f7","#22c55e"];

// ── Default satuan per tipe aset ──
const DEFAULT_UNITS = {
    reksa_dana: "unit",
    saham:      "lot",
    emas:       "gram",
    crypto:     "koin",
    deposito:   "bulan",
    properti:   "unit",
    obligasi:   "lembar",
    lainnya:    "unit",
};

// ── Merek emas yang didukung ──
const GOLD_BRANDS = [
    { id: "antam",      label: "Antam",      icon: "🏅", note: "Logam Mulia" },
    { id: "ubs",        label: "UBS",         icon: "🥇", note: "UBS Gold" },
    { id: "pegadaian",  label: "Pegadaian",   icon: "🏪", note: "Galeri 24" },
    { id: "lotus",      label: "Lotus Archi", icon: "🌸", note: "Lotus Gold" },
    { id: "lainnya",    label: "Lainnya",     icon: "✨", note: "Merek lain" },
];

const emptyForm = (type = "reksa_dana") => ({
    name: "", type, icon: TYPE_ICONS[type] || "📊", color: TYPE_COLORS[type] || "var(--color-primary)",
    brand: null,
    buy_price: "", current_value: "", quantity: "", unit: DEFAULT_UNITS[type] || "unit",
    buy_date: "", notes: "",
});

// ── Cari harga emas dari API berdasarkan brand + berat (gram) ──
function lookupGoldPrice(goldPrices, brand, quantityGrams) {
    if (!goldPrices?.categories || !quantityGrams || quantityGrams <= 0) return null;
    // Hanya support Antam untuk sekarang
    if (brand && brand !== "antam") return null;
    const batangan = goldPrices.categories["emas_batangan"] || [];
    // Cari exact match berat gram, lalu fallback ke closest
    const exact = batangan.find(i => Math.abs(i.weight_grams - quantityGrams) < 0.01);
    if (exact) return exact.buy_price;
    // Closest match (untuk berat custom)
    if (batangan.length === 0) return null;
    const byDiff = [...batangan].sort((a, b) => Math.abs(a.weight_grams - quantityGrams) - Math.abs(b.weight_grams - quantityGrams));
    const closest = byDiff[0];
    // Interpolate: harga per gram × quantity
    if (closest.price_per_gram > 0) return Math.round(closest.price_per_gram * quantityGrams);
    return null;
}

const InvestasiView = ({ investments = [], onAdd, onEdit, onDelete, goldPrices, onRefreshGold, refreshingGold }) => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);

    // Klik kartu harga → auto-isi form tambah investasi
    const handleSelectGoldPrice = (item, category) => {
        const isPerak = category?.includes("perak");
        setEditTarget(null);
        setForm(p => ({
            ...p,
            type:          isPerak ? "lainnya" : "emas",
            icon:          isPerak ? "🥈" : "🥇",
            color:         isPerak ? "#94a3b8" : "#f59e0b",
            brand:         isPerak ? null : "antam",
            buy_price:     String(item.buy_price),
            current_value: String(item.buy_price),
            quantity:      item.weight_grams > 0 ? String(item.weight_grams) : p.quantity,
            unit:          item.weight_grams > 0 ? "gram" : p.unit,
        }));
        setShowModal(true);
    };

    const TYPES = TYPE_KEYS.map(v => ({
        v, l: t(`inv.type.${v}`), icon: TYPE_ICONS[v], color: TYPE_COLORS[v],
    }));

    const openAdd = (type = "reksa_dana") => {
        setEditTarget(null);
        setForm(emptyForm(type));
        setShowModal(true);
    };

    const openEdit = (inv) => {
        setEditTarget(inv);
        setForm({
            name: inv.name, type: inv.type, icon: inv.icon, color: inv.color,
            brand: inv.brand || null,
            buy_price: String(inv.buy_price), current_value: String(inv.current_value),
            quantity: inv.quantity ? String(inv.quantity) : "",
            unit: inv.unit || "unit",
            buy_date: inv.buy_date || "", notes: inv.notes || "",
        });
        setShowModal(true);
    };

    const handleTypeChange = (type) => {
        setForm(p => ({
            ...p,
            type,
            icon:  TYPE_ICONS[type]  || "📊",
            color: TYPE_COLORS[type] || "var(--color-primary)",
            unit:  DEFAULT_UNITS[type] || "unit",
            brand: type === "emas" ? p.brand : null, // reset brand kalau bukan emas
        }));
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !form.buy_price || !form.quantity) return;
        const buyPrice = parseInt(form.buy_price);
        // Nilai sekarang opsional — default ke harga beli jika tidak diisi
        const currentValue = form.current_value ? parseInt(form.current_value) : buyPrice;
        const payload = {
            name: form.name.trim(), type: form.type, icon: form.icon, color: form.color,
            brand: form.type === "emas" ? (form.brand || null) : null,
            buy_price: buyPrice,
            current_value: currentValue,
            quantity: parseFloat(form.quantity),
            unit: form.unit || "unit",
            buy_date: form.buy_date || null,
            notes: form.notes.trim(),
        };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    const canSubmit = form.name.trim() && form.buy_price && form.quantity;

    const totalModal = investments.reduce((a, i) => a + i.buy_price, 0);
    // Untuk emas: pakai live price dari API jika ada, fallback ke DB
    const totalNilai = investments.reduce((a, i) => {
        const live = i.type === "emas" && i.quantity
            ? lookupGoldPrice(goldPrices, i.brand, i.quantity)
            : null;
        return a + (live ?? i.current_value);
    }, 0);
    const totalGain      = totalNilai - totalModal;
    const totalReturnPct = totalModal > 0 ? ((totalGain / totalModal) * 100).toFixed(2) : 0;

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{t("inv.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                        {investments.length} {t("inv.assets")} · {t("inv.portfolio")} {fmtRp(totalNilai)}
                    </p>
                </div>
                <button onClick={openAdd} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t("inv.addNew")}
                </button>
            </div>

            {/* Gold Price Panel */}
            <GoldPricePanel
                goldPrices={goldPrices}
                onRefresh={onRefreshGold}
                refreshing={refreshingGold}
                onSelectPrice={handleSelectGoldPrice}
            />

            {/* Summary cards */}
            {investments.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
                    {[
                        { l: t("inv.totalModal"),    v: fmtRp(totalModal),  c: "var(--color-muted)", bg: "rgba(148,163,184,.08)", border: "rgba(148,163,184,.15)" },
                        { l: t("inv.currentValue"),  v: fmtRp(totalNilai),  c: "var(--color-primary)", bg: "rgba(96,252,198,.08)",  border: "rgba(96,252,198,.2)" },
                        { l: t("inv.gainLoss"),      v: (totalGain >= 0 ? "+" : "") + fmtRp(totalGain), c: totalGain >= 0 ? "var(--color-primary)" : "#ff716c", bg: totalGain >= 0 ? "rgba(96,252,198,.08)" : "rgba(255,113,108,.08)", border: totalGain >= 0 ? "rgba(96,252,198,.2)" : "rgba(255,113,108,.2)" },
                        { l: t("inv.return"),        v: `${totalGain >= 0 ? "+" : ""}${totalReturnPct}%`, c: totalGain >= 0 ? "var(--color-primary)" : "#ff716c", bg: totalGain >= 0 ? "rgba(96,252,198,.08)" : "rgba(255,113,108,.08)", border: totalGain >= 0 ? "rgba(96,252,198,.2)" : "rgba(255,113,108,.2)" },
                    ].map((s, i) => (
                        <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 18px" }}>
                            <div style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 4 }}>{s.l}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {investments.length === 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>{t("inv.noData")}</div>
                    <div style={{ fontSize: 13, color: "#48474f", marginBottom: 20 }}>{t("inv.noDataSub")}</div>
                    <button onClick={openAdd} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("inv.addFirst")}
                    </button>
                </div>
            )}

            {/* Investment cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {investments.map(inv => {
                    // Untuk emas: coba ambil nilai live dari API, fallback ke DB
                    const livePrice  = inv.type === "emas" && inv.quantity
                        ? lookupGoldPrice(goldPrices, inv.brand, inv.quantity)
                        : null;
                    const currentVal = livePrice ?? inv.current_value;
                    const isLive     = livePrice !== null;

                    const gain = currentVal - inv.buy_price;
                    const returnPct = inv.buy_price > 0 ? ((gain / inv.buy_price) * 100).toFixed(2) : 0;
                    const isProfit = gain >= 0;
                    const typeInfo = TYPES.find(tp => tp.v === inv.type) || TYPES[7];
                    return (
                        <div key={inv.id} style={{ background: "var(--bg-surface)", border: `1px solid ${inv.color}22`, borderRadius: 16, padding: 22, position: "relative" }}>
                            <div style={{ position: "absolute", top: 14, right: 14, fontSize: 9, fontWeight: 700, color: typeInfo.color, background: typeInfo.color + "15", border: `1px solid ${typeInfo.color}30`, borderRadius: 6, padding: "2px 8px" }}>
                                {typeInfo.l.toUpperCase()}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: inv.color + "18", border: `1px solid ${inv.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                                    {inv.icon}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.name}</div>
                                        {inv.brand && (() => {
                                            const b = GOLD_BRANDS.find(x => x.id === inv.brand);
                                            return b ? (
                                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(245,158,11,.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.3)", whiteSpace: "nowrap" }}>
                                                    {b.icon} {b.label}
                                                </span>
                                            ) : null;
                                        })()}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                                        {inv.quantity ? `${inv.quantity} ${inv.unit}` : ""}
                                        {inv.buy_date ? ` · ${t("inv.buy")} ${new Date(inv.buy_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                                <div style={{ background: "var(--bg-surface-low)", borderRadius: 10, padding: "10px 12px" }}>
                                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 3 }}>{t("inv.modal").toUpperCase()}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-muted)" }}>{fmtRp(inv.buy_price)}</div>
                                </div>
                                <div style={{ background: "var(--bg-surface-low)", borderRadius: 10, padding: "10px 12px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                                        <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>{t("inv.currentValueLabel").toUpperCase()}</span>
                                        {isLive && (
                                            <span style={{ fontSize: 8, fontWeight: 700, background: "rgba(96,252,198,.15)", color: "var(--color-primary)", border: "1px solid rgba(96,252,198,.3)", borderRadius: 4, padding: "1px 5px" }}>
                                                ⚡ LIVE
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: isLive ? "var(--color-primary)" : "var(--color-text)" }}>{fmtRp(currentVal)}</div>
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: isProfit ? "rgba(96,252,198,.06)" : "rgba(255,113,108,.06)", border: `1px solid ${isProfit ? "rgba(96,252,198,.15)" : "rgba(255,113,108,.15)"}`, borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
                                <div style={{ fontSize: 12, color: "var(--color-subtle)" }}>{t("inv.gainLoss")}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: isProfit ? "var(--color-primary)" : "#ff716c" }}>
                                        {isProfit ? "+" : ""}{fmtRp(gain)}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: isProfit ? "var(--color-primary)" : "#ff716c", background: isProfit ? "rgba(96,252,198,.12)" : "rgba(255,113,108,.12)", padding: "2px 7px", borderRadius: 6 }}>
                                        {isProfit ? "▲" : "▼"} {Math.abs(returnPct)}%
                                    </span>
                                </div>
                            </div>

                            {inv.notes && (
                                <div style={{ fontSize: 11, color: "#48474f", marginBottom: 14, fontStyle: "italic" }}>📝 {inv.notes}</div>
                            )}

                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => openEdit(inv)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--color-border)", background: "rgba(96,252,198,.08)", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("inv.editBtn")}</button>
                                <button onClick={() => setConfirmDelete(inv)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,113,108,.15)", background: "rgba(255,113,108,.06)", color: "#ff716c", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Tambah/Edit */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 17, margin: 0 }}>{editTarget ? t("inv.submitEdit") : t("inv.addNew")}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{form.name || t("inv.previewDefault")}</div>
                                <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                                    {form.current_value && form.buy_price ? (() => {
                                        const g = parseInt(form.current_value) - parseInt(form.buy_price);
                                        const p = parseInt(form.buy_price) > 0 ? ((g / parseInt(form.buy_price)) * 100).toFixed(1) : 0;
                                        return <span style={{ color: g >= 0 ? "var(--color-primary)" : "#ff716c" }}>{g >= 0 ? "+" : ""}{fmtRp(g)} ({p}%)</span>;
                                    })() : t("inv.previewModalDefault")}
                                </div>
                            </div>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("inv.typeLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {TYPES.map(tp => (
                                <button key={tp.v} onClick={() => handleTypeChange(tp.v)}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${form.type === tp.v ? tp.color + "55" : "var(--color-border-soft)"}`, background: form.type === tp.v ? tp.color + "15" : "transparent", color: form.type === tp.v ? tp.color : "var(--color-subtle)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                    {tp.icon} {tp.l}
                                </button>
                            ))}
                        </div>

                        {/* Brand picker — hanya tampil saat tipe Emas */}
                        {form.type === "emas" && (
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", display: "block", marginBottom: 8 }}>🏅 MEREK EMAS</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {GOLD_BRANDS.map(b => {
                                        const isActive = form.brand === b.id;
                                        return (
                                            <button key={b.id}
                                                onClick={() => setForm(p => ({ ...p, brand: isActive ? null : b.id }))}
                                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: `1px solid ${isActive ? "#f59e0b" : "var(--color-border-soft)"}`, background: isActive ? "rgba(245,158,11,.15)" : "transparent", color: isActive ? "#f59e0b" : "var(--color-muted)", fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>
                                                <span>{b.icon}</span>
                                                <div style={{ textAlign: "left" }}>
                                                    <div style={{ lineHeight: 1.2 }}>{b.label}</div>
                                                    <div style={{ fontSize: 9, opacity: 0.7 }}>{b.note}</div>
                                                </div>
                                                {isActive && <span style={{ marginLeft: 2, fontSize: 10 }}>✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {!form.brand && (
                                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 6 }}>Opsional — pilih merek jika ingin tracking per brand</div>
                                )}
                            </div>
                        )}

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("inv.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t("inv.namePlaceholder")} maxLength={50}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("inv.modalLabel")}</label>
                                <input type="number" value={form.buy_price} onChange={e => setForm(p => ({ ...p, buy_price: e.target.value }))} placeholder="5000000"
                                    style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                                    {t("inv.currentValueInput")}
                                    <span style={{ fontWeight: 400, color: "var(--color-subtle)", marginLeft: 4 }}>(opsional)</span>
                                </label>
                                <input type="number" value={form.current_value}
                                    onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))}
                                    placeholder={form.buy_price || "Default: sama dengan modal"}
                                    style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                                {form.type === "emas" && !form.current_value && (
                                    <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>
                                        💡 Kosongkan untuk pakai harga beli sebagai nilai sekarang
                                    </div>
                                )}
                                {form.type !== "emas" && !form.current_value && (
                                    <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 4 }}>
                                        Jika kosong, nilai sekarang = modal
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                                    {t("inv.qtyLabel")} <span style={{ color: "#ff716c" }}>*</span>
                                </label>
                                <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="10" min="0" required
                                    style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: `1px solid ${!form.quantity ? "rgba(255,113,108,.4)" : "var(--color-border-soft)"}`, borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("inv.unitLabel")}</label>
                                <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder={DEFAULT_UNITS[form.type] || "unit"}
                                    style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                            </div>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("inv.buyDateLabel")}</label>
                        <input type="date" value={form.buy_date}
                            onChange={e => setForm(p => ({ ...p, buy_date: e.target.value }))}
                            max={new Date().toISOString().slice(0, 10)}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 10, color: form.buy_date ? "var(--color-text)" : "var(--color-subtle)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", colorScheme: "dark" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("inv.iconLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#60fcc655" : "var(--color-border-soft)"}`, background: form.icon === e ? "rgba(96,252,198,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("inv.colorLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("inv.notesLabel")}</label>
                        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="..."
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 24, boxSizing: "border-box" }} />

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "var(--color-border-soft)" : "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("inv.submitEdit") : t("inv.submitAdd")}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("inv.deleteConfirm")}</h3>
                        <p style={{ color: "var(--color-subtle)", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#ff716c" }}>{confirmDelete.name}</strong> — {t("inv.deleteMsg")}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "var(--color-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvestasiView;
