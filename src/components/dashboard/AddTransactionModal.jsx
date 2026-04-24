import { useRef, useState } from "react";
import Modal from "../ui/Modal";
import { expenseCategories, incomeCategories } from "../../constants/categories";
import { useLanguage } from "../../i18n/LanguageContext";

/* ── Scan Struk: kirim gambar ke AI, ekstrak semua item transaksi ── */
const SCAN_CATEGORIES = ["Makanan & Minuman","Transportasi","Belanja","Hiburan","Kesehatan","Pendidikan","Tagihan","Lainnya"];
const VISION_PROVIDERS = ["groq","openai","anthropic","google"];

/* ── Guess kategori dari nama item ── */
function guessCategory(note) {
    const n = note.toLowerCase();
    if (/mie|nasi|ayam|sapi|ikan|sayur|buah|minum|kopi|teh|susu|roti|snack|kerupuk|minyak|beras|gula|garam|tepung|saus|kecap|aqua|air putih|minuman|makanan|bumbu|santan|telur|daging|bakso|soto/.test(n)) return "Makanan & Minuman";
    if (/bensin|bbm|parkir|toll|tol|ojek|taxi|grab|gojek|bus|kereta|motor|mobil|transjakarta/.test(n)) return "Transportasi";
    if (/deterjen|sabun|sampo|pasta gigi|sikat|tisu|pembalut|popok|kebersihan|pel|sapu|pewangi/.test(n)) return "Belanja";
    if (/obat|vitamin|masker|apotek|klinik|dokter|rumah sakit|suplemen|kesehatan/.test(n)) return "Kesehatan";
    if (/listrik|air|gas|internet|pulsa|token|tagihan|pln|wifi|indihome/.test(n)) return "Tagihan";
    if (/buku|alat tulis|pendidikan|sekolah|kursus|les/.test(n)) return "Pendidikan";
    return "Belanja";
}

/* ── Parse teks OCR dengan regex (fallback tanpa AI) ── */
function parseOCRTextRegex(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 1);
    const skipRe = /total|subtotal|bayar|kembali|ppn|pajak|tax|diskon|discount|kembalian|tunai|cash|change|terima kasih|thank|invoice|struk|nota|no\.\s*\d|^jl\.|telp|phone|alamat|tanda terima|receipt|kasir|member|harga|tgl|tanggal|jam|waktu/i;
    const dateRe = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;

    function parsePrice(raw) {
        let s = raw.replace(/rp\.?\s*/i, "").trim();
        if (/^\d{1,3}(,\d{3})+$/.test(s)) return parseInt(s.replace(/,/g, ""));
        if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseInt(s.replace(/\./g, ""));
        if (/^\d{3,}$/.test(s)) return parseInt(s);
        return null;
    }

    const priceEndRe = /(?:rp\.?\s*)?((?:\d{1,3}(?:[.,]\d{3})+|\d{4,}))\s*$/i;

    const merchant = lines.find(l => l.length > 2 && !/^\d/.test(l) && !dateRe.test(l) && !skipRe.test(l)) || "Struk";

    let date = null;
    for (const line of lines) {
        const m = line.match(dateRe);
        if (m) {
            const [, d, mo, y] = m;
            const year = y.length === 2 ? "20" + y : y;
            date = `${year}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
            break;
        }
    }

    let subtotal = null;
    for (const line of lines) {
        if (/total|subtotal|bayar|grand total/i.test(line)) {
            const m = line.match(priceEndRe);
            if (m) { subtotal = parsePrice(m[1]); if (subtotal) break; }
        }
    }

    const items = [];

    for (const line of lines) {
        if (skipRe.test(line)) continue;
        const m = line.match(/^(.+?)\s{2,}((?:rp\.?\s*)?(?:\d{1,3}(?:[.,]\d{3})+|\d{4,}))\s*$/i);
        if (m) {
            const note = m[1].replace(/\s+/g, " ").trim();
            const amount = parsePrice(m[2]);
            if (note.length >= 2 && amount && amount > 0 && !skipRe.test(note))
                items.push({ note, amount, category: guessCategory(note) });
        }
    }

    if (items.length === 0) {
        for (const line of lines) {
            if (skipRe.test(line)) continue;
            const m = line.match(/^(.+?)[\t|]+\s*((?:rp\.?\s*)?(?:\d{1,3}(?:[.,]\d{3})+|\d{4,}))\s*$/i);
            if (m) {
                const note = m[1].replace(/\s+/g, " ").trim();
                const amount = parsePrice(m[2]);
                if (note.length >= 2 && amount && amount > 0 && !skipRe.test(note))
                    items.push({ note, amount, category: guessCategory(note) });
            }
        }
    }

    if (items.length === 0) {
        for (let i = 0; i < lines.length - 1; i++) {
            const nameLine = lines[i];
            const nextLine = lines[i + 1];
            if (skipRe.test(nameLine) || /^\d/.test(nameLine) || nameLine.length < 2) continue;
            const m = nextLine.match(priceEndRe);
            if (m) {
                const amount = parsePrice(m[1]);
                if (amount && amount > 0 && !skipRe.test(nameLine)) {
                    items.push({ note: nameLine.replace(/\s+/g, " ").trim(), amount, category: guessCategory(nameLine) });
                    i++;
                }
            }
        }
    }

    if (items.length === 0) {
        for (const line of lines) {
            if (skipRe.test(line)) continue;
            const m = line.match(priceEndRe);
            if (m) {
                const amount = parsePrice(m[1]);
                const priceStr = m[0].trim();
                const note = line.slice(0, line.length - priceStr.length).replace(/\s+/g, " ").trim();
                if (note.length >= 2 && amount && amount > 0 && !skipRe.test(note))
                    items.push({ note, amount, category: guessCategory(note) });
            }
        }
    }

    if (!items.length) throw new Error("Tidak ada item yang terdeteksi. Coba foto lebih jelas atau gunakan AI.");
    return { merchant, date, subtotal, items };
}

/* ── Kirim teks OCR ke AI untuk diparse (provider text-only) ── */
async function parseOCRTextWithAI(ocrText, aiConfig) {
    const { provider, apiKey } = aiConfig;
    const prompt = `Berikut teks struk/nota yang dibaca OCR. Ekstrak SEMUA item produk yang dibeli.
Kembalikan HANYA JSON (tanpa penjelasan lain):
{
  "merchant": "Nama Toko",
  "date": "YYYY-MM-DD atau null",
  "subtotal": 200000,
  "items": [
    { "note": "Nama Produk", "amount": 15000, "category": "Makanan & Minuman" }
  ]
}
Aturan: amount = harga total per item (qty×satuan), jangan sertakan baris Total/Subtotal/Diskon/Kembalian sebagai item.
category: "Makanan & Minuman","Transportasi","Belanja","Hiburan","Kesehatan","Pendidikan","Tagihan","Lainnya"
Jika bukan struk: {"error":"bukan struk"}

TEKS OCR:
${ocrText}`;

    let url, headers, body;
    const msgs = [{ role: "user", content: prompt }];

    if (provider === "groq" || provider === "openai") {
        url = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
        body = { model: provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini", max_tokens: 1000, messages: msgs };
    } else if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-allow-browser": "true" };
        body = { model: "claude-3-5-haiku-20241022", max_tokens: 1000, messages: msgs };
    } else if (provider === "google") {
        url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        body = { contents: [{ parts: [{ text: prompt }] }] };
    } else {
        const baseUrl = { mistral: "https://api.mistral.ai/v1", deepseek: "https://api.deepseek.com/v1", xai: "https://api.x.ai/v1" }[provider] || "https://api.openai.com/v1";
        const model = { mistral: "mistral-small-latest", deepseek: "deepseek-chat", xai: "grok-2-latest" }[provider] || "gpt-4o-mini";
        url = `${baseUrl}/chat/completions`;
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
        body = { model, max_tokens: 1000, messages: msgs };
    }

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Gagal parse dengan AI");

    let text = "";
    if (provider === "anthropic") text = data.content?.[0]?.text || "";
    else if (provider === "google") text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    else text = data.choices?.[0]?.message?.content || "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Format respons AI tidak valid");
    return JSON.parse(match[0]);
}

/* ── OCR: ambil teks lalu parse (AI jika ada, regex jika tidak) ── */
async function scanReceiptWithOCR(base64, mimeType, onProgress, aiConfig) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("ind+eng", 1, {
        logger: m => { if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100)); }
    });
    const blob = await fetch(`data:${mimeType};base64,${base64}`).then(r => r.blob());
    const { data: { text } } = await worker.recognize(blob);
    await worker.terminate();

    if (aiConfig?.apiKey && !aiConfig?.disabled) return await parseOCRTextWithAI(text, aiConfig);
    return parseOCRTextRegex(text);
}

async function scanReceiptWithAI(base64, mimeType, aiConfig) {
    const { provider, apiKey } = aiConfig || {};
    if (!apiKey) throw new Error("no-key");
    if (!VISION_PROVIDERS.includes(provider)) throw new Error("no-vision");

    const prompt = `Kamu adalah asisten keuangan Indonesia. Baca struk/nota/receipt ini dan ekstrak SEMUA item produk/layanan yang dibeli secara terpisah.
Kembalikan HANYA JSON (tanpa penjelasan lain) dengan format:
{
  "merchant": "Nama Toko",
  "date": "2026-04-06",
  "subtotal": 200000,
  "items": [
    { "note": "Nama Produk 1", "amount": 15000, "category": "Makanan & Minuman" },
    { "note": "Nama Produk 2", "amount": 8500, "category": "Belanja" }
  ]
}
Aturan penting:
- items: daftar SETIAP produk/item yang dibeli (bukan total/subtotal/pajak/kembalian)
- note: nama produk singkat dan jelas
- amount: harga total untuk item itu (qty × harga satuan), angka bulat tanpa titik/koma
- subtotal: total yang harus dibayar dari struk (Subtotal/Total/Bayar), angka bulat tanpa titik/koma, null jika tidak ada
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
const fmtAmount = (raw) => {
    if (raw === "" || raw === null || raw === undefined) return "";
    const n = parseInt(String(raw).replace(/\D/g, ""), 10);
    if (isNaN(n)) return "";
    return n.toLocaleString("id-ID");
};

/* ── DatePicker: 3 selects (day/month/year) — glassy ── */
const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const DatePicker = ({ value, onChange }) => {
    const [y, m, d] = (value || new Date().toISOString().slice(0,10)).split("-");
    const year = parseInt(y), month = parseInt(m), day = parseInt(d);
    const daysInMonth = new Date(year, month, 0).getDate();
    const years = Array.from({ length: 5 }, (_, i) => year - 2 + i);
    const sel = {
        padding: "12px 10px", borderRadius: 12,
        border: "1px solid var(--glass-border)",
        background: "rgba(255,255,255,.02)",
        color: "var(--color-text)",
        fontSize: 14, fontFamily: "inherit",
        outline: "none", cursor: "pointer",
        flex: 1, minHeight: 46, boxSizing: "border-box",
    };
    const set = (newY, newM, newD) => {
        const maxD = new Date(newY, newM, 0).getDate();
        const safeD = Math.min(newD, maxD);
        onChange(`${newY}-${String(newM).padStart(2,"0")}-${String(safeD).padStart(2,"0")}`);
    };
    return (
        <div style={{ display: "flex", gap: 8 }}>
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
    { v: "expense",  l: "Pengeluaran", c: "var(--color-expense)" },
    { v: "income",   l: "Pemasukan",   c: "var(--color-primary)" },
    { v: "transfer", l: "Transfer",    c: "var(--color-transfer)" },
];

/* Reusable field shell */
const FieldLabel = ({ children, hint }) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", letterSpacing: 0.8 }}>{children}</label>
        {hint && <span style={{ fontSize: 10, color: "var(--color-subtle)" }}>{hint}</span>}
    </div>
);

const glassInputStyle = {
    width: "100%", padding: "14px 16px", fontSize: 15,
    borderRadius: 14, border: "1px solid var(--glass-border)",
    background: "rgba(255,255,255,.02)",
    color: "var(--color-text)",
    fontFamily: "inherit", outline: "none",
    transition: "border-color .2s, background .2s, box-shadow .2s",
    minHeight: 46, boxSizing: "border-box",
};

const AddTransactionModal = ({
    open, onClose,
    txForm, setTxForm,
    onSubmit, onTransfer,
    accounts, customCategories = [],
    editMode = false, onUpdate,
    isSaving = false,
    aiConfig = null,
    onSubmitMultiple,
}) => {
    const { t } = useLanguage();
    const fileRef = useRef(null);
    const fileRefGallery = useRef(null);
    const [scanLoading, setScanLoading]   = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanMode, setScanMode]         = useState("");
    const [scanError, setScanError]       = useState("");
    const [scanResults, setScanResults]   = useState(null);
    const [scanItems, setScanItems]       = useState([]);
    const [scanAccount, setScanAccount]   = useState("");

    const resetScan = () => { setScanResults(null); setScanItems([]); setScanError(""); setScanProgress(0); setScanMode(""); };

    const handleScanFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setScanError("");
        setScanProgress(0);
        setScanLoading(true);

        const hasVision = !aiConfig?.disabled && aiConfig?.apiKey && VISION_PROVIDERS.includes(aiConfig?.provider);

        try {
            const base64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result.split(",")[1]);
                r.onerror = rej;
                r.readAsDataURL(file);
            });

            let result;
            if (hasVision) {
                setScanMode("ai");
                result = await scanReceiptWithAI(base64, file.type, aiConfig);
            } else {
                setScanMode("ocr");
                result = await scanReceiptWithOCR(base64, file.type, p => setScanProgress(p), aiConfig);
            }

            if (result.error) { setScanError("⚠️ " + result.error); return; }
            if (!result.items?.length) { setScanError("⚠️ Tidak ada item yang terdeteksi. Coba foto lebih jelas."); return; }
            setScanResults(result);
            setScanItems(result.items.map((item, i) => ({ ...item, id: i, selected: true })));
            setScanAccount(txForm.account || accounts[0]?.name || "");
        } catch (err) {
            if (err.message === "no-key" || err.message === "no-vision") {
                try {
                    setScanMode("ocr");
                    const base64 = await new Promise((res, rej) => {
                        const r = new FileReader();
                        r.onload = () => res(r.result.split(",")[1]);
                        r.onerror = rej;
                        r.readAsDataURL(file);
                    });
                    const result = await scanReceiptWithOCR(base64, file.type, p => setScanProgress(p), aiConfig);
                    if (!result.items?.length) { setScanError("⚠️ Tidak ada item yang terdeteksi. Coba foto lebih jelas."); return; }
                    setScanResults(result);
                    setScanItems(result.items.map((item, i) => ({ ...item, id: i, selected: true })));
                    setScanAccount(txForm.account || accounts[0]?.name || "");
                } catch (ocrErr) {
                    setScanError("❌ " + (ocrErr.message || "Gagal membaca struk"));
                }
            } else {
                setScanError("❌ " + (err.message || "Gagal membaca struk"));
            }
        } finally {
            setScanLoading(false);
            setScanProgress(0);
        }
    };

    const handleSaveMultiple = () => {
        const selected = scanItems.filter(i => i.selected);
        if (!selected.length) return;
        const zeroItems = selected.filter(i => !i.amount || i.amount <= 0);
        if (zeroItems.length) {
            setScanError(`❌ ${zeroItems.length} item memiliki jumlah Rp 0. Isi jumlahnya dulu.`);
            return;
        }
        setScanError("");
        onSubmitMultiple && onSubmitMultiple(selected, scanAccount, scanResults?.date);
        resetScan();
    };

    const DEFAULT_CATS = new Set([...expenseCategories, ...incomeCategories]);
    const tCat = (name) => { if (!DEFAULT_CATS.has(name)) return name; const k = "cat.name." + name; const v = t(k); return v === k ? name : v; };

    const extraExpense = customCategories.filter(c => c.type !== "income").map(c => c.name);
    const extraIncome  = customCategories.filter(c => c.type !== "expense").map(c => c.name);
    const allExpense = [...expenseCategories, ...extraExpense];
    const allIncome  = [...incomeCategories,  ...extraIncome];

    const isTransfer = txForm.type === "transfer";
    const activeType = TYPES.find(tt => tt.v === txForm.type) || TYPES[0];
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
            ? "Update Transaksi"
            : isTransfer ? "Pindahkan Antar Rekening" : "Simpan Transaksi";

    /* ── Chip-style picker for accounts & categories ── */
    const Chip = ({ active, color = "var(--color-primary)", onClick, disabled, children, style }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "9px 14px",
                borderRadius: 999,
                border: `1px solid ${active ? `color-mix(in srgb, ${color} 40%, transparent)` : "var(--glass-border)"}`,
                background: active
                    ? `color-mix(in srgb, ${color} 14%, transparent)`
                    : "rgba(255,255,255,.02)",
                color: active ? color : "var(--color-muted)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: disabled ? 0.35 : 1,
                minHeight: 36,
                boxShadow: active ? `inset 0 0 0 1px color-mix(in srgb, ${color} 22%, transparent)` : "none",
                transition: "all .18s",
                ...style,
            }}
        >
            {children}
        </button>
    );

    return (
    <Modal open={open} onClose={onClose}>
        {({ isDesktop }) => (
        <div style={{
            background: "var(--glass-hero)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            border: "1px solid var(--glass-border)",
            borderRadius: isDesktop ? 24 : "24px 24px 0 0",
            padding: isDesktop ? "28px 28px 32px" : "24px 20px calc(32px + env(safe-area-inset-bottom))",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "var(--glass-highlight), 0 20px 60px rgba(0,0,0,.35)",
            position: "relative",
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8 }}>
                            {editMode ? "EDIT" : "TRANSAKSI BARU"}
                        </div>
                        {editMode && (
                            <span className="chip chip-blue" style={{ fontSize: 9, letterSpacing: 0.5 }}>
                                ✏️ Edit mode
                            </span>
                        )}
                    </div>
                    <h3 style={{ fontSize: "clamp(20px, 2.6vw, 26px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>
                        {editMode ? "Edit Transaksi" : "Tambah Transaksi"}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4, margin: "4px 0 0" }}>
                        {editMode ? "Ubah detail transaksi di bawah" : "Catat pengeluaran, pemasukan, atau transfer"}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        width: 36, height: 36, borderRadius: 12,
                        background: "var(--color-border-soft)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--color-muted)", cursor: "pointer", fontSize: 16, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all .2s", fontFamily: "inherit",
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Type segmented control */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${TYPES.length}, 1fr)`,
                    gap: 6, padding: 4, marginBottom: 18,
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 14,
                }}
            >
                {TYPES.map(tt => {
                    const active = txForm.type === tt.v;
                    const disabled = (editMode && isTransfer && tt.v !== "transfer") || editMode;
                    return (
                        <button
                            key={tt.v}
                            onClick={() => !disabled && !editMode && setTxForm(p => ({ ...p, type: tt.v, toAccount: "" }))}
                            disabled={disabled}
                            style={{
                                padding: "10px 8px",
                                borderRadius: 10,
                                border: "none",
                                background: active ? `color-mix(in srgb, ${tt.c} 14%, transparent)` : "transparent",
                                color: active ? tt.c : "var(--color-muted)",
                                boxShadow: active ? `inset 0 0 0 1px color-mix(in srgb, ${tt.c} 25%, transparent)` : "none",
                                fontWeight: 700, fontSize: 13, cursor: disabled ? "default" : "pointer",
                                fontFamily: "inherit",
                                minHeight: 42, transition: "all .2s",
                                opacity: (disabled && !active) ? 0.35 : 1,
                            }}
                        >
                            {tt.l}
                        </button>
                    );
                })}
            </div>

            {/* Scan Struk CTA — selalu tampil saat tambah baru */}
            {!editMode && !isTransfer && !scanResults && (
                <div style={{ marginBottom: 18 }}>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment"
                        style={{ display: "none" }} onChange={handleScanFile} />
                    <input ref={fileRefGallery} type="file" accept="image/*"
                        style={{ display: "none" }} onChange={handleScanFile} />
                    {scanLoading ? (
                        <div
                            style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: 14,
                                border: "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
                                background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                                color: "var(--color-primary)",
                                fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                                minHeight: 48,
                            }}
                        >
                            <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                            {scanMode === "ocr"
                                ? <span>OCR {scanProgress > 0 ? `${scanProgress}%` : "memproses..."}</span>
                                : <span>AI sedang membaca struk...</span>}
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => { setScanError(""); fileRef.current?.click(); }}
                                className="chip chip-mint"
                                style={{
                                    flex: 1,
                                    padding: "12px 14px",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                    minHeight: 46,
                                    borderRadius: 14,
                                    fontFamily: "inherit",
                                }}
                            >
                                📷 Scan Kamera
                                {!aiConfig?.apiKey && <span style={{ fontSize: 10, opacity: 0.7 }}>· OCR</span>}
                            </button>
                            <button
                                onClick={() => { setScanError(""); fileRefGallery.current?.click(); }}
                                className="chip chip-mint"
                                style={{
                                    flex: 1,
                                    padding: "12px 14px",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                    minHeight: 46,
                                    borderRadius: 14,
                                    fontFamily: "inherit",
                                }}
                            >
                                🖼️ Galeri
                            </button>
                        </div>
                    )}
                    {!aiConfig?.apiKey && !scanLoading && (
                        <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--color-subtle)", textAlign: "center" }}>
                            Mode OCR · set API key di AI Coach untuk akurasi lebih tinggi
                        </div>
                    )}
                    {scanError && (
                        <div style={{
                            marginTop: 10, padding: "10px 14px",
                            background: "color-mix(in srgb, var(--color-expense) 8%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--color-expense) 25%, transparent)",
                            borderRadius: 12, fontSize: 12, color: "var(--color-expense)",
                        }}>
                            {scanError}
                        </div>
                    )}
                </div>
            )}

            {/* ── Hasil Scan Multi-Item ── */}
            {scanResults && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Merchant + date */}
                    <div style={{
                        padding: "14px 16px",
                        background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
                        borderRadius: 14,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-primary)" }}>🧾 {scanResults.merchant || "Struk"}</span>
                            <span style={{
                                fontSize: 9, fontWeight: 800,
                                padding: "3px 8px", borderRadius: 999,
                                background: scanMode === "ocr"
                                    ? (aiConfig?.apiKey ? "color-mix(in srgb, var(--color-purple) 18%, transparent)" : "color-mix(in srgb, var(--color-amber) 18%, transparent)")
                                    : "color-mix(in srgb, var(--color-primary) 18%, transparent)",
                                color: scanMode === "ocr"
                                    ? (aiConfig?.apiKey ? "var(--color-purple)" : "var(--color-amber)")
                                    : "var(--color-primary)",
                                letterSpacing: 0.8, textTransform: "uppercase",
                            }}>
                                {scanMode === "ocr" ? (aiConfig?.apiKey ? "OCR+AI" : "OCR") : "AI Vision"}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, color: "var(--color-muted)", flexShrink: 0, fontWeight: 700 }}>📅 Tanggal</span>
                            <input
                                type="date"
                                value={scanResults.date || ""}
                                onChange={e => setScanResults(p => ({ ...p, date: e.target.value }))}
                                onClick={e => e.target.showPicker?.()}
                                style={{
                                    flex: 1, padding: "8px 12px", borderRadius: 10,
                                    border: "1px solid var(--glass-border)",
                                    background: "rgba(255,255,255,.03)",
                                    color: "var(--color-text)", fontSize: 13,
                                    fontFamily: "inherit", outline: "none", cursor: "pointer",
                                    colorScheme: "dark", minHeight: 40, boxSizing: "border-box",
                                }}
                            />
                        </div>
                    </div>

                    {/* Akun selector */}
                    <div>
                        <FieldLabel>AKUN (berlaku ke semua item)</FieldLabel>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {accounts.map(a => (
                                <Chip
                                    key={a.name}
                                    active={scanAccount === a.name}
                                    color={a.color || "var(--color-primary)"}
                                    onClick={() => setScanAccount(a.name)}
                                >
                                    {a.icon} {a.name}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    {/* Item list header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", letterSpacing: 0.5 }}>
                            ITEM ({scanItems.filter(i => i.selected).length}/{scanItems.length}) · ketuk untuk edit
                        </span>
                        <button
                            onClick={() => setScanItems(p => p.every(i => i.selected) ? p.map(i => ({...i, selected: false})) : p.map(i => ({...i, selected: true})))}
                            className="link-btn"
                            style={{ fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                        >
                            {scanItems.every(i => i.selected) ? "Batal semua" : "Pilih semua"}
                        </button>
                    </div>

                    {/* Items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "42vh", overflowY: "auto", paddingRight: 4 }}>
                        {scanItems.map((item, idx) => (
                            <div key={item.id} style={{
                                padding: 12,
                                background: item.selected ? "rgba(255,255,255,.03)" : "transparent",
                                border: `1px solid ${item.selected ? "var(--glass-border)" : "var(--color-border-soft)"}`,
                                borderRadius: 14,
                                opacity: item.selected ? 1 : 0.45,
                                transition: "all .2s",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={item.selected}
                                        onChange={e => setScanItems(p => p.map((it, i) => i === idx ? {...it, selected: e.target.checked} : it))}
                                        style={{ accentColor: "var(--color-primary)", cursor: "pointer", flexShrink: 0, width: 18, height: 18 }}
                                    />
                                    <input
                                        value={item.note}
                                        onChange={e => setScanItems(p => p.map((it, i) => i === idx ? {...it, note: e.target.value} : it))}
                                        style={{
                                            flex: 1, minWidth: 0, padding: "9px 12px",
                                            borderRadius: 10, border: "1px solid var(--glass-border)",
                                            background: "rgba(255,255,255,.02)",
                                            color: "var(--color-text)", fontSize: 13, fontWeight: 600,
                                            fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                                        }}
                                    />
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <select
                                        value={item.category}
                                        onChange={e => setScanItems(p => p.map((it, i) => i === idx ? {...it, category: e.target.value} : it))}
                                        style={{
                                            flex: 1, padding: "9px 10px", borderRadius: 10,
                                            border: "1px solid var(--glass-border)",
                                            background: "rgba(255,255,255,.02)",
                                            color: "var(--color-muted)", fontFamily: "inherit",
                                            cursor: "pointer", outline: "none", fontSize: 12,
                                            minWidth: 0, boxSizing: "border-box",
                                        }}
                                    >
                                        {SCAN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input
                                        type="text" inputMode="numeric"
                                        value={Number(item.amount).toLocaleString("id-ID")}
                                        onChange={e => {
                                            const raw = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                                            setScanItems(p => p.map((it, i) => i === idx ? { ...it, amount: raw } : it));
                                        }}
                                        style={{
                                            width: "38%", maxWidth: 130, textAlign: "right",
                                            padding: "9px 12px", borderRadius: 10,
                                            border: "1px solid color-mix(in srgb, var(--color-expense) 30%, transparent)",
                                            background: "color-mix(in srgb, var(--color-expense) 6%, transparent)",
                                            color: "var(--color-expense)", fontSize: 13, fontWeight: 800,
                                            fontFamily: "inherit", outline: "none", flexShrink: 0,
                                            boxSizing: "border-box", fontVariantNumeric: "tabular-nums",
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total + validation */}
                    {(() => {
                        const selected = scanItems.filter(i => i.selected);
                        if (!selected.length) return null;
                        const totalSelected = selected.reduce((s, i) => s + i.amount, 0);
                        const subtotal = scanResults?.subtotal;
                        const mismatch = subtotal && Math.abs(totalSelected - subtotal) > 0;
                        const hasZero = selected.some(i => !i.amount || i.amount <= 0);
                        return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{
                                    padding: "12px 16px",
                                    background: "color-mix(in srgb, var(--color-expense) 8%, transparent)",
                                    border: `1px solid ${mismatch ? "color-mix(in srgb, var(--color-amber) 40%, transparent)" : "color-mix(in srgb, var(--color-expense) 20%, transparent)"}`,
                                    borderRadius: 12,
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                }}>
                                    <span style={{ fontSize: 12, color: "var(--color-muted)", fontWeight: 600 }}>Total {selected.length} item</span>
                                    <span className="num-tight" style={{ fontSize: 16, fontWeight: 800, color: "var(--color-expense)" }}>{fmtRpLocal(totalSelected)}</span>
                                </div>
                                {subtotal && (
                                    <div style={{
                                        padding: "10px 16px",
                                        background: mismatch ? "color-mix(in srgb, var(--color-amber) 10%, transparent)" : "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                                        border: `1px solid ${mismatch ? "color-mix(in srgb, var(--color-amber) 35%, transparent)" : "color-mix(in srgb, var(--color-primary) 25%, transparent)"}`,
                                        borderRadius: 12,
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                    }}>
                                        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{mismatch ? "⚠️" : "✅"} Subtotal di struk</span>
                                        <span className="num-tight" style={{ fontSize: 13, fontWeight: 800, color: mismatch ? "var(--color-amber)" : "var(--color-primary)" }}>{fmtRpLocal(subtotal)}</span>
                                    </div>
                                )}
                                {mismatch && (
                                    <div style={{ fontSize: 11, color: "var(--color-amber)", padding: "0 4px" }}>
                                        Selisih {fmtRpLocal(Math.abs(totalSelected - subtotal))} — mungkin ada item yang di-uncheck atau jumlah yang perlu dicek.
                                    </div>
                                )}
                                {hasZero && (
                                    <div style={{ fontSize: 11, color: "var(--color-expense)", padding: "0 4px" }}>
                                        ❌ Ada item dengan jumlah Rp 0, isi dulu sebelum simpan.
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <button
                            onClick={resetScan}
                            className="btn-secondary"
                            style={{ flex: 1, minHeight: 48, fontSize: 13 }}
                        >
                            ← Kembali
                        </button>
                        <button
                            onClick={handleSaveMultiple}
                            disabled={isSaving || !scanItems.filter(i => i.selected).length || !scanAccount}
                            className="btn-primary"
                            style={{
                                flex: 2, minHeight: 48, fontSize: 13,
                                opacity: (isSaving || !scanItems.filter(i => i.selected).length || !scanAccount) ? 0.5 : 1,
                                cursor: (isSaving || !scanItems.filter(i => i.selected).length || !scanAccount) ? "not-allowed" : "pointer",
                            }}
                        >
                            {isSaving ? "Menyimpan..." : `Simpan ${scanItems.filter(i => i.selected).length} Transaksi`}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Form (non-scan) ── */}
            {!scanResults && editMode && isTransfer && (
                <>
                    <div style={{
                        background: "color-mix(in srgb, var(--color-transfer) 8%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--color-transfer) 25%, transparent)",
                        borderRadius: 12, padding: "10px 14px", marginBottom: 16,
                        fontSize: 12, color: "var(--color-muted)", lineHeight: 1.55,
                    }}>
                        ℹ️ Transfer hanya bisa diubah catatan &amp; tanggalnya. Untuk mengubah akun / jumlah, <strong style={{ color: "var(--color-expense)" }}>hapus dan buat ulang</strong>.
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>CATATAN</FieldLabel>
                        <input
                            value={txForm.note}
                            onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))}
                            placeholder="Opsional"
                            style={glassInputStyle}
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>📅 TANGGAL</FieldLabel>
                        <input
                            type="date"
                            value={txForm.date || ""}
                            onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))}
                            onClick={e => e.target.showPicker?.()}
                            style={{ ...glassInputStyle, colorScheme: "dark", cursor: "pointer" }}
                        />
                    </div>
                </>
            )}

            {!scanResults && !editMode && isTransfer && (
                <>
                    {/* Amount hero */}
                    <div style={{ marginBottom: 18 }}>
                        <FieldLabel>JUMLAH TRANSFER</FieldLabel>
                        <div style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px 10px 10px", borderRadius: 16,
                            border: "1px solid var(--glass-border)",
                            background: "rgba(255,255,255,.02)",
                            minHeight: 64,
                        }}>
                            <span className="mono" style={{
                                padding: "8px 12px", borderRadius: 12,
                                background: "color-mix(in srgb, var(--color-transfer) 14%, transparent)",
                                color: "var(--color-transfer)", fontSize: 13, fontWeight: 800, letterSpacing: 0.5, flexShrink: 0,
                            }}>Rp</span>
                            <input
                                type="text" inputMode="numeric"
                                value={fmtAmount(txForm.amount)}
                                onChange={e => setTxForm(p => ({ ...p, amount: e.target.value.replace(/\D/g, "") }))}
                                placeholder="150.000"
                                style={{
                                    flex: 1, minWidth: 0, padding: 0,
                                    border: "none", background: "transparent",
                                    color: "var(--color-text)", fontSize: 24, fontWeight: 800,
                                    fontFamily: "inherit", outline: "none",
                                    fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        <FieldLabel>DARI AKUN</FieldLabel>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {accounts.map(a => {
                                const selected = txForm.account === a.name;
                                const isDestination = txForm.toAccount === a.name;
                                return (
                                    <Chip
                                        key={a.name}
                                        active={selected}
                                        disabled={isDestination}
                                        color={a.color || "var(--color-transfer)"}
                                        onClick={() => !isDestination && setTxForm(p => ({ ...p, account: a.name }))}
                                    >
                                        {a.icon} {a.name}
                                    </Chip>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ textAlign: "center", fontSize: 18, margin: "10px 0", color: "var(--color-transfer)" }}>↓</div>

                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>KE AKUN</FieldLabel>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {accounts.map(a => {
                                const selected = txForm.toAccount === a.name;
                                const isSource = txForm.account === a.name;
                                return (
                                    <Chip
                                        key={a.name}
                                        active={selected}
                                        disabled={isSource}
                                        color={a.color || "var(--color-primary)"}
                                        onClick={() => !isSource && setTxForm(p => ({ ...p, toAccount: a.name }))}
                                    >
                                        {a.icon} {a.name}
                                    </Chip>
                                );
                            })}
                        </div>
                    </div>

                    {txForm.account && txForm.toAccount && txForm.amount && (
                        <div style={{
                            background: "color-mix(in srgb, var(--color-transfer) 8%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--color-transfer) 22%, transparent)",
                            borderRadius: 14, padding: "14px 16px", marginBottom: 16,
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                        }}>
                            <div style={{ textAlign: "center", minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 2, letterSpacing: 0.8, fontWeight: 700 }}>DARI</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-expense)" }}>{txForm.account}</div>
                                <div className="num-tight" style={{ fontSize: 11, color: "var(--color-expense)" }}>−Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                            <div style={{ fontSize: 18, color: "var(--color-transfer)" }}>→</div>
                            <div style={{ textAlign: "center", minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 2, letterSpacing: 0.8, fontWeight: 700 }}>KE</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-primary)" }}>{txForm.toAccount}</div>
                                <div className="num-tight" style={{ fontSize: 11, color: "var(--color-primary)" }}>+Rp {parseInt(txForm.amount || 0).toLocaleString("id-ID")}</div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>CATATAN</FieldLabel>
                        <input
                            value={txForm.note}
                            onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))}
                            placeholder="Opsional"
                            style={glassInputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>📅 TANGGAL</FieldLabel>
                        <DatePicker value={txForm.date} onChange={date => setTxForm(p => ({ ...p, date }))} />
                    </div>
                </>
            )}

            {!scanResults && !isTransfer && (
                <>
                    {/* Amount hero */}
                    <div style={{ marginBottom: 18 }}>
                        <FieldLabel>JUMLAH</FieldLabel>
                        <div style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 12px 12px 10px", borderRadius: 16,
                            border: `1px solid color-mix(in srgb, ${activeType.c} 25%, var(--glass-border))`,
                            background: `linear-gradient(135deg, color-mix(in srgb, ${activeType.c} 6%, transparent), rgba(255,255,255,.02))`,
                            minHeight: 72,
                            transition: "all .2s",
                        }}>
                            <span className="mono" style={{
                                padding: "10px 14px", borderRadius: 12,
                                background: `color-mix(in srgb, ${activeType.c} 16%, transparent)`,
                                color: activeType.c, fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
                                flexShrink: 0, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${activeType.c} 25%, transparent)`,
                            }}>Rp</span>
                            <input
                                type="text" inputMode="numeric"
                                value={fmtAmount(txForm.amount)}
                                onChange={e => setTxForm(p => ({ ...p, amount: e.target.value.replace(/\D/g, "") }))}
                                placeholder="150.000"
                                style={{
                                    flex: 1, minWidth: 0, padding: 0,
                                    border: "none", background: "transparent",
                                    color: "var(--color-text)",
                                    fontSize: "clamp(24px, 4.5vw, 32px)", fontWeight: 800,
                                    fontFamily: "inherit", outline: "none",
                                    fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em",
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>{t("addTx.category") || "KATEGORI"}</FieldLabel>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(txForm.type === "expense" ? allExpense : allIncome).map(c => (
                                <Chip
                                    key={c}
                                    active={txForm.category === c}
                                    color={activeType.c}
                                    onClick={() => setTxForm(p => ({ ...p, category: c }))}
                                >
                                    {tCat(c)}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>AKUN SUMBER</FieldLabel>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {accounts.map(a => (
                                <Chip
                                    key={a.name}
                                    active={txForm.account === a.name}
                                    color={a.color || "var(--color-primary)"}
                                    onClick={() => setTxForm(p => ({ ...p, account: a.name }))}
                                >
                                    {a.icon} {a.name}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>CATATAN</FieldLabel>
                        <input
                            value={txForm.note}
                            onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))}
                            placeholder="Opsional"
                            style={glassInputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <FieldLabel>📅 TANGGAL</FieldLabel>
                        <DatePicker value={txForm.date} onChange={date => setTxForm(p => ({ ...p, date }))} />
                    </div>
                </>
            )}

            {!scanResults && (
                <button
                    onClick={handleSubmit}
                    disabled={(!canSubmit && !editMode) || isSaving}
                    className="btn-primary"
                    style={{
                        width: "100%",
                        minHeight: 48,
                        fontSize: 15,
                        marginTop: 8,
                        opacity: ((!canSubmit && !editMode) || isSaving) ? 0.5 : 1,
                        cursor: ((!canSubmit && !editMode) || isSaving) ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        ...(isTransfer && !editMode
                            ? { background: "linear-gradient(135deg, var(--color-transfer), color-mix(in srgb, var(--color-transfer) 70%, #000))", color: "#fff" }
                            : {}),
                    }}
                >
                    {isSaving && (
                        <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                    )}
                    {submitLabel}
                </button>
            )}
        </div>
        )}
    </Modal>
    );
};

export default AddTransactionModal;
