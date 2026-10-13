Status: draft
Terakhir diubah: 2026-10-07
Bergantung pada: 03-database.md

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-13 | §4.14 (baru), §4 shopping | **Perbandingan harga**: `GET /v1/prices/compare?q=&days=` (read) dan `POST /v1/prices/aliases` (write); `GET /v1/shopping` (status needed) menambah `cheapest` per item; respons `POST /v1/receipts/ingest` menambah `prices_recorded`. Tidak ada error code baru. | Banding harga produk antar toko. Detail `10-fitur-opsional-keluarga.md` §6.8. |
> | 2026-10-13 | §3 batch, §4 ingest | `items[].titipan` (opsional) di `POST /v1/transactions/batch` dan `POST /v1/receipts/ingest`; respons keduanya bisa memuat `piutang:[{id,borrower_name,total,items}]`. Note struk kanonik `[Toko] item [ref: X]`. Tidak ada error code baru. | Titipan → Piutang otomatis + perbandingan harga antar toko (persiapan). Detail `10-fitur-opsional-keluarga.md` §6.3. |
> | 2026-10-07 | §4 (baru) | **F-D**: `GET/POST /v1/shopping`, `PATCH/DELETE /v1/shopping/{id}`, `GET /v1/shopping/suggestions`, `GET/POST /v1/pantry`, `PATCH/DELETE /v1/pantry/{id}`, `POST /v1/pantry/{id}/movements`, `GET /v1/pantry/expiring` (+`exclude_acked`), `POST /v1/pantry/expiring/ack`, `POST /v1/receipts/ingest`. Error baru: `shopping_item_not_found` (404), `pantry_item_not_found` (404), `receipt_total_mismatch` (422). Juga `GET /v1/reports/monthly` (F-B, selalu tersedia). Detail: `10-fitur-opsional-keluarga.md` §4, §6. | Implementasi F-B/F-D. |
> | 2026-10-07 | §4 (baru), §2.4, §2.6 | **F-0+F-A**: `features` field baru di `GET/PATCH /v1/households/current` (sudah `both` jwt+api_key, bukan endpoint `/v1/features` terpisah); `GET/POST /v1/beneficiaries`, `PATCH/DELETE /v1/beneficiaries/{id}`; `POST/PATCH /v1/transactions(+/batch)` tambah `beneficiary_id`/`beneficiary` opsional; `GET /v1/transactions` tambah filter `beneficiary`; `GET /v1/summary` tambah `scope=beneficiary` + `by_beneficiary[]`. Field opsional ini saat fitur mati → `400 validation_error` (BUKAN 403 `feature_disabled` — itu untuk endpoint `/v1/beneficiaries` sendiri). Error code baru: `feature_disabled` (403), `beneficiary_not_found` (404), `ambiguous_beneficiary` (409). Detail lengkap: `10-fitur-opsional-keluarga.md`. | Implementasi F-0/F-A, spec ditulis 2026-10-07. |
> | 2026-10-04 | §4.12 `/v1/ai/chat` | Request `{messages:[{role,content}]}`→`{reply, tool_calls_made}` diganti `{messages:[{role:"user"\|"ai", text}]}`→`{reply}`; tool read-only household-scoped, bukan registry tool publik §4.11; `allow_write` (tool tulis via chat) tidak diimplementasikan | Dibangun di Fase 4 (F4-T2) sebagai pengganti edge function `ai-chat` lama, yang sudah memakai bentuk pesan `{role:"user"\|"ai", text}` di `AiView`/`Dashboard.jsx` — mengikuti bentuk asli menghindari refactor frontend yang tidak perlu. Tool tulis-via-chat adalah fitur baru yang lebih besar dari sekadar migrasi, sengaja di luar scope Fase 4. |
> | 2026-10-04 | §4.12 `/v1/ai/scan-receipt` | `multipart/form-data` dihapus (JSON saja); tambah mode `{ocr_text}` untuk parse teks OCR client-side; `category_suggestion` → `category` | Dibangun di Fase 4 (F4-T4) menggantikan pemanggilan provider AI langsung dari browser di `AddTransactionModal.jsx` (API key sempat terekspos di network tab client). Frontend punya dua alur: vision (foto struk) dan OCR teks (tesseract.js lalu AI merapikan teks) — keduanya butuh endpoint ini karena sama-sama memakai API key tersimpan di server. `category` dipakai karena itu field asli yang dibaca `sanitizeScanResult` di frontend. |
> | 2026-10-04 | §4.6 `DELETE /v1/me` | Implementasi Fase 4 TIDAK memakai Admin API/service role seperti didokumentasikan — hanya menghapus household (cascade semua data domain) lewat RLS biasa (`households_delete` policy, owner-only), TANPA menghapus baris `auth.users`. Ditolak `409 last_owner_with_members` bila household beranggota >1 (alur reassign/leave adalah Fase 5). | `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL` belum dikonfigurasi di `apps/api/.env.local` sesi ini (hanya `SUPABASE_JWT_SECRET`, cukup untuk verifikasi JWT HS256 tapi tidak untuk Admin API). Mengejar service role key di luar scope "migrasi frontend ke apps/api". Efek praktis: user bisa login lagi dan data tetap bersih (household & seluruh isinya benar-benar hilang), tapi baris auth-nya bertahan. Perlu diselesaikan sebelum fitur ini dianggap tuntas 100% — lihat PROGRESS.md. |
> | 2026-10-06 | §4.13 | Subscription/webhook/internal endpoint dihapus total dari spec (bukan sekadar "dipindah") | Pemilik produk mengonfirmasi project tidak pernah punya pembayaran sungguhan. Detail: `docs/spec/PROGRESS.md` §"Pembatalan total subscription/Midtrans". |

# 05 — API `/v1`: Prinsip, Auth, Endpoint, Error, Idempotency, Rate Limit

## 1. Prinsip

1. **REST resource-based**, versi di path (`/v1`). Tidak ada `{action}`.
2. **JSON only**, `Content-Type: application/json; charset=utf-8`. Nominal selalu integer rupiah. Tanggal `YYYY-MM-DD`. Timestamp ISO 8601 UTC.
3. **Nama field snake_case** di request dan response, sama dengan kolom DB, agar agent dan developer tidak menerjemahkan.
4. **Bahasa**: `error.message` Indonesia; nama field, `code`, enum Inggris.
5. **Setiap respons mutasi mengembalikan objek yang terdampak** (transaksi + saldo akun terbaru), supaya klien tidak perlu refetch.
6. **Satu sumber kebenaran skema**: zod di `packages/shared/src/schemas`, OpenAPI di-generate, tool manifest di-generate.
7. **Default aman untuk agent**: resolusi nama ketat (ambigu → 409), idempotency didukung di semua POST pembuat data, saldo tidak boleh negatif.
8. **HTTPS only** (Vercel memaksa), CORS hanya origin yang dikonfigurasi, tidak ada secret di respons.

## 2. Konvensi umum

### 2.1 Header

| Header | Arah | Keterangan |
|---|---|---|
| `Authorization: Bearer <jwt>` atau `Bearer kf_live_…` | req | Wajib kecuali `/v1/health`, `/v1/openapi.json`, `/v1/docs`, `/v1/invitations/{code}` (preview), webhook |
| `X-Household-Id: <uuid>` | req | Opsional untuk JWT bila user punya > 1 household; default `user_settings.active_household_id` lalu household pertama. **Diabaikan** untuk API key (household terikat pada key) |
| `Idempotency-Key: <string ≤128>` | req | Opsional di semua POST yang membuat data; disarankan selalu untuk agent |
| `X-Request-Id` | req/res | Dibuat server kalau tidak ada; dikembalikan |
| `Idempotent-Replayed: true` | res | Ada bila respons berasal dari cache idempotency |
| `X-RateLimit-Limit-Minute`, `X-RateLimit-Remaining-Minute`, `X-RateLimit-Limit-Day`, `X-RateLimit-Remaining-Day`, `Retry-After` | res | Hanya untuk API key |
| `Deprecation`, `Sunset` | res | Dipakai bila ada endpoint yang akan dihapus |

### 2.2 Envelope

Sukses: body adalah objek resource atau `{ data: [...], next_cursor, has_more }` untuk list. Tidak ada pembungkus `{success:true}`.

Error:

```json
{
  "error": {
    "code": "ambiguous_account",
    "message": "Ada 2 akun yang cocok dengan \"BCA\". Sebutkan pemiliknya.",
    "hint": "Kirim ulang dengan account_id dari salah satu kandidat, atau sebut nama lengkap seperti \"BCA suami\".",
    "candidates": [
      { "id": "…", "name": "BCA", "owner": { "member_id": "…", "display_name": "Eko" }, "visibility": "shared" },
      { "id": "…", "name": "BCA", "owner": { "member_id": "…", "display_name": "Rina" }, "visibility": "shared" }
    ],
    "details": { "field": "account" },
    "request_id": "req_…"
  }
}
```

`candidates` hanya untuk `ambiguous_*` dan `*_not_found` (saran). `details` opsional: untuk `validation_error` berisi `issues: [{path, message}]` dari zod.

### 2.3 Pagination

Cursor opak (base64url dari `date|created_at|id`). Query `limit` (default 50, maks 200), `cursor`. Respons `next_cursor` null bila habis. Urutan default `date DESC, created_at DESC, id DESC`.

### 2.4 Period

Parameter `period` menerima: `today`, `yesterday`, `this_week` (Senin–Minggu), `last_week`, `this_month`, `last_month`, `this_year`, `last_year`, `YYYY-MM`, `YYYY`, atau `custom` dengan `from` & `to` (`YYYY-MM-DD`, inklusif). Dievaluasi di timezone household. Respons selalu menyertakan `period: {label, from, to}` hasil resolusi.

### 2.5 Scope laporan

`scope=household` (default) | `member` (wajib `member_id` atau `member` nama) | `account` (wajib `account_id` atau `account` nama). `attribution=owner` (default) | `recorded_by`. Untuk `scope=member&attribution=owner`: transaksi dari akun milik member tsb; dari joint tidak termasuk. Untuk `scope=household`: semua akun, **termasuk private** dalam agregat, tapi respons menyertakan `hidden_private_accounts: n` bila actor tidak boleh melihat detail sebagian akun (lihat `03` §7.3 dan Q-05).

### 2.6 Referensi akun/kategori/member di request

Setiap field yang merujuk akun menerima **salah satu**: `account_id` (UUID) **atau** `account` (string nama manusia). Begitu juga `category_id|category`, `member_id|member`, `to_account_id|to_account`. Kalau keduanya dikirim, `*_id` menang. String diresolusi lewat `resolve_*`; `ambiguous` → 409, `not_found` → 404 dengan `candidates` saran. Respons selalu mengembalikan ID.

### 2.7 Nominal dalam bahasa manusia

Field `amount` menerima integer. Untuk kenyamanan agent, `amount_text` (string) juga diterima dan di-parse oleh `parseAmountId()` di `packages/shared`: `45rb`, `45k`, `45.000`, `1,2 juta`, `1.2jt`, `2 juta`, `500 ribu`. Kalau keduanya ada, `amount` menang. Hasil parse dikembalikan di respons sebagai `amount`. Parser gagal → `validation_error` dengan hint format.

## 3. Autentikasi dan otorisasi

### 3.1 JWT Supabase

- Verifikasi tanda tangan via JWKS `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (cache 10 menit), fallback HS256 `SUPABASE_JWT_SECRET`. Cek `exp`, `aud = authenticated`.
- Actor: `household_members` dengan `user_id = sub` di household terpilih. Tidak ada membership → `403 not_household_member` kecuali endpoint onboarding (`POST /v1/households`, `GET /v1/me`, `GET /v1/invitations/{code}`, `POST /v1/invitations/{code}/accept`).
- Scope efektif: `owner` → admin; `member` → write; `viewer` → read.

### 3.2 API key

- Format `kf_live_<40 base62>`; hash `sha256(API_KEY_PEPPER || key)`; lookup `api_keys.key_hash`.
- Ditolak bila `revoked_at` terisi (`api_key_revoked`), `expires_at < now()` (`api_key_expired`), member terkait `deleted_at` (`api_key_member_removed`).
- Actor = `api_keys.member_id` di `api_keys.household_id`. Scope efektif = `MIN(key.scope, role member)` → viewer dengan key `write` tetap `read`.
- `last_used_at` dan `last_used_ip` di-update maksimal sekali per menit (hemat tulis).
- Hanya `owner` yang bisa membuat key dengan scope `admin`. Member bisa membuat key untuk dirinya dengan scope ≤ role.

### 3.3 Matriks scope

| Operasi | read | write | admin |
|---|---|---|---|
| GET resource, summary, reports, resolve | ✓ | ✓ | ✓ |
| POST/PATCH/DELETE transaksi, transfer, budgets, goals, debts, piutang, recurrings, split-bills, investments, accounts (buat/ubah milik sendiri atau joint) | | ✓ | ✓ |
| accounts DELETE, categories mutasi, members, invitations, api-keys (selain milik sendiri), households PATCH, audit-log | | | ✓ |
| `/v1/me/*`, `/v1/ai/*` | JWT saja (API key ditolak `jwt_required`) | | |
| webhooks, internal | signature / secret | | |

### 3.4 Visibilitas akun privat di API

- `GET /v1/accounts`: akun privat milik orang lain tetap muncul dengan `balance: null`, `can_view: false`, `can_post: false` (kecuali sebagai tujuan transfer: `can_receive_transfer: true`).
- `GET /v1/transactions`: transaksi yang hanya menyentuh akun privat orang lain tidak muncul. Transfer dari akun yang boleh dilihat ke akun privat tetap muncul.
- `GET /v1/summary?scope=household`: agregat menyertakan semuanya, dengan `hidden_private_accounts`. `scope=member` untuk member lain yang punya akun privat → `403 private_scope` kecuali actor owner **dan** household setting `owners_can_view_private_totals = true` (default false; Q-05).

## 4. Tabel endpoint

Kolom **Auth**: `jwt`, `key`, `both`, `none`, `sig` (signature Midtrans), `secret` (x-function-secret). **Scope** minimum. **Idem** = menerima `Idempotency-Key`.

### 4.1 Sistem

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/health` | none | | | `{status:"ok", version, db:"ok"}` |
| GET | `/v1/openapi.json` | none | | | OpenAPI 3.1 |
| GET | `/v1/docs` | none | | | Scalar UI |
| GET | `/v1/tools/hermes.json` | none | | | Menyajikan `apps/api/tools/hermes-tools.json` (tool manifest, lihat `06` §2); `Cache-Control: public, max-age=300` |
| GET | `/v1/bootstrap` | both | read | | Satu panggilan untuk memuat dashboard: `{me, household, members, accounts(+balances), categories, summary(this_month), budgets_status(this_month), goals, debts, piutang, recurrings, investments, settings}`. Dibuat agar frontend tidak memanggil 12 endpoint saat load. Agent sebaiknya memakai endpoint spesifik. |

### 4.2 Me, settings, household, members, invitations

| Method | Path | Auth | Scope | Idem | Deskripsi / Request / Response / Error |
|---|---|---|---|---|---|
| GET | `/v1/me` | jwt | | | `{user:{id,email,full_name}, memberships:[{household_id, household_name, member_id, role}], active_household_id}` |
| PATCH | `/v1/me` | jwt | | | `{full_name?}` → Supabase `updateUser` metadata |
| PATCH | `/v1/me/password` | jwt | | | `{new_password}` (min 8) → Supabase `updateUser`; `400 weak_password` |
| DELETE | `/v1/me` | jwt | | | Hapus household milik user (cascade semua data domain) via RLS biasa. Ditolak `409 last_owner_with_members` kalau household masih punya member lain (hint: alihkan owner dulu). **Belum** menghapus baris `auth.users` (butuh Admin API/service role — lihat riwayat perubahan di atas, belum dikonfigurasi). |
| GET | `/v1/me/settings` | jwt | | | `user_settings` tanpa `ai_config.apiKey` (dikembalikan `ai_config:{provider, model, has_api_key, disabled}`) |
| PATCH | `/v1/me/settings` | jwt | | | `{avatar_color?, hidden_menus?, app_name?, app_tagline?, language?, theme?, active_household_id?, ai_config?:{provider, model, api_key?, disabled?}}`; `api_key` kosong = hapus |
| POST | `/v1/households` | jwt | | ✓ | `{name, timezone?='Asia/Jakarta', display_name}` → household baru + member owner. User yang sudah punya household boleh membuat lagi (Q-03). |
| GET | `/v1/households/current` | both | read | | `{id, name, timezone, settings:{default_account_visibility, owners_can_view_private_totals}, member_count}` |
| PATCH | `/v1/households/current` | both | admin | | `{name?, timezone?, settings?}` |
| GET | `/v1/members` | both | read | | `[{id, display_name, role, aliases, color, user:{email?}, is_me, joined_at}]`; email hanya untuk owner |
| PATCH | `/v1/members/{id}` | both | write (diri sendiri) / admin (orang lain) | | `{display_name?, aliases?, color?, role? (admin)}`; `409 last_owner` bila menurunkan owner terakhir |
| DELETE | `/v1/members/{id}` | both | admin | | Query `reassign_to_member_id` (UUID atau `joint`); `422 reassign_required` bila member punya akun dan parameter kosong; `409 last_owner`; `409 cannot_remove_self` (owner keluar lewat `POST /v1/members/me/leave`) |
| POST | `/v1/members/me/leave` | jwt | | | Keluar dari household; aturan sama dengan DELETE |
| GET | `/v1/invitations` | both | admin | | Daftar undangan pending |
| POST | `/v1/invitations` | both | admin | ✓ | `{email?, role?='owner', display_name_suggestion?}` → `{id, code, expires_at, accept_url}`; tidak mengirim email (non-tujuan; user membagikan code/link sendiri). `409 already_member` bila email sudah member. |
| DELETE | `/v1/invitations/{id}` | both | admin | | revoke |
| GET | `/v1/invitations/{code}` | none | | | Preview: `{household_name, inviter_name, role, email_locked, expires_at}`; `404 invitation_invalid`, `410 invitation_expired` |
| POST | `/v1/invitations/{code}/accept` | jwt | | ✓ | `{display_name, mode:"fresh"|"merge"}` → member baru. `mode` menentukan nasib data lama user (lihat §5). `403 invitation_email_mismatch`, `409 already_member`. |

### 4.3 Accounts

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/accounts` | both | read | | Query `include_deleted?`, `owner=me|joint|<member_id>|all`. Response `[{id, name, aliases, type, visibility, owner:{member_id, display_name}|null, balance|null, can_view, can_post, can_receive_transfer, icon, color, tx_count, last_tx_date, needs_review}]` + `totals:{visible_balance, hidden_private_accounts}` |
| POST | `/v1/accounts` | both | write | ✓ | `{name, type, owner:"me"|"joint"|member_id|member(nama), visibility?, opening_balance?=0, aliases?, icon?, color?}`; `409 duplicate_account_name`; `403 forbidden_owner` bila non-admin membuat akun untuk member lain; `422 private_requires_owner` |
| GET | `/v1/accounts/{id}` | both | read | | Detail + `balance` (null bila privat orang lain) |
| PATCH | `/v1/accounts/{id}` | both | write | | `{name?, aliases?, type?, visibility?, owner?, icon?, color?, sort_order?, restore?:true}`; ubah owner/visibility hanya pemilik atau admin |
| DELETE | `/v1/accounts/{id}` | both | admin / pemilik | | Soft delete; `422 account_has_balance {balance}`, `422 account_has_transactions {count}` (hint: `?force_archive=true` bila saldo 0), `422 account_in_use_by_recurring` |
| POST | `/v1/accounts/{id}/adjust-balance` | both | write | ✓ | `{new_balance, date?, note?}` → `{account, transaction|null, diff}` |
| GET | `/v1/accounts/{id}/transactions` | both | read | | Alias `GET /v1/transactions?account_id=` |

### 4.4 Categories

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/categories` | both | read | | Query `type=income|expense|all`, `include_system?=true`. `[{id, name, aliases, type, icon, color, is_system, system_key}]` |
| POST | `/v1/categories` | both | admin | ✓ | `{name, type, icon?, color?, aliases?}`; `409 duplicate_category_name` |
| PATCH | `/v1/categories/{id}` | both | admin | | `{name?, aliases?, icon?, color?, type? (ditolak untuk sistem: 422 category_reserved)}` |
| DELETE | `/v1/categories/{id}` | both | admin | | Query `merge_into_category_id?`; `422 category_in_use {count}`; `422 category_reserved` |

### 4.5 Transactions dan transfers

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/transactions` | both | read | | Filter: `period`/`from`/`to`, `type`, `account_id|account`, `to_account_id`, `category_id|category`, `member_id|member` + `attribution`, `recorded_by_member_id`, `q` (teks catatan, trigram), `min_amount`, `max_amount`, `source`, `include_deleted`, `limit`, `cursor`. Response `{data:[Transaction], next_cursor, has_more, totals:{income, expense, transfer, count}}`. Totals dihitung atas seluruh hasil filter (bukan halaman). |
| POST | `/v1/transactions` | both | write | ✓ | `{type:"income"|"expense", amount|amount_text, account_id|account, category_id|category, date?=today, note?}` → `{transaction, account:{id, name, balance}}`. Error `422 insufficient_funds {balance, needed, account_name}`, `409 ambiguous_account`, `404 account_not_found`, `404 category_not_found`, `422 category_type_mismatch`, `403 forbidden_account` |
| POST | `/v1/transactions/batch` | both | write | ✓ | `{account_id|account, date?, items:[{amount, category_id|category, note, titipan?}] (≤100)}` → `{transactions:[…], account, piutang?:[…]}`; semua-atau-tidak. `titipan`/kata "titipan" di note/kategori "Piutang" → item masuk Piutang + baris piutang otomatis (`10-fitur-opsional-keluarga.md` §6.3) |
| GET | `/v1/transactions/{id}` | both | read | | |
| PATCH | `/v1/transactions/{id}` | both | write | | `{amount?, type?, account_id|account?, category_id|category?, date?, note?}` → `{transaction, accounts:[…terdampak]}`; `422 transfer_edit_limited` |
| DELETE | `/v1/transactions/{id}` | both | write | | Soft; → `{transaction, accounts}`; `422 would_make_balance_negative` |
| POST | `/v1/transactions/{id}/restore` | both | write | ✓ | `422 insufficient_funds`, `409 duplicate_recurring_execution` |
| GET | `/v1/transactions/export.csv` | jwt | read | | Filter sama dengan list; `text/csv` dengan BOM; kolom: Tanggal, Tipe, Kategori, Jumlah, Akun, Pemilik Akun, Ke Akun, Dicatat Oleh, Catatan, Sumber |
| POST | `/v1/transfers` | both | write | ✓ | `{amount|amount_text, from_account_id|from_account, to_account_id|to_account, date?, note?}` → `{transaction, from_account:{id,name,balance}, to_account:{id,name,balance|null}}`; `422 same_account_transfer`, `422 insufficient_funds`, `409 ambiguous_account {details.field: "from_account"|"to_account"}` |

Objek `Transaction`:

```json
{
  "id": "…", "type": "expense", "amount": 45000, "date": "2026-10-04", "note": "belanja sayur",
  "account": { "id": "…", "name": "BCA", "owner": { "member_id": "…", "display_name": "Rina" } | null },
  "to_account": null,
  "category": { "id": "…", "name": "Makanan", "icon": "🍔", "color": "#f59e0b" },
  "recorded_by": { "member_id": "…", "display_name": "Eko" },
  "source": "api_key", "recurring_id": null,
  "links": { "debt_id": null, "goal_id": null, "piutang_id": null },
  "created_at": "…", "updated_at": "…", "deleted_at": null
}
```

### 4.6 Budgets

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/budgets` | both | read | | Query `month=YYYY-MM` (default bulan ini), `member_id|member|household`. `[{id, category, member|null, period_start, amount}]` |
| GET | `/v1/budgets/status` | both | read | | Query `month`, `scope=household|member`, `member_id|member`. `{period, items:[{budget_id, category:{…}, member|null, amount, spent, remaining, pct, status:"ok"|"warning"(≥80%)|"over", predicted_end_of_month?}], totals:{budgeted, spent, remaining}, unbudgeted_spent}`. Dasar untuk "sisa anggaran makan bulan ini". |
| POST | `/v1/budgets` | both | write | ✓ | `{category_id|category, amount, month=YYYY-MM, member_id|member?}`; `409 duplicate_budget` |
| PATCH | `/v1/budgets/{id}` | both | write | | `{amount}` |
| DELETE | `/v1/budgets/{id}` | both | write | | soft |
| POST | `/v1/budgets/copy` | both | write | ✓ | `{from_month, to_month, overwrite?=false}` → `{copied, skipped}` |

### 4.7 Goals, debts, piutang

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/goals` | both | read | | `[{id, name, target, current, pct, reached, deadline, days_left, owner|null, icon, color}]`; query `owner=me|joint|all` |
| POST | `/v1/goals` | both | write | ✓ | `{name, target, deadline?, owner?="me"|"joint"|member_id, opening_amount?=0, icon?, color?}` |
| PATCH / DELETE | `/v1/goals/{id}` | both | write | | |
| POST | `/v1/goals/{id}/contributions` | both | write | ✓ | `{amount|amount_text, account_id|account? (null = tanpa potong akun), date?, note?}` → `{goal, contribution, transaction|null, account|null, reached}` |
| GET | `/v1/goals/{id}/contributions` | both | read | | riwayat |
| GET | `/v1/debts` | both | read | | `[{id, name, aliases, total, remaining, paid, monthly, due_date, is_overdue, owner|null, …}]`; query `status=active|settled|all` |
| POST | `/v1/debts` | both | write | ✓ | `{name, total, monthly?, due_date?, owner?, opening_paid?=0, aliases?, notes?, icon?, color?}` |
| PATCH / DELETE | `/v1/debts/{id}` | both | write | | |
| POST | `/v1/debts/{id}/payments` | both | write | ✓ | `{amount|amount_text, account_id|account, date?, note?, allow_overpay?=false}` → `{debt, payment, transaction, account}`; `422 debt_already_settled`, `422 overpayment {remaining}`, `422 insufficient_funds` |
| GET | `/v1/debts/{id}/payments` | both | read | | riwayat |
| GET | `/v1/piutang` | both | read | | `[{id, borrower_name, total, remaining, received, due_date, is_overdue, from_account|null, owner|null}]` |
| POST | `/v1/piutang` | both | write | ✓ | `{borrower_name, total, from_account_id|from_account? (potong saldo), owner?, due_date?, notes?, date?}` → `{piutang, transaction|null, account|null}` |
| PATCH / DELETE | `/v1/piutang/{id}` | both | write | | |
| POST | `/v1/piutang/{id}/receipts` | both | write | ✓ | `{amount|amount_text, account_id|account, date?, note?, allow_overpay?}` → `{piutang, receipt, transaction, account}` |
| GET | `/v1/piutang/{id}/receipts` | both | read | | |

Resolusi `debt`/`goal`/`piutang` by name: endpoint `payments`/`contributions`/`receipts` memakai `{id}` di path, tetapi `/v1/resolve` (§4.11) mendukung `kind=debt|goal|piutang` agar agent bisa mengubah "cicilan motor" menjadi `debt_id`.

### 4.8 Recurrings, split bills, investments

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/recurrings` | both | read | | `[{id, name, type, amount, category, account, frequency, anchor_day, next_date, status:"overdue"|"due_soon"|"scheduled"|"paused", debt|null, active, last_run_at, last_error}]` |
| POST | `/v1/recurrings` | both | write | ✓ | `{name, type?="expense", amount, category_id|category, account_id|account, frequency, next_date, debt_id?, notes?}` |
| PATCH / DELETE | `/v1/recurrings/{id}` | both | write | | `{active?:false}` untuk pause |
| POST | `/v1/recurrings/run` | both | write | ✓ | `{today?}` → `{executed, skipped:[{recurring_id, name, reason}], transactions:[…], accounts:[…]}`; hanya untuk household actor |
| GET/POST | `/v1/split-bills` | both | read/write | ✓ | `{title, total_amount, date, note?, members:[{name, amount}], transaction_id?}` |
| PATCH | `/v1/split-bills/{id}/members/{member_id}` | both | write | | `{paid: true|false}` |
| DELETE | `/v1/split-bills/{id}` | both | write | | |
| GET/POST/PATCH/DELETE | `/v1/investments[/{id}]` | both | read/write | ✓ | kolom sama dengan tabel; `owner?` |

### 4.9 Summary dan reports (untuk agent dan dashboard)

| Method | Path | Auth | Scope | Deskripsi |
|---|---|---|---|---|
| GET | `/v1/summary` | both | read | Query `period=this_month`, `scope`, `member_id|member`, `account_id|account`, `attribution`, `compare=true`. Response: `{period, scope, totals:{income, expense, net, transfer_volume, saving_rate_pct}, compare:{income_delta_pct, expense_delta_pct}, balance:{total_visible, hidden_private_accounts, by_type:{bank, ewallet, …}}, top_categories:[{category, spent, pct}] (≤8), by_member:[{member|joint, income, expense}], budgets:{over, warning, total}, goals:{active, reached}, debts:{active, total_remaining, overdue}, recent_transactions:[Transaction]×5, notes:[string]}`. `notes` berisi kalimat penjelas untuk agent/UI, mis. "Belanja dari rekening bersama tidak dihitung ke <member>" pada `scope=member`, atau "n akun privat tidak termasuk rincian". |
| GET | `/v1/reports/by-category` | both | read | `period`, `scope`, `type=expense|income` → `[{category, amount, pct, count}]` |
| GET | `/v1/reports/by-member` | both | read | `period`, `attribution` → `[{member|joint, income, expense, net}]` |
| GET | `/v1/reports/by-account` | both | read | `period` → `[{account, income, expense, transfer_in, transfer_out, balance}]` |
| GET | `/v1/reports/trend` | both | read | `months=6`, `scope` → `[{month, income, expense, net}]` |
| GET | `/v1/reports/daily` | both | read | `month`, `scope` → `[{date, expense}]` + `avg_per_day, max_day` (line & heatmap Laporan) |
| GET | `/v1/reports/forecast` | both | read | `month`, `scope` → prediksi akhir bulan (port algoritma `PrediksiView`: kategori tetap vs variabel, rata-rata 3 bulan) — **fase lanjut**, boleh dihitung di client dulu |

### 4.10 API keys, audit log

| Method | Path | Auth | Scope | Idem | Deskripsi |
|---|---|---|---|---|---|
| GET | `/v1/api-keys` | jwt | write | | `[{id, name, key_prefix, scope, member, expires_at, last_used_at, created_at, revoked_at}]`; non-owner hanya melihat miliknya |
| POST | `/v1/api-keys` | jwt | write (diri) / admin (member lain) | ✓ | `{name, scope?="write", member_id?=me, expires_in_days?}` → `{api_key:{…}, secret:"kf_live_…"}` **sekali saja**; `403 scope_exceeds_role` |
| DELETE | `/v1/api-keys/{id}` | jwt | write (milik) / admin | | revoke (set `revoked_at`); key yang sedang dipakai langsung ditolak di request berikutnya |
| POST | `/v1/api-keys/{id}/rotate` | jwt | sama | ✓ | buat key baru dengan atribut sama, revoke lama → `{api_key, secret}` |
| GET | `/v1/audit-log` | both | admin | | Query `api_key_id?`, `member_id?`, `action?`, `from?`, `to?`, `cursor`. `[{id, created_at, actor, credential_type, api_key:{id,name,prefix}|null, action, resource_type, resource_id, http_status, payload (teredaksi), request_id}]` |

### 4.11 Resolve (untuk agent)

| Method | Path | Auth | Scope | Deskripsi |
|---|---|---|---|---|
| POST | `/v1/resolve` | both | read | `{kind:"account"|"category"|"member"|"debt"|"goal"|"piutang", query:"BCA istri", type?:"income"|"expense"}` → `{status:"ok"|"ambiguous"|"not_found", match?:{id, name, …}, candidates:[{id, name, owner?, score}]}`. **Selalu 200** (ini pertanyaan, bukan perintah); agent memakai ini untuk konfirmasi sebelum menulis, atau membiarkan endpoint tulis yang melakukan resolusi dan mengembalikan 409. |

### 4.12 AI (JWT saja)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/v1/ai/chat` | jwt | `{messages:[{role:"user"|"ai", text}]}` → `{reply}`. Provider/model/key dari `user_settings.ai_config` (BYOK, tidak pernah dari body). Tool-calling read-only atas data household (`get_transactions`, `get_summary`, `get_accounts`, `get_debts`, `get_goals`, `get_investments`), bukan registry tool publik §4.11 — agent eksternal tetap memakai endpoint spesifik + `/v1/resolve`. `400 ai_not_configured`, `502 upstream_ai_error` |
| POST | `/v1/ai/scan-receipt` | jwt | JSON `{image_base64, mime_type}` (mode vision) atau `{ocr_text}` (mode teks, untuk hasil OCR client-side) → `{merchant?, date?, subtotal?, items?:[{note, amount, category}]}` atau `{error:"bukan struk"}`. Provider vision/teks dari `ai_config`; `400 ai_not_configured`, `422 provider_no_vision`, `502 upstream_ai_error` |

### 4.14 Perbandingan harga antar toko (2026-10-13)

Tidak digate feature flag — riwayat harga terisi dari struk mana pun (`POST /v1/receipts/ingest` dengan `merchant`, atau
`POST /v1/transactions/batch` dengan note `[Toko] item` dari modal scan web). Detail desain: `10-fitur-opsional-keluarga.md` §6.8.

| Method | Path | Auth | Scope | Deskripsi |
|---|---|---|---|---|
| GET | `/v1/prices/compare` | both | read | `?q=<produk>&days=180` → `{query, days, products:[{product_name, unit:"g"\|"ml"\|"pcs"\|null, compare_basis, stores:[{merchant, last_date, price, size, per_unit_price, lowest_per_unit_price, observations}], cheapest, savings_pct, summary}]}`. `stores` urut termurah per satuan (harga terakhir tiap toko). `q` < 2 huruf → `400 validation_error` |
| POST | `/v1/prices/aliases` | both | write | `{item, same_as}` → `{keyword, canonical_name}`. Koreksi manual per household: item struk `item` dianggap produk yang sama dengan `same_as` (nama produk, atau nama item struk lain — dipakai nama produk item itu) |

### 4.13 ~~Subscription, webhook, internal~~ — DIHAPUS (2026-10-06)

Section ini sebelumnya mendeskripsikan `GET /v1/me/subscription`, `POST /v1/webhooks/midtrans`, `POST /v1/internal/subscriptions`. **Seluruhnya dihapus** — project ini tidak pernah punya pembayaran sungguhan (tidak ada endpoint ini yang pernah sempat diimplementasikan sebelum dibangun & langsung dibatalkan di sesi 2026-10-06; lihat riwayat perubahan di atas dan `docs/spec/PROGRESS.md` §"Pembatalan total subscription/Midtrans"). Auth kolom `sig`/`secret` di §1 tidak lagi relevan, dipertahankan di tabel sebagai catatan historis saja.

## 5. Alur undangan dan penggabungan data

1. Owner → `POST /v1/invitations` → dapat `code` (+ `accept_url = https://karaya.app/join/<code>`), bagikan lewat WhatsApp dll.
2. Pasangan membuka link → kalau belum punya akun Karaya: signup (Supabase) → kembali ke `/join/<code>`.
3. Frontend memanggil `GET /v1/invitations/{code}` untuk preview, lalu `POST /v1/invitations/{code}/accept` dengan `display_name` dan `mode`:
   - **`fresh`**: user masuk sebagai member baru tanpa membawa data. Household lama user (kalau ada, dari migrasi atau dibuat sendiri) **tetap ada** dan tetap bisa diakses lewat pemilih household; `active_household_id` dipindah ke household baru. Tidak ada data yang dihapus.
   - **`merge`**: semua data di household lama user (akun, transaksi, kategori custom, budget, goals, hutang, piutang, recurring, split bill, investasi) **dipindahkan** ke household tujuan oleh fungsi `merge_household_into(p_source_household_id, p_target_household_id, p_member_id)`: `household_id` diubah; `owner_member_id`/`recorded_by_member_id` diarahkan ke member baru; kategori di-dedupe by nama (transaksi diarahkan ke kategori target yang namanya sama, sisanya dibuat); akun yang namanya bentrok dengan akun target milik member lain tidak masalah (unik per owner); budget household lama menjadi budget **member** baru di target (karena anggaran lama bersifat pribadi); household lama di-soft-delete. Operasi satu transaksi DB; bisa lama untuk ribuan baris, tetap < 10 detik untuk skala rumah tangga.
   - Keputusan: **merge tidak bisa di-undo lewat UI**; API menyimpan `households.merged_into_household_id` dan `audit_log` lengkap agar operator bisa membantu. Dicatat Q-07.
4. Setelah accept, kedua owner melihat akun masing-masing; akun hasil merge tetap `owner = member baru`, `visibility = shared` (default household). Pasangan bisa mengubah ke `private` per akun.

## 6. Idempotency

- Berlaku untuk semua endpoint bertanda ✓. Key scoped ke credential (`api_key_id` atau `member_id` untuk JWT).
- Alur middleware: hitung `request_hash = sha256(method + path + canonical_json(body))`. `INSERT … status='in_progress' ON CONFLICT DO NOTHING RETURNING *`.
  - Insert berhasil → jalankan handler → `UPDATE status='completed', response_status, response_body`.
  - Konflik, baris `completed`, hash sama → kembalikan respons tersimpan + `Idempotent-Replayed: true` (status sama persis, termasuk 4xx).
  - Konflik, hash beda → `422 idempotency_key_reused`.
  - Konflik, `in_progress` (request paralel) → `409 idempotency_in_progress` + `Retry-After: 2`.
  - Handler melempar 5xx → baris dihapus agar retry bisa mencoba lagi.
- Respons tersimpan maksimal 64 KB; lebih dari itu disimpan hanya status + `{replayed_truncated:true, resource_id}`.
- TTL 24 jam (`IDEMPOTENCY_TTL_HOURS`).

## 7. Daftar lengkap `error.code`

| HTTP | code | Kapan | hint default |
|---|---|---|---|
| 400 | `validation_error` | zod gagal; `details.issues` | Perbaiki field yang disebut |
| 400 | `invalid_period` | period tidak dikenal / from > to | Gunakan this_month, last_month, YYYY-MM, atau from & to |
| 400 | `invalid_amount_text` | `amount_text` tidak bisa di-parse | Contoh: "45rb", "1,2 juta", 45000 |
| 400 | `invalid_cursor` | | Mulai lagi tanpa cursor |
| 400 | `ai_not_configured` | `ai_config` kosong | Atur provider & API key di Settings → AI Coach |
| 400 | `weak_password` | | Minimal 8 karakter |
| 401 | `unauthorized` | tanpa header | Kirim Authorization: Bearer |
| 401 | `invalid_token` | JWT rusak/tanda tangan salah | Login ulang |
| 401 | `token_expired` | | Refresh token |
| 401 | `invalid_api_key` | format/hash tidak cocok | Periksa key; buat baru di Settings → API Key |
| 401 | `api_key_revoked` | | Buat key baru |
| 401 | `api_key_expired` | | |
| 401 | `api_key_member_removed` | member pemilik key sudah keluar | |
| 401 | `invalid_signature` | webhook Midtrans | |
| 401 | `invalid_secret` | internal | |
| 403 | `forbidden` | umum | |
| 403 | `insufficient_scope` | key `read` mencoba menulis | Buat key dengan scope write |
| 403 | `not_household_member` | | |
| 403 | `jwt_required` | endpoint `/me`, `/ai` dengan API key | |
| 403 | `forbidden_account` | menulis ke akun privat orang lain | Minta pemilik akun yang mencatat, atau ubah visibilitas |
| 403 | `forbidden_owner` | non-admin membuat akun untuk member lain | |
| 403 | `private_scope` | summary member lain yang punya akun privat | |
| 403 | `scope_exceeds_role` | | |
| 403 | `invitation_email_mismatch` | | Login dengan email yang diundang |
| 403 | `feature_disabled` | endpoint fitur opsional (`/v1/beneficiaries`, `/v1/shopping`, `/v1/pantry`, `/v1/receipts/ingest`) saat flag household mati; `details.feature` | Aktifkan di Settings → Household → Fitur opsional |
| 404 | `not_found` | resource umum | |
| 404 | `account_not_found` | + `candidates` saran | Lihat GET /v1/accounts |
| 404 | `category_not_found` | + `candidates` | Lihat GET /v1/categories atau buat kategori |
| 404 | `member_not_found` | | |
| 404 | `transaction_not_found`, `debt_not_found`, `goal_not_found`, `piutang_not_found`, `recurring_not_found`, `budget_not_found` | | |
| 404 | `invitation_invalid` | code tidak ada / sudah revoke | |
| 404 | `beneficiary_not_found` | + `candidates` (F-A) | Lihat GET /v1/beneficiaries atau buat baru |
| 404 | `shopping_item_not_found`, `pantry_item_not_found` | (F-D) | |
| 409 | `ambiguous_account` | + `candidates` | Sebut pemilik ("BCA suami") atau kirim account_id |
| 409 | `ambiguous_category`, `ambiguous_member`, `ambiguous_debt`, `ambiguous_goal`, `ambiguous_piutang` | | |
| 409 | `ambiguous_beneficiary` | + `candidates` (F-A) | Pilih kandidat atau kirim beneficiary_id |
| 409 | `duplicate_account_name` | nama sama untuk pemilik sama | |
| 409 | `duplicate_category_name`, `duplicate_budget` | | |
| 409 | `already_member` | | |
| 409 | `last_owner` | menurunkan/menghapus owner terakhir | Jadikan member lain owner dulu |
| 409 | `last_owner_with_members` | hapus akun user | |
| 409 | `cannot_remove_self` | | Gunakan POST /v1/members/me/leave |
| 409 | `idempotency_in_progress` | | Coba lagi dalam 2 detik |
| 409 | `duplicate_recurring_execution` | | |
| 410 | `invitation_expired` | | Minta undangan baru |
| 413 | `payload_too_large` | body > 1 MB, gambar > 5 MB | |
| 422 | `insufficient_funds` | `{balance, needed, account_name}` | Pilih akun lain, kurangi nominal, atau koreksi saldo |
| 422 | `receipt_total_mismatch` | `sum(items.amount) != total` di `POST /v1/receipts/ingest`; `details.{sum_items,total}` (F-D) | Alokasikan diskon ke item, kirim total yang sama |
| 422 | `same_account_transfer` | | |
| 422 | `category_type_mismatch` | kategori income untuk expense | |
| 422 | `category_reserved` | mengubah/menghapus kategori sistem, atau memakai "Transfer" di POST /transactions | Gunakan POST /v1/transfers |
| 422 | `category_in_use` | `{count}` | Kirim merge_into_category_id |
| 422 | `transfer_edit_limited` | | Hapus transfer dan buat baru |
| 422 | `would_make_balance_negative` | hapus income | |
| 422 | `account_has_balance`, `account_has_transactions`, `account_in_use_by_recurring` | | |
| 422 | `private_requires_owner` | | |
| 422 | `reassign_required` | | |
| 422 | `debt_already_settled`, `piutang_already_settled` | | |
| 422 | `overpayment` | `{remaining}` | Kirim allow_overpay: true kalau memang disengaja |
| 422 | `batch_too_large` | > 100 item | |
| 422 | `idempotency_key_reused` | key sama, body beda | Gunakan key baru |
| 422 | `provider_no_vision` | | Pilih provider OpenAI/Anthropic/Google/Groq vision |
| 422 | `actor_mismatch` | internal consistency | laporkan bug |
| 429 | `rate_limited` | + `Retry-After` | |
| 500 | `internal_error` | + `request_id` | |
| 502 | `upstream_ai_error` | `{provider, status}` | |
| 503 | `database_unavailable` | | Supabase pause / koneksi gagal |

`packages/shared/src/errors.ts` mengekspor union `ErrorCode` dan peta `code → {http, message_id, hint_id}`; `apps/api/src/db/errors.ts` memetakan `MESSAGE` plpgsql ke code yang sama.

## 8. Rate limit

- Hanya untuk API key (JWT dibatasi oleh Supabase Auth dan UI).
- Default `60/menit` dan `2000/hari` per key (env). `bump_rate_limit()` dipanggil sebelum handler; `429 rate_limited` dengan header sisa kuota dan `Retry-After` (detik ke window berikutnya).
- Endpoint `/v1/ai/*` dan `/v1/transactions/export.csv` tidak tersedia untuk API key, jadi tidak perlu limit khusus.
- Perlindungan brute-force key: request dengan key tidak valid dibatasi per IP 20/menit di memori proses (best effort; Vercel multi-instance) dan dicatat log.

## 9. CORS, keamanan transport, konten

- CORS: `Access-Control-Allow-Origin` hanya dari `CORS_ORIGINS`; `Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-Household-Id, X-Request-Id`; `Expose-Headers: X-Request-Id, Idempotent-Replayed, X-RateLimit-*`; `Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`. Request API key dari browser tidak diharapkan; CORS tidak membedakan.
- `Strict-Transport-Security: max-age=63072000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Body maksimal 1 MB (`payload_too_large`), kecuali scan receipt 5 MB.
- Tidak ada secret di respons: `api_keys.key_hash` tidak pernah di-select oleh API; `ai_config.api_key` tidak pernah dikembalikan; `audit_log.payload` diredaksi untuk field `api_key`, `secret`, `password`, `authorization`.
- Log tidak mencatat body atau header Authorization.

## 10. OpenAPI

- `app.doc31('/v1/openapi.json', { openapi: '3.1.0', info: {title: 'Karaya Finance API', version: '1.0.0'}, servers: [{url: API_PUBLIC_URL}] })`.
- `securitySchemes`: `bearerJwt` (http bearer, format JWT) dan `apiKey` (http bearer, deskripsi `kf_live_…`). Setiap operasi mendeklarasikan `security` sesuai kolom Auth, dan `x-karaya-scope: read|write|admin`.
- Setiap operasi punya `operationId` snake_case yang **sama dengan nama tool** di manifest bila ada padanan (`record_expense` ↔ `POST /v1/transactions` dengan `type=expense` adalah pengecualian: tool `record_expense` dan `record_income` keduanya memetakan ke `create_transaction` dengan `type` terisi; dicatat di `x-karaya-tool`).
- Contoh request/response wajib untuk endpoint yang dipakai agent (transactions, transfers, summary, budgets/status, resolve, debts payments).
- `/v1/docs` memakai Scalar dengan `authentication.preferredSecurityScheme = 'apiKey'`.

## 11. Pemetaan masalah struktural → solusi di bab ini

| # | Solusi |
|---|---|
| 6 | §4: semua entitas lewat API; `apps/web` dilarang `supabase.from` (lint) |
| 7 | §1, §4, §6, §10: REST, OpenAPI, idempotency |
| 8 | §3.2: API key jangka panjang |
| 9 | §4.2, §5: household, members, invitations, merge |
