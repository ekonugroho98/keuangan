import { describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({
  API_BASE_URL: 'https://api.example.test',
  getAuthHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-jwt',
  })),
  api: {
    POST: vi.fn(),
  },
  unwrap: vi.fn((r: { data?: unknown; error?: { error?: { code?: string; message?: string } } }) => {
    if (r.error) {
      const e = new Error(r.error.error?.message ?? 'Error') as Error & { code?: string }
      e.code = r.error.error?.code
      throw e
    }
    return r.data
  }),
}))

import { api } from '../api/client'
import { streamAiChat } from './aiChatStream'

function makeSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('streamAiChat', () => {
  it('mem-parsing event status, token, dan done dari stream SSE', async () => {
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () =>
      makeSseResponse([
        ': ping\n\n',
        'event: status\ndata: {"step":"tool","tool":"search_transactions","label":"Mencari transaksi…"}\n\n',
        'event: token\ndata: {"text":"Halo "}\n\nevent: token\ndata: {"text":"keluarga!"}\n\n',
        'event: done\ndata: {"reply":"Halo keluarga!","mutated":false,"tools_used":["search_transactions"]}\n\n',
      ]),
    ) as unknown as typeof fetch

    try {
      const statuses: string[] = []
      const tokens: string[] = []
      let donePayload: unknown = null

      await streamAiChat(
        { messages: [{ role: 'user', text: 'Halo' }], allow_write: true },
        {
          onStatus: (s) => statuses.push(s.label),
          onToken: (t) => tokens.push(t),
          onDone: (d) => {
            donePayload = d
          },
          onError: () => {},
        },
        new AbortController().signal,
      )

      expect(statuses).toEqual(['Mencari transaksi…'])
      expect(tokens).toEqual(['Halo ', 'keluarga!'])
      expect(donePayload).toEqual({
        reply: 'Halo keluarga!',
        mutated: false,
        tools_used: ['search_transactions'],
      })
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('jatuh ke fallback JSON POST /v1/ai/chat jika fetch stream gagal sebelum event pertama', async () => {
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error')
    }) as unknown as typeof fetch

    const postMock = vi.mocked(api.POST)
    postMock.mockResolvedValueOnce({
      data: { reply: 'Jawaban fallback JSON', mutated: false, tools_used: [] },
    } as never)

    try {
      let doneReply = ''
      await streamAiChat(
        { messages: [{ role: 'user', text: 'Halo' }] },
        {
          onStatus: () => {},
          onToken: () => {},
          onDone: (d) => {
            doneReply = d.reply
          },
          onError: () => {},
        },
        new AbortController().signal,
      )

      expect(postMock).toHaveBeenCalledTimes(1)
      expect(doneReply).toBe('Jawaban fallback JSON')
    } finally {
      globalThis.fetch = origFetch
      postMock.mockReset()
    }
  })
})
