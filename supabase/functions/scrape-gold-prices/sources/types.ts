// ─── Shared types for all gold price sources ───────────────────────────────

export interface GoldItem {
  weight: string;        // "1 gr", "2 gr", "500 gr"
  weight_grams: number;  // parsed: 1, 2, 500
  buy_price: number;     // harga dasar (Rp)
  sell_price: number | null; // harga dengan pajak (Rp), null jika tidak ada
  price_per_gram: number;    // buy_price / weight_grams
}

export interface GoldSourceResult {
  categories: Record<string, GoldItem[]>; // key = "emas_batangan", "gift_series", dll
  scraped_at: string;
}

export interface GoldSource {
  brand: string;
  name: string;
  fetch(): Promise<GoldSourceResult>;
}
