import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ApiError } from '@karaya/shared/errors'
import { env } from './env'
import { requireAuth } from './auth/middleware'
import { healthApp } from './routes/health'
import { accountsApp } from './routes/accounts'
import { categoriesApp } from './routes/categories'
import { transactionsApp } from './routes/transactions'
import { transfersApp } from './routes/transfers'
import { budgetsApp } from './routes/budgets'
import { goalsApp } from './routes/goals'
import { debtsApp } from './routes/debts'
import { piutangApp } from './routes/piutang'
import { recurringsApp } from './routes/recurrings'
import { resolveApp } from './routes/resolve'
import { summaryApp } from './routes/summary'
import { meApp, householdApp } from './routes/me'
import { investmentsApp } from './routes/investments'
import { splitBillsApp } from './routes/split-bills'
import { aiApp } from './routes/ai'
import { invitationsApp, invitationsPublicApp } from './routes/invitations'
import { membersApp } from './routes/members'
import { apiKeysApp } from './routes/api-keys'
import { auditLogApp } from './routes/audit-log'
import { toolsApp } from './routes/tools'
import { beneficiariesApp } from './routes/beneficiaries'
import { reportsApp } from './routes/reports'
import { shoppingApp } from './routes/shopping'
import { pantryApp } from './routes/pantry'
import { receiptsApp } from './routes/receipts'
import { pricesApp } from './routes/prices'
import { insightsApp } from './routes/insights'
import { auditMiddleware } from './middleware/audit'

export function buildApp() {
  const app = new OpenAPIHono()

  app.use('*', logger())
  app.use(
    '*',
    cors({
      origin: env.CORS_ORIGINS,
      allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Household-Id', 'X-Request-Id'],
      exposeHeaders: ['X-Request-Id', 'Idempotent-Replayed', 'X-RateLimit-Limit-Minute', 'X-RateLimit-Remaining-Minute'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )

  // Request ID: dibuat kalau belum ada, dikembalikan di header, dipakai untuk korelasi log (02-monorepo.md §9).
  app.use('*', async (c, next) => {
    const id = c.req.header('X-Request-Id') ?? crypto.randomUUID()
    c.set('requestId', id)
    c.header('X-Request-Id', id)
    await next()
  })

  // Audit log (Fase 6): dipasang di root app SEBELUM `.route()` mana pun, sama seperti
  // logger()/cors()/requestId di atas — middleware di root app membungkus SEMUA request termasuk
  // yang ditambahkan lewat .route() belakangan, beda dari wildcard di DALAM sub-app (lihat catatan
  // di bawah soal kenapa sub-app auth harus didaftarkan setelah route publik).
  app.use('*', auditMiddleware())

  // Error handler: envelope seragam {error:{code,message,hint,...}} (05-api.md §2.2).
  app.onError((err, c) => {
    const requestId = c.get('requestId') as string | undefined
    if (err instanceof ApiError) {
      return c.json(err.toBody(requestId), err.status as 400)
    }
    console.error('[unhandled]', requestId, err)
    return c.json({ error: { code: 'internal_error', message: 'Terjadi kesalahan pada server.', request_id: requestId } }, 500)
  })

  // PENTING — bug arsitektur BESAR ditemukan & diperbaiki Fase 6: `app.route(prefix, subApp)`
  // ternyata MENGGABUNGKAN wildcard (`.use('*', ...)`) tiap sub-app yang dipasang ke prefix yang
  // sama ('/') secara KUMULATIF — setiap sub-app baru yang di-mount menambah wildcard-nya ke
  // rantai yang berlaku untuk SEMUA route berikutnya. Efeknya: sebelum diperbaiki, requireAuth()
  // yang didaftarkan terpisah di ~18 sub-app domain (accountsApp.use('*', requireAuth()), dst.)
  // BENAR-BENAR BERJALAN BERULANG — terbukti lewat log nyata: endpoint yang sub-app-nya di-mount
  // di posisi ke-N menjalankan requireAuth() sebanyak (N-1) kali per SATU request (resolusi JWT/API
  // key, query DB membership, rate-limit, DAN insert idempotency_keys semua terulang) — yang
  // terakhir menyebabkan bug nyata: idempotency SELALU gagal idempotency_in_progress pada percobaan
  // PERTAMA, karena panggilan requireAuth() kedua/ketiga/dst. menemukan baris yang baru saja
  // di-insert panggilan sebelumnya (DALAM request yang SAMA) masih 'in_progress'.
  //
  // Perbaikan: requireAuth() SEKARANG hanya didaftarkan SATU KALI di root app (di bawah), BUKAN
  // lagi per sub-app. Middleware wildcard di ROOT app (logger/cors/requestId/audit di atas, dan
  // requireAuth() di bawah) TIDAK kena bug ini — hanya wildcard yang didaftarkan DI DALAM sebuah
  // sub-app yang di-.route()-kan belakangan yang berakumulasi. Middleware yang MENOLAK sesuatu
  // secara spesifik-resource (bukan requireAuth() yang netral) tetap harus dipanggil langsung di
  // dalam handler (assertScope, requireJwtOnly, requireUserId), bukan wildcard di sub-app manapun.
  //
  // Urutan mount jadi penting: publik dulu (tanpa auth sama sekali) → meApp (jwt-only per-handler,
  // belum tentu punya household) → requireAuth() SATU KALI → baru semua sub-app domain yang butuh
  // actor lengkap (household wajib ada).
  app.route('/', healthApp)
  app.route('/', invitationsPublicApp)
  app.route('/', toolsApp)

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerJwt', {
    type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
    description: 'JWT Supabase (frontend web).',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'apiKey', {
    type: 'http', scheme: 'bearer', bearerFormat: 'kf_live_...',
    description: 'API key Karaya (Fase 6) untuk agent/Hermes — format kf_live_<40 base62>.',
  })

  app.doc31('/v1/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Karaya Finance API', version: '0.1.0' },
    servers: [{ url: env.API_PUBLIC_URL }],
  })

  app.get(
    '/v1/docs',
    apiReference({
      spec: { url: '/v1/openapi.json' },
      theme: 'purple',
    }),
  )

  app.route('/', meApp)

  // Satu-satunya pendaftaran requireAuth() di seluruh app — lihat catatan panjang di atas.
  app.use('*', requireAuth())

  app.route('/', householdApp)
  app.route('/', accountsApp)
  app.route('/', categoriesApp)
  app.route('/', transactionsApp)
  app.route('/', transfersApp)
  app.route('/', budgetsApp)
  app.route('/', goalsApp)
  app.route('/', debtsApp)
  app.route('/', piutangApp)
  app.route('/', recurringsApp)
  app.route('/', resolveApp)
  app.route('/', summaryApp)
  app.route('/', investmentsApp)
  app.route('/', splitBillsApp)
  app.route('/', aiApp)
  app.route('/', invitationsApp)
  app.route('/', membersApp)
  app.route('/', apiKeysApp)
  app.route('/', auditLogApp)
  app.route('/', beneficiariesApp)
  app.route('/', reportsApp)
  app.route('/', shoppingApp)
  app.route('/', pantryApp)
  app.route('/', receiptsApp)
  app.route('/', pricesApp)
  app.route('/', insightsApp)

  return app
}
