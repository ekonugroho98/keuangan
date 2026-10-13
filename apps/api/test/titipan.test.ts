import { describe, expect, it } from 'vitest'
import { formatReceiptNote, parseReceiptNote } from '@karaya/shared/format'
import { borrowerFromText, detectTitipan, titipanDisplayName } from '../src/services/titipan'

describe('format note struk "[Toko] Nama item [ref: X]"', () => {
  it('formatReceiptNote menyusun prefix toko + suffix ref hanya kalau ada', () => {
    expect(formatReceiptNote('Indomie Goreng', 'Indomaret', 'TIPB123')).toBe('[Indomaret] Indomie Goreng [ref: TIPB123]')
    expect(formatReceiptNote('Indomie Goreng', 'Indomaret')).toBe('[Indomaret] Indomie Goreng')
    expect(formatReceiptNote(' Indomie Goreng ', '', null)).toBe('Indomie Goreng')
  })

  it('parseReceiptNote membaca format baru, format lama " — Toko", dan tanpa toko', () => {
    expect(parseReceiptNote('[Indomaret] Indomie Goreng [ref: TIPB123]')).toEqual({ merchant: 'Indomaret', name: 'Indomie Goreng', refNo: 'TIPB123' })
    expect(parseReceiptNote('Garam — Alfamart [ref: X1]')).toEqual({ merchant: 'Alfamart', name: 'Garam', refNo: 'X1' })
    expect(parseReceiptNote('Kopi pagi')).toEqual({ name: 'Kopi pagi' })
    expect(parseReceiptNote('[Toko Bu Siti] Telur 1kg')).toEqual({ merchant: 'Toko Bu Siti', name: 'Telur 1kg' })
  })
})

describe('titipan → Piutang', () => {
  it('field eksplisit menang, nama dirapikan', () => {
    expect(detectTitipan('Sabun Lifebuoy', 'bu ani')).toEqual({ borrower: 'Bu Ani' })
  })

  it('kata "titipan" di nama item dikenali; nama orang diambil sesudahnya', () => {
    expect(detectTitipan('Sabun titipan Ani')).toEqual({ borrower: 'Ani' })
    expect(detectTitipan('Pulsa 50rb titipan dari Bu Ani')).toEqual({ borrower: 'Bu Ani' })
    expect(detectTitipan('titipan Dedi: Indomie x2')).toEqual({ borrower: 'Dedi' })
    expect(detectTitipan('Minyak goreng (titipan mama)')).toEqual({ borrower: 'Mama' })
    expect(borrowerFromText('Beras titipan')).toBe('Titipan')
    expect(borrowerFromText('Beras titipan 2 pcs')).toBe('Titipan')
  })

  it('bukan titipan → null; display name menambah "(titipan X)" hanya kalau nama belum menyebutnya', () => {
    expect(detectTitipan('Sabun Lifebuoy')).toBeNull()
    expect(detectTitipan('', '')).toBeNull()
    expect(titipanDisplayName('Sabun', { borrower: 'Bu Ani' })).toBe('Sabun (titipan Bu Ani)')
    expect(titipanDisplayName('Sabun titipan Ani', { borrower: 'Ani' })).toBe('Sabun titipan Ani')
    expect(titipanDisplayName('Sabun', null)).toBe('Sabun')
  })
})
