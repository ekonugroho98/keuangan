import { useState, useMemo } from "react";
import { usePantry, usePantryExpiring, LOCATIONS } from "../../../hooks/usePantry";
import { useHouseholdInfo } from "../../../hooks/useHouseholdInfo";

const card = {
    padding: "10px 14px", borderRadius: 14, background: "var(--bg-surface-low)",
    border: "1px solid var(--glass-border)", marginBottom: 8,
    display: "flex", alignItems: "center", gap: 10,
};
const inputSt = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--color-border)", background: "var(--bg-surface-low)",
    color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none",
};
const qtyBtn = {
    width: 26, height: 26, borderRadius: 8, border: "1px solid var(--glass-border)",
    background: "var(--color-border-soft)", color: "var(--color-text)", fontSize: 15,
    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
};
const modalOverlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 };
const modalBox = { background: "var(--bg-surface)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, border: "1px solid var(--glass-border)" };

const emptyForm = { name: "", unit: "pcs", qty: "", min_qty: "", location: "other", expires_at: "" };

/**
 * F-D (10-fitur-opsional-keluarga.md §6.5): "qty, badge menipis, dikelompokkan per lokasi".
 * Self-contained (hook sendiri, pola sama dengan BelanjaView/HouseholdPanel).
 *
 * Mengecek flag SENDIRI — lihat catatan panjang di BelanjaView.jsx soal kenapa (polling 30 detik
 * bisa mematikan fiturnya persis saat halaman ini terbuka di perangkat lain).
 */
const PantryView = ({ showToast }) => {
    const { household } = useHouseholdInfo();
    const enabled = !!household?.features?.shopping_stock?.enabled;
    const { items, pantryLoading, addItem, deleteItem, addMovement } = usePantry(enabled);
    const { expired, expiring } = usePantryExpiring(3, enabled);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState(emptyForm);
    // Hook (useMemo) WAJIB dipanggil sebelum early return mana pun (rules-of-hooks) — early return
    // "fitur dimatikan" di bawah harus setelah ini, bukan sebelumnya.
    const warningIds = useMemo(() => new Set([...expired, ...expiring].map((i) => i.id)), [expired, expiring]);
    const grouped = useMemo(() => {
        const byLoc = {};
        for (const loc of LOCATIONS) byLoc[loc.value] = [];
        for (const item of items) (byLoc[item.location] ?? byLoc.other).push(item);
        return byLoc;
    }, [items]);

    if (household && !enabled) {
        return (
            <div style={{ textAlign: "center", padding: 40, color: "var(--color-muted)", fontSize: 13 }}>
                Fitur Belanja &amp; Stok baru saja dimatikan. Buka Settings → Household → Fitur opsional untuk menyalakannya lagi.
            </div>
        );
    }

    const toast = (msg, type) => showToast?.(msg, type);

    const handleAdjust = async (item, delta) => {
        try {
            await addMovement(item.id, { delta, reason: delta > 0 ? "purchase" : "consume" });
        } catch (err) {
            toast(err.message || "Gagal mengubah stok", "error");
        }
    };

    const handleAddSubmit = async () => {
        if (!form.name.trim()) return;
        try {
            await addItem({
                name: form.name.trim(), unit: form.unit || "pcs",
                qty: form.qty ? Number(form.qty) : 0,
                min_qty: form.min_qty ? Number(form.min_qty) : undefined,
                location: form.location, expires_at: form.expires_at || undefined,
            });
            setShowAdd(false);
            setForm(emptyForm);
        } catch (err) {
            toast(err.message || "Gagal menambah item", "error");
        }
    };

    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 620 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>RUMAH</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)" }}>🥫 Stok</div>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >+ Tambah item</button>
            </div>

            {(expired.length > 0 || expiring.length > 0) && (
                <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 12, background: "rgba(255,113,108,.08)", border: "1px solid rgba(255,113,108,.25)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ff716c" }}>
                        ⚠️ {expired.length > 0 && `${expired.length} sudah lewat`}{expired.length > 0 && expiring.length > 0 && " · "}{expiring.length > 0 && `${expiring.length} akan basi ≤3 hari`}
                    </div>
                </div>
            )}

            {pantryLoading && <div style={{ textAlign: "center", padding: 30, color: "var(--color-muted)" }}>Memuat...</div>}

            {!pantryLoading && items.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: "var(--color-muted)", fontSize: 13 }}>Belum ada item di stok</div>
            )}

            {LOCATIONS.map((loc) => {
                const list = grouped[loc.value];
                if (!list || list.length === 0) return null;
                return (
                    <div key={loc.value} style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{loc.icon} {loc.label}</div>
                        {list.map((item) => {
                            const low = item.min_qty != null && item.qty <= item.min_qty;
                            const warn = warningIds.has(item.id);
                            return (
                                <div key={item.id} style={card}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                                            {item.name}
                                            {warn && <span style={{ marginLeft: 6, fontSize: 10, color: "#ff716c" }}>⚠️ {item.expires_estimated ? "~" : ""}{item.expires_at}</span>}
                                            {!warn && low && <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b" }}>● menipis</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{item.qty} {item.unit}{item.min_qty != null ? ` · min ${item.min_qty}` : ""}</div>
                                    </div>
                                    <button style={qtyBtn} onClick={() => handleAdjust(item, -1)}>−</button>
                                    <button style={qtyBtn} onClick={() => handleAdjust(item, 1)}>+</button>
                                    <button
                                        onClick={() => deleteItem(item.id).catch((e) => toast(e.message, "error"))}
                                        style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 14, padding: 4 }}
                                    >✕</button>
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {showAdd && (
                <div style={modalOverlay} onClick={() => setShowAdd(false)}>
                    <div style={modalBox} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 14 }}>Tambah item stok</div>
                        <input style={{ ...inputSt, marginBottom: 8 }} placeholder="Nama (mis. Telur)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <input style={inputSt} type="number" placeholder="Jumlah" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
                            <input style={inputSt} placeholder="Satuan (pcs/kg/L)" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <select style={inputSt} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}>
                                {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
                            </select>
                            <input style={inputSt} type="number" placeholder="Min. stok (opsional)" value={form.min_qty} onChange={(e) => setForm((f) => ({ ...f, min_qty: e.target.value }))} />
                        </div>
                        <input style={{ ...inputSt, marginBottom: 14 }} type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--glass-border)", background: "transparent", color: "var(--color-text)", cursor: "pointer", fontFamily: "inherit" }}>Batal</button>
                            <button onClick={handleAddSubmit} disabled={!form.name.trim()} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: form.name.trim() ? 1 : .5 }}>Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PantryView;
