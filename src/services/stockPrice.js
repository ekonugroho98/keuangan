const API_BASE = "https://karaya-api-jec2.vercel.app/api/stock";

/**
 * Fetch harga live saham IDX dari karaya-api (proxy Yahoo Finance)
 * @param {string} ticker - Kode saham IDX, contoh: "BBCA", "TLKM", "GOTO"
 * @returns {Promise<{ ticker, symbol, price, currency, change, change_pct, market_state, exchange, timestamp, source }>}
 */
export async function fetchStockPrice(ticker) {
  const res = await fetch(`${API_BASE}/${ticker.toUpperCase()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Stock API error ${res.status} for ${ticker}`);
  return await res.json();
}

/**
 * Hitung nilai total investasi saham berdasarkan harga live
 * Rumus: harga_per_saham × jumlah_lot × 100  (1 lot IDX = 100 saham)
 * @param {number} pricePerShare - Harga per saham (IDR)
 * @param {number} quantityLot   - Jumlah lot yang dimiliki
 * @returns {number} - Total nilai investasi (IDR)
 */
export function calcStockValue(pricePerShare, quantityLot) {
  return Math.round(pricePerShare * quantityLot * 100);
}

/**
 * Format perubahan harga dengan tanda + / -
 * @param {number} changePct
 * @returns {string} e.g. "+1.23%" or "-0.45%"
 */
export function formatChangePct(changePct) {
  if (changePct === null || changePct === undefined) return "";
  const sign = changePct >= 0 ? "+" : "";
  return `${sign}${changePct.toFixed(2)}%`;
}
