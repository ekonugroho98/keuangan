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
2. Isi form pendaftaran:
   - **Username** — nama unik kamu (contoh: `johndoe`)
   - **Email** — email aktif
   - **Password** — minimal 8 karakter
3. Klik **"Create account"**
4. Cek email → klik link verifikasi yang dikirim GitHub
5. Login ke GitHub

✅ Akun GitHub siap.

---

## 2. Fork Aplikasi

Fork artinya **menyalin aplikasi ini ke akun GitHub milikmu** sendiri. Kamu akan punya salinan penuh yang bisa dikelola sendiri.

**Langkah:**

1. Pastikan sudah login ke GitHub
2. Buka link berikut:
   👉 **https://github.com/ekonugroho98/keuangan**
3. Klik tombol **"Fork"** di pojok kanan atas halaman
4. Di halaman berikutnya, klik **"Create fork"**
5. Tunggu beberapa detik...

✅ Sekarang kamu punya salinan aplikasi di:
`https://github.com/USERNAME_KAMU/keuangan`

---

## 3. Buat Akun Supabase

> ⚠️ **Sudah punya akun Supabase?** Login dan langsung [buat project baru](#buat-project-baru).

Supabase adalah database gratis untuk menyimpan semua data keuanganmu (transaksi, akun, goals, dll).

**Langkah:**

1. Buka **https://supabase.com**
2. Klik **"Start your project"**
3. Pilih **"Sign up with GitHub"** (lebih mudah, tidak perlu isi form)
   - Klik **"Authorize supabase"** jika diminta
4. Kamu akan langsung masuk ke dashboard Supabase

### Buat Project Baru

5. Klik tombol **"New project"**
6. Isi form:
   - **Organization** — biarkan default
   - **Project name** — isi bebas, contoh: `keuangan-pribadi`
   - **Database password** — klik **"Generate a password"** lalu **simpan password ini** di tempat aman
   - **Region** — pilih **"Southeast Asia (Singapore)"**
7. Klik **"Create new project"**
8. Tunggu 1–2 menit sampai project selesai dibuat

✅ Project Supabase siap.

---

## 4. Setup Database

Langkah ini membuat semua tabel yang dibutuhkan aplikasi di database kamu.

**Langkah:**

1. Di dashboard Supabase, klik menu **"SQL Editor"** di sidebar kiri
2. Klik **"New query"**
3. Buka link berikut di tab baru:
   👉 **https://github.com/ekonugroho98/keuangan/blob/main/supabase_schema.sql**
4. Klik tombol **"Copy raw file"** (icon copy di kanan atas kode)
5. Kembali ke tab Supabase SQL Editor
6. **Paste** (Ctrl+V / Cmd+V) semua kode yang baru disalin
7. Klik tombol **"Run"** (atau tekan Ctrl+Enter)
8. Tunggu sampai muncul pesan **"Success"**

✅ Database siap.

### Salin Kredensial Supabase

Kamu perlu 2 data ini untuk langkah berikutnya:

1. Di sidebar Supabase, klik **"Settings"** (ikon gear di bawah)
2. Klik **"API"**
3. **Salin dan simpan** dua nilai berikut:
   - **Project URL** — contoh: `https://abcdefgh.supabase.co`
   - **anon public** key — string panjang di bawah "Project API Keys"

> 💡 Simpan kedua nilai ini di Notepad / Notes, akan dipakai di langkah 6.

---

## 5. Buat Akun Vercel

> ⚠️ **Sudah punya akun Vercel?** Login dan langsung lanjut ke [Langkah 6](#6-deploy-aplikasi).

Vercel adalah layanan hosting gratis untuk menjalankan aplikasimu di internet.

**Langkah:**

1. Buka **https://vercel.com/signup**
2. Pilih **"Continue with GitHub"**
3. Klik **"Authorize Vercel"** jika diminta
4. Pilih tipe akun: **"Hobby"** (gratis)
5. Isi nama lengkap, lalu klik **"Continue"**

✅ Akun Vercel siap.

---

## 6. Deploy Aplikasi

Langkah ini menghubungkan kode di GitHub ke Vercel dan menjalankannya sebagai website.

**Langkah:**

1. Di dashboard Vercel, klik **"Add New Project"**
2. Di bagian **"Import Git Repository"**, cari repo **"keuangan"**
   - Jika tidak muncul, klik **"Adjust GitHub App Permissions"** → pilih repo `keuangan` → Save
3. Klik **"Import"** di sebelah repo `keuangan`
4. Di halaman konfigurasi, **jangan ubah apapun** kecuali bagian berikut:

### Tambahkan Environment Variables

5. Scroll ke bawah, cari bagian **"Environment Variables"**
6. Tambahkan **2 variabel** berikut (klik "Add" setelah setiap baris):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | *(Project URL dari Supabase tadi)* |
   | `VITE_SUPABASE_ANON_KEY` | *(anon public key dari Supabase tadi)* |

7. Setelah kedua variabel ditambahkan, klik **"Deploy"**
8. Tunggu 1–3 menit proses deployment...
9. Muncul halaman konfetti 🎉 → klik **"Continue to Dashboard"**
10. Klik tombol **"Visit"** untuk membuka aplikasimu

✅ Aplikasi sudah live di internet!

---

## 7. Aplikasi Siap Dipakai

Kamu akan diarahkan ke halaman login aplikasi Karaya Finance.

**Daftar akun pertama kali:**

1. Klik **"Daftar"** atau **"Sign Up"**
2. Isi email dan password
3. Cek email → klik link konfirmasi dari Supabase
4. Login → aplikasi siap digunakan ✅

> 💡 URL aplikasimu bisa ditemukan di dashboard Vercel, contoh:
> `https://keuangan-namakamu.vercel.app`

---

## 8. Cara Update Jika Ada Fitur Baru

Jika ada update atau fitur baru di aplikasi, kamu bisa mengambil update tersebut tanpa kehilangan data.

**Langkah:**

1. Buka repo fork kamu di GitHub:
   `https://github.com/USERNAME_KAMU/keuangan`
2. Klik tombol **"Sync fork"** (ada di atas daftar file)
3. Klik **"Update branch"**
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
