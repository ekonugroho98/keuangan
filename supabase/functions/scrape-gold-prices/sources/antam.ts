// ─── Antam (logammulia.com) price scraper ──────────────────────────────────
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.46-alpha/deno-dom-wasm.ts";
import type { GoldItem, GoldSource, GoldSourceResult } from "./types.ts";

const URL = "https://www.logammulia.com/id/harga-emas-hari-ini";

// ── Keyword mapping: text fragment → category key ──
const CATEGORY_KEYWORDS: Array<{ keys: string[]; cat: string }> = [
  { keys: ["gift series"],              cat: "gift_series"    },
  { keys: ["idul fitri"],               cat: "idul_fitri"     },
  { keys: ["imlek"],                    cat: "imlek"          },
  { keys: ["liontin", "batik"],         cat: "liontin_batik"  },
  { keys: ["batik"],                    cat: "batik"          },
  { keys: ["perak", "heritage"],        cat: "perak_heritage" },
  { keys: ["perak murni"],              cat: "perak_murni"    },
  { keys: ["emas batangan"],            cat: "emas_batangan"  },
];

// ── Human-readable category labels (untuk UI) ──
export const CATEGORY_LABELS: Record<string, string> = {
  emas_batangan:  "Emas Batangan",
  gift_series:    "Gift Series",
  idul_fitri:     "Idul Fitri",
  imlek:          "Imlek",
  batik:          "Batik",
  liontin_batik:  "Liontin Batik",
  perak_murni:    "Perak Murni",
  perak_heritage: "Perak Heritage",
};

// ── Helpers ──
function parseCurrency(str: string): number {
  const cleaned = str.replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function parseWeightGrams(weight: string): number {
  const match = weight.match(/([\d.,]+)\s*gr/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { keys, cat } of CATEGORY_KEYWORDS) {
    if (keys.every(k => lower.includes(k))) return cat;
  }
  return null;
}

// ── Main scraper ──
async function fetchAntamData(): Promise<GoldSourceResult> {
  const res = await fetch(URL, {
    headers: {
      "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      "Cache-Control":   "no-cache",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const html = await res.text();
  const doc  = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Gagal parse HTML dari logammulia.com");

  const categories: Record<string, GoldItem[]> = { emas_batangan: [] };
  let currentCat = "emas_batangan";

  const tables = doc.querySelectorAll("table");

  tables.forEach((table) => {
    const rows = table.querySelectorAll("tr");

    rows.forEach((row) => {
      const rowText = row.textContent?.trim() ?? "";
      const cells   = row.querySelectorAll("td");

      // Deteksi perubahan kategori
      const newCat = detectCategory(rowText);
      if (newCat) {
        currentCat = newCat;
        if (!categories[currentCat]) categories[currentCat] = [];
        return;
      }

      // Skip header rows
      if (
        rowText.toLowerCase().includes("harga dasar") ||
        rowText.toLowerCase().includes("berat") ||
        cells.length < 2
      ) return;

      const weight      = cells[0]?.textContent?.trim() ?? "";
      const buyRaw      = cells[1]?.textContent?.trim() ?? "";
      const sellRaw     = cells[2]?.textContent?.trim() ?? "";

      // Skip baris tanpa angka valid
      if (!weight.match(/\d/) || !buyRaw.match(/\d/)) return;

      const buyPrice   = parseCurrency(buyRaw);
      const weightGram = parseWeightGrams(weight);

      const item: GoldItem = {
        weight,
        weight_grams:   weightGram,
        buy_price:      buyPrice,
        sell_price:     sellRaw ? parseCurrency(sellRaw) : null,
        price_per_gram: weightGram > 0 ? Math.round(buyPrice / weightGram) : 0,
      };

      if (!categories[currentCat]) categories[currentCat] = [];
      categories[currentCat].push(item);
    });
  });

  return { categories, scraped_at: new Date().toISOString() };
}

// ─── Exported source object ────────────────────────────────────────────────
export const antam: GoldSource = {
  brand: "antam",
  name:  "Antam (Logam Mulia)",
  fetch: fetchAntamData,
};

// ── Nanti tambah brand lain dengan pola yang sama: ──
// export const pegadaian: GoldSource = { brand: "pegadaian", name: "Pegadaian", fetch: ... };
// export const ubs:       GoldSource = { brand: "ubs",       name: "UBS Gold",  fetch: ... };
