import { describe, expect, it } from 'vitest'
import { parseDateCell, parseMoneyCell, parseStatementCsv } from '../src/services/reconciliation'

describe('Reconciliation CSV & cell parser (F-C)', () => {
  it('parseMoneyCell mengenali format Indonesia dan Internasional serta DB/CR', () => {
    expect(parseMoneyCell('150,000.00 DB')).toEqual({ amount: 150000, sign: 'out' })
    expect(parseMoneyCell('2.500.000,00 CR')).toEqual({ amount: 2500000, sign: 'in' })
    expect(parseMoneyCell('-45.000')).toEqual({ amount: 45000, sign: 'out' })
    expect(parseMoneyCell('+125000')).toEqual({ amount: 125000, sign: 'in' })
  })

  it('parseDateCell mengenali YYYY-MM-DD, DD/MM/YYYY, DD/MM (KlikBCA), dan DD MMM YYYY', () => {
    expect(parseDateCell('2026-10-15', 2026)).toBe('2026-10-15')
    expect(parseDateCell('15/10/2026', 2026)).toBe('2026-10-15')
    expect(parseDateCell('15/10', 2026)).toBe('2026-10-15')
    expect(parseDateCell('15 Okt 2026', 2026)).toBe('2026-10-15')
  })

  it('parseStatementCsv mengurai CSV gaya KlikBCA lengkap dengan header metadata dan ringkasan bawah', () => {
    const sampleBca = [
      'Informasi Rekening - Mutasi Rekening',
      'No. Rekening : 1234567890',
      'Periode : 01/10/2026 - 31/10/2026',
      'Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo',
      '05/10,"QRIS INDOMARET BELANJA DAPUR",0000,"68,500.00 DB","4,850,000.00"',
      '08/10,"TRSF E-BANKING CR GAJI BULANAN",0000,"8,500,000.00 CR","13,350,000.00"',
      'Saldo Awal : 4,918,500.00',
      'Mutasi Debet : 68,500.00',
      'Saldo Akhir : 13,350,000.00',
    ].join('\n')

    const parsed = parseStatementCsv(sampleBca, 'mutasi-bca-okt.csv')
    expect(parsed.source).toBe('bca_csv')
    expect(parsed.lines).toHaveLength(2)
    expect(parsed.lines[0]).toMatchObject({
      date: '2026-10-05',
      amount: 68500,
      direction: 'out',
      description: 'QRIS INDOMARET BELANJA DAPUR',
      balance_after: 4850000,
    })
    expect(parsed.lines[1]).toMatchObject({
      date: '2026-10-08',
      amount: 8500000,
      direction: 'in',
      description: 'TRSF E-BANKING CR GAJI BULANAN',
      balance_after: 13350000,
    })
  })

  it('parseStatementCsv mengurai CSV gaya BRImo / Mandiri dengan kolom Debet & Kredit terpisah', () => {
    const sampleBri = [
      'Tanggal;Uraian Transaksi;Debet;Kredit;Saldo',
      '10/10/2026;QRIS WARUNG SAYUR BU YANI;45.000,00;0;1.200.000,00',
      '12/10/2026;TRANSFER MASUK DARI SUAMI;0;500.000,00;1.700.000,00',
    ].join('\n')

    const parsed = parseStatementCsv(sampleBri, 'mutasi-bri.csv')
    expect(parsed.source).toBe('bri_csv')
    expect(parsed.lines).toHaveLength(2)
    expect(parsed.lines[0]).toMatchObject({
      date: '2026-10-10',
      amount: 45000,
      direction: 'out',
      balance_after: 1200000,
    })
    expect(parsed.lines[1]).toMatchObject({
      date: '2026-10-12',
      amount: 500000,
      direction: 'in',
      balance_after: 1700000,
    })
  })
})
