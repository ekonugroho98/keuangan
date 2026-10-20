// Formatter uang & tanggal + parser nominal bahasa manusia (05-api.md §2.7).
// Dipakai apps/web (tampilan) dan apps/api (validasi amount_text dari agent).

/** Format BIGINT rupiah jadi "Rp 45.000". */
export function fmtRp(n: number | bigint): string {
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

/** Format tanggal jadi "04 Okt 2026" (locale id). Input: Date | string parseable Date. */
export function fmtDate(d: string | number | Date): string {
  const dt = new Date(d)
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Tanggal lokal "YYYY-MM-DD" tanpa bug pergeseran UTC (dibanding toISOString().slice(0,10)). */
export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export class AmountParseError extends Error {
  readonly code = 'invalid_amount_text' as const
  readonly input: unknown
  constructor(input: unknown) {
    super(`Tidak bisa membaca nominal: ${JSON.stringify(input)}`)
    this.name = 'AmountParseError'
    this.input = input
  }
}

const MULTIPLIER_RE = /^([\d.,]+)\s*(juta|jt|ribu|rb|k)$/

/**
 * Parse nominal bahasa manusia Indonesia menjadi integer rupiah.
 * Mendukung: "45rb", "45 rb", "45k", "45.000", "45000", "1,2 juta", "1.2jt", "2 juta", "500 ribu".
 * Koma dan titik SEBELUM sufiks (juta/jt/ribu/rb/k) diperlakukan sebagai desimal.
 * Titik TANPA sufiks diperlakukan sebagai pemisah ribuan (format Indonesia umum: "45.000").
 * "M"/"miliar" belum didukung di v1 (Q-15) — tulis angka penuh untuk nominal besar.
 */
export function parseAmountId(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new AmountParseError(input)
    return Math.round(input)
  }

  const raw = input.trim().toLowerCase().replace(/^rp\.?\s*/, '')
  if (raw === '') throw new AmountParseError(input)

  const multiplierMatch = raw.match(MULTIPLIER_RE)
  if (multiplierMatch) {
    const numPart = multiplierMatch[1]!.replace(',', '.')
    const unit = multiplierMatch[2]!
    const value = Number.parseFloat(numPart)
    if (Number.isNaN(value)) throw new AmountParseError(input)
    const multiplier = unit === 'juta' || unit === 'jt' ? 1_000_000 : 1_000
    return Math.round(value * multiplier)
  }

  // Tanpa sufiks: buang titik (pemisah ribuan) dan bagian desimal setelah koma (rupiah tanpa sen).
  const plain = raw.replace(/\./g, '').replace(/,\d+$/, '').replace(/[^\d]/g, '')
  if (plain === '') throw new AmountParseError(input)
  return Number.parseInt(plain, 10)
}

// ── Note transaksi dari struk ───────────────────────────────────────────────────────────────
// Format kanonik: "[Nama Toko] Nama item x2 [ref: NOMOR]". Dipakai ingest_receipt (Hermes) dan modal
// scan web supaya note konsisten, mudah dibaca ("[Indomaret] Indomie Goreng x2"), dan bisa diurai
// balik: nama toko untuk perbandingan harga antar toko, `x2` untuk jumlah kemasan (qty),
// dan `[ref: …]` untuk rekonsiliasi bank (F-C).
export function formatReceiptNote(
  name: string,
  merchant?: string | null,
  refNo?: string | null,
  qty?: number | null,
): string {
  const m = merchant?.trim()
  const r = refNo?.trim()
  let cleanName = name.trim()
  const q = qty != null && Number.isFinite(Number(qty)) && Number(qty) > 1 ? Number(qty) : null
  if (q && !/(?:^|\s)(?:x\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*x|\(\d+(?:[.,]\d+)?\s*x[^)]*\))(?:\s|$|\))/i.test(cleanName)) {
    const titipanSuffix = cleanName.match(/(\s*\(titipan [^)]*\)\s*)$/i)
    if (titipanSuffix && titipanSuffix.index != null) {
      cleanName = `${cleanName.slice(0, titipanSuffix.index).trim()} x${q}${titipanSuffix[1]}`
    } else {
      cleanName = `${cleanName} x${q}`
    }
  }
  return `${m ? `[${m}] ` : ''}${cleanName}${r ? ` [ref: ${r}]` : ''}`
}

export interface ParsedReceiptNote {
  merchant?: string
  name: string
  refNo?: string
  qty?: number
}

/** Kebalikan formatReceiptNote. Juga mengerti format lama "Nama — Toko [ref: X]" (struk sebelum 2026-10-13) serta kelipatan "x2" / "(2x)". */
export function parseReceiptNote(note: string): ParsedReceiptNote {
  let rest = note.trim()
  const out: ParsedReceiptNote = { name: rest }
  const ref = rest.match(/\s*\[ref:\s*([^\]]*)\]\s*$/i)
  if (ref) {
    out.refNo = ref[1]!.trim()
    rest = rest.slice(0, ref.index).trim()
  }
  // Abaikan label kategori/aktivitas umum seperti [KANTOR], [PRIBADI], [DINAS], [REIMBURSE] agar tidak dianggap nama toko/merchant di product_prices
  const nonMerchantTagRe = /^\[(?:kantor|pribadi|dinas|reimburse|klaim|rumah|kerja|lembur|titipan|rutin|project|proyek|bisnis|meeting|acara|liburan|mudik|operasional|ops)(?:\s+[^\]]*)?\]\s*/i
  while (nonMerchantTagRe.test(rest)) {
    rest = rest.replace(nonMerchantTagRe, '').trim()
  }
  const lead = rest.match(/^\[([^\]]+)\]\s*/)
  if (lead) {
    out.merchant = lead[1]!.trim()
    rest = rest.slice(lead[0].length).trim()
  } else {
    const legacy = rest.lastIndexOf(' — ')
    if (legacy > 0) {
      out.merchant = rest.slice(legacy + 3).trim()
      rest = rest.slice(0, legacy).trim()
    }
  }
  // Ekstrak kelipatan di akhir nama item ("GRANDCO MG REF 1LT x2", "Indomie 2x", "Minyak (2x @Rp20.190)")
  const qtyMatch = rest.match(
    /^(.*?)\s+(?:x\s*(\d+(?:[.,]\d+)?)|\((\d+(?:[.,]\d+)?)\s*x(?:\s*@[^)]*)?\)|(\d+(?:[.,]\d+)?)\s*x)(\s*\(titipan [^)]*\))?\s*$/i,
  )
  if (qtyMatch) {
    const rawQ = (qtyMatch[2] || qtyMatch[3] || qtyMatch[4] || '').replace(',', '.')
    const parsedQ = Number.parseFloat(rawQ)
    if (Number.isFinite(parsedQ) && parsedQ > 1 && qtyMatch[1]?.trim()) {
      out.qty = parsedQ
      rest = `${qtyMatch[1].trim()}${qtyMatch[5] || ''}`
    }
  }
  out.name = rest
  return out
}
