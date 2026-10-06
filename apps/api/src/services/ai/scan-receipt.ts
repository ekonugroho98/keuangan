import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../../auth/actor'
import { withUserClaims } from '../../db/tx'

interface AiConfig {
  provider?: string
  model?: string
  apiKey?: string
  disabled?: boolean
}

async function getAiConfig(actor: Actor): Promise<AiConfig> {
  const config = await withUserClaims(actor.userId, async (tx) => {
    const [row] = await tx<{ ai_config: AiConfig }[]>`select ai_config from user_settings where user_id = ${actor.userId}`
    return row?.ai_config ?? {}
  })
  if (!config.apiKey || config.disabled) throw ApiError.fromCode('ai_not_configured')
  return config
}

// Provider yang mendukung vision (baca gambar) di endpoint chat/completions-nya (AddTransactionModal.jsx VISION_PROVIDERS).
const VISION_PROVIDERS = ['groq', 'openai', 'anthropic', 'google']

const VISION_PROMPT = `Kamu adalah asisten keuangan Indonesia. Baca struk/nota/receipt ini dan ekstrak SEMUA item produk/layanan yang dibeli secara terpisah.
Kembalikan HANYA JSON (tanpa penjelasan lain) dengan format:
{
  "merchant": "Nama Toko",
  "date": "2026-04-06",
  "subtotal": 200000,
  "items": [
    { "note": "Nama Produk 1", "amount": 15000, "category": "Makanan & Minuman" },
    { "note": "Nama Produk 2", "amount": 8500, "category": "Belanja" }
  ]
}
Aturan penting:
- items: daftar SETIAP produk/item yang dibeli (bukan total/subtotal/pajak/kembalian)
- note: nama produk singkat dan jelas
- amount: harga total untuk item itu (qty × harga satuan), angka bulat tanpa titik/koma
- subtotal: total yang harus dibayar dari struk (Subtotal/Total/Bayar), angka bulat tanpa titik/koma, null jika tidak ada
- category: pilih salah satu: "Makanan & Minuman", "Transportasi", "Belanja", "Hiburan", "Kesehatan", "Pendidikan", "Tagihan", "Lainnya"
- date: format YYYY-MM-DD dari struk, jika tidak ada tulis null
- Jangan masukkan baris Total, Subtotal, PPN, Diskon, Kembalian sebagai item
Jika gambar bukan struk/nota, kembalikan: {"error": "bukan struk"}`

function textPrompt(ocrText: string): string {
  return `Berikut teks struk/nota yang dibaca OCR. Ekstrak SEMUA item produk yang dibeli.
Kembalikan HANYA JSON (tanpa penjelasan lain):
{
  "merchant": "Nama Toko",
  "date": "YYYY-MM-DD atau null",
  "subtotal": 200000,
  "items": [
    { "note": "Nama Produk", "amount": 15000, "category": "Makanan & Minuman" }
  ]
}
Aturan: amount = harga total per item (qty×satuan), jangan sertakan baris Total/Subtotal/Diskon/Kembalian sebagai item.
category: "Makanan & Minuman","Transportasi","Belanja","Hiburan","Kesehatan","Pendidikan","Tagihan","Lainnya"
Jika bukan struk: {"error":"bukan struk"}

TEKS OCR:
${ocrText}`
}

interface ProviderRequest { url: string; headers: Record<string, string>; body: Record<string, unknown> }

function buildVisionRequest(provider: string, apiKey: string, base64: string, mimeType: string): ProviderRequest {
  const msgs = [{ role: 'user', content: [{ type: 'text', text: VISION_PROMPT }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }] }]
  if (provider === 'groq') {
    return { url: 'https://api.groq.com/openai/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: { model: 'meta-llama/llama-4-scout-17b-16e-instruct', max_tokens: 1000, messages: msgs } }
  }
  if (provider === 'openai') {
    return { url: 'https://api.openai.com/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: { model: 'gpt-4o-mini', max_tokens: 1000, messages: msgs } }
  }
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: 'claude-3-5-haiku-20241022', max_tokens: 1000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }, { type: 'text', text: VISION_PROMPT }] }] },
    }
  }
  if (provider === 'google') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      body: { contents: [{ parts: [{ text: VISION_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }] },
    }
  }
  throw ApiError.fromCode('provider_no_vision')
}

function buildTextRequest(provider: string, apiKey: string, ocrText: string): ProviderRequest {
  const prompt = textPrompt(ocrText)
  const msgs = [{ role: 'user', content: prompt }]
  if (provider === 'groq' || provider === 'openai') {
    return {
      url: provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: { model: provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini', max_tokens: 1000, messages: msgs },
    }
  }
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: 'claude-3-5-haiku-20241022', max_tokens: 1000, messages: msgs },
    }
  }
  if (provider === 'google') {
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, headers: { 'Content-Type': 'application/json' }, body: { contents: [{ parts: [{ text: prompt }] }] } }
  }
  const baseUrl: Record<string, string> = { mistral: 'https://api.mistral.ai/v1', deepseek: 'https://api.deepseek.com/v1', xai: 'https://api.x.ai/v1' }
  const modelByProvider: Record<string, string> = { mistral: 'mistral-small-latest', deepseek: 'deepseek-chat', xai: 'grok-2-latest' }
  return {
    url: `${baseUrl[provider] ?? 'https://api.openai.com/v1'}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: { model: modelByProvider[provider] ?? 'gpt-4o-mini', max_tokens: 1000, messages: msgs },
  }
}

function extractText(provider: string, data: Record<string, unknown>): string {
  if (provider === 'anthropic') return ((data.content as Array<{ text?: string }>)?.[0]?.text) ?? ''
  if (provider === 'google') return ((data.candidates as Array<{ content: { parts: Array<{ text?: string }> } }>)?.[0]?.content?.parts?.[0]?.text) ?? ''
  return ((data.choices as Array<{ message: { content?: string } }>)?.[0]?.message?.content) ?? ''
}

async function callProvider(req: ProviderRequest, provider: string): Promise<Record<string, unknown>> {
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) })
  const data = (await res.json()) as Record<string, unknown> & { error?: { message?: string } }
  if (!res.ok) throw ApiError.fromCode('upstream_ai_error', { message: data.error?.message ?? `Gagal scan (provider ${provider})` })
  const text = extractText(provider, data)
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw ApiError.fromCode('upstream_ai_error', { message: 'Format respons AI tidak valid.' })
  return JSON.parse(match[0])
}

/**
 * Vision (foto struk) atau teks (hasil OCR client-side tesseract.js yang perlu distrukturkan) —
 * lihat ScanReceiptBodySchema. Sanitasi/validasi hasil (sanitizeScanResult) tetap di frontend
 * karena murni logika tampilan (guess kategori, dsb.), bukan sesuatu yang butuh rahasia server.
 */
export async function scanReceipt(actor: Actor, input: { image_base64?: string; mime_type?: string; ocr_text?: string }) {
  const config = await getAiConfig(actor)
  const provider = config.provider!
  const apiKey = config.apiKey!

  if (input.image_base64 && input.mime_type) {
    if (!VISION_PROVIDERS.includes(provider)) throw ApiError.fromCode('provider_no_vision')
    const req = buildVisionRequest(provider, apiKey, input.image_base64, input.mime_type)
    return callProvider(req, provider)
  }

  const req = buildTextRequest(provider, apiKey, input.ocr_text!)
  return callProvider(req, provider)
}
