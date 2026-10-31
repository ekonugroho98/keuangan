import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AiMessage } from './AiMessage'

describe('AiMessage', () => {
  it('merender tabel 3 kolom di variant floating sebagai kartu sejumlah baris data dan menandai baris TOTAL', () => {
    const md = [
      '### 📋 Rekapitulasi Rencana Alokasi November 2026',
      '',
      '| Kelompok Pos | Alokasi (Rp) | Porsi (%) |',
      '|---|---|---|',
      '| Kebutuhan Pokok & Rumah | Rp 7.045.000 | 47,0% |',
      '| Jatah Istri & Anak | Rp 3.500.000 | 23,3% |',
      '| Tabungan & Dana Darurat | Rp 3.000.000 | 20,0% |',
      '| Cadangan & Sosial | Rp 1.455.000 | 9,7% |',
      '| **TOTAL** | **Rp 15.000.000** | **100%** |',
    ].join('\n')

    const html = renderToStaticMarkup(<AiMessage text={md} variant="floating" />)

    // Tidak merender elemen <table> untuk 3 kolom di floating
    expect(html).not.toContain('<table')
    // Jumlah kartu sama dengan jumlah baris data (5 baris)
    const cardMatches = html.match(/data-testid="ai-table-card"/g) ?? []
    expect(cardMatches).toHaveLength(5)
    // Baris TOTAL diberi latar var(--color-primary-soft)
    expect(html).toContain('var(--color-primary-soft)')
    // Karakter pipa atau pagar markdown mentah tidak tampil
    expect(html).not.toContain('###')
    expect(html).not.toContain('| Kelompok Pos |')
  })

  it('merender tabel 2 kolom sebagai tabel biasa dengan kolom angka rata kanan', () => {
    const md = [
      '| Pos Anggaran | Nominal |',
      '|---|---|',
      '| Belanja Dapur | Rp 3.500.000 |',
      '| Listrik & Air | Rp 850.000 |',
    ].join('\n')

    const html = renderToStaticMarkup(<AiMessage text={md} variant="floating" />)

    expect(html).toContain('<table')
    expect(html).toContain('text-align:right')
    expect(html).not.toContain('data-testid="ai-table-card"')
  })

  it('tidak merender elemen hr maupun img dari sintaks Markdown', () => {
    const md = 'Paragraf satu\n\n---\n\n![Gambar](https://example.com/x.png)\n\nParagraf dua'
    const html = renderToStaticMarkup(<AiMessage text={md} variant="floating" />)

    expect(html).not.toContain('<hr')
    expect(html).not.toContain('<img')
    expect(html).toContain('Paragraf satu')
    expect(html).toContain('Paragraf dua')
  })

  it('menambahkan rel="noopener noreferrer" pada tautan eksternal dan menolak skema javascript:', () => {
    const md = 'Buka [Panduan](https://keluargaberkembang.com) atau [Bahaya](javascript:alert(1))'
    const html = renderToStaticMarkup(<AiMessage text={md} variant="page" />)

    expect(html).toContain('href="https://keluargaberkembang.com"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
    expect(html).not.toContain('javascript:')
  })

  it('meng-escape HTML mentah (<script> dan <img onerror>) sebagai teks biasa', () => {
    const md = 'Halo <script>alert(1)</script> dan <img src=x onerror=alert(1)>'
    const html = renderToStaticMarkup(<AiMessage text={md} variant="floating" />)

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('menyembunyikan blok kb-actions baik yang utuh maupun saat masih streaming/rusak (§5.6 #2)', () => {
    const partial = 'Saran anggaran siap.\n```kb-actions\n{"suggestions":["Bandingkan'
    const html = renderToStaticMarkup(<AiMessage text={partial} variant="floating" />)
    expect(html).toContain('Saran anggaran siap.')
    expect(html).not.toContain('kb-actions')
    expect(html).not.toContain('suggestions')
  })
})
