import { fmtRp } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { getSummary } from './summary'

/**
 * F-B (10-fitur-opsional-keluarga.md §4.3). SELALU tersedia (bukan di-gate feature flag — flag
 * `monthly_report` hanya mengatur PENGIRIMAN terjadwal oleh Hermes, bukan endpoint ini). Semua
 * angka totals/top_categories/by_member/by_beneficiary/budgets/goals/debts dihitung lewat
 * `getSummary` yang SAMA dengan `/v1/summary` — dijamin identik by construction (bukan dihitung
 * ulang dengan query paralel yang bisa diverifikasi tapi tidak tersinkron), sesuai kriteria
 * selesai spec §8 (`diff` totals.expense antara kedua endpoint harus 0).
 */
export async function getMonthlyReport(actor: Actor, opts: { month?: string }) {
  // period.ts mendukung 'last_month' dan 'YYYY-MM' langsung (05-api.md §2.4) — tidak perlu hitung
  // "bulan sebelumnya" manual di sini.
  const period = opts.month ?? 'last_month'
  const summary = await getSummary(actor, { period, scope: 'household', attribution: 'owner', compare: true })

  // Query tambahan (piutang/hutang/saldo/transaksi terbesar) dibuka SETELAH getSummary selesai —
  // dua transaksi terpisah, dan TIDAK ada pemanggilan withActor lain di dalam blok ini (review
  // 2026-10-07: getHouseholdTimezone di dalam withActor = koneksi kedua dari pool per request).
  // Konsekuensi yang diterima: angka summary vs daftar piutang bukan satu snapshot (selisih hanya
  // kalau ada tulisan tepat di antara keduanya, dan laporan bulanan toh dikirim sekali sebulan).
  return withActor(actor, async (tx) => {
    const piutangRows = await tx<{ id: string; borrower_name: string; remaining: string; created_at: string }[]>`
      select id, borrower_name, remaining::text, created_at::text
      from v_piutang where household_id = ${actor.householdId} and deleted_at is null and remaining > 0
      order by created_at
    `
    const todayMs = Date.now()
    const piutangOpen = piutangRows.map((r) => ({
      id: r.id, borrower_name: r.borrower_name, remaining: Number(r.remaining),
      days_open: Math.floor((todayMs - new Date(r.created_at).getTime()) / 86_400_000),
    }))

    const debtsRows = await tx<{ id: string; name: string; remaining: string; due_date: string | null }[]>`
      select id, name, remaining::text, due_date::text from v_debts
      where household_id = ${actor.householdId} and deleted_at is null and remaining > 0
        and due_date is not null and due_date <= (current_date + interval '14 days')
      order by due_date
    `
    const debtsDueSoon = debtsRows.map((r) => ({ id: r.id, name: r.name, remaining: Number(r.remaining), due_date: r.due_date }))

    const accountRows = await tx<{ name: string; balance: string | null }[]>`
      select a.name, v.balance::text from accounts a join v_account_balances v on v.account_id = a.id
      where a.household_id = ${actor.householdId} and a.deleted_at is null order by a.sort_order, a.name
    `
    const accounts = accountRows.map((r) => ({ name: r.name, balance: r.balance === null ? null : Number(r.balance) }))

    const largestRows = await tx<{ date: string; note: string; amount: string }[]>`
      select t.date::text as date, t.note, t.amount::text as amount from transactions t
      join categories c on c.id = t.category_id
      where t.household_id = ${actor.householdId} and t.deleted_at is null and t.type = 'expense'
        and c.system_key is distinct from 'piutang'
        and t.date between ${summary.period.from} and ${summary.period.to}
      order by t.amount desc limit 5
    `
    const largestTransactions = largestRows.map((r) => ({ date: r.date, note: r.note, amount: Number(r.amount) }))

    const textId = buildTextId({ label: summary.period.label, totals: summary.totals, topCategories: summary.top_categories, piutangOpen, debtsDueSoon })

    return {
      period: { month: period === 'last_month' ? inferMonthLabel(summary.period.from) : period, label: summary.period.label, from: summary.period.from, to: summary.period.to },
      totals: { ...summary.totals, vs_prev: summary.compare ? { income_pct: summary.compare.income_delta_pct, expense_pct: summary.compare.expense_delta_pct } : { income_pct: null, expense_pct: null } },
      top_categories: summary.top_categories,
      by_member: summary.by_member,
      ...(summary.by_beneficiary ? { by_beneficiary: summary.by_beneficiary } : {}),
      budgets: summary.budgets,
      piutang_open: piutangOpen,
      debts_due_soon: debtsDueSoon,
      goals: summary.goals,
      accounts,
      largest_transactions: largestTransactions,
      text_id: textId,
    }
  })
}

function inferMonthLabel(fromDate: string): string {
  return fromDate.slice(0, 7)
}

function buildTextId(input: {
  label: string
  totals: { income: number; expense: number; net: number; saving_rate_pct: number }
  topCategories: { category: string; spent: number; pct: number }[]
  piutangOpen: { borrower_name: string; remaining: number }[]
  debtsDueSoon: { name: string; remaining: number; due_date: string | null }[]
}): string {
  const lines: string[] = []
  lines.push(`📊 ${input.label}`)
  lines.push(
    `Masuk ${fmtRp(input.totals.income)} · Keluar ${fmtRp(input.totals.expense)} · ` +
      `Bersih ${input.totals.net >= 0 ? '+' : ''}${fmtRp(input.totals.net)} (${input.totals.saving_rate_pct}% ditabung)`,
  )
  if (input.topCategories.length > 0) {
    const top3 = input.topCategories.slice(0, 3).map((c) => `${c.category} ${fmtRp(c.spent)}`).join(', ')
    lines.push(`Terbesar: ${top3}`)
  }
  if (input.piutangOpen.length > 0) {
    const sum = input.piutangOpen.reduce((s, p) => s + p.remaining, 0)
    lines.push(`🤝 Piutang belum lunas: ${input.piutangOpen.length} orang, total ${fmtRp(sum)}`)
  }
  if (input.debtsDueSoon.length > 0) {
    lines.push(`📋 ${input.debtsDueSoon.length} hutang jatuh tempo ≤14 hari`)
  }
  return lines.join('\n')
}
