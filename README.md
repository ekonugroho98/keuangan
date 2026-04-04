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
- 📈 **Investasi & Aset** — emas (harga live), saham IDX (harga live)
- 🔁 **Transaksi Berulang** — otomatis harian/mingguan/bulanan
- 🏷️ **Anggaran** — budget per kategori
- 🤖 **AI Financial Coach** — analisis keuangan via Groq
- 📱 **Responsive** — mobile friendly

---

## 🛠️ Tech Stack (Semua Gratis)

| Layer | Teknologi | Keterangan |
|-------|-----------|-----------|
| Frontend | React 18 + Vite | - |
| Database | Supabase | Free: 500 MB DB, 5 GB bandwidth |
| Hosting | Vercel | Free: unlimited hobby projects |
| Harga Emas & Saham | Karaya API | Sudah tersedia, tidak perlu setup |
| AI | Groq API | Free tier tersedia |
| Auth | Supabase Auth | Free: 50.000 MAU |

---

## 🚀 Setup (3 Langkah Saja)

### 1. Fork & Clone

```bash
# Fork repo ini di GitHub, lalu clone
git clone https://github.com/USERNAME/catatan_keuangan_web.git
cd catatan_keuangan_web
npm install
```

### 2. Setup Supabase

1. Daftar di [supabase.com](https://supabase.com) → buat project baru (gratis)
2. Buka **SQL Editor** → jalankan semua isi file `supabase_schema.sql`
3. Salin **Project URL** dan **Anon Key** dari Settings → API

### 3. Setup Environment & Deploy

```bash
cp .env.example .env
```

Edit file `.env`:
```env
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Deploy ke Vercel:
```bash
npm i -g vercel
vercel --prod
```

> Atau connect GitHub repo langsung di [vercel.com](https://vercel.com) → tambahkan 2 environment variables di Settings.

**Selesai! Aplikasi sudah bisa dipakai.** 🎉

---

## 💡 Catatan

- **Harga emas & saham live** sudah berjalan otomatis — tidak perlu setup tambahan
- **AI Coach** membutuhkan Groq API key (gratis di [console.groq.com](https://console.groq.com))
- **Auto-pause Supabase**: free plan akan pause jika tidak ada aktivitas 7 hari — data tidak hilang, tinggal resume manual di dashboard Supabase

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
- `subscriptions` — status trial/pro

---

## 📁 Struktur Project

```
src/
├── components/dashboard/
│   ├── views/          # Dasbor, Transaksi, Investasi, Goals, dll
│   └── modals/         # Modal tambah transaksi, akun, dll
├── pages/
│   └── Dashboard.jsx   # Main app controller
├── services/
│   ├── goldPrice.js    # Harga emas live (otomatis)
│   └── stockPrice.js   # Harga saham IDX live (otomatis)
├── lib/supabase.js     # Supabase client
├── constants/          # Kategori, plans, dll
├── i18n/               # Terjemahan (ID/EN)
└── utils/              # Helper functions
```

---

## 🔧 Development Lokal

```bash
npm run dev      # Jalankan di localhost:5173
npm run build    # Build production
```

---

## 📄 Lisensi

MIT — bebas digunakan dan dimodifikasi.
