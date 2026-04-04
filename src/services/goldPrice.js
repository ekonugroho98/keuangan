// ─── Gold Price Service ────────────────────────────────────────────────────
// Mengambil harga emas dari Karaya API (Vercel BE)

const API_BASE = "https://karaya-api-jec2.vercel.app/api/gold";

// ── Label kategori Antam untuk UI ──
export const CATEGORY_LABELS = {
  emas_batangan:   "Emas Batangan",
  emas_batik:      "Batik",
  emas_imlek:      "Imlek",
  emas_idul_fitri: "Idul Fitri",
  emas_gift_series:"Gift Series",
  liontin_batik:   "Liontin Batik",
  perak_murni:     "Perak Murni",
  perak_heritage:  "Perak Heritage",
};

export const CATEGORY_ORDER = [
  "emas_batangan",
  "emas_gift_series",
  "emas_batik",
  "emas_idul_fitri",
  "emas_imlek",
  "liontin_batik",
  "perak_murni",
  "perak_heritage",
];

// ── Parse berat string → angka gram ──
export function parseGrams(berat) {
  const match = String(berat).match(/([\d.,]+)\s*gr/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

// ── Normalisasi item dari API → format internal ──
// Semua brand kini pakai harga_jual + harga_buyback (sudah dinormalisasi di BE)
// Fallback ke 'harga' untuk data lama yang belum dinormalisasi
function normalizeItem(item) {
  const grams = parseGrams(item.berat || item.weight || "");
  // Antam API returns harga_dasar; other brands return harga_jual or harga
  const hargaJual = item.harga_jual ?? item.harga_dasar ?? item.harga ?? 0;
  return {
    weight:         item.berat || item.weight || "",
    weight_grams:   grams,
    buy_price:      hargaJual,
    buyback_price:  item.harga_buyback ?? null,
    sell_price:     item.harga_pajak   ?? null,   // Antam: harga + pajak
    price_per_gram: grams > 0 ? Math.round(hargaJual / grams) : 0,
  };
}

function normalizeItems(rawItems = []) {
  return rawItems
    .filter(item => (item.berat || item.weight) && (item.harga_jual ?? item.harga_dasar ?? item.harga ?? 0) > 0)
    .map(normalizeItem);
}

// ── Fetch harga satu brand ──
export async function fetchGoldPrices(brand = "antam") {
  const res = await fetch(`${API_BASE}/${brand}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const json = await res.json();
  const rawData = json.data || {};

  if (brand === "antam") {
    // Antam: multi-kategori
    const categories = {};
    for (const cat of CATEGORY_ORDER) {
      const items = normalizeItems(rawData[cat]);
      if (items.length > 0) categories[cat] = items;
    }
    return {
      brand:      "antam",
      tanggal:    json.tanggal || rawData.tanggal || "",
      scraped_at: json.scraped_at || rawData.updated_at || null,
      source:     rawData.source || "",
      categories,
    };
  }

  // UBS, Lotus, Galeri24: semua pakai emas_batangan
  const categories = {
    emas_batangan: normalizeItems(rawData.emas_batangan),
  };

  // Lotus juga punya paper_gold
  if (rawData.paper_gold?.length) {
    categories.paper_gold = normalizeItems(rawData.paper_gold);
  }

  return {
    brand:      json.brand || brand,
    tanggal:    json.tanggal || rawData.tanggal || "",
    scraped_at: json.scraped_at || rawData.updated_at || null,
    source:     rawData.source || "",
    harga_per_gram: rawData.harga_per_gram ?? null,   // Lotus
    buyback_emas:   rawData.buyback_emas   ?? null,   // Lotus
    categories,
  };
}

// ── Ambil harga per gram dari brand tertentu (untuk emas "Lainnya") ──
// Pakai Antam 1gr sebagai referensi universal
export function getHargaPerGram(goldPrices) {
  if (!goldPrices?.categories) return 0;
  const batangan = goldPrices.categories["emas_batangan"] || [];
  const item1gr = batangan.find(i => Math.abs(i.weight_grams - 1) < 0.01);
  if (item1gr) return item1gr.price_per_gram || item1gr.buy_price;
  // Fallback: dari item terkecil yang ada
  if (batangan.length > 0) return batangan[0].price_per_gram || 0;
  return 0;
}

// ── Cari harga beli untuk gram tertentu dari data brand ──
export function lookupPrice(goldPrices, brand, quantityGrams) {
  if (!goldPrices?.categories || !quantityGrams || quantityGrams <= 0) return null;

  const batangan = goldPrices.categories["emas_batangan"] || [];
  if (batangan.length === 0) return null;

  // Exact match
  const exact = batangan.find(i => Math.abs(i.weight_grams - quantityGrams) < 0.01);
  if (exact) return exact.buy_price;

  // Interpolate: price_per_gram × quantity
  const sorted = [...batangan].sort((a, b) =>
    Math.abs(a.weight_grams - quantityGrams) - Math.abs(b.weight_grams - quantityGrams)
  );
  const closest = sorted[0];
  if (closest?.price_per_gram > 0) return Math.round(closest.price_per_gram * quantityGrams);
  return null;
}
