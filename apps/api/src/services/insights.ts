import { fmtRp, parseReceiptNote } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { normText } from './categorize'
import { getHouseholdTimezone } from './households'
import { addDays, resolvePeriod, todayInTz } from './period'
import { resolveAccountRef, resolveBeneficiaryRef, resolveCategoryRef } from './resolver'

/**
 * Analisa pengeluaran siap pakai untuk agent (tool `analyze_spending`, GET /v1/insights/spending).
 * Semua angka dihitung DI SINI — model bahasa (Hermes, bisa model kecil gratis) cukup bercerita dari hasilnya,
 * tidak menjumlah sendiri. `buildInsights` murni (tanpa DB) supaya bisa diuji unit.
 */

export interface InsightTx {
  id: string
  date: string
  amount: number
  note: string
  category: string
  category_system: boolean
  account: string
  account_owner: string | null
  beneficiary: string | null
  recorded_by: string
  qty?: number | null
  unit_price?: number | null
  discount?: number | null
  normal_unit_price?: number | null
}

export interface InsightsInput {
  period: { label: string; from: string; to: string }
  today: string
  rows: InsightTx[]
  previous: { from: string; to: string; total: number; count: number } | null
  budget: { amount: number; category: string | null } | null
  filter: Record<string, string>
}

const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MAX_TX_LIST = 80

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/** "Ayam masak (Ayam Merah)" → item "Ayam masak", tempat "Ayam Merah"; "[Toko] item" → tempat Toko. */
export function splitItem(note: string): { item: string; place: string | null } {
  const parsed = parseReceiptNote(note || '')
  let item = parsed.name.replace(/\s*\(titipan [^)]*\)\s*$/i, '').trim()
  let place = parsed.merchant ?? null
  const paren = item.match(/^(.*\S)\s*\(([^)]+)\)$/)
  if (paren && !place) {
    item = paren[1]!.trim()
    place = paren[2]!.trim()
  }
  return { item: item || '(tanpa keterangan)', place }
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}

function group<T>(rows: InsightTx[], keyOf: (r: InsightTx) => string | null, labelOf: (r: InsightTx) => T) {
  const m = new Map<string, { label: T; total: number; count: number }>()
  for (const r of rows) {
    const k = keyOf(r)
    if (k === null) continue
    const g = m.get(k) ?? { label: labelOf(r), total: 0, count: 0 }
    g.total += r.amount
    g.count++
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => b.total - a.total || b.count - a.count)
}

function fmtDay(date: string): string {
  const [, m, d] = date.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${Number(d)} ${months[Number(m) - 1]}`
}

// Jenis makanan siap santap — hanya dihitung kalau filter kategori adalah kategori makan/jajan, supaya agent selalu punya
// rincian per jenis yang angkanya pasti (bukan menjumlah sendiri).
const KIND_RULES: Array<{ kind: string; re: RegExp }> = [
  { kind: 'Minuman & es', re: /\bes\b|\bjus\b|\bteh\b|kopi|le ?minerale|aqua|air mineral|\bsusu\b|boba|thai tea|minum|milk|yakult/i },
  { kind: 'Camilan', re: /gorengan|risol|takoyaki|takayaki|siomay|batagor|opak|sempol|cilok|cireng|cimol|kerupuk|\bkue\b|roti|martabak|dimsum|dim sum|cakwe|pempek|snack|keripik|cemilan|camilan/i },
]
export function kindOf(item: string): string {
  return KIND_RULES.find((r) => r.re.test(item))?.kind ?? 'Makan berat'
}

export function buildInsights(input: InsightsInput) {
  const { rows, period, today } = input
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const count = rows.length
  const totalDiscount = rows.reduce((s, r) => s + Math.max(0, Number(r.discount ?? 0)), 0)
  const discountedCount = rows.filter((r) => Number(r.discount ?? 0) > 0).length
  // Hari berjalan: periode yang masih berlangsung dihitung sampai hari ini, bukan sampai akhir periode.
  const effectiveTo = today < period.to && today >= period.from ? today : period.to
  const daysElapsed = Math.max(1, daysBetween(period.from, effectiveTo))
  const daysInPeriod = daysBetween(period.from, period.to)
  const perDay = Math.round(total / daysElapsed)
  const ongoing = effectiveTo !== period.to
  const projected = ongoing ? Math.round((total / daysElapsed) * daysInPeriod) : total

  const byCategory = group(rows, (r) => r.category, (r) => r.category).map((g) => ({ category: g.label, total: g.total, count: g.count, pct: pct(g.total, total) }))
  const byAccount = group(rows, (r) => r.account, (r) => ({ account: r.account, owner: r.account_owner })).map((g) => ({ ...g.label, total: g.total, count: g.count, pct: pct(g.total, total) }))
  const byOwner = group(rows, (r) => r.account_owner ?? '(bersama)', (r) => r.account_owner ?? '(bersama)').map((g) => ({ owner: g.label, total: g.total, count: g.count, pct: pct(g.total, total) }))
  const byBeneficiary = group(rows, (r) => r.beneficiary, (r) => r.beneficiary!).map((g) => ({ beneficiary: g.label, total: g.total, count: g.count }))

  // Kunci = item + tempat: "Bakso" (tanpa tempat) dan "Bakso (Bakso Mas Boy)" adalah dua baris berbeda supaya agent
  // tidak menyimpulkan "Bakso Mas Boy 2x". Item yang sama di banyak tempat terlihat dari `item` yang berulang.
  const items = new Map<string, { item: string; total: number; count: number; places: Set<string>; dates: string[] }>()
  const places = new Map<string, { place: string; total: number; count: number; discount_total: number; discount_count: number }>()
  for (const r of rows) {
    const { item, place } = splitItem(r.note)
    const k = `${normText(item)}|${place ? normText(place) : ''}`
    const g = items.get(k) ?? { item, total: 0, count: 0, places: new Set<string>(), dates: [] }
    g.total += r.amount
    g.count++
    g.dates.push(r.date)
    if (place) g.places.add(place)
    items.set(k, g)
    if (place) {
      const pk = normText(place)
      const p = places.get(pk) ?? { place, total: 0, count: 0, discount_total: 0, discount_count: 0 }
      p.total += r.amount
      p.count++
      const disc = Math.max(0, Number(r.discount ?? 0))
      if (disc > 0) {
        p.discount_total += disc
        p.discount_count++
      }
      places.set(pk, p)
    }
  }
  const topItems = [...items.values()]
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, 15)
    .map((g) => ({ item: g.item, place: [...g.places][0] ?? null, label: g.places.size ? `${g.item} (${[...g.places][0]})` : g.item, total: g.total, count: g.count, avg: Math.round(g.total / g.count), dates: g.dates.sort() }))
  const repeated = topItems.filter((i) => i.count > 1).map((i) => ({ item: i.label, count: i.count, total: i.total }))
  const topPlaces = [...places.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((p) => ({
      place: p.place,
      total: p.total,
      count: p.count,
      ...(p.discount_total > 0 ? { discount_total: p.discount_total, discount_count: p.discount_count } : {}),
    }))

  const days = new Map<string, { date: string; total: number; count: number; items: string[] }>()
  for (const r of rows) {
    const d = days.get(r.date) ?? { date: r.date, total: 0, count: 0, items: [] }
    d.total += r.amount
    d.count++
    d.items.push(`${splitItem(r.note).item} ${fmtRp(r.amount)}`)
    days.set(r.date, d)
  }
  const activeDays = days.size
  const topDays = [...days.values()].sort((a, b) => b.total - a.total).slice(0, 3).map((d) => ({ ...d, weekday: WEEKDAYS[weekday(d.date)] }))

  const byWeekday = WEEKDAYS.map((name, i) => {
    const rs = rows.filter((r) => weekday(r.date) === i)
    return { weekday: name, total: rs.reduce((s, r) => s + r.amount, 0), count: rs.length }
  })
  const weekendRows = rows.filter((r) => [0, 6].includes(weekday(r.date)))
  const weekend = weekendRows.reduce((s, r) => s + r.amount, 0)
  const weekendDays = [...days.keys()].filter((d) => [0, 6].includes(weekday(d))).length
  const weekdayDays = activeDays - weekendDays
  const weekSplit = {
    weekday_total: total - weekend,
    weekend_total: weekend,
    weekday_avg_per_active_day: weekdayDays ? Math.round((total - weekend) / weekdayDays) : 0,
    weekend_avg_per_active_day: weekendDays ? Math.round(weekend / weekendDays) : 0,
  }

  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5).map((r) => ({ date: r.date, amount: r.amount, note: r.note, category: r.category, account: r.account }))
  const avgTx = count ? Math.round(total / count) : 0

  const byKind = input.filter.category && /makan|jajan|kuliner/i.test(input.filter.category) && count
    ? (['Makan berat', 'Camilan', 'Minuman & es'] as const)
        .map((kind) => {
          const rs = rows.filter((r) => kindOf(splitItem(r.note).item) === kind)
          return { kind, total: rs.reduce((a, r) => a + r.amount, 0), count: rs.length, items: rs.map((r) => `${splitItem(r.note).item} ${fmtRp(r.amount)}`) }
        })
        .filter((k) => k.count > 0)
    : undefined
  const prev = input.previous
  const comparison = prev
    ? { available: prev.count > 0, from: prev.from, to: prev.to, total: prev.total, count: prev.count, change: total - prev.total, change_pct: prev.total > 0 ? Math.round(((total - prev.total) / prev.total) * 1000) / 10 : null }
    : null

  let budget = null as null | { amount: number; spent: number; remaining: number; pct: number; projected_pct: number; daily_allowance_left: number | null; cut_per_day_needed: number; status: string }
  if (input.budget) {
    const b = input.budget.amount
    const daysLeft = ongoing ? daysInPeriod - daysElapsed : 0
    const remaining = b - total
    budget = {
      amount: b,
      spent: total,
      remaining,
      pct: pct(total, b),
      projected_pct: pct(projected, b),
      daily_allowance_left: daysLeft > 0 ? Math.max(0, Math.round(remaining / daysLeft)) : null,
      // Berapa rata-rata harian harus turun supaya pas budget di akhir periode (0 = laju sekarang sudah aman).
      cut_per_day_needed: daysLeft > 0 ? Math.max(0, perDay - Math.max(0, Math.round(remaining / daysLeft))) : 0,
      status: total >= b ? 'over' : projected > b ? 'akan_lewat' : 'aman',
    }
  }

  // Ringkasan siap kirim — fakta saja, tanpa saran (saran disusun agent dari angka di atas).
  const parts: string[] = []
  const scope = input.filter.category ?? 'Semua pengeluaran'
  parts.push(`${scope} ${period.label}${ongoing ? ` (s.d. ${fmtDay(effectiveTo)})` : ''}: ${fmtRp(total)} dari ${count} transaksi, rata-rata ${fmtRp(perDay)}/hari.`)
  if (ongoing) parts.push(`Laju ini ≈ ${fmtRp(projected)} untuk satu periode penuh.`)
  if (totalDiscount > 0) {
    const topDiscPlace = [...places.values()].sort((a, b) => b.discount_total - a.discount_total)[0]
    parts.push(`Total hemat dari diskon: ${fmtRp(totalDiscount)} (${discountedCount} item${topDiscPlace && topDiscPlace.discount_total > 0 ? `, terbanyak di ${topDiscPlace.place} ${fmtRp(topDiscPlace.discount_total)}` : ''}).`)
  }
  if (budget) parts.push(`Budget ${fmtRp(budget.amount)}: terpakai ${budget.pct}%, proyeksi ${budget.projected_pct}%${budget.daily_allowance_left !== null ? `, sisa jatah ${fmtRp(budget.daily_allowance_left)}/hari` : ''}${budget.cut_per_day_needed > 0 ? ` — supaya pas budget, rata-rata harian perlu turun ±${fmtRp(budget.cut_per_day_needed)}` : ''}.`)
  if (comparison && comparison.available && comparison.change_pct !== null) parts.push(`Dibanding periode sebelumnya (${fmtRp(comparison.total)}): ${comparison.change >= 0 ? 'naik' : 'turun'} ${Math.abs(comparison.change_pct)}%.`)
  if (topDays[0] && topDays[0].count > 1) parts.push(`Hari paling boros: ${topDays[0].weekday} ${fmtDay(topDays[0].date)} ${fmtRp(topDays[0].total)} (${topDays[0].count} transaksi).`)
  if (repeated.length) parts.push(`Berulang: ${repeated.slice(0, 4).map((r) => `${r.item} ${r.count}x`).join(', ')}.`)
  if (comparison && !comparison.available) parts.push('Belum ada data periode sebelumnya untuk dibandingkan.')
  if (byKind) parts.push(`Per jenis: ${byKind.map((k) => `${k.kind} ${fmtRp(k.total)} (${k.count}x)`).join(', ')}.`)

  return {
    period: { label: period.label, from: period.from, to: period.to, days_elapsed: daysElapsed, days_in_period: daysInPeriod, ongoing },
    filter: input.filter,
    totals: {
      total,
      count,
      per_day: perDay,
      avg_per_transaction: avgTx,
      active_days: activeDays,
      projected_period_total: projected,
      ...(totalDiscount > 0 ? { total_discount_saved: totalDiscount, discounted_items_count: discountedCount } : {}),
    },
    budget,
    comparison,
    by_category: input.filter.category ? undefined : byCategory,
    by_account: byAccount,
    by_owner: byOwner,
    by_beneficiary: byBeneficiary,
    by_kind: byKind,
    top_items: topItems,
    top_places: topPlaces,
    top_days: topDays,
    by_weekday: byWeekday,
    week_split: weekSplit,
    largest,
    transactions: count <= MAX_TX_LIST
      ? [...rows]
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map((r) => ({
            date: r.date,
            amount: r.amount,
            note: r.note,
            category: r.category,
            account: r.account,
            beneficiary: r.beneficiary,
            ...(r.qty != null ? { qty: r.qty, unit_price: r.unit_price } : {}),
            ...(r.discount && r.discount > 0 ? { discount: r.discount, normal_unit_price: r.normal_unit_price } : {}),
          }))
      : undefined,
    transactions_omitted: count > MAX_TX_LIST ? count : 0,
    text_id: parts.join(' '),
  }
}

export interface AnalyzeSpendingInput {
  period?: string
  from?: string
  to?: string
  category?: string
  account?: string
  beneficiary?: string
  q?: string
  compare?: boolean
}

export async function analyzeSpending(actor: Actor, input: AnalyzeSpendingInput) {
  const timezone = await getHouseholdTimezone(actor)
  const period = input.from && input.to ? resolvePeriod('custom', timezone, input.from, input.to) : resolvePeriod(input.period ?? 'this_month', timezone)
  const today = todayInTz(timezone)

  return withActor(actor, async (tx) => {
    const filter: Record<string, string> = {}
    let categoryId: string | null = null
    let categoryName: string | null = null
    if (input.category) {
      categoryId = await resolveCategoryRef(tx, actor, { category: input.category }, 'expense')
      const [c] = await tx<{ name: string }[]>`select name from categories where id = ${categoryId}`
      categoryName = c?.name ?? input.category
      filter.category = categoryName
    }
    const accountId = input.account ? await resolveAccountRef(tx, actor, { account: input.account }) : null
    if (input.account) filter.account = input.account
    const beneficiaryId = input.beneficiary ? ((await resolveBeneficiaryRef(tx, actor, { beneficiary: input.beneficiary })) ?? null) : null
    if (input.beneficiary) filter.beneficiary = input.beneficiary
    const q = input.q?.trim() ? `%${normText(input.q)}%` : null
    if (q) filter.q = input.q!

    const where = (from: string, to: string) => tx`
      t.household_id = ${actor.householdId} and t.type = 'expense' and t.deleted_at is null
      and t.date between ${from} and ${to}
      and c.system_key is distinct from 'transfer'
      ${categoryId ? tx`and t.category_id = ${categoryId}` : tx`and c.system_key is distinct from 'piutang'`}
      ${accountId ? tx`and t.account_id = ${accountId}` : tx``}
      ${beneficiaryId ? tx`and t.beneficiary_id = ${beneficiaryId}` : tx``}
      ${q ? tx`and norm_text(t.note) like ${q}` : tx``}
    `
    const raw = await tx<Array<Omit<InsightTx, 'amount' | 'qty' | 'unit_price' | 'discount' | 'normal_unit_price'> & { amount: string; qty: string | null; unit_price: string | null; discount: string | null; normal_unit_price: string | null }>>`
      select t.id, t.date::text as date, t.amount::text as amount, coalesce(t.note, '') as note,
             c.name as category, c.is_system as category_system,
             a.name as account, am.display_name as account_owner,
             coalesce(bm.display_name, b.name) as beneficiary, rm.display_name as recorded_by,
             pp.qty::text as qty, pp.unit_price::text as unit_price,
             pp.discount::text as discount, round((pp.amount + pp.discount)::numeric / pp.qty, 2)::text as normal_unit_price
      from transactions t
      join categories c on c.id = t.category_id
      join accounts a on a.id = t.account_id
      left join household_members am on am.id = a.owner_member_id
      left join beneficiaries b on b.id = t.beneficiary_id
      left join household_members bm on bm.id = b.member_id
      join household_members rm on rm.id = t.recorded_by_member_id
      left join product_prices pp on pp.transaction_id = t.id
      where ${where(period.from, period.to)}
      order by t.date, t.created_at
    `
    const rows: InsightTx[] = raw.map((r) => ({
      ...r,
      amount: Number(r.amount),
      qty: r.qty != null ? Number(r.qty) : null,
      unit_price: r.unit_price != null ? Math.round(Number(r.unit_price)) : null,
      discount: r.discount != null ? Math.round(Number(r.discount)) : null,
      normal_unit_price: r.normal_unit_price != null ? Math.round(Number(r.normal_unit_price)) : null,
    }))

    // Pembanding: periode sebelumnya dengan panjang SAMA dengan hari berjalan (like-for-like),
    // mis. 1–12 Okt dibanding 1–12 Sep, bukan dibanding September penuh.
    let previous: InsightsInput['previous'] = null
    if (input.compare !== false) {
      const effectiveTo = today < period.to && today >= period.from ? today : period.to
      const len = daysBetween(period.from, effectiveTo)
      const isMonth = /^\d{4}-\d{2}-01$/.test(period.from)
      let pFrom: string
      let pTo: string
      if (isMonth) {
        const [y, m] = period.from.split('-').map(Number) as [number, number]
        const py = m === 1 ? y - 1 : y
        const pm = m === 1 ? 12 : m - 1
        pFrom = `${py}-${String(pm).padStart(2, '0')}-01`
        pTo = addDays(pFrom, len - 1)
        const pEnd = addDays(period.from, -1)
        if (pTo > pEnd) pTo = pEnd
      } else {
        pTo = addDays(period.from, -1)
        pFrom = addDays(pTo, -(len - 1))
      }
      const [agg] = await tx<{ total: string; count: string }[]>`
        select coalesce(sum(t.amount), 0)::text as total, count(*)::text as count
        from transactions t join categories c on c.id = t.category_id
        where ${where(pFrom, pTo)}
      `
      previous = { from: pFrom, to: pTo, total: Number(agg!.total), count: Number(agg!.count) }
    }

    let budget: InsightsInput['budget'] = null
    const monthStart = period.from.slice(0, 8) + '01'
    const singleMonth = period.from === monthStart && period.to.slice(0, 7) === period.from.slice(0, 7)
    if (singleMonth && categoryId && !accountId && !beneficiaryId && !q) {
      const [b] = await tx<{ amount: string }[]>`select amount::text from budgets where household_id = ${actor.householdId} and category_id = ${categoryId} and member_id is null and period_start = ${monthStart} and deleted_at is null`
      if (b) budget = { amount: Number(b.amount), category: categoryName }
    }
    const result = buildInsights({ period, today, rows, previous, budget, filter })
    // Tanpa filter: status budget per kategori (bukan total semua pengeluaran vs jumlah budget — kategori tanpa
    // budget seperti sewa/sekolah akan membuatnya menyesatkan).
    const budgets = singleMonth && !categoryId && !accountId && !beneficiaryId && !q
      ? (await tx<{ category: string; amount: string; spent: string }[]>`
          select c.name as category, b.amount::text,
            coalesce((select sum(t.amount) from transactions t where t.household_id = b.household_id and t.type = 'expense'
              and t.deleted_at is null and t.category_id = b.category_id and t.date between ${period.from} and ${period.to}), 0)::text as spent
          from budgets b join categories c on c.id = b.category_id
          where b.household_id = ${actor.householdId} and b.member_id is null and b.period_start = ${monthStart} and b.deleted_at is null
          order by c.sort_order`).map((r) => {
          const amount = Number(r.amount)
          const spent = Number(r.spent)
          const projected = result.period.ongoing ? Math.round((spent / result.period.days_elapsed) * result.period.days_in_period) : spent
          return { category: r.category, amount, spent, pct: amount ? Math.round((spent / amount) * 1000) / 10 : 0, projected_pct: amount ? Math.round((projected / amount) * 1000) / 10 : 0 }
        })
      : undefined
    return { ...result, budgets }
  })
}
