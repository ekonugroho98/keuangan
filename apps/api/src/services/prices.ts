import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { fmtRp, parseReceiptNote } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { buildTextRequest, callProviderJson, tryGetAiConfig } from './ai/provider'
import { normText, ruleGroup } from './categorize'
import { GROUP_LABEL_ID, PRODUCT_GROUPS, isProductGroup } from './product-groups'

/**
 * Perbandingan harga produk antar toko (migrasi 0025, 10-fitur-opsional-keluarga.md §6.8).
 *   - canonicalizeProducts: nama kasir → nama produk kanonik (AI BYOK, satu panggilan per struk, cache global
 *     product_knowledge.canonical_name). Best-effort: gagal/tanpa BYOK → riwayat tetap tercatat dengan nama dasar.
 *   - recordPrices / syncTransactionPrice: dipanggil DI DALAM transaksi ingest/batch/single/update → record_product_prices().
 *   - comparePrices / cheapestForNames: baca v_product_prices, kelompokkan per (produk, satuan), urutkan per satuan.
 */

const MAX_CANONICALIZE = 30
const DEFAULT_DAYS = 180

// ── Kanonikalisasi ──────────────────────────────────────────────────────────────────────────

function canonicalPrompt(names: string[], existing: string[]): string {
  const groups = PRODUCT_GROUPS.map((g) => `${g} (${GROUP_LABEL_ID[g]})`).join(', ')
  const known = existing.length
    ? `\nNama kanonik yang SUDAH ADA (pakai PERSIS salah satu ini kalau produknya sama, walau ukurannya beda):\n${existing.map((e) => `- ${e}`).join('\n')}\n`
    : ''
  return `Kamu menyeragamkan nama barang dari struk belanja Indonesia supaya barang yang sama dari toko berbeda bisa dibandingkan harganya.
Nama kasir sering disingkat ("LFBY BS 85G" = Lifebuoy sabun batang, "INDM GRG" = Indomie goreng, "BML MG 2L" = Bimoli minyak goreng).
${known}
Untuk TIAP nama di bawah, beri:
- canonical: merek + jenis produk + varian, huruf kecil, TANPA ukuran/berat/isi/jumlah (mis. "lifebuoy sabun batang total 10", "indomie goreng original", "bimoli minyak goreng"). Barang generik tanpa merek: jenisnya saja ("telur ayam", "beras"). null kalau tidak bisa dipastikan.
- group: salah satu dari ${groups}.

Nama:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Jawab HANYA JSON: {"items": [{"name": "<nama persis seperti di daftar>", "canonical": "...", "group": "..."}]}`
}

/** Pastikan tiap nama item punya canonical_name di gudang produk. Tidak pernah melempar error. */
export async function canonicalizeProducts(actor: Actor, names: string[], opts: { llm: boolean } = { llm: true }): Promise<void> {
  try {
    const clean = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))]
    if (!clean.length || !opts.llm) return
    const { missing, existing } = await withActor(actor, async (tx) => {
      const rows = await tx<{ name: string; keyword: string; canonical_name: string | null }[]>`
        select n as name, item_keyword(n) as keyword, pk.canonical_name
        from unnest(${clean}::text[]) as n
        left join product_knowledge pk on pk.keyword = item_keyword(n)
      `
      const missing = rows.filter((r) => !r.canonical_name && r.keyword.length >= 2).slice(0, MAX_CANONICALIZE)
      const existing = missing.length
        ? (
            await tx<{ canonical_name: string }[]>`
              select distinct pk.canonical_name from product_knowledge pk, unnest(${missing.map((m) => (m.keyword))}::text[]) as n
              where pk.canonical_name is not null and similarity(pk.canonical_name, n) > 0.2
              limit 60
            `
          ).map((r) => r.canonical_name)
        : []
      return { missing, existing }
    })
    if (!missing.length) return
    const ai = await tryGetAiConfig(actor)
    if (!ai) return
    const raw = await callProviderJson(buildTextRequest(ai.provider!, ai.apiKey!, canonicalPrompt(missing.map((m) => m.name), existing), 1500), ai.provider!, 25_000)
    const answers = Array.isArray(raw.items) ? (raw.items as Array<Record<string, unknown>>) : []
    const byName = new Map(answers.map((a) => [normText(String(a.name ?? '')), a]))
    await withActor(actor, async (tx) => {
      for (const [i, m] of missing.entries()) {
        const a = byName.get(normText(m.name)) ?? answers[i]
        const canonical = typeof a?.canonical === 'string' ? a.canonical.trim() : ''
        if (canonical.length < 2) continue
        const group = isProductGroup(a?.group) ? a.group : 'other'
        await tx`select learn_product_knowledge(${m.keyword}, ${group}::product_group, ${canonical}, 'ai'::keyword_source, ${canonical})`
      }
    })
  } catch (err) {
    console.warn('[prices] kanonikalisasi produk gagal (diabaikan):', err instanceof Error ? err.message : err)
  }
}

// ── Pencatatan ──────────────────────────────────────────────────────────────────────────────

export interface PriceItem {
  transaction_id: string | undefined
  name: string
  qty?: number
  amount: number
}

/** Nama item untuk riwayat harga: buang penanda titipan ("Sabun titipan Ani", "Sabun (titipan Ani)" → "Sabun"). */
export function priceItemName(name: string): string {
  return name.replace(/\s*\(?\btitipan\b.*$/i, '').trim() || name
}

export async function recordPrices(tx: postgres.TransactionSql, householdId: string, merchant: string | null | undefined, date: string, items: PriceItem[]): Promise<number> {
  const m = merchant?.trim()
  const valid = items.filter((i) => i.transaction_id && i.amount > 0)
  if (!m || !valid.length) return 0
  const payload = valid.map((i) => ({ transaction_id: i.transaction_id!, name: priceItemName(i.name), qty: i.qty ?? 1, amount: i.amount }))
  const [row] = await tx<{ n: number }[]>`select record_product_prices(${householdId}, ${m}, ${date}, ${tx.json(payload as unknown as postgres.JSONValue)}) as n`
  return row?.n ?? 0
}

/**
 * Sinkronkan 1 baris transaksi tunggal (createTransaction / updateTransaction) ke product_prices.
 * Bila di-edit (nominal/tanggal/note berubah), baris lama dihapus lalu dicatat ulang dengan mempertahankan qty sebelumnya.
 */
export async function syncTransactionPrice(
  tx: postgres.TransactionSql,
  householdId: string,
  txRow: { id: string; type: string; amount: number; date: string; note: string | null | undefined },
): Promise<void> {
  const [prev] = await tx<{ qty: string }[]>`select qty::text from product_prices where transaction_id = ${txRow.id}`
  await tx`delete from product_prices where transaction_id = ${txRow.id}`
  if (txRow.type !== 'expense' || !txRow.note || txRow.amount <= 0) return
  const parsed = parseReceiptNote(txRow.note)
  if (!parsed.merchant || !parsed.name) return
  const prevQty = prev ? Number(prev.qty) : 1
  await recordPrices(tx, householdId, parsed.merchant, txRow.date, [
    { transaction_id: txRow.id, name: parsed.name, qty: prevQty > 0 ? prevQty : 1, amount: txRow.amount },
  ])
}

// ── Perbandingan ────────────────────────────────────────────────────────────────────────────

export interface PriceObservation {
  product_name: string
  product_key: string
  keyword: string
  merchant: string
  merchant_key: string
  qty: number
  unit_price: number
  size_value: number | null
  size_unit: 'g' | 'ml' | 'pcs' | null
  price_per_unit: number | null
  date: string
}

export interface StorePrice {
  merchant: string
  last_date: string
  price: number
  size: string | null
  per_unit_price: number
  lowest_per_unit_price: number
  observations: number
}

export interface ProductComparison {
  product_name: string
  unit: 'g' | 'ml' | 'pcs' | null
  compare_basis: string
  stores: StorePrice[]
  cheapest: { merchant: string; per_unit_price: number; last_date: string } | null
  savings_pct: number | null
  summary: string
}

function basisFor(unit: PriceObservation['size_unit']): { label: string; factor: number } {
  if (unit === 'g') return { label: 'per 100 g', factor: 100 }
  if (unit === 'ml') return { label: 'per 100 ml', factor: 100 }
  if (unit === 'pcs') return { label: 'per pcs', factor: 1 }
  return { label: 'per kemasan', factor: 1 }
}

function sizeLabel(o: PriceObservation): string | null {
  if (!o.size_value || !o.size_unit) return null
  const v = Number(o.size_value)
  if (o.size_unit === 'g' && v >= 1000) return `${+(v / 1000).toFixed(2)} kg`
  if (o.size_unit === 'ml' && v >= 1000) return `${+(v / 1000).toFixed(2)} L`
  return `${+v.toFixed(2)} ${o.size_unit}`
}

function fmtDateId(d: string): string {
  const [, m, day] = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${Number(day)} ${months[Number(m) - 1] ?? m}`
}

/**
 * Observasi → perbandingan per (produk kanonik, satuan). Tiap toko diwakili harga TERAKHIR-nya
 * (paling relevan untuk keputusan belanja), dibandingkan per satuan dasar supaya beda ukuran kemasan adil.
 * Kelompok diurutkan dari yang paling banyak tokonya, selisih hemat terbesar, lalu jumlah observasinya. Pure — diuji unit.
 */
export function summarizeObservations(rows: PriceObservation[]): ProductComparison[] {
  const groups = new Map<string, PriceObservation[]>()
  for (const r of rows) {
    const key = `${r.product_key}|${r.size_unit ?? '-'}`
    const g = groups.get(key) ?? []
    g.push(r)
    groups.set(key, g)
  }
  const out: ProductComparison[] = []
  for (const obs of groups.values()) {
    obs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const unit = obs[0]!.size_unit
    const basis = basisFor(unit)
    const metric = (o: PriceObservation) => Math.round((unit && o.price_per_unit != null ? Number(o.price_per_unit) : Number(o.unit_price)) * basis.factor)
    const stores = new Map<string, StorePrice>()
    for (const o of obs) {
      const s = stores.get(o.merchant_key)
      if (!s) {
        stores.set(o.merchant_key, {
          merchant: o.merchant,
          last_date: o.date,
          price: Math.round(Number(o.unit_price)),
          size: sizeLabel(o),
          per_unit_price: metric(o),
          lowest_per_unit_price: metric(o),
          observations: 1,
        })
      } else {
        s.observations++
        s.lowest_per_unit_price = Math.min(s.lowest_per_unit_price, metric(o))
      }
    }
    const list = [...stores.values()].sort((a, b) => a.per_unit_price - b.per_unit_price)
    const cheapest = list[0] ? { merchant: list[0].merchant, per_unit_price: list[0].per_unit_price, last_date: list[0].last_date } : null
    const max = Math.max(...list.map((s) => s.per_unit_price))
    const savings = list.length > 1 && max > 0 ? Math.round(((max - list[0]!.per_unit_price) / max) * 100) : null
    const name = obs[0]!.product_name
    const parts = list.map((s) => `${s.merchant} ${fmtRp(s.per_unit_price)}/${basis.label.replace('per ', '')}${s.size ? ` (${s.size} ${fmtRp(s.price)})` : ''}, ${fmtDateId(s.last_date)}`)
    const summary =
      list.length > 1
        ? `${name}: termurah di ${list[0]!.merchant}. ${parts.join('; ')}.${savings ? ` Selisih ${savings}%.` : ''}`
        : `${name}: baru tercatat di ${parts[0]}. Belum ada pembanding dari toko lain.`
    out.push({ product_name: name, unit, compare_basis: basis.label, stores: list, cheapest, savings_pct: savings, summary })
  }
  return out.sort(
    (a, b) =>
      b.stores.length - a.stores.length ||
      (b.savings_pct ?? 0) - (a.savings_pct ?? 0) ||
      b.stores.reduce((s, x) => s + x.observations, 0) - a.stores.reduce((s, x) => s + x.observations, 0),
  )
}

const OBS_SELECT = `
  select product_name, product_key, keyword, merchant, merchant_key, qty::float as qty, unit_price::float as unit_price,
         size_value::float as size_value, size_unit, price_per_unit::float as price_per_unit, date::text as date
  from v_product_prices`

function sinceDate(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

function queryTokens(q: string): string[] {
  return normText(q).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((t) => t.length >= 2)
}

export async function comparePrices(actor: Actor, input: { q?: string; days?: number }): Promise<{ query: string; days: number; products: ProductComparison[] }> {
  const rawQ = (input.q ?? '').trim()
  const days = Math.min(Math.max(input.days ?? DEFAULT_DAYS, 1), 730)

  // Mode Katalog: bila q tidak diisi / kosong, kembalikan produk teratas yang tercatat di household
  // (diurutkan dari yang punya >1 toko & selisih hemat terbesar, lalu jumlah observasi terbanyak).
  if (!rawQ) {
    const rows = await withActor(actor, (tx) =>
      tx.unsafe<PriceObservation[]>(
        `${OBS_SELECT}
         where household_id = $1 and date >= $2
         order by date desc limit 1500`,
        [actor.householdId, sinceDate(days)],
      ),
    )
    return { query: '', days, products: summarizeObservations(rows).slice(0, 20) }
  }

  const tokens = queryTokens(rawQ)
  if (!tokens.length) throw ApiError.fromCode('validation_error', { message: 'q minimal 2 huruf.', details: { field: 'q' } })
  const patterns = tokens.map((t) => `%${t}%`)
  const qn = tokens.join(' ')
  const rows = await withActor(actor, (tx) =>
    tx.unsafe<PriceObservation[]>(
      `${OBS_SELECT}
       where household_id = $1 and date >= $2
         and (norm_text(product_name || ' ' || keyword) like all ($3::text[]) or similarity(product_name, $4) > 0.35)
       order by date desc limit 1000`,
      [actor.householdId, sinceDate(days), patterns, qn],
    ),
  )
  return { query: rawQ, days, products: summarizeObservations(rows).slice(0, 12) }
}

/** Untuk daftar belanja: nama item belanja → toko termurah (kelompok produk paling banyak datanya). */
export async function cheapestForNames(
  tx: postgres.TransactionSql,
  householdId: string,
  names: string[],
): Promise<Map<string, { merchant: string; price: number; size: string | null; per_unit_price: number; compare_basis: string; last_date: string; stores: number } | null>> {
  const out = new Map<string, { merchant: string; price: number; size: string | null; per_unit_price: number; compare_basis: string; last_date: string; stores: number } | null>()
  if (!names.length) return out
  const rows = await tx.unsafe<PriceObservation[]>(`${OBS_SELECT} where household_id = $1 and date >= $2 order by date desc limit 3000`, [householdId, sinceDate(DEFAULT_DAYS)])
  const hay = rows.map((r) => normText(`${r.product_name} ${r.keyword}`))
  for (const name of names) {
    const tokens = queryTokens(name)
    if (!tokens.length) { out.set(name, null); continue }
    // Nama daftar belanja sering punya kata tambahan ("sabun lifebuoy yang batang") — 3 kata atau lebih
    // boleh meleset satu kata; ambil tingkat kecocokan tertinggi yang ada.
    const hits = hay.map((h) => tokens.filter((t) => h.includes(t)).length)
    const need = tokens.length >= 3 ? tokens.length - 1 : tokens.length
    const top = Math.max(0, ...hits)
    const matched = top >= need ? rows.filter((_, i) => hits[i] === top) : []
    const best = summarizeObservations(matched)[0]
    const store = best?.stores[0]
    out.set(name, best && store ? { merchant: store.merchant, price: store.price, size: store.size, per_unit_price: store.per_unit_price, compare_basis: best.compare_basis, last_date: store.last_date, stores: best.stores.length } : null)
  }
  return out
}

/**
 * Koreksi manual: "item struk X itu produk Y" (per household di product_aliases, DAN ikut memperkaya
 * kamus global product_knowledge supaya keluarga lain yang menemukan singkatan struk serupa ikut terbantu).
 */
export async function setProductAlias(actor: Actor, input: { item: string; same_as: string }): Promise<{ keyword: string; canonical_name: string }> {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ keyword: string; canonical: string }[]>`select item_keyword(${input.item}) as keyword, left(norm_text(${input.same_as}), 120) as canonical`
    if (!row || row.keyword.length < 2 || row.canonical.length < 2) throw ApiError.fromCode('validation_error', { message: 'item dan same_as minimal 2 huruf.' })
    // same_as boleh nama item struk lain ("samakan LFBY BS 85G dengan LIFEBUOY SABUN 85GR"): pakai nama produk yang
    // sudah dipakai item itu, supaya keduanya bertemu di kunci yang sama.
    const [target] = await tx<{ product_name: string }[]>`
      select product_name from v_product_prices where household_id = ${actor.householdId} and keyword = item_keyword(${input.same_as}) limit 1
    `
    const canonical = target?.product_name ?? row.canonical
    await tx`
      insert into product_aliases (household_id, keyword, canonical_name) values (${actor.householdId}, ${row.keyword}, ${canonical})
      on conflict (household_id, keyword) do update set canonical_name = excluded.canonical_name
    `
    // Ikut perkaya product_knowledge lintas keluarga (source = 'user', rank tertinggi)
    const [existingPk] = await tx<{ product_group: string }[]>`
      select product_group::text from product_knowledge where keyword in (${row.keyword}, item_keyword(${input.same_as})) limit 1
    `
    const group = existingPk?.product_group ?? ruleGroup(canonical) ?? 'other'
    await tx`select learn_product_knowledge(${row.keyword}, ${group}::product_group, ${canonical}, 'user'::keyword_source, ${canonical})`
    return { keyword: row.keyword, canonical_name: canonical }
  })
}

