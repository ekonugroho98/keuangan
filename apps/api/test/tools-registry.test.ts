import { describe, expect, it } from 'vitest'
import { HouseholdFeaturesSchema } from '@karaya/shared/schemas'
import { TOOLS, toolByName } from '../src/tools/registry'
import { buildToolDefs } from '../src/services/ai/chat'
import { formatToolResult } from '../src/services/ai/format-tool-result'
import manifest from '../tools/hermes-tools.json'

// Unit test (bukan integration — tidak butuh DB): TOOLS adalah satu sumber kebenaran untuk
// hermes-tools.json (06-agent-integration.md §2). 10 tool baru F-A/F-B/F-D (10-fitur-opsional-
// keluarga.md §2.4) ditambahkan 2026-10-08 — total 22 -> 32. Hermes yang sebenarnya memanggil lewat
// HTTP (endpoint/parameters, sudah diverifikasi manual thd DB lokal di sesi sebelumnya); test ini
// menjaga STRUKTUR registry & manifest tetap konsisten (jumlah, field feature, sinkron dgn file JSON).
describe('tools registry (10-fitur-opsional-keluarga.md §2.4)', () => {
  it('total 34 tool (22 lama + 10 F-A/F-B/F-D + 2 perbandingan harga)', () => {
    expect(TOOLS).toHaveLength(34)
  })

  it('hermes-tools.json (file ter-commit) SINKRON dengan registry — jalankan `pnpm gen:tools` kalau test ini gagal', () => {
    const regenerated = TOOLS.map((t) => ({
      name: t.name, description: t.description, parameters: t.parameters,
      endpoint: t.endpoint, scope: t.scope, idempotent: t.idempotent,
      ...(t.feature ? { feature: t.feature } : {}),
    }))
    expect(manifest).toEqual(regenerated)
  })

  const F_A_TOOLS = ['list_beneficiaries', 'add_beneficiary']
  const F_D_TOOLS = ['ingest_receipt', 'list_shopping', 'add_shopping_item', 'mark_bought', 'shopping_suggestions', 'list_pantry', 'adjust_pantry']

  it.each(F_A_TOOLS)('%s di-gate feature "beneficiary"', (name) => {
    expect(toolByName(name)?.feature).toBe('beneficiary')
  })

  it.each(F_D_TOOLS)('%s di-gate feature "shopping_stock"', (name) => {
    expect(toolByName(name)?.feature).toBe('shopping_stock')
  })

  it('get_monthly_report TIDAK di-gate feature apa pun (F-B selalu tersedia, 10-fitur-opsional-keluarga.md §4.3)', () => {
    expect(toolByName('get_monthly_report')?.feature).toBeUndefined()
  })

  it('tool INTI (record_expense dkk.) TIDAK diberi `feature` — hanya satu parameter opsional baru', () => {
    for (const name of ['record_expense', 'record_expense_batch', 'update_transaction', 'search_transactions', 'get_summary']) {
      expect(toolByName(name)?.feature).toBeUndefined()
      expect(JSON.stringify(toolByName(name)?.parameters)).toContain('beneficiary')
    }
  })

  it('setiap tool punya endpoint.path yang valid dan parameters berbentuk object schema', () => {
    for (const t of TOOLS) {
      expect(t.endpoint.path.startsWith('/v1/')).toBe(true)
      expect(t.parameters.type).toBe('object')
    }
  })

  it('tool baru yang PATCH/POST-movement pada resource existing ditandai idempotent:false (mark_bought, adjust_pantry) — pola sama dengan update_transaction/delete_transaction', () => {
    expect(toolByName('mark_bought')?.idempotent).toBe(false)
    expect(toolByName('adjust_pantry')?.idempotent).toBe(false)
  })

  describe('/v1/ai/chat buildToolDefs menyaring tool ber-feature berdasarkan flag household (review 2026-10-08)', () => {
    const allOff = HouseholdFeaturesSchema.parse({})
    const names = (defs: { name: string }[]) => defs.map((d) => d.name)

    it('semua flag mati: tidak ada tool F-A/F-D, tapi get_monthly_report (F-B) & tool inti tetap ada', () => {
      const n = names(buildToolDefs(true, allOff))
      for (const t of [...F_A_TOOLS, ...F_D_TOOLS]) expect(n).not.toContain(t)
      expect(n).toContain('get_monthly_report')
      expect(n).toContain('record_expense')
      expect(n).toContain('get_investments') // tool internal AI chat, bukan registry
    })

    it('shopping_stock nyala saja: tool F-D muncul, F-A tetap tidak', () => {
      const n = names(buildToolDefs(true, HouseholdFeaturesSchema.parse({ shopping_stock: { enabled: true } })))
      for (const t of F_D_TOOLS) expect(n).toContain(t)
      for (const t of F_A_TOOLS) expect(n).not.toContain(t)
    })

    it('allow_write=false tetap menyembunyikan tool tulis walau fiturnya nyala (list_pantry ada, adjust_pantry tidak)', () => {
      const n = names(buildToolDefs(false, HouseholdFeaturesSchema.parse({ shopping_stock: { enabled: true } })))
      expect(n).toContain('list_pantry')
      expect(n).not.toContain('adjust_pantry')
    })
  })

  describe('formatToolResult tool baru: ARRAY hasil tool baca tidak boleh jadi "Berhasil." (review 2026-10-08)', () => {
    it('list_shopping / list_pantry / list_beneficiaries / shopping_suggestions menampilkan datanya', () => {
      expect(formatToolResult('list_shopping', [{ id: 'x', name: 'Telur', qty_text: '1 kg', notes: '' }])).toContain('Telur')
      expect(formatToolResult('list_pantry', [{ id: 'y', name: 'Susu', qty: 2, unit: 'L', location: 'fridge', expires_at: null, expires_estimated: false, min_qty: 3 }])).toMatch(/Kulkas[\s\S]*Susu[\s\S]*menipis/)
      expect(formatToolResult('list_beneficiaries', [{ name: 'Anak', kind: 'child', aliases: ['bocah'] }])).toContain('Anak')
      expect(formatToolResult('shopping_suggestions', [{ pantry_item_id: 'z', name: 'Gula', qty: 0, min_qty: 1 }])).toContain('Gula')
      for (const name of ['list_shopping', 'list_pantry', 'list_beneficiaries', 'shopping_suggestions']) {
        expect(formatToolResult(name, [])).not.toBe('Berhasil.')
      }
    })

    it('get_monthly_report meneruskan text_id; ingest_receipt melaporkan unmatched dengan jujur', () => {
      expect(formatToolResult('get_monthly_report', { text_id: '📊 Oktober 2026', largest_transactions: [] })).toBe('📊 Oktober 2026')
      const out = formatToolResult('ingest_receipt', {
        transactions: [{ amount: 48500 }], account: { balance: 1000 },
        shopping: { marked_bought: [{ name: 'Pampers' }], unmatched: ['Telur'] },
        pantry: { updated: [], unmatched: ['Pampers', 'Telur'] },
      })
      expect(out).toContain('Pampers')
      expect(out).toContain('tidak di daftar: Telur')
      expect(out).toContain('tidak di stok')
    })
  })
})
