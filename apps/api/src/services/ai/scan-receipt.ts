import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../../auth/actor'
import { withActor } from '../../db/tx'
import { classifyItems, loadExpenseCategories, type ExpenseCategory } from '../categorize'
import { canonicalizeProducts } from '../prices'
import { uploadReceiptImage } from '../storage'
import { VISION_PROVIDERS, buildTextRequest, buildVisionRequest, callProviderJson, getAiConfig } from './provider'

// Kategori pengeluaran milik household (bukan daftar hardcode) — ini yang ditawarkan ke AI dan
// yang jadi acuan normalisasi jawabannya (services/categorize.ts, dipakai juga oleh jalur Hermes).
function categoryBlock(categories: ExpenseCategory[]): string {
  const lines = categories.map((c) => (c.aliases.length ? `- ${c.name} (mis. ${c.aliases.join(', ')})` : `- ${c.name}`))
  return `KATEGORI YANG TERSEDIA (tulis namanya PERSIS seperti di daftar, jangan buat nama baru):
${lines.join('\n')}

Panduan memilih kategori:
- Tentukan dari JENIS BARANG/LAYANAN tiap item, BUKAN dari nama toko. Struk minimarket/supermarket hampir selalu berisi campuran kategori.
- Makanan/minuman/bahan masak (beras, minyak goreng, bumbu, snack, kopi, susu) → kategori makanan.
- Sabun, deterjen, sampo, tisu, popok, pembalut, perlengkapan rumah, pakaian → kategori belanja/rumah tangga, BUKAN makanan.
- Obat, vitamin, masker, alat kesehatan → kategori kesehatan.
- Pulsa, paket data, token listrik, bayar tagihan → kategori utilitas/tagihan.
- Bensin, parkir, tol, ongkos → kategori transport.
- Buku, alat tulis, perlengkapan sekolah → kategori pendidikan.
- Pilih kategori yang paling dekat dari daftar. Kalau tidak ada yang cocok atau ragu, pakai "Lainnya" — jangan memaksa ke kategori makanan.`
}

function visionPrompt(categories: ExpenseCategory[]): string {
  return `Kamu adalah asisten keuangan keluarga Indonesia. Baca struk/nota/receipt ini dan ekstrak SEMUA item produk/layanan yang dibeli secara terpisah, lalu beri kategori untuk TIAP item.

${categoryBlock(categories)}

Kembalikan HANYA JSON (tanpa penjelasan lain) dengan format:
{
  "merchant": "Nama Toko",
  "date": "2026-04-06",
  "subtotal": 200000,
  "items": [
    { "note": "Nama Produk 1", "qty": 1, "amount": 15000, "discount": 0, "category": "<nama kategori dari daftar>" },
    { "note": "Nama Produk 2", "qty": 2, "amount": 40380, "discount": 6600, "category": "<nama kategori dari daftar>" }
  ]
}
Aturan penting:
- items: daftar SETIAP produk/item yang dibeli (bukan total/subtotal/pajak/kembalian)
- note: nama produk persis seperti tertulis di struk (jangan diterjemahkan/diperhalus — dipakai untuk mengenali produk yang sama lain kali; mis. "GRANDCO MG REF 1LT" tulis persis begitu, JANGAN ubah "MG" yang berarti Minyak Goreng menjadi "Margarin")
- qty: jumlah kemasan/unit item tersebut yang dibeli pada baris itu (wajib baca kolom Qty/jumlah pcs dengan teliti, mis. "2 pcs" / "2 X 23.490" → qty: 2; default 1 hanya jika benar-benar 1 unit)
- amount: harga bersih yang dibayar untuk baris item itu SETELAH dikurangi diskon item jika ada (mis. 2 × 23.490 = 46.980, Diskon -6.600 → amount: 40380, discount: 6600, qty: 2), angka bulat tanpa titik/koma
- discount: total potongan diskon untuk baris item itu dalam Rupiah (angka bulat positif, mis. "DISC : -6,600" → discount: 6600; tulis 0 jika tidak ada diskon pada item tersebut)
- subtotal: total yang harus dibayar dari struk (Subtotal/Total/Bayar), angka bulat tanpa titik/koma, null jika tidak ada
- date: format YYYY-MM-DD dari struk, jika tidak ada tulis null
- Jangan masukkan baris Total, Subtotal, PPN, Diskon, Kembalian sebagai item tersendiri (diskon per item langsung dicatat di field discount & mengurangi amount item terkait)
Jika gambar bukan struk/nota, kembalikan: {"error": "bukan struk"}`
}

function textPrompt(ocrText: string, categories: ExpenseCategory[]): string {
  return `Berikut teks struk/nota yang dibaca OCR. Ekstrak SEMUA item produk yang dibeli dan beri kategori untuk TIAP item.

${categoryBlock(categories)}

Kembalikan HANYA JSON (tanpa penjelasan lain):
{
  "merchant": "Nama Toko",
  "date": "YYYY-MM-DD atau null",
  "subtotal": 200000,
  "items": [
    { "note": "Nama Produk", "qty": 1, "amount": 15000, "discount": 0, "category": "<nama kategori dari daftar>" }
  ]
}
Aturan: note = nama item persis seperti di struk (jangan ubah singkatan "MG" [Minyak Goreng] menjadi Margarin); qty = jumlah unit/kemasan yang dibeli pada baris tersebut (wajib teliti membaca "2 pcs" / "2 X ..."); amount = harga total bersih per baris item setelah dikurangi diskon item (qty×satuan - diskon_item); discount = total potongan diskon baris item tersebut (angka bulat positif, 0 jika tidak ada diskon); jangan sertakan baris Total/Subtotal/Diskon/Kembalian sebagai item tersendiri.
Jika bukan struk: {"error":"bukan struk"}

TEKS OCR:
${ocrText}`
}

/**
 * Vision (foto struk) atau teks (hasil OCR client-side tesseract.js yang perlu distrukturkan) —
 * lihat ScanReceiptBodySchema. Kategori tiap item SELALU dikembalikan sebagai nama kategori
 * household yang persis ada (classifyItems: kata kunci yang dipelajari > jawaban AI > gudang produk
 * > regex > pencarian web > Lainnya), plus `category_source` supaya UI bisa menandai asal tebakan.
 * Validasi nominal/note tetap di frontend (sanitizeScanResult).
 */
export async function scanReceipt(actor: Actor, input: { image_base64?: string; mime_type?: string; ocr_text?: string }) {
  const config = await getAiConfig(actor)
  const provider = config.provider!
  const apiKey = config.apiKey!
  const categories = await withActor(actor, (tx) => loadExpenseCategories(tx, actor.householdId))

  let raw: Record<string, unknown>
  let uploadedReceiptUrl: string | null = null
  if (input.image_base64 && input.mime_type) {
    if (!VISION_PROVIDERS.includes(provider)) throw ApiError.fromCode('provider_no_vision')
    const [aiRaw, uploaded] = await Promise.all([
      callProviderJson(buildVisionRequest(provider, apiKey, input.image_base64, input.mime_type, visionPrompt(categories)), provider),
      uploadReceiptImage(actor.householdId, { image_base64: input.image_base64, mime_type: input.mime_type }).catch(() => null),
    ])
    raw = aiRaw
    uploadedReceiptUrl = uploaded?.receipt_url ?? null
  } else {
    raw = await callProviderJson(buildTextRequest(provider, apiKey, textPrompt(input.ocr_text!, categories)), provider)
  }

  if (!Array.isArray(raw.items)) return raw
  const items = (raw.items as Array<Record<string, unknown>>).filter((it) => it && typeof it === 'object')
  const names = items.map((it) => (typeof it.note === 'string' ? it.note : ''))
  // Kanonikalisasi produk (perbandingan harga, prices.ts) jalan paralel dengan klasifikasi supaya
  // saat user menyimpan hasil scan, nama produknya sudah ter-cache. Best-effort.
  const [classified] = await Promise.all([
    classifyItems(actor, items.map((it, i) => ({ name: names[i]!, aiCategory: it.category })), { webLookup: true }),
    canonicalizeProducts(actor, names),
  ])
  return {
    ...raw,
    ...(uploadedReceiptUrl ? { receipt_url: uploadedReceiptUrl } : {}),
    items: items.map((it, i) => ({ ...it, category: classified[i]!.category, category_source: classified[i]!.source })),
  }
}
