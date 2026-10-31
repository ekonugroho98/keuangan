import { api, API_BASE_URL, getAuthHeaders, unwrap } from '../api/client'

export type AiChatMessageInput = {
  role: 'user' | 'ai'
  text: string
}

export type AiChatBody = {
  messages: AiChatMessageInput[]
  allow_write?: boolean
}

export type AiAction = {
  type: 'apply_budget' | 'record_expense' | 'add_shopping' | 'set_goal'
  label: string
  payload: Record<string, unknown>
}

export type AiStreamDonePayload = {
  reply: string
  mutated?: boolean
  tools_used?: string[]
  elapsed_ms?: number
  actions?: AiAction[]
  suggestions?: string[]
}

export type AiStreamHandlers = {
  onStatus(s: { step: string; tool?: string; label: string }): void
  onToken(text: string): void
  onDone(r: AiStreamDonePayload): void
  onError(e: { code: string; message: string }): void
}

async function fallbackJsonChat(
  body: AiChatBody,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return
  try {
    const result = unwrap(
      await api.POST('/v1/ai/chat', {
        body: {
          messages: body.messages,
          allow_write: body.allow_write ?? true,
        },
        signal,
      }),
    ) as AiStreamDonePayload
    if (!signal.aborted) {
      handlers.onDone(result)
    }
  } catch (err) {
    if (signal.aborted) return
    const e = err as Error & { code?: string }
    handlers.onError({
      code: e.code ?? 'upstream_ai_error',
      message: e.message || 'Gagal menghubungi asisten AI.',
    })
  }
}

export async function streamAiChat(
  body: AiChatBody,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let receivedFirstEvent = false
  let receivedAnyToken = false

  try {
    const headers = await getAuthHeaders()
    const streamUrl = `${API_BASE_URL}/v1/ai/chat/stream`
    const response = await fetch(streamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.includes('text/event-stream') || !response.body) {
      // Sebelum event pertama diterima -> fallback ke endpoint JSON lama
      await fallbackJsonChat(body, handlers, signal)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Normalisasi CRLF ke LF lalu pisahkan blok event SSE per \n\n
      buffer = buffer.replace(/\r\n/g, '\n')
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const lines = block.split('\n')
        let eventName = 'message'
        const dataLines: string[] = []

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line || line.startsWith(':')) continue
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim())
          }
        }

        if (dataLines.length === 0) continue
        receivedFirstEvent = true
        const dataStr = dataLines.join('\n')
        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(dataStr)
        } catch {
          continue
        }

        if (eventName === 'status') {
          handlers.onStatus({
            step: String(payload.step ?? 'thinking'),
            ...(typeof payload.tool === 'string' ? { tool: payload.tool } : {}),
            label: String(payload.label ?? 'Memproses…'),
          })
        } else if (eventName === 'token') {
          const text = String(payload.text ?? '')
          if (text) {
            receivedAnyToken = true
            handlers.onToken(text)
          }
        } else if (eventName === 'done') {
          handlers.onDone({
            reply: String(payload.reply ?? ''),
            mutated: Boolean(payload.mutated),
            tools_used: Array.isArray(payload.tools_used) ? (payload.tools_used as string[]) : [],
            ...(typeof payload.elapsed_ms === 'number' ? { elapsed_ms: payload.elapsed_ms } : {}),
            ...(Array.isArray(payload.actions) ? { actions: payload.actions as AiAction[] } : {}),
            ...(Array.isArray(payload.suggestions) ? { suggestions: payload.suggestions as string[] } : {}),
          })
          return
        } else if (eventName === 'error') {
          handlers.onError({
            code: String(payload.code ?? 'upstream_ai_error'),
            message: String(payload.message ?? 'Terjadi kesalahan pada layanan AI.'),
          })
          return
        }
      }
    }
  } catch (err) {
    if (signal.aborted) return
    if (!receivedFirstEvent && !receivedAnyToken) {
      await fallbackJsonChat(body, handlers, signal)
      return
    }
    const e = err as Error & { code?: string }
    handlers.onError({
      code: e.code ?? 'upstream_ai_error',
      message: e.message || 'Koneksi terputus saat menerima jawaban.',
    })
  }
}
