import { createKaryaClient } from '@karaya/shared/api-client'
import { supabase } from '../lib/supabase'

// Satu-satunya jalur data apps/web → apps/api (02-monorepo.md: "Frontend TIDAK boleh lagi query
// tabel Supabase langsung"). Supabase client di apps/web dipakai HANYA untuk auth (lib/supabase.js);
// client ini membaca token sesi itu di setiap request supaya refresh token otomatis ikut terpakai.
let activeHouseholdId: string | undefined

export function setActiveHouseholdId(id: string | undefined) {
  activeHouseholdId = id
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export const api = createKaryaClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  getToken,
  getHouseholdId: () => activeHouseholdId,
})

/**
 * Lempar ApiError-shaped object dari respons openapi-fetch supaya React Query `error` punya
 * `.code`/`.message`/`.hint`/`.candidates` yang konsisten dengan 05-api.md §2.2 — dipakai di
 * setiap queryFn/mutationFn lewat unwrap(response).
 */
export function unwrap<T>({ data, error }: { data?: T; error?: unknown }): T {
  if (error) {
    const body = error as { error?: { code?: string; message?: string; hint?: string; candidates?: unknown[]; details?: Record<string, unknown> } }
    const e = new Error(body?.error?.message ?? 'Terjadi kesalahan pada server.') as Error & {
      code?: string
      hint?: string
      candidates?: unknown[]
      details?: Record<string, unknown>
    }
    e.code = body?.error?.code
    e.hint = body?.error?.hint
    e.candidates = body?.error?.candidates
    e.details = body?.error?.details
    throw e
  }
  return data as T
}
