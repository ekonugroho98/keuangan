Status: draft
Terakhir diubah: 2026-10-04
Bergantung pada: 00-ringkasan.md, 01-kondisi-saat-ini.md

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-04 | §4 | `eslint-plugin-import-x` ditunda ke Fase 4 (F4-T6), tidak ditambahkan di Fase 1 | Aturan larangan impor silang web↔api dan larangan `supabase.from(` di apps/web baru bermakna setelah cutover; menambah dependensi tanpa fungsi di Fase 1 tidak ada gunanya. |
> | 2026-10-04 | §6.2 | `apps/api/src/env.ts` hanya memvalidasi `API_PUBLIC_URL`/`CORS_ORIGINS`/`PORT` sebagai wajib di Fase 1; var lain (`DATABASE_URL`, `SUPABASE_*`, `API_KEY_PEPPER`, dst.) `.optional()` sampai masing-masing dipakai nyata | Supaya `pnpm dev` jalan di Fase 1 tanpa seluruh secret produksi. Pola zod + fail-fast dipertahankan, hanya cakupan var wajib bertahap mengikuti fase. |
> | 2026-10-06 | §4, §6.2 struktur `apps/api/src/routes/`, `supabase/functions/`, tabel env | `subscriptions.ts`/`webhooks.ts`/`internal.ts`, `MIDTRANS_SERVER_KEY`, `FUNCTION_SECRET` dihapus dari spec | Fitur subscription/Midtrans dibatalkan total — pemilik produk mengonfirmasi tidak pernah ada pembayaran sungguhan. Detail: `docs/spec/PROGRESS.md` §"Pembatalan total subscription/Midtrans". |

# 02 — Monorepo: Struktur, Tooling, Env, Dev Workflow, Deploy

## 1. Keputusan dasar

- **Package manager: pnpm workspaces** (ADR-01). Versi dipin lewat `packageManager` di root `package.json` dan `.npmrc` (`engine-strict=true`, `auto-install-peers=true`, `shamefully-hoist=false`).
- **Node 22 LTS** (`.nvmrc` = `22`). Vercel build image mendukung Node 22.
- **TypeScript 5.x** untuk `apps/api` dan `packages/shared`; `apps/web` memakai `allowJs` + `checkJs: false` agar JSX lama tetap dibangun tanpa perubahan (ADR-14).
- **Satu lockfile** di root. Tidak ada `package-lock.json` di sub-paket (yang lama dihapus).
- Repo tetap `karaya-keuangan` (git root sama). Tidak ada perubahan remote.

## 2. Struktur folder lengkap

```
karaya-keuangan/
├── .github/workflows/
│   └── ci.yml                     # lint + typecheck + test + build untuk semua paket
├── .nvmrc                         # 22
├── .npmrc
├── .editorconfig
├── .gitignore                     # tambah: dist_*/ , .vercel/ , supabase/.temp/ , *.local
├── package.json                   # scripts root, devDeps bersama (typescript, eslint, prettier, vitest)
├── pnpm-workspace.yaml            # packages: apps/*, packages/*
├── pnpm-lock.yaml
├── tsconfig.base.json             # strict, moduleResolution bundler, paths @karaya/shared
├── eslint.config.js               # flat config: @typescript-eslint, react-hooks, import-x
├── prettier.config.js
├── vitest.workspace.ts            # menyatukan project vitest api + shared + web
├── README.md                      # diperbarui: cara jalan monorepo
├── PANDUAN.md                     # diperbarui bertahap (Fase 7)
├── API_DOCS.md                    # DIHAPUS di Fase 6; diganti /v1/docs. Sampai saat itu diberi banner "deprecated"
├── docs/
│   ├── spec/                      # spec ini + PROGRESS.md
│   └── adr/                       # ADR panjang bila ada keputusan baru saat implementasi (opsional)
├── apps/
│   ├── web/                       # frontend (migrasi dari src/)
│   │   ├── index.html
│   │   ├── package.json           # name: @karaya/web
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json          # extends ../../tsconfig.base.json, allowJs
│   │   ├── vercel.json            # rewrites SPA, header cache
│   │   ├── .env.example
│   │   ├── public/
│   │   └── src/
│   │       ├── main.jsx, App.jsx  # dipindah apa adanya di Fase 1
│   │       ├── api/               # BARU (Fase 4): client.ts (openapi-fetch), queries/ (TanStack Query hooks)
│   │       ├── auth/              # BARU: supabase client hanya untuk auth, SessionProvider
│   │       ├── components/        # dipindah apa adanya; file baru .tsx
│   │       ├── hooks/             # hook lama dihapus di Fase 4, diganti src/api/queries/*
│   │       ├── i18n/, pages/, constants/, utils/, config/
│   │       └── lib/supabase.js    # tetap untuk auth; import dari tabel dilarang lewat lint rule
│   └── api/                       # backend Hono
│       ├── package.json           # name: @karaya/api
│       ├── tsconfig.json
│       ├── vercel.json            # functions: api/index.ts, maxDuration 60
│       ├── .env.example
│       ├── api/
│       │   └── index.ts           # entry Vercel: export default handle(app) dari hono/vercel
│       ├── src/
│       │   ├── app.ts             # membangun Hono app: middleware global + mount routes
│       │   ├── server.ts          # entry lokal: @hono/node-server, port 8787
│       │   ├── env.ts             # zod parse process.env, gagal cepat
│       │   ├── db/
│       │   │   ├── client.ts      # postgres.js pool ke pooler
│       │   │   ├── tx.ts          # withActor(actor, fn): BEGIN; SET LOCAL ROLE authenticated; set_config claims; fn; COMMIT
│       │   │   └── errors.ts      # map SQLSTATE/MESSAGE plpgsql → ApiError
│       │   ├── auth/
│       │   │   ├── jwt.ts         # verifikasi JWT Supabase (jose, JWKS + fallback HS256)
│       │   │   ├── api-key.ts     # parse kf_live_, hash, lookup, scope check
│       │   │   ├── actor.ts       # tipe Actor {household_id, member_id, user_id, role, credential, scopes}
│       │   │   └── middleware.ts  # requireAuth(scope), resolveHousehold (X-Household-Id)
│       │   ├── middleware/
│       │   │   ├── idempotency.ts
│       │   │   ├── rate-limit.ts
│       │   │   ├── audit.ts
│       │   │   ├── request-id.ts
│       │   │   ├── cors.ts
│       │   │   └── error-handler.ts   # envelope {error:{code,message,hint,candidates?}}
│       │   ├── routes/            # satu file per resource, pakai createRoute dari @hono/zod-openapi
│       │   │   ├── households.ts, members.ts, invitations.ts, accounts.ts, categories.ts,
│       │   │   ├── transactions.ts, transfers.ts, budgets.ts, goals.ts, debts.ts, piutang.ts,
│       │   │   ├── recurrings.ts, split-bills.ts, investments.ts, summary.ts, reports.ts,
│       │   │   ├── resolve.ts, api-keys.ts, audit-log.ts, me.ts, settings.ts, ai.ts, health.ts
│       │   │   # (subscriptions.ts/webhooks.ts/internal.ts DIHAPUS 2026-10-06: fitur subscription/
│       │   │   #  Midtrans dibatalkan total, project ini tidak pernah punya pembayaran sungguhan)
│       │   ├── services/          # business logic; dipakai routes DAN ai tools. Tidak tahu HTTP.
│       │   │   ├── accounts.ts, transactions.ts, ... (nama sama dengan routes)
│       │   │   ├── resolver.ts    # resolusi nama akun/kategori/member
│       │   │   └── period.ts      # parse period → {from,to} dalam timezone household
│       │   ├── ai/
│       │   │   ├── providers/     # openai-compatible.ts, anthropic.ts, google.ts
│       │   │   ├── chat.ts        # orchestrasi, 2-pass untuk provider tidak andal
│       │   │   ├── scan-receipt.ts
│       │   │   └── tools.ts       # membangun tool defs dari tools/registry.ts
│       │   ├── tools/
│       │   │   ├── registry.ts    # SATU sumber: nama tool, deskripsi, zod schema, handler → service
│       │   │   └── emit-hermes.ts # skrip: tulis apps/api/tools/hermes-tools.json
│       │   └── openapi.ts         # app.doc('/v1/openapi.json'), /v1/docs (Scalar)
│       ├── tools/
│       │   └── hermes-tools.json  # ARTEFAK HASIL GENERATE, di-commit, dicek CI (diff harus kosong)
│       └── test/
│           ├── unit/              # resolver, period, idempotency hash, error map
│           └── integration/       # butuh DB lokal (supabase start); dijalankan dengan tag
├── packages/
│   └── shared/                    # name: @karaya/shared
│       ├── package.json           # exports: ".", "./schemas", "./constants", "./format", "./api-client"
│       ├── tsconfig.json
│       └── src/
│           ├── schemas/           # zod: Account, Transaction, ... + request/response schema per endpoint
│           ├── constants/         # categories default + sistem, account types, roles, scopes, error codes
│           ├── format/            # fmtRp, fmtDate, toLocalDateStr, parseAmountId ("45rb", "1,2 juta")
│           ├── errors.ts          # daftar ErrorCode (union literal) + pesan ID default
│           └── api-client/
│               ├── schema.d.ts    # GENERATED oleh openapi-typescript dari apps/api
│               └── index.ts       # createClient<paths>() dari openapi-fetch + auth header injector
├── supabase/
│   ├── config.toml                # BARU: supabase init, project_id, db port 54322
│   ├── migrations/                # BARU: baseline + migrasi bernomor (lihat 04-migrasi-data.md)
│   ├── migrations_down/           # skrip rollback berpasangan (tidak dijalankan CLI)
│   ├── seed.sql                   # household demo untuk dev lokal
│   ├── tests/                     # pgTAP (opsional) atau SQL assert untuk fungsi
│   ├── functions/                 # edge function lama; dihapus bertahap (Fase 4: transactions, financial-ops, auto-recurrings; Fase 6: ai-chat). payment-webhook/update-subscription DIHAPUS LANGSUNG 2026-10-06 (fitur dibatalkan total, bukan dipindah)
│   └── scripts/
│       ├── verify_migration.sql   # skrip verifikasi (04-migrasi-data.md §6)
│       └── backfill_*.sql
└── scripts/
    ├── dev.sh                     # opsional: supabase start + pnpm dev
    └── gen-api-client.sh          # jalankan api lokal → ambil openapi.json → openapi-typescript
```

Yang **dihapus** dari root saat Fase 1: `src/`, `index.html`, `vite.config.js`, `public/` (pindah ke `apps/web`), `dist_*/` (13 folder), `generate_docx.cjs`, `generate_panduan.py`, `generate_pdf.py`, `Panduan_Karaya_Finance.docx/.pdf`, `SS/` (pindah ke `docs/panduan-assets/` kalau PANDUAN masih merujuknya), `scripts/seed_*.py` (mengandung kredensial; diganti `supabase/seed.sql`), `.claude/launch.json` (path basi).

## 3. Konvensi paket

| Paket | `name` | Jenis | Konsumen |
|---|---|---|---|
| `apps/web` | `@karaya/web` | app (Vite) | pengguna |
| `apps/api` | `@karaya/api` | app (Hono) | web, Hermes, AI chat internal |
| `packages/shared` | `@karaya/shared` | library TS, dipublikasikan **hanya** sebagai workspace dependency (`"@karaya/shared": "workspace:*"`) | web, api |

Cara `packages/shared` dikonsumsi:
- Tidak di-build terpisah. `package.json` shared memakai `"exports"` yang menunjuk ke **source TS** (`./src/index.ts`). Vite (web) dan tsx/esbuild (api) mengompilasi TS dari workspace secara langsung. Vercel build untuk api memakai `esbuild` bundling (default Vercel untuk `api/*.ts`) sehingga sumber shared ikut dibundel.
- Alasan: menghindari langkah build dan watch ganda; proyek kecil. Kalau nanti ada paket yang dipublikasikan ke npm, baru tambahkan `tsup`.
- Aturan impor: `apps/web` **tidak boleh** mengimpor dari `apps/api`; `apps/api` **tidak boleh** mengimpor dari `apps/web`. Keduanya hanya boleh mengimpor `@karaya/shared`. Ditegakkan oleh ESLint `import-x/no-restricted-paths`.
- Zod schema request/response didefinisikan di `packages/shared/src/schemas/` dan **diimpor oleh api** untuk `createRoute`. OpenAPI yang dihasilkan api kemudian di-generate balik menjadi `schema.d.ts` untuk client web. Dengan demikian zod adalah sumber, OpenAPI turunan, tipe client turunan dari OpenAPI (bukan langsung dari zod) supaya yang dibaca web identik dengan yang dibaca agent.

## 4. Tooling

| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Lint | ESLint 9 flat config, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-import-x` | Standar; flat config satu file di root. Rule khusus: larang `supabase.from(` di `apps/web` (regex `no-restricted-syntax`) mulai Fase 4. |
| Format | Prettier 3, dipanggil lewat `eslint-config-prettier` agar tidak bentrok | |
| Test runner | Vitest 2 (unit + integration) dengan `vitest.workspace.ts` | Satu runner untuk TS/React. Integration test api butuh `DATABASE_URL` lokal; dilewati otomatis kalau env tidak ada (`describe.skipIf`). |
| Test DB | Supabase CLI lokal (`supabase start`) → Postgres di `localhost:54322` | Sama dengan produksi (ekstensi, auth schema). |
| Test SQL | pgTAP via `supabase test db` untuk fungsi plpgsql | Fungsi atomik adalah inti sistem; wajib diuji di DB. |
| Typecheck | `tsc --noEmit` per paket (`pnpm -r typecheck`) | |
| Dev runner api | `tsx watch src/server.ts` | Tanpa build step. |
| OpenAPI | `@hono/zod-openapi` + `@scalar/hono-api-reference` untuk `/v1/docs` | Scalar merender OpenAPI 3.1 tanpa konfigurasi. |
| Client gen | `openapi-typescript` → `packages/shared/src/api-client/schema.d.ts`; runtime `openapi-fetch` | Ringan (±2 kB), tipe penuh. |
| DB client | `postgres` (postgres.js) | Mendukung `sql.begin()` transaksi, prepared statement off untuk pooler transaction mode (`prepare: false`). |
| JWT | `jose` | Runtime-agnostik (WebCrypto). |
| Hash API key | `crypto.subtle.digest('SHA-256')` | Key sudah acak 256-bit; SHA-256 cukup, dan WebCrypto tersedia di semua runtime target. |
| CI | GitHub Actions: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `build`, plus job `tools-manifest-check` (regenerate `hermes-tools.json` dan `schema.d.ts`, `git diff --exit-code`) | Menjamin artefak generate tidak basi. |

## 5. Skrip root (`package.json`)

```json
{
  "name": "karaya-keuangan",
  "private": true,
  "packageManager": "pnpm@10.23.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "pnpm -r --parallel --stream run dev",
    "dev:web": "pnpm --filter @karaya/web dev",
    "dev:api": "pnpm --filter @karaya/api dev",
    "build": "pnpm -r run build",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "pnpm -r run typecheck",
    "test": "vitest run",
    "test:db": "supabase test db",
    "db:start": "supabase start",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase db push",
    "db:verify": "psql \"$DATABASE_URL\" -f supabase/scripts/verify_migration.sql",
    "gen:api-client": "bash scripts/gen-api-client.sh",
    "gen:tools": "pnpm --filter @karaya/api gen:tools"
  }
}
```

`pnpm dev` menyalakan **web (port 5173) dan api (port 8787)** bersamaan. Web memakai `VITE_API_BASE_URL=http://localhost:8787` dan Vite proxy tidak diperlukan karena api mengizinkan CORS origin `http://localhost:5173`.

## 6. Environment variables

### 6.1 `apps/web` (semua `VITE_*`, tertanam di bundle, **tidak boleh rahasia**)

| Var | Wajib | Contoh | Keterangan |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ya | `https://xxx.supabase.co` | hanya untuk auth |
| `VITE_SUPABASE_ANON_KEY` | ya | `sb_publishable_…` | hanya untuk auth |
| `VITE_API_BASE_URL` | ya | `http://localhost:8787` / `https://api.karaya.app` | base `apps/api` |
| `VITE_PRICES_API_BASE_URL` | tidak | `https://karaya-api-jec2.vercel.app` | karaya-api (emas/saham); menggantikan `VITE_API_BASE_URL` lama yang namanya bentrok |
| `VITE_APP_NAME`, `VITE_APP_TAGLINE` | tidak | `Karaya`, `Wealth Ledger` | branding |

### 6.2 `apps/api`

| Var | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | `postgres://karaya_api:<pw>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require` — role khusus (lihat `03-database.md` §7.4), pooler **transaction mode** |
| `SUPABASE_URL` | ya | untuk JWKS `/auth/v1/.well-known/jwks.json` dan Admin API |
| `SUPABASE_JWT_SECRET` | ya* | fallback verifikasi HS256 kalau project masih memakai symmetric JWT. *Wajib salah satu dari JWKS berhasil atau secret ada. |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | **hanya** untuk Admin API (hapus user). Tidak dipakai jalur domain. |
| `API_PUBLIC_URL` | ya | `https://api.karaya.app` — dipakai di `servers[]` OpenAPI |
| `CORS_ORIGINS` | ya | daftar dipisah koma: `https://karaya.app,http://localhost:5173` |
| ~~`MIDTRANS_SERVER_KEY`~~ | — | **DIHAPUS 2026-10-06** (fitur subscription/Midtrans dibatalkan total) |
| ~~`FUNCTION_SECRET`~~ | — | **DIHAPUS 2026-10-06** (idem) |
| `API_KEY_PEPPER` | ya | string acak 32+ byte; `hash = sha256(pepper || key)` agar dump DB saja tidak cukup untuk brute-force prefix |
| `RATE_LIMIT_PER_MINUTE` | tidak | default 60 |
| `RATE_LIMIT_PER_DAY` | tidak | default 2000 |
| `IDEMPOTENCY_TTL_HOURS` | tidak | default 24 |
| `LOG_LEVEL` | tidak | `info` |
| `NODE_ENV` | otomatis | |

Semua env di-parse oleh `src/env.ts` dengan zod saat boot; var wajib yang kosong → proses gagal start dengan pesan jelas.

### 6.3 `supabase/` (lokal)

`supabase start` menghasilkan nilai lokal (`API URL`, `anon key`, `service_role key`, `DB URL`). Skrip `scripts/dev.sh` menyalin nilai ini ke `apps/api/.env.local` dan `apps/web/.env.local` kalau belum ada.

### 6.4 Rahasia yang tidak boleh ada di repo

`.env*` kecuali `.env.example` di-ignore. `scripts/seed_*.py` lama dihapus karena berisi kredensial. Pre-commit (opsional, `lefthook`) menjalankan `gitleaks` kalau tersedia.

## 7. Dev workflow

```bash
# sekali
nvm use && corepack enable && pnpm install
supabase login && supabase link --project-ref twcrflhvxzatpfrjmqzi   # hanya yang punya akses
supabase start                      # Postgres lokal + Auth + Studio
pnpm db:reset                       # jalankan semua migrations + seed.sql ke DB lokal

# harian
pnpm dev                            # web :5173 + api :8787
pnpm test                           # unit
pnpm test:db                        # pgTAP
pnpm gen:api-client                 # setelah mengubah route/schema
pnpm gen:tools                      # setelah mengubah tools/registry.ts
```

Alur mengubah API: ubah zod schema di `packages/shared/src/schemas` → ubah route/service di `apps/api` → `pnpm gen:api-client` → web mendapat tipe baru → `pnpm gen:tools` kalau menyentuh tool → CI memastikan artefak sinkron.

## 8. Strategi deploy

| App | Target | Cara | Catatan biaya |
|---|---|---|---|
| `apps/web` | Vercel project `karaya-web` (project Vercel yang sudah ada diarahkan ke root directory `apps/web`) | Git integration; `Root Directory = apps/web`, build `pnpm --filter @karaya/web build` dijalankan dari root dengan `installCommand = pnpm install --frozen-lockfile` (Vercel mendeteksi pnpm workspace). | Hobby gratis. |
| `apps/api` | Vercel project `karaya-api-v1`, `Root Directory = apps/api`, Fluid Compute aktif, `maxDuration = 60` untuk `/v1/ai/*` | `apps/api/api/index.ts` mengekspor `handle(app)` dari `hono/vercel`. Satu function menangani semua route (`vercel.json` rewrites `/(.*)` → `/api`). | Hobby gratis; batas eksekusi 60 detik cukup untuk AI chat (2-pass ±20 detik). Hobby melarang pemakaian komersial; kalau produk ini dijual, pindah ke Pro (US$20/bulan) atau Cloudflare Workers (gratis 100k req/hari, Hono didukung). |
| `supabase/` | Project Supabase yang ada | `supabase db push` dari CI job manual (`workflow_dispatch`) setelah backup; edge function lama di-undeploy per fase. | Free tier. Perhatikan pause 7 hari tanpa aktivitas; pg_cron harian dan Hermes menjaga aktivitas. |
| Domain | `karaya.app` → web; `api.karaya.app` → api (asumsi nama; lihat Q-01) | CORS mengizinkan origin web saja. | |

Preview deploy: setiap PR mendapat preview web dan api; web preview memakai `VITE_API_BASE_URL` preview api lewat Vercel env per-branch (`VERCEL_GIT_COMMIT_REF`). Tidak ada DB preview; preview memakai DB produksi hanya untuk pembacaan oleh akun demo (asumsi Q-02), atau dinonaktifkan.

## 9. Observability minimum

- Setiap request punya `X-Request-Id` (dibuat kalau tidak ada), dicatat di log JSON satu baris (`request_id`, `method`, `path`, `status`, `duration_ms`, `actor.member_id`, `credential.type`), tanpa body.
- Vercel Logs cukup untuk Hobby. Error 5xx juga ditulis ke `audit_log` dengan `action='error'` hanya untuk request yang punya actor (supaya ada jejak untuk agent).

## 10. Definisi selesai bab ini

Bab ini dianggap terpenuhi kalau perintah di `08-rencana-implementasi.md` Fase 1 lulus: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, dan `pnpm dev` menyalakan dua app tanpa error.
