import type postgres from 'postgres'
import { parseReceiptNote } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { tryGetAiConfig } from './ai/provider'
import { GROUP_CANDIDATES, type ProductGroup } from './product-groups'
import { lookupProduct } from './web-lookup'

/**
 * Pemetaan nama item struk → NAMA kategori pengeluaran household yang persis ada. Dipakai bersama
 * oleh scan-receipt.ts (web) dan receipts.ts (Hermes `ingest_receipt`) supaya keduanya satu perilaku.
 *
 * Urutan keputusan per item (classifySync), dari yang paling dipercaya:
 *   1. learned  — category_keywords household (konfirmasi/koreksi user; mengalahkan AI)
 *   2. ai       — kategori yang disebut AI/agent, kalau valid dan bukan "Lainnya"
 *   3. known    — product_knowledge lintas household (hasil pencarian web sebelumnya)
 *   4. rule     — regex kata kunci bawaan
 *   5. web      — (classifyItems) cari di web + AI, hasilnya disimpan ke product_knowledge
 *   6. fallback — "Lainnya"
 */
export interface ExpenseCategory { name: string; aliases: string[] }
export interface LearnedKeyword { keyword: string; category: string }
export interface KnownProduct { keyword: string; group: ProductGroup }
export type ClassifySource = 'learned' | 'ai' | 'known' | 'rule' | 'web' | 'fallback'
export interface Classified { category: string; source: ClassifySource }
export interface ClassifyContext { categories: ExpenseCategory[]; learned: LearnedKeyword[]; known: KnownProduct[] }

const MAX_WEB_LOOKUPS_PER_CALL = 5

// Setara norm_text() di DB (lower + unaccent + rapikan spasi) supaya keyword cocok di kedua sisi.
export function normText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Kelompok generik → kandidat nama/alias kategori household, urutan = prioritas.
const KEYWORD_RULES: Array<{ re: RegExp; group: ProductGroup }> = [
  { re: /obat|vitamin|masker|apotek|klinik|dokter|suplemen|kesehatan|plester|betadine|paracetamol/i, group: 'health' },
  { re: /pulsa|paket data|token|listrik|pln|internet|wifi|indihome|tagihan/i, group: 'utility' },
  { re: /bensin|bbm|pertamax|pertalite|parkir|\btol\b|ojek|grab|gojek|taxi|taksi|\bbus\b|kereta|transjakarta/i, group: 'transport' },
  { re: /buku|alat tulis|pensil|pulpen|sekolah|kursus|\bles\b|fotokopi|fotocopy/i, group: 'education' },
  { re: /deterjen|sabun|sampo|shampoo|pasta gigi|odol|sikat|tisu|tissue|pembalut|popok|diapers|pampers|pewangi|pembersih|sunlight|rinso|molto|so ?klin|daia|downy|vanish|biosol|wipol|bayclin|super ?pel|baygon|pepsodent|ciptadent|lifebuoy|\blux\b|dettol|sunsilk|pantene|rejoice|paseo|montis|monttis|\bpel\b|sapu|baju|celana|kaos|sandal|sepatu/i, group: 'household' },
  { re: /\bmie\b|nasi|ayam|sapi|ikan|sayur|buah|kopi|\bteh\b|susu|roti|snack|kerupuk|minyak|beras|gula|garam|tepung|saus|kecap|aqua|air mineral|minuman|makanan|bumbu|santan|telur|daging|bakso|soto|biskuit|coklat|cokelat|permen|yogurt|keju|sosis|nugget/i, group: 'food' },
]

// Kategori khusus yang HANYA ada di sebagian household (dibuat user, bukan bawaan): dicek sebelum
// kelompok generik, dan hanya berlaku kalau household punya kategori dengan nama/alias kandidatnya.
// Contoh: "Bakso Mas Boy" → "Makan Beli & Jajan" (bukan "Bahan Makanan"), "Pampers" → "Bayi & Anak".
export const SPECIAL_RULES: Array<{ re: RegExp; candidates: string[] }> = [
  {
    re: /bakso|\bsoto\b|warteg|warung makan|rumah makan|\brm\b|nasi (padang|uduk|goreng|kuning|bungkus|kotak)|\bsate\b|pecel|seblak|siomay|batagor|gorengan|martabak|es teler|es teh|es jeruk|jus buah|resto|restoran|foodhall|food court|\bkfc\b|mcd|mcdonald|starbucks|kopi kenangan|janji jiwa|geprek|penyet|mie ayam|bubur ayam|ketoprak|gado.gado|takoyaki|takayaki|risol|jajan|gofood|grabfood|shopeefood|mie katsu|tongseng|kebab|sempol|cilok|cireng|cimol|dimsum|dim sum|burger|pizza|hot ?dog|corn ?dog|sosis bakar|telur gulung|pempek|empek|bakmi|roti bakar|lontong|rawon|batagor|cakwe|boba|thai tea|es kopi|kopi susu|es campur|es buah|warung sate|nasi (campur|rames|ayam|bebek|liwet)|ayam (goreng|bakar) (kfc|mcd|geprek)|street food/i,
    candidates: ['makan beli & jajan', 'makan beli', 'jajan', 'makan di luar'],
  },
  {
    re: /popok|diapers|pampers|mamypoko|merries|sweety|baby ha(p)?py|empeng|dot bayi|susu formula|chil ?go|chil ?kid|dancow|bebelac|\bsgm\b|mainan|tisu basah bayi|bedak bayi|minyak telon/i,
    candidates: ['bayi & anak', 'bayi', 'anak'],
  },
  {
    re: /skincare|serum|toner|sunscreen|lipstik|lipstick|maskara|emina|wardah|make ?up|kosmetik|facial wash/i,
    candidates: ['kebutuhan istri', 'perawatan diri', 'kecantikan'],
  },
  {
    re: /\bvps\b|hosting|domain|\bserver\b|openai|chatgpt|gemini pro|codebuddy|tokenomix|api key|akun ai|token ai/i,
    candidates: ['usaha sampingan', 'usaha', 'side income'],
  },
  {
    re: /orang ?tua|\bortu\b|mertua|\badi(k|e)k?\b|\badek\b|ponakan|keponakan/i,
    candidates: ['keluarga besar'],
  },
]

export function specialCategory(name: string, categories: ExpenseCategory[]): string | undefined {
  for (const r of SPECIAL_RULES) {
    if (!r.re.test(name)) continue
    for (const cand of r.candidates) {
      const hit = categories.find((c) => normText(c.name) === cand || c.aliases.some((a) => normText(a) === cand))
      if (hit) return hit.name
    }
  }
  return undefined
}

export function ruleGroup(name: string): ProductGroup | undefined {
  return KEYWORD_RULES.find((r) => r.re.test(name))?.group
}

export function findCategory(query: string, categories: ExpenseCategory[]): string | undefined {
  const q = normText(query)
  if (!q) return undefined
  const exact = categories.find((c) => normText(c.name) === q || c.aliases.some((a) => normText(a) === q))
  if (exact) return exact.name
  if (q.length < 4) return undefined
  // "Makanan & Minuman" → "Makanan", "Transportasi" → "Transport": nama household jadi awalan/bagian jawaban.
  const partial = categories.find((c) => {
    const n = normText(c.name)
    return n.length >= 4 && (q.startsWith(n) || q.includes(n) || n.startsWith(q))
  })
  return partial?.name
}

export function groupToCategory(group: ProductGroup, categories: ExpenseCategory[]): string | undefined {
  for (const cand of GROUP_CANDIDATES[group]) {
    const hit = findCategory(cand, categories)
    if (hit) return hit
  }
  return undefined
}

export function fallbackCategory(categories: ExpenseCategory[]): string {
  return findCategory('lainnya', categories) ?? categories[0]?.name ?? 'Lainnya'
}

/** Exact dulu; kalau tidak, keyword TERPANJANG (≥3 huruf) yang jadi bagian nama item. */
export function matchKeyword<T extends { keyword: string }>(name: string, entries: T[]): T | undefined {
  const n = normText(name)
  if (!n) return undefined
  const exact = entries.find((e) => e.keyword === n)
  if (exact) return exact
  let best: T | undefined
  for (const e of entries) {
    if (e.keyword.length >= 3 && n.includes(e.keyword) && (!best || e.keyword.length > best.keyword.length)) best = e
  }
  return best
}

export function classifySync(name: string, aiCategory: unknown, ctx: ClassifyContext): Classified | null {
  const learned = matchKeyword(name, ctx.learned)
  if (learned) return { category: learned.category, source: 'learned' }

  const special = specialCategory(name, ctx.categories)
  if (typeof aiCategory === 'string') {
    const ai = findCategory(aiCategory, ctx.categories)
    // Agent sering menjatuhkan semua makanan ke kategori makanan umum; kalau household punya kategori yang lebih
    // spesifik dan namanya jelas cocok (sempol → "Makan Beli & Jajan"), yang spesifik menang. Jawaban AI lain tetap dihormati.
    if (ai && special && ai !== special && ai === groupToCategory('food', ctx.categories)) return { category: special, source: 'rule' }
    if (ai && normText(ai) !== 'lainnya') return { category: ai, source: 'ai' }
  }

  if (special) return { category: special, source: 'rule' }

  const known = matchKeyword(name, ctx.known)
  const rule = ruleGroup(name)
  // Hasil web "other" (tidak yakin) kalah dari regex kalau regex punya jawaban.
  if (known && (known.group !== 'other' || !rule)) {
    const cat = groupToCategory(known.group, ctx.categories)
    if (cat) return { category: cat, source: 'known' }
  }
  if (rule) {
    const cat = groupToCategory(rule, ctx.categories)
    if (cat) return { category: cat, source: 'rule' }
  }
  return null
}

/** Versi tanpa DB (AI + regex + Lainnya) — dipakai saat tidak ada konteks household. */
export function normalizeCategory(rawCategory: unknown, itemName: unknown, categories: ExpenseCategory[]): string {
  if (!categories.length) return typeof rawCategory === 'string' && rawCategory.trim() ? rawCategory : 'Lainnya'
  const name = typeof itemName === 'string' ? itemName : ''
  return classifySync(name, rawCategory, { categories, learned: [], known: [] })?.category ?? fallbackCategory(categories)
}

export function normalizeScanResult(raw: Record<string, unknown>, categories: ExpenseCategory[]): Record<string, unknown> {
  if (!Array.isArray(raw.items)) return raw
  const items = (raw.items as Array<Record<string, unknown>>).map((item) =>
    item && typeof item === 'object' ? { ...item, category: normalizeCategory(item.category, item.note, categories) } : item,
  )
  return { ...raw, items }
}

/** Note transaksi → keyword belajar: buang "[Toko]"/"[ref: …]" (dan format lama " — Toko") dari struk, serta "(titipan X)". */
export function keywordFromNote(note: unknown): string | null {
  if (typeof note !== 'string') return null
  const base = normText(parseReceiptNote(note).name.replace(/\s*\(titipan [^)]*\)\s*$/i, ''))
  if (base.length < 2 || base.length > 80) return null
  return base
}

// ── DB ─────────────────────────────────────────────────────────────────────

export async function loadExpenseCategories(tx: postgres.TransactionSql, householdId: string): Promise<ExpenseCategory[]> {
  const rows = await tx<{ name: string; aliases: string[] | null }[]>`
    select name, aliases from categories
    where household_id = ${householdId} and deleted_at is null and is_system = false
      and type in ('expense', 'both')
    order by sort_order, name
  `
  return rows.map((r) => ({ name: r.name, aliases: r.aliases ?? [] }))
}

export async function loadLearnedKeywords(tx: postgres.TransactionSql, householdId: string): Promise<LearnedKeyword[]> {
  return tx<LearnedKeyword[]>`
    select ck.keyword, c.name as category
    from category_keywords ck join categories c on c.id = ck.category_id
    where ck.household_id = ${householdId} and c.deleted_at is null
    order by keyword_source_rank(ck.source) desc, length(ck.keyword) desc
  `
}

export async function loadKnownProducts(tx: postgres.TransactionSql, names: string[]): Promise<KnownProduct[]> {
  const list = [...new Set(names.filter((n) => n.length >= 2))]
  if (!list.length) return []
  const rows = await tx<{ keyword: string; product_group: ProductGroup }[]>`
    select distinct pk.keyword, pk.product_group
    from unnest(${list}::text[]) n(name)
    join product_knowledge pk on n.name = pk.keyword or (length(pk.keyword) >= 3 and n.name like '%' || pk.keyword || '%')
  `
  return rows.map((r) => ({ keyword: r.keyword, group: r.product_group }))
}

/** Dipanggil setelah user MENGONFIRMASI kategori (simpan hasil scan di web, ubah kategori transaksi). */
export async function learnKeywords(tx: postgres.TransactionSql, householdId: string, pairs: Array<{ note: unknown; categoryId: string }>, source: 'user' | 'web' | 'ai' = 'user'): Promise<void> {
  if (!pairs.length) return
  // Kategori sistem (Piutang, Transfer, dll.) bukan sifat barang — "pulsa titipan Dedi" → Piutang
  // tidak boleh membuat "pulsa" dipelajari sebagai Piutang.
  const systemIds = new Set((await tx<{ id: string }[]>`select id from categories where household_id = ${householdId} and is_system = true`).map((r) => r.id))
  for (const p of pairs) {
    if (systemIds.has(p.categoryId)) continue
    const kw = keywordFromNote(p.note)
    if (!kw) continue
    await tx`select learn_category_keyword(${householdId}, ${kw}, ${p.categoryId}, ${source}::keyword_source)`
  }
}

/**
 * Klasifikasi sekumpulan item sekaligus. Transaksi DB dibuka pendek-pendek (baca konteks, lalu
 * simpan pengetahuan baru) supaya pencarian web yang lambat tidak menahan koneksi DB.
 */
export async function classifyItems(
  actor: Actor,
  items: Array<{ name: string; aiCategory?: unknown }>,
  opts: { webLookup?: boolean; maxWebLookups?: number } = {},
): Promise<Classified[]> {
  if (!items.length) return []
  const names = items.map((i) => normText(i.name))
  const ctx = await withActor(actor, async (tx) => ({
    categories: await loadExpenseCategories(tx, actor.householdId),
    learned: await loadLearnedKeywords(tx, actor.householdId),
    known: await loadKnownProducts(tx, names),
  }))
  const results: Array<Classified | null> = items.map((it, i) => classifySync(names[i]!, it.aiCategory, ctx))

  const unknown = results.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0)
  if (opts.webLookup && unknown.length) {
    const ai = await tryGetAiConfig(actor)
    if (ai) {
      const discovered = new Map<string, { group: ProductGroup; label: string; canonical: string | null; grounded: boolean }>()
      let budget = opts.maxWebLookups ?? MAX_WEB_LOOKUPS_PER_CALL
      for (const i of unknown) {
        const key = names[i]!
        if (key.length < 2 || discovered.has(key)) continue
        if (budget <= 0) break
        budget--
        const found = await lookupProduct(items[i]!.name, ai.provider!, ai.apiKey!)
        if (found) discovered.set(key, found)
      }
      for (const i of unknown) {
        const d = discovered.get(names[i]!)
        const cat = d ? groupToCategory(d.group, ctx.categories) : undefined
        if (cat) results[i] = { category: cat, source: 'web' }
      }
      if (discovered.size) {
        await withActor(actor, async (tx) => {
          for (const [keyword, d] of discovered) {
            await tx`select learn_product_knowledge(${keyword}, ${d.group}::product_group, ${d.label}, ${d.grounded ? 'web' : 'ai'}::keyword_source, ${d.canonical})`
          }
        })
      }
    }
  }

  const fallback = fallbackCategory(ctx.categories)
  return results.map((r) => r ?? { category: fallback, source: 'fallback' })
}

/**
 * Koreksi ringan untuk kategori yang dikirim AGENT (API key) di record_expense / record_expense_batch, yang tidak
 * lewat classifyItems. Hanya dua hal, keduanya sinyal yang lebih kuat dari tebakan agent:
 *   1. kata kunci yang pernah dikoreksi user (category_keywords) cocok dengan nama item;
 *   2. agent memilih kategori makanan umum tapi namanya jelas kategori household yang lebih spesifik (sempol → jajan).
 * Kategori sistem / non-makanan pilihan agent tidak diubah. Mengembalikan id kategori (bisa sama dengan masukan).
 */
export async function refineAgentCategory(tx: postgres.TransactionSql, householdId: string, note: string | undefined, categoryId: string): Promise<string> {
  const name = note ? parseReceiptNote(note).name : ''
  if (normText(name).length < 2) return categoryId
  const rows = await tx<{ id: string; name: string; aliases: string[] | null; is_system: boolean; type: string }[]>`
    select id, name, aliases, is_system, type::text from categories where household_id = ${householdId} and deleted_at is null
  `
  const current = rows.find((r) => r.id === categoryId)
  if (!current || current.is_system) return categoryId
  const cats = rows.filter((r) => !r.is_system && r.type !== 'income').map((r) => ({ name: r.name, aliases: r.aliases ?? [] }))
  const idOf = (n: string | undefined) => (n ? rows.find((r) => r.name === n)?.id : undefined)
  const learned = matchKeyword(name, await loadLearnedKeywords(tx, householdId))
  if (learned) return idOf(learned.category) ?? categoryId
  if (current.name === groupToCategory('food', cats)) {
    const special = specialCategory(name, cats)
    if (special) return idOf(special) ?? categoryId
  }
  return categoryId
}
