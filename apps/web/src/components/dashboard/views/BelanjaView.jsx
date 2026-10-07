import { useState } from "react";
import { useShopping, useShoppingSuggestions } from "../../../hooks/useShopping";
import { useHouseholdInfo } from "../../../hooks/useHouseholdInfo";

const card = {
    padding: "12px 14px", borderRadius: 14, background: "var(--bg-surface-low)",
    border: "1px solid var(--glass-border)", marginBottom: 8,
    display: "flex", alignItems: "center", gap: 12,
};
const checkBtn = (checked) => ({
    width: 24, height: 24, borderRadius: 8, flexShrink: 0, cursor: "pointer",
    border: "2px solid " + (checked ? "var(--color-primary)" : "var(--glass-border)"),
    background: checked ? "var(--color-primary)" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff",
});
const inputSt = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
    border: "1px solid var(--color-border)", background: "var(--bg-surface-low)",
    color: "var(--color-text)", fontSize: 14, fontFamily: "inherit", outline: "none",
};

/**
 * F-D (10-fitur-opsional-keluarga.md §6.5): "daftar + centang", minimal — chat Hermes tetap jalur
 * utama untuk menambah/catat dari struk, halaman ini hanya untuk lihat & koreksi cepat. Self-
 * contained (hook sendiri), pola sama dengan HouseholdPanel — supaya Dashboard.jsx tidak perlu
 * tahu soal shopping sama sekali kalau household tidak pakai fitur ini.
 *
 * Mengecek flag SENDIRI (bukan cuma mengandalkan Sidebar menyembunyikan menunya) — review
 * 2026-10-07: kalau owner mematikan fitur ini lewat sesi/perangkat LAIN persis saat halaman ini
 * masih terbuka, polling 30 detik (main.jsx) akan membuat GET /v1/shopping mulai 403 tanpa pesan
 * jelas (fallback hook `?? []` bikin layar kelihatan "kosong", bukan "dimatikan").
 */
const BelanjaView = ({ showToast }) => {
    const { household } = useHouseholdInfo();
    const enabled = !!household?.features?.shopping_stock?.enabled;
    const { needed, bought, shoppingLoading, addItem, markBought, markNeeded, deleteItem } = useShopping(enabled);
    const { suggestions } = useShoppingSuggestions(enabled);
    const [newName, setNewName] = useState("");
    const [showBought, setShowBought] = useState(false);

    if (household && !enabled) {
        return (
            <div style={{ textAlign: "center", padding: 40, color: "var(--color-muted)", fontSize: 13 }}>
                Fitur Belanja &amp; Stok baru saja dimatikan. Buka Settings → Household → Fitur opsional untuk menyalakannya lagi.
            </div>
        );
    }

    const toast = (msg, type) => showToast?.(msg, type);

    const handleAdd = async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
            await addItem({ name: trimmed });
            setNewName("");
        } catch (err) {
            toast(err.message || "Gagal menambah item", "error");
        }
    };

    return (
        <div style={{ animation: "fadeIn .4s", maxWidth: 560 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 8 }}>RUMAH</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginBottom: 20 }}>🛒 Belanja</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                    style={inputSt} placeholder="Tambah item (mis. telur, sabun cuci)..."
                    value={newName} onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(newName); }}
                />
                <button
                    onClick={() => handleAdd(newName)}
                    style={{ padding: "0 18px", borderRadius: 12, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
                >
                    + Tambah
                </button>
            </div>

            {suggestions.length > 0 && (
                <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 12, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>💡 Stok menipis, mungkin perlu dibeli:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {suggestions.map((s) => (
                            <button
                                key={s.pantry_item_id} onClick={() => handleAdd(s.name)}
                                style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(245,158,11,.3)", background: "rgba(245,158,11,.12)", color: "var(--color-text)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                            >
                                + {s.name} ({s.qty}/{s.min_qty})
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {shoppingLoading && <div style={{ textAlign: "center", padding: 30, color: "var(--color-muted)" }}>Memuat...</div>}

            {!shoppingLoading && needed.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: "var(--color-muted)", fontSize: 13 }}>Daftar belanja kosong 🎉</div>
            )}

            {needed.map((item) => (
                <div key={item.id} style={card}>
                    <div style={checkBtn(false)} onClick={() => markBought(item.id).catch((e) => toast(e.message, "error"))} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{item.name}</div>
                        {item.notes && <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{item.notes}</div>}
                    </div>
                    <button
                        onClick={() => deleteItem(item.id).catch((e) => toast(e.message, "error"))}
                        style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 14, padding: 4 }}
                    >✕</button>
                </div>
            ))}

            {bought.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <button
                        onClick={() => setShowBought((v) => !v)}
                        style={{ background: "none", border: "none", color: "var(--color-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                    >
                        {showBought ? "▾" : "▸"} Sudah dibeli ({bought.length})
                    </button>
                    {showBought && bought.map((item) => (
                        <div key={item.id} style={{ ...card, opacity: .55, marginTop: 8 }}>
                            <div style={checkBtn(true)} onClick={() => markNeeded(item.id).catch((e) => toast(e.message, "error"))}>✓</div>
                            <div style={{ flex: 1, fontSize: 14, color: "var(--color-text)", textDecoration: "line-through" }}>{item.name}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BelanjaView;
