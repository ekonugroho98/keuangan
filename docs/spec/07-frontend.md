Status: draft
Terakhir diubah: 2026-10-04
Bergantung pada: 02-monorepo.md, 05-api.md

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-04 | §3 Sidebar | Export CSV tetap generate client-side dari array `transactions` yang sudah di memori (TanStack Query), bukan `GET /v1/transactions/export.csv` | Dibangun Fase 4 sebelum bagian §3 ini ditulis detail; `useTransactions()` sudah menarik SELURUH riwayat transaksi ke client (lihat alasannya di PROGRESS.md Fase 4 — `DasborView`/`LaporanView`/`PrediksiView` butuh array mentah itu juga), jadi endpoint export terpisah tidak menambah kemampuan, hanya duplikasi jalur data. Endpoint backend bisa ditambah nanti kalau dataset membesar dan pendekatan "tarik semua ke client" tidak lagi masuk akal. |
> | 2026-10-04 | §4 Komponen baru | `HouseholdSwitcher`, `MembersSettings`, `InvitationsSettings` digabung jadi satu file `HouseholdPanel.jsx` (tab internal) alih-alih file terpisah; `JoinHouseholdPage` menanam `LoginModal`/`SignupModal` yang sudah ada langsung (bukan komponen auth baru) | Fase 5 — mengurangi jumlah file untuk fungsi yang selalu dipakai bersamaan (buka Settings → Household selalu menampilkan switcher+anggota+undangan sekaligus); reuse modal auth yang sudah ada menghindari duplikasi logika `supabase.auth.*`. `ApiKeysSettings`/`AuditLogSettings` belum dibangun (Fase 6, di luar scope Fase 5). `ApiErrorToast` (kandidat `ambiguous_*` sebagai tombol) belum dibangun — dicatat sebagai utang teknis UX, error tetap tampil via toast biasa dengan pesan+hint teks. |

# 07 — Frontend (`apps/web`)

Bab ini ringkas karena fokus proyek ada di backend dan data. Tujuan frontend: **tidak kehilangan satu pun fitur yang ada**, memindahkan semua akses data ke `apps/api`, dan menambah UI minimum untuk household.

## 1. Migrasi `src/` → `apps/web/`

### Fase 1 (pindah apa adanya)
- `git mv src apps/web/src`, `index.html`, `public/`, `vite.config.js → apps/web/vite.config.ts` (konten sama + `envDir` default), `.env.example`.
- `package.json` baru untuk `@karaya/web` berisi dependensi lama (`react`, `react-dom`, `@supabase/supabase-js`, `tesseract.js`, `docx`, `vite-plugin-pwa`, `workbox-window`) + `@karaya/shared: workspace:*`.
- Ganti nama env `VITE_API_BASE_URL` (lama, untuk harga emas) menjadi `VITE_PRICES_API_BASE_URL` di `goldPrice.js`/`stockPrice.js`, karena `VITE_API_BASE_URL` sekarang untuk `apps/api`.
- Tidak ada perubahan perilaku. Kriteria: `pnpm --filter @karaya/web build` sukses, aplikasi jalan identik.

### Fase 4 (cutover data)
- Tambah `src/api/client.ts`: `createClient<paths>({ baseUrl: VITE_API_BASE_URL })` dari `openapi-fetch`, middleware menyisipkan `Authorization: Bearer <session.access_token>` (dari Supabase auth) dan `X-Household-Id` dari store; interceptor error mengubah envelope `{error}` menjadi `ApiError` (dengan `code`, `message`, `hint`, `candidates`) untuk ditampilkan Toast.
- Tambah TanStack Query (`@tanstack/react-query`) dengan `QueryClientProvider` di `main.jsx`. Query key konvensi: `['household', hid, 'accounts']`, `['household', hid, 'transactions', filters]`, dst. Mutasi meng-invalidate key terkait dan menerapkan hasil respons (akun terdampak) secara optimistik.
- `src/api/queries/*.ts` menggantikan `src/hooks/use*.js` satu per satu: `useAccounts`, `useTransactions(filters)`, `useCategories`, `useBudgets`, `useBudgetStatus`, `useGoals`, `useDebts`, `usePiutang`, `useRecurrings`, `useSplitBills`, `useInvestments`, `useSummary`, `useMembers`, `useSettings`, `useBootstrap`.
- `Dashboard.jsx` berhenti menjadi pemilik state semua entitas. Langkah minimal (bukan rewrite): `fetchAll()` diganti `useBootstrap()`; setiap handler (`addTx`, `editTx`, `deleteTx`, `addTransfer`, `addAccount`, `handleAdjustBalance`, `handleAi`, `saveSettings`, …) memanggil mutasi dari `src/api/mutations/*.ts`; `setAccounts/setTransactions` dihapus, view membaca dari query. Props view tetap sama bentuknya di awal (array `accounts`, `transactions`, …) agar view lama tidak perlu diubah di fase ini, kecuali field yang berganti nama (lihat §3).
- `src/lib/supabase.js` tetap, tetapi ESLint rule melarang `supabase.from(` dan `supabase.functions` di `apps/web`. `src/services/api.js` (`callEdge`) dihapus.
- `hooks/` lama dihapus setelah tidak ada importer.

### TSX bertahap (ADR-14)
`tsconfig.json` web: `allowJs: true`, `jsx: react-jsx`, `strict: true` hanya untuk `.ts/.tsx`. File baru (`api/`, `auth/`, komponen household) ditulis `.tsx`. File lama `.jsx` dikonversi hanya ketika disentuh signifikan (`Dashboard.jsx` kemungkinan besar dikonversi di Fase 4 karena hampir seluruh isinya berubah). Tidak ada fase khusus "konversi TSX".

## 2. Perubahan bentuk data yang dilihat view

| Lama (tabel) | Baru (API) | Dampak |
|---|---|---|
| `tx.account_name` (string) | `tx.account.name`, `tx.account.id`, `tx.account.owner` | semua filter/perbandingan `tx.account_name === a.name` → `tx.account.id === a.id` |
| `tx.to_account` | `tx.to_account?.name/id` | TransaksiView summary transfer masuk/keluar |
| `tx.category` (string) | `tx.category.name/id/icon/color` | semua grouping by kategori → by `category.id`, label `category.name` |
| `tx.icon` | `tx.category.icon` | |
| `acc.balance` | `acc.balance` (null bila privat orang lain) | tampilkan "••••" dan badge kunci |
| `budget.month "YYYY-MM"`, `budget.category` | `budget.period_start "YYYY-MM-01"`, `budget.category.{id,name}`, `budget.member|null` | AnggaranView dropdown bulan memetakan ke `period_start`; status dari `/v1/budgets/status` |
| `debt.remaining`, `goal.current`, `piutang.remaining` | sama nama, sekarang derived | tidak berubah |
| `debt.due_date` string | `YYYY-MM-DD` atau null | `fmtDate` aman |
| `recurring.account_name/category` | `recurring.account.{id,name}`, `recurring.category.{…}`, `recurring.type`, `recurring.status` | BerulangView tidak lagi menebak income dari nama kategori |
| `split_bill_members[].paid` | `paid_at` (truthy) | |
| `user_settings.ai_config.apiKey` | `has_api_key` | Sidebar AI settings tidak lagi menampilkan key tersimpan; input kosong = tidak diubah, tombol "Hapus key" |
| — | `me.memberships`, `household`, `members` | konteks baru |

Helper transisi di `packages/shared/src/format/legacy.ts`: `txAccountName(tx)`, `txCategoryName(tx)` agar view lama bisa diubah dengan find-replace minimal.

## 3. Pemetaan per view

| View | Perubahan Fase 4 (paritas) | Perubahan Fase 5 (household) |
|---|---|---|
| `DasborView` | Data dari `useBootstrap`/`useSummary(this_month)` + `useReportsTrend(6)`; perhitungan bulan ini/lalu dari `summary.compare`; "tabungan aktual" dari `summary.balance.by_type.tabungan_inflow` + investasi (API menyediakan `summary.saving.actual`) | **Scope switcher** (Household / Saya / Pasangan) di header; kartu akun menampilkan `OwnerBadge`; `hidden_private_accounts` ditampilkan sebagai catatan |
| `TransaksiView` | Filter → `useTransactions(filters)` server-side dengan cursor (tombol "Muat lebih banyak" menggantikan pagination client); summary dari `totals` respons; `involvesAccount` memakai `account.id`/`to_account.id` | Filter **Pemilik/Member** dan **Dicatat oleh**; `OwnerBadge` dan `RecordedByChip` di tiap baris; baris transaksi `source=api_key` diberi ikon robot; transaksi terhapus bisa ditampilkan (toggle) dan di-restore |
| `AkunView` | `useAccounts`; koreksi saldo → mutasi `adjustBalance`; riwayat akun → `useTransactions({account_id})` | Grup akun: "Milik saya", "Milik <pasangan>", "Bersama"; akun privat orang lain tampil terkunci; edit akun: owner, visibility, aliases |
| `KategoriView` | `useCategories` (default sudah dari server, flag `is_system`); total bulan ini dari `useReportsByCategory` | Edit alias kategori; kategori sistem tidak bisa dihapus (tombol disabled + tooltip) |
| `BerulangView` | `useRecurrings`; status dari API; `last_error` ditampilkan sebagai chip merah "Dilewati: saldo tidak cukup"; tombol "Jalankan sekarang" → `runRecurrings` | Kolom pembuat (member) |
| `GoalsView` | `useGoals`, `contributeGoal`; `deadline` dari API | Owner selector saat buat goal (Saya/Bersama/Pasangan); badge owner; riwayat kontribusi (siapa menabung) |
| `HutangView` | `useDebts`, `payDebt`; riwayat pembayaran (baru, dari `GET /v1/debts/{id}/payments`) | Owner selector; aliases |
| `PiutangView` | `usePiutang`, `lendPiutang`, `receivePiutang` | Owner selector |
| `InvestasiView` | `useInvestments`; harga emas/saham tetap langsung ke karaya-api | Owner selector/badge |
| `AnggaranView` | `useBudgets(month)`, `useBudgetStatus(month)`, `copyBudgets` | Tab "Keluarga" vs "Pribadi (saya)"; buat budget member |
| `LaporanView` | `useReportsByCategory`, `useReportsDaily`, `useSummary(period, compare)`; period chips → `period` API; custom → `from/to` | Scope switcher (household / member / akun) + `useReportsByMember`, `useReportsByAccount` → dua kartu baru "Per anggota" dan "Per akun" |
| `PrediksiView` | Tetap hitung di client dari `useTransactions({period: 4 bulan terakhir, type: expense})` (atau `reports/forecast` bila sudah ada) | Scope switcher |
| `SplitBillView` | `useSplitBills` | Tidak ada |
| `AiView` | `handleAi` → `POST /v1/ai/chat`; indikator `tool_calls_made` | Tidak ada |
| `AddTransactionModal` | `account` di form menjadi `account_id`; scan AI → `POST /v1/ai/scan-receipt` (OCR Tesseract tetap lokal); batch → `POST /v1/transactions/batch`; error `insufficient_funds` menampilkan `hint` | Pemilih akun dikelompokkan per pemilik dengan badge; akun privat orang lain hanya muncul di "Ke akun" transfer |
| `AddAccountModal` | → `POST /v1/accounts` | Field pemilik (Saya / Bersama / member lain [owner saja]), visibilitas, aliases (chip input) |
| `Sidebar` | Settings AI: `has_api_key`; Export CSV → unduh `GET /v1/transactions/export.csv` dengan token; profil → `/v1/me`; hapus akun → `DELETE /v1/me` | Menu Settings baru: **Household** (nama, zona waktu, default visibility), **Anggota** (daftar, role, alias, hapus dengan reassign), **Undangan** (buat code, salin link, revoke), **API Key** (buat/rotate/revoke, tampilkan sekali, tabel penggunaan terakhir), **Audit** (owner; tabel `audit_log` ringkas). `HouseholdSwitcher` di atas profil bila > 1 membership |
| `LandingPage`/`SignupModal`/`LoginModal` | Tidak berubah (auth Supabase) | Route `/join/:code`: preview undangan → login/signup → pilih `display_name` dan mode (`fresh`/`merge`) dengan penjelasan konsekuensi → accept |
| `ResetPasswordPage` | Tidak berubah | |
| `App.jsx` | Tambah `QueryClientProvider`, `HouseholdProvider` (memuat `/v1/me`; kalau `memberships` kosong → `OnboardingHousehold` yang memanggil `POST /v1/households`) | Routing sederhana berbasis `window.location.pathname` untuk `/join/:code` (tanpa router library; konsisten dengan yang ada) |

## 4. Komponen baru (semua `.tsx`, di `apps/web/src/components/household/`)

| Komponen | Fungsi |
|---|---|
| `HouseholdProvider` / `useHousehold()` | Menyimpan `me`, `household`, `members`, `activeMemberId`, helper `memberById`, `isOwner`, `displayNameOf(member_id)` |
| `HouseholdSwitcher` | Dropdown household bila > 1; menyimpan `active_household_id` lewat `PATCH /v1/me/settings` |
| `ScopeSwitcher` | Segmented control: Household / Saya / <nama pasangan> / (Akun…) → mengubah `scope`, `member_id`, `account_id` di query; dipakai Dasbor, Laporan, Prediksi |
| `OwnerBadge` | Chip kecil berwarna `member.color` dengan inisial/nama, atau ikon rumah untuk joint; variasi `locked` untuk privat orang lain |
| `RecordedByChip` | "dicatat oleh Rina" (hanya ditampilkan bila `recorded_by ≠ account.owner`) |
| `OwnerSelect` | Field form: Saya / Bersama / member lain (owner only) |
| `VisibilitySelect` | shared / private dengan penjelasan satu kalimat |
| `AliasInput` | Chip input untuk `aliases` (akun, kategori, member, hutang) |
| `MembersSettings` | Tabel anggota, ubah role/alias/warna, hapus dengan dialog reassign |
| `InvitationsSettings` | Buat undangan (email opsional, role), tampilkan code + link + tombol salin + WhatsApp share, daftar pending, revoke |
| `JoinHouseholdPage` | Alur `/join/:code` |
| `ApiKeysSettings` | Daftar key, buat (nama, scope, kedaluwarsa), modal "salin sekarang, tidak akan ditampilkan lagi", rotate, revoke, link ke `/v1/docs` dan panduan Hermes |
| `AuditLogSettings` | Tabel ringkas dengan filter per key |
| `MigrationReviewBanner` | Muncul bila ada akun `needs_review`; link ke AkunView dengan filter |
| `ApiErrorToast` | Toast yang menampilkan `message` + `hint`; untuk `ambiguous_*` menampilkan kandidat sebagai tombol pilihan yang mengirim ulang mutasi dengan `*_id` |

## 5. i18n

Semua string baru ditambahkan ke 6 bahasa di `translations.js` dengan prefix `hh.*` (household), `apikey.*`, `invite.*`, `audit.*`. Pesan error dari API sudah berbahasa Indonesia; untuk bahasa UI lain, frontend memetakan `error.code` ke terjemahan lokal bila tersedia (`t("err." + code)`), fallback ke `message` server. Ini juga alasan `code` harus stabil.

## 6. PWA dan cache

- `runtimeCaching` workbox untuk `*.supabase.co` dibatasi ke `/auth/`; untuk `VITE_API_BASE_URL` **tidak** di-cache (`NetworkOnly`) agar saldo tidak basi; TanStack Query menangani cache di memori dengan `staleTime` 30 detik untuk list dan 0 untuk summary.
- Offline: hanya shell; mutasi offline tidak didukung (non-tujuan).

## 7. Keamanan di browser

- Token Supabase tetap di `localStorage` (perilaku supabase-js). API key **tidak pernah** disimpan di browser; hanya ditampilkan sekali di modal.
- `ai_config.api_key` tidak lagi disimpan di `localStorage` (hapus key `karaya_ai_config` saat Fase 4 load pertama).

## 8. Testing frontend (minimum)

- Vitest + Testing Library untuk: `ApiErrorToast` (render kandidat), `parseAmountId` (shared), `ScopeSwitcher` (mengubah query key), `JoinHouseholdPage` (alur fresh/merge).
- Smoke E2E manual per fase (checklist di `08`), bukan Playwright, untuk menjaga scope.
