import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../../auth/actor'
import { withUserClaims } from '../../db/tx'
import { env } from '../../env'

/**
 * Akses provider AI BYOK / Token Gatekeeper (API key di user_settings.ai_config) — dipakai scan-receipt.ts
 * (vision/teks) dan web-lookup.ts (identifikasi produk). Satu tempat untuk URL/model per provider.
 */
export interface AiConfig {
  provider?: string
  model?: string
  apiKey?: string
  disabled?: boolean
}

export async function tryGetAiConfig(actor: Actor): Promise<AiConfig | null> {
  const config = await withUserClaims(actor.userId, async (tx) => {
    const [row] = await tx<{ ai_config: AiConfig }[]>`select ai_config from user_settings where user_id = ${actor.userId}`
    return row?.ai_config ?? {}
  })
  const trimmedKey = config.apiKey?.trim()
  if (!trimmedKey || config.disabled) return null
  const isGatekeeperKey = trimmedKey.startsWith('sk-kb-')
  const provider = isGatekeeperKey ? 'gatekeeper' : config.provider
  if (!provider) return null
  return {
    ...config,
    apiKey: trimmedKey,
    provider,
    model: config.model || (provider === 'gatekeeper' ? 'kb-auto' : undefined),
  }
}

export async function getAiConfig(actor: Actor): Promise<AiConfig> {
  const config = await tryGetAiConfig(actor)
  if (!config) throw ApiError.fromCode('ai_not_configured')
  return config
}

// Provider yang mendukung vision (baca gambar) di endpoint chat/completions-nya.
export const VISION_PROVIDERS = ['gatekeeper', 'groq', 'openai', 'anthropic', 'google']

// Struk panjang (30+ item) bisa melewati 1000 token keluaran dan JSON-nya terpotong di tengah.
export const MAX_OUTPUT_TOKENS = 2048
export const ANTHROPIC_MODEL = 'claude-haiku-5-5'
// gemini-1.5-flash sudah tidak dilayani; 3.5 dideprekasi dan dirutekan ke 3.6 (ai.google.dev, 2026-10).
export const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export interface ProviderRequest { url: string; headers: Record<string, string>; body: Record<string, unknown> }

export function buildVisionRequest(provider: string, apiKey: string, base64: string, mimeType: string, prompt: string): ProviderRequest {
  const msgs = [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }] }]
  if (provider === 'gatekeeper' || apiKey.startsWith('sk-kb-')) {
    return {
      url: `${env.GATEKEEPER_BASE_URL}/v1/chat/completions`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: { model: 'kb-vision', max_tokens: MAX_OUTPUT_TOKENS, messages: msgs },
    }
  }
  if (provider === 'groq') {
    return { url: 'https://api.groq.com/openai/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: { model: 'meta-llama/llama-4-scout-17b-16e-instruct', max_tokens: MAX_OUTPUT_TOKENS, messages: msgs } }
  }
  if (provider === 'openai') {
    return { url: 'https://api.openai.com/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: { model: 'gpt-4o-mini', max_tokens: MAX_OUTPUT_TOKENS, messages: msgs } }
  }
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: ANTHROPIC_MODEL, max_tokens: MAX_OUTPUT_TOKENS, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }, { type: 'text', text: prompt }] }] },
    }
  }
  if (provider === 'google') {
    return {
      url: GEMINI_URL,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }] },
    }
  }
  throw ApiError.fromCode('provider_no_vision')
}

export function buildTextRequest(provider: string, apiKey: string, prompt: string, maxTokens = MAX_OUTPUT_TOKENS): ProviderRequest {
  const msgs = [{ role: 'user', content: prompt }]
  if (provider === 'gatekeeper' || apiKey.startsWith('sk-kb-')) {
    return {
      url: `${env.GATEKEEPER_BASE_URL}/v1/chat/completions`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: { model: 'kb-auto', max_tokens: maxTokens, messages: msgs },
    }
  }
  if (provider === 'groq' || provider === 'openai') {
    return {
      url: provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: { model: provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini', max_tokens: maxTokens, messages: msgs },
    }
  }
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: ANTHROPIC_MODEL, max_tokens: maxTokens, messages: msgs },
    }
  }
  if (provider === 'google') {
    return { url: GEMINI_URL, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: { contents: [{ parts: [{ text: prompt }] }] } }
  }
  const baseUrl: Record<string, string> = { mistral: 'https://api.mistral.ai/v1', deepseek: 'https://api.deepseek.com/v1', xai: 'https://api.x.ai/v1' }
  const modelByProvider: Record<string, string> = { mistral: 'mistral-small-latest', deepseek: 'deepseek-chat', xai: 'grok-2-latest' }
  return {
    url: `${baseUrl[provider] ?? 'https://api.openai.com/v1'}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: { model: modelByProvider[provider] ?? 'gpt-4o-mini', max_tokens: maxTokens, messages: msgs },
  }
}

function extractText(provider: string, data: Record<string, unknown>): string {
  if (provider === 'anthropic') return ((data.content as Array<{ text?: string }>)?.[0]?.text) ?? ''
  if (provider === 'google') return ((data.candidates as Array<{ content: { parts: Array<{ text?: string }> } }>)?.[0]?.content?.parts?.[0]?.text) ?? ''
  return ((data.choices as Array<{ message: { content?: string } }>)?.[0]?.message?.content) ?? ''
}

/** Panggil provider dan ambil objek JSON pertama dari teks jawabannya. */
export async function callProviderJson(req: ProviderRequest, provider: string, timeoutMs = 45_000): Promise<Record<string, unknown>> {
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(timeoutMs) })
  const data = (await res.json()) as Record<string, unknown> & { error?: { message?: string } }
  if (!res.ok) throw ApiError.fromCode('upstream_ai_error', { message: data.error?.message ?? `Gagal memanggil AI (provider ${provider})` })
  const text = extractText(provider, data)
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw ApiError.fromCode('upstream_ai_error', { message: 'Format respons AI tidak valid.' })
  return JSON.parse(match[0])
}
