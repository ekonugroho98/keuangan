# Karaya Keuangan — Edge Functions API Documentation

Base URL: `https://twcrflhvxzatpfrjmqzi.supabase.co/functions/v1`

## Authentication

Base Auth URL: `https://twcrflhvxzatpfrjmqzi.supabase.co/auth/v1`

Semua request ke edge function membutuhkan JWT token. Dapat token via Register atau Login.

### Register (Daftar User Baru)

```bash
curl -s "$BASE_URL/auth/v1/signup" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@email.com",
    "password": "password123",
    "data": { "full_name": "Nama Lengkap" }
  }'
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "xxx...",
  "user": {
    "id": "91c69204-...",
    "email": "newuser@email.com",
    "user_metadata": { "full_name": "Nama Lengkap" }
  }
}
```

> Catatan: Jika email confirmation aktif, user perlu verifikasi email dulu sebelum dapat token.

### Login

```bash
curl -s "$BASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"password"}'
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "xxx...",
  "expires_in": 3600
}
```

### Refresh Token (Perpanjang Session)

Token berlaku ~1 jam. Gunakan refresh token untuk dapat token baru tanpa login ulang:

```bash
curl -s "$BASE_URL/auth/v1/token?grant_type=refresh_token" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"xxx..."}'
```

### Pakai Token

Gunakan `access_token` di header setiap request ke edge function:
```
Authorization: Bearer <access_token>
```

---

## 1. Transactions

**Endpoint:** `POST /functions/v1/transactions`

Semua operasi transaksi + update saldo akun otomatis dengan rollback jika gagal.

### 1.1 Add (Tambah Transaksi)

Tambah 1 transaksi. Saldo akun otomatis berkurang (expense) atau bertambah (income).

```json
{
  "action": "add",
  "type": "expense | income",
  "amount": 50000,
  "category": "Makanan",
  "note": "Nasi Padang",
  "date": "2026-05-29",
  "account_name": "BSI",
  "icon": "🍔"
}
```

**Response:**
```json
{
  "transaction": { "id": "...", "type": "expense", "amount": 50000, ... },
  "account": { "id": "...", "name": "BSI", "balance": 5450645, ... }
}
```

**Validasi:**
- Expense: saldo harus cukup, jika tidak → error
- Akun harus ada, jika tidak → error

---

### 1.2 Add Multiple (Batch Insert)

Tambah beberapa transaksi sekaligus (misal dari scan struk). Semua bertipe expense.

```json
{
  "action": "add-multiple",
  "account_name": "BSI",
  "date": "2026-05-27",
  "items": [
    { "amount": 35000, "category": "Makanan", "note": "Ayam geprek", "icon": "🍔" },
    { "amount": 25000, "category": "Makanan", "note": "Es teh", "icon": "🍔" },
    { "amount": 25000, "category": "Transport", "note": "Parkir", "icon": "🚗" }
  ]
}
```

**Response:**
```json
{
  "transactions": [ { ... }, { ... }, { ... } ],
  "account": { "id": "...", "balance": 8165645, ... }
}
```

**Validasi:**
- Total semua item harus <= saldo akun

---

### 1.3 Edit (Ubah Transaksi)

Edit transaksi yang sudah ada. Saldo otomatis di-revert dari nilai lama lalu di-apply dengan nilai baru. Mendukung pindah akun.

```json
{
  "action": "edit",
  "id": "<transaction_id>",
  "type": "expense",
  "amount": 75000,
  "category": "Makanan",
  "note": "Nasi Padang + Es Teh",
  "date": "2026-05-29",
  "account_name": "BSI",
  "icon": "🍔"
}
```

**Response:**
```json
{
  "transaction": { "id": "...", "amount": 75000, ... },
  "accounts": [ { "id": "...", "name": "BSI", "balance": 8140645, ... } ]
}
```

**Catatan:**
- Jika `account_name` berubah → saldo akun lama di-rollback, saldo akun baru di-deduct
- Transfer hanya bisa edit `note` dan `date`
- `accounts` berisi array akun yang terpengaruh (1 atau 2 akun)

---

### 1.4 Delete (Hapus Transaksi)

Hapus transaksi dan rollback saldo akun ke sebelum transaksi tersebut.

```json
{
  "action": "delete",
  "id": "<transaction_id>"
}
```

**Response:**
```json
{
  "success": true,
  "accounts": [ { "id": "...", "name": "GOPAY", "balance": 1190596, ... } ],
  "deletedId": "<transaction_id>"
}
```

**Catatan:**
- Expense dihapus → saldo bertambah kembali
- Income dihapus → saldo berkurang kembali
- Transfer dihapus → kedua akun di-rollback

---

### 1.5 Transfer (Pindah Dana Antar Akun)

Transfer dana dari satu akun ke akun lain. Saldo asal berkurang, tujuan bertambah.

```json
{
  "action": "transfer",
  "amount": 200000,
  "from_account": "BSI",
  "to_account": "GOPAY",
  "date": "2026-05-29",
  "note": "Top up GOPAY dari BSI"
}
```

**Response:**
```json
{
  "transaction": { "id": "...", "type": "transfer", ... },
  "accounts": [
    { "name": "BSI", "balance": 8250645, ... },
    { "name": "GOPAY", "balance": 1875596, ... }
  ]
}
```

**Validasi:**
- `from_account` dan `to_account` harus berbeda
- Saldo `from_account` harus cukup

---

### 1.6 Adjust Balance (Koreksi Saldo)

Koreksi saldo akun secara manual. Otomatis membuat transaksi "Koreksi Saldo" sebagai audit trail.

```json
{
  "action": "adjust-balance",
  "account_id": "<account_id>",
  "new_balance": 5000000
}
```

**Response:**
```json
{
  "account": { "id": "...", "balance": 5000000, ... },
  "transaction": { "id": "...", "category": "Koreksi Saldo", "amount": 500000, "type": "income", ... }
}
```

---

## 2. Financial Operations

**Endpoint:** `POST /functions/v1/financial-ops`

Operasi keuangan yang melibatkan update multi-tabel (akun + hutang/goal/piutang).

### 2.1 Pay Debt (Bayar Cicilan)

Bayar cicilan hutang. Saldo akun berkurang, sisa hutang berkurang, transaksi tercatat.

```json
{
  "action": "pay-debt",
  "debt_id": "<debt_id>",
  "amount": 500000,
  "account_name": "BSI",
  "date": "2026-05-29"
}
```

**Response:**
```json
{
  "transaction": { "id": "...", "category": "Hutang & Cicilan", ... },
  "account": { "balance": 5000645, ... },
  "debt": { "remaining": 4500000, ... }
}
```

---

### 2.2 Topup Goal (Tambah Dana Target)

Tambah dana ke target tabungan. Bisa dengan atau tanpa potong saldo akun.

```json
{
  "action": "topup-goal",
  "goal_id": "<goal_id>",
  "amount": 200000,
  "account_name": "BSI",
  "date": "2026-05-29"
}
```

Tanpa potong akun (hanya update goal):
```json
{
  "action": "topup-goal",
  "goal_id": "<goal_id>",
  "amount": 200000,
  "account_name": null
}
```

**Response:**
```json
{
  "goal": { "current": 700000, "target": 1000000, ... },
  "account": { "balance": 5300645, ... },
  "transaction": { ... },
  "reached": false
}
```

---

### 2.3 Add Piutang (Catat Piutang)

Catat piutang (uang dipinjamkan ke orang). Opsional potong saldo akun.

```json
{
  "action": "add-piutang",
  "payload": {
    "borrower_name": "Budi",
    "total": 500000,
    "remaining": 500000,
    "due_date": "2026-06-30",
    "note": "Pinjam untuk modal",
    "from_account": "BSI"
  },
  "from_account": "BSI"
}
```

Tanpa potong akun (hanya catat):
```json
{
  "action": "add-piutang",
  "payload": { "borrower_name": "Budi", "total": 500000, "remaining": 500000 },
  "from_account": null
}
```

**Response:**
```json
{
  "piutang": { "id": "...", "borrower_name": "Budi", ... },
  "account": { "balance": 5000645, ... },
  "transaction": { "category": "Piutang", ... }
}
```

---

### 2.4 Terima Piutang (Terima Pembayaran)

Terima pembayaran piutang. Saldo akun bertambah, sisa piutang berkurang.

```json
{
  "action": "terima-piutang",
  "piutang_id": "<piutang_id>",
  "amount": 250000,
  "account_name": "BSI"
}
```

**Response:**
```json
{
  "piutang": { "remaining": 250000, ... },
  "account": { "balance": 5750645, ... },
  "transaction": { "type": "income", "category": "Piutang", ... }
}
```

---

## 3. Auto Recurrings

**Endpoint:** `POST /functions/v1/auto-recurrings`

Eksekusi transaksi berulang yang sudah jatuh tempo. Biasanya dipanggil saat dashboard load.

```json
{
  "today": "2026-05-29"
}
```

**Response (ada yang dieksekusi):**
```json
{
  "executed": 3,
  "accounts": [ ... ],
  "transactions": [ ... ],
  "recurrings": [ ... ],
  "debts": [ ... ]
}
```

**Response (tidak ada yang jatuh tempo):**
```json
{
  "executed": 0
}
```

---

## 4. AI Chat

**Endpoint:** `POST /functions/v1/ai-chat`

Proxy AI multi-provider dengan server-side tool execution. API key dibaca dari `user_settings.ai_config` di database (tidak perlu dikirim dari client).

**Prasyarat:** User harus sudah set AI config di Settings > AI Coach (provider, model, apiKey tersimpan di DB).

```json
{
  "messages": [
    { "role": "user", "text": "Berapa pengeluaran bulan ini?" },
    { "role": "ai", "text": "Pengeluaran bulan ini Rp 2.5 juta..." },
    { "role": "user", "text": "Breakdown per kategori dong" }
  ]
}
```

**Response:**
```json
{
  "reply": "Berikut breakdown pengeluaran bulan ini:\n- Makanan: Rp 1.2 juta\n- Transport: Rp 500rb\n..."
}
```

**Catatan:**
- AI akan query database langsung untuk data keuangan (selalu fresh)
- Mendukung provider: OpenAI, Anthropic, Google, Groq, Mistral, xAI, DeepSeek, Kimi
- Tool calling otomatis untuk provider yang support (OpenAI, Anthropic, Google)
- 2-pass agent (query planner + analyst) untuk provider yang tidak reliable (Groq)

---

## Error Handling

Semua endpoint mengembalikan format error yang konsisten:

```json
{
  "error": "Pesan error dalam Bahasa Indonesia"
}
```

HTTP Status:
- `200` — Sukses
- `400` — Validasi gagal (saldo tidak cukup, akun tidak ditemukan, parameter kurang)
- `401` — Unauthorized (token invalid/expired)
- `404` — Data tidak ditemukan
- `500` — Server error (dengan auto-rollback jika memungkinkan)

---

## Contoh Penggunaan dengan curl

```bash
BASE="https://twcrflhvxzatpfrjmqzi.supabase.co"
ANON="<anon_key>"

# 1. Login
TOKEN=$(curl -s "$BASE/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"pass"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Add expense
curl -s "$BASE/functions/v1/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"add","type":"expense","amount":25000,"category":"Makanan","note":"Makan siang","date":"2026-05-29","account_name":"BSI","icon":"🍔"}'

# 3. Delete & rollback
curl -s "$BASE/functions/v1/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"delete","id":"<transaction_id>"}'
```

## Contoh Penggunaan dengan JavaScript (Supabase Client)

```javascript
import { supabase } from './lib/supabase';

// Helper
async function callEdge(fnName, body) {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

// Add expense
const result = await callEdge('transactions', {
  action: 'add',
  type: 'expense',
  amount: 50000,
  category: 'Makanan',
  note: 'Nasi Padang',
  date: '2026-05-29',
  account_name: 'BSI',
  icon: '🍔',
});
console.log('New balance:', result.account.balance);

// Delete & rollback
const del = await callEdge('transactions', {
  action: 'delete',
  id: result.transaction.id,
});
console.log('Rolled back:', del.accounts[0].balance);
```
