import { describe, expect, it } from 'vitest'
import { classifySync, groupToCategory, keywordFromNote, matchKeyword, normText, normalizeCategory, normalizeScanResult } from '../src/services/categorize'
import { parseDdgLite } from '../src/services/web-lookup'

const cats = [
  { name: 'Makanan', aliases: ['makan', 'jajan', 'sayur'] },
  { name: 'Transport', aliases: ['bensin', 'parkir'] },
  { name: 'Shopping', aliases: ['belanja'] },
  { name: 'Utilitas', aliases: ['pulsa', 'listrik'] },
  { name: 'Kesehatan', aliases: ['obat'] },
  { name: 'Lainnya', aliases: [] },
]
const ctx = { categories: cats, learned: [], known: [] }

describe('normalizeCategory (AI + regex + Lainnya, tanpa DB)', () => {
  it('nama persis (case-insensitive) dan alias → nama kanonik household', () => {
    expect(normalizeCategory('makanan', 'Indomie', cats)).toBe('Makanan')
    expect(normalizeCategory('belanja', 'Rinso', cats)).toBe('Shopping')
  })

  it('nama taksonomi lama/lain dipetakan ke nama household yang jadi bagiannya', () => {
    expect(normalizeCategory('Makanan & Minuman', 'Indomie', cats)).toBe('Makanan')
    expect(normalizeCategory('Transportasi', 'Parkir motor', cats)).toBe('Transport')
  })

  it('kategori tak dikenal atau kosong → tebak dari nama item, bukan jatuh ke Makanan', () => {
    expect(normalizeCategory('Tagihan', 'Token Listrik 50rb', cats)).toBe('Utilitas')
    expect(normalizeCategory('Rumah Tangga', 'Rinso Deterjen 800g', cats)).toBe('Shopping')
    expect(normalizeCategory(undefined, 'Paracetamol 500mg', cats)).toBe('Kesehatan')
    expect(normalizeCategory('', 'Telur ayam 1kg', cats)).toBe('Makanan')
  })

  it('tanpa petunjuk sama sekali → Lainnya; potongan nama pendek tidak dianggap cocok', () => {
    expect(normalizeCategory(undefined, 'Kantong plastik', cats)).toBe('Lainnya')
    expect(normalizeCategory('Hobi', 'Kantong plastik', cats)).toBe('Lainnya')
    expect(normalizeCategory('Ma', 'Kantong plastik', cats)).toBe('Lainnya')
  })
})

describe('classifySync — urutan prioritas', () => {
  it('kata kunci yang dipelajari user mengalahkan jawaban AI', () => {
    const learned = [{ keyword: 'lfby bs 85g', category: 'Shopping' }]
    expect(classifySync('LFBY BS 85G', 'Makanan', { ...ctx, learned })).toEqual({ category: 'Shopping', source: 'learned' })
  })

  it('keyword dipelajari cocok sebagai bagian nama (terpanjang menang)', () => {
    const learned = [
      { keyword: 'indomie', category: 'Makanan' },
      { keyword: 'indomie goreng', category: 'Shopping' },
    ]
    expect(matchKeyword('INDOMIE GORENG 85G x2', learned)?.category).toBe('Shopping')
  })

  it('jawaban AI yang valid dipakai; "Lainnya" dari AI dianggap belum tahu', () => {
    expect(classifySync('Chitato 68g', 'Makanan', ctx)).toEqual({ category: 'Makanan', source: 'ai' })
    expect(classifySync('Kantong plastik', 'Lainnya', ctx)).toBeNull()
  })

  it('gudang produk lintas household dipakai sebelum regex; hasil "other" kalah dari regex', () => {
    const known = [{ keyword: 'lfby bs', group: 'household' as const }]
    expect(classifySync('LFBY BS 85G', undefined, { ...ctx, known })).toEqual({ category: 'Shopping', source: 'known' })
    const other = [{ keyword: 'teh botol', group: 'other' as const }]
    expect(classifySync('Teh Botol 450ml', undefined, { ...ctx, known: other })).toEqual({ category: 'Makanan', source: 'rule' })
  })

  it('tidak ada yang tahu → null (kandidat pencarian web)', () => {
    expect(classifySync('XYZ 123', undefined, ctx)).toBeNull()
  })
})

describe('helper', () => {
  it('groupToCategory memakai kandidat sesuai nama household', () => {
    expect(groupToCategory('household', cats)).toBe('Shopping')
    expect(groupToCategory('household', [{ name: 'Rumah Tangga', aliases: [] }, { name: 'Lainnya', aliases: [] }])).toBe('Rumah Tangga')
    expect(groupToCategory('entertainment', cats)).toBeUndefined()
  })

  it('keywordFromNote membuang suffix toko/ref dan menormalkan', () => {
    expect(keywordFromNote('[Indomaret] LFBY BS 85G [ref: 123]')).toBe('lfby bs 85g')
    expect(keywordFromNote('LFBY BS 85G — Indomaret [ref: 123]')).toBe('lfby bs 85g') // format lama
    expect(keywordFromNote('[Alfamart] Sabun (titipan Bu Ani)')).toBe('sabun')
    expect(keywordFromNote('  Téh  Botol ')).toBe('teh botol')
    expect(keywordFromNote('x')).toBeNull()
    expect(keywordFromNote(null)).toBeNull()
  })

  it('normText setara norm_text() DB', () => {
    expect(normText('  Minyak   GORÉNG ')).toBe('minyak goreng')
  })

  it('normalizeScanResult menormalkan category tiap item, field lain dibiarkan', () => {
    const raw = { merchant: 'Indomaret', items: [{ note: 'Sabun Lifebuoy', amount: 4500, category: 'Makanan & Minuman' }] }
    // "Makanan & Minuman" valid sebagai jawaban AI → dipertahankan (koreksi datang dari gudang kata kunci, bukan regex)
    expect(normalizeScanResult(raw, cats)).toEqual({ merchant: 'Indomaret', items: [{ note: 'Sabun Lifebuoy', amount: 4500, category: 'Makanan' }] })
    expect(normalizeScanResult({ error: 'bukan struk' }, cats)).toEqual({ error: 'bukan struk' })
  })
})

describe('parseDdgLite', () => {
  it('mengambil judul + snippet hasil pencarian', () => {
    const html = `
      <a rel="nofollow" href="https://a" class="result-link">Lifebuoy &amp; Co</a>
      <td class="result-snippet">Sabun mandi <b>batang</b> 85 g</td>
      <a rel="nofollow" href="https://b" class="result-link">Lain</a>
      <td class="result-snippet">Snippet kedua</td>`
    expect(parseDdgLite(html)).toEqual(['Lifebuoy & Co — Sabun mandi batang 85 g', 'Lain — Snippet kedua'])
    expect(parseDdgLite('<html></html>')).toEqual([])
  })
})

describe('kategori khusus household (SPECIAL_RULES)', () => {
  const custom = [
    { name: 'Bahan Makanan', aliases: ['makanan', 'dapur'] },
    { name: 'Makan Beli & Jajan', aliases: ['jajan'] },
    { name: 'Bayi & Anak', aliases: [] },
    { name: 'Rumah Tangga', aliases: [] },
    { name: 'Usaha Sampingan', aliases: [] },
    { name: 'Lainnya', aliases: [] },
  ]
  const c2 = { categories: custom, learned: [], known: [] }
  it('makan di luar → Makan Beli & Jajan, bahan → Bahan Makanan', () => {
    expect(classifySync('Bakso Mas Boy', undefined, c2)?.category).toBe('Makan Beli & Jajan')
    expect(classifySync('Nasi uduk', undefined, c2)?.category).toBe('Makan Beli & Jajan')
    expect(classifySync('Sempol - Arofah kebab Malaka Sari', undefined, c2)?.category).toBe('Makan Beli & Jajan')
    expect(classifySync('Cilok', 'Bahan Makanan', c2)?.category).toBe('Makan Beli & Jajan') // AI bilang makanan umum, nama jelas jajan
    expect(classifySync('Popok Merries', 'Rumah Tangga', c2)?.category).toBe('Rumah Tangga') // jawaban AI non-makanan tetap dihormati
    expect(classifySync('Telur ayam 1kg', undefined, c2)?.category).toBe('Bahan Makanan')
    expect(classifySync('Indomie Goreng', 'Makanan', c2)?.category).toBe('Bahan Makanan')
  })
  it('popok/mainan → Bayi & Anak, sabun → Rumah Tangga, VPS → Usaha Sampingan', () => {
    expect(classifySync('Baby Hapy Pants 32/M', undefined, c2)?.category).toBe('Bayi & Anak')
    expect(classifySync('Sunlight 610J2X', undefined, c2)?.category).toBe('Rumah Tangga')
    expect(classifySync('Pepsodent White 2X2X', undefined, c2)?.category).toBe('Rumah Tangga')
    expect(classifySync('Sabun Lifebuoy', undefined, c2)?.category).toBe('Rumah Tangga')
    expect(classifySync('Beli VPS SaungMedia', undefined, c2)?.category).toBe('Usaha Sampingan')
  })
  it('household tanpa kategori khusus → aturan lama tetap jalan', () => {
    expect(classifySync('Bakso Mas Boy', undefined, ctx)?.category).toBe('Makanan')
    expect(classifySync('Pampers M', undefined, ctx)?.category).toBe('Shopping')
  })
})
