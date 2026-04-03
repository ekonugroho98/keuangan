// ─── Gold Price Service ────────────────────────────────────────────────────
// Mengambil harga emas dari Karaya API (Vercel BE)

const API_BASE = "https://karaya-api-jec2.vercel.app/api/gold";

// ── Label kategori untuk UI ──
export const CATEGORY_LABELS = {
  emas_batangan:  "Emas Batangan",
  emas_batik:     "Batik",
  emas_imlek:     "Imlek",
  emas_idul_fitri:"Idul Fitri",
  emas_gift_series:"Gift Series",
  liontin_batik:  "Liontin Batik",
  perak_murni:    "Perak Murni",
  perak_heritage: "Perak Heritage",
};

// ── Urutan tampilan kategori ──
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
function parseGrams(berat) {
  const match = String(berat).match(/([\d.,]+)\s*gr/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

// ── Normalisasi item dari API → format internal ──
function normalizeItems(rawItems = []) {
  return rawItems
    .filter(item => item.berat && item.harga_dasar > 0)
    .map(item => {
      const grams = parseGrams(item.berat);
      return {
        weight:        item.berat,
        weight_grams:  grams,
        buy_price:     item.harga_dasar,
        sell_price:    item.harga_pajak || null,
        price_per_gram: grams > 0 ? Math.round(item.harga_dasar / grams) : 0,
      };
    });
}

// ── Fetch harga satu brand ──
export async function fetchGoldPrices(brand = "antam") {
  const res = await fetch(`${API_BASE}/${brand}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const json = await res.json();
  const rawData = json.data || {};

  // Konversi semua kategori
  const categories = {};
  for (const cat of CATEGORY_ORDER) {
    const items = normalizeItems(rawData[cat]);
    if (items.length > 0) categories[cat] = items;
  }

  return {
    brand:      json.brand || brand,
    tanggal:    json.tanggal || rawData.tanggal || "",
    scraped_at: json.scraped_at || rawData.updated_at || null,
    source:     rawData.source || "",
    categories, // { emas_batangan: [...], emas_batik: [...], ... }
  };
}
