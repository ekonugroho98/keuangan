# 📘 Panduan Lengkap — Setup Karaya Finance

> Ikuti langkah ini secara urut. Estimasi waktu: **15–30 menit**.
> Semua layanan yang digunakan **100% gratis**.

---

## Daftar Isi

1. [Buat Akun GitHub](#1-buat-akun-github)
2. [Fork Aplikasi](#2-fork-aplikasi)
3. [Buat Akun Supabase](#3-buat-akun-supabase)
4. [Setup Database](#4-setup-database)
5. [Buat Akun Vercel](#5-buat-akun-vercel)
6. [Deploy Aplikasi](#6-deploy-aplikasi)
7. [Aplikasi Siap Dipakai](#7-aplikasi-siap-dipakai)
8. [Aktifkan AI Coach Gratis (Groq)](#8-aktifkan-ai-coach-gratis-groq)
9. [Cara Update Jika Ada Fitur Baru](#9-cara-update-jika-ada-fitur-baru)

---

## 1. Buat Akun GitHub

> ⚠️ **Sudah punya akun GitHub?** Langsung login dan lanjut ke [Langkah 2](#2-fork-aplikasi).

GitHub adalah tempat menyimpan kode aplikasi. Kamu perlu akun untuk menyalin (fork) aplikasi ini.

**Langkah:**

1. Buka **https://github.com/signup**

> 📸 _[SS-01: halaman signup GitHub — tampilan awal]_

2. Klik **"Continue with Google"** → pilih akun Google kamu
3. Ikuti instruksi di layar sampai selesai
4. Login ke GitHub

✅ Akun GitHub siap.

---

## 2. Fork Aplikasi

Fork artinya **menyalin aplikasi ini ke akun GitHub milikmu** sendiri. Kamu akan punya salinan penuh yang bisa dikelola sendiri.

**Langkah:**

1. Pastikan sudah login ke GitHub
2. Buka link berikut:
   👉 **https://github.com/ekonugroho98/keuangan**

> 📸 _[SS-02: tampilan halaman repo keuangan di GitHub]_

3. Klik tombol **"Fork"** di pojok kanan atas halaman

> 📸 _[SS-03: posisi tombol Fork di pojok kanan atas]_

4. Di halaman berikutnya, klik **"Create fork"**

> 📸 _[SS-04: halaman konfirmasi fork, sebelum klik Create fork]_

5. Tunggu beberapa detik...

> 📸 _[SS-05: hasil fork — repo sudah muncul di akun kamu sendiri]_

✅ Sekarang kamu punya salinan aplikasi di:
`https://github.com/USERNAME_KAMU/keuangan`

---

## 3. Buat Akun Supabase

> ⚠️ **Sudah punya akun Supabase?** Login dan langsung [buat project baru](#buat-project-baru).

Supabase adalah database gratis untuk menyimpan semua data keuanganmu (transaksi, akun, goals, dll).

**Langkah:**

1. Buka **https://supabase.com**
2. Klik **"Start your project"**

> 📸 _[SS-06: halaman utama Supabase, tunjukkan tombol Start your project]_

3. Pilih **"Sign up with GitHub"** (lebih mudah, tidak perlu isi form)

> 📸 _[SS-07: halaman login Supabase, tunjukkan opsi Sign up with GitHub]_

4. Klik **"Authorize supabase"** jika muncul popup

> 📸 _[SS-08: popup authorize Supabase di GitHub]_

5. Muncul halaman **"Create a new organization"** — biarkan semua isian default (Name, Type: Personal, Plan: Free), langsung klik **"Create organization"**

> 📸 _[SS-09: halaman Create a new organization — Name, Type Personal, Plan Free]_

### Buat Project Baru

6. Langsung muncul form **"Create a new project"** — isi bagian berikut:
   - **Project name** — ganti dengan nama bebas, contoh: `keuangan-pribadi`
   - **Database password** — klik **"Generate a password"** lalu **simpan di tempat aman** (wajib diisi, simpan jaga-jaga meski aplikasi tidak memakainya)
   - **Region** — biarkan **Asia-Pacific** (sudah dipilih otomatis, cocok untuk Indonesia)
   - **Security** — biarkan default, **jangan centang** "Enable automatic RLS" (sudah diatur otomatis oleh schema di langkah 4)

> 📸 _[SS-10: form Create a new project yang sudah diisi]_

7. Klik **"Create new project"**
8. Tunggu 1–2 menit sampai project selesai dibuat

> 📸 _[SS-11: loading pembuatan project / tampilan project setelah selesai]_

✅ Project Supabase siap.

---

## 4. Setup Database

Langkah ini membuat semua tabel yang dibutuhkan aplikasi di database kamu.

**Langkah:**

1. Di dashboard Supabase, klik menu **"SQL Editor"** di sidebar kiri

> 📸 _[SS-12: sidebar Supabase, tunjukkan menu SQL Editor]_

2. Klik **"New query"**
3. Buka link berikut di tab baru:
   👉 **https://github.com/ekonugroho98/keuangan/blob/main/supabase_schema.sql**
4. Klik tombol **"Copy raw file"** (icon copy di kanan atas kode)

> 📸 _[SS-13: halaman supabase_schema.sql di GitHub, tunjukkan tombol copy]_

5. Kembali ke tab Supabase SQL Editor
6. **Paste** (Ctrl+V / Cmd+V) semua kode yang baru disalin
7. Klik tombol **"Run"** (atau tekan Ctrl+Enter)

> 📸 _[SS-14: SQL Editor dengan kode yang sudah di-paste, sebelum Run]_

8. Tunggu sampai muncul pesan **"Success"**

> 📸 _[SS-15: pesan Success setelah Run berhasil]_

✅ Database siap.

### Salin Kredensial Supabase

Kamu perlu 2 data ini untuk langkah berikutnya:

**Ambil Project URL:**

1. Di sidebar Supabase, klik **"Settings"** → **"General"**
2. Salin nilai **"Project ID"** (klik tombol **Copy** di sebelahnya)
3. Project URL kamu adalah: `https://[PROJECT_ID].supabase.co`
   — contoh: jika Project ID = `abcdefgh`, maka URL = `https://abcdefgh.supabase.co`

> 📸 _[SS-16: halaman Settings → General, tunjukkan Project ID dan tombol Copy]_

**Ambil Publishable Key (anon key):**

4. Masih di Settings, klik **"API Keys"**
5. Salin nilai **"Publishable key"** (baris `default`) — dimulai dengan `sb_publishable_...`

> 📸 _[SS-17: halaman Settings → API Keys, tunjukkan Publishable key (blur sebagian)]_

> 💡 Simpan Project URL dan Publishable key di Notepad / Notes, akan dipakai di langkah 6.

---

## 5. Buat Akun Vercel

> ⚠️ **Sudah punya akun Vercel?** Login dan langsung lanjut ke [Langkah 6](#6-deploy-aplikasi).

Vercel adalah layanan hosting gratis untuk menjalankan aplikasimu di internet.

**Langkah:**

1. Buka **https://vercel.com/signup**
2. Pilih **"I'm working on personal projects"** (Hobby — gratis)
3. Isi **"Your Name"** yang muncul di bawahnya
4. Klik **"Continue"**

> 📸 _[SS-18: halaman signup Vercel — Hobby dipilih, nama diisi, siap klik Continue]_

5. Muncul halaman **"Let's create your account"** — klik **"Continue with GitHub"**

> 📸 _[SS-19: halaman Let's create your account — tunjukkan tombol Continue with GitHub]_

6. Muncul popup GitHub **"Authorize Vercel"** — klik **"Authorize Vercel"**

> 📸 _[SS-20: popup GitHub Authorize Vercel — klik Authorize Vercel]_

7. Kamu masuk ke dashboard Vercel — klik **"Import"** di sebelah kanan (atau **"Add New..."** di pojok kanan atas)

> 📸 _[SS-21: dashboard Vercel pertama kali — tunjukkan tombol Import atau Add New]_

8. Muncul halaman **"Import Git Repository"** — klik tombol **"Install"** untuk sambungkan GitHub

> 📸 _[SS-22: halaman Import Git Repository — tunjukkan tombol Install]_

9. Muncul halaman GitHub **"Install Vercel"** — biarkan pilihan **"All repositories"**, klik **"Install"**

> ⚠️ **Sudah pernah install Vercel di GitHub?** Lewati langkah ini, langsung lanjut ke Import repo di bawah.

> 📸 _[SS-23: halaman Install Vercel di GitHub — All repositories dipilih, klik Install]_

✅ Akun Vercel siap & GitHub terhubung.

---

## 6. Deploy Aplikasi

Langkah ini menghubungkan kode di GitHub ke Vercel dan menjalankannya sebagai website.

**Langkah:**

1. Setelah install, kamu kembali ke halaman **"Import Git Repository"** — cari repo **"keuangan"**

> 📸 _[SS-24: daftar repo GitHub di Vercel, repo keuangan terlihat]_

2. Klik **"Import"** di sebelah repo `keuangan`

> 📸 _[SS-25: posisi tombol Import di sebelah repo keuangan]_

3. Di halaman konfigurasi, **jangan ubah apapun** kecuali bagian di bawah ini

### Tambahkan Environment Variables

4. Scroll ke bawah, cari bagian **"Environment Variables"**

> 📸 _[SS-26: bagian Environment Variables di halaman konfigurasi deploy]_

5. Tambahkan variabel pertama:
   - Kolom **Key** → ketik: `VITE_SUPABASE_URL`
   - Kolom **Value** → paste Project URL Supabase kamu (contoh: `https://abcdefgh.supabase.co`)
   - Klik **"Add"**

6. Tambahkan variabel kedua:
   - Kolom **Key** → ketik: `VITE_SUPABASE_ANON_KEY`
   - Kolom **Value** → paste Publishable key Supabase kamu (dimulai `sb_publishable_...`)
   - Klik **"Add"**

> 📸 _[SS-27: 2 variabel sudah diisi di form Environment Variables]_

6. Klik **"Deploy"**

> 📸 _[SS-28: loading proses deployment Vercel]_

7. Muncul halaman konfetti 🎉 → klik **"Continue to Dashboard"**

> 📸 _[SS-29: halaman sukses deploy dengan konfetti]_

8. Klik tombol **"Visit"** untuk membuka aplikasimu

> 📸 _[SS-30: dashboard Vercel dengan tombol Visit dan URL aplikasi]_

✅ Aplikasi sudah live di internet!

---

## 7. Aplikasi Siap Dipakai

Setelah klik **"Visit"** di Vercel, kamu akan dibawa ke halaman utama aplikasi.

**Daftar akun pertama kali:**

1. Klik tombol **"Mulai Gratis"** di halaman utama
2. Isi **Nama Lengkap** dan **Email**, klik **"Lanjut"**

> 📸 _[SS-31: halaman Daftar step 1 — isi Nama Lengkap dan Email]_

3. Isi **Password** (min. 8 karakter) dan **Konfirmasi**, klik **"Buat Akun 🚀"**

> 📸 _[SS-32: halaman Daftar step 2 — isi Password dan Konfirmasi]_

4. Cek email → klik link konfirmasi dari Supabase
5. Login → aplikasi siap digunakan ✅

> 📸 _[SS-33: tampilan dasbor setelah berhasil login]_

> 💡 URL aplikasimu bisa ditemukan di dashboard Vercel, contoh:
> `https://keuangan-namakamu.vercel.app`

### Fitur yang Tersedia

| Menu | Fitur |
|------|-------|
| 💳 **Transaksi** | Catat pemasukan & pengeluaran harian |
| 🏦 **Akun** | Kelola saldo rekening, dompet, e-wallet |
| 🔄 **Transaksi Berulang** | Otomasi tagihan rutin (listrik, sewa, dll) |
| 🧾 **Split Bill** | Bagi tagihan dengan teman |
| 🎯 **Target Finansial** | Tabung untuk tujuan tertentu |
| 📋 **Hutang & Cicilan** | Pantau cicilan KPR, motor, dll |
| 🤝 **Piutang** | Catat uang yang dipinjamkan ke orang lain |
| 📈 **Investasi & Aset** | Reksa dana, saham (harga live IDX), emas, crypto |
| 💰 **Anggaran** | Batas pengeluaran per kategori per bulan |
| 📉 **Laporan** | Grafik tren & analitik keuangan |
| 🤖 **AI Coach** | Analisis & saran keuangan personal (butuh API key sendiri) |

---

## 8. Aktifkan AI Coach Gratis (Groq)

Fitur **AI Coach** bisa menganalisis keuanganmu dan memberi saran personal. Menggunakan Groq — layanan AI yang **100% gratis** untuk pemakaian pribadi.

**Langkah:**

1. Buka **https://groq.com/**
2. Klik tombol **"Start Building"** di pojok kanan atas

> 📸 _[SS-36: halaman utama Groq, tunjukkan tombol Start Building]_

3. Muncul halaman **"Create Account or Login"** — klik **"Continue with Google"** → pilih akun Google kamu

> 📸 _[SS-37: halaman Create Account or Login Groq]_

4. Kamu masuk ke dashboard Groq — klik **"API Keys"** di navbar atas

> 📸 _[SS-38: dashboard Groq setelah login, tunjukkan menu API Keys di navbar]_

5. Klik tombol **"Create API Key"**

> 📸 _[SS-39: halaman API Keys, tunjukkan tombol Create API Key]_

6. Muncul dialog **"Create API Key"** — isi bagian berikut:
   - **Display Name** — isi nama bebas, contoh: `keuangan`
   - **Expiration** — biarkan **"No expiration"** (tidak perlu diganti)
   - Klik **"Submit"**

> 📸 _[SS-40: dialog Create API Key — Display Name diisi, Expiration No expiration]_

7. Salin API key yang muncul (dimulai dengan `gsk_...`) — **simpan sekarang, tidak bisa dilihat lagi**

> 📸 _[SS-41: API key yang baru dibuat — salin sebelum ditutup]_

### Pasang API Key di Aplikasi

8. Buka aplikasimu → klik **nama / avatar** kamu di pojok kiri bawah sidebar
9. Muncul menu profil — klik **"🤖 AI Coach"** (tertulis "Belum diatur")

> 📸 _[SS-42: menu profil terbuka — tunjukkan pilihan AI Coach (Belum diatur)]_

10. Muncul panel **AI Coach Settings** — **Groq** sudah terpilih otomatis (ada badge ✓ **GRATIS**)
11. Di bagian **API KEY**, paste key kamu (`gsk_...`) ke kolom yang tersedia
12. Klik **"Simpan"**

> 📸 _[SS-43: panel AI Coach Settings — Groq dipilih, kolom API KEY sudah diisi]_

✅ AI Coach aktif! Buka menu **🤖 AI Coach** dan mulai tanya soal keuanganmu.

> 💡 Groq gratis hingga 14.400 request per hari — lebih dari cukup untuk pemakaian harian.

---

## 9. Cara Update Jika Ada Fitur Baru

Jika ada update atau fitur baru, kamu bisa mengambil update tersebut tanpa kehilangan data.

**Langkah:**

1. Buka repo fork kamu di GitHub:
   `https://github.com/USERNAME_KAMU/keuangan`
2. Klik tombol **"Sync fork"** (ada di atas daftar file)

> 📸 _[SS-34: posisi tombol Sync fork di halaman repo GitHub]_

3. Klik **"Update branch"**

> 📸 _[SS-35: popup konfirmasi Update branch]_

4. Vercel akan otomatis deploy ulang dalam 1–2 menit

✅ Aplikasi terupdate, data tetap aman.

---

## ❓ FAQ

**Q: Apakah data saya aman?**
> Ya. Data tersimpan di Supabase milikmu sendiri. Tidak ada pihak lain yang bisa mengaksesnya.

**Q: Apakah benar-benar gratis?**
> Ya, 100% gratis selama kamu pengguna pribadi (1–5 orang). Tidak ada biaya tersembunyi.

**Q: Bagaimana jika aplikasi tidak bisa dibuka?**
> Kemungkinan project Supabase ter-pause (otomatis setelah 7 hari tidak aktif di free plan). Buka supabase.com → klik project → klik "Resume". Data tidak hilang.

**Q: Bisa diakses dari HP?**
> Bisa. Aplikasi responsive dan bisa dibuka dari browser HP manapun.

---

*Selamat menggunakan Karaya Finance! 💰*
