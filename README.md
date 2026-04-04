# 💰 Karaya Finance

Aplikasi pencatatan keuangan pribadi yang modern, lengkap, dan **100% gratis** untuk di-host sendiri.

> Dibangun dengan React + Supabase + Vercel. Tidak ada biaya langganan — kamu punya data kamu sendiri.

---

## ✨ Fitur

- 📊 **Dasbor** — ringkasan keuangan, tren 6 bulan, goals, hutang
- 💸 **Transaksi** — catat pemasukan & pengeluaran harian
- 🏦 **Multi Akun** — bank, dompet digital, tunai
- 🎯 **Target Finansial** — goals dengan progress & deadline
- 📋 **Hutang & Cicilan** — tracking hutang otomatis
- 📈 **Investasi & Aset** — emas (harga live), saham IDX (harga live via Yahoo Finance)
- 🔁 **Transaksi Berulang** — otomatis harian/mingguan/bulanan
- 🏷️ **Anggaran** — budget per kategori
- 🤖 **AI Financial Coach** — analisis keuangan via Groq
- 📱 **Responsive** — mobile friendly

---

## 🛠️ Tech Stack (Semua Gratis)

| Layer | Teknologi | Free Tier |
|-------|-----------|-----------|
| Frontend | React 18 + Vite | - |
| Database | Supabase | 500 MB DB, 5 GB bandwidth |
| Hosting | Vercel | Unlimited hobby projects |
| Backend API | Vercel Serverless (karaya-api) | 100 GB bandwidth |
| AI | Groq API | Free tier tersedia |
| Auth | Supabase Auth | 50.000 MAU |

---

## 🚀 Setup & Deployment

### 1. Fork & Clone

```bash
# Fork repo ini di GitHub, lalu clone
git clone https://github.com/USERNAME/catatan_keuangan_web.git
cd catatan_keuangan_web
npm install
```

### 2. Setup Supabase

1. Daftar di [supabase.com](https://supabase.com) (gratis)
2. Buat project baru
3. Buka **SQL Editor** → jalankan semua isi file `supabase_schema.sql`
4. Salin **Project URL** dan **Anon Key** dari Settings → API

### 3. Setup Environment Variables

```bash
cp .env.example .env
```

Edit file `.env`:
```env
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Opsional: jika kamu deploy karaya-api sendiri
VITE_API_BASE_URL=https://your-karaya-api.vercel.app
```

### 4. Deploy ke Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Atau connect GitHub repo langsung di [vercel.com](https://vercel.com) → tambahkan environment variables di Settings → Environment Variables.

### 5. Setup Backend API (Opsional)

Untuk harga emas & saham live, fork dan deploy juga **karaya-api**:
→ Lihat `README.md` di repo karaya-api

---

## 📁 Struktur Project

```
src/
├── components/
│   ├── dashboard/
│   │   ├── views/          # Halaman: Dasbor, Transaksi, Investasi, dll
│   │   ├── modals/         # Modal: Tambah Transaksi, Akun, dll
│   │   └── Sidebar.jsx
│   └── landing/            # Halaman login & landing
├── pages/
│   └── Dashboard.jsx       # Main app controller
├── services/
│   ├── goldPrice.js        # Harga emas live
│   └── stockPrice.js       # Harga saham IDX live
├── lib/
│   └── supabase.js         # Supabase client
├── constants/              # Kategori, plans, dll
├── i18n/                   # Terjemahan (ID/EN)
└── utils/                  # Helper functions
```

---

## 🗄️ Database Schema

Jalankan `supabase_schema.sql` di Supabase SQL Editor untuk membuat semua tabel:

- `accounts` — akun keuangan
- `transactions` — transaksi
- `goals` — target finansial
- `debts` — hutang & cicilan
- `investments` — investasi & aset
- `budgets` — anggaran
- `categories` — kategori custom
- `recurring_transactions` — transaksi berulang
- `subscriptions` — paket langganan (trial/pro)

---

## 🔧 Development

```bash
npm run dev      # Jalankan lokal (localhost:5173)
npm run build    # Build production
npm run preview  # Preview build
```

---

## 📄 Lisensi

MIT — bebas digunakan, dimodifikasi, dan didistribusikan.
