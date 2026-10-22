import { createHash } from 'node:crypto'
import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { assertScope } from '../auth/middleware'
import { withActor } from '../db/tx'

type SqlTx = postgres.TransactionSql
import { VISION_PROVIDERS, buildVisionRequest, callProviderJson, getAiConfig } from './ai/provider'
import { requireFeature } from './features'
import { resolveAccountRef, resolveBeneficiaryRef, resolveCategoryRef } from './resolver'
import { createTransaction } from './transactions'

export type StatementSource = 'bca_csv' | 'bri_csv' | 'mandiri_csv' | 'gopay_csv' | 'vision' | 'manual'
export type StatementMatchStatus = 'unmatched' | 'suggested' | 'matched' | 'created' | 'ignored'

export interface ParsedStatementLine {
  date: string // YYYY-MM-DD
  amount: number
  direction: 'in' | 'out'
  description: string
  ref_no?: string | null
  balance_after?: number | null
}

function normDesc(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function computeFingerprint(
  accountId: string,
  line: ParsedStatementLine,
  seq: number,
): string {
  const payload = [
    accountId,
    line.date,
    String(Math.round(line.amount)),
    line.direction,
    (line.ref_no ?? '').trim().toLowerCase(),
    normDesc(line.description),
    String(seq),
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

/** Parse nominal uang dari format Indonesia ("150.000,00") maupun internasional ("150,000.00"). */
export function parseMoneyCell(raw: string): { amount: number; sign: 'in' | 'out' | null } {
  if (!raw) return { amount: 0, sign: null }
  const upper = raw.toUpperCase().trim()
  let sign: 'in' | 'out' | null = null
  if (/\bDB\b|\bDEBET\b|\bDEBIT\b|\bKELUAR\b|\bOUT\b/.test(upper) || upper.startsWith('-') || (upper.startsWith('(') && upper.endsWith(')'))) {
    sign = 'out'
  } else if (/\bCR\b|\bKREDIT\b|\bCREDIT\b|\bMASUK\b|\bIN\b/.test(upper) || upper.startsWith('+')) {
    sign = 'in'
  }

  let cleaned = upper
    .replace(/IDR|RP/g, '')
    .replace(/\b(DB|CR|DEBET|DEBIT|KREDIT|CREDIT|MASUK|KELUAR|IN|OUT|D|K)\b/g, '')
    .replace(/[()+-]/g, '')
    .trim()

  if (!cleaned) return { amount: 0, sign }

  // Deteksi desimal di akhir (.00 atau ,00)
  if (/,\d{1,2}$/.test(cleaned) && cleaned.includes('.')) {
    // Format Indonesia: 1.250.000,00
    cleaned = cleaned.replace(/\./g, '').replace(/,\d{1,2}$/, '')
  } else if (/\.\d{1,2}$/.test(cleaned) && cleaned.includes(',')) {
    // Format Inggris/BCA: 1,250,000.00
    cleaned = cleaned.replace(/,/g, '').replace(/\.\d{1,2}$/, '')
  } else if (/,\d{2}$/.test(cleaned) && !cleaned.includes('.')) {
    cleaned = cleaned.replace(/,\d{2}$/, '')
  } else if (/\.\d{2}$/.test(cleaned) && !cleaned.includes(',')) {
    cleaned = cleaned.replace(/\.\d{2}$/, '')
  } else {
    cleaned = cleaned.replace(/[.,\s]/g, '')
  }

  const num = Number(cleaned.replace(/[^0-9]/g, ''))
  return { amount: Number.isFinite(num) ? Math.round(num) : 0, sign }
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', januari: '01', january: '01',
  feb: '02', februari: '02', february: '02',
  mar: '03', maret: '03', march: '03',
  apr: '04', april: '04',
  mei: '05', may: '05',
  jun: '06', juni: '06', june: '06',
  jul: '07', juli: '07', july: '07',
  agu: '08', agustus: '08', aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  okt: '10', oktober: '10', oct: '10', october: '10',
  nov: '11', november: '11',
  des: '12', desember: '12', dec: '12', december: '12',
}

export function parseDateCell(raw: string, fallbackYear: number): string | null {
  const s = raw.trim().replace(/^["']|["']$/g, '')
  if (!s || /^pend/i.test(s)) {
    // BCA kadang menulis "PEND" untuk transaksi hari berjalan yang belum settle tanggal buku
    return null
  }
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) {
    return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`
  }
  // DD/MM/YYYY atau DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (dmy) {
    const yr = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]!
    return `${yr}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
  }
  // DD/MM (khas KlikBCA: "15/10")
  const dm = s.match(/^(\d{1,2})[-/](\d{1,2})$/)
  if (dm) {
    const d = Number(dm[1])
    const m = Number(dm[2])
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${fallbackYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  // DD MMM YYYY atau DD MMM (mis. "15 Okt 2026" atau "15 Okt")
  const named = s.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{2,4}))?/)
  if (named) {
    const mon = MONTH_MAP[named[2]!.toLowerCase()]
    if (mon) {
      const yr = named[3] ? (named[3].length === 2 ? `20${named[3]}` : named[3]) : String(fallbackYear)
      return `${yr}-${mon}-${named[1]!.padStart(2, '0')}`
    }
  }
  return null
}

function splitCsvRow(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

function detectDelimiter(lines: string[]): string {
  for (const l of lines.slice(0, 15)) {
    if (!l.trim()) continue
    const commas = (l.match(/,/g) || []).length
    const semis = (l.match(/;/g) || []).length
    const tabs = (l.match(/\t/g) || []).length
    if (tabs >= 2 && tabs >= commas && tabs >= semis) return '\t'
    if (semis >= 2 && semis > commas) return ';'
    if (commas >= 2) return ','
  }
  return ','
}

export function parseStatementCsv(
  csvText: string,
  filename?: string,
  fallbackDate?: string,
): { source: StatementSource; lines: ParsedStatementLine[] } {
  const rawLines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (rawLines.length === 0) {
    throw new ApiError('statement_parse_error', 'File mutasi kosong.')
  }

  const delimiter = detectDelimiter(rawLines)
  let fallbackYear = fallbackDate ? Number(fallbackDate.slice(0, 4)) : new Date().getFullYear()
  const todayIso = fallbackDate || new Date().toISOString().slice(0, 10)

  // Cek tahun dari header Periode BCA/Mandiri bila ada (mis. "Periode : 01/10/2026 - 31/10/2026")
  for (const l of rawLines.slice(0, 10)) {
    const m = l.match(/\b(20\d{2})\b/)
    if (m) {
      fallbackYear = Number(m[1])
      break
    }
  }

  const fname = (filename || '').toLowerCase()
  let detectedSource: StatementSource = fname.includes('bca')
    ? 'bca_csv'
    : fname.includes('bri')
      ? 'bri_csv'
      : fname.includes('mandiri') || fname.includes('livin')
        ? 'mandiri_csv'
        : fname.includes('gopay')
          ? 'gopay_csv'
          : 'bca_csv'

  // Cari baris header tabel bila ada
  let headerIdx = -1
  let colMap: {
    date: number
    desc: number
    amount: number
    debit: number
    credit: number
    dir: number
    balance: number
    ref: number
  } = { date: 0, desc: 1, amount: -1, debit: -1, credit: -1, dir: -1, balance: -1, ref: -1 }

  for (let i = 0; i < Math.min(rawLines.length, 20); i++) {
    const cells = splitCsvRow(rawLines[i]!, delimiter).map((c) => c.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim())
    const hasDate = cells.some((c) => /^(tanggal|tgl|date|posting date|waktu)/.test(c))
    const hasDesc = cells.some((c) => /(keterangan|uraian|deskripsi|description|remark|catatan|detail|merchant)/.test(c))
    const hasAmt = cells.some((c) => /(jumlah|mutasi|nominal|amount|debet|debit|kredit|credit|masuk|keluar)/.test(c))
    if (hasDate && (hasDesc || hasAmt)) {
      headerIdx = i
      colMap = {
        date: cells.findIndex((c) => /^(tanggal|tgl|date|posting date|waktu)/.test(c)),
        desc: cells.findIndex((c) => /(keterangan|uraian|deskripsi|description|remark|catatan|detail|merchant)/.test(c)),
        amount: cells.findIndex((c) => /^(jumlah|mutasi|nominal|amount|nilai)$/.test(c) || c.startsWith('jumlah') || c.startsWith('mutasi')),
        debit: cells.findIndex((c) => /(debet|debit|keluar|out)/.test(c)),
        credit: cells.findIndex((c) => /(kredit|credit|masuk|in)/.test(c)),
        dir: cells.findIndex((c) => /^(status|tipe|type|arus|direction|dbcr|dk)$/.test(c)),
        balance: cells.findIndex((c) => /(saldo|balance)/.test(c)),
        ref: cells.findIndex((c) => /(ref|referensi|no ref|rrn|id transaksi)/.test(c)),
      }
      const headerJoined = cells.join(' ')
      if (headerJoined.includes('cabang') && headerJoined.includes('jumlah')) detectedSource = 'bca_csv'
      else if (headerJoined.includes('uraian') || headerJoined.includes('debet')) detectedSource = 'bri_csv'
      else if (headerJoined.includes('posting date') || headerJoined.includes('remark')) detectedSource = 'mandiri_csv'
      else if (headerJoined.includes('gopay')) detectedSource = 'gopay_csv'
      break
    }
  }

  const parsed: ParsedStatementLine[] = []
  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0

  for (let i = startRow; i < rawLines.length; i++) {
    const rawLine = rawLines[i]!
    // Skip baris ringkasan bawah KlikBCA / Bank ("Saldo Awal", "Mutasi Debet", "Mutasi Kredit", "Saldo Akhir", "Total")
    if (/^(saldo awal|mutasi debet|mutasi kredit|saldo akhir|total mutasi|catatan\s*:)/i.test(rawLine.replace(/^["']+/, ''))) {
      continue
    }

    const cells = splitCsvRow(rawLine, delimiter)
    if (cells.length < 2) continue

    let dateStr: string | null = null
    let description = ''
    let amount = 0
    let direction: 'in' | 'out' = 'out'
    let balanceAfter: number | null = null
    let refNo: string | null = null

    if (headerIdx >= 0) {
      const rawDate = cells[colMap.date] ?? ''
      dateStr = /^pend/i.test(rawDate.trim()) ? todayIso : parseDateCell(rawDate, fallbackYear)
      if (!dateStr) continue

      description = (cells[colMap.desc] ?? '').trim()
      if (colMap.ref >= 0 && cells[colMap.ref]) {
        refNo = cells[colMap.ref]!.trim() || null
      }
      if (colMap.balance >= 0 && cells[colMap.balance]) {
        const bal = parseMoneyCell(cells[colMap.balance]!).amount
        if (bal > 0) balanceAfter = bal
      }

      if (colMap.debit >= 0 && colMap.credit >= 0) {
        const dVal = parseMoneyCell(cells[colMap.debit] ?? '').amount
        const cVal = parseMoneyCell(cells[colMap.credit] ?? '').amount
        if (dVal > 0) {
          amount = dVal
          direction = 'out'
        } else if (cVal > 0) {
          amount = cVal
          direction = 'in'
        }
      } else if (colMap.amount >= 0) {
        const parsedAmt = parseMoneyCell(cells[colMap.amount] ?? '')
        amount = parsedAmt.amount
        if (colMap.dir >= 0 && cells[colMap.dir]) {
          const dirCell = parseMoneyCell(cells[colMap.dir]!).sign
          direction = dirCell ?? parsedAmt.sign ?? 'out'
        } else if (parsedAmt.sign) {
          direction = parsedAmt.sign
        } else {
          // Cek apakah kolom di sebelah kanan amount adalah "DB" / "CR" (khas KlikBCA CSV)
          const nextCell = cells[colMap.amount + 1] ?? ''
          const nextSign = parseMoneyCell(nextCell).sign
          direction = nextSign ?? (/(\bcr\b|\bkredit\b|\bmasuk\b|\bgaji\b|\bbunga\b)/i.test(description) ? 'in' : 'out')
        }
      }
    } else {
      // Baris tanpa header standar (mis. KlikBCA tanpa judul kolom atau copy-paste manual)
      const firstCell = cells[0] ?? ''
      dateStr = /^pend/i.test(firstCell.trim()) ? todayIso : parseDateCell(firstCell, fallbackYear)
      if (!dateStr) continue

      description = (cells[1] ?? '').trim()
      // Cari nominal di kolom-kolom sisanya
      for (let c = 2; c < cells.length; c++) {
        const cell = cells[c] ?? ''
        const p = parseMoneyCell(cell)
        if (p.amount > 0 && amount === 0) {
          amount = p.amount
          const nextSign = cells[c + 1] ? parseMoneyCell(cells[c + 1]!).sign : null
          direction = p.sign ?? nextSign ?? 'out'
        } else if (p.amount > 0 && amount > 0 && balanceAfter === null) {
          balanceAfter = p.amount
        }
      }
    }

    if (!dateStr || amount <= 0) continue

    // Ekstrak nomor referensi dari deskripsi bila belum ada (mis. RRN / TRSF E-BANKING 1015/FTSCY/WS95051)
    if (!refNo && description) {
      const refMatch = description.match(/\b([A-Z0-9]{4,}\/[A-Z0-9/]{4,}|\d{10,16})\b/)
      if (refMatch) refNo = refMatch[1]!
    }

    parsed.push({
      date: dateStr,
      amount,
      direction,
      description: description || (direction === 'in' ? 'Mutasi Masuk' : 'Mutasi Keluar'),
      ref_no: refNo,
      balance_after: balanceAfter,
    })
  }

  if (parsed.length === 0) {
    throw new ApiError(
      'statement_parse_error',
      'Tidak ditemukan baris transaksi yang valid. Pastikan file memiliki kolom Tanggal, Keterangan, dan Jumlah/Mutasi.',
    )
  }

  return { source: detectedSource, lines: parsed }
}

/** Ekstrak baris mutasi dari foto/screenshot m-Banking via AI Vision. */
export async function scanStatementImage(
  actor: Actor,
  input: { image_base64: string; mime_type: string },
): Promise<{ bank_name: string | null; lines: ParsedStatementLine[] }> {
  await requireFeature(actor, 'reconciliation')
  const config = await getAiConfig(actor)
  const provider = config.provider!
  const apiKey = config.apiKey!
  if (!VISION_PROVIDERS.includes(provider)) {
    throw ApiError.fromCode('provider_no_vision')
  }

  const currentYear = new Date().getFullYear()
  const prompt = `Kamu adalah asisten keuangan keluarga Indonesia. Baca gambar screenshot mutasi rekening bank / e-wallet (m-BCA, myBCA, BRImo, Livin Mandiri, BNI, GoPay, OVO, ShopeePay, SeaBank, Jago) ini dan ekstrak semua baris mutasi transaksi.

Kembalikan HANYA JSON dengan format:
{
  "bank_name": "BCA / BRI / Mandiri / GoPay / dll",
  "lines": [
    {
      "date": "YYYY-MM-DD",
      "description": "Keterangan mutasi / nama merchant / transfer",
      "amount": 50000,
      "direction": "out",
      "ref_no": null,
      "balance_after": null
    }
  ]
}
Aturan:
- date: format YYYY-MM-DD (jika di layar hanya tertulis tanggal & bulan seperti "15 Okt" atau "15/10", gunakan tahun ${currentYear}).
- amount: angka bulat positif dalam Rupiah tanpa titik/koma.
- direction: "out" untuk uang keluar (DB / Debet / tanda minus / warna merah) atau "in" untuk uang masuk (CR / Kredit / tanda plus / warna hijau).
- balance_after: saldo setelah transaksi bila tertulis di baris itu (angka bulat), atau null.
- Jangan lewatkan satu baris pun yang terlihat jelas.`

  const raw = await callProviderJson(
    buildVisionRequest(provider, apiKey, input.image_base64, input.mime_type, prompt),
    provider,
  )

  const rawLines = Array.isArray(raw.lines) ? raw.lines : []
  const lines: ParsedStatementLine[] = []
  for (const item of rawLines) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const date = parseDateCell(String(r.date ?? ''), currentYear) ?? new Date().toISOString().slice(0, 10)
    const amount = Math.round(Number(r.amount ?? 0))
    if (!Number.isFinite(amount) || amount <= 0) continue
    const dirRaw = String(r.direction ?? 'out').toLowerCase()
    const direction: 'in' | 'out' = dirRaw === 'in' || dirRaw === 'cr' || dirRaw === 'credit' ? 'in' : 'out'
    const description = String(r.description ?? '').trim() || (direction === 'in' ? 'Mutasi Masuk' : 'Mutasi Keluar')
    const balanceAfter = r.balance_after != null && Number(r.balance_after) > 0 ? Math.round(Number(r.balance_after)) : null
    const refNo = r.ref_no ? String(r.ref_no).trim() : null
    lines.push({ date, amount, direction, description, ref_no: refNo, balance_after: balanceAfter })
  }

  if (lines.length === 0) {
    throw new ApiError('statement_parse_error', 'Tidak dapat menemukan baris mutasi dari gambar ini.')
  }

  return {
    bank_name: typeof raw.bank_name === 'string' ? raw.bank_name : null,
    lines,
  }
}

function daysBetween(d1: string, d2: string): number {
  const t1 = new Date(`${d1}T00:00:00Z`).getTime()
  const t2 = new Date(`${d2}T00:00:00Z`).getTime()
  return Math.round(Math.abs(t1 - t2) / 86_400_000)
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function jaccardSimilarity(a: string, b: string): number {
  const stopWords = new Set(['trsf', 'ebanking', 'db', 'cr', 'pembayaran', 'transfer', 'qris', 'ke', 'dari', 'pt', 'tbk', 'id', 'idr'])
  const tokensA = new Set(
    normDesc(a)
      .split(' ')
      .filter((w) => w.length >= 2 && !stopWords.has(w)),
  )
  const tokensB = new Set(
    normDesc(b)
      .split(' ')
      .filter((w) => w.length >= 2 && !stopWords.has(w)),
  )
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let inter = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) inter++
  }
  const union = tokensA.size + tokensB.size - inter
  return union > 0 ? inter / union : 0
}

interface CandidateTx {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  date: string
  note: string
  category_name: string
  account_id: string
  to_account_id: string | null
}

/**
 * Algoritma pencocokan deterministik (10-fitur-opsional-keluarga.md §5.4):
 * - Kandidat: transaksi aktif di akun yang sama, nominal sama, arah sama, tanggal ±3 hari.
 * - Skor:
 *   - Selisih tanggal: 0 hari +50 | ±1 hari +35 | ±2 hari +20 | ±3 hari +5
 *   - ref_no ditemukan di note: +40
 *   - Jaccard kata deskripsi vs note/kategori * 20 (+ bonus 15 jika kata kunci utama cocok)
 * - >= 60 -> matched otomatis; 40..59 -> suggested; < 40 -> unmatched.
 */
function scorePair(line: ParsedStatementLine, tx: CandidateTx): number {
  const diff = daysBetween(line.date, tx.date)
  if (diff > 3) return -1

  let score = diff === 0 ? 50 : diff === 1 ? 35 : diff === 2 ? 20 : 5

  const noteLow = (tx.note || '').toLowerCase()
  const descLow = normDesc(line.description)

  if (line.ref_no && line.ref_no.length >= 4 && noteLow.includes(line.ref_no.toLowerCase())) {
    score += 40
  }

  const jacc = jaccardSimilarity(line.description, `${tx.note} ${tx.category_name}`)
  score += Math.round(jacc * 20)

  // Bonus bila kata spesifik (panjang >= 4) dari catatan Karaya muncul di deskripsi mutasi bank
  const txWords = normDesc(tx.note)
    .split(' ')
    .filter((w) => w.length >= 4 && !['rekon', 'transfer', 'belanja', 'makan'].includes(w))
  if (txWords.some((w) => descLow.includes(w))) {
    score += 15
  }

  return Math.min(100, score)
}

export interface ImportStatementInput {
  account_id?: string
  account?: string
  source?: StatementSource
  filename?: string
  csv_text?: string
  lines?: ParsedStatementLine[]
}

export async function importStatement(actor: Actor, input: ImportStatementInput) {
  assertScope(actor, 'write')
  await requireFeature(actor, 'reconciliation')

  let parsedSource: StatementSource = input.source ?? 'manual'
  let parsedLines: ParsedStatementLine[] = []

  if (input.csv_text && input.csv_text.trim()) {
    const res = parseStatementCsv(input.csv_text, input.filename)
    parsedSource = input.source ?? res.source
    parsedLines = res.lines
  } else if (Array.isArray(input.lines) && input.lines.length > 0) {
    parsedLines = input.lines.map((l, idx) => {
      const amt = Math.round(Number(l.amount))
      if (!l.date || !/^\d{4}-\d{2}-\d{2}$/.test(l.date) || !Number.isFinite(amt) || amt <= 0) {
        throw new ApiError('statement_parse_error', `Baris ke-${idx + 1} tidak valid.`, {
          details: { line: idx + 1 },
        })
      }
      return {
        date: l.date,
        amount: amt,
        direction: l.direction === 'in' ? 'in' : 'out',
        description: (l.description || '').trim() || (l.direction === 'in' ? 'Mutasi Masuk' : 'Mutasi Keluar'),
        ref_no: l.ref_no ?? null,
        balance_after: l.balance_after != null ? Math.round(Number(l.balance_after)) : null,
      }
    })
  } else {
    throw new ApiError('statement_parse_error', 'Kirimkan file CSV (csv_text) atau daftar baris mutasi (lines).')
  }

  return withActor(actor, async (tx) => {
    const accountId = await resolveAccountRef(tx, actor, input, 'account')
    const dates = parsedLines.map((l) => l.date).sort()
    const periodFrom = dates[0]!
    const periodTo = dates[dates.length - 1]!

    // Buat record statement_imports
    const [imp] = await tx<{ id: string; created_at: string }[]>`
      insert into statement_imports (
        household_id, account_id, source, filename, imported_by_member_id, period_from, period_to, line_count
      ) values (
        ${actor.householdId}, ${accountId}, ${parsedSource}, ${input.filename ?? null},
        ${actor.memberId}, ${periodFrom}, ${periodTo}, ${parsedLines.length}
      )
      returning id, created_at::text
    `

    // Hitung seq per baris identik & upsert ke statement_lines
    const seqCounter = new Map<string, number>()
    const lineIds: string[] = []

    for (const line of parsedLines) {
      const baseKey = [
        line.date,
        String(line.amount),
        line.direction,
        (line.ref_no ?? '').trim().toLowerCase(),
        normDesc(line.description),
      ].join('|')
      const seq = (seqCounter.get(baseKey) ?? 0) + 1
      seqCounter.set(baseKey, seq)
      const fp = computeFingerprint(accountId, line, seq)

      const [upserted] = await tx<{ id: string }[]>`
        insert into statement_lines (
          import_id, household_id, account_id, date, amount, direction,
          description, ref_no, balance_after, seq, fingerprint
        ) values (
          ${imp!.id}, ${actor.householdId}, ${accountId}, ${line.date}, ${line.amount}, ${line.direction},
          ${line.description}, ${line.ref_no ?? null}, ${line.balance_after ?? null}, ${seq}, ${fp}
        )
        on conflict (account_id, fingerprint) do update set
          import_id = excluded.import_id,
          balance_after = coalesce(excluded.balance_after, statement_lines.balance_after)
        returning id
      `
      lineIds.push(upserted!.id)
    }

    // Jalankan algoritma pencocokan untuk baris-baris yang belum resolved (unmatched/suggested)
    await runMatchingForImport(tx, actor.householdId, accountId, imp!.id, periodFrom, periodTo)

    return getStatementImportDetailInTx(tx, actor, imp!.id)
  })
}

async function runMatchingForImport(
  tx: SqlTx,
  householdId: string,
  accountId: string,
  importId: string,
  periodFrom: string,
  periodTo: string,
) {
  const lines = await tx<{
    id: string
    date: string
    amount: string
    direction: 'in' | 'out'
    description: string
    ref_no: string | null
    match_status: StatementMatchStatus
    matched_transaction_id: string | null
  }[]>`
    select id, date::text, amount::text, direction, description, ref_no, match_status, matched_transaction_id
    from statement_lines
    where import_id = ${importId} and household_id = ${householdId}
    order by date asc, seq asc
  `

  // Transaksi yang sudah dikunci oleh baris statement lain (matched / created)
  const lockedRows = await tx<{ matched_transaction_id: string }[]>`
    select matched_transaction_id
    from statement_lines
    where household_id = ${householdId}
      and account_id = ${accountId}
      and matched_transaction_id is not null
      and match_status in ('matched', 'created')
      and import_id <> ${importId}
  `
  const usedTxIds = new Set<string>(lockedRows.map((r) => r.matched_transaction_id))

  // Kunci juga yang sudah resolved di dalam import ini sendiri (kalau re-import)
  for (const l of lines) {
    if ((l.match_status === 'matched' || l.match_status === 'created') && l.matched_transaction_id) {
      usedTxIds.add(l.matched_transaction_id)
    }
  }

  const searchFrom = shiftDate(periodFrom, -3)
  const searchTo = shiftDate(periodTo, 3)

  const candidates = await tx<{
    id: string
    type: 'income' | 'expense' | 'transfer'
    amount: string
    date: string
    note: string
    category_name: string
    account_id: string
    to_account_id: string | null
  }[]>`
    select
      t.id, t.type, t.amount::text, t.date::text, t.note,
      coalesce(c.name, 'Transfer') as category_name,
      t.account_id, t.to_account_id
    from transactions t
    left join categories c on c.id = t.category_id
    where t.household_id = ${householdId}
      and t.deleted_at is null
      and (t.account_id = ${accountId} or t.to_account_id = ${accountId})
      and t.date between ${searchFrom} and ${searchTo}
  `

  const candidateList: CandidateTx[] = candidates.map((c) => ({
    ...c,
    amount: Number(c.amount),
  }))

  // Buat daftar pasangan potensial (line, tx, score) untuk baris yang masih unmatched/suggested
  const unresolvedLines = lines.filter((l) => l.match_status === 'unmatched' || l.match_status === 'suggested')
  interface PairScore {
    lineId: string
    txId: string
    score: number
    dateDiff: number
  }
  const pairs: PairScore[] = []

  for (const l of unresolvedLines) {
    const lAmt = Number(l.amount)
    for (const c of candidateList) {
      if (usedTxIds.has(c.id)) continue
      if (c.amount !== lAmt) continue
      const cDir: 'in' | 'out' =
        c.type === 'income' || (c.type === 'transfer' && c.to_account_id === accountId) ? 'in' : 'out'
      if (cDir !== l.direction) continue

      const sc = scorePair(
        {
          date: l.date,
          amount: lAmt,
          direction: l.direction,
          description: l.description,
          ref_no: l.ref_no,
        },
        c,
      )
      if (sc >= 40) {
        pairs.push({
          lineId: l.id,
          txId: c.id,
          score: sc,
          dateDiff: daysBetween(l.date, c.date),
        })
      }
    }
  }

  // Urutkan skor tertinggi -> selisih tanggal terdekat
  pairs.sort((a, b) => b.score - a.score || a.dateDiff - b.dateDiff)

  const assignedLines = new Set<string>()
  for (const p of pairs) {
    if (assignedLines.has(p.lineId) || usedTxIds.has(p.txId)) continue
    assignedLines.add(p.lineId)
    usedTxIds.add(p.txId)

    const status: StatementMatchStatus = p.score >= 60 ? 'matched' : 'suggested'
    await tx`
      update statement_lines
      set match_status = ${status},
          matched_transaction_id = ${p.txId},
          match_confidence = ${p.score}
      where id = ${p.lineId}
    `
  }

  // Pastikan baris yang tidak dapat pasangan tetap unmatched
  for (const l of unresolvedLines) {
    if (!assignedLines.has(l.id)) {
      await tx`
        update statement_lines
        set match_status = 'unmatched',
            matched_transaction_id = null,
            match_confidence = null
        where id = ${l.id}
      `
    }
  }
}

export async function listStatementImports(actor: Actor, accountId?: string) {
  await requireFeature(actor, 'reconciliation')
  return withActor(actor, async (tx) => {
    const rows = await tx<{
      id: string
      account_id: string
      account_name: string
      source: StatementSource
      filename: string | null
      period_from: string | null
      period_to: string | null
      line_count: number
      created_at: string
      matched_count: string
      suggested_count: string
      unmatched_count: string
      created_count: string
      ignored_count: string
    }[]>`
      select
        si.id,
        si.account_id,
        a.name as account_name,
        si.source,
        si.filename,
        si.period_from::text,
        si.period_to::text,
        si.line_count,
        si.created_at::text,
        count(*) filter (where sl.match_status = 'matched')::text as matched_count,
        count(*) filter (where sl.match_status = 'suggested')::text as suggested_count,
        count(*) filter (where sl.match_status = 'unmatched')::text as unmatched_count,
        count(*) filter (where sl.match_status = 'created')::text as created_count,
        count(*) filter (where sl.match_status = 'ignored')::text as ignored_count
      from statement_imports si
      join accounts a on a.id = si.account_id
      left join statement_lines sl on sl.import_id = si.id
      where si.household_id = ${actor.householdId}
        and (${accountId ?? null}::uuid is null or si.account_id = ${accountId ?? null}::uuid)
      group by si.id, a.name
      order by si.created_at desc
      limit 30
    `

    return {
      data: rows.map((r) => ({
        id: r.id,
        account: { id: r.account_id, name: r.account_name },
        source: r.source,
        filename: r.filename,
        period_from: r.period_from,
        period_to: r.period_to,
        line_count: Number(r.line_count),
        created_at: r.created_at,
        summary: {
          matched: Number(r.matched_count),
          suggested: Number(r.suggested_count),
          unmatched: Number(r.unmatched_count),
          created: Number(r.created_count),
          ignored: Number(r.ignored_count),
        },
      })),
    }
  })
}

async function getStatementImportDetailInTx(tx: SqlTx, actor: Actor, importId: string) {
  const [imp] = await tx<{
    id: string
    account_id: string
    account_name: string
    source: StatementSource
    filename: string | null
    period_from: string | null
    period_to: string | null
    line_count: number
    created_at: string
  }[]>`
    select
      si.id, si.account_id, a.name as account_name, si.source, si.filename,
      si.period_from::text, si.period_to::text, si.line_count, si.created_at::text
    from statement_imports si
    join accounts a on a.id = si.account_id
    where si.id = ${importId} and si.household_id = ${actor.householdId}
  `
  if (!imp) throw ApiError.fromCode('not_found')

  const lines = await tx<{
    id: string
    date: string
    amount: string
    direction: 'in' | 'out'
    description: string
    ref_no: string | null
    balance_after: string | null
    seq: number
    match_status: StatementMatchStatus
    matched_transaction_id: string | null
    match_confidence: number | null
    tx_note: string | null
    tx_date: string | null
    tx_amount: string | null
    tx_category_name: string | null
  }[]>`
    select
      sl.id, sl.date::text, sl.amount::text, sl.direction, sl.description,
      sl.ref_no, sl.balance_after::text, sl.seq, sl.match_status,
      sl.matched_transaction_id, sl.match_confidence,
      t.note as tx_note, t.date::text as tx_date, t.amount::text as tx_amount,
      coalesce(c.name, 'Transfer') as tx_category_name
    from statement_lines sl
    left join transactions t on t.id = sl.matched_transaction_id and t.deleted_at is null
    left join categories c on c.id = t.category_id
    where sl.import_id = ${importId} and sl.household_id = ${actor.householdId}
    order by sl.date desc, sl.seq asc
  `

  // Cari transaksi di Karaya pada periode & akun tersebut yang TIDAK ada di mutasi bank (unmatched_karaya)
  const unmatchedKaraya =
    imp.period_from && imp.period_to
      ? await tx<{
          id: string
          date: string
          type: string
          amount: string
          note: string
          category_name: string
        }[]>`
          select
            t.id, t.date::text, t.type, t.amount::text, t.note,
            coalesce(c.name, 'Transfer') as category_name
          from transactions t
          left join categories c on c.id = t.category_id
          where t.household_id = ${actor.householdId}
            and t.deleted_at is null
            and (t.account_id = ${imp.account_id} or t.to_account_id = ${imp.account_id})
            and t.date between ${imp.period_from} and ${imp.period_to}
            and not exists (
              select 1 from statement_lines sl
              where sl.household_id = ${actor.householdId}
                and sl.account_id = ${imp.account_id}
                and sl.matched_transaction_id = t.id
                and sl.match_status in ('matched', 'created', 'suggested')
            )
          order by t.date desc
        `
      : []

  const [balRow] = await tx<{ balance: string }[]>`
    select coalesce(balance, 0)::text as balance
    from v_account_balances
    where account_id = ${imp.account_id}
  `
  const karayaBalance = Number(balRow?.balance ?? 0)
  const lineWithBalance = lines.find((l) => l.balance_after != null)
  const statementEndingBalance = lineWithBalance?.balance_after != null ? Number(lineWithBalance.balance_after) : null

  const mappedLines = lines.map((l) => ({
    id: l.id,
    date: l.date,
    amount: Number(l.amount),
    direction: l.direction,
    description: l.description,
    ref_no: l.ref_no,
    balance_after: l.balance_after != null ? Number(l.balance_after) : null,
    seq: l.seq,
    match_status: l.match_status,
    match_confidence: l.match_confidence,
    matched_transaction: l.matched_transaction_id
      ? {
          id: l.matched_transaction_id,
          date: l.tx_date,
          amount: l.tx_amount != null ? Number(l.tx_amount) : Number(l.amount),
          note: l.tx_note,
          category_name: l.tx_category_name,
        }
      : null,
  }))

  const counts = {
    matched: mappedLines.filter((l) => l.match_status === 'matched').length,
    suggested: mappedLines.filter((l) => l.match_status === 'suggested').length,
    unmatched_statement: mappedLines.filter((l) => l.match_status === 'unmatched').length,
    created: mappedLines.filter((l) => l.match_status === 'created').length,
    ignored: mappedLines.filter((l) => l.match_status === 'ignored').length,
    unmatched_karaya: unmatchedKaraya.length,
  }

  return {
    import: {
      id: imp.id,
      account: { id: imp.account_id, name: imp.account_name },
      source: imp.source,
      filename: imp.filename,
      period_from: imp.period_from,
      period_to: imp.period_to,
      line_count: Number(imp.line_count),
      created_at: imp.created_at,
    },
    summary: counts,
    balance_comparison: {
      karaya_balance: karayaBalance,
      statement_ending_balance: statementEndingBalance,
      diff: statementEndingBalance != null ? statementEndingBalance - karayaBalance : null,
    },
    lines: mappedLines,
    unmatched_karaya: unmatchedKaraya.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: Number(t.amount),
      note: t.note,
      category_name: t.category_name,
    })),
  }
}

export async function getStatementImportDetail(actor: Actor, importId: string) {
  await requireFeature(actor, 'reconciliation')
  return withActor(actor, (tx) => getStatementImportDetailInTx(tx, actor, importId))
}

export async function confirmStatementLine(actor: Actor, lineId: string, transactionId: string) {
  assertScope(actor, 'write')
  await requireFeature(actor, 'reconciliation')
  return withActor(actor, async (tx) => {
    const [line] = await tx<{ id: string; match_status: StatementMatchStatus }[]>`
      select id, match_status from statement_lines
      where id = ${lineId} and household_id = ${actor.householdId}
      for update
    `
    if (!line) throw ApiError.fromCode('statement_line_not_found')
    if (line.match_status === 'created') {
      throw ApiError.fromCode('statement_line_already_resolved')
    }

    const [targetTx] = await tx<{ id: string }[]>`
      select id from transactions
      where id = ${transactionId} and household_id = ${actor.householdId} and deleted_at is null
    `
    if (!targetTx) throw ApiError.fromCode('transaction_not_found')

    await tx`
      update statement_lines
      set match_status = 'matched',
          matched_transaction_id = ${transactionId},
          match_confidence = 100
      where id = ${lineId}
    `
    return { id: lineId, match_status: 'matched' as const, matched_transaction_id: transactionId }
  })
}

export async function ignoreStatementLine(actor: Actor, lineId: string) {
  assertScope(actor, 'write')
  await requireFeature(actor, 'reconciliation')
  return withActor(actor, async (tx) => {
    const [line] = await tx<{ id: string; match_status: StatementMatchStatus }[]>`
      select id, match_status from statement_lines
      where id = ${lineId} and household_id = ${actor.householdId}
      for update
    `
    if (!line) throw ApiError.fromCode('statement_line_not_found')

    await tx`
      update statement_lines
      set match_status = 'ignored',
          matched_transaction_id = null
      where id = ${lineId}
    `
    return { id: lineId, match_status: 'ignored' as const }
  })
}

export async function acceptStatementLine(
  actor: Actor,
  lineId: string,
  input: {
    category_id?: string
    category?: string
    note?: string
    beneficiary_id?: string
    beneficiary?: string
  },
  timezone: string,
) {
  assertScope(actor, 'write')
  await requireFeature(actor, 'reconciliation')

  const lineInfo = await withActor(actor, async (tx) => {
    const [line] = await tx<{
      id: string
      account_id: string
      date: string
      amount: string
      direction: 'in' | 'out'
      description: string
      match_status: StatementMatchStatus
    }[]>`
      select id, account_id, date::text, amount::text, direction, description, match_status
      from statement_lines
      where id = ${lineId} and household_id = ${actor.householdId}
      for update
    `
    if (!line) throw ApiError.fromCode('statement_line_not_found')
    if (line.match_status === 'created' || line.match_status === 'matched') {
      throw ApiError.fromCode('statement_line_already_resolved')
    }
    return line
  })

  const txType: 'income' | 'expense' = lineInfo.direction === 'in' ? 'income' : 'expense'
  const noteText = input.note?.trim()
    ? input.note.trim()
    : `[REKON] ${lineInfo.description}`

  const created = await createTransaction(
    actor,
    {
      type: txType,
      account_id: lineInfo.account_id,
      amount: Number(lineInfo.amount),
      date: lineInfo.date,
      note: noteText,
      category_id: input.category_id,
      category: input.category ?? 'Lainnya',
      beneficiary_id: input.beneficiary_id,
      beneficiary: input.beneficiary,
      source: 'import',
    },
    timezone,
  )

  await withActor(actor, async (tx) => {
    await tx`
      update statement_lines
      set match_status = 'created',
          matched_transaction_id = ${created.transaction.id},
          match_confidence = 100
      where id = ${lineId} and household_id = ${actor.householdId}
    `
  })

  return {
    id: lineId,
    match_status: 'created' as const,
    transaction: created.transaction,
    account: created.account,
  }
}
