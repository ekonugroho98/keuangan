import type postgres from 'postgres'
import type { Actor } from '../auth/actor'

/**
 * Titipan = barang yang dibelikan untuk orang LAIN (di luar household) yang akan mengganti uangnya.
 * Aturan (permintaan pemilik produk 2026-10-13): item titipan BUKAN pengeluaran keluarga — masuk
 * kategori sistem "Piutang" dan otomatis dibuatkan catatan piutang atas nama orangnya, supaya bisa
 * ditagih/ditutup lewat alur piutang yang sudah ada (`receive_piutang`). Berlaku untuk
 * `POST /v1/receipts/ingest` (Hermes) dan `POST /v1/transactions/batch` (modal scan web).
 *
 * Tiga cara item dikenali sebagai titipan, dari yang paling eksplisit:
 *   1. field `titipan: "<nama orang>"` di item (Hermes mengisi kalau user bilang "yang sabun titipan Bu Ani");
 *   2. kata "titipan" di nama/note item ("Sabun titipan Ani", "titipan bu ani: pulsa") — nama diambil dari teks sesudahnya;
 *   3. kategori item sudah dipilih "Piutang" (dropdown modal web) — nama dari note, atau "Titipan" kalau tidak ada.
 */
export interface Titipan {
  borrower: string
}

const TITIPAN_RE = /\btitipan\b/i
// Kata sambung yang sering muncul sebelum nama: "titipan dari Bu Ani", "titipan buat Dedi", "titipan-nya Ani".
const LEAD_WORDS_RE = /^(?:[-:,]\s*|(?:dari|buat|untuk|punya|nya|dr|utk)\b\s*)+/i
// Potongan ekor yang bukan nama: "(2 pcs)", "x2", "85g", tanda baca.
const TAIL_RE = /\s*(?:[([].*|x\s*\d+.*|\d+\s*(?:pcs|pc|bh|bks|btl|g|gr|kg|ml|l)\b.*|[-:,.;]+)\s*$/i

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/** Ambil nama orang dari teks sesudah kata "titipan". Kosong → "Titipan". */
export function borrowerFromText(text: string): string {
  const m = text.match(TITIPAN_RE)
  if (!m || m.index === undefined) return 'Titipan'
  let tail = text.slice(m.index + m[0].length).trim()
  tail = tail.replace(LEAD_WORDS_RE, '')
  // Nama berhenti di tanda baca/kurung ("titipan Dedi: Indomie x2", "(titipan mama)").
  tail = tail.split(/[:,;()[\]]|\s[-–]\s/)[0]!.replace(TAIL_RE, '').trim()
  // Hanya kata-kata nama (maks 4 kata, huruf/angka/titik) — sisanya dianggap bukan nama.
  const words = tail.split(/\s+/).filter((w) => /^[\p{L}\p{N}.'-]+$/u.test(w)).slice(0, 4)
  const name = words.join(' ').trim()
  if (!name || /^(?:item|barang|belanja|struk)$/i.test(name)) return 'Titipan'
  return titleCase(name).slice(0, 80)
}

/** Deteksi titipan dari field eksplisit atau teks nama/note item. `null` = bukan titipan. */
export function detectTitipan(text: string | undefined | null, explicit?: string | null): Titipan | null {
  const ex = explicit?.trim()
  if (ex) return { borrower: titleCase(ex).slice(0, 80) }
  if (text && TITIPAN_RE.test(text)) return { borrower: borrowerFromText(text) }
  return null
}

/** Nama item untuk note: kalau titipan datang dari field eksplisit, tulis "(titipan X)" supaya note menjelaskan dirinya. */
export function titipanDisplayName(name: string, titipan: Titipan | null): string {
  if (!titipan || TITIPAN_RE.test(name)) return name
  return `${name} (titipan ${titipan.borrower})`
}

export async function piutangCategoryId(tx: postgres.TransactionSql, householdId: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id from categories where household_id = ${householdId} and system_key = 'piutang' and deleted_at is null limit 1
  `
  if (!row) throw new Error('kategori sistem Piutang tidak ditemukan untuk household ini')
  return row.id
}

export interface TitipanCreated {
  txId: string | undefined
  borrower: string
  name: string
  amount: number
}

export interface PiutangSummary {
  id: string
  borrower_name: string
  total: number
  items: string[]
}

/**
 * Satu catatan piutang per orang per struk/batch (beberapa item titipan Bu Ani digabung jadi satu
 * piutang dengan total = jumlahnya). `lend_transaction_id` hanya diisi kalau tepat satu transaksi
 * (kolom itu UNIQUE dan satu-ke-satu) — selebihnya item disebut di `notes`.
 * Dipanggil DI DALAM transaksi DB yang sama dengan post_transactions_batch, sehingga kalau batch
 * gagal tidak ada piutang yang tercipta.
 */
export async function createTitipanPiutang(
  tx: postgres.TransactionSql,
  actor: Actor,
  input: { accountId: string; merchant?: string | null; ownerMemberId?: string; created: TitipanCreated[] },
): Promise<PiutangSummary[]> {
  const ownerId = input.ownerMemberId ?? actor.memberId
  const groups = new Map<string, { borrower: string; items: TitipanCreated[] }>()
  for (const c of input.created) {
    const key = c.borrower.toLowerCase()
    const g = groups.get(key) ?? { borrower: c.borrower, items: [] }
    g.items.push(c)
    groups.set(key, g)
  }
  const out: PiutangSummary[] = []
  for (const g of groups.values()) {
    const total = g.items.reduce((s, i) => s + i.amount, 0)
    if (total <= 0) continue
    const names = g.items.map((i) => i.name)
    const notes = `Titipan${input.merchant ? ` dari ${input.merchant}` : ''}: ${names.join(', ')}`.slice(0, 300)
    const lendTxId = g.items.length === 1 ? (g.items[0]!.txId ?? null) : null
    const [row] = await tx<{ id: string }[]>`
      insert into piutang (household_id, owner_member_id, borrower_name, total, from_account_id, notes, lend_transaction_id)
      values (${actor.householdId}, ${ownerId}, ${g.borrower}, ${total}, ${input.accountId}, ${notes}, ${lendTxId})
      returning id
    `
    out.push({ id: row!.id, borrower_name: g.borrower, total, items: names })
  }
  return out
}
