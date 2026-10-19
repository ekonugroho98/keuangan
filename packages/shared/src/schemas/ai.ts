import { z } from '@hono/zod-openapi'

export const AiChatMessageSchema = z.object({
  role: z.enum(['user', 'ai']),
  text: z.string(),
})

export const AiChatBodySchema = z
  .object({
    messages: z.array(AiChatMessageSchema).min(1),
    allow_write: z.boolean().default(false).openapi({
      description: 'Izinkan AI memanggil tool TULIS (catat transaksi, dst.) lewat chat, bukan cuma baca. Default false (06-agent-integration.md §2, Fase 6 F6-T5) — belum ada toggle UI untuk ini di web, disediakan untuk klien lain (mis. Hermes/MCP) yang eksplisit mengaktifkannya.',
    }),
  })
  .openapi('AiChatBody')

export const AiChatResponseSchema = z
  .object({
    reply: z.string(),
    mutated: z.boolean().optional(),
    tools_used: z.array(z.string()).optional(),
  })
  .openapi('AiChatResponse')

// Salah satu dari (image_base64 + mime_type) untuk mode vision, atau ocr_text untuk mode
// teks-saja (hasil OCR client-side yang perlu distrukturkan AI) — lihat AddTransactionModal.jsx.
export const ScanReceiptBodySchema = z
  .object({
    image_base64: z.string().optional(),
    mime_type: z.string().optional(),
    ocr_text: z.string().optional(),
  })
  .refine((v) => (!!v.image_base64 && !!v.mime_type) || !!v.ocr_text, {
    message: 'Kirim image_base64+mime_type (mode vision) atau ocr_text (mode teks).',
  })
  .openapi('ScanReceiptBody')

export const ScanReceiptItemSchema = z.object({
  note: z.string(),
  qty: z.number().optional(),
  amount: z.number(),
  discount: z.number().optional(),
  category: z.string(),
})

export const ScanReceiptResponseSchema = z
  .object({
    merchant: z.string().optional(),
    date: z.string().nullable().optional(),
    subtotal: z.number().nullable().optional(),
    receipt_url: z.string().url().nullable().optional(),
    items: z.array(ScanReceiptItemSchema).optional(),
    error: z.string().optional(),
  })
  .openapi('ScanReceiptResponse')

