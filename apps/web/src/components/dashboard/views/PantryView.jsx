import { useState, useMemo } from "react";
import { usePantry, usePantryExpiring, LOCATIONS } from "../../../hooks/usePantry";
import { useShopping } from "../../../hooks/useShopping";
import { useHouseholdInfo } from "../../../hooks/useHouseholdInfo";

const glassCard = {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    padding: "20px 22px",
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
    gap: 10,
    flexWrap: "wrap",
};

const inputSt = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    background: "var(--bg-surface-low)",
    color: "var(--color-text)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
};

const qtyBtn = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid var(--glass-border)",
    background: "var(--color-border-soft)",
    color: "var(--color-text)",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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

const emptyForm = { name: "", unit: "pcs", qty: "1", min_qty: "", location: "fridge", expires_at: "" };

const PantryView = ({ showToast, setActiveMenu }) => {
    const { household } = useHouseholdInfo();
    const enabled = !!household?.features?.shopping_stock?.enabled;
    const { items, pantryLoading, addItem, updateItem, deleteItem, addMovement } = usePantry(enabled);
    const { expired, expiring } = usePantryExpiring(3, enabled);
    const { addItem: addShoppingItem, needed: shoppingNeeded } = useShopping(enabled);

    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editModal, setEditModal] = useState(null);
    const [locFilter, setLocFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");

    const expiredIds = useMemo(() => new Set(expired.map((i) => i.id)), [expired]);
    const expiringIds = useMemo(() => new Set(expiring.map((i) => i.id)), [expiring]);
    const warningIds = useMemo(() => new Set([...expiredIds, ...expiringIds]), [expiredIds, expiringIds]);
    const shoppingNames = useMemo(
        () => new Set((shoppingNeeded || []).map((s) => s.name.trim().toLowerCase())),
        [shoppingNeeded]
    );

    const isLowOrEmpty = (item) =>
        item.qty <= 0 || (item.min_qty != null && item.qty <= item.min_qty);

    const stats = useMemo(() => {
        let available = 0;
        let lowOrEmpty = 0;
        const byLocCount = { fridge: 0, freezer: 0, shelf: 0, other: 0 };
        for (const item of items) {
            if (item.qty > 0) available += 1;
            if (isLowOrEmpty(item)) lowOrEmpty += 1;
            const k = byLocCount[item.location] !== undefined ? item.location : "other";
            byLocCount[k] += 1;
        }
        return { available, lowOrEmpty, byLocCount };
    }, [items]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((item) => {
            if (locFilter !== "all" && item.location !== locFilter) return false;
            if (statusFilter === "available" && item.qty <= 0) return false;
            if (statusFilter === "low" && !isLowOrEmpty(item)) return false;
            if (statusFilter === "expiring" && !warningIds.has(item.id)) return false;
            if (q && !item.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [items, locFilter, statusFilter, search, warningIds]);

    const grouped = useMemo(() => {
        const byLoc = {};
        for (const loc of LOCATIONS) byLoc[loc.value] = [];
        for (const item of filteredItems) {
            (byLoc[item.location] ?? byLoc.other).push(item);
        }
        return byLoc;
    }, [filteredItems]);

    if (household && !enabled) {
        return (
            <div style={{ textAlign: "center", padding: 40, color: "var(--color-muted)", fontSize: 13 }}>
                Fitur Belanja &amp; Stok belum aktif. Buka Settings → Household → Fitur opsional untuk menyalakannya.
            </div>
        );
    }

    const toast = (msg, type) => showToast?.(msg, type);

    const handleAdjust = async (item, delta) => {
        if (item.qty + delta < 0) return;
        try {
            await addMovement(item.id, { delta, reason: delta > 0 ? "purchase" : "consume" });
        } catch (err) {
            toast(err.message || "Gagal mengubah stok", "error");
        }
    };

    const handleSendToShopping = async (item) => {
        try {
            const targetQty = item.min_qty && item.min_qty > 0 ? `${item.min_qty} ${item.unit}` : `1 ${item.unit}`;
            await addShoppingItem({
                name: item.name,
                qty_text: targetQty,
                notes: `Stok ${LOCATIONS.find((l) => l.value === item.location)?.label || "rumah"} sisa ${item.qty} ${item.unit}`,
            });
            toast(`"${item.name}" ditambahkan ke Daftar Belanja`);
        } catch (err) {
            toast(err.message || "Gagal menambah ke daftar belanja", "error");
        }
    };

    const handleAddSubmit = async () => {
        if (!form.name.trim()) return;
        try {
            await addItem({
                name: form.name.trim(),
                unit: form.unit || "pcs",
                qty: form.qty !== "" ? Number(form.qty) : 0,
                min_qty: form.min_qty !== "" ? Number(form.min_qty) : undefined,
                location: form.location,
                expires_at: form.expires_at || undefined,
            });
            setShowAdd(false);
            setForm(emptyForm);
        } catch (err) {
            toast(err.message || "Gagal menambah item", "error");
        }
    };

    const handleEditSave = async () => {
        if (!editModal || !editModal.name.trim()) return;
        try {
            await updateItem(editModal.id, {
                name: editModal.name.trim(),
                unit: editModal.unit.trim() || "pcs",
                location: editModal.location,
                min_qty: editModal.min_qty === "" ? null : Number(editModal.min_qty),
                expires_at: editModal.expires_at || null,
            });
            const newQty = Number(editModal.qty);
            if (!Number.isNaN(newQty) && newQty !== editModal.origQty) {
                const delta = newQty - editModal.origQty;
                if (delta !== 0) {
                    await addMovement(editModal.id, { delta, reason: "adjust", note: "Koreksi stok manual" });
                }
            }
            setEditModal(null);
        } catch (err) {
            toast(err.message || "Gagal menyimpan perubahan", "error");
        }
    };

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ ...eyebrow, marginBottom: 8 }}>KELUARGA &amp; RUMAH</div>
                    <h1 style={{ fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 900, color: "var(--color-text)", letterSpacing: "-.03em", margin: 0 }}>
                        🧊 Stok Kulkas &amp; Rumah
                    </h1>
                    <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                        Pantau isi kulkas, freezer, dapur, &amp; kebutuhan rumah tangga beserta pengingat kedaluwarsa.
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {setActiveMenu && (
                        <button
                            onClick={() => setActiveMenu("belanja")}
                            style={{
                                padding: "11px 16px",
                                borderRadius: 12,
                                border: "1px solid var(--glass-border)",
                                background: "var(--glass-1)",
                                color: "var(--color-text)",
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            🛒 Daftar Belanja ({shoppingNeeded.length})
                        </button>
                    )}
                    <button
                        onClick={() => setShowAdd(true)}
                        style={{
                            padding: "11px 20px",
                            borderRadius: 12,
                            border: "none",
                            background: "var(--color-primary)",
                            color: "var(--color-on-primary)",
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        + Tambah Stok
                    </button>
                </div>
            </div>

            {/* KPI Summary Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
                <div
                    onClick={() => setStatusFilter(statusFilter === "available" ? "all" : "available")}
                    style={{
                        ...glassCard,
                        cursor: "pointer",
                        background: statusFilter === "available"
                            ? "linear-gradient(145deg, rgba(131,155,122,.16), rgba(131,155,122,.04))"
                            : "linear-gradient(145deg, rgba(131,155,122,.08), rgba(131,155,122,.02))",
                        border: statusFilter === "available" ? "1px solid var(--color-primary)" : "1px solid rgba(131,155,122,.2)",
                    }}
                >
                    <div style={eyebrow}>Stok Tersedia</div>
                    <div className="num-tight" style={{ fontSize: 32, fontWeight: 900, color: "var(--color-text)", marginTop: 8 }}>
                        {stats.available} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>/ {items.length} item</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 6 }}>
                        Klik untuk filter yang ready
                    </div>
                </div>

                <div
                    onClick={() => setStatusFilter(statusFilter === "low" ? "all" : "low")}
                    style={{
                        ...glassCard,
                        cursor: "pointer",
                        background: stats.lowOrEmpty > 0
                            ? "linear-gradient(145deg, rgba(245,158,11,.12), rgba(245,158,11,.02))"
                            : "var(--glass-1)",
                        border: statusFilter === "low"
                            ? "1px solid #f59e0b"
                            : stats.lowOrEmpty > 0
                                ? "1px solid rgba(245,158,11,.28)"
                                : "1px solid var(--glass-border)",
                    }}
                >
                    <div style={eyebrow}>Habis / Menipis</div>
                    <div className="num-tight" style={{ fontSize: 32, fontWeight: 900, color: stats.lowOrEmpty > 0 ? "#f59e0b" : "var(--color-text)", marginTop: 8 }}>
                        {stats.lowOrEmpty} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>item</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 6 }}>
                        {stats.lowOrEmpty > 0 ? "Perlu masuk daftar belanja" : "Semua stok aman"}
                    </div>
                </div>

                <div
                    onClick={() => setStatusFilter(statusFilter === "expiring" ? "all" : "expiring")}
                    style={{
                        ...glassCard,
                        cursor: "pointer",
                        background: warningIds.size > 0
                            ? "linear-gradient(145deg, rgba(255,113,108,.14), rgba(255,113,108,.02))"
                            : "var(--glass-1)",
                        border: statusFilter === "expiring"
                            ? "1px solid #ff716c"
                            : warningIds.size > 0
                                ? "1px solid rgba(255,113,108,.3)"
                                : "1px solid var(--glass-border)",
                    }}
                >
                    <div style={eyebrow}>Kedaluwarsa ≤3 Hari</div>
                    <div className="num-tight" style={{ fontSize: 32, fontWeight: 900, color: warningIds.size > 0 ? "#ff716c" : "var(--color-text)", marginTop: 8 }}>
                        {warningIds.size} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>item</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 6 }}>
                        {expired.length > 0 ? `${expired.length} lewat · ${expiring.length} segera basi` : "Tidak ada yang segera basi"}
                    </div>
                </div>
            </div>

            {/* Location Tiles + Filter Bar */}
            <div style={{ ...glassCard, marginBottom: 18, padding: "16px 18px" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                            onClick={() => setLocFilter("all")}
                            className={locFilter === "all" ? "chip chip-mint" : "chip chip-ghost"}
                            style={{ cursor: "pointer", border: "none", fontFamily: "inherit", padding: "7px 12px", fontSize: 12 }}
                        >
                            Semua Lokasi ({items.length})
                        </button>
                        {LOCATIONS.map((loc) => (
                            <button
                                key={loc.value}
                                onClick={() => setLocFilter(locFilter === loc.value ? "all" : loc.value)}
                                className={locFilter === loc.value ? "chip chip-mint" : "chip chip-ghost"}
                                style={{ cursor: "pointer", border: "none", fontFamily: "inherit", padding: "7px 12px", fontSize: 12 }}
                            >
                                {loc.icon} {loc.label} ({stats.byLocCount[loc.value] || 0})
                            </button>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 220px", maxWidth: 320 }}>
                        <input
                            style={{ ...inputSt, padding: "8px 12px", fontSize: 12 }}
                            placeholder="🔍 Cari isi kulkas / stok rumah..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {statusFilter !== "all" && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--color-muted)" }}>
                        <span>
                            Filter aktif:{" "}
                            <strong style={{ color: "var(--color-primary)" }}>
                                {statusFilter === "available" ? "Stok Tersedia (>0)" : statusFilter === "low" ? "Habis / Menipis" : "Kedaluwarsa ≤3 Hari"}
                            </strong>
                        </span>
                        <button
                            onClick={() => setStatusFilter("all")}
                            style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}
                        >
                            Reset ✕
                        </button>
                    </div>
                )}
            </div>

            {pantryLoading && (
                <div style={{ textAlign: "center", padding: 30, color: "var(--color-muted)" }}>Memuat stok...</div>
            )}

            {!pantryLoading && filteredItems.length === 0 && (
                <div style={{ ...glassCard, textAlign: "center", padding: 36, color: "var(--color-muted)", fontSize: 13 }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.45 }}>🧊</div>
                    {items.length === 0
                        ? "Belum ada item di stok kulkas & rumah. Klik '+ Tambah Stok' untuk mulai mencatat."
                        : "Tidak ada item yang cocok dengan filter ini."}
                </div>
            )}

            {/* Grouped by Location */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16 }}>
                {LOCATIONS.map((loc) => {
                    const list = grouped[loc.value];
                    if (!list || list.length === 0) return null;
                    return (
                        <div key={loc.value} style={glassCard}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 20 }}>{loc.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)" }}>{loc.label}</div>
                                        <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                                            {list.filter((i) => i.qty > 0).length} tersedia · {list.filter((i) => i.qty <= 0).length} habis
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setForm({ ...emptyForm, location: loc.value });
                                        setShowAdd(true);
                                    }}
                                    style={{
                                        padding: "5px 10px",
                                        borderRadius: 8,
                                        border: "1px solid var(--glass-border)",
                                        background: "var(--bg-surface-low)",
                                        color: "var(--color-primary)",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    + {loc.label}
                                </button>
                            </div>

                            {list.map((item) => {
                                const empty = item.qty <= 0;
                                const low = !empty && item.min_qty != null && item.qty <= item.min_qty;
                                const isExpired = expiredIds.has(item.id);
                                const isExpiring = expiringIds.has(item.id);
                                const alreadyInShopping = shoppingNames.has(item.name.trim().toLowerCase());

                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            ...itemCard,
                                            opacity: empty ? 0.72 : 1,
                                            borderColor: isExpired
                                                ? "rgba(255,113,108,.4)"
                                                : empty || low
                                                    ? "rgba(245,158,11,.3)"
                                                    : "var(--glass-border)",
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 140 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                                                    {item.name}
                                                </span>
                                                {empty && (
                                                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: "rgba(255,113,108,.15)", color: "#ff716c" }}>
                                                        Habis
                                                    </span>
                                                )}
                                                {low && (
                                                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,.15)", color: "#f59e0b" }}>
                                                        Menipis
                                                    </span>
                                                )}
                                                {(isExpired || isExpiring) && (
                                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(255,113,108,.15)", color: "#ff716c" }}>
                                                        ⚠️ {isExpired ? "Lewat" : "Basi"} {item.expires_estimated ? "~" : ""}{item.expires_at}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 3 }}>
                                                Stok: <strong className="mono" style={{ color: empty ? "#ff716c" : "var(--color-text)" }}>{item.qty} {item.unit}</strong>
                                                {item.min_qty != null ? ` · min ${item.min_qty} ${item.unit}` : ""}
                                                {item.expires_at && !isExpired && !isExpiring ? ` · exp ${item.expires_at}` : ""}
                                            </div>
                                        </div>

                                        {(empty || low) && !alreadyInShopping && (
                                            <button
                                                onClick={() => handleSendToShopping(item)}
                                                title="Masukkan ke Daftar Belanja"
                                                style={{
                                                    padding: "5px 9px",
                                                    borderRadius: 8,
                                                    border: "1px solid rgba(131,155,122,.3)",
                                                    background: "rgba(131,155,122,.1)",
                                                    color: "var(--color-primary)",
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                    fontFamily: "inherit",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                🛒 + Belanja
                                            </button>
                                        )}

                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <button
                                                style={{ ...qtyBtn, opacity: item.qty <= 0 ? 0.35 : 1 }}
                                                disabled={item.qty <= 0}
                                                onClick={() => handleAdjust(item, -1)}
                                                title="Kurangi 1"
                                            >
                                                −
                                            </button>
                                            <button
                                                style={qtyBtn}
                                                onClick={() => handleAdjust(item, 1)}
                                                title="Tambah 1"
                                            >
                                                +
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setEditModal({
                                                        id: item.id,
                                                        name: item.name,
                                                        unit: item.unit || "pcs",
                                                        qty: String(item.qty),
                                                        origQty: item.qty,
                                                        min_qty: item.min_qty != null ? String(item.min_qty) : "",
                                                        location: item.location || "other",
                                                        expires_at: item.expires_at || "",
                                                    })
                                                }
                                                title="Edit item stok"
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
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Add Modal */}
            {showAdd && (
                <div style={modalOverlay} onClick={() => setShowAdd(false)}>
                    <div style={modalBox} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", marginBottom: 14 }}>
                            Tambah Item Stok Rumah
                        </div>
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Nama Barang</div>
                            <input
                                style={inputSt}
                                placeholder="Nama (mis. Telur, Susu UHT, Ayam Ungkep)"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Jumlah Saat Ini</div>
                                <input
                                    style={inputSt}
                                    type="number"
                                    placeholder="Jumlah"
                                    value={form.qty}
                                    onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Satuan</div>
                                <input
                                    style={inputSt}
                                    placeholder="pcs / kg / liter / pak"
                                    value={form.unit}
                                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Lokasi Penyimpanan</div>
                                <select
                                    style={inputSt}
                                    value={form.location}
                                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                                >
                                    {LOCATIONS.map((l) => (
                                        <option key={l.value} value={l.value}>{l.icon} {l.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Batas Min. Stok</div>
                                <input
                                    style={inputSt}
                                    type="number"
                                    placeholder="Ingatkan jika ≤ ..."
                                    value={form.min_qty}
                                    onChange={(e) => setForm((f) => ({ ...f, min_qty: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Tanggal Kedaluwarsa (Opsional)</div>
                            <input
                                style={inputSt}
                                type="date"
                                value={form.expires_at}
                                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => setShowAdd(false)}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--glass-border)", background: "transparent", color: "var(--color-text)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleAddSubmit}
                                disabled={!form.name.trim()}
                                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: form.name.trim() ? 1 : 0.5 }}
                            >
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal && (
                <div style={modalOverlay} onClick={() => setEditModal(null)}>
                    <div style={modalBox} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", marginBottom: 14 }}>
                            Edit Item Stok
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
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Jumlah Saat Ini</div>
                                <input
                                    style={inputSt}
                                    type="number"
                                    value={editModal.qty}
                                    onChange={(e) => setEditModal((m) => ({ ...m, qty: e.target.value }))}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Satuan</div>
                                <input
                                    style={inputSt}
                                    value={editModal.unit}
                                    onChange={(e) => setEditModal((m) => ({ ...m, unit: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Lokasi Penyimpanan</div>
                                <select
                                    style={inputSt}
                                    value={editModal.location}
                                    onChange={(e) => setEditModal((m) => ({ ...m, location: e.target.value }))}
                                >
                                    {LOCATIONS.map((l) => (
                                        <option key={l.value} value={l.value}>{l.icon} {l.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Batas Min. Stok</div>
                                <input
                                    style={inputSt}
                                    type="number"
                                    placeholder="Kosongkan jika tidak ada"
                                    value={editModal.min_qty}
                                    onChange={(e) => setEditModal((m) => ({ ...m, min_qty: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 4 }}>Tanggal Kedaluwarsa</div>
                            <input
                                style={inputSt}
                                type="date"
                                value={editModal.expires_at}
                                onChange={(e) => setEditModal((m) => ({ ...m, expires_at: e.target.value }))}
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

export default PantryView;
