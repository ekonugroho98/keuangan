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
8. [Cara Update Jika Ada Fitur Baru](#8-cara-update-jika-ada-fitur-baru)

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
   - **Database password** — klik **"Generate a password"** (tidak perlu disimpan, aplikasi tidak memakainya)
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

1. Di sidebar Supabase, klik **"Settings"** (ikon gear di bawah)
2. Klik **"API"**

> 📸 _[SS-16: halaman Settings → API Supabase]_

3. **Salin dan simpan** dua nilai berikut:
   - **Project URL** — contoh: `https://abcdefgh.supabase.co`
   - **anon public** key — string panjang di bawah "Project API Keys"

> 📸 _[SS-17: posisi Project URL dan anon key (sensor/blur sebagian nilainya)]_

> 💡 Simpan kedua nilai ini di Notepad / Notes, akan dipakai di langkah 6.

---

## 5. Buat Akun Vercel

> ⚠️ **Sudah punya akun Vercel?** Login dan langsung lanjut ke [Langkah 6](#6-deploy-aplikasi).

Vercel adalah layanan hosting gratis untuk menjalankan aplikasimu di internet.

**Langkah:**

1. Buka **https://vercel.com/signup**
2. Pilih **"Continue with GitHub"**

> 📸 _[SS-18: halaman signup Vercel, tunjukkan tombol Continue with GitHub]_

3. Klik **"Authorize Vercel"** jika muncul popup

> 📸 _[SS-19: popup authorize Vercel di GitHub]_

4. Pilih tipe akun: **"Hobby"** (gratis)

> 📸 _[SS-20: pilihan tipe akun Vercel, tunjukkan opsi Hobby]_

5. Isi nama lengkap, lalu klik **"Continue"**

✅ Akun Vercel siap.

---

## 6. Deploy Aplikasi

Langkah ini menghubungkan kode di GitHub ke Vercel dan menjalankannya sebagai website.

**Langkah:**

1. Di dashboard Vercel, klik **"Add New Project"**

> 📸 _[SS-21: dashboard Vercel, tunjukkan tombol Add New Project]_

2. Di bagian **"Import Git Repository"**, cari repo **"keuangan"**

> 📸 _[SS-22: daftar repo GitHub di Vercel, repo keuangan terlihat]_

3. Klik **"Import"** di sebelah repo `keuangan`

> 📸 _[SS-23: posisi tombol Import di sebelah repo keuangan]_

4. Di halaman konfigurasi, **jangan ubah apapun** kecuali bagian di bawah ini

### Tambahkan Environment Variables

5. Scroll ke bawah, cari bagian **"Environment Variables"**

> 📸 _[SS-24: bagian Environment Variables di halaman konfigurasi deploy]_

6. Tambahkan **2 variabel** berikut (klik "Add" setelah setiap baris):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | *(Project URL dari Supabase tadi)* |
   | `VITE_SUPABASE_ANON_KEY` | *(anon public key dari Supabase tadi)* |

> 📸 _[SS-25: 2 variabel sudah diisi di form Environment Variables]_

7. Klik **"Deploy"**

> 📸 _[SS-26: loading proses deployment Vercel]_

8. Muncul halaman konfetti 🎉 → klik **"Continue to Dashboard"**

> 📸 _[SS-27: halaman sukses deploy dengan konfetti]_

9. Klik tombol **"Visit"** untuk membuka aplikasimu

> 📸 _[SS-28: dashboard Vercel dengan tombol Visit dan URL aplikasi]_

✅ Aplikasi sudah live di internet!

---

## 7. Aplikasi Siap Dipakai

Kamu akan diarahkan ke halaman login aplikasi.

**Daftar akun pertama kali:**

1. Klik **"Daftar"** atau **"Sign Up"**
2. Isi email dan password
3. Cek email → klik link konfirmasi dari Supabase
4. Login → aplikasi siap digunakan ✅

> 📸 _[SS-29: halaman login aplikasi]_

> 📸 _[SS-30: tampilan dasbor setelah berhasil login]_

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

## 8. Cara Update Jika Ada Fitur Baru

Jika ada update atau fitur baru, kamu bisa mengambil update tersebut tanpa kehilangan data.

**Langkah:**

1. Buka repo fork kamu di GitHub:
   `https://github.com/USERNAME_KAMU/keuangan`
2. Klik tombol **"Sync fork"** (ada di atas daftar file)

> 📸 _[SS-31: posisi tombol Sync fork di halaman repo GitHub]_

3. Klik **"Update branch"**

> 📸 _[SS-32: popup konfirmasi Update branch]_

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
