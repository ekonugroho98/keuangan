import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ApiError } from '@karaya/shared/errors'
import { CreateHouseholdBodySchema, UpdateSettingsBodySchema, UpdateHouseholdBodySchema } from '@karaya/shared/schemas'
import { requireUserId, assertScope } from '../auth/middleware'
import { withUserClaims } from '../db/tx'
import * as households from '../services/households'

const OkAny = { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } }

// ── Rute yang hanya butuh JWT valid, BELUM TENTU sudah punya household (onboarding) ──────────
// requireUserId(c) dipanggil di DALAM tiap handler, bukan lagi meApp.use('*', requireUser()) —
// bug arsitektur nyata Fase 6: wildcard itu TERBUKTI bocor ke SEMUA sub-app lain yang di-mount ke
// root app (lihat komentar panjang di requireUserId, auth/middleware.ts).
export const meApp = new OpenAPIHono()

meApp.openapi(
  createRoute({ method: 'get', path: '/v1/me', tags: ['me'], summary: 'Info user & keanggotaan household', security: [{ bearerJwt: [] }], responses: OkAny }),
  async (c) => {
    const userId = await requireUserId(c)
    return c.json(await households.getMe(userId, c.get('userEmail')))
  },
)

meApp.openapi(
  createRoute({
    method: 'post', path: '/v1/households', tags: ['me'], summary: 'Buat household baru (onboarding)',
    security: [{ bearerJwt: [] }], request: { body: { content: { 'application/json': { schema: CreateHouseholdBodySchema } } } },
    responses: { 201: { content: { 'application/json': { schema: z.any() } }, description: 'Dibuat' } },
  }),
  async (c) => c.json(await households.createHousehold(await requireUserId(c), c.req.valid('json')), 201),
)

meApp.openapi(
  createRoute({ method: 'get', path: '/v1/me/settings', tags: ['me'], summary: 'Pengaturan user', security: [{ bearerJwt: [] }], responses: OkAny }),
  async (c) => {
    const userId = await requireUserId(c)
    const rows = await withUserClaims(userId, (tx) => tx<{
      avatar_color: string; hidden_menus: unknown; app_name: string; app_tagline: string
      language: string; theme: string; active_household_id: string | null; ai_config: { provider?: string; model?: string; apiKey?: string; disabled?: boolean }
    }[]>`select avatar_color, hidden_menus, app_name, app_tagline, language, theme, active_household_id, ai_config from user_settings where user_id = ${userId}`)
    const row = rows[0]
    if (!row) return c.json({ avatar_color: '#46634E', hidden_menus: [], app_name: 'Keluarga Berkembang', app_tagline: 'Berkembang Bersama dalam Kehangatan', language: 'id', theme: 'dark', active_household_id: null, ai_config: { has_api_key: false } })
    const { ai_config, ...rest } = row
    const rawKey = (ai_config?.apiKey ?? (ai_config as Record<string, string | undefined>)?.api_key ?? '').trim()
    const isGatekeeperKey = rawKey.startsWith('sk-kb-')
    const resolvedProvider = isGatekeeperKey ? 'gatekeeper' : ai_config?.provider
    const resolvedModel = isGatekeeperKey && (!ai_config?.model || !ai_config.model.startsWith('kb-')) ? 'kb-auto' : ai_config?.model
    return c.json({ ...rest, ai_config: { provider: resolvedProvider, model: resolvedModel, has_api_key: rawKey.length > 0, disabled: ai_config?.disabled ?? false } })
  },
)

meApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/me/settings', tags: ['me'], summary: 'Ubah pengaturan user', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: UpdateSettingsBodySchema } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } }, description: 'OK' } },
  }),
  async (c) => {
    const userId = await requireUserId(c)
    const body = c.req.valid('json')
    await withUserClaims(userId, async (tx) => {
      const [existing] = await tx<{ ai_config: Record<string, unknown> }[]>`select ai_config from user_settings where user_id = ${userId}`
      const mergedAiConfig = body.ai_config
        ? { ...(existing?.ai_config ?? {}), ...(body.ai_config.provider !== undefined ? { provider: body.ai_config.provider } : {}), ...(body.ai_config.model !== undefined ? { model: body.ai_config.model } : {}), ...(body.ai_config.api_key !== undefined ? { apiKey: body.ai_config.api_key } : {}), ...(body.ai_config.disabled !== undefined ? { disabled: body.ai_config.disabled } : {}) }
        : undefined
      await tx`
        insert into user_settings (user_id, avatar_color, hidden_menus, app_name, app_tagline, language, theme, active_household_id, ai_config)
        values (${userId}, ${body.avatar_color ?? '#46634E'}, ${tx.json(body.hidden_menus ?? [])}, ${body.app_name ?? 'Keluarga Berkembang'}, ${body.app_tagline ?? 'Berkembang Bersama dalam Kehangatan'}, ${body.language ?? 'id'}, ${body.theme ?? 'dark'}, ${body.active_household_id ?? null}, ${tx.json(mergedAiConfig ?? {})})
        on conflict (user_id) do update set
          avatar_color = coalesce(${body.avatar_color ?? null}, user_settings.avatar_color),
          hidden_menus = coalesce(${tx.json(body.hidden_menus ?? null)}, user_settings.hidden_menus),
          app_name = coalesce(${body.app_name ?? null}, user_settings.app_name),
          app_tagline = coalesce(${body.app_tagline ?? null}, user_settings.app_tagline),
          language = coalesce(${body.language ?? null}, user_settings.language),
          theme = coalesce(${body.theme ?? null}, user_settings.theme),
          active_household_id = coalesce(${body.active_household_id ?? null}, user_settings.active_household_id),
          ai_config = coalesce(${tx.json(mergedAiConfig ?? null)}, user_settings.ai_config),
          updated_at = now()
      `
    })
    return c.json({ success: true as const }, 200)
  },
)

// ── Rute yang butuh household aktif (member household yang sudah ada) ───────────────────────
// requireAuth() TIDAK lagi didaftarkan per-sub-app (lihat app.ts: sekarang satu kali di root,
// setelah meApp) — bug arsitektur Fase 6, requireAuth() per-sub-app ternyata berjalan BERULANG
// (satu kali untuk SETIAP sub-app yang di-mount sebelumnya) karena wildcard sub-app bocor global.
export const householdApp = new OpenAPIHono()

householdApp.openapi(
  createRoute({ method: 'get', path: '/v1/households/current', tags: ['households'], summary: 'Household aktif', security: [{ bearerJwt: [] }], responses: OkAny }),
  async (c) => c.json(await households.getCurrentHousehold(c.get('actor'))),
)

householdApp.openapi(
  createRoute({
    method: 'patch', path: '/v1/households/current', tags: ['households'], summary: 'Ubah household (owner)', security: [{ bearerJwt: [] }],
    request: { body: { content: { 'application/json': { schema: UpdateHouseholdBodySchema } } } },
    responses: OkAny,
  }),
  async (c) => {
    assertScope(c.get('actor'), 'admin')
    return c.json(await households.updateHousehold(c.get('actor'), c.req.valid('json')))
  },
)

householdApp.openapi(
  createRoute({ method: 'get', path: '/v1/members', tags: ['members'], summary: 'Anggota household', security: [{ bearerJwt: [] }], responses: { 200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: 'OK' } } }),
  async (c) => c.json(await households.listMembers(c.get('actor'))),
)

householdApp.openapi(
  createRoute({
    method: 'delete', path: '/v1/me', tags: ['me'], summary: 'Hapus household & semua data (hanya kalau sendirian)',
    security: [{ bearerJwt: [] }],
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' } },
  }),
  async (c) => {
    const actor = c.get('actor')
    if (actor.credential !== 'jwt') throw ApiError.fromCode('jwt_required')
    return c.json(await households.deleteMyAccount(actor), 200)
  },
)

householdApp.openapi(
  createRoute({ method: 'get', path: '/v1/bootstrap', tags: ['system'], summary: 'Satu panggilan untuk memuat dashboard', security: [{ bearerJwt: [] }], responses: OkAny }),
  async (c) => {
    const actor = c.get('actor')
    const [me, household, members] = await Promise.all([
      households.getMe(actor.userId, actor.email),
      households.getCurrentHousehold(actor),
      households.listMembers(actor),
    ])
    return c.json({ me, household, members, is_superadmin: me.is_superadmin || household.is_superadmin })
  },
)
