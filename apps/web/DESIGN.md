# DESIGN.md: Keluarga Berkembang (`keluargaberkembang.com`)

## 1. Identity & Personality
- **Brand**: Keluarga Berkembang ("Berkembang Bersama dalam Kehangatan")
- **Role**: Rumah utama ekosistem Keluarga Berkembang (`https://keluargaberkembang.com`) yang terhubung dengan aplikasi web (`https://kelola.keluargaberkembang.com`), asisten AI keluarga (`@KaraAutoBot`), dan storefront produk digital resmi (verifikasi KYC Duitku).
- **Visual Language**: Buku jurnal keuangan dan rumah tangga keluarga Indonesia yang hangat, membumi, jujur, rapi, dan tepercaya (editorial tactile warmth).
- **Dials**: `ENERGY 2 / RHYTHM 3 / MOTION 2`

## 2. Color Palette (WCAG AA Verified via `contrast-check.py`)
- **Primary Surfaces (Warm Paper & Linen)**:
  - `#FFFDF9` (Kertas Jurnal Hangat, permukaan utama kartu dan halaman)
  - `#F7F3EB` (Linen Hangat, latar pemisah antar-bagian dan kontainer sekunder)
  - `#EAF0EB` (Soft Sage Wash, latar aksen informasi keluarga)
  - `#FBF0EA` (Soft Terracotta Wash, latar catatan harga dan sorotan penting)
- **Primary Brand Accent (Forest Sage Green)**:
  - `#3F5142` (Forest Sage utama; rasio kontras terhadap `#FFFDF9` = `8.38:1`, terhadap `#F7F3EB` = `7.69:1`)
  - `#2E3D30` (Deep Forest Sage untuk tombol utama dan blok editorial kontras tinggi; rasio kontras terhadap `#FFFDF9` = `11.32:1`, terhadap `#F7F3EB` = `10.39:1`)
- **Secondary Accent (Warm Terracotta & Amber)**:
  - `#C86D51` / `#D98A3C` (Aksen grafis, garis penanda, dan lencana ukuran besar `>= 18px`; rasio `3.59:1` terhadap `#FFFDF9`)
  - `#9E472D` (Deep Terracotta untuk teks harga dan penekanan ukuran normal; rasio kontras terhadap `#FFFDF9` = `6.09:1`, terhadap `#F7F3EB` = `5.59:1`, terhadap `#FBF0EA` = `5.53:1`)
  - `#7A4710` (Deep Amber untuk teks label peringatan stok/catatan di atas `#FAF1E2`; rasio kontras = `6.85:1`)
- **Text Hierarchy**:
  - `#1F2922` (Deep Charcoal untuk teks utama dan judul; rasio kontras terhadap `#FFFDF9` = `14.78:1`, terhadap `#F7F3EB` = `13.57:1`)
  - `#4A584D` (Muted Sage Slate untuk teks deskripsi sekunder dan batas kontrol interaktif; rasio kontras terhadap `#FFFDF9` = `7.40:1`, terhadap `#F7F3EB` = `6.79:1`)

## 3. Typography (`better-typography` & R-06)
- **Headings (`Fredoka`, weight 600)**: Dipilih karena lengkung hurufnya memberi kesan ramah, hangat, dan akrab bagi pasangan keluarga tanpa kehilangan ketegasan judul. Line-height unitless `1.1` hingga `1.25`, tracking `-0.015em`.
- **Body Copy (`Quicksand`, weight 500 & 600)**: Dipilih karena keterbacaan tinggi di layar ponsel maupun desktop. Line-height unitless `1.6`, lebar baris dibatasi `60ch` hingga `70ch`, `text-wrap: pretty`.
- **Handwritten Marginalia (`Caveat`, weight 600, `>= 20px`)**: Dipilih sebagai *Identity Motif* berupa catatan pinggir tulisan tangan layaknya coretan ayah/bunda di buku kas rumah tangga untuk menunjuk bukti nyata pada tangkapan layar.
- **Numeric & Price Data (`JetBrains Mono`, weight 600/700, `font-variant-numeric: tabular-nums`)**: Dipilih agar seluruh nominal Rupiah (`Rp`), ukuran perbandingan (`per 100ml`), dan tabel katalog sejajar presisi.

## 4. One-Line Reasons for Major Visual Decisions (R-31)
- **Why this color palette**: Warna kertas hangat (`#FFFDF9` & `#F7F3EB`) dan hijau daun sage (`#3F5142`) mencerminkan ketenangan rumah tangga dan buku kas fisik, menghindari kesan dingin aplikasi korporat atau warna neon AI.
- **Why this layout rhythm (`RHYTHM 3`)**: Setiap bagian memiliki komposisi berbeda sesuai fungsi kontennya: split hero jurnal, penjelajah skenario interaktif 2-panel, daftar katalog buku besar (ledger) beserta alur pembayaran, blok editorial hijau tua untuk 3 pilar ekosistem, serta tata letak tanya-jawab asimetris 2 kolom.
- **Why this typography**: Kombinasi `Fredoka`, `Quicksand`, `Caveat`, dan `JetBrains Mono` memisahkan peran sapaan keluarga, penjelasan panjang, catatan tangan kontekstual, dan angka Rupiah secara fungsional.
- **Why this spacing**: Skala spasi responsif (`clamp(3.5rem, 7vw, 6.5rem)` antar-bagian) menjaga jeda napas visual di layar lebar sekaligus rapat dan nyaman digulir dengan ibu jari di layar ponsel `390px`.
- **Why use bordered ledger surfaces instead of floating soft-shadow cards**: Garis tepi tegas (`1px solid #D5DDD6`) dengan bayangan tipis hanya pada elemen terangkat meniru halaman buku jurnal cetak dan memperjelas batas kontrol (`>= 3:1` untuk elemen interaktif).
- **Why use real production screenshots (`02-dasbor.png` s.d. `14-modal-tambah-transaksi.png`)**: Bukti nyata dari sistem yang sudah berjalan jauh lebih dipercaya oleh pasangan keluarga maupun tim verifikasi KYC dibanding ilustrasi vektor generik.
- **Why include an interactive Order & Payment Drawer**: Memudahkan pelanggan dan tim verifikasi KYC Duitku menguji alur pemilihan paket, pengisian data pemesan, pemilihan metode pembayaran (QRIS / Virtual Account), dan konfirmasi pesanan secara langsung.
