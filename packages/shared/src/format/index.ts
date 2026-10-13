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
// Format kanonik: "[Nama Toko] Nama item [ref: NOMOR]". Dipakai ingest_receipt (Hermes) dan modal
// scan web supaya note konsisten, mudah dibaca ("[Indomaret] Indomie Goreng"), dan bisa diurai
// balik: nama toko untuk perbandingan harga antar toko, `[ref: …]` untuk rekonsiliasi bank (F-C).
export function formatReceiptNote(name: string, merchant?: string | null, refNo?: string | null): string {
  const m = merchant?.trim()
  const r = refNo?.trim()
  return `${m ? `[${m}] ` : ''}${name.trim()}${r ? ` [ref: ${r}]` : ''}`
}

export interface ParsedReceiptNote {
  merchant?: string
  name: string
  refNo?: string
}

/** Kebalikan formatReceiptNote. Juga mengerti format lama "Nama — Toko [ref: X]" (struk sebelum 2026-10-13). */
export function parseReceiptNote(note: string): ParsedReceiptNote {
  let rest = note.trim()
  const out: ParsedReceiptNote = { name: rest }
  const ref = rest.match(/\s*\[ref:\s*([^\]]*)\]\s*$/i)
  if (ref) {
    out.refNo = ref[1]!.trim()
    rest = rest.slice(0, ref.index).trim()
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
  out.name = rest
  return out
}
