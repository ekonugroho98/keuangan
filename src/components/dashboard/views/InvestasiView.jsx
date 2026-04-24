import { useState, useEffect, useRef } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";
import { CATEGORY_LABELS, CATEGORY_ORDER, lookupPrice, getHargaPerGram, fetchGoldPrices } from "../../../services/goldPrice";
import { fetchStockPrice, calcStockValue, formatChangePct } from "../../../services/stockPrice";
import AmountInput from "../../ui/AmountInput";

// ── Gold Price Panel ──────────────────────────────────────────────────────
function GoldPricePanel({ goldPrices, onRefresh, refreshing, onSelectPrice }) {
    const [open,   setOpen]   = useState(false);
    const [selCat, setSelCat] = useState("emas_batangan");

    if (!goldPrices) return null;

    const { categories = {}, tanggal, scraped_at } = goldPrices;
    const availCats  = CATEGORY_ORDER.filter(c => categories[c]?.length > 0);
    const activeCat  = availCats.includes(selCat) ? selCat : availCats[0];
    const items      = categories[activeCat] || [];
    const spot1gr    = categories["emas_batangan"]?.find(i => Math.abs(i.weight_grams - 1) < 0.01);

    const lastUpdate = scraped_at
        ? new Date(scraped_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "-";

    // Staleness heuristic: fresh if scraped within 12 hours
    const scrapedMs = scraped_at ? new Date(scraped_at).getTime() : 0;
    const isFresh   = scrapedMs > 0 && (Date.now() - scrapedMs) < 12 * 3600 * 1000;

    return (
        <div style={{ marginBottom: 20 }}>
            {/* ── Collapsed: tombol kecil ── */}
            {!open ? (
                <button onClick={() => setOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px solid var(--glass-border)", background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.06)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", minHeight: 48, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18 }}>🥇</span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-amber, #f59e0b)" }}>
                            Lihat Harga Emas {goldPrices.brand?.toUpperCase()}
                        </span>
                        {spot1gr && (
                            <span className="num-tight mono" style={{ fontSize: 11, color: "var(--color-muted)" }}>
                                1gr = {fmtRp(spot1gr.buy_price)}
                            </span>
                        )}
                        <span className={isFresh ? "chip chip-mint" : "chip chip-ghost"}>
                            {isFresh ? "Fresh" : (tanggal ? tanggal.replace("Harga Emas Hari Ini, ", "") : "Stale")}
                        </span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>▼</span>
                </button>
            ) : (
                /* ── Expanded: panel penuh ── */
                <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", gap: 10, flexWrap: "wrap" }}
                        onClick={() => setOpen(false)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: 20 }}>🥇</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span>Harga Emas {goldPrices.brand?.toUpperCase()} Hari Ini</span>
                                    <span className={isFresh ? "chip chip-mint" : "chip chip-ghost"}>
                                        {isFresh ? "Fresh" : "Stale"}
                                    </span>
                                </div>
                                <div style={{ fontSize: 10, color: "var(--color-muted)" }}>
                                    Diperbarui: {lastUpdate} · Sumber: {goldPrices.source || "-"}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={e => { e.stopPropagation(); onRefresh && onRefresh(); }} disabled={refreshing || !onRefresh}
                                className="btn-ghost"
                                style={{ fontSize: 11, padding: "6px 12px", minHeight: 32, cursor: (refreshing || !onRefresh) ? "not-allowed" : "pointer", opacity: (refreshing || !onRefresh) ? 0.5 : 1 }}>
                                {refreshing ? "Memuat..." : "Perbarui"}
                            </button>
                            <span style={{ color: "var(--color-muted)", fontSize: 12 }}>▲</span>
                        </div>
                    </div>

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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))", gap: 8 }}>
                            {items.map((item, i) => (
                                <button key={i} onClick={() => onSelectPrice(item, activeCat)}
                                    style={{ background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 12, padding: "10px 14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all .15s" }}
                                    onMouseOver={e => { e.currentTarget.style.background = "rgba(245,158,11,.12)"; e.currentTarget.style.borderColor = "rgba(245,158,11,.3)"; }}
                                    onMouseOut={e  => { e.currentTarget.style.background = "var(--bg-surface-low)"; e.currentTarget.style.borderColor = "var(--color-border-soft)"; }}>
                                    <div style={{ fontSize: 11, color: "var(--color-amber, #f59e0b)", fontWeight: 700, marginBottom: 4 }}>{item.weight}</div>
                                    <div className="num-tight mono" style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>{fmtRp(item.buy_price)}</div>
                                    {item.weight_grams > 0 && (
                                        <div className="num-tight mono" style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2 }}>{fmtRp(item.price_per_gram)}/gram</div>
                                    )}
                                    {item.sell_price && (
                                        <div className="num-tight mono" style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 1 }}>+PPh: {fmtRp(item.sell_price)}</div>
                                    )}
                                    {item.buyback_price && (
                                        <div className="num-tight mono" style={{ fontSize: 10, color: "var(--color-primary)", marginTop: 1 }}>Buyback: {fmtRp(item.buyback_price)}</div>
                                    )}
                                    <div style={{ fontSize: 9, color: "var(--color-subtle)", marginTop: 4, fontWeight: 600 }}>Klik untuk isi form →</div>
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 10 }}>
                            💡 Klik harga untuk otomatis mengisi form · Harga diperbarui setiap hari
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Panduan harga per tipe aset ──────────────────────────────────────────
const PRICE_GUIDE = {
    emas: {
        antam:     null, // handled by GoldPricePanel
        ubs:      { label: "UBS Gold",     icon: "🥇", links: [{ name: "ubslifestyle.com", url: "https://ubslifestyle.com/fine-gold/logam-mulia-ubs/" }], note: "Harga diperbarui otomatis setiap hari dari UBS Lifestyle" },
        galeri24: { label: "Pegadaian",    icon: "🏪", links: [{ name: "galeri24.co.id",  url: "https://galeri24.co.id/harga-emas" }], note: "Harga diperbarui otomatis setiap hari dari Galeri 24" },
        lotus:    { label: "Lotus Archi",  icon: "🌸", links: [{ name: "lotusarchi.com",  url: "https://lotusarchi.com/pricing/" }], note: "Harga diperbarui otomatis setiap hari dari Lotus Archi" },
        lainnya:   { label: "Emas Lainnya", icon: "✨", links: [], note: "Cek harga di toko / platform tempat kamu beli" },
    },
    saham: { label: "Saham", icon: "📈", links: [{ name: "IDX (idx.co.id)", url: "https://idx.co.id" }, { name: "Yahoo Finance", url: "https://finance.yahoo.com" }], note: "Cek harga di aplikasi broker kamu (Ajaib, IPOT, Stockbit)" },
    reksa_dana: { label: "Reksa Dana", icon: "📊", links: [{ name: "Bibit", url: "https://bibit.id" }, { name: "Bareksa", url: "https://www.bareksa.com" }], note: "NAB diperbarui setiap hari kerja pukul 16.00" },
    crypto: { label: "Crypto", icon: "₿", links: [{ name: "Indodax", url: "https://indodax.com" }, { name: "CoinGecko", url: "https://www.coingecko.com" }], note: "Harga crypto bergerak 24/7" },
    deposito: { label: "Deposito", icon: "🏦", links: [], note: "Deposito memiliki bunga tetap, perbarui nilai secara manual saat jatuh tempo" },
    properti: { label: "Properti", icon: "🏠", links: [{ name: "Rumah123", url: "https://www.rumah123.com" }, { name: "99.co", url: "https://www.99.co/id" }], note: "Nilai properti berubah lambat, perbarui manual setiap tahun" },
    obligasi: { label: "Obligasi", icon: "📜", links: [{ name: "DJPPR Kemenkeu", url: "https://www.djppr.kemenkeu.go.id" }], note: "Cek harga obligasi di portal DJPPR atau platform sekuritas" },
    lainnya:  { label: "Aset Lainnya", icon: "💼", links: [], note: "Perbarui nilai aset secara manual melalui tombol Edit" },
};

function PriceGuide({ type, brand }) {
    const guide = type === "emas" && brand
        ? PRICE_GUIDE.emas?.[brand]
        : PRICE_GUIDE[type];

    if (!guide) return null;

    return (
        <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.18)", borderRadius: 14, padding: "18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{guide.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{guide.label}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: guide.links?.length ? 14 : 0, lineHeight: 1.5 }}>
                💡 {guide.note}
            </div>
            {guide.links?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {guide.links.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,.3)", background: "rgba(99,102,241,.1)", color: "#818cf8", textDecoration: "none", cursor: "pointer" }}>
                            🔗 {l.name}
                        </a>
                    ))}
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
    { id: "antam",    label: "Antam",      icon: "🏅", note: "Logam Mulia" },
    { id: "ubs",      label: "UBS",         icon: "🥇", note: "UBS Gold" },
    { id: "galeri24", label: "Pegadaian",   icon: "🏪", note: "Galeri 24" },
    { id: "lotus",    label: "Lotus Archi", icon: "🌸", note: "Lotus Gold" },
    { id: "lainnya",  label: "Lainnya",     icon: "✨", note: "Merek lain" },
];

const emptyForm = (type = "reksa_dana") => ({
    name: "", type, icon: TYPE_ICONS[type] || "📊", color: TYPE_COLORS[type] || "var(--color-primary)",
    brand: null,
    buy_price: "", current_value: "", quantity: "", unit: DEFAULT_UNITS[type] || "unit",
    buy_date: "", notes: "",
    kode_saham: "",   // hanya relevan untuk tipe "saham"
});

// ── Cari harga emas dari API berdasarkan brand + berat (gram) ──
function lookupGoldPrice(goldPrices, brand, quantityGrams) {
    if (!goldPrices?.categories || !quantityGrams || quantityGrams <= 0) return null;
    if (brand === "lainnya") {
        // Pakai harga per gram Antam sebagai referensi
        const hargaPerGram = getHargaPerGram(goldPrices);
        return hargaPerGram > 0 ? Math.round(hargaPerGram * quantityGrams) : null;
    }
    return lookupPrice(goldPrices, brand, quantityGrams);
}

const InvestasiView = ({ investments = [], onAdd, onEdit, onDelete, goldPrices, onRefreshGold, refreshingGold }) => {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [priceTarget, setPriceTarget] = useState(null);

    // Cache harga per brand emas — fetch lazy saat brand dipilih
    const [brandPrices, setBrandPrices] = useState({});
    const fetchingRef = useRef({});

    // Cache harga saham per ticker — fetch saat mount
    const [stockPrices,  setStockPrices]  = useState({});  // { BBCA: { price, change_pct, ... } }
    const [stockErrors,  setStockErrors]  = useState({});  // { XXXX: true } — ticker tidak ditemukan
    const [stockLoading, setStockLoading] = useState({});  // { BBCA: true } — sedang fetch
    const stockFetchingRef = useRef({});

    const loadBrandPrices = async (brand) => {
        if (!brand || brand === "lainnya") return;
        if (brandPrices[brand] || fetchingRef.current[brand]) return;
        fetchingRef.current[brand] = true;
        try {
            const data = await fetchGoldPrices(brand);
            setBrandPrices(p => ({ ...p, [brand]: data }));
        } catch (_) {
            // silent fail — fallback ke Antam
        } finally {
            fetchingRef.current[brand] = false;
        }
    };

    // Auto-fetch harga semua brand emas yang ada di portfolio saat mount
    useEffect(() => {
        const brands = [...new Set(
            investments
                .filter(inv => inv.type === "emas" && inv.brand && inv.brand !== "lainnya" && inv.brand !== "antam")
                .map(inv => inv.brand)
        )];
        brands.forEach(loadBrandPrices);
    }, [investments]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch harga live saham untuk semua investasi dengan kode_saham
    const loadStockPrice = async (ticker) => {
        if (!ticker) return;
        const key = ticker.toUpperCase();
        if (stockPrices[key] || stockErrors[key] || stockFetchingRef.current[key]) return;
        stockFetchingRef.current[key] = true;
        setStockLoading(p => ({ ...p, [key]: true }));
        try {
            const data = await fetchStockPrice(key);
            setStockPrices(p => ({ ...p, [key]: data }));
            setStockErrors(p => { const n = { ...p }; delete n[key]; return n; }); // clear error jika sebelumnya error
        } catch (_) {
            setStockErrors(p => ({ ...p, [key]: true }));
        } finally {
            stockFetchingRef.current[key] = false;
            setStockLoading(p => { const n = { ...p }; delete n[key]; return n; });
        }
    };

    useEffect(() => {
        const tickers = [...new Set(
            investments
                .filter(inv => inv.type === "saham" && inv.kode_saham)
                .map(inv => inv.kode_saham.toUpperCase())
        )];
        tickers.forEach(loadStockPrice);
    }, [investments]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch harga saat brand form berubah
    useEffect(() => {
        if (form.type === "emas" && form.brand) loadBrandPrices(form.brand);
    }, [form.brand, form.type]);

    // Fetch harga saat buka detail aset
    useEffect(() => {
        if (priceTarget?.type === "emas" && priceTarget?.brand) loadBrandPrices(priceTarget.brand);
    }, [priceTarget]);

    // Ambil goldPrices yang relevan: cached brand, atau Antam untuk "lainnya"/antam/null
    const getGoldPrices = (brand) => {
        if (!brand || brand === "lainnya" || brand === "antam") return goldPrices;
        return brandPrices[brand] ?? goldPrices; // fallback ke Antam jika brand belum di-fetch
    };

    // Klik kartu harga → auto-isi form tambah investasi
    const handleSelectGoldPrice = (item, category) => {
        const isPerak = category?.includes("perak");
        const brand = isPerak ? null : (goldPrices?.brand || "antam");
        setEditTarget(null);
        setForm(p => ({
            ...p,
            type:          isPerak ? "lainnya" : "emas",
            icon:          isPerak ? "🥈" : "🥇",
            color:         isPerak ? "#94a3b8" : "#f59e0b",
            brand,
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

        // Hitung harga live jika tersedia, gunakan sebagai nilai sekarang di form
        const liveGold = inv.type === "emas" && inv.quantity
            ? lookupGoldPrice(getGoldPrices(inv.brand), inv.brand, inv.quantity)
            : null;
        const stockD   = inv.type === "saham" && inv.kode_saham
            ? stockPrices[inv.kode_saham.toUpperCase()]
            : null;
        const liveStock = stockD && inv.quantity
            ? calcStockValue(stockD.price, inv.quantity)
            : null;
        const liveCurrentValue = liveGold ?? liveStock ?? inv.current_value;

        setForm({
            name: inv.name, type: inv.type, icon: inv.icon, color: inv.color,
            brand: inv.brand || null,
            buy_price: String(inv.buy_price), current_value: String(liveCurrentValue),
            quantity: inv.quantity ? String(inv.quantity) : "",
            unit: inv.unit || "unit",
            buy_date: inv.buy_date || "", notes: inv.notes || "",
            kode_saham: inv.kode_saham || "",
        });
        setShowModal(true);
    };

    const handleTypeChange = (type) => {
        setForm(p => ({
            ...p,
            type,
            icon:       TYPE_ICONS[type]  || "📊",
            color:      TYPE_COLORS[type] || "var(--color-primary)",
            unit:       DEFAULT_UNITS[type] || "unit",
            brand:      type === "emas"  ? p.brand  : null,  // reset brand kalau bukan emas
            kode_saham: type === "saham" ? p.kode_saham : "", // reset kode kalau bukan saham
        }));
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !form.buy_price || !form.quantity) return;
        const buyPrice = parseInt(form.buy_price);
        // Nilai sekarang opsional — default ke harga beli jika tidak diisi
        const currentValue = form.current_value ? parseInt(form.current_value) : buyPrice;
        const payload = {
            name: form.name.trim(), type: form.type, icon: form.icon, color: form.color,
            brand:      form.type === "emas"  ? (form.brand || null) : null,
            kode_saham: form.type === "saham" ? (form.kode_saham.trim().toUpperCase() || null) : null,
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
    // Pakai live price dari API jika ada (emas & saham), fallback ke DB
    const totalNilai = investments.reduce((a, i) => {
        const goldLive = i.type === "emas" && i.quantity
            ? lookupGoldPrice(getGoldPrices(i.brand), i.brand, i.quantity)
            : null;
        const stockD    = i.type === "saham" && i.kode_saham
            ? stockPrices[i.kode_saham.toUpperCase()]
            : null;
        const stockLive = stockD && i.quantity
            ? calcStockValue(stockD.price, i.quantity)
            : null;
        return a + (goldLive ?? stockLive ?? i.current_value);
    }, 0);
    const totalGain      = totalNilai - totalModal;
    const totalReturnPct = totalModal > 0 ? ((totalGain / totalModal) * 100).toFixed(2) : 0;

    const gainPositive = totalGain >= 0;

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>PORTOFOLIO</div>
                    <h2 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>{t("inv.title")}</h2>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        {investments.length} {t("inv.assets")} · {t("inv.portfolio")} <span className="num-tight mono">{fmtRp(totalNilai)}</span>
                    </p>
                </div>
                <button onClick={openAdd} className="btn-primary" style={{ padding: "10px 18px", fontSize: 13, minHeight: 42 }}>
                    {t("inv.addNew")}
                </button>
            </div>

            {/* Summary cards */}
            {investments.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12, marginBottom: 20 }}>
                    {/* Modal */}
                    <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "22px 24px", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)", position: "relative", overflow: "hidden" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 8 }}>{t("inv.totalModal")}</div>
                        <div className="num-tight mono" style={{ fontSize: "clamp(18px, 2.4vw, 24px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", lineHeight: 1 }}>{fmtRp(totalModal)}</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>Total yang diinvestasikan</div>
                    </div>
                    {/* Nilai sekarang */}
                    <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "22px 24px", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)", position: "relative", overflow: "hidden" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 8 }}>{t("inv.currentValue")}</div>
                        <div className="num-tight mono" style={{ fontSize: "clamp(18px, 2.4vw, 24px)", fontWeight: 900, color: "var(--color-primary)", letterSpacing: "-.03em", lineHeight: 1 }}>{fmtRp(totalNilai)}</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>Nilai live portofolio</div>
                    </div>
                    {/* Gain / Loss */}
                    <div style={{ background: "var(--glass-1)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "22px 24px", boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)", position: "relative", overflow: "hidden" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            {t("inv.gainLoss")}
                            <span className={gainPositive ? "chip chip-mint" : "chip chip-red"}>
                                {gainPositive ? "▲" : "▼"} {Math.abs(totalReturnPct)}%
                            </span>
                        </div>
                        <div className="num-tight mono" style={{ fontSize: "clamp(18px, 2.4vw, 24px)", fontWeight: 900, color: gainPositive ? "var(--color-primary)" : "var(--color-expense, #ff716c)", letterSpacing: "-.03em", lineHeight: 1 }}>
                            {gainPositive ? "+" : ""}{fmtRp(totalGain)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>Unrealized P/L</div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {investments.length === 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: .4 }}>📈</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>{t("inv.noData")}</div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 16 }}>{t("inv.noDataSub")}</div>
                    <button onClick={openAdd} className="btn-primary" style={{ padding: "10px 24px", fontSize: 13 }}>
                        + {t("inv.addFirst")}
                    </button>
                </div>
            )}

            {/* Investment cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
                {investments.map(inv => {
                    // Emas: live price HANYA jika ada quantity tersimpan
                    const goldData  = inv.type === "emas" ? getGoldPrices(inv.brand) : null;
                    const livePrice = inv.type === "emas" && inv.quantity
                        ? lookupGoldPrice(goldData, inv.brand, inv.quantity)
                        : null;
                    const missingQty = inv.type === "emas" && !inv.quantity;

                    // Saham: live price dari Yahoo Finance via karaya-api
                    const stockData   = inv.type === "saham" && inv.kode_saham
                        ? stockPrices[inv.kode_saham.toUpperCase()]
                        : null;
                    const liveStock   = stockData && inv.quantity
                        ? calcStockValue(stockData.price, inv.quantity)
                        : null;
                    const missingCode = inv.type === "saham" && !inv.kode_saham;

                    const currentVal = livePrice ?? liveStock ?? inv.current_value;
                    const isLive     = livePrice !== null || liveStock !== null;

                    const gain = currentVal - inv.buy_price;
                    const returnPct = inv.buy_price > 0 ? ((gain / inv.buy_price) * 100).toFixed(2) : 0;
                    const isProfit = gain >= 0;
                    const typeInfo = TYPES.find(tp => tp.v === inv.type) || TYPES[7];
                    return (
                        <div key={inv.id} style={{
                            background: "var(--glass-1)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: 20, padding: 22, position: "relative", overflow: "hidden",
                            boxShadow: "var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08)",
                        }}>
                            <span className="chip chip-ghost" style={{ position: "absolute", top: 14, right: 14, color: typeInfo.color, borderColor: typeInfo.color + "40", background: typeInfo.color + "12" }}>
                                {typeInfo.l}
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingRight: 80 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 14, background: inv.color + "18", border: `1px solid ${inv.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                                    {inv.icon}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.name}</div>
                                        {inv.brand && (() => {
                                            const b = GOLD_BRANDS.find(x => x.id === inv.brand);
                                            return b ? (
                                                <span className="chip chip-amber">
                                                    {b.icon} {b.label}
                                                </span>
                                            ) : null;
                                        })()}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                                        {inv.quantity ? <span className="num-tight">{inv.quantity} {inv.unit}</span> : ""}
                                        {inv.buy_date ? ` · ${t("inv.buy")} ${new Date(inv.buy_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                                <div style={{ background: "var(--bg-surface-low)", borderRadius: 12, padding: "10px 12px", border: "1px solid var(--color-border-soft)" }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>{t("inv.modal")}</div>
                                    <div className="num-tight mono" style={{ fontSize: 13, fontWeight: 800, color: "var(--color-muted)" }}>{fmtRp(inv.buy_price)}</div>
                                </div>
                                <div style={{ background: "var(--bg-surface-low)", borderRadius: 12, padding: "10px 12px", border: "1px solid var(--color-border-soft)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.2 }}>{t("inv.currentValueLabel")}</span>
                                        {isLive && (
                                            <span className="chip chip-mint" style={{ fontSize: 8, padding: "1px 5px" }}>
                                                LIVE
                                            </span>
                                        )}
                                    </div>
                                    <div className="num-tight mono" style={{ fontSize: 13, fontWeight: 800, color: isLive ? "var(--color-primary)" : "var(--color-text)" }}>{fmtRp(currentVal)}</div>
                                </div>
                            </div>

                            {missingQty && (
                                <div style={{ fontSize: 11, color: "var(--color-amber, #f59e0b)", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: "6px 10px", marginBottom: 10 }}>
                                    Tambahkan jumlah (gram) untuk harga live otomatis
                                </div>
                            )}
                            {missingCode && (
                                <div style={{ fontSize: 11, color: "var(--color-transfer, #4FC3F7)", background: "var(--color-transfer-soft, rgba(79,195,247,.08))", border: "1px solid rgba(79,195,247,.25)", borderRadius: 10, padding: "6px 10px", marginBottom: 10 }}>
                                    Tambahkan kode saham (mis: BBCA) untuk harga live
                                </div>
                            )}
                            {inv.type === "saham" && inv.kode_saham && stockLoading[inv.kode_saham.toUpperCase()] && (
                                <div style={{ fontSize: 11, color: "var(--color-subtle)", background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 10, padding: "6px 10px", marginBottom: 10 }}>
                                    Memuat harga {inv.kode_saham}...
                                </div>
                            )}
                            {inv.type === "saham" && inv.kode_saham && stockErrors[inv.kode_saham.toUpperCase()] && (
                                <div style={{ fontSize: 11, color: "var(--color-expense, #ff716c)", background: "rgba(255,113,108,.06)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 10, padding: "6px 10px", marginBottom: 10 }}>
                                    Kode "{inv.kode_saham}" tidak ditemukan di IDX
                                </div>
                            )}
                            {stockData && (
                                <div style={{ fontSize: 11, color: stockData.change_pct >= 0 ? "var(--color-primary)" : "var(--color-expense, #ff716c)", background: stockData.change_pct >= 0 ? "rgba(96,252,198,.06)" : "rgba(255,113,108,.06)", border: `1px solid ${stockData.change_pct >= 0 ? "rgba(96,252,198,.2)" : "rgba(255,113,108,.2)"}`, borderRadius: 10, padding: "5px 10px", marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                                    <span className="num-tight mono">{inv.kode_saham} · {fmtRp(stockData.price)}/saham</span>
                                    <span className="num-tight" style={{ fontWeight: 700 }}>{formatChangePct(stockData.change_pct)}</span>
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: isProfit ? "rgba(96,252,198,.06)" : "rgba(255,113,108,.06)", border: `1px solid ${isProfit ? "rgba(96,252,198,.18)" : "rgba(255,113,108,.18)"}`, borderRadius: 12, padding: "8px 12px", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 12, color: "var(--color-subtle)" }}>{t("inv.gainLoss")}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span className="num-tight mono" style={{ fontSize: 13, fontWeight: 700, color: isProfit ? "var(--color-primary)" : "var(--color-expense, #ff716c)" }}>
                                        {isProfit ? "+" : ""}{fmtRp(gain)}
                                    </span>
                                    <span className={isProfit ? "chip chip-mint" : "chip chip-red"}>
                                        {isProfit ? "▲" : "▼"} {Math.abs(returnPct)}%
                                    </span>
                                </div>
                            </div>

                            {inv.notes && (
                                <div style={{ fontSize: 11, color: "var(--color-subtle)", marginBottom: 14, fontStyle: "italic" }}>{inv.notes}</div>
                            )}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button onClick={() => openEdit(inv)} className="btn-ghost" style={{ flex: 1, minHeight: 42, fontSize: 12, padding: "8px 10px" }}>{t("inv.editBtn")}</button>
                                <button onClick={() => setPriceTarget(inv)} aria-label="Lihat harga" style={{ minHeight: 42, minWidth: 42, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(79,195,247,.22)", background: "var(--color-transfer-soft, rgba(79,195,247,.07))", color: "var(--color-transfer, #4FC3F7)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>💹</button>
                                <button onClick={() => setConfirmDelete(inv)} aria-label="Delete asset" style={{ minHeight: 42, minWidth: 42, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,113,108,.18)", background: "rgba(255,113,108,.06)", color: "var(--color-expense, #ff716c)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
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
                                {/* Harga referensi — hanya muncul saat pilih Antam */}
                                {form.type === "emas" && form.brand && form.brand !== "lainnya" && getGoldPrices(form.brand) && (
                                    <GoldPricePanel
                                        goldPrices={getGoldPrices(form.brand)}
                                        onRefresh={form.brand === "antam" ? onRefreshGold : undefined}
                                        refreshing={form.brand === "antam" ? refreshingGold : false}
                                        onSelectPrice={handleSelectGoldPrice}
                                    />
                                )}
                            </div>
                        )}

                        {/* Kode Saham — hanya tampil saat tipe Saham */}
                        {form.type === "saham" && (
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#818cf8", display: "block", marginBottom: 6 }}>
                                    📈 KODE SAHAM <span style={{ fontWeight: 400, color: "var(--color-subtle)" }}>(opsional)</span>
                                </label>
                                <input
                                    value={form.kode_saham}
                                    onChange={e => setForm(p => ({ ...p, kode_saham: e.target.value.toUpperCase() }))}
                                    placeholder="Contoh: BBCA, TLKM, GOTO"
                                    maxLength={10}
                                    style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid rgba(99,102,241,.35)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 4, boxSizing: "border-box", letterSpacing: 1 }}
                                />
                                <div style={{ fontSize: 10, color: "var(--color-subtle)" }}>
                                    Isi untuk harga live otomatis dari IDX · Biarkan kosong jika update manual
                                </div>
                            </div>
                        )}

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("inv.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t("inv.namePlaceholder")} maxLength={50}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                                    {t("inv.modalLabel")}
                                </label>
                                <AmountInput value={form.buy_price} onChange={v => setForm(p => ({ ...p, buy_price: v }))} placeholder="5.000.000" />
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: -10, marginBottom: 4 }}>
                                    {form.type === "emas" && form.buy_price && form.quantity && parseFloat(form.quantity) > 0
                                        ? `= ${fmtRp(Math.round(parseInt(form.buy_price) / parseFloat(form.quantity)))}/gram`
                                        : "Total yg kamu bayarkan"
                                    }
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                                    {t("inv.currentValueInput")}
                                </label>
                                <AmountInput value={form.current_value} onChange={v => setForm(p => ({ ...p, current_value: v }))} placeholder={form.buy_price ? String(form.buy_price) : "Default: sama dengan modal"} />
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
                                {!form.quantity && (
                                    <div style={{ fontSize: 10, color: "#ff716c", marginTop: 4 }}>Wajib diisi — diperlukan untuk harga live</div>
                                )}
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
            {/* ── Modal Harga Aset ─────────────────────────────────── */}
            {priceTarget && (
                <div onClick={() => setPriceTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.8)", backdropFilter: "blur(10px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
                        {/* Handle bar */}
                        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
                            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--color-border-soft)" }} />
                        </div>

                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: priceTarget.color + "20", border: `1px solid ${priceTarget.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                    {priceTarget.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>{priceTarget.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                                        {priceTarget.quantity} {priceTarget.unit} · {TYPES.find(tp => tp.v === priceTarget.type)?.l}
                                        {priceTarget.brand && (() => { const b = GOLD_BRANDS.find(x => x.id === priceTarget.brand); return b ? ` · ${b.icon} ${b.label}` : ""; })()}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setPriceTarget(null)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>✕</button>
                        </div>

                        <div style={{ padding: "0 20px 28px" }}>
                            {/* Nilai live saat ini */}
                            {(() => {
                                const goldLive = priceTarget.type === "emas" && priceTarget.quantity
                                    ? lookupGoldPrice(getGoldPrices(priceTarget.brand), priceTarget.brand, priceTarget.quantity)
                                    : null;
                                const stockD    = priceTarget.type === "saham" && priceTarget.kode_saham
                                    ? stockPrices[priceTarget.kode_saham.toUpperCase()]
                                    : null;
                                const stockLive = stockD && priceTarget.quantity
                                    ? calcStockValue(stockD.price, priceTarget.quantity)
                                    : null;
                                const live = goldLive ?? stockLive;
                                const cur = live ?? priceTarget.current_value;
                                const gain = cur - priceTarget.buy_price;
                                const pct = priceTarget.buy_price > 0 ? ((gain / priceTarget.buy_price) * 100).toFixed(2) : 0;
                                const isProfit = gain >= 0;
                                return (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                                        <div style={{ background: "var(--bg-surface-low)", borderRadius: 12, padding: "12px 14px" }}>
                                            <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 4 }}>MODAL</div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-muted)" }}>{fmtRp(priceTarget.buy_price)}</div>
                                        </div>
                                        <div style={{ background: "var(--bg-surface-low)", borderRadius: 12, padding: "12px 14px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                                <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>NILAI SEKARANG</span>
                                                {live && <span style={{ fontSize: 8, fontWeight: 700, background: "rgba(96,252,198,.15)", color: "var(--color-primary)", border: "1px solid rgba(96,252,198,.3)", borderRadius: 4, padding: "1px 5px" }}>⚡ LIVE</span>}
                                            </div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: live ? "var(--color-primary)" : "var(--color-text)" }}>{fmtRp(cur)}</div>
                                        </div>
                                        <div style={{ gridColumn: "1/-1", background: isProfit ? "rgba(96,252,198,.06)" : "rgba(255,113,108,.06)", border: `1px solid ${isProfit ? "rgba(96,252,198,.15)" : "rgba(255,113,108,.15)"}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: 12, color: "var(--color-subtle)" }}>Gain / Loss</span>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: isProfit ? "var(--color-primary)" : "#ff716c" }}>{isProfit ? "+" : ""}{fmtRp(gain)}</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, background: isProfit ? "rgba(96,252,198,.12)" : "rgba(255,113,108,.12)", color: isProfit ? "var(--color-primary)" : "#ff716c", padding: "2px 8px", borderRadius: 6 }}>{isProfit ? "▲" : "▼"} {Math.abs(pct)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Detail harga saham live */}
                            {priceTarget.type === "saham" && priceTarget.kode_saham && (() => {
                                const sd = stockPrices[priceTarget.kode_saham.toUpperCase()];
                                if (!sd) return null;
                                return (
                                    <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)" }}>📈 {sd.ticker} · {sd.exchange}</div>
                                            <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>{sd.market_state === "REGULAR" ? "🟢 Market buka" : "🔴 Market tutup"}</span>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                            <div style={{ background: "var(--bg-surface-low)", borderRadius: 10, padding: "8px 10px" }}>
                                                <div style={{ fontSize: 9, color: "var(--color-subtle)", marginBottom: 2 }}>HARGA/SAHAM</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{fmtRp(sd.price)}</div>
                                            </div>
                                            <div style={{ background: "var(--bg-surface-low)", borderRadius: 10, padding: "8px 10px" }}>
                                                <div style={{ fontSize: 9, color: "var(--color-subtle)", marginBottom: 2 }}>PERUBAHAN</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: sd.change_pct >= 0 ? "var(--color-primary)" : "#ff716c" }}>
                                                    {formatChangePct(sd.change_pct)}
                                                </div>
                                            </div>
                                            <div style={{ background: "var(--bg-surface-low)", borderRadius: 10, padding: "8px 10px" }}>
                                                <div style={{ fontSize: 9, color: "var(--color-subtle)", marginBottom: 2 }}>TOTAL LOT</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{priceTarget.quantity} lot</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 8 }}>
                                            💡 1 lot = 100 saham · Diperbarui: {new Date(sd.timestamp).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · Sumber: {sd.source}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Panel harga — tergantung tipe & merek */}
                            {priceTarget.type === "emas" && priceTarget.brand && priceTarget.brand !== "lainnya" && getGoldPrices(priceTarget.brand) ? (
                                <GoldPricePanel
                                    goldPrices={getGoldPrices(priceTarget.brand)}
                                    onRefresh={priceTarget.brand === "antam" ? onRefreshGold : undefined}
                                    refreshing={priceTarget.brand === "antam" ? refreshingGold : false}
                                    onSelectPrice={(item, cat) => { handleSelectGoldPrice(item, cat); setPriceTarget(null); }}
                                />
                            ) : (
                                <PriceGuide type={priceTarget.type} brand={priceTarget.brand} />
                            )}
                        </div>
                    </div>
                </div>
            )}

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
