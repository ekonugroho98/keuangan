import { describe, expect, it } from 'vitest'
import { buildInsights, kindOf, splitItem, type InsightTx } from '../src/services/insights'

const tx = (date: string, amount: number, note: string, extra: Partial<InsightTx> = {}): InsightTx => ({
  id: `${date}-${note}`, date, amount, note, category: 'Makan Beli & Jajan', category_system: false,
  account: 'BCA', account_owner: 'Ayah', beneficiary: null, recorded_by: 'Ayah', ...extra,
})

describe('splitItem', () => {
  it('memisahkan item dan tempat dari "[Toko] item" dan "item (tempat)"', () => {
    expect(splitItem('[Toko Jihan] Garam')).toEqual({ item: 'Garam', place: 'Toko Jihan' })
    expect(splitItem('Ayam masak (Ayam Merah)')).toEqual({ item: 'Ayam masak', place: 'Ayam Merah' })
    expect(splitItem('Nasi goreng (titipan istri)')).toEqual({ item: 'Nasi goreng', place: null })
    expect(splitItem('Warteg')).toEqual({ item: 'Warteg', place: null })
  })
})

describe('buildInsights', () => {
  const rows = [
    tx('2026-10-01', 14000, 'Bakso'),
    tx('2026-10-07', 30000, 'Ayam masak (Ayam Merah)'),
    tx('2026-10-08', 25000, 'Ayam masak (Ayam Merah)'),
    tx('2026-10-09', 16000, 'Nasi uduk', { account: 'Kas Ibu', account_owner: 'Ibu' }),
    tx('2026-10-09', 29000, 'Warteg', { account: 'Kas Ibu', account_owner: 'Ibu' }),
    tx('2026-10-11', 40000, 'Bakso (Bakso Mas Boy)'),
  ]
  const r = buildInsights({
    period: { label: 'Oktober 2026', from: '2026-10-01', to: '2026-10-31' },
    today: '2026-10-12',
    rows,
    previous: { from: '2026-09-01', to: '2026-09-12', total: 100000, count: 5 },
    budget: { amount: 300000, category: 'Makan Beli & Jajan' },
    filter: { category: 'Makan Beli & Jajan' },
  })

  it('total, rata-rata per hari berjalan, proyeksi sebulan', () => {
    expect(r.totals).toMatchObject({ total: 154000, count: 6, per_day: 12833, active_days: 5, projected_period_total: 397833 })
    expect(r.period).toMatchObject({ days_elapsed: 12, days_in_period: 31, ongoing: true })
  })

  it('budget: persen, proyeksi, sisa jatah per hari, status', () => {
    expect(r.budget).toMatchObject({ amount: 300000, remaining: 146000, pct: 51.3, projected_pct: 132.6, daily_allowance_left: 7684, cut_per_day_needed: 5149, status: 'akan_lewat' })
    expect(r.text_id).toContain('rata-rata harian perlu turun ±Rp 5.149')
  })

  it('pembanding periode sebelumnya', () => {
    expect(r.comparison).toMatchObject({ available: true, change: 54000, change_pct: 54 })
  })

  it('item berulang digabung lintas tempat, hari terboros, akhir pekan, per pemilik akun', () => {
    expect(r.top_items[0]).toMatchObject({ item: 'Ayam masak', place: 'Ayam Merah', label: 'Ayam masak (Ayam Merah)', count: 2, total: 55000 })
    // Bakso tanpa tempat dan Bakso Mas Boy TIDAK digabung (agent sempat menyimpulkan "Bakso Mas Boy 2x").
    expect(r.top_items.filter((i) => i.item === 'Bakso').map((i) => [i.label, i.count, i.total])).toEqual([['Bakso (Bakso Mas Boy)', 1, 40000], ['Bakso', 1, 14000]])
    expect(r.by_kind).toEqual([{ kind: 'Makan berat', total: 154000, count: 6, items: expect.any(Array) }])
    expect(r.top_days[0]).toMatchObject({ date: '2026-10-09', total: 45000, count: 2, weekday: 'Jumat' })
    expect(r.week_split).toMatchObject({ weekend_total: 40000, weekday_total: 114000 })
    expect(r.by_owner).toEqual([
      { owner: 'Ayah', total: 109000, count: 4, pct: 70.8 },
      { owner: 'Ibu', total: 45000, count: 2, pct: 29.2 },
    ])
    expect(r.by_category).toBeUndefined()
    expect(r.transactions).toHaveLength(6)
    expect(r.text_id).toContain('Rp 154.000 dari 6 transaksi')
    expect(r.text_id).toContain('naik 54%')
    expect(r.text_id).toContain('Berulang: Ayam masak (Ayam Merah) 2x.')
    expect(r.text_id).toContain('Per jenis: Makan berat Rp 154.000 (6x).')
  })

  it('periode selesai: tanpa proyeksi; kosong tidak error', () => {
    const done = buildInsights({ period: { label: 'September 2026', from: '2026-09-01', to: '2026-09-30' }, today: '2026-10-12', rows: [], previous: null, budget: null, filter: {} })
    expect(done.totals).toMatchObject({ total: 0, count: 0, per_day: 0, projected_period_total: 0 })
    expect(done.period.ongoing).toBe(false)
    expect(done.comparison).toBeNull()
    expect(done.by_kind).toBeUndefined()
  })

  it('pembanding tanpa data → available false + kalimat jujur', () => {
    const r2 = buildInsights({ period: { label: 'Oktober 2026', from: '2026-10-01', to: '2026-10-31' }, today: '2026-10-12', rows, previous: { from: '2026-09-01', to: '2026-09-12', total: 0, count: 0 }, budget: null, filter: {} })
    expect(r2.comparison).toMatchObject({ available: false })
    expect(r2.text_id).toContain('Belum ada data periode sebelumnya')
    expect(r2.by_kind).toBeUndefined()
  })

  it('kindOf: minuman, camilan, makan berat', () => {
    expect(['Es teh (Es Teh House)', 'Jus alpukat', 'Le Minerale 1 botol', 'Es krim Aus Ichi'].map(kindOf)).toEqual(Array(4).fill('Minuman & es'))
    expect(['Risol', 'Sempol', 'Gorengan', 'Opak', 'Siomay'].map(kindOf)).toEqual(Array(5).fill('Camilan'))
    expect(['Bakso', 'Warteg', 'Nasi uduk', 'Mie katsu Dicha', 'Ayam masak'].map(kindOf)).toEqual(Array(5).fill('Makan berat'))
  })
})
