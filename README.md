# 💰 Karaya Finance

Platform keuangan rumah tangga. Monorepo pnpm: frontend React (`apps/web`), backend Hono (`apps/api`), kode bersama (`packages/shared`), skema database (`supabase/`).

> Status: dalam revamp dari aplikasi pencatatan pribadi menjadi platform keluarga dengan API publik untuk AI agent. Lihat `docs/spec/` untuk spesifikasi lengkap dan `docs/spec/PROGRESS.md` untuk fase yang sedang berjalan.

---

## Struktur monorepo

```
apps/web        → frontend React + Vite (migrasi dari src/ lama)
apps/api        → backend HTTP API, TypeScript + Hono
packages/shared → tipe, konstanta kategori, formatter uang & tanggal, daftar error code
supabase/       → migrations (sumber kebenaran skema), seed data dev, edge function lama (dihapus bertahap)
docs/spec/      → spesifikasi teknis lengkap revamp
```

Detail lengkap struktur, tooling, dan keputusan arsitektur ada di `docs/spec/02-monorepo.md`.

---

## Setup lokal

### Sekali saja

```bash
nvm use                              # Node 22
corepack enable                      # pnpm 10.23.0 (lihat packageManager di package.json)
pnpm install

cp apps/web/.env.example apps/web/.env       # isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
cp apps/api/.env.example apps/api/.env.local # Fase 1: nilai default sudah cukup untuk jalan
```

Supabase: project yang sudah ada (`twcrflhvxzatpfrjmqzi`) dipakai sebagai database. Untuk pengembangan skema lokal:

```bash
supabase link --project-ref twcrflhvxzatpfrjmqzi   # hanya yang punya akses
supabase start                                      # Postgres lokal + Auth + Studio (butuh Docker)
supabase db reset                                   # jalankan semua migrations/ + seed.sql
```

### Harian

```bash
pnpm dev          # web (:5173) + api (:8787) sekaligus
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Per app saja: `pnpm --filter @karaya/web dev`, `pnpm --filter @karaya/api dev`.

---

## ✨ Fitur

- 📊 Dasbor, transaksi, multi akun (bank/e-wallet/tunai), target finansial, hutang & cicilan
- 📈 Investasi & aset dengan harga emas/saham live (dari `karaya-api`, repo terpisah)
- 🔁 Transaksi berulang, 🏷️ anggaran, 🧾 split bill, 🤝 piutang
- 🤖 AI Coach (chat) dan **API publik untuk AI agent** (lihat `docs/spec/06-agent-integration.md`)
- 👨‍👩‍👧 Household: akun pribadi/bersama, privat/shared, laporan per anggota (sedang dibangun)

---

## 🛠️ Tech stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18 + Vite, TanStack Query (Fase 4) |
| Backend | Hono (TypeScript), jalan di Node lokal / Vercel |
| Database | Supabase Postgres, migrations di `supabase/migrations/` |
| Auth | Supabase Auth (JWT untuk web, API key `kf_live_...` untuk agent) |
| Hosting | Vercel (web & api, project terpisah), Supabase (DB) |
| Harga Emas & Saham | `karaya-api` (repo terpisah, tidak berubah) |

---

## 🔌 API

Dokumentasi API publik (`/v1/*`) interaktif, selalu sinkron dengan kode: `GET /v1/docs` (Scalar UI,
dibangun dari `GET /v1/openapi.json`). Dipakai juga untuk integrasi agent — lihat
`docs/spec/06-agent-integration.md` dan manifest tool `GET /v1/tools/hermes.json`.

---

## 📄 Lisensi

MIT — bebas digunakan dan dimodifikasi.
