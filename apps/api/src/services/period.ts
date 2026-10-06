import { ApiError } from '@karaya/shared/errors'

export interface ResolvedPeriod {
  label: string
  from: string // YYYY-MM-DD, inklusif
  to: string // YYYY-MM-DD, inklusif
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function todayInTz(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function parts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number)
  return [y!, m!, d!]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fromUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = parts(dateStr)
  return fromUtcDate(new Date(Date.UTC(y, m - 1, d + days)))
}

function monthStart(year: number, month: number): string {
  return `${year}-${pad(month)}-01`
}

function monthEnd(year: number, month: number): string {
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  return fromUtcDate(new Date(Date.UTC(year, month, 0)))
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_ID[month - 1]} ${year}`
}

/** Senin pada atau sebelum dateStr (ISO: Minggu=0 -> dianggap hari ke-7). */
function mondayOf(dateStr: string): string {
  const [y, m, d] = parts(dateStr)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Minggu..6=Sabtu
  const diffToMonday = dow === 0 ? 6 : dow - 1
  return addDays(dateStr, -diffToMonday)
}

/**
 * Resolusi parameter `period` jadi rentang tanggal inklusif dalam zona waktu household
 * (05-api.md §2.4). Mendukung: today, yesterday, this_week, last_week, this_month, last_month,
 * this_year, last_year, YYYY-MM, YYYY, atau custom dengan from/to eksplisit.
 */
export function resolvePeriod(period: string, timezone: string, customFrom?: string, customTo?: string): ResolvedPeriod {
  const today = todayInTz(timezone)
  const [ty, tm] = parts(today)

  switch (period) {
    case 'custom': {
      if (!customFrom || !customTo) {
        throw ApiError.fromCode('invalid_period', { message: 'period=custom butuh from dan to.' })
      }
      if (customFrom > customTo) throw ApiError.fromCode('invalid_period', { message: 'from harus sebelum atau sama dengan to.' })
      return { label: 'Periode kustom', from: customFrom, to: customTo }
    }
    case 'today':
      return { label: 'Hari ini', from: today, to: today }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { label: 'Kemarin', from: y, to: y }
    }
    case 'this_week': {
      const from = mondayOf(today)
      return { label: 'Minggu ini', from, to: addDays(from, 6) }
    }
    case 'last_week': {
      const from = addDays(mondayOf(today), -7)
      return { label: 'Minggu lalu', from, to: addDays(from, 6) }
    }
    case 'this_month': {
      const from = monthStart(ty, tm)
      return { label: monthLabel(ty, tm), from, to: monthEnd(ty, tm) }
    }
    case 'last_month': {
      const lm = tm === 1 ? 12 : tm - 1
      const ly = tm === 1 ? ty - 1 : ty
      const from = monthStart(ly, lm)
      return { label: monthLabel(ly, lm), from, to: monthEnd(ly, lm) }
    }
    case 'this_year':
      return { label: String(ty), from: `${ty}-01-01`, to: `${ty}-12-31` }
    case 'last_year':
      return { label: String(ty - 1), from: `${ty - 1}-01-01`, to: `${ty - 1}-12-31` }
    default:
      break
  }

  const monthMatch = period.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    const y = Number(monthMatch[1])
    const m = Number(monthMatch[2])
    if (m < 1 || m > 12) throw ApiError.fromCode('invalid_period')
    return { label: monthLabel(y, m), from: monthStart(y, m), to: monthEnd(y, m) }
  }

  const yearMatch = period.match(/^(\d{4})$/)
  if (yearMatch) {
    const y = Number(yearMatch[1])
    return { label: String(y), from: `${y}-01-01`, to: `${y}-12-31` }
  }

  throw ApiError.fromCode('invalid_period', {
    message: `Periode "${period}" tidak dikenali.`,
  })
}
