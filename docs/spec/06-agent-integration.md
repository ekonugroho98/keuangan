Status: draft
Terakhir diubah: 2026-10-08
Bergantung pada: 05-api.md, 03-database.md

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-08 | §2 (tabel tool, total) | +10 tool F-A/F-B/F-D (`list_beneficiaries`, `add_beneficiary`, `get_monthly_report`, `ingest_receipt`, `list_shopping`, `add_shopping_item`, `mark_bought`, `shopping_suggestions`, `list_pantry`, `adjust_pantry`); total 22→32; `record_expense`/`record_expense_batch`/`update_transaction`/`search_transactions`/`get_summary` dapat parameter opsional `beneficiary` | Implementasi tool Hermes untuk fitur opsional (`10-fitur-opsional-keluarga.md` §2.4), setelah backend+web selesai 2026-10-07. |

# 06 — Integrasi AI Agent (Hermes) : Tool Manifest, Resolusi Nama, Skenario End-to-End

## 1. Gambaran

```
Telegram ──► Hermes Agent (workspace user) ──► https://api.karaya.app/v1/*  (Authorization: Bearer kf_live_…)
                 │  membaca /v1/openapi.json saat setup
                 │  memuat apps/api/tools/hermes-tools.json sebagai function-calling tools
                 └─ setiap tool = satu HTTP call; Idempotency-Key = uuid v4 per niat user
```

Hermes tidak punya logika keuangan. Semua validasi, resolusi nama, dan perhitungan ada di API. Hermes hanya: (1) memilih tool dari kalimat user, (2) mengisi argumen dengan kata-kata user apa adanya (`account: "BCA istri"`), (3) meneruskan `error.message` ke user bila 4xx dan menawarkan `candidates`, (4) mengulang request dengan `account_id` setelah user memilih.

## 2. Tool manifest (`apps/api/tools/hermes-tools.json`)

Di-generate dari `apps/api/src/tools/registry.ts` oleh `pnpm gen:tools`. Format: array `{name, description, parameters (JSON Schema draft 2020-12), endpoint:{method, path, query_or_body}, scope, idempotent}`. Field `endpoint` adalah ekstensi non-standar agar Hermes bisa memetakan tool → HTTP tanpa kode khusus. Deskripsi tool dalam Bahasa Indonesia dengan contoh kalimat, karena model yang dipakai Hermes membaca deskripsi untuk memilih tool.

| Tool | Endpoint | Scope | Deskripsi singkat | Contoh kalimat pemicu |
|---|---|---|---|---|
| `list_accounts` | `GET /v1/accounts` | read | Daftar akun dengan saldo dan pemilik | "saldo kita berapa?", "akun apa saja yang ada", "BCA istri sisa berapa" |
| `list_members` | `GET /v1/members` | read | Anggota household dan alias | "siapa saja di keluarga ini" (jarang; dipakai agent saat ambigu) |
| `list_categories` | `GET /v1/categories` | read | Kategori + alias | dipakai agent sebelum mencatat agar memilih kategori valid |
| `resolve_name` | `POST /v1/resolve` | read | Cocokkan nama akun/kategori/member/hutang/goal/piutang | internal: "cicilan motor itu hutang yang mana" |
| `get_summary` | `GET /v1/summary` | read | Ringkasan periode: total, kategori teratas, per member, saldo, budget, hutang | "gimana keuangan bulan ini", "pengeluaran istri bulan lalu berapa", "bulan ini hemat gak" |
| `get_budget_status` | `GET /v1/budgets/status` | read | Sisa anggaran per kategori | "sisa anggaran makan bulan ini", "budget transport masih ada?" |
| `search_transactions` | `GET /v1/transactions` | read | Cari transaksi dengan filter | "pengeluaran di atas 500rb minggu ini", "transaksi BCA suami kemarin", "belanja apa aja di Indomaret" |
| `record_expense` | `POST /v1/transactions` (`type=expense`) | write | Catat pengeluaran | "catat belanja sayur 45rb dari BCA istri", "bayar parkir 5rb cash" |
| `record_income` | `POST /v1/transactions` (`type=income`) | write | Catat pemasukan | "gaji masuk 12 juta ke BCA suami", "dapat THR 3jt" |
| `record_expense_batch` | `POST /v1/transactions/batch` | write | Beberapa pengeluaran dari satu akun | "tadi di pasar: sayur 20rb, ayam 45rb, buah 30rb, semua dari cash istri" |
| `record_transfer` | `POST /v1/transfers` | write | Pindah dana antar akun | "transfer 2 juta dari BCA suami ke tabungan bersama", "topup gopay 100rb dari BCA" |
| `update_transaction` | `PATCH /v1/transactions/{id}` | write | Ubah transaksi (biasanya yang baru dicatat) | "eh salah, yang tadi 54rb bukan 45rb", "ganti kategorinya jadi Transport" |
| `delete_transaction` | `DELETE /v1/transactions/{id}` | write | Hapus (soft) | "hapus transaksi terakhir", "batalkan yang tadi" |
| `adjust_balance` | `POST /v1/accounts/{id}/adjust-balance` | write | Set saldo aktual | "saldo BCA istri sekarang 3.250.000", "koreksi saldo cash jadi 150rb" |
| `list_debts` | `GET /v1/debts` | read | Hutang dan sisa | "hutang kita tinggal berapa", "cicilan apa saja bulan ini" |
| `pay_debt` | `POST /v1/debts/{id}/payments` | write | Bayar cicilan | "bayar cicilan motor 1,2 juta dari BCA suami" |
| `list_goals` | `GET /v1/goals` | read | Target tabungan | "tabungan liburan sudah berapa" |
| `contribute_goal` | `POST /v1/goals/{id}/contributions` | write | Top-up goal | "nabung 500rb ke dana darurat dari BCA bersama" |
| `list_piutang` | `GET /v1/piutang` | read | Piutang | "si Budi masih utang berapa ke kita" |
| `receive_piutang` | `POST /v1/piutang/{id}/receipts` | write | Terima pembayaran piutang | "Budi bayar 250rb ke BCA suami" |
| `list_recurrings` | `GET /v1/recurrings` | read | Tagihan rutin dan jatuh tempo | "tagihan apa yang jatuh tempo minggu ini" |
| `run_recurrings` | `POST /v1/recurrings/run` | write | Eksekusi tagihan rutin jatuh tempo | "jalankan tagihan rutin sekarang" |
| `list_beneficiaries` | `GET /v1/beneficiaries` | read, **F-A** | "Untuk siapa" yang sudah dikenal | "siapa aja yang bisa dipilih buat 'untuk'" |
| `add_beneficiary` | `POST /v1/beneficiaries` | write, **F-A** | Tambah "untuk siapa" baru | "tambah Seno sebagai penerima" |
| `get_monthly_report` | `GET /v1/reports/monthly` | read (SELALU tersedia) | Laporan bulanan siap-kirim (`text_id`) | "laporan bulan ini", dipicu jadwal `features.monthly_report` |
| `ingest_receipt` | `POST /v1/receipts/ingest` | write, **F-D** | Satu struk → transaksi + coret belanja + tambah stok | foto struk / "tadi beli pampers 48.500 di indomaret" |
| `list_shopping` | `GET /v1/shopping` | read, **F-D** | Daftar belanja yang masih perlu dibeli | "apa aja yang perlu dibeli" |
| `add_shopping_item` | `POST /v1/shopping` | write, **F-D** | Tambah item ke daftar belanja (tanpa harga) | "inget beli sabun cuci" |
| `mark_bought` | `PATCH /v1/shopping/{id}` | write, **F-D** | Tandai item belanja sudah dibeli | dipakai setelah list_shopping dapat id |
| `shopping_suggestions` | `GET /v1/shopping/suggestions` | read, **F-D** | Barang stok menipis belum ada di daftar belanja | "ada yang perlu ditambah ke belanja dari stok?" |
| `list_pantry` | `GET /v1/pantry` | read, **F-D** | Stok rumah (kulkas/freezer/lemari) | "ada apa aja di kulkas", "apa yang mau basi" |
| `adjust_pantry` | `POST /v1/pantry/{id}/movements` | write, **F-D** | Ubah qty stok (pakai/buang/koreksi) | "abis telur 4", "telurnya dibuang 2" |

Total 32 tool (22 inti + 10 F-A/F-B/F-D opsional, 10-fitur-opsional-keluarga.md §2.4, ditambah 2026-10-08).
Tool bertanda **F-A**/**F-D** hanya ditawarkan ke model kalau `features.beneficiary`/`features.shopping_stock`
aktif (dicek dari `GET /v1/households/current`, bukan dari manifest — manifest ini tetap statis/berisi semua
tool). `get_monthly_report` TIDAK bersyarat (F-B selalu tersedia; flag hanya mengatur jadwal kirim OTOMATIS,
bukan akses tool ini). `record_expense`, `record_expense_batch`, `update_transaction`, `search_transactions`,
`get_summary` mendapat parameter opsional baru (`beneficiary`, dan `scope=beneficiary` untuk get_summary) yang
HANYA boleh diisi kalau `features.beneficiary` aktif DAN user menyebut penerima secara eksplisit — jangan
menebak. Kata "bersama"/"keluarga" sebagai nilai `beneficiary` berarti "tanpa penerima tertentu" (dipakai untuk
mengosongkan lewat update_transaction atau memfilter lewat search_transactions/get_summary).

Tool yang menerima `account`, `category`, `member`, `to_account`, `from_account` mendeklarasikan parameter sebagai `oneOf` string nama **atau** UUID (`format: uuid`); API menentukan dari bentuknya.

Contoh satu entri:

```json
{
  "name": "record_expense",
  "description": "Catat PENGELUARAN dari satu akun. Gunakan saat user menyebut belanja/bayar/beli. Sebutkan akun persis seperti kata user (mis. \"BCA istri\", \"cash\", \"gopay suami\"). Kalau user tidak menyebut akun, tanya dulu, jangan menebak. Kategori pilih dari list_categories; kalau tidak yakin pakai nama yang paling dekat, API akan mencocokkan alias. Contoh: \"catat belanja sayur 45rb dari BCA istri\" → {amount_text:\"45rb\", account:\"BCA istri\", category:\"Makanan\", note:\"belanja sayur\"}.",
  "parameters": {
    "type": "object",
    "properties": {
      "amount_text": { "type": "string", "description": "Nominal seperti diucapkan: \"45rb\", \"1,2 juta\", \"45000\"" },
      "account": { "type": "string", "description": "Nama akun atau UUID. Boleh mengandung pemilik: \"BCA istri\"." },
      "category": { "type": "string", "description": "Nama kategori atau UUID" },
      "note": { "type": "string", "description": "Keterangan singkat, mis. \"belanja sayur\"" },
      "date": { "type": "string", "format": "date", "description": "YYYY-MM-DD; default hari ini (WIB). \"kemarin\" → isi tanggal kemarin." }
    },
    "required": ["amount_text", "account", "category"]
  },
  "endpoint": { "method": "POST", "path": "/v1/transactions", "body": { "type": "expense" } },
  "scope": "write",
  "idempotent": true
}
```

Registry (`tools/registry.ts`) juga menghasilkan: (a) tool definitions format OpenAI/Anthropic/Google untuk `/v1/ai/chat` internal dengan handler yang memanggil **service layer langsung** (bukan HTTP), (b) tabel di atas untuk dokumentasi (`pnpm gen:tools --md`).

## 3. Aturan perilaku agent (ditulis ke system prompt Hermes, bagian dari `docs/hermes/SETUP.md`)

1. Selalu kirim `Idempotency-Key` baru (uuid v4) untuk setiap **niat** user; kalau HTTP gagal karena jaringan, ulangi dengan key yang sama.
2. Jangan menebak akun. Kalau user tidak menyebut akun, tanya. Kalau API menjawab `409 ambiguous_*`, tampilkan `candidates` sebagai pilihan bernomor dan kirim ulang dengan `account_id`.
3. Jangan menebak nominal; `amount_text` harus persis dari user.
4. Setelah mutasi sukses, konfirmasi dengan **saldo baru** dari respons (`account.balance`), bukan dari hitungan sendiri.
5. Untuk pertanyaan ringkasan, pakai `get_summary` lalu rangkum; jangan memanggil `search_transactions` untuk menjumlah manual.
6. Tanggal relatif ("kemarin", "Senin lalu") dikonversi agent ke `YYYY-MM-DD` zona WIB; "bulan ini/lalu" dipetakan ke `period`.
7. Kata ganti pemilik: "saya/aku/gue" = member pemilik API key; "istri/suami/bunda/ayah" dicocokkan API lewat `members.aliases`; agent tidak perlu menerjemahkan.
8. Error 422 `insufficient_funds`: sampaikan `message` dan tawarkan akun lain dari `list_accounts`.
9. Jangan pernah menampilkan atau mengirim API key ke chat.

## 4. Algoritma resolusi nama (implementasi `resolve_account`, `resolve_category`, `resolve_member`)

### 4.1 Normalisasi

`norm(s) = lower(unaccent(regexp_replace(trim(s), '[^[:alnum:][:space:]]+', ' ', 'g')))`, lalu `tokens = string_to_array(regexp_replace(norm, '\s+', ' ', 'g'), ' ')`.

### 4.2 Ekstraksi pemilik (khusus akun)

Untuk setiap token (dan bigram): cocokkan dengan
- `household_members.aliases` dan `norm(display_name)` member aktif household → `owner_filter = member_id`
- kata `saya|aku|gue|gw|ku` → `owner_filter = actor_member_id`
- kata `bersama|joint|keluarga|rumah|kita` → `owner_filter = joint`

Token yang cocok dibuang dari `name_tokens`. Lebih dari satu owner berbeda terdeteksi → `ambiguous_member` (kalimat seperti "BCA suami istri" tidak masuk akal).

`name_query = array_to_string(name_tokens, ' ')`. Kalau kosong (user hanya bilang "akun istri") → kandidat = semua akun owner tersebut; satu → ok, lebih → ambiguous.

### 4.3 Skoring kandidat

Hanya akun `deleted_at IS NULL` di household. Untuk tiap akun hitung skor tertinggi dari:

| Kondisi | Skor |
|---|---|
| `norm(name) = name_query` atau `name_query = ANY(norm(aliases))` | 100 |
| `norm(name)` dimulai dengan `name_query` atau sebaliknya (prefix), panjang query ≥ 3 | 75 |
| `name_query` adalah substring dari `norm(name)` atau alias (contoh "bca" ⊂ "bca tahapan") | 70 |
| `similarity(norm(name), name_query) >= 0.45` (pg_trgm) | `round(similarity*100)` (45–99), dibatasi ≤ 69 |
| Semua token `name_query` muncul sebagai kata di `norm(name)` (urutan bebas) | 80 |

Lalu terapkan `owner_filter`: kalau ada, kandidat dengan owner lain **dibuang**. Kalau tidak ada filter, semua owner ikut.

### 4.4 Keputusan

- Ambil skor maksimum `S`. Kandidat = akun dengan skor ≥ `S − 10` dan skor ≥ 45.
- 0 kandidat → `not_found`; `candidates` = 3 akun teratas by similarity (skor berapa pun) sebagai saran.
- 1 kandidat → `ok`.
- > 1 kandidat → `ambiguous`, **kecuali** `p_prefer_own = true` dan tepat satu kandidat milik actor → `ok` (default false, lihat Q-08).
- Akun privat milik orang lain tetap bisa menjadi kandidat (untuk tujuan transfer) tetapi `balance` tidak disertakan; untuk operasi sumber dana, pemeriksaan `can_post_to_account` di fungsi tulis akan menolak dengan `forbidden_account`.

### 4.5 Kategori

Sama tanpa langkah pemilik; `p_type` menyaring `type IN (p_type, 'both')`. Kategori sistem `transfer` dan `balance_adjustment` **tidak** pernah menjadi kandidat `resolve_category` untuk `POST /v1/transactions` (ditangani endpoint khusus). Contoh: "makan" → alias Makanan (100); "sayur" → alias Makanan (100); "indomaret" → tidak ada → `not_found` dengan saran `[Shopping, Makanan, Lainnya]`; agent lalu memilih (biasanya Shopping) dan mengirim ulang.

### 4.6 Hutang/goal/piutang by name

`resolve` dengan `kind=debt` memakai `debts.name`, `debts.aliases`; `goal` memakai `goals.name`; `piutang` memakai `borrower_name`. Tanpa filter pemilik, hanya baris aktif dan `remaining > 0` (untuk debt/piutang).

## 5. Skenario end-to-end (dari kalimat sampai SQL)

Konteks untuk semua skenario: household "Keluarga Eko" (`tz Asia/Jakarta`), member **Eko** (`display_name "Eko"`, aliases `{suami, ayah, papa}`), **Rina** (`aliases {istri, bunda, mama}`). Akun: `BCA` owner Eko (shared), `BCA` owner Rina (shared), `GoPay` owner Rina, `Cash` owner Eko, `Tabungan Bersama` joint. Hutang `Cicilan Motor` (aliases `{motor, cicilan motor}`), owner Eko, `remaining 9.600.000`, `monthly 1.200.000`. Budget household Makanan Oktober 2026 = 3.000.000. API key milik Eko, scope `write`. Tanggal hari ini 2026-10-04.

### Skenario 1 — "catat belanja sayur 45rb dari BCA istri"

Hermes → tool `record_expense` `{amount_text:"45rb", account:"BCA istri", category:"Makanan", note:"belanja sayur"}`

```http
POST /v1/transactions
Authorization: Bearer kf_live_…
Idempotency-Key: 7c1a…
{"type":"expense","amount_text":"45rb","account":"BCA istri","category":"Makanan","note":"belanja sayur"}
```

API:
1. Auth: hash key → `api_keys` → actor Eko, household H, scope write. `bump_rate_limit`.
2. Idempotency: insert `in_progress`.
3. `parseAmountId("45rb") = 45000`.
4. `resolve_account(H, Eko, 'BCA istri')`: token `istri` → alias Rina → `owner_filter = Rina`; `name_query = 'bca'`; kandidat: BCA(Rina) skor 100 (BCA Eko dibuang oleh filter) → `ok`, `account_id = A_rina_bca`.
5. `resolve_category(H, 'Makanan', 'expense')` → exact 100 → `C_makanan`.
6. Dalam transaksi DB dengan klaim `sub = eko.user_id`:
   ```sql
   SELECT * FROM post_transaction('H','M_eko','expense','A_rina_bca','C_makanan',45000,'2026-10-04','belanja sayur','api_key',NULL);
   ```
   Fungsi: cek actor, `can_post_to_account(A_rina_bca)` true (shared), lock akun, `account_balance >= 45000`, insert dengan `recorded_by_member_id = M_eko`.
7. Response 201 `{transaction:{…, account:{name:"BCA", owner:{display_name:"Rina"}}, recorded_by:{display_name:"Eko"}}, account:{id, name:"BCA", balance: 2955000}}`. Audit log `transactions.create`. Idempotency → `completed`.

Hermes → "Tercatat: belanja sayur Rp45.000 dari BCA Rina (Makanan). Saldo BCA Rina sekarang Rp2.955.000."

### Skenario 2 — "catat 50rb makan siang dari BCA" (ambigu)

Tool `record_expense` `{amount_text:"50rb", account:"BCA", category:"Makanan", note:"makan siang"}`.

Resolusi: tidak ada token pemilik; `name_query='bca'`; kandidat BCA(Eko)=100, BCA(Rina)=100 → `ambiguous`. API **tidak** menjalankan fungsi tulis apa pun. Respons 409 ikut disimpan di `idempotency_keys` (seperti 4xx lainnya); request terkoreksi punya body berbeda, jadi Hermes wajib memakai `Idempotency-Key` baru.

```http
409 Conflict
{"error":{"code":"ambiguous_account","message":"Ada 2 akun bernama \"BCA\": milik Eko dan milik Rina. Yang mana?","hint":"Kirim ulang dengan account_id salah satu kandidat, atau sebut pemiliknya (\"BCA suami\" / \"BCA istri\").","candidates":[{"id":"A_eko_bca","name":"BCA","owner":{"member_id":"M_eko","display_name":"Eko"}},{"id":"A_rina_bca","name":"BCA","owner":{"member_id":"M_rina","display_name":"Rina"}}],"details":{"field":"account"}}}
```

Hermes → "BCA yang mana? 1) BCA Eko 2) BCA Rina". User: "1". Hermes mengirim ulang `{…, account:"A_eko_bca"}` dengan Idempotency-Key baru → Skenario 1 jalur sukses. Tidak ada SQL mutasi pada request pertama.

### Skenario 3 — "transfer 2 juta dari BCA suami ke tabungan bersama"

Tool `record_transfer` `{amount_text:"2 juta", from_account:"BCA suami", to_account:"tabungan bersama"}`.

Resolusi `from`: `suami` → Eko → BCA(Eko) 100. `to`: token `bersama` → `owner_filter = joint`; `name_query='tabungan'`; kandidat `Tabungan Bersama` prefix 75 → ok.

```sql
SELECT * FROM post_transfer('H','M_eko','A_eko_bca','A_joint_tab',2000000,'2026-10-04',NULL,'api_key');
```
Fungsi: lock kedua akun `ORDER BY id`, saldo BCA Eko ≥ 2.000.000, kategori sistem transfer, note default `Transfer BCA → Tabungan Bersama`. Response `{transaction:{type:"transfer",…}, from_account:{balance: 8000000}, to_account:{balance: 15500000}}`.

### Skenario 4 — "berapa sisa anggaran makan bulan ini?"

Tool `get_budget_status` `{month:"2026-10", scope:"household"}` → `GET /v1/budgets/status?month=2026-10`.

SQL (service `budgets.status`):
```sql
WITH b AS (SELECT * FROM budgets WHERE household_id='H' AND period_start='2026-10-01' AND member_id IS NULL AND deleted_at IS NULL),
spent AS (
  SELECT t.category_id, SUM(t.amount) AS spent
  FROM transactions t WHERE t.household_id='H' AND t.type='expense' AND t.deleted_at IS NULL
    AND t.date >= '2026-10-01' AND t.date < '2026-11-01'
  GROUP BY t.category_id)
SELECT b.id, c.name, b.amount, COALESCE(s.spent,0) AS spent, b.amount - COALESCE(s.spent,0) AS remaining
FROM b JOIN categories c ON c.id=b.category_id LEFT JOIN spent s ON s.category_id=b.category_id;
```
Response `{period:{label:"Oktober 2026"}, items:[{category:{name:"Makanan"}, amount:3000000, spent:1245000, remaining:1755000, pct:41.5, status:"ok"}], …}`.

Hermes → "Anggaran Makanan Oktober: terpakai Rp1.245.000 dari Rp3.000.000. Sisa Rp1.755.000 (41%)." Agent memilih item "Makanan" dari kata "makan" sendiri; kalau ragu, panggil `resolve_name {kind:"category", query:"makan"}` dulu.

### Skenario 5 — "pengeluaran istri bulan lalu berapa?"

Tool `get_summary` `{period:"last_month", scope:"member", member:"istri"}` → `GET /v1/summary?period=last_month&scope=member&member=istri`.

API: `resolve_member(H,'istri')` → Rina. `attribution=owner` default → akun milik Rina (BCA Rina, GoPay). Period: September 2026 (`2026-09-01`..`2026-09-30`).
```sql
SELECT type, SUM(amount) FROM transactions t JOIN accounts a ON a.id=t.account_id
WHERE t.household_id='H' AND t.deleted_at IS NULL AND a.owner_member_id='M_rina'
  AND t.date BETWEEN '2026-09-01' AND '2026-09-30' AND t.type IN ('income','expense') GROUP BY type;
```
plus top kategori. Karena actor Eko dan Rina tidak punya akun privat → diizinkan. Kalau Rina punya akun privat → `403 private_scope` (default) dan Hermes menyampaikan "Rina punya akun privat; ringkasan per orang tidak tersedia."

Hermes → "Pengeluaran Rina (dari akun miliknya) September: Rp4.310.000. Terbesar: Makanan Rp1,9jt, Transport Rp800rb. Catatan: belanja dari rekening bersama tidak dihitung ke Rina." (kalimat terakhir dari field `summary.notes` yang disediakan API untuk scope member).

### Skenario 6 — "bayar cicilan motor 1,2 juta dari BCA suami"

Hermes: tool `resolve_name` `{kind:"debt", query:"cicilan motor"}` → `{status:"ok", match:{id:"D_motor", name:"Cicilan Motor", remaining:9600000}}`. Lalu `pay_debt` `{debt_id:"D_motor", amount_text:"1,2 juta", account:"BCA suami"}` → `POST /v1/debts/D_motor/payments`.

```sql
SELECT pay_debt('H','M_eko','D_motor','A_eko_bca',1200000,'2026-10-04',NULL);
-- di dalam: post_transaction(expense, kategori system_key='debt_payment', note 'Cicilan Cicilan Motor' → dinormalisasi 'Cicilan Motor'), INSERT debt_payments
```
Response `{debt:{remaining: 8400000, paid: 1200000+…}, transaction:{…}, account:{balance: 6800000}}`.

Hermes → "Cicilan Motor Rp1.200.000 dibayar dari BCA Eko. Sisa hutang Rp8.400.000. Saldo BCA Eko Rp6.800.000."

Alternatif tanpa pre-resolve: agent bisa memanggil `pay_debt` dengan `debt:"cicilan motor"`? **Tidak** untuk v1: path butuh `{id}`. Alasan: menjaga REST murni; biaya satu panggilan `resolve` kecil. Dicatat Q-09.

### Skenario 7 — request yang sama dua kali dengan `Idempotency-Key` sama

Hermes mengirim Skenario 1; respons 201 hilang di jaringan; Hermes mengirim ulang **byte-identik** dengan key `7c1a…`.

API: `INSERT idempotency_keys … ON CONFLICT DO NOTHING` → konflik; baris `completed`, `request_hash` sama → langsung kembalikan body tersimpan, status 201, header `Idempotent-Replayed: true`. **Tidak ada** SQL mutasi; `transactions` tetap satu baris; saldo tidak berubah. Audit log mencatat `transactions.create.replayed`.

Kalau Hermes mengirim key sama tapi body beda (mis. 54rb) → `422 idempotency_key_reused`, hint "Gunakan Idempotency-Key baru". Kalau request pertama masih berjalan → `409 idempotency_in_progress`, `Retry-After: 2`.

### Skenario tambahan — scan struk oleh istri lewat web, dicek suami lewat Telegram

Rina memakai web (JWT) → `POST /v1/transactions/batch` dengan 6 item dari `GoPay`. Eko bertanya "istri belanja apa aja hari ini?" → `search_transactions {period:"today", member:"istri"}` → daftar 6 transaksi dengan `recorded_by: Rina`, `account.owner: Rina`.

## 6. Setup di Hermes

Dokumen `docs/hermes/SETUP.md` (dibuat Fase 7) berisi langkah:

1. Owner membuat API key di web: Settings → API Key → "Buat key" → nama "Hermes Telegram", scope `write`, member = dirinya → salin `kf_live_…` (ditampilkan sekali).
2. Di workspace Hermes: set env `KARAYA_API_BASE=https://api.karaya.app`, `KARAYA_API_KEY=kf_live_…`.
3. Hermes memuat `hermes-tools.json` (URL `https://api.karaya.app/v1/tools/hermes.json`, endpoint statis yang menyajikan file yang sama; ditambahkan ke tabel endpoint sebagai `GET /v1/tools/hermes.json`, auth none) dan system prompt dari `docs/hermes/SYSTEM_PROMPT.md` (berisi aturan §3).
4. Uji: "saldo kita berapa?" → `list_accounts`. "catat kopi 25rb dari cash" → `record_expense`.
5. Masing-masing pasangan bisa membuat key sendiri (member = dirinya) agar `recorded_by` benar bila keduanya memakai Hermes dari Telegram masing-masing. Satu key dipakai bersama akan membuat semua catatan beratribut `recorded_by` pemilik key; ini **bukan** salah data uang (pemilik uang tetap dari akun), hanya salah siapa yang mencatat.

## 7. Opsi fase lanjutan: MCP server tipis (`apps/mcp`)

- Paket `@karaya/mcp` yang mengekspos tool dari registry yang sama lewat protokol MCP (stdio untuk Claude Desktop/Code, atau streamable HTTP). Implementasi: wrapper yang membaca `hermes-tools.json` dan memanggil API dengan API key dari env. Tidak ada logika baru.
- Nilai: pengguna Claude Desktop/Code bisa memakai Karaya tanpa Hermes. Biaya: satu paket kecil (~200 baris), tanpa deploy (stdio lokal) atau sebagai route tambahan di `apps/api` (`/mcp`).
- Ditunda ke setelah Fase 7; dicatat di `08` sebagai Fase 8 opsional.

## 8. Checklist kriteria "ramah agent" (dipakai saat review Fase 6–7)

- [ ] Setiap tool dapat dieksekusi hanya dengan informasi dari kalimat user + hasil `list_*` sebelumnya.
- [ ] Tidak ada tool yang membutuhkan > 1 panggilan HTTP kecuali `pay_debt`/`contribute_goal`/`receive_piutang` (resolve + aksi).
- [ ] Setiap error 4xx punya `message` yang bisa langsung dibacakan ke user dan `hint` yang bisa ditindaklanjuti agent.
- [ ] Mengulang request dengan `Idempotency-Key` sama tidak pernah menggandakan data (uji otomatis di `test/integration/idempotency.test.ts`).
- [ ] "BCA" saja dengan dua akun BCA → 409, bukan tebakan (uji `test/unit/resolver.test.ts`).
- [ ] `get_summary` menjawab 5 pertanyaan dasar ("gimana bulan ini", "pengeluaran siapa", "saldo total", "kategori terbesar", "hutang tinggal berapa") dalam satu panggilan.
