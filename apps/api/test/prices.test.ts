import { describe, expect, it } from 'vitest'
import { priceItemName, summarizeObservations, type PriceObservation } from '../src/services/prices'

const obs = (o: Partial<PriceObservation>): PriceObservation => ({
  product_name: 'lifebuoy sabun batang',
  product_key: 'batang lifebuoy sabun',
  keyword: 'x',
  merchant: 'Indomaret',
  merchant_key: 'indomaret',
  qty: 1,
  unit_price: 4500,
  size_value: 85,
  size_unit: 'g',
  price_per_unit: 4500 / 85,
  date: '2026-10-01',
  ...o,
})

describe('summarizeObservations', () => {
  it('membandingkan per 100 g walau ukuran kemasan beda; harga terakhir per toko yang dipakai', () => {
    const [p] = summarizeObservations([
      obs({ merchant: 'Indomaret Jatikramat', merchant_key: 'indomaret', unit_price: 4500, size_value: 85, price_per_unit: 4500 / 85, date: '2026-10-10' }),
      obs({ merchant: 'Indomaret', merchant_key: 'indomaret', unit_price: 4000, size_value: 85, price_per_unit: 4000 / 85, date: '2026-09-01' }),
      obs({ merchant: 'Alfamart', merchant_key: 'alfamart', unit_price: 5200, size_value: 110, price_per_unit: 5200 / 110, date: '2026-10-05' }),
    ])
    expect(p!.compare_basis).toBe('per 100 g')
    expect(p!.stores.map((s) => s.merchant)).toEqual(['Alfamart', 'Indomaret Jatikramat'])
    expect(p!.stores[0]).toMatchObject({ per_unit_price: 4727, price: 5200, size: '110 g', observations: 1 })
    expect(p!.stores[1]).toMatchObject({ per_unit_price: 5294, lowest_per_unit_price: 4706, observations: 2 })
    expect(p!.cheapest).toMatchObject({ merchant: 'Alfamart' })
    expect(p!.savings_pct).toBe(11)
    expect(p!.summary).toContain('termurah di Alfamart')
  })

  it('satuan berbeda (g vs tanpa ukuran) tidak dicampur; satu toko saja → tanpa savings', () => {
    const out = summarizeObservations([
      obs({}),
      obs({ size_value: null, size_unit: null, price_per_unit: null, merchant: 'Warung', merchant_key: 'warung' }),
    ])
    expect(out).toHaveLength(2)
    expect(out.find((p) => p.unit === null)!.compare_basis).toBe('per kemasan')
    expect(out[0]!.savings_pct).toBeNull()
    expect(out[0]!.summary).toContain('Belum ada pembanding')
  })

  it('ukuran besar ditampilkan kg/L', () => {
    const [p] = summarizeObservations([obs({ size_value: 2000, size_unit: 'ml', unit_price: 38000, price_per_unit: 19, product_key: 'minyak' })])
    expect(p!.stores[0]!.size).toBe('2 L')
    expect(p!.stores[0]!.per_unit_price).toBe(1900)
  })
})

describe('priceItemName', () => {
  it('membuang penanda titipan', () => {
    expect(priceItemName('Sabun titipan Ani')).toBe('Sabun')
    expect(priceItemName('Sabun (titipan Bu Ani)')).toBe('Sabun')
    expect(priceItemName('Indomie Goreng')).toBe('Indomie Goreng')
  })
})
