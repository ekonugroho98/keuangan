import { buildTextRequest, callProviderJson } from './ai/provider'
import { GROUP_LABEL_ID, PRODUCT_GROUPS, isProductGroup, type ProductGroup } from './product-groups'

/**
 * Identifikasi item struk yang tidak dikenali siapa pun (kata kunci household, AI, regex, gudang
 * produk): cari di web, lalu minta AI BYOK user menyimpulkan produk apa & kelompoknya. Hasilnya
 * di-cache di product_knowledge oleh pemanggil (categorize.ts), jadi tiap nama hanya dicari sekali.
 * Semua kegagalan ditelan (null) — ini jalur best-effort, tidak boleh menggagalkan scan/ingest.
 */
export interface WebLookupResult { group: ProductGroup; label: string; canonical: string | null; grounded: boolean }

const SEARCH_TIMEOUT_MS = 7_000
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parser halaman hasil DuckDuckGo Lite (tanpa API key). Diekspor untuk unit test. */
export function parseDdgLite(html: string, limit = 5): string[] {
  const titles = [...html.matchAll(/class="result-link"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => stripHtml(m[1]!))
  const snippets = [...html.matchAll(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripHtml(m[1]!))
  const out: string[] = []
  for (let i = 0; i < Math.min(limit, Math.max(titles.length, snippets.length)); i++) {
    const t = titles[i] ?? ''
    const s = snippets[i] ?? ''
    if (!t && !s) continue
    out.push(s ? `${t} — ${s}` : t)
  }
  return out
}

export async function searchWeb(query: string): Promise<string[]> {
  try {
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    })
    if (!res.ok) return []
    return parseDdgLite(await res.text())
  } catch {
    return []
  }
}

function classifyPrompt(itemName: string, snippets: string[]): string {
  const groups = PRODUCT_GROUPS.map((g) => `- ${g}: ${GROUP_LABEL_ID[g]}`).join('\n')
  const evidence = snippets.length
    ? `Hasil pencarian web untuk nama itu:\n${snippets.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : 'Tidak ada hasil pencarian web — pakai pengetahuanmu sendiri tentang produk yang umum di minimarket/supermarket Indonesia.'
  return `Kamu mengidentifikasi barang dari struk belanja Indonesia. Nama item sering disingkat kasir (mis. "LFBY BS 85G" = Lifebuoy sabun batang 85 g, "INDM GRG" = Indomie goreng, "GRANDCO MG REF 1LT" / "BML MG 2L" = Minyak goreng refill, di mana "MG" = Minyak Goreng sedangkan "MGR" = Margarin).
Nama item: "${itemName}"

${evidence}

Kelompok yang tersedia:
${groups}

Jawab HANYA JSON: {"label": "<nama produk lengkap, singkat>", "canonical": "<merek + jenis + varian, huruf kecil, TANPA ukuran/berat/isi, mis. lifebuoy sabun batang total 10>", "group": "<salah satu kelompok di atas>"}
canonical = null kalau produknya tidak bisa dipastikan.
Kalau benar-benar tidak bisa dipastikan, group = "other".`
}

export async function lookupProduct(itemName: string, provider: string, apiKey: string): Promise<WebLookupResult | null> {
  const name = itemName.trim()
  if (name.length < 2) return null
  const snippets = await searchWeb(`${name} produk`)
  try {
    const raw = await callProviderJson(buildTextRequest(provider, apiKey, classifyPrompt(name, snippets), 200), provider, 20_000)
    const group = isProductGroup(raw.group) ? raw.group : null
    if (!group) return null
    const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, 120) : name
    const canonical = typeof raw.canonical === 'string' && raw.canonical.trim().length >= 2 ? raw.canonical.trim().slice(0, 120) : null
    return { group, label, canonical, grounded: snippets.length > 0 }
  } catch {
    return null
  }
}
