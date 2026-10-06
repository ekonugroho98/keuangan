# PROMPT: Buat Spesifikasi Teknis Revamp Karaya Finance → Household Finance Platform

> Cara pakai: salin seluruh isi di bawah garis ini ke Sonnet 5 (Claude Code) dengan working directory di `karaya-keuangan/`. Output yang diminta adalah DOKUMEN SPEC, bukan kode. Kode baru dikerjakan setelah spec disetujui.

---

## Peranmu

Kamu adalah software architect yang akan menulis **spesifikasi teknis lengkap** untuk merombak aplikasi **Karaya Finance** (pencatatan keuangan pribadi) menjadi **platform keuangan keluarga** dengan backend terpisah, API publik yang ramah untuk AI agent, dan model data yang mendukung dua orang (suami dan istri) dalam satu rumah tangga.

Tugasmu di sesi ini **hanya menulis spec**. Jangan menulis kode implementasi. Spec ini akan dipakai oleh dirimu sendiri di sesi-sesi berikutnya sebagai satu-satunya sumber kebenaran, jadi spec harus cukup detail agar kamu bisa mengerjakannya bertahap tanpa kehilangan arah meskipun context hilang.

## Cara kerja yang wajib diikuti

1. **Baca kode dulu, jangan berasumsi.** Sebelum menulis satu baris spec, baca file-file ini dan catat faktanya:
   - `supabase_schema.sql` dan `scripts/add_piutang_table.sql` dan `supabase/fix_subscription_security.sql` (skema aktual)
   - `API_DOCS.md` (kontrak API yang sekarang)
   - `supabase/functions/*/index.ts` (5 edge function: transactions, financial-ops, auto-recurrings, ai-chat, payment-webhook, update-subscription)
   - `src/hooks/*.js` dan `src/services/api.js` (cara frontend akses data sekarang)
   - `src/constants/categories.js`, `src/i18n/translations.js`
   - `README.md`, `PANDUAN.md`
2. **Verifikasi temuan di bagian "Fakta yang sudah diketahui"** di bawah. Kalau ada yang tidak cocok dengan kode, kode yang benar, dan tulis koreksinya di spec.
3. **Tulis spec ke file** `docs/spec/` dengan struktur yang ditentukan di bagian "Format output". Satu file per bab. Jangan menulis semuanya di satu file raksasa.
4. **Setiap keputusan desain harus punya alasan** satu atau dua kalimat. Kalau ada pilihan yang kamu tolak, sebut kenapa.
5. **Pertanyaan terbuka dikumpulkan** di file tersendiri. Jangan berhenti menunggu jawaban. Ambil asumsi yang masuk akal, tandai sebagai asumsi, lanjutkan.
6. Bahasa spec: **Bahasa Indonesia**, istilah teknis boleh Inggris. Nama tabel, kolom, endpoint, dan kode dalam Inggris.

---

## Fakta yang sudah diketahui tentang kode saat ini

Hasil audit awal. Verifikasi ulang, lalu jadikan dasar bab "Kondisi Saat Ini" di spec.

**Stack:** React 18 + Vite (JSX, bukan TS), Supabase (Postgres, Auth, Edge Functions di Deno), hosting Vercel. Satu repo, frontend saja. Harga emas dan saham dari repo terpisah `karaya-api`.

**Database:** 13 tabel, semuanya punya `user_id → auth.users` dan RLS `auth.uid() = user_id`. Tabel: accounts, transactions, goals, debts, piutang, categories, budgets, recurring_transactions, split_bills, split_bill_members, investments, user_settings, subscriptions.

**Masalah struktural yang harus diselesaikan oleh desain baru:**

| # | Masalah | Lokasi | Dampak |
|---|---------|--------|--------|
| 1 | `transactions.account_name` dan `to_account` adalah TEXT, bukan FK ke `accounts.id`. Rename akun memutus relasi. | schema, edge fn transactions | Tidak mungkin punya dua akun bernama sama ("BCA" suami dan "BCA" istri) |
| 2 | `transactions.type` CHECK hanya `income`, `expense`, tapi kode membuat `transfer` | schema vs edge fn | Constraint tidak sinkron dengan kode |
| 3 | `category` disimpan sebagai TEXT di transactions, budgets, recurring. Tabel `categories` ada tapi tidak direferensi FK | schema | Rename kategori tidak propagasi |
| 4 | `debts.due_date` dan `piutang.due_date` bertipe TEXT, `budgets.month` TEXT "YYYY-MM" | schema | Tidak bisa query range dengan benar |
| 5 | `accounts.balance` disimpan sebagai angka yang di-update manual oleh edge function dengan "rollback manual", bukan transaksi DB atau derived | edge fn | Rawan drift saldo kalau satu step gagal |
| 6 | Frontend hooks query Supabase langsung (`supabase.from("debts").insert(...)`) untuk sebagian entitas, dan via edge function untuk sebagian lain | src/hooks | Business logic terbelah di dua tempat |
| 7 | Edge function pakai pola RPC `POST {action: "add-account"}`, bukan REST. Tidak ada OpenAPI, tidak ada idempotency | API_DOCS.md | Sulit dikonsumsi agent, retry bisa dobel catat |
| 8 | Auth hanya JWT user berdurasi 1 jam. Tidak ada API key jangka panjang untuk mesin | API_DOCS.md | Agent harus simpan password user untuk login ulang |
| 9 | Tidak ada konsep rumah tangga, anggota, kepemilikan akun, atau visibilitas | schema | Fitur suami-istri tidak mungkin tanpa migrasi |

Hal yang sudah bagus dan harus dipertahankan: uang sebagai BIGINT rupiah tanpa desimal, validasi saldo cukup sebelum expense, audit trail "Koreksi Saldo", batch insert untuk scan struk, recurring dengan link ke debt, AI chat dengan tool calling server side dan API key tersimpan di DB.

---

## Target yang harus dicapai

### A. Monorepo: backend dan frontend terpisah, satu repo

Keputusan yang sudah diambil, jangan dibuka ulang:

- Struktur monorepo dengan workspace (pnpm workspaces atau npm workspaces, pilih satu dan jelaskan):
  ```
  apps/web        → frontend React (migrasi dari src/ yang sekarang)
  apps/api        → backend HTTP API (TypeScript)
  packages/shared → tipe, skema validasi (zod), konstanta kategori, formatter uang & tanggal
  supabase/       → migrations, seed, edge functions yang masih dipertahankan (kalau ada)
  docs/spec/      → spec ini
  ```
- Backend: **TypeScript + Hono**. Alasan: ringan, bisa jalan di Node, Bun, Vercel, Cloudflare Workers, dan Deno sekaligus, sehingga tidak mengunci hosting. Kalau kamu menemukan alasan kuat untuk framework lain, tulis sebagai pertanyaan terbuka, tapi tetap desain dengan Hono.
- Database tetap **Supabase Postgres**. Auth user tetap **Supabase Auth**.
- Frontend **tidak boleh lagi** query tabel Supabase langsung. Semua lewat `apps/api`. Supabase client di frontend hanya untuk auth (login, session, refresh).
- Backend akses database dengan service role, dan **otorisasi dilakukan di backend** berdasarkan household membership. RLS tetap aktif sebagai lapisan kedua.
- Semua mutasi yang menyentuh lebih dari satu tabel (transaksi + saldo, bayar hutang, topup goal, transfer) **harus atomik** lewat Postgres function (`plpgsql`) atau transaksi DB eksplisit. Tidak boleh lagi "rollback manual" di application layer.

Spec harus menetapkan: struktur folder lengkap, tooling (lint, format, test runner, TS config bersama), cara jalan lokal (`pnpm dev` menyalakan web + api sekaligus), env variables per app, strategi deploy per app, dan bagaimana `packages/shared` dikonsumsi kedua app.

### B. API publik yang ramah AI agent

API ini akan dikonsumsi oleh **Hermes Agent** (agen AI yang dijalankan user di workspace sendiri, berbicara dengan user lewat Telegram) untuk mencatat keuangan keluarga lewat percakapan natural, contoh: *"catat belanja sayur 45rb dari BCA istri"*, *"berapa sisa anggaran makan bulan ini?"*, *"transfer 2 juta dari BCA suami ke tabungan bersama"*.

Prinsip desain yang wajib tercermin di spec:

1. **REST yang jelas, resource-based**, bukan `{action: "..."}`. Versi di path: `/v1/...`.
2. **OpenAPI 3.1 spec** di-generate dari kode (zod → openapi) dan diserve di `/v1/openapi.json`, plus `/v1/docs`. Ini sumber yang akan dibaca agent untuk memahami API.
3. **Dua jenis kredensial:**
   - JWT Supabase (untuk frontend web)
   - **API key** jangka panjang, dibuat user di Settings, di-hash di DB, scoped ke satu household dan satu member, dengan permission scope (`read`, `write`, `admin`) dan bisa dicabut. Dikirim lewat header `Authorization: Bearer kf_live_...`. Ini yang dipakai Hermes.
4. **Idempotency.** Semua POST yang membuat data menerima header `Idempotency-Key`. Request ulang dengan key sama mengembalikan hasil yang sama, bukan catatan ganda. Agent sering retry.
5. **Resolusi nama yang toleran.** Agent menyebut akun dan kategori dengan bahasa manusia. Spec harus mendefinisikan endpoint atau parameter yang menerima `account: "BCA istri"` dan backend yang mencocokkan ke `account_id` lewat nama, alias, dan pemilik. Kalau ambigu (ada "BCA" milik suami dan istri, user hanya bilang "BCA"), API **harus mengembalikan error 409 dengan daftar kandidat**, bukan menebak. Setiap akun punya kolom `aliases TEXT[]`.
6. **Error yang bisa ditindaklanjuti.** Format error seragam: `{ error: { code, message, hint, candidates? } }`. `message` dalam Bahasa Indonesia untuk diteruskan ke user, `code` stabil untuk dibaca program, `hint` menjelaskan cara memperbaiki request. Daftar semua `code` yang ada di spec.
7. **Endpoint ringkasan untuk agent.** Minimal: `GET /v1/summary?period=this_month&scope=household|member`, `GET /v1/budgets/status`, `GET /v1/accounts` dengan saldo dan pemilik. Agent tidak boleh perlu memanggil 6 endpoint untuk menjawab "gimana keuangan bulan ini".
8. **Pencarian transaksi** dengan filter: rentang tanggal, member, akun, kategori, teks catatan, rentang nominal, pagination berbasis cursor.
9. **Tool manifest.** Sediakan file `apps/api/tools/hermes-tools.json` berisi definisi tool untuk function calling (nama, deskripsi, JSON schema parameter) yang memetakan satu-ke-satu ke endpoint. Spec harus mendaftar setiap tool dengan contoh kalimat user yang memicunya. Pertimbangkan juga MCP server tipis di `apps/mcp` sebagai opsi, tulis sebagai fase lanjutan.
10. **Rate limit per API key** dan **audit log**: setiap mutasi lewat API key dicatat siapa (member), lewat kredensial apa, kapan, payload apa.
11. **CORS, HTTPS only, tidak ada secret di response**, dan API key hanya ditampilkan sekali saat dibuat.

Spec harus berisi **tabel semua endpoint** (method, path, auth, scope, deskripsi, request, response, error codes), lalu detail per resource.

### C. Model data rumah tangga: suami dan istri

Kebutuhan bisnis:

- Satu **household** berisi beberapa **member** (minimal 2: suami, istri; buka kemungkinan anak atau viewer).
- Setiap **akun** punya pemilik: milik satu member ("BCA Suami", "BCA Istri", "GoPay Istri") atau **bersama** ("Tabungan Bersama", "Kas Rumah"). Dua akun boleh bernama sama selama pemiliknya beda.
- Setiap akun punya **visibilitas**: `shared` (semua member lihat saldo dan transaksinya) atau `private` (hanya pemilik yang lihat detailnya, member lain hanya lihat bahwa akun itu ada, atau tidak sama sekali, putuskan dan jelaskan).
- Transaksi mencatat **akun mana** (jadi otomatis tahu uang siapa) dan **siapa yang mencatat** (`recorded_by`), karena istri bisa mencatat belanja dari rekening suami.
- Transfer antar akun lintas pemilik (suami → istri, suami → bersama) adalah kasus normal dan sering.
- **Anggaran** bisa level household (anggaran makan keluarga) atau level member (uang jajan pribadi).
- **Goals** bisa bersama atau pribadi. **Hutang** dan **piutang** punya pemilik atau bersama.
- **Kategori** level household, bukan per user, supaya suami istri pakai taksonomi yang sama.
- **Laporan** harus bisa dilihat tiga cara: gabungan household, per member, dan per akun.
- **Undangan pasangan**: member pertama membuat household, mengundang pasangan lewat email atau kode undang. Pasangan yang sudah punya akun Karaya sendiri dengan data lama harus bisa **bergabung sambil membawa datanya** atau **mulai kosong**, putuskan alurnya.

Yang harus ada di spec bab database:

1. **ERD** dalam Mermaid.
2. **DDL lengkap** setiap tabel baru dan yang berubah, dengan tipe, constraint, index, komentar. Perbaiki semua masalah 1 sampai 4 dari tabel di atas: FK untuk akun dan kategori, enum untuk type termasuk `transfer`, DATE untuk tanggal, dan `budgets.period` sebagai DATE awal bulan atau `daterange`.
3. **Keputusan saldo akun**: derived dari transaksi (view atau materialized) atau stored dengan trigger yang menjaga konsistensi. Pilih satu, jelaskan trade-off, dan definisikan cara rekonsiliasi.
4. **RLS baru** berbasis `household_members`, dengan helper function seperti `current_household_ids()` dan aturan visibilitas akun private.
5. **Postgres functions** untuk operasi atomik: `post_transaction`, `post_transfer`, `pay_debt`, `topup_goal`, `receive_piutang`, `adjust_balance`, `run_due_recurrings`. Tulis signature dan aturan validasinya.
6. **Rencana migrasi dari data lama tanpa kehilangan data**, bertahap dan bisa di-rollback:
   - setiap user lama → satu household dengan satu member owner
   - `account_name` → `account_id` lewat lookup (nama, user_id); tulis cara menangani nama yang tidak ketemu
   - kategori teks → `category_id`, buat kategori yang belum ada
   - `due_date` TEXT → DATE dengan aturan parsing dan penanganan nilai tidak valid
   - urutan file migrasi di `supabase/migrations/` dengan nama dan isi ringkas
   - skrip verifikasi: jumlah baris, total saldo sebelum dan sesudah harus sama
7. **Dampak ke setiap edge function dan hook yang ada**: tabel pemetaan "kode lama → pengganti di apps/api".

### D. Frontend

Spec frontend cukup ringkas, karena fokusnya backend dan data, tapi harus mencakup:

- Migrasi `src/` → `apps/web/` dengan mengganti semua akses Supabase langsung menjadi pemanggilan `apps/api` lewat satu client yang di-generate dari OpenAPI atau ditulis di `packages/shared`.
- Komponen UI baru yang diperlukan: pemilih household dan member, badge pemilik di akun dan transaksi, filter laporan (household, member, akun), halaman Settings untuk anggota, undangan, dan API key.
- Daftar view yang ada (`src/components/dashboard/views/*.jsx`) dan untuk masing-masing: perubahan apa yang diperlukan.
- Apakah tetap JSX atau migrasi ke TSX. Rekomendasi: TSX bertahap, file baru TSX, file lama dibiarkan sampai disentuh.

---

## Format output

Tulis ke `docs/spec/` dengan file-file berikut. Setiap file diawali blok status:

```
Status: draft | review | final
Terakhir diubah: <tanggal>
Bergantung pada: <file spec lain>
```

| File | Isi |
|------|-----|
| `00-ringkasan.md` | Tujuan, non-tujuan, glosarium (household, member, owner, joint account, recorded_by, dsb), keputusan arsitektur utama dalam tabel ADR ringkas |
| `01-kondisi-saat-ini.md` | Hasil audit kode: fakta terverifikasi, koreksi atas "fakta yang sudah diketahui", inventaris semua fitur yang ada agar tidak ada yang hilang saat migrasi |
| `02-monorepo.md` | Struktur, tooling, env, dev workflow, deploy |
| `03-database.md` | ERD, DDL, RLS, functions, keputusan saldo |
| `04-migrasi-data.md` | Rencana migrasi bertahap, skrip verifikasi, rollback |
| `05-api.md` | Prinsip, auth, tabel endpoint, detail per resource, error codes, idempotency, rate limit |
| `06-agent-integration.md` | Tool manifest, contoh percakapan → request → response, panduan setup di Hermes, aturan resolusi nama |
| `07-frontend.md` | Migrasi, komponen baru, pemetaan view |
| `08-rencana-implementasi.md` | Fase-fase kerja, lihat aturan di bawah |
| `09-pertanyaan-terbuka.md` | Semua asumsi dan pertanyaan, masing-masing dengan asumsi yang diambil sementara |

### Aturan untuk `08-rencana-implementasi.md`

Ini bagian paling penting agar implementasi tidak kehilangan arah. Bagi pekerjaan menjadi **fase yang masing-masing menghasilkan sistem yang tetap jalan**. Untuk setiap fase tulis:

- Tujuan satu kalimat
- Daftar tugas konkret, masing-masing selesai dalam satu sesi kerja
- File yang dibuat atau diubah
- **Kriteria selesai yang bisa diverifikasi** (perintah yang dijalankan dan hasil yang diharapkan: test lulus, curl mengembalikan X, skrip verifikasi migrasi hijau)
- Apa yang **tidak** boleh disentuh di fase itu
- Cara rollback kalau gagal

Urutan fase yang disarankan, sesuaikan kalau ada alasan: (1) setup monorepo dan pindahkan frontend apa adanya, masih jalan seperti sekarang; (2) skema database baru + migrasi data + verifikasi, frontend lama masih jalan di atas view kompatibilitas; (3) `apps/api` dengan auth JWT, paritas fitur dengan edge function lama; (4) frontend pindah ke `apps/api`, matikan akses langsung; (5) household, member, undangan, visibilitas; (6) API key, idempotency, OpenAPI, tool manifest, audit log; (7) integrasi Hermes end to end dan dokumentasi.

Di akhir file, tambahkan bagian **"Cara melanjutkan di sesi baru"**: instruksi untuk dirimu sendiri saat context kosong. Baca file mana dulu, bagaimana tahu fase mana yang sedang berjalan (misalnya file `docs/spec/PROGRESS.md` yang di-update setiap tugas selesai), dan aturan bahwa spec tidak boleh diubah diam-diam saat implementasi. Kalau implementasi menemukan spec salah, perbaiki spec dulu dengan catatan perubahan, baru lanjut kode.

---

## Batasan dan preferensi

- Semua nominal **BIGINT rupiah**, tidak ada float untuk uang.
- Semua timestamp `TIMESTAMPTZ`, semua tanggal transaksi `DATE`, zona waktu default `Asia/Jakarta` ditetapkan di household settings.
- Hapus data lewat **soft delete** (`deleted_at`) untuk transaksi, akun, member. Jelaskan dampaknya ke saldo dan laporan.
- Jangan rancang fitur yang tidak diminta: tidak ada multi-currency, tidak ada integrasi bank otomatis, tidak ada mobile native. Catat sebagai non-tujuan.
- Tetap bisa di-host **gratis atau sangat murah** (Supabase free tier, Vercel atau Fly free tier). Kalau sebuah keputusan mengorbankan ini, tulis biayanya.
- Subscription dan payment webhook yang ada **tidak diubah** fungsinya, hanya dipindah ke `apps/api`.
- Fitur AI chat yang ada di `ai-chat` edge function tetap ada, dipindah ke `apps/api`, dan tool-nya **memakai endpoint internal yang sama** dengan yang dipakai Hermes, supaya tidak ada dua implementasi logika.

## Kriteria spec dianggap selesai

Sebelum kamu menyatakan selesai, cek sendiri:

- [ ] Semua 9 masalah struktural punya solusi eksplisit di `03-database.md` atau `05-api.md`
- [ ] Setiap fitur di `01-kondisi-saat-ini.md` punya padanan di desain baru atau dinyatakan dihapus dengan alasan
- [ ] Skenario berikut bisa ditelusuri dari kalimat user sampai baris SQL yang dijalankan, tulis sebagai contoh di `06-agent-integration.md`:
  1. "catat belanja sayur 45rb dari BCA istri"
  2. "catat 50rb makan siang dari BCA" (ambigu, harus minta klarifikasi)
  3. "transfer 2 juta dari BCA suami ke tabungan bersama"
  4. "berapa sisa anggaran makan bulan ini?"
  5. "pengeluaran istri bulan lalu berapa?"
  6. "bayar cicilan motor 1,2 juta dari BCA suami"
  7. request yang sama dikirim dua kali dengan `Idempotency-Key` sama
- [ ] Rencana migrasi punya skrip verifikasi dan rollback untuk setiap langkah
- [ ] Setiap fase implementasi punya kriteria selesai yang bisa dijalankan sebagai perintah
- [ ] Tidak ada bagian yang berbunyi "akan ditentukan kemudian" tanpa asumsi sementara di `09-pertanyaan-terbuka.md`

Mulai dengan membaca kode. Laporkan temuan audit secara ringkas sebelum menulis spec, lalu tulis file satu per satu mulai dari `00-ringkasan.md`.
