import { describe, expect, it } from 'vitest'
import { AmountParseError, fmtRp, parseAmountId, toLocalDateStr } from '../src/format'

describe('parseAmountId', () => {
  it.each([
    ['45rb', 45_000],
    ['45 rb', 45_000],
    ['45k', 45_000],
    ['45.000', 45_000],
    ['45000', 45_000],
    ['1,2 juta', 1_200_000],
    ['1.2jt', 1_200_000],
    ['2 juta', 2_000_000],
    ['500 ribu', 500_000],
    ['Rp 45.000', 45_000],
    [45000, 45_000],
  ])('parses %s as %i', (input, expected) => {
    expect(parseAmountId(input as string | number)).toBe(expected)
  })

  it('throws AmountParseError on garbage input', () => {
    expect(() => parseAmountId('')).toThrow(AmountParseError)
    expect(() => parseAmountId('entahlah')).toThrow(AmountParseError)
  })
})

describe('fmtRp', () => {
  it('formats with thousands separators and Rp prefix', () => {
    expect(fmtRp(45000)).toBe('Rp 45.000')
    expect(fmtRp(1200000)).toBe('Rp 1.200.000')
  })
})

describe('toLocalDateStr', () => {
  it('formats as YYYY-MM-DD using local time, not UTC', () => {
    const d = new Date(2026, 9, 4) // 4 Oktober 2026 (bulan 0-indexed)
    expect(toLocalDateStr(d)).toBe('2026-10-04')
  })
})
