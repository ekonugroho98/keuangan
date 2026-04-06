import { useRef, useState } from "react";
import Modal from "../ui/Modal";
import InputField from "../ui/InputField";
import AmountInput from "../ui/AmountInput";
import { expenseCategories, incomeCategories } from "../../constants/categories";
import { useLanguage } from "../../i18n/LanguageContext";

/* ── Scan Struk: kirim gambar ke AI, ekstrak semua item transaksi ── */
const SCAN_CATEGORIES = ["Makanan & Minuman","Transportasi","Belanja","Hiburan","Kesehatan","Pendidikan","Tagihan","Lainnya"];

async function scanReceiptWithAI(base64, mimeType, aiConfig) {
    const { provider, apiKey } = aiConfig || {};
    if (!apiKey) throw new Error("API key belum diset");

    const prompt = `Kamu adalah asisten keuangan Indonesia. Baca struk/nota/receipt ini dan ekstrak SEMUA item produk/layanan yang dibeli secara terpisah.
Kembalikan HANYA JSON (tanpa penjelasan lain) dengan format:
{
  "merchant": "Nama Toko",
  "date": "2026-04-06",
  "items": [
    { "note": "Nama Produk 1", "amount": 15000, "category": "Makanan & Minuman" },
    { "note": "Nama Produk 2", "amount": 8500, "category": "Belanja" }
  ]
}
Aturan penting:
- items: daftar SETIAP produk/item yang dibeli (bukan total/subtotal/pajak/kembalian)
- note: nama produk singkat dan jelas
- amount: harga total untuk item itu (qty × harga satuan), angka bulat tanpa titik/koma
- category: pilih salah satu: "Makanan & Minuman", "Transportasi", "Belanja", "Hiburan", "Kesehatan", "Pendidikan", "Tagihan", "Lainnya"
- date: format YYYY-MM-DD dari struk, jika tidak ada tulis null
- Jangan masukkan baris Total, Subtotal, PPN, Diskon, Kembalian sebagai item
Jika gambar bukan struk/nota, kembalikan: {"error": "bukan struk"}`;

    let url, headers, body;

    if (provider === "groq") {
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
        body = { model: "meta-llama/llama-4-scout-17b-16e-instruct", max_tokens: 1000,
            messages: [{ role: "user", content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ]}]};
    } else if (provider === "openai") {
        url = "https://api.openai.com/v1/chat/completions";
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
        body = { model: "gpt-4o-mini", max_tokens: 1000,
            messages: [{ role: "user", content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ]}]};
    } else if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers = { "Content-Type": "application/json", "x-api-key": apiKey,
            "anthropic-version": "2023-06-01", "anthropic-dangerous-allow-browser": "true" };
        body = { model: "claude-3-5-haiku-20241022", max_tokens: 1000,
            messages: [{ role: "user", content: [
                { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
                { type: "text", text: prompt },
            ]}]};
    } else if (provider === "google") {
        url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        body = { contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
        ]}]};
    } else {
        throw new Error("Provider tidak mendukung scan gambar");
    }

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Gagal scan");

    let text = "";
    if (provider === "anthropic") text = data.content?.[0]?.text || "";
    else if (provider === "google") text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    else text = data.choices?.[0]?.message?.content || "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Format respons tidak valid");
    return JSON.parse(match[0]);
}

const fmtRpLocal = (n) => "Rp " + Number(n).toLocaleString("id-ID");

/* ── DatePicker: 3 selects (day/month/year) — works in all browsers/mobile ── */
const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const DatePicker = ({ value, onChange }) => {
    const [y, m, d] = (value || new Date().toISOString().slice(0,10)).split("-");
    const year = parseInt(y), month = parseInt(m), day = parseInt(d);
    const daysInMonth = new Date(year, month, 0).getDate();
    const years = Array.from({ length: 5 }, (_, i) => year - 2 + i);
    const sel = { padding: "9px 8px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--bg-surface-low)", color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", cursor: "pointer", flex: 1 };
    const set = (newY, newM, newD) => {
        const maxD = new Date(newY, newM, 0).getDate();
        const safeD = Math.min(newD, maxD);
        onChange(`${newY}-${String(newM).padStart(2,"0")}-${String(safeD).padStart(2,"0")}`);
    };
    return (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <select value={day} onChange={e => set(year, month, parseInt(e.target.value))} style={sel}>
                {Array.from({ length: daysInMonth }, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={month} onChange={e => set(year, parseInt(e.target.value), day)} style={{ ...sel, flex: 2 }}>
                {MONTHS_ID.map((mn, i) => <option key={i+1} value={i+1}>{mn}</option>)}
            </select>
            <select value={year} onChange={e => set(parseInt(e.target.value), month, day)} style={{ ...sel, flex: 2 }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    );
};

const TYPES = [
    { v: "expense",  l: "Pengeluaran", c: "#ff716c" },
    { v: "income",   l: "Pemasukan",   c: "var(--color-primary)" },
    { v: "transfer", l: "Antar Rekening", c: "#06b6d4" },
];

const AddTransactionModal = ({
    open, onClose,
    txForm, setTxForm,
    onSubmit, onTransfer,
    accounts, customCategories = [],
    // Edit mode
    editMode = false, onUpdate,
    // Loading state
    isSaving = false,
    // AI config for scan struk
    aiConfig = null,
    // Multi-item save
    onSubmitMultiple,
}) => {
    const { t } = useLanguage();
    const fileRef = useRef(null);
    const [scanLoading, setScanLoading]   = useState(false);
    const [scanError, setScanError]       = useState("");
    const [scanResults, setScanResults]   = useState(null); // { merchant, date, items }
    const [scanItems, setScanItems]       = useState([]);   // editable items dengan .selected
    const [scanAccount, setScanAccount]   = useState("");

    const resetScan = () => { setScanResults(null); setScanItems([]); setScanError(""); };

    const handleScanFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setScanError("");
        setScanLoading(true);
        try {
            const base64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result.split(",")[1]);
                r.onerror = rej;
                r.readAsDataURL(file);
            });
            const result = await scanReceiptWithAI(base64, file.type, aiConfig);
            if (result.error) { setScanError("⚠️ " + result.error); return; }
            if (!result.items?.length) { setScanError("⚠️ Tidak ada item yang terdeteksi"); return; }
            setScanResults(result);
            setScanItems(result.items.map((item, i) => ({ ...item, id: i, selected: true })));
            setScanAccount(txForm.account || accounts[0]?.name || "");
        } catch (err) {
            setScanError("❌ " + (err.message || "Gagal membaca struk"));
        } finally {
            setScanLoading(false);
        }
    };

    const handleSaveMultiple = () => {
        const selected = scanItems.filter(i => i.selected);
        if (!selected.length) return;
        onSubmitMultiple && onSubmitMultiple(selected, scanAccount, scanResults?.date);
        resetScan();
    };

    /* Terjemahkan nama kategori default, custom tetap nama asli */
    const DEFAULT_CATS = new Set([...expenseCategories, ...incomeCategories]);
    const tCat = (name) => { if (!DEFAULT_CATS.has(name)) return name; const k = "cat.name." + name; const v = t(k); return v === k ? name : v; };

    const extraExpense = customCategories.filter(c => c.type !== "income").map(c => c.name);
    const extraIncome  = customCategories.filter(c => c.type !== "expense").map(c => c.name);
    const allExpense = [...expenseCategories, ...extraExpense];
    const allIncome  = [...incomeCategories,  ...extraIncome];

    const isTransfer = txForm.type === "transfer";
    const canSubmit = isTransfer
        ? txForm.amount && txForm.account && txForm.toAccount && txForm.account !== txForm.toAccount
        : !!txForm.amount;

    const handleSubmit = () => {
        if (editMode)   { onUpdate(); return; }
        if (isTransfer) { onTransfer(); return; }
        onSubmit();
    };

    const submitLabel = isSaving
        ? "Menyimpan..."
        : editMode
            ? "✅ Update Transaksi"
            : isTransfer ? "🔀 Pindah Antar Rekening" : "Simpan Transaksi";

    return (
    <Modal open={open} onClose={onClose}>
        <div style={{ background: "var(--bg-surface-low)", borderRadius: "20px 20px 0 0", border: "1px solid var(--color-border)", borderBottom: "none", padding: "24px 20px 36px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>
                        {editMode ? "✏️ Edit Transaksi" : "Tambah Transaksi"}
                    </h3>
                    {editMode && <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Ubah detail transaksi di bawah</p>}
                </div>
                <button onClick={onClose} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Tipe — tidak bisa ganti tipe saat edit transfer */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {TYPES.map(t => {
                    const disabled = editMode && isTransfer && t.v !== "transfer";
                    return (
                        <button key={t.v}
                            onClick={() => !disabled && !editMode && setTxForm(p => ({ ...p, type: t.v, toAccount: "" }))}
                            disabled={disabled || editMode}
                            style={{
                                flex: 1, padding: 10, borderRadius: 10,
                                border: `1px solid ${txForm.type === t.v ? t.c + "55" : "var(--color-border-soft)"}`,
                                background: txForm.type === t.v ? t.c + "15" : "transparent",
                                color: txForm.type === t.v ? t.c : "#475569",
                                fontWeight: 600, fontSize: 12,
                                cursor: (disabled || editMode) ? "default" : "pointer",
                                fontFamily: "inherit",
                                opacity: (disabled || (editMode && txForm.type !== t.v)) ? 0.35 : 1,
                            }}
                        >{t.l}</button>
                    );
                })}
            </div>

            {/* Scan Struk — hanya saat tambah baru, bukan transfer, ada API key */}
            {!editMode && !isTransfer && aiConfig?.apiKey && (
                <div style={{ marginBottom: 16 }}>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment"
                        style={{ display: "none" }} onChange={handleScanFile} />
                    <button
                        onClick={() => { setScanError(""); fileRef.current?.click(); }}
                        disabled={scanLoading}
                        style={{
                            width: "100%", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            border: "1px dashed var(--color-primary)", fontFamily: "inherit",
                            background: "rgba(5,150,105,.06)", color: "var(--color-primary)",
                            fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center",
                            justifyContent: "center", gap: 8, opacity: scanLoading ? 0.6 : 1,
                        }}
                    >
                        {scanLoading
                            ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Membaca struk...</>
                            : <>📷 Scan Struk / Nota</>
                        }
                    </button>
                    {scanError && (
                        <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.2)", borderRadius: 8, fontSize: 12, color: "var(--color-expense)" }}>
                            {scanError}
                        </div>
                    )}
                </div>
            )}

            {/* ── Hasil Scan Multi-Item ── */}
            {scanResults && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Header merchant */}
                    <div style={{ padding: "10px 14px", background: "rgba(5,150,105,.08)", border: "1px solid rgba(5,150,105,.2)", borderRadius: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>🧾 {scanResults.merchant || "Struk"}</div>
                        {scanResults.date && <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>📅 {scanResults.date}</div>}
                    </div>

                    {/* Pilih Akun */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>AKUN (semua item)</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {accounts.map(a => (
                                <button key={a.name} onClick={() => setScanAccount(a.name)}
                                    style={{
                                        padding: "7px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
                                        border: `1px solid ${scanAccount === a.name ? "rgba(5,150,105,.4)" : "var(--color-border-soft)"}`,
                                        background: scanAccount === a.name ? "rgba(5,150,105,.15)" : "transparent",
                                        color: scanAccount === a.name ? "var(--color-primary)" : "var(--color-muted)",
                                    }}>
                                    {a.icon} {a.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Header daftar item */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", letterSpacing: 0.5 }}>
                            ITEM ({scanItems.filter(i => i.selected).length}/{scanItems.length} dipilih) · ✏️ ketuk untuk edit
                        </span>
                        <button onClick={() => setScanItems(p => p.every(i => i.selected) ? p.map(i => ({...i, selected: false})) : p.map(i => ({...i, selected: true})))}
                            style={{ fontSize: 11, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>
                            {scanItems.every(i => i.selected) ? "Batal semua" : "Pilih semua"}
                        </button>
                    </div>

                    {/* Daftar item */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "45vH", overflowY: "auto" }}>
                        {scanItems.map((item, idx) => (
                            <div key={item.id} style={{
                                padding: "10px",
                                background: item.selected ? "var(--bg-surface-low)" : "transparent",
                                border: `1px solid ${item.selected ? "var(--color-border)" : "var(--color-border-soft)"}`,
                                borderRadius: 10, opacity: item.selected ? 1 : 0.45,
                            }}>
                                {/* Baris 1: checkbox + nama */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <input type="checkbox" checked={item.selected}
                                        onChange={e => setScanItems(p => p.map((it, i) => i === idx ? {...it, selected: e.target.checked} : it))}
                                        style={{ accentColor: "var(--color-primary)", cursor: "pointer", flexShrink: 0, width: 18, height: 18 }} />
                                    <input value={item.note}
                                        onChange={e => setScanItems(p => p.map((it, i) => i === idx ? {...it, note: e.target.value} : it))}
                                        style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--bg-app)", color: "var(--color-text)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none", minWidth: 0, boxSizing: "border-box" }} />
                                </div>
                                {/* Baris 2: kategori | jumlah — full width, no padding offset */}
                                <div style={{ display: "flex", gap: 6 }}>
                                    <select value={item.category}
                                        onChange={e => setScanItems(p => p.map((it, i) => i === idx ? {...it, category: e.target.value} : it))}
                                        style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: "1.5px solid var(--color-border)", background: "var(--bg-app)", color: "var(--color-muted)", fontFamily: "inherit", cursor: "pointer", outline: "none", fontSize: 11, minWidth: 0, boxSizing: "border-box" }}>
                                        {SCAN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input type="text" inputMode="numeric"
                                        value={Number(item.amount).toLocaleString("id-ID")}
                                        onChange={e => {
                                            const raw = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                                            setScanItems(p => p.map((it, i) => i === idx ? { ...it, amount: raw } : it));
                                        }}
                                        style={{ width: "35%", maxWidth: 120, textAlign: "right", padding: "7px 10px", borderRadius: 8, border: "1.5px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.05)", color: "var(--color-expense)", fontSize: 12, fontWeight: 700, fontFamily: "inherit", outline: "none", flexShrink: 0, boxSizing: "border-box" }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    {scanItems.filter(i => i.selected).length > 0 && (
                        <div style={{ padding: "10px 14px", background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.15)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Total {scanItems.filter(i => i.selected).length} item</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-expense)" }}>
                                {fmtRpLocal(scanItems.filter(i => i.selected).reduce((s, i) => s + i.amount, 0))}
                            </span>
                        </div>
                    )}

                    {/* Tombol aksi */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={resetScan}
                            style={{ flex: 1, padding: "13px 10px", borderRadius: 12, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            ← Kembali
                        </button>
                        <button onClick={handleSaveMultiple} disabled={isSaving || !scanItems.filter(i => i.selected).length || !scanAccount}
                            style={{ flex: 2, padding: "13px 10px", borderRadius: 12, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                opacity: (isSaving || !scanItems.filter(i => i.selected).length || !scanAccount) ? 0.5 : 1 }}>
                            {isSaving ? "Menyimpan..." : `✅ Simpan ${scanItems.filter(i => i.selected).length} Transaksi`}
                        </button>
                    </div>
                </div>
            )}

            {/* Form normal — sembunyikan jika scan results aktif */}
            {/* Transfer edit: only note editable */}
            {!scanResults && editMode && isTransfer ? (
                <>
                    <div style={{ background: "rgba(6,182,212,.06)", border: "1px solid rgba(6,182,212,.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6 }}>
                        ℹ️ Transfer hanya bisa diubah catatan &amp; tanggalnya. Untuk mengubah akun / jumlah, <strong style={{ color: "#ff716c" }}>hapus dan buat ulang</strong>.
                    </div>
                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block", letterSpacing: 0.5 }}>TANGGAL</label>
                        <input
                            type="date"
                            value={txForm.date || ""}
                            onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))}
                            onClick={e => e.target.showPicker?.()}
                            style={{
                                width: "100%", padding: "10px 14px", boxSizing: "border-box",
                                background: "var(--bg-surface-low)", border: "1px solid var(--color-border)",
                                borderRadius: 10, color: "var(--color-text)", fontSize: 13,
                                fontFamily: "inherit", outline: "none", cursor: "pointer",
                                colorScheme: "dark",
                            }}
                        />
                    </div>
                </>
            ) : !scanResults && isTransfer ? (
                /* ── Mode Transfer (tambah baru) ── */
                <>
                    <AmountInput label="JUMLAH (Rp)" icon="💰" placeholder="150.000" value={txForm.amount} onChange={v => setTxForm(p => ({ ...p, amount: v }))} />

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>DARI AKUN</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => {
                            const selected = txForm.account === a.name;
                            const isDestination = txForm.toAccount === a.name;
                            return (
                                <button key={a.name}
                                    onClick={() => !isDestination && setTxForm(p => ({ ...p, account: a.name }))}
                                    disabled={isDestination}
                                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${selected ? "#06b6d455" : "var(--color-border-soft)"}`, background: selected ? "rgba(6,182,212,.15)" : "transparent", color: selected ? "#06b6d4" : isDestination ? "#334155" : "#94a3b8", fontSize: 11, fontWeight: 600, cursor: isDestination ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isDestination ? 0.4 : 1 }}
                                >{a.icon} {a.name}</button>
                            );
                        })}
                    </div>

                    <div style={{ textAlign: "center", fontSize: 20, marginBottom: 16, color: "#06b6d4" }}>↓</div>

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>KE AKUN</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => {
                            const selected = txForm.toAccount === a.name;
                            const isSource = txForm.account === a.name;
                            return (
                                <button key={a.name}
                                    onClick={() => !isSource && setTxForm(p => ({ ...p, toAccount: a.name }))}
                                    disabled={isSource}
                                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${selected ? "#60fcc655" : "var(--color-border-soft)"}`, background: selected ? "rgba(96,252,198,.15)" : "transparent", color: selected ? "var(--color-primary)" : isSource ? "#334155" : "var(--color-muted)", fontSize: 11, fontWeight: 600, cursor: isSource ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isSource ? 0.4 : 1 }}
                                >{a.icon} {a.name}</button>
                            );
                        })}
                    </div>

                    {txForm.account && txForm.toAccount && txForm.amount && (
                        <div style={{ background: "rgba(6,182,212,.08)", border: "1px solid rgba(6,182,212,.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>DARI</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#ff716c" }}>{txForm.account}</div>
                                <div style={{ fontSize: 11, color: "#ff716c" }}>-Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                            <div style={{ fontSize: 20 }}>→</div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>KE</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>{txForm.toAccount}</div>
                                <div style={{ fontSize: 11, color: "var(--color-primary)" }}>+Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                        </div>
                    )}
                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                    {/* Date for transfer */}
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>📅 TANGGAL</label>
                    <DatePicker value={txForm.date} onChange={date => setTxForm(p => ({ ...p, date }))} />
                </>
            ) : !scanResults ? (
                /* ── Mode Normal (expense / income) ── */
                <>
                    <AmountInput label="JUMLAH (Rp)" icon="💰" placeholder="150.000" value={txForm.amount} onChange={v => setTxForm(p => ({ ...p, amount: v }))} />

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>{t("addTx.category") || "KATEGORI"}</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {(txForm.type === "expense" ? allExpense : allIncome).map(c => (
                            <button key={c} onClick={() => setTxForm(p => ({ ...p, category: c }))}
                                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${txForm.category === c ? "#60fcc655" : "var(--color-border-soft)"}`, background: txForm.category === c ? "rgba(96,252,198,.15)" : "transparent", color: txForm.category === c ? "var(--color-primary)" : "var(--color-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >{tCat(c)}</button>
                        ))}
                    </div>

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>AKUN SUMBER</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {accounts.map(a => (
                            <button key={a.name} onClick={() => setTxForm(p => ({ ...p, account: a.name }))}
                                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${txForm.account === a.name ? a.color + "55" : "var(--color-border-soft)"}`, background: txForm.account === a.name ? a.color + "15" : "transparent", color: txForm.account === a.name ? a.color : "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >{a.icon} {a.name}</button>
                        ))}
                    </div>

                    <InputField label="CATATAN" icon="📝" placeholder="Opsional" value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
                    {/* Date for normal mode */}
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block" }}>📅 TANGGAL</label>
                    <DatePicker value={txForm.date} onChange={date => setTxForm(p => ({ ...p, date }))} />
                </>
            ) : null}

            {!scanResults && <button onClick={handleSubmit} disabled={(!canSubmit && !editMode) || isSaving}
                style={{
                    width: "100%", padding: 13, borderRadius: 12, border: "none",
                    background: ((!canSubmit && !editMode) || isSaving)
                        ? "rgba(255,255,255,.07)"
                        : editMode
                            ? "linear-gradient(135deg,#60fcc6,#19ce9b)"
                            : isTransfer
                                ? "linear-gradient(135deg,#06b6d4,#0891b2)"
                                : "linear-gradient(135deg,#60fcc6,#19ce9b)",
                    color: ((!canSubmit && !editMode) || isSaving) ? "#94a3b8" : isTransfer ? "#fff" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13,
                    cursor: ((!canSubmit && !editMode) || isSaving) ? "not-allowed" : "pointer",
                    opacity: ((!canSubmit && !editMode) || isSaving) ? .5 : 1,
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "opacity .2s, background .2s",
                }}
            >
                {isSaving && (
                    <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                )}
                {submitLabel}
            </button>}
        </div>
    </Modal>
    );
};

export default AddTransactionModal;
