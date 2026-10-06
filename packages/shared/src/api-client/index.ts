import createClient from 'openapi-fetch'
import type { paths } from './schema'

export type { paths } from './schema'

export interface KaryaClientOptions {
  baseUrl: string
  /** Mengembalikan token terbaru (JWT Supabase atau API key) setiap request — bukan nilai statis,
   * supaya token yang di-refresh di tengah sesi otomatis ikut terpakai. */
  getToken: () => string | null | Promise<string | null>
  /** Mengembalikan household aktif terbaru setiap request (bisa berubah lewat HouseholdSwitcher
   * tanpa perlu membuat ulang client) — pola sama dengan getToken, BUKAN nilai statis. */
  getHouseholdId?: () => string | undefined
}

/**
 * Client typed dari OpenAPI apps/api (02-monorepo.md §4). Dipakai apps/web (Fase 4) dan bisa dipakai
 * skrip/tool lain yang butuh akses terketik ke /v1/*. Regenerasi: `pnpm gen:api-client` (apps/api
 * harus jalan di localhost:8787).
 */
export function createKaryaClient({ baseUrl, getToken, getHouseholdId }: KaryaClientOptions) {
  const client = createClient<paths>({ baseUrl })
  client.use({
    async onRequest({ request }) {
      const token = await getToken()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      const householdId = getHouseholdId?.()
      if (householdId) request.headers.set('X-Household-Id', householdId)
      return request
    },
  })
  return client
}
