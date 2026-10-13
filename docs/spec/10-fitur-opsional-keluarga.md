Status: draft (spec saja, belum ada implementasi)
Terakhir diubah: 2026-10-08 (rev. 12, review tool Hermes)
Bergantung pada: 03-database.md, 05-api.md, 06-agent-integration.md, 07-frontend.md

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-07 | (file baru) | Spec 4 fitur opsional "kelola keluarga" + mekanisme feature flag per household | Permintaan pemilik produk setelah Fase 6 + migrasi data Hermes: aplikasi tetap **fokus keuangan**, tapi fitur keluarga di luar keuangan murni harus bisa **diaktifkan/dimatikan per household** tanpa mengubah perilaku inti saat mati. Ide dipilih dari lubang nyata yang kelihatan saat migrasi (dimensi `untuk` hilang, 3 silo belanja/stok/keuangan, lupa catat, lupa settle). |
> | 2026-10-07 | §6.2, §6.4, §6.5 | `pantry_items` dapat kolom `location` (enum `pantry_location`: `fridge` kulkas, `freezer`, `shelf` lemari/rak dapur, `other`); filter `GET /v1/pantry?location=`; Hermes menebak lokasi dari jenis barang | Pemilik produk: istilahnya tetap "pantry" (stok rumah), bukan "kulkas", tapi harus bisa dibedakan mana yang di kulkas dan mana yang bukan. |
> | 2026-10-07 | §2.1, §6.2, §6.4, §6.6 (baru), §8, §9 | Pengingat kedaluwarsa: kolom `expires_estimated`, `GET /v1/pantry/expiring`, konfigurasi `features.shopping_stock.expiry_reminder`, cron harian Hermes; Q-F9, Q-F10 | Permintaan pemilik produk ("tambahin pengingat kedaluwarsa juga"). |
> | 2026-10-07 | §2.3 | Keputusan navigasi: **tidak ada switch keuangan↔rumah**; fitur opsional masuk sidebar yang sama (grup baru "Rumah" di paling bawah, menu Rekonsiliasi di grup Transaksi), F-A/F-B tanpa menu baru, kartu ringkas di Dasbor | Disetujui pemilik produk: halaman baru hanya 2–3, switch menambah klik dan membuat pantry terasa aplikasi terpisah; keuangan tetap utama. |
> | 2026-10-07 | §2.1, §2.2, §2.4, §3.2, §3.7, §4.4, §5.3, §5.5, §6.2, §7 | **Review silang dengan kode**: referensi salah diperbaiki (cek 22 tool ada di `08` kriteria F6, bukan CI; `PORT-REQUEST.md` tidak ada di repo); fingerprint statement ditambah `seq` (dua baris bank identik tanpa ref_no sebelumnya saling menimpa); `pantry_items` unique jadi partial (`deleted_at is null`) + `created_at` + `shopping_items.pantry_item_id`; `beneficiaries` unique per `member_id`; laporan bulanan **selalu bulan sebelumnya**; penerima tanpa API key di Hermes dilewati; `features` zod `.strict()`; filter query fitur mati → 422; backfill di-throttle (rate limit); batas body Vercel 4,5 MB untuk impor file. | Hasil `review specnya` 2026-10-07 — lihat ringkasan di PROGRESS.md. |
> | 2026-10-07 | §2.2, §2.4, §4.4, §6.5, §6.6, §8 | **Koreksi saat mulai implementasi**: `GET/PATCH /v1/households/current` TERNYATA sudah `both` (jwt + api_key) di `05-api.md` §4.1 dan di kode (`householdApp` di-mount setelah `requireAuth()` tanpa `requireJwtOnly`) — bukan jwt-only seperti ditulis sebelumnya. Endpoint `GET /v1/features` terpisah **dihapus**; `features` cukup jadi field baru di `GET/PATCH /v1/households/current` yang sudah ada, dibaca Hermes langsung (pola sama dengan piutang: dipanggil manual, tidak perlu masuk daftar 22 tool). | Ditemukan saat baca kode `apps/api/src/routes/me.ts` sebelum menulis migrasi F-0, CLAUDE.md aturan 2 (perbaiki spec dulu). |
> | 2026-10-07 | §2.2, §8 | `validation_error` konsisten **400** (bukan 422) di seluruh codebase (`packages/shared/src/errors.ts` `ERROR_HTTP_STATUS`, satu status tetap per code) — field `beneficiary` yang disentuh saat fitur mati memakai 400, bukan 422 | Salah tulis di draft awal, ketahuan dari test integrasi gagal (`expected 400 to be 422`) saat implementasi F-A; selaras dengan konvensi error code yang sudah ada, bukan dibuat pengecualian baru. |
> | 2026-10-07 | §3.2 | `beneficiaries.member_id` FK ditambah `on delete set null` (bukan default `no action`) | Bug nyata: tanpa ini, `remove_member()` (Fase 5) gagal FK violation begitu household punya beneficiary `kind=member` — ketahuan dari `household.test.ts` gagal setelah F-A diaktifkan di household seed yang sama. |
> | 2026-10-07 | §4.3 (implisit) | F-B diimplementasikan dengan memanggil `getSummary()` yang SAMA persis untuk `totals`/`top_categories`/`by_member`/`by_beneficiary`/`budgets`/`goals` (bukan query paralel terpisah) — identik BY CONSTRUCTION, bukan "seharusnya sama" | Lebih kuat dari sekadar uji `diff`; juga menghindari duplikasi logika agregasi. |
> | 2026-10-07 | §6.4, §6.6 | `GET /v1/pantry/expiring` tambah query `exclude_acked` (default false) — draft awal tidak membedakan "mode cron" (harus skip yang sudah di-ack hari ini) vs "pertanyaan manual" (selalu lihat semua) pada endpoint yang sama, padahal keduanya dinyatakan eksplisit di §6.6 | Gap desain ketahuan saat menulis test; cron Hermes nanti HARUS memanggil dengan `exclude_acked=true`, chat manual TIDAK. |
> | 2026-10-07 | §6.2 | `find_pantry_match`/`find_shopping_match` (fungsi SQL baru, bukan pola `resolve_*` jsonb) untuk pencocokan longgar nama item struk ke pantry/shopping | `resolve_*` melempar error utk ambiguous/not_found (cocok untuk validasi keras); alur struk butuh "tebakan terbaik atau tidak sama sekali" best-effort, beda kontrak. |
> | 2026-10-08 | §2.4, §3.5, §6.5 | Tool Hermes diimplementasikan: 10 tool baru (`list_beneficiaries`, `add_beneficiary`, `get_monthly_report`, `ingest_receipt`, `list_shopping`, `add_shopping_item`, `mark_bought`, `shopping_suggestions`, `list_pantry`, `adjust_pantry`) + parameter `beneficiary` opsional di 5 tool inti; total manifest 22→32 (`06-agent-integration.md`). Kata "bersama"/"keluarga" ditambah sebagai sinonim mengosongkan/memfilter beneficiary (pola sama dengan kata kunci akun joint) — dipakai supaya Hermes bisa mengosongkan beneficiary tanpa perlu mengirim JSON `null` lewat tool-calling. | Lanjutan sesi 2026-10-07 setelah backend+web; `mark_bought`/`adjust_pantry` butuh id dari list_shopping/list_pantry dulu (pola sama dengan pay_debt/contribute_goal), bukan pencocokan nama fuzzy — API publik tidak punya endpoint untuk itu. |
> | 2026-10-08 | §2.4, §3.3, §3.4 | **Code review tool Hermes** (10 temuan + 1 sendiri, semua diperbaiki+diuji): sentinel "bersama"/"keluarga"/"none" dipusatkan di `isNoBeneficiarySentinel()` (resolver) dan `resolveBeneficiaryRef` mengembalikan `null` untuk "eksplisit tanpa penerima" vs `undefined` "tidak disentuh" — tiga salinan regex di transactions/summary/resolver yang sudah saling beda (trim, 'none') dihapus; nama sentinel ditolak sebagai nama beneficiary (400); handler tool menormalkan `beneficiary` null/"" dari model jadi undefined (tidak memicu gate 400 di household yang fiturnya mati); `ingest_receipt` dapat param `shopping`/`pantry` (deskripsinya sudah menyebut tapi skemanya belum ada) dan meng-coerce `amount`/`qty` ke Number; `/v1/ai/chat` `buildToolDefs` ikut menyaring `t.feature` (AI Coach web tadinya menawarkan tool F-D ke model walau fiturnya mati → 403 bocor ke chat) + `formatToolResult` dapat case utk 10 tool baru (ARRAY hasil tool baca tadinya jadi "Berhasil."); 3 lookup di `chatWithAi` diparalelkan. | `/code-review high` 2026-10-08 sebelum commit. |
> | 2026-10-07 | §2.1, §2.2, §3.4, §6.3, §6.4 | **Code review sebelum commit** (10 temuan + 3 temuan sendiri, semua diperbaiki & diuji): (1) gate beneficiary bocor lewat `receipts/ingest items[].for` → gate dipindah ke DALAM `resolveBeneficiaryRef` (satu tempat); (2) skema penyimpanan `features` tidak lagi `.strict()` (strip kunci asing + fallback semua-mati, bukan 500 di semua endpoint inti) — strict hanya di body PATCH; (3) `exclude_acked` sekarang persis aturan §6.4 (sekali, sekali lagi hari H, lalu berhenti); (4) `updateHousehold` `select … for update` + `features` hanya ditulis kalau disentuh; (5) rename beneficiary/pantry ke nama yang sudah ada → 400, bukan 500; (6) `GET /v1/summary?scope=beneficiary` menerima `beneficiary=none` dan MENOLAK tanpa referensi (kontrak sama dengan `/v1/transactions`); (7) `PATCH /v1/shopping/{id} transaction_id` divalidasi milik household; (8) `fmtRp` dari `@karaya/shared/format`; (9) 6 error code baru masuk tabel `05-api.md` §7; (10) `/v1/summary` baca timezone+features satu query, `reports` tidak buka koneksi kedua; (11) `enable_beneficiary_feature()` dapat guard owner (terekspos PostgREST RPC); (12) `receipts/ingest` menyimpan `merchant`/`ref_no` ke note (`Nama — Merchant [ref: X]`); (13) `fileParallelism:false` dipindah ke `vitest.config.ts` ROOT (di project config tidak berlaku saat workspace). | `/code-review high` + review sendiri 2026-10-07; 7 test baru (67/67). |

# 10 — Fitur Opsional "Kelola Keluarga" (feature flag per household)

## 1. Prinsip

1. **Inti tetap keuangan.** Semua yang ada di bab 03–07 adalah inti dan selalu aktif. Bab ini hanya menambah,
   tidak mengubah kontrak inti. Household yang tidak mengaktifkan apa pun harus berperilaku **persis** seperti
   sebelum bab ini ada (tidak ada kolom baru yang wajib diisi, tidak ada endpoint inti yang berubah bentuk).
2. **Opt-in per household, default MATI.** Toggle disimpan di DB (bukan env/global), supaya dua anggota melihat
   keadaan yang sama dan Hermes bisa membacanya.
3. **Mati ≠ hapus.** Mematikan fitur menyembunyikan UI/tool dan menolak tulis baru (`403 feature_disabled`), tapi
   data yang sudah ada tetap tersimpan. Menyalakan lagi mengembalikan semuanya.
4. **Hermes adalah antarmuka utama** untuk semua fitur di sini (chat lebih cepat dari form); UI web dibuat
   minimal dan hanya untuk melihat/koreksi. Kalau ragu bikin UI atau tidak: tidak dulu.
5. Setiap fitur punya **kriteria selesai berupa perintah** (§8), bukan "sudah bisa".

Empat fitur, urutan rekomendasi (kecil → besar, nilai → effort):

| Kode | Fitur | Lubang nyata yang ditutup | Ukuran |
|---|---|---|---|
| F-A | Dimensi "untuk siapa" (beneficiary) | Field `untuk` dari data lama hilang saat migrasi 2026-10-06; "bulan ini buat anak berapa?" tak terjawab | 1–2 sesi |
| F-B | Laporan bulanan otomatis ke chat | Dua orang tidak pernah lihat kondisi bulanan kecuali buka app | 1 sesi |
| F-C | Rekonsiliasi mutasi bank | Akar masalah "lupa catat" — mutasi bank jadi sumber kebenaran | 3–4 sesi |
| F-D | Belanja & stok (satu struk → tiga sistem) | `belanja.db` + `kulkas.db` + Karaya = 3 silo; duplikat & salah-skill terjadi 2026-10-07 | 3 sesi |

Prasyarat semuanya: **F-0 mekanisme feature flag** (½ sesi).

## 2. F-0 — Mekanisme feature flag

### 2.1 Database (migrasi `00000000000021_household_features.sql`)

```sql
alter table households add column features jsonb not null default '{}'::jsonb;
comment on column households.features is 'Toggle fitur opsional per household (10-fitur-opsional-keluarga.md §2). Kosong = semua mati.';
```

Bentuk nilai (divalidasi zod `HouseholdFeaturesSchema` di `packages/shared/src/schemas/household.ts`, semua
field opsional, default mati, **`.strict()` di tiap level** supaya salah ketik kunci seperti `"benificiary"` ditolak
`422`, bukan diam-diam diabaikan):

```jsonc
{
  "beneficiary":    { "enabled": false },
  "monthly_report": { "enabled": false, "day": 1, "hour": 8, "channel": "both", "recipients": "all" },
  "reconciliation": { "enabled": false },
  "shopping_stock": { "enabled": false,
                      "expiry_reminder": { "enabled": false, "hour": 7, "days_before": 2, "recipients": "all" } }
}
```

Tidak ada tabel baru untuk flag; `jsonb` cukup karena nilainya kecil, jarang berubah, dan selalu dibaca
sekaligus. Kolom ini **tidak** ikut dihapus saat merge household (ADR merge Fase 5): household target
memakai flag-nya sendiri.

### 2.2 API

| Method | Path | Auth | Scope | Keterangan |
|---|---|---|---|---|
| GET | `/v1/households/current` | **both** (jwt dan api_key — sudah begitu sejak `05-api.md` §4.1, dikonfirmasi di kode) | read | Field baru `features`, flag yang sudah di-resolve dengan default terisi. **Tidak pernah 403** — household tanpa flag sama sekali tetap mengembalikan semua `enabled:false`. |
| PATCH | `/v1/households/current` | both | admin (owner; `assertScope` di handler menolak non-admin, berlaku sama untuk API key admin-scope kalau ada) | Body ditambah `features` (partial merge per fitur; `{"beneficiary":{"enabled":true}}` tidak mereset fitur lain). |

Tidak ada endpoint `/v1/features` terpisah (lihat baris riwayat perubahan di atas) — satu endpoint yang sudah ada
cukup untuk jwt maupun api_key. Hermes memanggilnya langsung lewat HTTP (pola yang sama dengan piutang: tidak
perlu masuk daftar 22 tool bawaan).

Guard di service layer, bukan middleware: `requireFeature(actor, 'beneficiary')` dipanggil di awal fungsi
service yang bersangkutan → `ApiError 403 feature_disabled` dengan `details: { feature }` dan `hint:
"Aktifkan di Settings → Household → Fitur opsional"`. Dipanggil langsung di handler/service (bukan
`.use('*')` di sub-app — lihat catatan bug wildcard kumulatif di `apps/api/src/app.ts`).

Aturan guard: **tulis** ke fitur yang mati selalu 403. **Baca** ke fitur yang mati juga 403 (bukan array kosong),
supaya agent tidak salah simpul "datanya kosong" padahal fiturnya mati. Pengecualian: field/filter opsional di
endpoint inti (mis. `beneficiary` di `POST /v1/transactions`, `?beneficiary=` di `GET /v1/transactions`,
`scope=beneficiary` di `GET /v1/summary`) saat fitur mati → `400 validation_error` dengan hint yang sama (status `validation_error` TETAP 400
seperti semua pemakaian lain, bukan dibuat pengecualian 422 khusus di sini), bukan
diam-diam diabaikan.

Error code baru (wajib ditambah ke `05-api.md` §7 **dan** `packages/shared/src/errors.ts` sekaligus, aturan
CLAUDE.md): `feature_disabled` (403).

### 2.3 Frontend

- `useHouseholdInfo()` (sudah ada, membungkus `GET/PATCH /v1/households/current`) mengekspos `features` — dipakai
  langsung di Sidebar/Settings, tidak perlu hook baru.
- Settings → Household (`HouseholdPanel.jsx`) tab baru **"Fitur opsional"**: daftar toggle + deskripsi satu
  kalimat + field konfigurasi (jadwal laporan). Owner bisa ubah; member melihat read-only (API-nya memang
  owner-only). Ini pola yang sama dengan tab Undangan yang sudah ada.
- Menu/komponen fitur hanya di-render kalau `features.<x>.enabled` — bukan lewat `hidden_menus`
  (itu preferensi per-user, ini per-household; jangan dicampur).

#### 2.3.1 Navigasi (keputusan 2026-10-07): satu sidebar, tanpa switch

**Tidak ada** pengalih "Keuangan ↔ Rumah" / app switcher. Semua fitur opsional masuk `Sidebar.jsx` yang sama,
memakai struktur grup yang sudah ada (`{ group, items }`):

```
RINGKASAN      📊 Dasbor
TRANSAKSI      💳 Transaksi · 🏦 Akun · 🏷️ Kategori · 🔄 Berulang · 🧾 Split bill
               🔍 Rekonsiliasi                     ← features.reconciliation.enabled
PERENCANAAN    🎯 Goals · 📋 Hutang · 🤝 Piutang · 📈 Investasi · 💰 Anggaran
INSIGHT        📉 Laporan · 🤖 AI · 🔮 Prediksi
RUMAH          🛒 Belanja · 🥫 Pantry              ← grup baru, paling bawah, features.shopping_stock.enabled
```

| Fitur | Tempat di UI | Menu baru? |
|---|---|---|
| F-A beneficiary | Field "Untuk" di `AddTransactionModal`, chip + filter di Transaksi, kartu "Per penerima" di Laporan | Tidak |
| F-B laporan bulanan | Tab "Ringkasan bulanan" di Laporan; jadwal di Settings → Fitur opsional | Tidak |
| F-C rekonsiliasi | Item `rekonsiliasi` di grup Transaksi | Ya (1) |
| F-D belanja & pantry | Grup baru "Rumah": item `belanja`, `pantry` | Ya (1 grup, 2 item) |

Aturan:
1. Grup/item di-render hanya kalau flag aktif. Grup yang semua item-nya tersembunyi tidak di-render
   (tidak ada judul grup kosong). Flag mati → sidebar identik dengan sebelum bab ini.
2. Item baru ikut daftar "Tampilkan / sembunyikan menu" (`hidden_menus`) di Settings, jadi anggota bisa
   menyembunyikan Pantry untuk dirinya sendiri tanpa mematikan fitur untuk seluruh household. Urutan
   evaluasi: flag household dulu (mati = tidak ada di daftar sama sekali), baru `hidden_menus` per user.
3. **Dasbor**: kartu ringkas "🥫 n hampir basi · m di daftar belanja" (F-D) dan "🔍 n belum direkon" (F-C),
   masing-masing hanya kalau flag aktif dan angkanya > 0; klik → halaman terkait. Kartu inti Dasbor tidak berubah
   posisi.
4. Label grup lewat i18n (`nav.home`, `nav.shopping`, `nav.pantry`, `nav.reconciliation`), 6 bahasa sesuai
   konvensi `translations.js`.
5. Ditinjau ulang (switch/area terpisah) hanya kalau modul rumah tumbuh hingga ≥ 5 halaman (mis. kalender,
   tugas rumah) dan sidebar terasa penuh — dicatat sebagai baris riwayat baru, bukan diubah diam-diam.

### 2.4 Hermes

- Skill `karaya-finance-api` tambah langkah awal sesi: `GET /v1/households/current` sekali, ambil field
  `features`, simpan di konteks.
- Tool yang terkait fitur mati **tidak ditawarkan** ke model; kalau user minta eksplisit, jawab "fitur X belum
  aktif, nyalakan di Settings → Household → Fitur opsional" (jangan coba panggil lalu dapat 403).
- `tools/registry.ts`: `ToolDefinition` dapat field opsional `feature?: 'beneficiary' | 'monthly_report' |
  'reconciliation' | 'shopping_stock'`, ikut ke-emit di `hermes-tools.json`. Manifest tetap statis/publik
  (berisi semua tool); penyaringan dilakukan agent berdasarkan `features` dari `GET /v1/households/current`.
  **Konsekuensi**: kontrak
  "total 22 tool" (`06` §2 dan kriteria selesai F6 di `08-rencana-implementasi.md`: `jq -e 'length==22'`) berubah —
  angka di kedua spec itu harus diperbarui bersamaan dengan tiap fitur yang menambah tool. (Tidak ada cek jumlah
  tool di CI/test saat ini — kalau mau dijaga otomatis, tambah test di `apps/api/test/` saat F-0.)
- Toggle fitur tercatat di `audit_log` otomatis (middleware global sudah mencatat semua PATCH).

## 3. F-A — Dimensi "untuk siapa" (beneficiary)

### 3.1 Masalah

Karaya tahu **dari akun mana** (dan siapa pemilik akunnya) uang keluar, tapi tidak tahu **untuk siapa**.
Data lama Hermes punya kolom `untuk` (`keluarga`, `anak`, `ibu`, `istri`, `orang tua`, `kontrakan`, `Seno
(adik)`) yang saat migrasi 2026-10-06 terpaksa dilempar ke teks `note` (`[untuk: ...]`) karena tidak ada
tempatnya. Pertanyaan "bulan ini kita keluar berapa buat anak? buat orang tua?" — inti "kelola keluarga" — tidak
bisa dijawab API.

Penting dibedakan dari konsep yang sudah ada:
- **pemilik akun** = uang siapa yang keluar;
- **recorded_by** = siapa yang mencatat;
- **titipan/piutang** = siapa *menalangi* siapa;
- **beneficiary** (baru) = siapa/apa yang *menikmati* pengeluaran itu. "Titipan istri beli pampers" →
  beneficiary = **Anak**, bukan Istri.

### 3.2 Data

```sql
create type beneficiary_kind as enum ('member', 'child', 'relative', 'property', 'other');

create table beneficiaries (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null check (length(name) between 1 and 60),
  kind          beneficiary_kind not null default 'other',
  member_id     uuid references household_members(id),   -- hanya kalau kind='member'; nama ikut display_name
  aliases       text[] not null default '{}',
  icon          text, color text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create unique index beneficiaries_household_name_idx on beneficiaries (household_id, lower(name)) where deleted_at is null;
create unique index beneficiaries_household_member_idx on beneficiaries (household_id, member_id) where member_id is not null and deleted_at is null;

alter table transactions add column beneficiary_id uuid references beneficiaries(id);
create index transactions_beneficiary_idx on transactions (household_id, beneficiary_id) where deleted_at is null and beneficiary_id is not null;
alter table budgets add column beneficiary_id uuid references beneficiaries(id);   -- F-A fase 2, lihat §3.6
```

Untuk `kind='member'`, `name` adalah **snapshot** `display_name` saat seeding (kolom tetap `not null` demi unique index);
resolver dan respons API memakai `coalesce(household_members.display_name, beneficiaries.name)` lewat join, jadi
ganti nama tampilan member tidak bikin beneficiary-nya basi.

`beneficiary_id IS NULL` berarti **bersama/keluarga** — tidak ada baris "Keluarga" (sama seperti `owner_member_id
NULL` = bersama di `accounts`). Transfer tidak punya beneficiary (pindah dana, bukan pengeluaran).

RLS: `is_household_member(household_id)` untuk select/insert/update/delete — pola tabel domain lain (03 §7.3).
Saat flag dinyalakan pertama kali, `enable_beneficiary_feature(household_id)` (SECURITY DEFINER, pola 0016)
menyemai satu baris `kind='member'` per anggota aktif; selebihnya (Anak, Orang Tua, Kontrakan, Seno) dibuat
user lewat chat/UI. Mematikan flag tidak menghapus baris apa pun.

Fungsi SQL yang berubah: `post_transaction`, `post_transactions_batch` (item jsonb key `beneficiary_id`),
`update_transaction` (patch key `beneficiary_id`, `null` eksplisit = kembali bersama) — tambah parameter
`p_beneficiary_id uuid default null`, validasi beneficiary milik household yang sama (`beneficiary_not_found`).

### 3.3 Resolusi nama

`resolve_beneficiary(household_id, query)` SQL mengikuti `resolve_member` (04 §4): normalisasi `norm_text`,
cocok nama → alias → trgm; `ok | ambiguous | not_found` dengan `candidates`. Untuk `kind='member'` alias
member (`household_members.aliases`, mis. `istri`, `bunda`) ikut dihitung. TS: `resolveBeneficiaryRef` di
`services/resolver.ts` (pola `resolveMemberRef` + shortcut UUID). `POST /v1/resolve` menerima
`kind: "beneficiary"`.

Kata yang sering muncul di chat dan harus jalan tanpa setup tambahan (ditaruh sebagai alias saat seeding
sesuai `kind`): `anak`/`anak-anak`/`bocah` → Anak; `orang tua`/`ortu`/`mertua` → Orang Tua; `kontrakan`/
`rumah` → Kontrakan; nama anak (Seno, Kaysan, Rayyan) → baris `child` masing-masing kalau user membuatnya.

### 3.4 API

| Method | Path | Auth | Scope | Catatan |
|---|---|---|---|---|
| GET/POST | `/v1/beneficiaries` | both | read/write | CRUD standar; POST `{name, kind, member?, aliases?, icon?, color?}` |
| PATCH/DELETE | `/v1/beneficiaries/{id}` | both | write | DELETE = soft delete; ditolak `409 beneficiary_in_use`? **Tidak** — boleh dihapus, transaksi lama tetap menyimpan id-nya (riwayat), filter menampilkan nama dengan tanda "(dihapus)". |
| (inti) | `POST /v1/transactions`, `/batch` (per item), `PATCH /v1/transactions/{id}` | — | — | Field baru opsional `beneficiary_id` **atau** `beneficiary` (nama/alias). |
| (inti) | `GET /v1/transactions` | — | — | Filter `beneficiary=` (nama/alias/uuid; `none` = yang bersama). |
| (inti) | `GET /v1/summary` | — | — | `scope=beneficiary&beneficiary=anak`; dan `by_beneficiary[]` selalu ikut saat flag aktif. |

Error code baru: `beneficiary_not_found` (404, dengan `candidates`), `ambiguous_beneficiary` (409, `candidates`).

### 3.5 Hermes & frontend

- Tool: `record_expense`, `record_expense_batch`, `update_transaction` dapat parameter opsional `for`
  (string, "buat anak", "ortu", "Seno" — diteruskan apa adanya, API yang resolve); `get_summary` dan
  `search_transactions` dapat `beneficiary`; tool baca baru `list_beneficiaries`; tool tulis `add_beneficiary`.
- Aturan perilaku (tambahan di `docs/hermes/SYSTEM_PROMPT.md` §aturan dan skill): kalau user menyebut "buat
  X" → isi `for`. Jangan menebak kalau tidak disebut (kosong = bersama). "Titipan istri" **bukan** `for: istri`
  — itu soal piutang (siapa menalangi), lihat skill §Titipan.
- Web: `AddTransactionModal` select "Untuk" (hanya kalau flag aktif, default "Bersama"); chip `untuk: Anak` di
  `TransaksiView` + filter; kartu "Per penerima" di `LaporanView` (dari `by_beneficiary`).

### 3.6 Fase 2 (opsional, setelah 3.1–3.5 stabil)

Budget per beneficiary (`budgets.beneficiary_id`): "anggaran anak 1,5 jt/bulan". `GET /v1/budgets/status`
menghitung `spent` dari transaksi dengan `beneficiary_id` yang sama. Baru dikerjakan kalau user memang
menganggarkan per orang; kalau tidak, kolomnya tetap kosong.

### 3.7 Backfill data migrasi 2026-10-06

Skrip sekali jalan (`scripts/backfill-beneficiary.ts`, lewat API bukan SQL langsung): baca 96 transaksi
yang `note` mengandung `[untuk: X]`, petakan `keluarga → NULL`, `anak → Anak (child)`, `ibu|istri → member
Ibu`, `orang tua → Orang Tua (relative)`, `kontrakan → Kontrakan (property)`, `Seno (adik) → Seno (relative)`,
lalu `PATCH /v1/transactions/{id} {beneficiary_id}`. Teks `[untuk: ...]` di note **dibiarkan** (riwayat).
Dry-run dulu, cetak tabel mapping, baru eksekusi (pola yang sama dengan `migrate-expenses.mjs` 2026-10-06), **dengan
jeda antar request** — 96 PATCH beruntun pasti kena rate limit per key (8 baris gagal saat migrasi 2026-10-06 karena
ini), jadi skrip harus menangani `429` + `Retry-After` dan bisa dijalankan ulang (PATCH idempoten secara alami).

## 4. F-B — Laporan bulanan otomatis ke chat

### 4.1 Masalah

Dua orang tidak melihat kondisi bulanan kecuali membuka app. Hermes sudah bisa menjawab kalau ditanya, tapi
masalahnya justru tidak ada yang ingat bertanya (sama pola dengan piutang yang lupa di-settle).

### 4.2 Pembagian peran

- **Karaya** menyediakan angkanya dalam satu endpoint siap kirim (supaya Hermes tidak menyusun/menghitung
  sendiri — aturan 4 & 5 system prompt: angka harus dari respons API).
- **Hermes** memiliki jadwal (`cronjob` bawaan) dan kanal (Telegram/WA). Karaya **tidak** mengirim pesan dan
  tidak memanggil Hermes (gateway Hermes tidak terbuka dari internet, hanya localhost di dalam container), jadi
  alternatif "pg_cron → webhook ke Hermes" ditolak.
- **Konfigurasi jadwal disimpan di Karaya** (`features.monthly_report`) supaya kedua anggota melihat/mengubah di
  satu tempat; skill Hermes menyinkronkan cron-nya dari `GET /v1/households/current` (idempoten: buat/ubah/hapus job
  bernama tetap `karaya-monthly-report`).

### 4.3 API

`GET /v1/reports/monthly?month=YYYY-MM` — auth both, scope read. **Selalu tersedia** (flag hanya mengatur
pengiriman terjadwal, bukan endpoint ini). Respons:

```jsonc
{
  "period": { "month": "2026-10", "label": "Oktober 2026", "from": "2026-10-01", "to": "2026-10-31" },
  "totals": { "income": 15000000, "expense": 7962592, "net": 7037408, "saving_rate_pct": 46.9,
              "vs_prev": { "income_pct": null, "expense_pct": null } },
  "top_categories": [ { "name": "Makanan", "amount": 3100000, "pct": 38.9 } ],
  "by_member":      [ { "member": "ekonugroho181", "income": 15000000, "expense": 3744200 } ],
  "by_beneficiary": [ ],                                   // hanya kalau F-A aktif
  "budgets": { "over": [ { "category": "Makanan", "amount": 2000000, "spent": 3100000 } ], "warning": [] },
  "piutang_open": [ { "id": "...", "borrower_name": "Ayah", "remaining": 45000, "days_open": 6 } ],
  "debts_due_soon": [ ], "goals": [ ],
  "accounts": [ { "name": "BCA", "balance": 4055700 } ],
  "largest_transactions": [ { "date": "2026-10-01", "note": "bayar sekolah adek (Seno)", "amount": 2100000 } ],
  "text_id": "📊 Oktober 2026\nMasuk Rp15.000.000 · Keluar Rp7.962.592 · Bersih +Rp7.037.408 (46,9% ditabung)\n..."
}
```

`text_id` = ringkasan Bahasa Indonesia yang sudah jadi (≤ ~1.200 karakter, aman untuk satu pesan WA), disusun
server dari angka yang sama — Hermes tinggal meneruskan. Semua angka dihitung ulang dari sumber yang sama dengan
`GET /v1/summary` (uji: harus identik).

**Privasi**: endpoint ini menghormati visibilitas akun privat untuk *pemanggil* (sama seperti `/v1/summary`:
`hidden_private_accounts`). Karena itu pengiriman terjadwal dilakukan **per penerima dengan API key penerima
itu** (key Ayah untuk Ayah, key Ibu untuk Ibu), bukan satu digest untuk semua — kalau tidak, akun privat Ayah
bocor ke chat Ibu. `recipients: "all"` di flag berarti "tiap member dengan key masing-masing", bukan satu
pesan broadcast.

### 4.4 Flag & Hermes

`features.monthly_report = { enabled, day: 1..28, hour: 0..23 (WIB, zona household), channel: "telegram" |
"whatsapp" | "both", recipients: "all" | [member_id] }`. Skill Hermes: pada `day` jam `hour` → **selalu** ambil bulan
*sebelumnya* (`month = bulan lalu`; `day` hanya menggeser kapan dikirim, mis. tanggal 3 supaya transaksi akhir
bulan yang telat dicatat sudah masuk — laporan bulan berjalan yang masih setengah jalan tidak pernah dikirim
terjadwal, cukup diminta manual lewat chat) → kirim `text_id` → tawarkan "mau detail kategori X?".
Penerima yang API key-nya **tidak dipegang Hermes** dilewati dan disebut sekali di chat owner ("laporan untuk X
tidak bisa dikirim: belum ada API key-nya di Hermes") — Hermes tidak boleh memakai key orang lain untuk itu. Tool baru (read): `get_monthly_report`. Host Hermes UTC — konversi jam WIB → jadwal cron UTC adalah tanggung jawab
skill (zona WIB sudah jadi aturan skill untuk tanggal; jadwal cron mengikuti aturan yang sama).

### 4.5 Frontend

`LaporanView` tab "Ringkasan bulanan" me-render JSON yang sama (bukan hitung ulang di client — ini kesempatan
pertama LaporanView memakai agregasi server, lihat catatan `useTransactions.js`). Settings: toggle + day/hour/
channel/recipients.

## 5. F-C — Rekonsiliasi mutasi bank

### 5.1 Masalah

"Lupa catat" tidak bisa diselesaikan dengan reminder saja. Mutasi bank adalah sumber kebenaran; Karaya harus bisa
membandingkan dirinya dengan itu dan **menemukan sendiri** yang belum tercatat. Skill lama
`family-ledger-reconciliation` sudah menyebut keinginan ini ("akan match auto-scan statement bila ada") tapi tidak
pernah dibangun.

### 5.2 Sumber data

1. **Ekspor file** dari aplikasi bank: myBCA/KlikBCA (CSV/XLSX), BRImo (CSV/PDF), GoPay (riwayat transaksi).
   Parser per sumber di `apps/api/src/services/statements/parsers/{bca,bri,gopay}.ts`, deteksi otomatis dari
   header. **Format pasti belum di tangan** — lihat Q-F4; parser ditulis dari file contoh asli, bukan asumsi.
2. **Screenshot mutasi** → `POST /v1/ai/scan-statement` (pola persis `scan-receipt`: BYOK `ai_config`, respons
   terstruktur `lines[]`), untuk bank yang ekspornya merepotkan. Fase C3.

### 5.3 Data

```sql
create type statement_source as enum ('bca_csv','bri_csv','gopay_csv','vision','manual');
create type statement_match_status as enum ('unmatched','suggested','matched','created','ignored');

create table statement_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid not null references accounts(id),
  source statement_source not null,
  filename text, imported_by_member_id uuid references household_members(id),
  period_from date, period_to date, line_count int not null default 0,
  created_at timestamptz not null default now()
);

create table statement_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references statement_imports(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid not null references accounts(id),
  date date not null, amount bigint not null check (amount > 0),
  direction text not null check (direction in ('in','out')),
  description text not null default '', ref_no text, balance_after bigint,
  seq smallint not null default 1,                -- urutan ke-n di antara baris IDENTIK (tanggal, nominal, arah, ref_no, deskripsi) dalam satu file
  fingerprint text not null,                      -- sha256(account_id|date|amount|direction|ref_no|norm(description)|seq)
  match_status statement_match_status not null default 'unmatched',
  matched_transaction_id uuid references transactions(id),
  match_confidence smallint,                      -- 0..100
  created_at timestamptz not null default now(),
  unique (account_id, fingerprint)                -- impor ulang file yang sama = no-op, bukan duplikat
);
```

`seq` penting: dua kali beli kopi Rp25.000 di hari yang sama tanpa `ref_no` (umum di mutasi BCA) menghasilkan
fingerprint yang sama — tanpa `seq`, baris kedua hilang dianggap duplikat dan rekonsiliasi diam-diam salah.
Dengan `seq`, impor ulang file yang sama tetap no-op, tapi dua baris asli tetap dua baris.

RLS household. Baris statement **bukan** transaksi: tidak mempengaruhi saldo sampai diterima (`created`) atau
dicocokkan (`matched`). Retensi: lihat Q-F5.

### 5.4 Algoritma pencocokan (deterministik, bisa dijelaskan ke user)

Kandidat = transaksi aktif household di akun yang sama, `amount` sama, arah sama (`expense`/transfer-keluar ↔
`out`; `income`/transfer-masuk ↔ `in`), belum dicocokkan ke baris lain, tanggal dalam ±3 hari.

Skor: selisih tanggal 0 hari +50 / ±1 +35 / ±2 +20 / ±3 +5; `ref_no` ditemukan di `transactions.note` +40
(di sinilah mencatat RRN/No. Referensi di note *berguna*, lihat percakapan 2026-10-07 — tetap opsional);
tumpang-tindih kata deskripsi vs note (Jaccard × 20). Hasil: ≥ 60 → `matched` otomatis; 40–59 → `suggested`
(butuh konfirmasi); < 40 → `unmatched`. Satu-ke-satu, kandidat berskor tertinggi menang; seri → yang
tanggalnya paling dekat. Transfer antar akun sendiri: dua baris (keluar di A, masuk di B) dicocokkan ke satu
transaksi `transfer`.

Keluaran impor: `matched`, `suggested`, `unmatched_statement` (ada di bank, tidak di Karaya → kandidat "lupa
catat"), `unmatched_karaya` (ada di Karaya dalam periode & akun itu, tidak ada di bank → mencurigakan: salah
akun, salah nominal, atau transaksi fiktif), dan selisih `balance_after` terakhir vs saldo Karaya.

### 5.5 API

| Method | Path | Scope | Keterangan |
|---|---|---|---|
| POST | `/v1/reconciliation/imports` | write | `multipart/form-data` (file + `account`) **atau** JSON `{account, source:"manual"\|"vision", lines:[{date, amount, direction, description, ref_no?, balance_after?}]}`. Parse → simpan → jalankan pencocokan → kembalikan ringkasan §5.4. Idempoten lewat `fingerprint`. Batas body fungsi Vercel **4,5 MB** — CSV mutasi bulanan jauh di bawah itu; PDF/screenshot besar harus dikompres di sisi Hermes atau dipecah per periode (`413` kalau lewat). |
| GET | `/v1/reconciliation/imports` · `/{id}` | read | Daftar & detail (baris + status + kandidat untuk `suggested`). |
| POST | `/v1/reconciliation/lines/{id}/confirm` | write | `{transaction_id}` — terima pasangan (dari `suggested` atau manual). |
| POST | `/v1/reconciliation/lines/{id}/accept` | write | Buat transaksi dari baris: `{category?, note?, beneficiary?}`; default kategori `Lainnya`, note diawali `[REKON]` + deskripsi bank, `source='import'` (nilai enum `tx_source` yang sudah ada tapi belum pernah dipakai — di sini tempatnya). Untuk baris `in` tanpa pasangan: default kategori `Lainnya` tipe income. |
| POST | `/v1/reconciliation/lines/{id}/ignore` | write | Tandai bukan urusan Karaya (mis. biaya admin yang memang mau diabaikan — atau justru diterima sebagai expense "Biaya bank", user yang putuskan). |
| POST | `/v1/accounts/{id}/adjust-balance` | (ada) | Dipakai di akhir kalau selisih `balance_after` tetap ada dan user memilih menyamakan. Tidak otomatis. |

Error code baru: `statement_parse_error` (422, `details.line`), `statement_line_not_found` (404),
`statement_line_already_resolved` (409). `source='import'` memerlukan `createTransaction` menerima parameter
source internal (hari ini hardcode `'web'` — dicatat PROGRESS.md 2026-10-06 sebagai gap).

### 5.6 Hermes & frontend

- Tool: `import_statement` (dari file/foto yang dikirim di chat — Hermes punya akses file & vision), `
  reconciliation_summary`, `accept_statement_line`, `confirm_statement_line`, `ignore_statement_line`.
- Aturan: **tidak pernah** `accept`/`confirm` otomatis kecuali `matched` (≥ 60) yang memang sudah dicocokkan
  server. `suggested` dan `unmatched` ditampilkan ringkas, satu per baris, minta keputusan user; kategori untuk
  `accept` ditanya kalau tidak jelas dari deskripsi bank.
- Web (fase C2): view "Rekonsiliasi" (flag-gated) — upload, tabel baris dengan status & tombol terima/cocokkan/
  abaikan, badge di kartu akun "direkon terakhir: <tgl>, selisih Rp X".

### 5.7 Fase

C1 parser CSV (dari file contoh) + tabel + pencocokan + API + tool Hermes → C2 UI web → C3 `scan-statement`
vision. C1 saja sudah menutup kasus utama lewat chat.

## 6. F-D — Belanja & stok (satu struk → tiga sistem)

### 6.1 Masalah

Hari ini ada tiga silo: `belanja.db` (daftar belanja), `kulkas.db` (stok), dan Karaya (uang) — dua pertama hidup
sebagai SQLite di dalam container Hermes (persis kondisi `keuangan.db` sebelum dimigrasi 2026-10-06), tanpa UI,
tidak bisa dilihat berdua, dan sudah terbukti bikin salah-skill + "duplikat" palsu (2026-10-07). Satu foto struk
seharusnya sekaligus: catat uang, coret daftar belanja, tambah stok.

Ini fitur yang paling jauh dari "keuangan" — karena itu opt-in; saat mati, tidak ada yang berubah dan skill
Hermes lama tetap memakai SQLite-nya.

### 6.2 Data

```sql
create type shopping_status as enum ('needed','bought','cancelled');
create type shopping_source as enum ('manual','suggested','receipt');
create type pantry_reason as enum ('purchase','consume','adjust','expired');
create type pantry_location as enum ('fridge','freezer','shelf','other');   -- label UI: Kulkas, Freezer, Lemari/rak, Lainnya

-- urutan DDL: pantry_items dulu (shopping_items punya FK ke sana)
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  qty_text text, notes text not null default '',
  status shopping_status not null default 'needed',
  source shopping_source not null default 'manual',
  added_by_member_id uuid references household_members(id),
  pantry_item_id uuid references pantry_items(id),                   -- opsional; terisi kalau nama cocok ke stok (§6.2 pencocokan)
  bought_transaction_id uuid references transactions(id), bought_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index shopping_items_open_idx on shopping_items (household_id, lower(name)) where status = 'needed' and deleted_at is null;

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null, unit text not null default 'pcs',
  qty numeric(12,3) not null default 0, min_qty numeric(12,3),       -- min_qty: ambang "perlu beli"
  location pantry_location not null default 'other',                -- kulkas / freezer / lemari / lainnya
  category text, expires_at date,
  expires_estimated boolean not null default false,                 -- true = tanggal tebakan Hermes (§6.6), bukan dari kemasan/user
  expiry_notified_on date,                                          -- tanggal pengingat terakhir dikirim, cegah spam harian
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index pantry_items_household_name_idx on pantry_items (household_id, lower(name)) where deleted_at is null;
create table pantry_movements (
  id uuid primary key default gen_random_uuid(),
  pantry_item_id uuid not null references pantry_items(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  delta numeric(12,3) not null, reason pantry_reason not null,
  transaction_id uuid references transactions(id), member_id uuid references household_members(id),
  note text not null default '', created_at timestamptz not null default now()
);
```

Pencocokan nama belanja ↔ item struk ↔ stok memakai `norm_text` + trgm (pola resolver yang ada), threshold
sengaja longgar (item struk "BABY HAPY PANTS 32/M" harus cocok dengan daftar "pampers" lewat alias) — alias di
`pantry_items.aliases`, dan `shopping_items` dicocokkan ke pantry dulu lalu ke nama mentah.

### 6.3 Alur struk (inti fitur)

`POST /v1/receipts/ingest` (write) — endpoint baru yang **membungkus** `post_transactions_batch` (endpoint
`/v1/transactions/batch` sendiri tidak berubah):

```jsonc
// request
{ "account": "BCA", "date": "2026-10-06", "merchant": "Indomaret Jatikramat",
  "items": [ { "name": "BABY HAPY PANTS 32/M", "qty": 1, "amount": 48500, "category": "Shopping", "for": "anak" } ],
  "total": 48500, "ref_no": "TIPB2610062015180101",
  "shopping": true, "pantry": true }          // kedua aksi tambahan bisa dimatikan per panggilan
// response
{ "transactions": [ ... ],                                       // hasil batch (bentuk yang sudah ada)
  "shopping": { "marked_bought": [ {"id":"...","name":"pampers"} ], "unmatched": [] },
  "pantry":   { "updated": [ {"name":"pampers","qty_before":0,"qty_after":1} ], "unmatched": [] } }
```

Satu transaksi DB: kalau `post_transactions_batch` gagal (saldo kurang, dll.) tidak ada yang tercoret/
bertambah. Output "apa yang terjadi per item" dikembalikan supaya Hermes melapor jujur ("3 item dicatat, 2
dicoret dari daftar, 1 stok bertambah; 'garam' tidak ketemu di stok"). `total` opsional dipakai untuk
*assert* `sum(items.amount) == total` → `422 receipt_total_mismatch` (diskon/voucher harus sudah dialokasikan
ke item oleh pemanggil, atau dikirim sebagai item negatif? — **tidak**: item `amount` harus net; lihat Q-F7).

**Format note (2026-10-13)**: setiap transaksi dari struk diberi note kanonik **`[Nama Toko] Nama item [ref: NOMOR]`**
(`formatReceiptNote`/`parseReceiptNote` di `packages/shared/src/format`) — dipakai `receipts/ingest` DAN modal scan web
(`/v1/transactions/batch`), supaya toko terbaca di daftar transaksi dan bisa diurai balik (perbandingan harga antar toko,
rekonsiliasi `[ref: …]`). Format lama `Nama — Toko [ref: X]` masih dimengerti parser (data sebelum 2026-10-13).

**Titipan → Piutang (2026-10-13, `apps/api/src/services/titipan.ts`)**: item yang dibelikan untuk orang lain yang akan
mengganti uangnya BUKAN pengeluaran keluarga. Di `receipts/ingest` dan `transactions/batch`, item dikenali sebagai
titipan kalau (1) `items[].titipan: "<nama>"` diisi, (2) nama/note memuat kata "titipan" (nama orang diambil dari teks
sesudahnya, mis. "Sabun titipan Bu Ani" → "Bu Ani"; tanpa nama → "Titipan"), atau (3) kategorinya dipilih "Piutang".
Efek, dalam transaksi DB yang sama dengan `post_transactions_batch`: kategori item dipaksa ke kategori sistem Piutang,
note diberi akhiran `(titipan X)` kalau belum menyebutnya, dan **satu baris `piutang` per orang per struk** dibuat
(`total` = jumlah item orang itu, `from_account_id` = akun struk, `lend_transaction_id` hanya kalau tepat satu item,
`notes` = "Titipan dari <toko>: item, item"). Respons menambah `piutang: [{id, borrower_name, total, items[]}]`. Item
titipan tidak diklasifikasi (tidak ada pencarian web) dan tidak dipelajari ke `category_keywords`; `learnKeywords` juga
mengabaikan kategori sistem apa pun. Pelunasan tetap lewat `POST /v1/piutang/{id}/receipts` yang sudah ada.

### 6.4 API lain

| Method | Path | Scope | Keterangan |
|---|---|---|---|
| GET/POST | `/v1/shopping` ; PATCH/DELETE `/v1/shopping/{id}` | read/write | `?status=needed` default. PATCH `{status:"bought", transaction_id?}`. |
| GET | `/v1/shopping/suggestions` | read | Dari `pantry_items` dengan `qty <= min_qty` yang belum ada di daftar `needed`. |
| GET/POST | `/v1/pantry` ; PATCH/DELETE `/v1/pantry/{id}` | read/write | `GET ?location=fridge\|freezer\|shelf\|other` (boleh nama Indonesia: `kulkas`, `freezer`, `lemari`/`rak`, `lainnya` — dinormalisasi server). POST/PATCH menerima `location` dengan aturan nama yang sama. Pindah lokasi (daging dari kulkas ke freezer) = PATCH `location`, bukan movement. |
| GET | `/v1/pantry/expiring` | read | `?within_days=2` (default dari flag `days_before`), `?include_expired=true` (default true). Response `{expired:[…], expiring:[{id, name, qty, unit, location, expires_at, expires_estimated, days_left}], text_id}` — hanya barang dengan `qty > 0`, urut `expires_at`. `text_id` = pesan siap kirim (kosong kalau tidak ada apa-apa → Hermes **tidak** kirim pesan). |
| POST | `/v1/pantry/expiring/ack` | write | `{ids:[…]}` → set `expiry_notified_on = today`. Barang yang sudah diingatkan tidak muncul lagi di pengingat terjadwal sampai **hari H** (diingatkan sekali lagi di hari kedaluwarsa), lalu berhenti. Tidak memengaruhi `GET /v1/pantry/expiring` biasa (pertanyaan manual selalu lihat semua). |
| POST | `/v1/pantry/{id}/movements` | write | `{delta, reason, note?}` — "abis telur 4" = `delta:-4, reason:consume`. |

Error code baru: `shopping_item_not_found`, `pantry_item_not_found`, `receipt_total_mismatch`.

### 6.5 Hermes & frontend

- Skill `groceries-shopping` dan `fridge-stock` → mengarah ke API ini saat flag aktif (pola deprecation yang
  sama dengan `budget-tracker` 2026-10-06; saat flag mati, skill lama tetap pakai SQLite — jadi deprecation
  **bersyarat**, dicek lewat `features` di `GET /v1/households/current`). Aturan disambiguasi harga/nada-sudah-terjadi yang ditulis
  2026-10-07 tetap berlaku.
- Lokasi: Hermes **menebak** `location` saat barang pertama kali masuk pantry (susu/telur/sayur/buah → `fridge`; daging/ikan/es krim/frozen food → `freezer`; beras/minyak/gula/mie/bumbu kering/popok/sabun → `shelf`; tidak yakin → `other`) dan menyebutkannya di balasan ("telur masuk Kulkas") supaya user bisa koreksi. Barang yang sudah ada di pantry memakai lokasi yang tersimpan, tidak ditebak ulang. "Isi kulkas apa aja?" → `GET /v1/pantry?location=fridge`.
- Tool: `ingest_receipt`, `list_shopping`, `add_shopping_item`, `mark_bought`, `list_pantry`, `adjust_pantry`,
  `shopping_suggestions`.
- Web (minimal, flag-gated): "Belanja" (daftar + centang) dan "Stok" (qty, badge menipis, dikelompokkan per lokasi: Kulkas / Freezer / Lemari / Lainnya). Chat tetap jalur
  utama; UI hanya untuk lihat & koreksi.

### 6.6 Pengingat kedaluwarsa

**Sumber tanggal** (`pantry_items.expires_at`), urut prioritas:
1. User menyebut ("susu UHT exp 20 Okt", "rendang tahan 3 hari") → `expires_estimated = false`.
2. Ada di foto kemasan/struk yang dibaca vision → `false`.
3. Hermes **menebak** dari jenis barang + lokasi saat barang masuk, hanya untuk barang yang memang cepat rusak
   (sayur/buah/susu segar/roti/daging/ikan/masakan/sisa makanan), memakai tabel umur simpan di skill (mis. susu
   segar kulkas 5 hari, roti tawar lemari 4 hari, daging kulkas 2 hari / freezer 90 hari, sayur daun kulkas 4 hari,
   telur kulkas 21 hari) → `expires_estimated = true`, dan menyebutnya di balasan ("roti tawar, perkiraan basi
   10 Okt — bilang kalau tanggal di kemasan beda"). Barang awet (beras, mie, minyak, gula, sabun, popok) **tidak**
   diberi tanggal sama sekali.
4. Pindah lokasi (kulkas → freezer) dengan tanggal tebakan → Hermes menghitung ulang tebakan; tanggal dari user/
   kemasan tidak diubah.

Keterbatasan v1 (sengaja): satu `expires_at` per barang, bukan per batch. Beli telur baru saat telur lama masih ada
→ `expires_at` diganti ke batch terbaru **hanya kalau stok lama sudah 0**; kalau masih ada, tanggal yang lebih awal
dipertahankan (yang diingatkan adalah yang paling dulu basi). Batch terpisah = Q-F9.

**Jadwal**: konfigurasi `features.shopping_stock.expiry_reminder` (`enabled`, `hour` WIB, `days_before` 0–7,
`recipients`). Pola persis laporan bulanan (§4.2): Karaya menyimpan konfigurasi dan menyediakan
`GET /v1/pantry/expiring`; Hermes memiliki cron harian `karaya-expiry-reminder` yang disinkronkan dari
`GET /v1/households/current`. Tiap hari jam `hour`: panggil `/expiring` → kalau `text_id` kosong, **diam** (jangan kirim "tidak
ada yang kedaluwarsa") → kalau ada, kirim lalu `POST /expiring/ack`. Contoh pesan:

```
🥛 Pantry — cek hari ini
Sudah lewat: Roti tawar (Lemari, perkiraan 6 Okt)
Besok: Susu UHT 1 L (Kulkas, 8 Okt)
2 hari lagi: Daging sapi 500 g (Kulkas, perkiraan)
Balas "roti dibuang" / "susu udah abis" biar stoknya aku update.
```

Pantry bukan data keuangan privat, jadi satu pesan yang sama boleh ke semua penerima (beda dengan §4.3).

**Tindak lanjut dari balasan user**: "dibuang/basi" → movement `reason:'expired'` sejumlah sisa stok; "udah abis/
dipakai" → `reason:'consume'`; "masih bagus, exp-nya 15 Okt" → PATCH `expires_at`, `expires_estimated:false`. Barang
yang sering berakhir `expired` jadi bahan laporan bulanan (opsional, F-B): "bulan ini 4 barang dibuang, perkiraan
Rp X" — nilai rupiah hanya kalau barangnya punya `bought_transaction_id` (dari struk), tidak ditebak.

Web: badge merah/kuning di halaman Stok (lewat / ≤ `days_before` hari), tanda "~" untuk tanggal perkiraan.

### 6.7 Migrasi

Skrip sekali jalan dari `belanja.db` (28 baris, 2026-10-07) dan `kulkas.db` (`stock`, `stock_history`) lewat
API (`location` dari `kulkas.db` → `fridge` sebagai default, kecuali datanya sendiri sudah membedakan freezer — dicek saat dump) — pola `migrate-expenses.mjs`: dump JSON via SSH → dry-run mapping → eksekusi dengan `Idempotency-Key`.
Setelah itu SQLite jadi read-only historis (sama seperti `keuangan.db`).

## 7. Urutan, dependensi, ukuran

```
F-0 flag  (½ sesi)  ──► F-A beneficiary (1–2)  ──► F-B laporan (1)  ──► F-C rekonsiliasi (3–4)  ──► F-D belanja&stok (3)
                                 └──── F-B memakai by_beneficiary kalau F-A ada (opsional)
                                 └──── F-D `for` per item memakai F-A kalau ada (opsional)
```

Tiap fitur = satu "Fase" kecil di `08-rencana-implementasi.md` gaya yang sama (tugas bernomor, file, kriteria
selesai berupa perintah). Tidak ada fitur yang memblokir fitur lain selain F-0.

Hal inti yang ikut tersentuh dan harus dicatat sebagai riwayat perubahan di spec aslinya saat dikerjakan:
`03-database.md` (tabel/kolom/fungsi baru), `05-api.md` (§4 endpoint, §7 error code), `06-agent-integration.md`
(jumlah tool, field `feature`), `07-frontend.md` (Settings → Fitur opsional, view baru), `08-rencana-implementasi.md`
(kriteria F6 `length==22`), `packages/shared/src/errors.ts`.

## 8. Kriteria selesai (perintah, bukan "sudah bisa")

```bash
# F-0
curl -s -H "Authorization: Bearer $KEY" $API/v1/households/current | jq -e '.features.beneficiary.enabled==false'
curl -s -X PATCH -H "Authorization: Bearer $JWT" $API/v1/households/current -d '{"features":{"beneficiary":{"enabled":true}}}' | jq -e '.features.beneficiary.enabled==true'
curl -s -X POST -H "Authorization: Bearer $KEY" $API/v1/beneficiaries -d '{"name":"Anak"}' -o /dev/null -w '%{http_code}'   # 201; ulangi setelah toggle off → 403 feature_disabled
# F-A
curl -s -X POST ... /v1/transactions -d '{"type":"expense","account":"BCA","category":"Shopping","amount":48500,"beneficiary":"anak"}' | jq -e '.transaction.beneficiary.name=="Anak"'
curl -s ... '/v1/summary?period=this_month&scope=beneficiary&beneficiary=anak' | jq -e '.totals.expense>0'
pnpm tsx scripts/backfill-beneficiary.ts --dry-run   # tabel mapping 96 baris, 0 "tidak dikenal"
# F-B
curl -s ... '/v1/reports/monthly?month=2026-10' | jq -e '.text_id|length<=1300'
# angka digest == summary:
diff <(curl -s ... '/v1/reports/monthly?month=2026-10' | jq .totals.expense) <(curl -s ... '/v1/summary?period=2026-10' | jq .totals.expense)
# Hermes: cron 'karaya-monthly-report' terdaftar, log pengiriman 1 pesan per penerima
# F-C
curl -s -X POST -H "Authorization: Bearer $KEY" -F file=@mutasi-bca-okt.csv -F account=BCA $API/v1/reconciliation/imports | jq '{matched,suggested,unmatched_statement,unmatched_karaya}'
# impor file yang sama 2x → line_count sama, tidak ada baris baru (fingerprint)
# F-D
curl -s -X POST ... /v1/receipts/ingest -d @struk.json | jq -e '.shopping.marked_bought|length>=1'
curl -s ... '/v1/pantry/expiring?within_days=2' | jq -e '.expiring|all(.days_left<=2)'
# ack lalu panggil lagi di hari yang sama → barang yang sama tidak muncul di pengingat terjadwal; hari-H muncul sekali lagi
# tidak ada barang kedaluwarsa → text_id == "" dan Hermes tidak mengirim pesan (cek log cron)
# pnpm test: test integrasi per fitur, termasuk "flag off → 403" untuk tiap endpoint tulis
# Semua: pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @karaya/web build
```

## 9. Pertanyaan terbuka (jawab sebelum fitur terkait dikerjakan)

| ID | Pertanyaan | Asumsi sementara | Dirujuk |
|---|---|---|---|
| Q-F1 | Siapa boleh menyalakan/mematikan fitur? | Owner saja (konsisten dengan kelola member/API key). | §2.2 |
| Q-F2 | Beneficiary untuk **pemasukan**? ("THR buat anak") | Diizinkan secara skema (kolom ada di `transactions`), UI/Hermes hanya menawarkan di expense dulu. | §3.2 |
| Q-F3 | Laporan: perlu versi **mingguan** juga? | Tidak di v1; endpoint `monthly` cukup, mingguan = `GET /v1/summary?period=this_week` lewat chat. | §4 |
| Q-F4 | Format ekspor mutasi yang dipakai nyata (myBCA? KlikBCA? BRImo CSV atau PDF? GoPay?) — **butuh file contoh asli** sebelum parser ditulis. | Belum diketahui. F-C tidak dimulai sebelum ada minimal satu file contoh per sumber. | §5.2 |
| Q-F5 | Retensi `statement_lines` | Simpan selamanya (kecil); tambah purge > 24 bulan kalau perlu. | §5.3 |
| Q-F6 | Pengiriman digest ke chat **keluarga bersama** (grup) vs DM per orang? | DM per orang (privasi akun privat, §4.3). Grup hanya kalau tidak ada akun privat di household — Hermes cek `hidden_private_accounts==0`. | §4.3 |
| Q-F7 | Diskon/voucher struk: dialokasikan ke item atau jadi satu baris negatif? | Dialokasikan proporsional ke item oleh pemanggil (Hermes), `receipts/ingest` hanya memverifikasi `sum==total`. Baris negatif ditolak skema (`amount>0`). | §6.3 |
| Q-F8 | F-D saat flag **dimatikan lagi** setelah data dimigrasi: skill Hermes balik ke SQLite yang sudah basi? | Tidak — setelah migrasi, SQLite dihapus dari skill (bukan "kondisional" lagi); mematikan flag hanya menyembunyikan. Catat di PROGRESS saat migrasi F-D dijalankan. | §6.5 |
| Q-F9 | Kedaluwarsa per **batch** (telur lama vs telur baru beda tanggal)? | Tidak di v1: satu tanggal per barang, yang paling awal dipertahankan (§6.6). Tambah tabel `pantry_batches` kalau ternyata sering salah ingat. | §6.6 |
| Q-F10 | Pengingat kedaluwarsa bisa dinyalakan **tanpa** daftar belanja (pantry saja)? | Ya secara konsep, tapi v1 tetap satu flag `shopping_stock` dengan sub-toggle `expiry_reminder`. Pecah jadi flag `pantry` terpisah kalau ada household yang mau stok tanpa daftar belanja. | §2.1 |
