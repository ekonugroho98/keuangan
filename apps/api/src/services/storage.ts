import crypto from 'node:crypto'
import { ApiError } from '@karaya/shared/errors'
import { env } from '../env'

export type StorageProviderName = 'supabase' | 'r2' | 'firebase'

export interface UploadReceiptResult {
  receipt_url: string
  provider: StorageProviderName
  size_bytes: number
  mime_type: string
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024 // 5 MB

function detectMimeAndExt(buf: Buffer, hint?: string): { mimeType: string; ext: string } {
  // Magic bytes detection
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', ext: 'webp' }
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' }
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mimeType: 'image/png', ext: 'png' }
  }

  const normalized = (hint ?? '').toLowerCase().trim()
  if (normalized === 'image/webp') return { mimeType: 'image/webp', ext: 'webp' }
  if (normalized === 'image/png') return { mimeType: 'image/png', ext: 'png' }
  return { mimeType: 'image/jpeg', ext: 'jpg' }
}

/**
 * Abstraksi penyimpanan foto struk/nota lintas provider:
 * - Fase 1 (`STORAGE_PROVIDER=supabase`, default): Supabase Storage bucket `receipts`
 *   (kuota gratis 1 GB = ~12.500 struk WebP ~80KB, 0 biaya tambahan, 1 rumah dengan DB).
 * - Fase 2 (`STORAGE_PROVIDER=r2`): Cloudflare R2 via Worker/endpoint (gratis 10 GB + $0 egress,
 *   muat ~125.000 struk).
 * - Fase 2 alternatif (`STORAGE_PROVIDER=firebase`): Firebase Cloud Storage Blaze (gratis 5 GB
 *   di region US `us-central1`/`us-east1`/`us-west1`, muat ~62.500 struk).
 */
export async function uploadReceiptImage(
  householdId: string,
  input: { image_base64: string; mime_type?: string },
): Promise<UploadReceiptResult> {
  const rawBase64 = input.image_base64.replace(/^data:[^;]+;base64,/, '').trim()
  const buf = Buffer.from(rawBase64, 'base64')
  if (buf.byteLength === 0) {
    throw new ApiError('validation_error', 'Data gambar struk kosong atau tidak valid.')
  }
  if (buf.byteLength > MAX_RECEIPT_BYTES) {
    throw new ApiError('payload_too_large', 'Ukuran gambar struk maksimal 5 MB.')
  }

  const { mimeType, ext } = detectMimeAndExt(buf, input.mime_type)
  const yyyyMm = new Date().toISOString().slice(0, 7)
  const objectPath = `${householdId}/${yyyyMm}/${crypto.randomUUID()}.${ext}`
  const provider = env.STORAGE_PROVIDER

  if (provider === 'r2') {
    if (!env.R2_UPLOAD_WORKER_URL) {
      throw new ApiError('internal_error', 'R2_UPLOAD_WORKER_URL belum dikonfigurasi.')
    }
    const baseUrl = env.R2_UPLOAD_WORKER_URL.replace(/\/+$/, '')
    const res = await fetch(`${baseUrl}/receipts/${objectPath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        ...(env.R2_UPLOAD_TOKEN ? { Authorization: `Bearer ${env.R2_UPLOAD_TOKEN}` } : {}),
      },
      body: new Uint8Array(buf),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new ApiError('internal_error', `Gagal mengunggah struk ke R2 (${res.status}): ${errText.slice(0, 200)}`)
    }
    return {
      receipt_url: `${baseUrl}/receipts/${objectPath}`,
      provider: 'r2',
      size_bytes: buf.byteLength,
      mime_type: mimeType,
    }
  }

  if (provider === 'firebase') {
    if (!env.FIREBASE_STORAGE_BUCKET) {
      throw new ApiError('internal_error', 'FIREBASE_STORAGE_BUCKET belum dikonfigurasi.')
    }
    const encodedName = encodeURIComponent(`receipts/${objectPath}`)
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${env.FIREBASE_STORAGE_BUCKET}/o?uploadType=media&name=${encodedName}`
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: new Uint8Array(buf),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new ApiError('internal_error', `Gagal mengunggah struk ke Firebase (${res.status}): ${errText.slice(0, 200)}`)
    }
    const meta = (await res.json()) as { downloadTokens?: string }
    const tokenParam = meta.downloadTokens ? `&token=${meta.downloadTokens.split(',')[0]}` : ''
    return {
      receipt_url: `https://firebasestorage.googleapis.com/v0/b/${env.FIREBASE_STORAGE_BUCKET}/o/${encodedName}?alt=media${tokenParam}`,
      provider: 'firebase',
      size_bytes: buf.byteLength,
      mime_type: mimeType,
    }
  }

  // Default: Supabase Storage ('supabase')
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError('internal_error', 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diperlukan untuk menyimpan foto struk.')
  }
  const supabaseBase = env.SUPABASE_URL.replace(/\/+$/, '')
  const uploadUrl = `${supabaseBase}/storage/v1/object/receipts/${objectPath}`
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': mimeType,
      'x-upsert': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: new Uint8Array(buf),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new ApiError('internal_error', `Gagal mengunggah struk ke Supabase Storage (${res.status}): ${errText.slice(0, 200)}`)
  }
  return {
    receipt_url: `${supabaseBase}/storage/v1/object/public/receipts/${objectPath}`,
    provider: 'supabase',
    size_bytes: buf.byteLength,
    mime_type: mimeType,
  }
}

export async function resolveReceiptUrl(
  householdId: string,
  input: {
    receipt_url?: string | null
    receipt_image_base64?: string
    receipt_mime_type?: string
  },
): Promise<string | null | undefined> {
  if (input.receipt_image_base64) {
    const uploaded = await uploadReceiptImage(householdId, {
      image_base64: input.receipt_image_base64,
      mime_type: input.receipt_mime_type,
    })
    return uploaded.receipt_url
  }
  return input.receipt_url
}
