import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../src/auth/actor'
import { aiApp } from '../src/routes/ai'
import * as chatService from '../src/services/ai/chat'
import { DEFAULT_TOOL_LABEL, getToolLabel, TOOL_LABELS } from '../src/services/ai/tool-labels'

function buildTestAiApp(actor: Actor) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('actor' as never, actor as never)
    await next()
  })
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(err.toBody('test-req'), err.status as 400)
    }
    return c.json({ error: { code: 'internal_error', message: err.message } }, 500)
  })
  app.route('/', aiApp)
  return app
}

const JWT_ACTOR: Actor = {
  credential: 'jwt',
  scope: 'admin',
  userId: '00000000-0000-0000-0000-0000000000e0',
  householdId: '00000000-0000-0000-0000-0000000000a0',
  memberId: '00000000-0000-0000-0000-0000000000c0',
  role: 'owner',
}

describe('tool-labels', () => {
  it('mengembalikan label bahasa Indonesia untuk tool terdaftar dan fallback default untuk tool asing', () => {
    expect(getToolLabel('search_transactions')).toBe('Mencari transaksi…')
    expect(getToolLabel('get_budget_status')).toBe('Mengecek anggaran…')
    expect(getToolLabel('tool_tidak_dikenal')).toBe(DEFAULT_TOOL_LABEL)
    expect(Object.keys(TOOL_LABELS).length).toBeGreaterThanOrEqual(30)
  })
})

describe('POST /v1/ai/chat/stream', () => {
  it('mengirim event status, token, dan done secara berurutan lewat text/event-stream', async () => {
    const spy = vi.spyOn(chatService, 'chatWithAi').mockImplementation(async (_actor, _msgs, _allowWrite, onEvent) => {
      await onEvent?.({ type: 'status', step: 'thinking', label: 'Menyusun jawaban…' })
      await onEvent?.({ type: 'status', step: 'tool', tool: 'search_transactions', label: 'Mencari transaksi…' })
      await onEvent?.({ type: 'status', step: 'writing', label: 'Menulis jawaban…' })
      await onEvent?.({ type: 'token', text: 'Sisa jatah ' })
      await onEvent?.({ type: 'token', text: 'aman Rp 150.000' })
      return {
        reply: 'Sisa jatah aman Rp 150.000',
        mutated: false,
        tools_used: ['search_transactions'],
        actions: [],
        suggestions: ['Rincian pengeluaran minggu ini'],
      }
    })

    try {
      const app = buildTestAiApp(JWT_ACTOR)
      const res = await app.request('/v1/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'Berapa jatah aman?' }],
          allow_write: true,
        }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')
      expect(res.headers.get('cache-control')).toBe('no-cache')

      const text = await res.text()
      expect(text).toContain('event: status')
      expect(text).toContain('"tool":"search_transactions"')
      expect(text).toContain('"label":"Mencari transaksi…"')
      expect(text).toContain('event: token')
      expect(text).toContain('"text":"Sisa jatah "')
      expect(text).toContain('event: done')
      expect(text).toContain('"reply":"Sisa jatah aman Rp 150.000"')
      expect(text).toContain('"suggestions":["Rincian pengeluaran minggu ini"]')
    } finally {
      spy.mockRestore()
    }
  })

  it('mengirim event error jika chatWithAi melempar ApiError', async () => {
    const spy = vi.spyOn(chatService, 'chatWithAi').mockRejectedValue(
      ApiError.fromCode('upstream_ai_error', { message: 'API error 429' }),
    )

    try {
      const app = buildTestAiApp(JWT_ACTOR)
      const res = await app.request('/v1/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'Halo' }],
        }),
      })

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('event: error')
      expect(text).toContain('"code":"upstream_ai_error"')
      expect(text).toContain('"message":"API error 429"')
    } finally {
      spy.mockRestore()
    }
  })

  it('menolak request dengan body tidak valid (400 validation_error) atau API key (403 jwt_required)', async () => {
    const app = buildTestAiApp(JWT_ACTOR)
    const badRes = await app.request('/v1/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })
    expect(badRes.status).toBe(400)
    const badBody = await badRes.json()
    expect(badBody.error.code).toBe('validation_error')

    const apiKeyApp = buildTestAiApp({ ...JWT_ACTOR, credential: 'api_key', scope: 'write' })
    const forbiddenRes = await apiKeyApp.request('/v1/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: 'Halo' }] }),
    })
    expect(forbiddenRes.status).toBe(403)
    const forbiddenBody = await forbiddenRes.json()
    expect(forbiddenBody.error.code).toBe('jwt_required')
  })
})

describe('extractActions (12-ai-chat-ux.md §5.1–5.6)', () => {
  const validCategories = ['Kos/Sewa', 'Makan Beli & Jajan', 'Belanja Dapur']

  it('mengekstrak apply_budget + suggestions valid dan menghapus blok kb-actions dari reply', () => {
    const raw = `Berikut rencana anggaran November:\n- **Kos/Sewa**: **Rp 7.045.000**\n\n\`\`\`kb-actions\n{"suggestions":["Bandingkan dengan Oktober","Mana pos yang bisa dipangkas?"],"actions":[{"type":"apply_budget","label":"Terapkan ke Anggaran November","payload":{"month":"2026-11","items":[{"category":"Kos/Sewa","amount":7045000},{"category":"Belanja Dapur","amount":3000000}]}}]}\n\`\`\``
    const res = chatService.extractActions(raw, validCategories)
    expect(res.reply).toBe('Berikut rencana anggaran November:\n- **Kos/Sewa**: **Rp 7.045.000**')
    expect(res.reply).not.toContain('kb-actions')
    expect(res.suggestions).toEqual(['Bandingkan dengan Oktober', 'Mana pos yang bisa dipangkas?'])
    expect(res.actions).toHaveLength(1)
    expect(res.actions[0]).toEqual({
      type: 'apply_budget',
      label: 'Terapkan ke Anggaran November',
      payload: {
        month: '2026-11',
        items: [
          { category: 'Kos/Sewa', amount: 7045000 },
          { category: 'Belanja Dapur', amount: 3000000 },
        ],
      },
    })
  })

  it('tetap menghapus blok kb-actions dari reply meskipun JSON-nya rusak/terpotong', () => {
    const broken = `Jawaban normal.\n\`\`\`kb-actions\n{"suggestions": ["Belum tutup`
    const res = chatService.extractActions(broken, validCategories)
    expect(res.reply).toBe('Jawaban normal.')
    expect(res.reply).not.toContain('kb-actions')
    expect(res.actions).toEqual([])
    expect(res.suggestions).toEqual([])
  })

  it('membuang aksi dengan type asing atau category tidak valid serta membatasi suggestions maks 3 (<=40 karakter)', () => {
    const raw = `Ringkasan.\n\`\`\`kb-actions
{
  "suggestions": [
    "Satu",
    "Dua",
    "Tiga",
    "Empat lebih dari tiga",
    "Saran yang panjangnya lebih dari empat puluh karakter sehingga harus dibuang"
  ],
  "actions": [
    { "type": "delete_household", "label": "Bahaya", "payload": {} },
    { "type": "record_expense", "label": "Catat", "payload": { "account": "BCA", "category": "Kategori Karangan", "amount": 50000, "date": "2026-11-01" } },
    { "type": "apply_budget", "label": "Anggaran", "payload": { "month": "2026-11", "items": [
      { "category": "Kategori Palsu", "amount": 100000 },
      { "category": "makan beli & jajan", "amount": 1500000 }
    ] } }
  ]
}
\`\`\``
    const res = chatService.extractActions(raw, validCategories)
    expect(res.reply).toBe('Ringkasan.')
    expect(res.suggestions).toEqual(['Satu', 'Dua', 'Tiga'])
    expect(res.actions).toHaveLength(1)
    expect(res.actions[0]).toEqual({
      type: 'apply_budget',
      label: 'Anggaran',
      payload: {
        month: '2026-11',
        items: [{ category: 'Makan Beli & Jajan', amount: 1500000 }],
      },
    })
  })
})
