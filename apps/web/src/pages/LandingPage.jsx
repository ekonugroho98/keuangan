import { useState, useEffect } from "react";
import { PASSWORD_MIN_LENGTH } from "../constants/validation";
import SignupModal from "../components/landing/SignupModal";
import LoginModal from "../components/landing/LoginModal";
import ForgotPasswordModal from "../components/landing/ForgotPasswordModal";
import Modal from "../components/ui/Modal";
import { supabase } from "../lib/supabase";

const SCENARIOS = [
    {
        id: "pasangan",
        badge: "Skenario 01 · Arus Kas Suami-Istri",
        tabTitle: "1. Suami-Istri Gabung Gaji",
        headline: "Anggaran rumah tangga transparan berdua, saldo rekening pribadi tetap terjaga",
        description:
            "Tidak semua uang harus dicampur di satu tempat. Di Keluarga Berkembang, Anda dan pasangan bisa mengelola kas belanja dapur, tagihan listrik, dan dana sekolah anak secara terbuka di akun Bersama, sambil tetap mengunci tabungan pribadi atau dana kejutan di akun Privat.",
        handwrittenNote: "Rekening berlabel Privat hanya bisa dilihat oleh pemiliknya sendiri!",
        highlights: [
            "Label eksplisit Akun Bersama (terlihat berdua) vs Akun Privat (hanya pemilik akun yang tahu rincian saldonya).",
            "Anggaran 2 lapis: pantau batas pengeluaran per kategori (Dapur, Anak, Cicilan, Orang Tua) dengan indikator warna.",
            "Ringkasan arus kas bulanan otomatis menghitung pemasukan, pengeluaran, dan sisa anggaran rumah tangga.",
        ],
        screenshots: [
            {
                id: "03-akun",
                label: "Pemisahan Akun Privat & Bersama",
                web: "/screenshots/web/03-akun-private-shared.png",
                mobile: "/screenshots/mobile/03-akun-private-shared.png",
                caption: "Tampilan nyata daftar rekening dengan pemisahan status Privat dan Bersama.",
            },
            {
                id: "02-dasbor",
                label: "Dasbor Utama Rumah Tangga",
                web: "/screenshots/web/02-dasbor.png",
                mobile: "/screenshots/mobile/02-dasbor.png",
                caption: "Ringkasan pemasukan, pengeluaran, porsi kategori, dan pengingat stok dapur di satu layar.",
            },
            {
                id: "08-anggaran",
                label: "Anggaran Rumah Tangga 2 Lapis",
                web: "/screenshots/web/08-anggaran.png",
                mobile: "/screenshots/mobile/08-anggaran.png",
                caption: "Pantau pemakaian anggaran bulanan agar belanja bulanan tidak melampaui batas.",
            },
        ],
    },
    {
        id: "minimarket",
        badge: "Skenario 02 · Belanja Dapur & Kulkas",
        tabTitle: "2. Adu Harga Minimarket & Stok Kulkas",
        headline: "Ketahui toko termurah hingga hitungan per 100ml/100g sebelum berangkat belanja",
        description:
            "Ukuran kemasan sering mengecoh: botol 750ml terlihat lebih murah padahal harga per 100ml lebih mahal daripada pouch 900ml. Fitur Banding Harga menghitung harga satuan secara otomatis di antara Alfamart, Indomaret, Superindo, atau pasar langganan Anda.",
        handwrittenNote: "Otomatis hitung Rp per 100ml atau 100g supaya tidak tertipu ukuran kemasan.",
        highlights: [
            "Kalkulator otomatis harga per 100ml, 100g, atau per pcs dari riwayat belanja keluarga Anda.",
            "Pelacak Stok Kulkas & Dapur memberi pengingat sebelum susu, telur, atau beras habis maupun kedaluwarsa.",
            "Satu klik untuk memindahkan barang yang hampir habis di kulkas langsung ke Daftar Belanja Keluarga.",
        ],
        screenshots: [
            {
                id: "04b-banding",
                label: "Adu Harga Toko per 100ml / 100g",
                web: "/screenshots/web/04b-banding-harga.png",
                mobile: "/screenshots/mobile/04b-banding-harga.png",
                caption: "Perbandingan harga nyata antar toko lengkap dengan perhitungan otomatis per satuan ukur.",
            },
            {
                id: "05-pantry",
                label: "Pelacak Stok Kulkas & Dapur",
                web: "/screenshots/web/05-stok-pantry.png",
                mobile: "/screenshots/mobile/05-stok-pantry.png",
                caption: "Pantau sisa stok bahan makanan di kulkas dan lemari dapur beserta status kedaluwarsanya.",
            },
            {
                id: "04a-belanja",
                label: "Daftar Belanja Keluarga Terpadu",
                web: "/screenshots/web/04a-daftar-belanja.png",
                mobile: "/screenshots/mobile/04a-daftar-belanja.png",
                caption: "Daftar belanja yang tersinkronisasi antara suami dan istri beserta estimasi total biayanya.",
            },
        ],
    },
    {
        id: "whatsapp",
        badge: "Skenario 03 · Pencatatan Kilat Harian",
        tabTitle: "3. Catat dari Grup WA & Scan Struk",
        headline: "Malas buka formulir panjang? Ketik di Grup WhatsApp berdua atau foto struk belanja",
        description:
            "Kebiasaan mencatat keuangan sering gagal karena terlalu banyak kolom yang harus diisi saat sedang sibuk. Cukup ketik pesan singkat atau kirim foto struk belanja di Grup WhatsApp berdua maupun Telegram, maka transaksi otomatis masuk ke pos anggaran yang tepat.",
        handwrittenNote: "Cukup 1 Grup WA berdua pasangan: ketik pengeluaran, langsung tercatat rapi!",
        highlights: [
            "Input transaksi fleksibel: lewat tombol cepat di Web/HP, pesan teks, suara, atau foto struk belanja (OCR).",
            "Aman digunakan di 1 Grup WhatsApp keluarga karena bot hanya merespons anggota rumah tangga Anda sendiri.",
            "Setiap transaksi yang tercatat otomatis memotong sisa anggaran bulanan dan memperbarui laporan kas.",
        ],
        screenshots: [
            {
                id: "14-modal",
                label: "Input Transaksi Cepat & Kategori",
                web: "/screenshots/web/14-modal-tambah-transaksi.png",
                mobile: "/screenshots/mobile/14-modal-tambah-transaksi.png",
                caption: "Formulir pencatatan cepat dengan pilihan jenis transaksi, akun, dan kategori rumah tangga.",
            },
            {
                id: "06-transaksi",
                label: "Riwayat & Filter Transaksi Harian",
                web: "/screenshots/web/06-transaksi.png",
                mobile: "/screenshots/mobile/06-transaksi.png",
                caption: "Seluruh catatan pengeluaran dari Web App maupun asisten bot tersusun rapi berdasarkan tanggal.",
            },
            {
                id: "02-dasbor-wa",
                label: "Sinkronisasi Langsung ke Dasbor",
                web: "/screenshots/web/02-dasbor.png",
                mobile: "/screenshots/mobile/02-dasbor.png",
                caption: "Begitu dicatat lewat chat, grafik pengeluaran di dasbor langsung diperbarui seketika.",
            },
        ],
    },
    {
        id: "laporan",
        badge: "Skenario 04 · Evaluasi & Dana Masa Depan",
        tabTitle: "4. Generasi Sandwich & Laporan Excel",
        headline: "Pisahkan pos orang tua, pantau tabungan emas, dan unduh laporan Excel kapan saja",
        description:
            "Bagi pasangan generasi sandwich yang menanggung kebutuhan rumah tangga sendiri sekaligus membantu orang tua, kejelasan alokasi dana sangat penting. Pantau nilai tabungan emas keluarga dan unduh laporan pembukuan lengkap dalam format Excel (.xlsx) untuk evaluasi bulanan.",
        handwrittenNote: "Data 100% milik keluarga Anda: bisa diekspor ke file Excel (.xlsx) kapan pun.",
        highlights: [
            "Ekspor laporan keuangan bulanan ke file Microsoft Excel (.xlsx) lengkap dengan rincian per kategori.",
            "Pelacak portofolio tabungan emas keluarga dengan pembaruan nilai aset secara berkala.",
            "Pos anggaran khusus untuk alokasi rutin orang tua, dana darurat, dan pendidikan anak.",
        ],
        screenshots: [
            {
                id: "07-laporan",
                label: "Laporan Bulanan & Ekspor Excel (.xlsx)",
                web: "/screenshots/web/07-laporan-export.png",
                mobile: "/screenshots/mobile/07-laporan-export.png",
                caption: "Visualisasi arus kas bulanan dan tombol unduh langsung ke lembar kerja Excel (.xlsx).",
            },
            {
                id: "12-emas",
                label: "Pelacak Tabungan & Investasi Emas",
                web: "/screenshots/web/12-investasi-emas.png",
                mobile: "/screenshots/mobile/12-investasi-emas.png",
                caption: "Catatan kepemilikan gramasi emas keluarga beserta perhitungan nilai portofolionya.",
            },
            {
                id: "08-anggaran-sandwich",
                label: "Alokasi Pos Rumah Tangga & Orang Tua",
                web: "/screenshots/web/08-anggaran.png",
                mobile: "/screenshots/mobile/08-anggaran.png",
                caption: "Pisahkan anggaran belanja rumah sendiri dan pos dukungan keluarga besar secara tertib.",
            },
        ],
    },
];

const CATALOG_PRODUCTS = [
    {
        id: "webapp",
        code: "KB-APP-01",
        category: "Paket Mandiri · Input Manual",
        name: "Paket Mandiri (Web & Aplikasi HP)",
        subtitle: "Buat yang rajin catat sendiri lewat tombol Web atau HP. Sudah termasuk Rekening Bersama vs Privat, Kalkulator Adu Harga Minimarket (per 100ml/100g), Stok Kulkas Otomatis, Rekonsiliasi Mutasi Bank (CSV), serta Export Excel (.xlsx).",
        priceDisplay: "Rp 0",
        priceNumeric: 0,
        billingNote: "Gratis Selamanya · Tanpa Iklan · Input Manual",
        deliveryMethod: "Aktif seketika di browser melalui kelola.keluargaberkembang.com atau pasang langsung ke layar utama HP (PWA Android & iOS).",
        features: [
            "Dasbor arus kas keluarga dengan pemisahan Rekening Bersama dan Rekening Privat.",
            "Kalkulator Adu Harga Minimarket otomatis (hitung harga per 100ml, 100g, atau per pcs).",
            "Stok Kulkas Otomatis & Daftar Belanja keluarga yang tersinkronisasi antara suami dan istri.",
            "Rekonsiliasi Mutasi Bank (CSV), grafik bulanan, dan unduh pembukuan ke Excel (.xlsx).",
        ],
        ctaLabel: "Buka Aplikasi Web Gratis",
        secondaryLabel: "Daftar Akun Keluarga Baru",
        isFreeApp: true,
    },
    {
        id: "asisten-sachet",
        code: "KB-AST-SACHET",
        category: "Paket Sachet & Hemat · Tanpa Ketik Manual",
        name: "Paket Sachet & Hemat (Web + Telegram + Foto Struk)",
        subtitle: "Cocok untuk coba dulu atau dipakai sendiri lewat Web & Telegram. Cukup foto struk belanja yang lecek atau ketik 1 kalimat di chat, langsung tercatat otomatis dalam 5 detik.",
        originalPriceDisplay: "Rp 15.000",
        discountBadge: "HEMAT HINGGA 51%",
        priceDisplay: "Mulai Rp 9.000",
        priceNumeric: 9000,
        billingNote: "Pilihan: Sachet 7 Hari Rp 9.000 (Normal Rp 15.000) atau Hemat 30 Hari Rp 19.000 (Normal Rp 39.000)",
        deliveryMethod: "Kode kuota & koneksi asisten AI aktif otomatis dalam waktu kurang dari 3 menit setelah pembayaran QRIS / Virtual Account melalui sistem @KaraAutoBot.",
        subOptions: [
            { id: "ast-sachet", label: "Paket Sachet Coba Dulu (Aktif 7 Hari · Web, Telegram & Foto Struk)", originalPriceDisplay: "Rp 15.000", discountBadge: "Hemat 40%", priceDisplay: "Rp 9.000", priceNumeric: 9000 },
            { id: "ast-hemat", label: "Paket Hemat Bulanan (Aktif 30 Hari · Web, Telegram & Foto Struk)", originalPriceDisplay: "Rp 39.000", discountBadge: "Hemat 51%", priceDisplay: "Rp 19.000", priceNumeric: 19000 },
        ],
        features: [
            "Beres dalam 5 detik: cukup kirim foto struk Alfamart/Indomaret/Superindo, daftar barang & diskon langsung tercatat otomatis.",
            "Tanya-jawab asisten keuangan 24 jam lewat chat Web dan Telegram pribadi tanpa perlu daftar API Key teknis.",
            "Otomatis memperbarui sisa anggaran bulanan, stok kulkas, dan perbandingan harga barang antar toko.",
            "Fleksibel: bisa mulai dari Paket Sachet 7 hari (Rp 9.000) sebelum lanjut ke bulanan (Rp 19.000).",
        ],
        ctaLabel: "Pilih Paket Sachet / Hemat (Mulai Rp 9.000)",
    },
    {
        id: "asisten-wa",
        code: "KB-AST-WA",
        category: "Paling Laris · Rekomendasi Pasangan",
        name: "Paket Lengkap Keluarga (Grup WhatsApp Suami-Istri + Telegram + Foto Struk)",
        subtitle: "Tidak perlu memaksa pasangan buka aplikasi baru. Cukup masukkan asisten ke 1 Grup WhatsApp berdua suami-istri, kirim foto struk atau ketik pengeluaran, beres tercatat bersama.",
        originalPriceDisplay: "Rp 59.000",
        discountBadge: "PROMO PASANGAN · HEMAT 50%",
        priceDisplay: "Rp 29.000 / 30 hari",
        priceNumeric: 29000,
        billingNote: "~Rp 900/hari untuk berdua suami-istri (Harga Normal Rp 59.000/bulan)",
        deliveryMethod: "Jalur koneksi asisten Grup WhatsApp & Telegram keluarga aktif otomatis dalam waktu kurang dari 3 menit setelah pembayaran QRIS / Virtual Account melalui sistem @KaraAutoBot.",
        subOptions: [
            { id: "ast-keluarga", label: "Paket Lengkap Keluarga (Aktif 30 Hari · Masuk Grup WhatsApp Suami-Istri + Telegram + Foto Struk)", originalPriceDisplay: "Rp 59.000", discountBadge: "Hemat 50%", priceDisplay: "Rp 29.000", priceNumeric: 29000 },
        ],
        features: [
            "Bisa dimasukkan ke 1 Grup WhatsApp berdua pasangan (suami-istri) + akses penuh di Telegram & Web.",
            "Suami atau istri cukup kirim foto struk belanja atau ketik 1 baris di Grup WA, langsung tercatat rapi.",
            "Sudah termasuk kuota pembacaan foto struk dan tanya-jawab asisten keuangan 24 jam tanpa perlu daftar API Key sendiri.",
            "Jalur koneksi khusus yang aman dan privat untuk grup keluarga Anda (aktif otomatis dalam < 3 menit setelah pembayaran QRIS).",
        ],
        ctaLabel: "Pilih Paket Lengkap Keluarga (Rp 29.000)",
        featured: true,
    },
    {
        id: "ebook",
        code: "KB-EBK-99",
        category: "Produk Digital Unduhan · Paling Banyak Dipilih",
        name: "Ebook Panduan Mandiri 37 Layar + Full Source Code",
        subtitle: "Untuk yang ingin memiliki full source code dan memasang sistem sendiri mengikuti 37 tangkapan layar asli per tombol.",
        priceDisplay: "Rp 99.000",
        priceNumeric: 99000,
        billingNote: "Sekali Bayar · Hak Milik Selamanya",
        deliveryMethod: "Tautan unduhan Ebook (PDF & HTML interaktif) beserta paket Source Code dikirim otomatis ke Email & Telegram dalam < 1 menit setelah pembayaran QRIS / Virtual Account terverifikasi.",
        features: [
            "Ebook panduan bahasa Indonesia santai dengan 37 tangkapan layar nyata (tinggal ikuti urutan tombol, tanpa perlu latar belakang coding).",
            "Full Source Code Web App, file APK Android, dan modul penghubung Asisten AI Telegram & Grup WhatsApp.",
            "Bebas memilih 3 jalur sesuai kebutuhan (Cloud Free Tier, VPS lokal Rp 25.000/bulan via QRIS, atau layanan praktis @KaraAutoBot).",
            "Termasuk Kamus Solusi Kendala (Troubleshooting) lengkap dan pembaruan materi panduan.",
        ],
        ctaLabel: "Pesan Ebook + Source Code (Rp 99.000)",
        featured: true,
        hidden: true,
    },
    {
        id: "vip",
        code: "KB-VIP-599",
        category: "Paket Lengkap & Pendampingan Privat",
        name: "Bundel Lengkap VIP: Ebook + Source Code + Bimbingan Privat 14 Hari",
        subtitle: "Paket lengkap Ebook + Full Source Code, saldo kuota Asisten AI siap pakai, dan pendampingan privat 1-on-1 selama 14 hari.",
        priceDisplay: "Rp 599.000",
        priceNumeric: 599000,
        billingNote: "Sekali Bayar · Upgrade dari pemilik Ebook cukup Rp 500.000",
        deliveryMethod: "Unduhan instan Ebook + Kode Voucher Kuota AI dikirim otomatis ke Email/Telegram, dilanjutkan penjadwalan sesi bimbingan privat.",
        subOptions: [
            { id: "vip-full", label: "Bundel Lengkap VIP Baru (Ebook + Source Code + Kuota AI + Bimbingan 14 Hari)", priceDisplay: "Rp 599.000", priceNumeric: 599000 },
            { id: "vip-upgrade", label: "Upgrade ke VIP (Khusus Pembeli Ebook Rp 99.000)", priceDisplay: "Rp 500.000", priceNumeric: 500000 },
        ],
        features: [
            "Seluruh fasilitas paket Ebook Panduan Mandiri 37 Layar beserta paket Full Source Code lengkap.",
            "Voucher Kuota Asisten AI siap pakai untuk tanya-jawab keuangan dan pembacaan foto struk belanja otomatis.",
            "Pendampingan privat 1-on-1 selama 14 hari penuh melalui chat/layar sampai sistem keluarga Anda berjalan 100% lancar.",
            "Prioritas bantuan langsung dari tim pengembang Keluarga Berkembang.",
        ],
        ctaLabel: "Pesan Bundel VIP (Rp 599.000)",
        hidden: true,
    },
];

const FAQ_ITEMS = [
    {
        q: "Apakah saya harus mengerti coding atau punya latar belakang IT untuk memakai sistem ini?",
        a: "Sama sekali tidak perlu. Untuk pencatatan manual di Web dan HP (termasuk Rekening Bersama vs Privat, Adu Harga Minimarket per 100ml/100g, Stok Kulkas, dan Export Excel), Anda bisa langsung memakainya Gratis Selamanya (Rp 0) di kelola.keluargaberkembang.com. Jika malas ketik manual, cukup aktifkan Paket Sachet Asisten AI mulai Rp 9.000 (7 hari) atau Paket Lengkap Grup WhatsApp Suami-Istri Rp 29.000/bulan.",
    },
    {
        q: "Apa bedanya versi Web Gratis Rp 0, Paket Sachet/Hemat (Rp 9.000 / Rp 19.000), dan Paket Lengkap Keluarga (Rp 29.000)?",
        a: "Versi Web Gratis Rp 0 sudah mencakup seluruh fitur pencatatan manual, pisah rekening Bersama dan Privat, kalkulator harga per 100ml/100g, stok kulkas, serta unduh laporan Excel (.xlsx) tanpa iklan. Paket Sachet (Rp 9.000 / 7 hari) dan Paket Hemat (Rp 19.000 / 30 hari) menambahkan asisten AI di Web & Telegram serta scan foto struk otomatis 5 detik. Paket Lengkap Keluarga (Rp 29.000 / 30 hari) memungkinkan asisten dimasukkan langsung ke 1 Grup WhatsApp berdua suami-istri.",
    },
    {
        q: "Apakah ada biaya bulanan setelah membeli Ebook Rp 99.000? Bagaimana rincian jujurnya?",
        a: "Pembelian Ebook + Full Source Code Rp 99.000 adalah sekali bayar untuk hak milik selamanya. Jika Anda ingin menyalakan asisten bot 24 jam secara mandiri, Anda bebas memilih 1 dari 3 jalur: (1) Jalur Cloud Free Tier Rp 0/bulan jika memiliki kartu debit/kredit berlogo Visa/Mastercard untuk verifikasi akun cloud; (2) Jalur VPS lokal Indonesia sekitar Rp 25.000/bulan via QRIS tanpa kartu kredit; atau (3) Jalur Terima Beres di @KaraAutoBot mulai Rp 9.000 (Paket Sachet) hingga Rp 29.000/bulan (Paket Lengkap Grup WhatsApp).",
        hidden: true,
    },
    {
        q: "Kalau dipakai berdua dengan pasangan, apakah saldo tabungan pribadi saya ikut terlihat?",
        a: "Tidak. Di dalam Keluarga Berkembang terdapat pemisahan tegas antara rekening berlabel Bersama (Shared) dan rekening berlabel Privat. Rekening Bersama (seperti Kas Dapur atau Tabungan Anak) terlihat oleh suami dan istri, sedangkan rekening berlabel Privat hanya menampilkan rincian saldo kepada pemilik akun itu sendiri.",
    },
    {
        q: "Apakah aman menghubungkan Asisten AI ke Grup WhatsApp suami-istri?",
        a: "Aman karena dirancang khusus untuk pemakaian internal 1 Grup WhatsApp keluarga berdua pasangan (suami, istri, dan asisten pribadi), bukan untuk pengiriman pesan massal (blast/spam) ke nomor asing. Pola percakapan terjadi secara alami layaknya obrolan rumah tangga sehari-hari.",
    },
    {
        q: "Bagaimana metode pembayaran, kecepatan aktivasi layanan digital, dan garansi pengembalian dana (Refund)?",
        a: "Seluruh pembayaran diproses dalam mata uang Rupiah (Rp) melalui QRIS (mendukung semua bank dan e-wallet) serta Virtual Account Bank Nasional. Kuota dan layanan Asisten AI Keluarga aktif otomatis dalam waktu kurang dari 3 menit setelah pembayaran terverifikasi. Kami memberikan garansi 100% uang kembali apabila layanan gagal aktif sesuai Kebijakan Pengembalian Dana (/refund).",
    },
];

const LandingPage = ({ showToast, onNavigate, isRootDomain }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Scenario Explorer State
    const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
    const [activeShotIdx, setActiveShotIdx] = useState(0);
    const [deviceView, setDeviceView] = useState("web"); // "web" | "mobile"
    const [heroDeviceView, setHeroDeviceView] = useState("web");
    const [lightboxShot, setLightboxShot] = useState(null);

    // FAQ State
    const [openFaqIdx, setOpenFaqIdx] = useState(0);

    // Auth Modals State
    const [showSignup, setShowSignup] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [formErrors, setFormErrors] = useState({});
    const [formStep, setFormStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Storefront Order / Checkout Modal State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedSubOption, setSelectedSubOption] = useState(null);
    const [orderForm, setOrderForm] = useState({
        buyerName: "",
        buyerEmail: "",
        buyerContact: "",
        paymentMethod: "QRIS",
    });
    const [orderErrors, setOrderErrors] = useState({});
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [orderInvoice, setOrderInvoice] = useState(null);

    // Check URL query params (?auth=login or ?auth=signup)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const authParam = params.get("auth");
        if (authParam === "login") setShowLogin(true);
        if (authParam === "signup") setShowSignup(true);
    }, []);

    // Close lightbox on Escape
    useEffect(() => {
        if (!lightboxShot) return;
        const onKey = (e) => {
            if (e.key === "Escape") setLightboxShot(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lightboxShot]);

    const currentScenario = SCENARIOS[activeScenarioIdx] || SCENARIOS[0];
    const currentShot = currentScenario.screenshots[activeShotIdx] || currentScenario.screenshots[0];

    // Default: tampilkan 3 kartu SaaS; tambahkan ?catalog=all untuk menampilkan Ebook & VIP yang di-hide
    const showAllCatalog =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("catalog") === "all";
    const saasProducts = CATALOG_PRODUCTS.filter((p) => !p.hidden);
    const hiddenProducts = CATALOG_PRODUCTS.filter((p) => p.hidden);
    const visibleFaqs = FAQ_ITEMS.filter((item) => showAllCatalog || !item.hidden);

    const handleScenarioSelect = (idx) => {
        setActiveScenarioIdx(idx);
        setActiveShotIdx(0);
    };

    const handleLegalLink = (e, path) => {
        if (onNavigate) {
            e.preventDefault();
            setMobileMenuOpen(false);
            onNavigate(path);
        }
    };

    const openOrderModal = (product) => {
        setSelectedProduct(product);
        setSelectedSubOption(product.subOptions ? product.subOptions[0] : null);
        setOrderErrors({});
        setOrderInvoice(null);
    };

    const closeOrderModal = () => {
        setSelectedProduct(null);
        setSelectedSubOption(null);
        setOrderErrors({});
        setOrderInvoice(null);
    };

    const handleOrderSubmit = (e) => {
        e.preventDefault();
        const errs = {};
        if (!orderForm.buyerName.trim()) errs.buyerName = "Nama penerima wajib diisi";
        if (!orderForm.buyerEmail.trim()) {
            errs.buyerEmail = "Alamat email pengiriman wajib diisi";
        } else if (!/\S+@\S+\.\S+/.test(orderForm.buyerEmail)) {
            errs.buyerEmail = "Format alamat email tidak valid";
        }
        if (!orderForm.buyerContact.trim()) {
            errs.buyerContact = "Nomor WhatsApp atau username Telegram wajib diisi";
        }
        setOrderErrors(errs);
        if (Object.keys(errs).length > 0) return;

        setOrderSubmitting(true);
        setTimeout(() => {
            const activePrice = selectedSubOption ? selectedSubOption.priceDisplay : selectedProduct.priceDisplay;
            const activeItemName = selectedSubOption
                ? `${selectedProduct.name} (${selectedSubOption.label})`
                : selectedProduct.name;
            const invoiceId = `INV-KB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Math.floor(1000 + Math.random() * 9000))}`;
            setOrderSubmitting(false);
            setOrderInvoice({
                invoiceId,
                itemName: activeItemName,
                code: selectedProduct.code,
                priceDisplay: activePrice,
                buyerName: orderForm.buyerName.trim(),
                buyerEmail: orderForm.buyerEmail.trim(),
                buyerContact: orderForm.buyerContact.trim(),
                paymentMethod: orderForm.paymentMethod,
                deliveryMethod: selectedProduct.deliveryMethod,
                createdAt: new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
            });
            if (showToast) {
                showToast(`Ringkasan pesanan ${invoiceId} berhasil dibuat`, "success");
            }
        }, 450);
    };

    const handleSignup = async () => {
        const err = {};
        if (!signupForm.name.trim()) err.name = "Nama wajib diisi";
        if (!signupForm.email.trim()) err.email = "Email wajib diisi";
        else if (!/\S+@\S+\.\S+/.test(signupForm.email)) err.email = "Format email tidak valid";
        if (!signupForm.password) err.password = "Kata sandi wajib diisi";
        else if (signupForm.password.length < PASSWORD_MIN_LENGTH) err.password = `Minimal ${PASSWORD_MIN_LENGTH} karakter`;
        if (signupForm.password !== signupForm.confirmPassword) err.confirmPassword = "Konfirmasi kata sandi tidak cocok";
        setFormErrors(err);
        if (Object.keys(err).length > 0) return;

        setIsLoading(true);
        const { error } = await supabase.auth.signUp({
            email: signupForm.email,
            password: signupForm.password,
            options: {
                emailRedirectTo: "https://kelola.keluargaberkembang.com",
                data: { full_name: signupForm.name },
            },
        });
        setIsLoading(false);

        if (error) {
            if (error.message.includes("already registered")) {
                setFormErrors({ email: "Email sudah terdaftar, silakan masuk" });
            } else if (showToast) {
                showToast(error.message, "info");
            }
            return;
        }

        setShowSignup(false);
        setSignupForm({ name: "", email: "", password: "", confirmPassword: "" });
        setFormStep(1);
        if (showToast) {
            showToast("Akun berhasil dibuat! Silakan cek kotak masuk email Anda untuk konfirmasi.", "info");
        }
    };

    const handleLogin = async () => {
        const err = {};
        if (!loginForm.email.trim()) err.email = "Email wajib diisi";
        if (!loginForm.password) err.password = "Kata sandi wajib diisi";
        setFormErrors(err);
        if (Object.keys(err).length > 0) return;

        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: loginForm.email,
            password: loginForm.password,
        });
        setIsLoading(false);

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                setFormErrors({ password: "Email atau kata sandi belum tepat" });
            } else if (error.message.toLowerCase().includes("email not confirmed")) {
                setFormErrors({ email: "Email belum dikonfirmasi, silakan cek kotak masuk email Anda" });
            } else if (showToast) {
                showToast(error.message, "info");
            }
            return;
        }

        setShowLogin(false);
        setLoginForm({ email: "", password: "" });
        if (showToast) {
            showToast("Berhasil masuk! Membuka dasbor keluarga...");
        }
        if (isRootDomain) {
            window.location.href = "https://kelola.keluargaberkembang.com";
        }
    };

    const closeSignup = () => { setShowSignup(false); setFormErrors({}); setFormStep(1); };
    const closeLogin = () => { setShowLogin(false); setFormErrors({}); };

    return (
        <div className="kb-landing-root">
            <style>{`
                .kb-landing-root {
                    background-color: #FFFDF9;
                    color: #1F2922;
                    font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif;
                    line-height: 1.6;
                    min-height: 100vh;
                    overflow-x: hidden;
                    position: relative;
                }
                .kb-landing-root h1,
                .kb-landing-root h2,
                .kb-landing-root h3,
                .kb-landing-root h4 {
                    font-family: 'Fredoka', -apple-system, sans-serif;
                    font-weight: 600;
                    color: #1F2922;
                    text-wrap: balance;
                    letter-spacing: -0.015em;
                }
                .kb-landing-root p {
                    text-wrap: pretty;
                }
                .kb-mono {
                    font-family: 'JetBrains Mono', ui-monospace, monospace;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: -0.02em;
                }
                .kb-handwritten {
                    font-family: 'Caveat', cursive;
                    font-weight: 700;
                    line-height: 1.25;
                }
                .kb-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 24px;
                }
                /* Navbar */
                .kb-navbar {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: rgba(255, 253, 249, 0.94);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid #E5DEC9;
                }
                .kb-nav-inner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    min-height: 74px;
                    gap: 16px;
                }
                .kb-nav-links {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .kb-nav-link {
                    color: #1F2922;
                    text-decoration: none;
                    font-size: 14px;
                    font-weight: 700;
                    padding: 10px 14px;
                    min-height: 44px;
                    display: inline-flex;
                    align-items: center;
                    border-radius: 10px;
                    transition: background-color 0.2s, color 0.2s;
                }
                .kb-nav-link:hover {
                    background: #F7F3EB;
                    color: #2E3D30;
                }
                .kb-nav-actions {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .kb-mobile-toggle {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 44px;
                    padding: 10px 16px;
                    border-radius: 10px;
                    border: 1px solid #D5CCB8;
                    background: #F7F3EB;
                    color: #1F2922;
                    font-family: 'Fredoka', sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                }
                /* Buttons */
                .kb-btn-primary {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #3F5142;
                    color: #FFFDF9;
                    border: 1px solid #2E3D30;
                    padding: 13px 24px;
                    min-height: 48px;
                    border-radius: 12px;
                    font-family: 'Fredoka', sans-serif;
                    font-size: 15px;
                    font-weight: 600;
                    text-decoration: none;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 6px 18px -6px rgba(46, 61, 48, 0.35);
                }
                .kb-btn-primary:hover {
                    background: #2E3D30;
                    transform: translateY(-1px);
                }
                .kb-btn-secondary {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #F7F3EB;
                    color: #1F2922;
                    border: 1px solid #D5CCB8;
                    padding: 13px 22px;
                    min-height: 48px;
                    border-radius: 12px;
                    font-family: 'Fredoka', sans-serif;
                    font-size: 15px;
                    font-weight: 600;
                    text-decoration: none;
                    cursor: pointer;
                    transition: background-color 0.2s, border-color 0.2s;
                }
                .kb-btn-secondary:hover {
                    background: #EFE8D8;
                    border-color: #3F5142;
                }
                /* Hero Split Grid */
                .kb-hero-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
                    gap: 44px;
                    align-items: center;
                }
                /* Scenario Explorer Grid */
                .kb-scenario-tabs {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                    margin-bottom: 28px;
                }
                .kb-scenario-stage {
                    display: grid;
                    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
                    gap: 32px;
                    align-items: start;
                }
                /* Catalog Ledger Grid */
                .kb-catalog-saas-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 22px;
                    margin-bottom: 24px;
                    align-items: stretch;
                }
                .kb-catalog-featured-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 24px;
                    margin-bottom: 24px;
                }
                .kb-payment-steps {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 16px;
                }
                /* Pillars Grid */
                .kb-pillars-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 0.95fr);
                    gap: 20px;
                }
                /* FAQ Grid */
                .kb-faq-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
                    gap: 40px;
                    align-items: start;
                }
                /* Footer Grid */
                .kb-footer-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr);
                    gap: 32px;
                }
                .kb-hero-grid > *,
                .kb-scenario-tabs > *,
                .kb-scenario-stage > *,
                .kb-catalog-saas-grid > *,
                .kb-catalog-featured-grid > *,
                .kb-payment-steps > *,
                .kb-pillars-grid > *,
                .kb-faq-grid > *,
                .kb-footer-grid > * {
                    min-width: 0;
                    max-width: 100%;
                }
                .kb-btn-primary,
                .kb-btn-secondary {
                    max-width: 100%;
                    text-align: center;
                }
                @media (max-width: 980px) {
                    .kb-nav-links,
                    .kb-nav-actions-desktop {
                        display: none !important;
                    }
                    .kb-mobile-toggle {
                        display: inline-flex;
                    }
                    .kb-hero-grid,
                    .kb-scenario-stage,
                    .kb-catalog-saas-grid,
                    .kb-catalog-featured-grid,
                    .kb-pillars-grid,
                    .kb-faq-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .kb-scenario-tabs {
                        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    }
                    .kb-payment-steps {
                        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    }
                    .kb-footer-grid {
                        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    }
                }
                @media (max-width: 600px) {
                    .kb-container {
                        padding: 0 16px;
                    }
                    .kb-scenario-tabs,
                    .kb-payment-steps,
                    .kb-footer-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .kb-btn-primary,
                    .kb-btn-secondary {
                        width: 100%;
                        padding: 12px 16px !important;
                        font-size: 14px !important;
                    }
                }
            `}</style>

            {/* ═══ NAVBAR ═══ */}
            <header className="kb-navbar">
                <div className="kb-container kb-nav-inner">
                    <a
                        href="/"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 12,
                            textDecoration: "none",
                            color: "#1F2922",
                            minHeight: 44,
                        }}
                    >
                        <img
                            src="/logo-icon.png"
                            alt="Logo Keluarga Berkembang"
                            width={42}
                            height={42}
                            style={{
                                width: 42,
                                height: 42,
                                borderRadius: 12,
                                objectFit: "cover",
                                border: "1px solid #E5DEC9",
                                background: "#FFFDF9",
                                flexShrink: 0,
                            }}
                        />
                        <div>
                            <div style={{
                                fontFamily: "'Fredoka', sans-serif",
                                fontSize: 19,
                                fontWeight: 600,
                                color: "#1F2922",
                                lineHeight: 1.1,
                            }}>
                                Keluarga Berkembang
                            </div>
                            <div style={{
                                fontSize: 12,
                                color: "#4A584D",
                                fontWeight: 600,
                            }}>
                                Berkembang Bersama dalam Kehangatan
                            </div>
                        </div>
                    </a>

                    <nav className="kb-nav-links" aria-label="Navigasi Utama">
                        <a href="#fitur" className="kb-nav-link">Pameran Fitur</a>
                        <a href="#paket" className="kb-nav-link">Katalog & Harga (Rp)</a>
                        <a href="#ekosistem" className="kb-nav-link">Pilar Ekosistem</a>
                        <a href="#faq" className="kb-nav-link">Tanya Jawab</a>
                        <a href="/tos" onClick={(e) => handleLegalLink(e, "/tos")} className="kb-nav-link">Ketentuan & Legal</a>
                    </nav>

                    <div className="kb-nav-actions kb-nav-actions-desktop">
                        <button
                            type="button"
                            onClick={() => setShowLogin(true)}
                            className="kb-btn-secondary"
                            style={{ padding: "10px 18px", minHeight: 44, fontSize: 14 }}
                        >
                            Masuk Akun
                        </button>
                        <a
                            href="https://kelola.keluargaberkembang.com"
                            className="kb-btn-primary"
                            style={{ padding: "10px 18px", minHeight: 44, fontSize: 14 }}
                        >
                            Buka Aplikasi Web
                        </a>
                    </div>

                    <button
                        type="button"
                        className="kb-mobile-toggle"
                        aria-expanded={mobileMenuOpen}
                        aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
                        onClick={() => setMobileMenuOpen((v) => !v)}
                    >
                        <span>{mobileMenuOpen ? "✕ Tutup" : "☰ Menu"}</span>
                    </button>
                </div>

                {/* Mobile Drawer */}
                {mobileMenuOpen && (
                    <div style={{
                        background: "#FFFDF9",
                        borderBottom: "1px solid #E5DEC9",
                        padding: "16px 20px 24px",
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                            <a href="#fitur" onClick={() => setMobileMenuOpen(false)} className="kb-nav-link">Pameran Fitur Nyata</a>
                            <a href="#paket" onClick={() => setMobileMenuOpen(false)} className="kb-nav-link">Katalog Paket & Harga (Rp)</a>
                            <a href="#ekosistem" onClick={() => setMobileMenuOpen(false)} className="kb-nav-link">Pilar Ekosistem</a>
                            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="kb-nav-link">Tanya Jawab Pembeli</a>
                            <a href="/tos" onClick={(e) => handleLegalLink(e, "/tos")} className="kb-nav-link">Syarat, Privasi, & Refund</a>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => { setMobileMenuOpen(false); setShowLogin(true); }}
                                className="kb-btn-secondary"
                                style={{ width: "100%", fontSize: 14 }}
                            >
                                Masuk Akun
                            </button>
                            <a
                                href="https://kelola.keluargaberkembang.com"
                                className="kb-btn-primary"
                                style={{ width: "100%", fontSize: 14 }}
                            >
                                Buka Web App
                            </a>
                        </div>
                    </div>
                )}
            </header>

            <main>
                {/* ═══ SECTION 1: SPLIT EDITORIAL HERO (RUMUS TIER 100 JUTA) ═══ */}
                <section style={{
                    padding: "56px 0 72px",
                    borderBottom: "1px solid #E5DEC9",
                    background: "linear-gradient(180deg, #FFFDF9 0%, #F7F3EB 100%)",
                }}>
                    <div className="kb-container">
                        <div className="kb-hero-grid">
                            {/* Left Column: Specific Problem & Positioning */}
                            <div>
                                <div style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 14px",
                                    borderRadius: 99,
                                    background: "#E6EFE8",
                                    border: "1px solid #C5D6C8",
                                    color: "#2E3D30",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    marginBottom: 18,
                                }}>
                                    <span>Jurnal Keuangan & Asisten Rumah Tangga Indonesia</span>
                                </div>

                                <h1 style={{
                                    fontSize: "clamp(32px, 4.4vw, 50px)",
                                    lineHeight: 1.1,
                                    marginBottom: 18,
                                    color: "#1F2922",
                                }}>
                                    Rapikan arus kas suami-istri, tahu minimarket termurah{" "}
                                    <span style={{
                                        color: "#9E472D",
                                        textDecoration: "underline",
                                        textDecorationColor: "#D98A3C",
                                        textDecorationThickness: "3px",
                                        textUnderlineOffset: "5px",
                                    }}>
                                        per 100ml
                                    </span>
                                    , dan catat belanja langsung dari Grup WhatsApp.
                                </h1>

                                <p style={{
                                    fontSize: "clamp(16px, 1.3vw, 18px)",
                                    color: "#4A584D",
                                    marginBottom: 24,
                                    maxWidth: "60ch",
                                }}>
                                    Dirancang untuk pasangan keluarga Indonesia yang ingin menyatukan anggaran dapur dan dana anak secara terbuka, melacak isi kulkas sebelum kedaluwarsa, sekaligus menjaga saldo rekening{" "}
                                    <strong style={{ color: "#1F2922" }}>🔒 Privat</strong> masing-masing tetap aman.
                                </p>

                                {/* 3 Concrete Value Points */}
                                <div style={{
                                    background: "#FFFDF9",
                                    border: "1px solid #E5DEC9",
                                    borderRadius: 16,
                                    padding: "16px 20px",
                                    marginBottom: 28,
                                    display: "grid",
                                    gap: 10,
                                }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                                        <span style={{ color: "#2E3D30", fontWeight: 700 }}>01.</span>
                                        <span>
                                            <strong>Akun Bersama & Privat Terpisah:</strong> Kas belanja rumah tangga transparan berdua, tabungan pribadi tidak terekspos.
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                                        <span style={{ color: "#9E472D", fontWeight: 700 }}>02.</span>
                                        <span>
                                            <strong>Kalkulator Minimarket & Stok Kulkas:</strong> Bandingkan harga toko otomatis per <code className="kb-mono">100ml</code> / <code className="kb-mono">100g</code> dan pantau stok dapur.
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                                        <span style={{ color: "#2E3D30", fontWeight: 700 }}>03.</span>
                                        <span>
                                            <strong>Fleksibel Cara Pakainya:</strong> Pakai gratis selamanya di Web App (<span className="kb-mono" style={{ fontWeight: 700, color: "#2E3D30" }}>Rp 0</span>), aktifkan Asisten Grup WA & Foto Struk mulai <span className="kb-mono" style={{ fontWeight: 700, color: "#2E3D30" }}>Rp 9.000</span>, atau miliki Ebook + Source Code <span className="kb-mono" style={{ fontWeight: 700, color: "#9E472D" }}>Rp 99.000</span>.
                                        </span>
                                    </div>
                                </div>

                                {/* Primary & Secondary CTAs */}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                                    <a
                                        href="https://kelola.keluargaberkembang.com"
                                        className="kb-btn-primary"
                                    >
                                        Buka Aplikasi Web (kelola.keluargaberkembang.com)
                                    </a>
                                    <a
                                        href="#paket"
                                        className="kb-btn-secondary"
                                    >
                                        Lihat Katalog Paket & Harga
                                    </a>
                                </div>

                                <div style={{
                                    marginTop: 14,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 16,
                                    alignItems: "center",
                                    fontSize: 13,
                                    color: "#4A584D",
                                    fontWeight: 600,
                                }}>
                                    <span>Ingin langsung membuat akun di halaman ini?</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowSignup(true)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#3F5142",
                                            fontWeight: 700,
                                            fontSize: 13,
                                            textDecoration: "underline",
                                            cursor: "pointer",
                                            padding: "6px 0",
                                            minHeight: 36,
                                        }}
                                    >
                                        Daftar Akun Keluarga Baru
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Real Product Frame + Handwritten Marginalia */}
                            <div style={{ position: "relative" }}>
                                {/* Handwritten Callout Badge */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: 10,
                                    marginBottom: 12,
                                }}>
                                    <div className="kb-handwritten" style={{
                                        fontSize: 22,
                                        color: "#9E472D",
                                    }}>
                                        ✎ Tangkapan layar asli aplikasi produksi (bukan ilustrasi mockup)
                                    </div>

                                    <div style={{
                                        display: "inline-flex",
                                        background: "#EFE8D8",
                                        padding: 4,
                                        borderRadius: 10,
                                        border: "1px solid #D5CCB8",
                                    }}>
                                        <button
                                            type="button"
                                            onClick={() => setHeroDeviceView("web")}
                                            style={{
                                                padding: "6px 12px",
                                                minHeight: 36,
                                                borderRadius: 8,
                                                border: "none",
                                                background: heroDeviceView === "web" ? "#3F5142" : "transparent",
                                                color: heroDeviceView === "web" ? "#FFFDF9" : "#1F2922",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Layar Desktop
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHeroDeviceView("mobile")}
                                            style={{
                                                padding: "6px 12px",
                                                minHeight: 36,
                                                borderRadius: 8,
                                                border: "none",
                                                background: heroDeviceView === "mobile" ? "#3F5142" : "transparent",
                                                color: heroDeviceView === "mobile" ? "#FFFDF9" : "#1F2922",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Layar HP
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    background: "#FFFDF9",
                                    border: "1px solid #D5CCB8",
                                    borderRadius: 20,
                                    overflow: "hidden",
                                    boxShadow: "0 20px 50px -15px rgba(31, 41, 34, 0.14)",
                                }}>
                                    {/* Browser Top Bar */}
                                    <div style={{
                                        background: "#F7F3EB",
                                        borderBottom: "1px solid #E5DEC9",
                                        padding: "10px 14px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: 8,
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#C86D51" }} />
                                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#D98A3C" }} />
                                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3F5142" }} />
                                        </div>
                                        <div className="kb-mono" style={{
                                            fontSize: 12,
                                            color: "#4A584D",
                                            background: "#FFFDF9",
                                            border: "1px solid #E5DEC9",
                                            padding: "3px 12px",
                                            borderRadius: 6,
                                        }}>
                                            kelola.keluargaberkembang.com
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLightboxShot({
                                                label: "Dasbor Utama Keluarga Berkembang",
                                                src: heroDeviceView === "web" ? "/screenshots/web/02-dasbor.png" : "/screenshots/mobile/02-dasbor.png",
                                                caption: "Tampilan nyata dasbor arus kas, porsi pengeluaran, dan stok dapur rumah tangga.",
                                            })}
                                            style={{
                                                background: "#FFFDF9",
                                                border: "1px solid #D5CCB8",
                                                color: "#2E3D30",
                                                padding: "5px 10px",
                                                minHeight: 36,
                                                borderRadius: 8,
                                                fontSize: 12,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Perbesar Layar
                                        </button>
                                    </div>

                                    {/* Screenshot Container */}
                                    <div style={{
                                        padding: heroDeviceView === "mobile" ? "20px" : "0",
                                        background: "#F7F3EB",
                                        display: "flex",
                                        justifyContent: "center",
                                    }}>
                                        <img
                                            src={heroDeviceView === "web" ? "/screenshots/web/02-dasbor.png" : "/screenshots/mobile/02-dasbor.png"}
                                            alt="Dasbor Aplikasi Keluarga Berkembang menampilkan ringkasan pemasukan, pengeluaran, anggaran rumah tangga, dan stok kulkas"
                                            style={{
                                                width: heroDeviceView === "mobile" ? "auto" : "100%",
                                                maxHeight: heroDeviceView === "mobile" ? 460 : "none",
                                                maxWidth: "100%",
                                                display: "block",
                                                borderRadius: heroDeviceView === "mobile" ? 16 : 0,
                                                border: heroDeviceView === "mobile" ? "1px solid #D5CCB8" : "none",
                                                cursor: "zoom-in",
                                            }}
                                            onClick={() => setLightboxShot({
                                                label: "Dasbor Utama Keluarga Berkembang",
                                                src: heroDeviceView === "web" ? "/screenshots/web/02-dasbor.png" : "/screenshots/mobile/02-dasbor.png",
                                                caption: "Tampilan nyata dasbor arus kas, porsi pengeluaran, dan stok dapur rumah tangga.",
                                            })}
                                        />
                                    </div>

                                    {/* Bottom Caption Strip */}
                                    <div style={{
                                        padding: "12px 18px",
                                        background: "#FFFDF9",
                                        borderTop: "1px solid #E5DEC9",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        fontSize: 13,
                                        color: "#4A584D",
                                    }}>
                                        <span>
                                            <strong>02-dasbor.png:</strong> Pantau sisa anggaran bulanan & stok bahan dapur dalam satu halaman.
                                        </span>
                                        <a
                                            href="#fitur"
                                            style={{ color: "#3F5142", fontWeight: 700, textDecoration: "underline" }}
                                        >
                                            Jelajahi 10 tangkapan layar lainnya ↓
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ SECTION 2: INTERACTIVE SCENARIO EXPLORER (#fitur) ═══ */}
                <section id="fitur" style={{ padding: "80px 0", background: "#FFFDF9", borderBottom: "1px solid #E5DEC9" }}>
                    <div className="kb-container">
                        <div style={{ maxWidth: 740, marginBottom: 32 }}>
                            <div style={{
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "#3F5142",
                                marginBottom: 8,
                            }}>
                                Pameran Fitur Interaktif · Bukti Produk Nyata
                            </div>
                            <h2 style={{ fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.15, marginBottom: 12 }}>
                                Pilih skenario masalah keluarga Anda dan uji langsung tampilannya
                            </h2>
                            <p style={{ fontSize: 16, color: "#4A584D", margin: 0 }}>
                                Klik salah satu dari 4 skenario di bawah ini untuk melihat bagaimana Keluarga Berkembang menyelesaikan persoalan nyata rumah tangga Indonesia, lengkap dengan tangkapan layar versi Desktop dan HP.
                            </p>
                        </div>

                        {/* 4 Scenario Selector Tabs */}
                        <div className="kb-scenario-tabs" role="tablist" aria-label="Pilih skenario masalah keluarga">
                            {SCENARIOS.map((sc, idx) => {
                                const isSelected = idx === activeScenarioIdx;
                                return (
                                    <button
                                        key={sc.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        onClick={() => handleScenarioSelect(idx)}
                                        style={{
                                            textAlign: "left",
                                            padding: "16px 18px",
                                            minHeight: 64,
                                            borderRadius: 14,
                                            border: isSelected ? "2px solid #3F5142" : "1px solid #D5CCB8",
                                            background: isSelected ? "#3F5142" : "#F7F3EB",
                                            color: isSelected ? "#FFFDF9" : "#1F2922",
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                            boxShadow: isSelected ? "0 10px 24px -10px rgba(46, 61, 48, 0.4)" : "none",
                                        }}
                                    >
                                        <div style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            color: isSelected ? "#D5E3D7" : "#4A584D",
                                            marginBottom: 4,
                                        }}>
                                            {sc.badge}
                                        </div>
                                        <div style={{
                                            fontFamily: "'Fredoka', sans-serif",
                                            fontSize: 15,
                                            fontWeight: 600,
                                            lineHeight: 1.25,
                                        }}>
                                            {sc.tabTitle}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active Scenario Stage */}
                        <div className="kb-scenario-stage" style={{
                            background: "#F7F3EB",
                            border: "1px solid #E5DEC9",
                            borderRadius: 24,
                            padding: "32px 28px",
                        }}>
                            {/* Left Column: Scenario Explanation + Sub-screenshot Picker */}
                            <div>
                                <div style={{
                                    display: "inline-block",
                                    padding: "4px 12px",
                                    borderRadius: 99,
                                    background: "#E6EFE8",
                                    color: "#2E3D30",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    marginBottom: 12,
                                }}>
                                    {currentScenario.badge}
                                </div>

                                <h3 style={{
                                    fontSize: "clamp(22px, 2.5vw, 28px)",
                                    lineHeight: 1.2,
                                    marginBottom: 14,
                                    color: "#1F2922",
                                }}>
                                    {currentScenario.headline}
                                </h3>

                                <p style={{
                                    fontSize: 15,
                                    color: "#4A584D",
                                    marginBottom: 18,
                                }}>
                                    {currentScenario.description}
                                </p>

                                {/* Handwritten Marginalia Note */}
                                <div className="kb-handwritten" style={{
                                    fontSize: 21,
                                    color: "#9E472D",
                                    background: "#FFFDF9",
                                    borderLeft: "4px solid #C86D51",
                                    padding: "10px 16px",
                                    borderRadius: "0 12px 12px 0",
                                    marginBottom: 20,
                                }}>
                                    ✎ Catatan: {currentScenario.handwrittenNote}
                                </div>

                                {/* Bullet Highlights */}
                                <ul style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: "0 0 24px 0",
                                    display: "grid",
                                    gap: 10,
                                }}>
                                    {currentScenario.highlights.map((item, i) => (
                                        <li key={i} style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 10,
                                            fontSize: 14,
                                            color: "#1F2922",
                                        }}>
                                            <span style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 6,
                                                background: "#3F5142",
                                                color: "#FFFDF9",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                flexShrink: 0,
                                                marginTop: 2,
                                            }}>✓</span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* Screenshot Sub-Selector */}
                                <div style={{
                                    borderTop: "1px solid #D5CCB8",
                                    paddingTop: 18,
                                }}>
                                    <div style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        color: "#4A584D",
                                        marginBottom: 10,
                                    }}>
                                        Pilih Layar Bukti untuk Skenario Ini:
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {currentScenario.screenshots.map((shot, sIdx) => {
                                            const active = sIdx === activeShotIdx;
                                            return (
                                                <button
                                                    key={shot.id}
                                                    type="button"
                                                    onClick={() => setActiveShotIdx(sIdx)}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        padding: "11px 14px",
                                                        minHeight: 44,
                                                        borderRadius: 10,
                                                        border: active ? "1.5px solid #3F5142" : "1px solid #D5CCB8",
                                                        background: active ? "#FFFDF9" : "transparent",
                                                        color: "#1F2922",
                                                        fontSize: 14,
                                                        fontWeight: active ? 700 : 600,
                                                        cursor: "pointer",
                                                        textAlign: "left",
                                                    }}
                                                >
                                                    <span>{sIdx + 1}. {shot.label}</span>
                                                    <span style={{
                                                        fontSize: 12,
                                                        color: active ? "#3F5142" : "#4A584D",
                                                        fontWeight: 700,
                                                    }}>
                                                        {active ? "Sedang Ditampilkan ●" : "Lihat Layar →"}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Interactive Screenshot Frame */}
                            <div>
                                {/* Frame Controls */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: 10,
                                    marginBottom: 12,
                                }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2922" }}>
                                        Layar Aktif: <span style={{ color: "#3F5142" }}>{currentShot.label}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{
                                            display: "inline-flex",
                                            background: "#EFE8D8",
                                            padding: 3,
                                            borderRadius: 10,
                                            border: "1px solid #D5CCB8",
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setDeviceView("web")}
                                                style={{
                                                    padding: "6px 12px",
                                                    minHeight: 36,
                                                    borderRadius: 8,
                                                    border: "none",
                                                    background: deviceView === "web" ? "#3F5142" : "transparent",
                                                    color: deviceView === "web" ? "#FFFDF9" : "#1F2922",
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Versi Desktop
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeviceView("mobile")}
                                                style={{
                                                    padding: "6px 12px",
                                                    minHeight: 36,
                                                    borderRadius: 8,
                                                    border: "none",
                                                    background: deviceView === "mobile" ? "#3F5142" : "transparent",
                                                    color: deviceView === "mobile" ? "#FFFDF9" : "#1F2922",
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Versi HP
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setLightboxShot({
                                                label: currentShot.label,
                                                src: deviceView === "web" ? currentShot.web : currentShot.mobile,
                                                caption: currentShot.caption,
                                            })}
                                            style={{
                                                padding: "8px 14px",
                                                minHeight: 42,
                                                borderRadius: 10,
                                                border: "1px solid #D5CCB8",
                                                background: "#FFFDF9",
                                                color: "#1F2922",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Perbesar Gambar
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    background: "#FFFDF9",
                                    border: "1px solid #D5CCB8",
                                    borderRadius: 18,
                                    overflow: "hidden",
                                    boxShadow: "0 16px 40px -15px rgba(31, 41, 34, 0.12)",
                                }}>
                                    <div style={{
                                        padding: deviceView === "mobile" ? "24px" : "0",
                                        background: "#FFFDF9",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        minHeight: 340,
                                    }}>
                                        <img
                                            src={deviceView === "web" ? currentShot.web : currentShot.mobile}
                                            alt={`${currentShot.label} - ${currentShot.caption}`}
                                            style={{
                                                width: deviceView === "mobile" ? "auto" : "100%",
                                                maxHeight: deviceView === "mobile" ? 480 : "none",
                                                maxWidth: "100%",
                                                display: "block",
                                                borderRadius: deviceView === "mobile" ? 16 : 0,
                                                border: deviceView === "mobile" ? "1px solid #D5CCB8" : "none",
                                                cursor: "zoom-in",
                                            }}
                                            onClick={() => setLightboxShot({
                                                label: currentShot.label,
                                                src: deviceView === "web" ? currentShot.web : currentShot.mobile,
                                                caption: currentShot.caption,
                                            })}
                                        />
                                    </div>
                                    <div style={{
                                        padding: "14px 18px",
                                        background: "#FFFDF9",
                                        borderTop: "1px solid #E5DEC9",
                                        fontSize: 13,
                                        color: "#4A584D",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 8,
                                    }}>
                                        <span>{currentShot.caption}</span>
                                        <span className="kb-mono" style={{ fontSize: 11, color: "#3F5142", fontWeight: 700 }}>
                                            {deviceView === "web" ? "RESOLUSI DESKTOP" : "RESOLUSI MOBILE"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ SECTION 3: STOREFRONT KATALOG PRODUK & LAYANAN BERHARGA RUPIAH JELAS (#paket) ═══ */}
                <section id="paket" style={{ padding: "84px 0", background: "#F7F3EB", borderBottom: "1px solid #E5DEC9" }}>
                    <div className="kb-container">
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            flexWrap: "wrap",
                            gap: 20,
                            marginBottom: 36,
                        }}>
                            <div style={{ maxWidth: 700 }}>
                                <div style={{
                                    display: "inline-block",
                                    padding: "5px 12px",
                                    borderRadius: 99,
                                    background: "#FBF0EA",
                                    border: "1px solid #E8C7B8",
                                    color: "#9E472D",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 10,
                                }}>
                                    Katalog Resmi Produk Digital & Layanan SaaS (IDR / Rp)
                                </div>
                                <h2 style={{ fontSize: "clamp(28px, 3.6vw, 40px)", lineHeight: 1.12, marginBottom: 10 }}>
                                    Pilih cara memulai yang paling pas untuk rumah tangga Anda
                                </h2>
                                <p style={{ fontSize: 16, color: "#4A584D", margin: 0 }}>
                                    Seluruh harga tertera secara transparan dalam mata uang Rupiah (<span className="kb-mono">Rp</span>). Tidak ada biaya tersembunyi, dan produk digital dikirim secara otomatis begitu pembayaran terverifikasi.
                                </p>
                            </div>

                            <div className="kb-handwritten" style={{
                                fontSize: 22,
                                color: "#2E3D30",
                                background: "#FFFDF9",
                                border: "1px solid #D5CCB8",
                                padding: "10px 18px",
                                borderRadius: 14,
                            }}>
                                ✎ Pembayaran instan via QRIS & Virtual Account Bank Nasional
                            </div>
                        </div>

                        {/* 3 Kartu SaaS Berjenjang (Mandiri Rp 0 · Sachet/Hemat Mulai Rp 9.000 · Lengkap Grup WA Rp 29.000) */}
                        <div className="kb-catalog-saas-grid">
                            {saasProducts.map((prod) => (
                                <div
                                    key={prod.id}
                                    style={{
                                        background: "#FFFDF9",
                                        border: prod.featured ? "2px solid #3F5142" : "1px solid #D5CCB8",
                                        borderRadius: 22,
                                        padding: "28px 24px",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        boxShadow: prod.featured
                                            ? "0 20px 45px -20px rgba(46, 61, 48, 0.24)"
                                            : "0 10px 30px -15px rgba(31, 41, 34, 0.08)",
                                    }}
                                >
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                                            <span style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                padding: "4px 10px",
                                                borderRadius: 99,
                                                background: prod.featured
                                                    ? "#3F5142"
                                                    : prod.isFreeApp
                                                        ? "#E6EFE8"
                                                        : "#FBF0EA",
                                                color: prod.featured
                                                    ? "#FFFDF9"
                                                    : prod.isFreeApp
                                                        ? "#2E3D30"
                                                        : "#9E472D",
                                            }}>
                                                {prod.category}
                                            </span>
                                            <span className="kb-mono" style={{ fontSize: 12, color: "#4A584D", fontWeight: 700 }}>
                                                {prod.code}
                                            </span>
                                        </div>

                                        <h3 style={{ fontSize: 22, lineHeight: 1.22, marginBottom: 8 }}>
                                            {prod.name}
                                        </h3>
                                        <p style={{ fontSize: 14, color: "#4A584D", marginBottom: 16 }}>
                                            {prod.subtitle}
                                        </p>

                                        {/* Price Block */}
                                        <div style={{
                                            background: "#F7F3EB",
                                            border: "1px solid #E5DEC9",
                                            borderRadius: 14,
                                            padding: "16px 16px",
                                            marginBottom: 16,
                                        }}>
                                            {(prod.originalPriceDisplay || prod.discountBadge) && (
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                                    {prod.originalPriceDisplay && (
                                                        <span className="kb-mono" style={{
                                                            fontSize: 13.5,
                                                            color: "#847D70",
                                                            textDecoration: "line-through",
                                                            fontWeight: 600,
                                                        }}>
                                                            {prod.originalPriceDisplay}
                                                        </span>
                                                    )}
                                                    {prod.discountBadge && (
                                                        <span style={{
                                                            fontSize: 10.5,
                                                            fontWeight: 700,
                                                            padding: "2px 8px",
                                                            borderRadius: 99,
                                                            background: prod.featured ? "#9E472D" : "#2E3D30",
                                                            color: "#FFFDF9",
                                                            letterSpacing: "0.04em",
                                                            textTransform: "uppercase",
                                                        }}>
                                                            {prod.discountBadge}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="kb-mono" style={{
                                                fontSize: "clamp(24px, 2.6vw, 30px)",
                                                fontWeight: 700,
                                                color: prod.featured ? "#9E472D" : "#2E3D30",
                                                lineHeight: 1.15,
                                            }}>
                                                {prod.priceDisplay}
                                            </div>
                                            <div style={{ fontSize: 13, color: "#4A584D", fontWeight: 600, marginTop: 4 }}>
                                                {prod.billingNote}
                                            </div>

                                            {prod.subOptions && (
                                                <div style={{
                                                    marginTop: 12,
                                                    paddingTop: 10,
                                                    borderTop: "1px dashed #D5CCB8",
                                                    display: "grid",
                                                    gap: 8,
                                                }}>
                                                    {prod.subOptions.map((sub) => (
                                                        <div key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, fontSize: 12.5 }}>
                                                            <span style={{ color: "#1F2922", fontWeight: 600 }}>{sub.label}</span>
                                                            <span className="kb-mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                                {sub.originalPriceDisplay && (
                                                                    <span style={{ color: "#847D70", textDecoration: "line-through", fontSize: 11.5, fontWeight: 500 }}>
                                                                        {sub.originalPriceDisplay}
                                                                    </span>
                                                                )}
                                                                <span style={{ fontWeight: 700, color: "#2E3D30" }}>{sub.priceDisplay}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Features List */}
                                        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px 0", display: "grid", gap: 10 }}>
                                            {prod.features.map((f, i) => (
                                                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "#1F2922" }}>
                                                    <span style={{ color: "#3F5142", fontWeight: 700 }}>✓</span>
                                                    <span>{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div>
                                        {/* Delivery SLA Box */}
                                        <div style={{
                                            background: "#FAF1E2",
                                            border: "1px solid #E5D4B8",
                                            borderRadius: 12,
                                            padding: "10px 12px",
                                            fontSize: 12,
                                            color: "#7A4710",
                                            fontWeight: 600,
                                            marginBottom: 14,
                                        }}>
                                            <strong>Pengiriman Layanan Digital:</strong> {prod.deliveryMethod}
                                        </div>

                                        {prod.isFreeApp ? (
                                            <div style={{ display: "grid", gap: 8 }}>
                                                <a
                                                    href="https://kelola.keluargaberkembang.com"
                                                    className="kb-btn-primary"
                                                    style={{ width: "100%", fontSize: 14 }}
                                                >
                                                    {prod.ctaLabel}
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSignup(true)}
                                                    className="kb-btn-secondary"
                                                    style={{ width: "100%", fontSize: 13, minHeight: 44, padding: "9px 14px" }}
                                                >
                                                    {prod.secondaryLabel}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => openOrderModal(prod)}
                                                className="kb-btn-primary"
                                                style={{
                                                    width: "100%",
                                                    fontSize: 14,
                                                    background: prod.featured ? "#9E472D" : "#3F5142",
                                                    borderColor: prod.featured ? "#7E3620" : "#2E3D30",
                                                }}
                                            >
                                                {prod.ctaLabel}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Hidden Ebook & VIP Offerings (Hanya tampil jika ?catalog=all) */}
                        {showAllCatalog && hiddenProducts.length > 0 && (
                            <div className="kb-catalog-featured-grid" style={{ marginBottom: 32 }}>
                                {hiddenProducts.map((prod) => (
                                    <div
                                        key={prod.id}
                                        style={{
                                            background: "#FFFDF9",
                                            border: "1px solid #D5CCB8",
                                            borderRadius: 22,
                                            padding: "28px 26px",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                                                <span style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    padding: "4px 10px",
                                                    borderRadius: 99,
                                                    background: "#FBF0EA",
                                                    color: "#9E472D",
                                                }}>
                                                    {prod.category}
                                                </span>
                                                <span className="kb-mono" style={{ fontSize: 12, color: "#4A584D", fontWeight: 700 }}>
                                                    {prod.code}
                                                </span>
                                            </div>
                                            <h3 style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 8 }}>{prod.name}</h3>
                                            <p style={{ fontSize: 14, color: "#4A584D", marginBottom: 16 }}>{prod.subtitle}</p>
                                            <div style={{
                                                background: "#F7F3EB",
                                                border: "1px solid #E5DEC9",
                                                borderRadius: 14,
                                                padding: "14px 16px",
                                                marginBottom: 16,
                                            }}>
                                                <div className="kb-mono" style={{ fontSize: 28, fontWeight: 700, color: "#9E472D" }}>
                                                    {prod.priceDisplay}
                                                </div>
                                                <div style={{ fontSize: 13, color: "#4A584D", fontWeight: 600, marginTop: 4 }}>
                                                    {prod.billingNote}
                                                </div>
                                            </div>
                                            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px 0", display: "grid", gap: 8 }}>
                                                {prod.features.map((f, i) => (
                                                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "#1F2922" }}>
                                                        <span style={{ color: "#9E472D", fontWeight: 700 }}>✓</span>
                                                        <span>{f}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openOrderModal(prod)}
                                            className="kb-btn-primary"
                                            style={{ width: "100%" }}
                                        >
                                            {prod.ctaLabel}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Payment & Automated Delivery Explanation (Duitku KYC Requirement) */}
                        <div style={{
                            background: "#FFFDF9",
                            border: "1px solid #D5CCB8",
                            borderRadius: 20,
                            padding: "28px 28px",
                        }}>
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 12,
                                marginBottom: 20,
                            }}>
                                <div>
                                    <h3 style={{ fontSize: 20, marginBottom: 4 }}>
                                        Alur Pembayaran & Pengiriman Layanan Digital Otomatis
                                    </h3>
                                    <p style={{ fontSize: 14, color: "#4A584D", margin: 0 }}>
                                        Transaksi diproses secara aman dalam mata uang Rupiah (IDR) dengan aktivasi kuota dan asisten keluarga otomatis 24 jam.
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <span className="kb-mono" style={{ padding: "6px 12px", borderRadius: 8, background: "#E6EFE8", color: "#2E3D30", fontSize: 12, fontWeight: 700 }}>
                                        QRIS NASIONAL
                                    </span>
                                    <span className="kb-mono" style={{ padding: "6px 12px", borderRadius: 8, background: "#F7F3EB", border: "1px solid #D5CCB8", color: "#1F2922", fontSize: 12, fontWeight: 700 }}>
                                        VIRTUAL ACCOUNT BANK
                                    </span>
                                </div>
                            </div>

                            <div className="kb-payment-steps">
                                {[
                                    {
                                        step: "TAHAP 01",
                                        title: "Pilih Paket & Isi Identitas",
                                        desc: "Pilih paket layanan di katalog atas, lalu masukkan alamat Email dan nomor WhatsApp atau username Telegram penerima.",
                                    },
                                    {
                                        step: "TAHAP 02",
                                        title: "Bayar via QRIS / Virtual Account",
                                        desc: "Selesaikan pembayaran sesuai nominal Rupiah (Rp) melalui QRIS (semua bank & dompet digital) atau Virtual Account Bank Nasional.",
                                    },
                                    {
                                        step: "TAHAP 03",
                                        title: "Verifikasi & Aktivasi Instan",
                                        desc: "Sistem mendeteksi pembayaran otomatis. Kode kuota AI dan jalur koneksi Asisten AI Keluarga aktif dalam waktu kurang dari 3 menit.",
                                    },
                                    {
                                        step: "TAHAP 04",
                                        title: "Jaminan 100% Uang Kembali",
                                        desc: "Apabila terjadi kendala pengiriman sistem atau kegagalan aktivasi layanan asisten yang tidak terselesaikan dalam 1x24 jam, dana dikembalikan 100%.",
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.step}
                                        style={{
                                            background: "#F7F3EB",
                                            border: "1px solid #E5DEC9",
                                            borderRadius: 14,
                                            padding: "18px 18px",
                                        }}
                                    >
                                        <div className="kb-mono" style={{ fontSize: 11, fontWeight: 700, color: "#9E472D", marginBottom: 6 }}>
                                            {item.step}
                                        </div>
                                        <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 600, color: "#1F2922", marginBottom: 6 }}>
                                            {item.title}
                                        </div>
                                        <p style={{ fontSize: 13, color: "#4A584D", margin: 0 }}>
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ SECTION 4: PILAR EKOSISTEM KELUARGA BERKEMBANG (#ekosistem) ═══ */}
                <section id="ekosistem" style={{ padding: "80px 0", background: "#2E3D30", color: "#FFFDF9" }}>
                    <div className="kb-container">
                        <div style={{ maxWidth: 720, marginBottom: 36 }}>
                            <div style={{
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "#D5E3D7",
                                marginBottom: 8,
                            }}>
                                Arsitektur Rumah Utama · keluargaberkembang.com
                            </div>
                            <h2 style={{
                                fontSize: "clamp(26px, 3.4vw, 38px)",
                                lineHeight: 1.15,
                                color: "#FFFDF9",
                                marginBottom: 12,
                            }}>
                                Tiga Pilar Ekosistem Keluarga Berkembang
                            </h2>
                            <p style={{ fontSize: 16, color: "#E6EFE8", margin: 0 }}>
                                Satu ekosistem terpadu untuk merapikan pembukuan rumah tangga, mengotomasi pencatatan harian lewat asisten pesan instan, dan mendampingi tumbuh kembang anak.
                            </p>
                        </div>

                        <div className="kb-pillars-grid">
                            {/* Pillar 1 */}
                            <div style={{
                                background: "#FFFDF9",
                                color: "#1F2922",
                                borderRadius: 20,
                                padding: "28px 26px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                            }}>
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
                                        <span className="kb-mono" style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: "4px 10px",
                                            borderRadius: 99,
                                            background: "#E6EFE8",
                                            color: "#2E3D30",
                                        }}>
                                            ● AKTIF & SIAP DIPAKAI
                                        </span>
                                        <span className="kb-mono" style={{ fontSize: 12, color: "#4A584D", fontWeight: 700 }}>PILAR 01</span>
                                    </div>
                                    <h3 style={{ fontSize: 22, color: "#1F2922", marginBottom: 8 }}>
                                        Kelola Keuangan & Rumah Tangga
                                    </h3>
                                    <div className="kb-mono" style={{ fontSize: 13, color: "#3F5142", fontWeight: 700, marginBottom: 12 }}>
                                        https://kelola.keluargaberkembang.com
                                    </div>
                                    <p style={{ fontSize: 14, color: "#4A584D", marginBottom: 18 }}>
                                        Aplikasi web dan Android untuk pembukuan suami-istri, pemisahan rekening Privat vs Bersama, pelacak stok kulkas, daftar belanja, dan kalkulator harga minimarket per 100ml/100g.
                                    </p>
                                </div>
                                <a
                                    href="https://kelola.keluargaberkembang.com"
                                    className="kb-btn-primary"
                                    style={{ width: "100%", fontSize: 14 }}
                                >
                                    Masuk ke Aplikasi Kelola Keuangan
                                </a>
                            </div>

                            {/* Pillar 2 */}
                            <div style={{
                                background: "rgba(255, 253, 249, 0.08)",
                                border: "1px solid rgba(255, 253, 249, 0.2)",
                                borderRadius: 20,
                                padding: "28px 26px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                            }}>
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
                                        <span className="kb-mono" style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: "4px 10px",
                                            borderRadius: 99,
                                            background: "#E6EFE8",
                                            color: "#2E3D30",
                                        }}>
                                            ● AKTIF & SIAP DIPAKAI
                                        </span>
                                        <span className="kb-mono" style={{ fontSize: 12, color: "#D5E3D7", fontWeight: 700 }}>PILAR 02</span>
                                    </div>
                                    <h3 style={{ fontSize: 22, color: "#FFFDF9", marginBottom: 8 }}>
                                        Asisten Pribadi Keluarga 24 Jam
                                    </h3>
                                    <div className="kb-mono" style={{ fontSize: 13, color: "#D5E3D7", fontWeight: 700, marginBottom: 12 }}>
                                        Telegram @KaraAutoBot & Grup WhatsApp
                                    </div>
                                    <p style={{ fontSize: 14, color: "#E6EFE8", marginBottom: 18 }}>
                                        Asisten AI pribadi 24 jam yang tersambung ke Telegram dan Grup WhatsApp suami-istri untuk mencatat pengeluaran lewat chat, membaca foto struk belanja dalam 5 detik, dan mengecek sisa anggaran.
                                    </p>
                                </div>
                                <div style={{ display: "grid", gap: 8 }}>
                                    <a
                                        href="https://t.me/KaraAutoBot"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="kb-btn-secondary"
                                        style={{ width: "100%", fontSize: 14, background: "#FFFDF9", color: "#1F2922" }}
                                    >
                                        Buka @KaraAutoBot di Telegram
                                    </a>
                                </div>
                            </div>

                            {/* Pillar 3: Honest In-Development Status per R-24 */}
                            <div style={{
                                background: "rgba(255, 253, 249, 0.05)",
                                border: "1px dashed rgba(255, 253, 249, 0.28)",
                                borderRadius: 20,
                                padding: "28px 26px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                            }}>
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
                                        <span className="kb-mono" style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: "4px 10px",
                                            borderRadius: 99,
                                            background: "#FAF1E2",
                                            color: "#7A4710",
                                        }}>
                                            ⏳ DALAM PENGEMBANGAN
                                        </span>
                                        <span className="kb-mono" style={{ fontSize: 12, color: "#D5E3D7", fontWeight: 700 }}>PILAR 03</span>
                                    </div>
                                    <h3 style={{ fontSize: 22, color: "#FFFDF9", marginBottom: 8 }}>
                                        Edukasi Anak Ceria (Iqro Anak Ceria)
                                    </h3>
                                    <div className="kb-mono" style={{ fontSize: 13, color: "#D5E3D7", fontWeight: 700, marginBottom: 12 }}>
                                        anak.keluargaberkembang.com (Segera Hadir)
                                    </div>
                                    <p style={{ fontSize: 14, color: "#E6EFE8", marginBottom: 18 }}>
                                        Modul belajar huruf hijaiyah dan latihan membaca interaktif dengan audio pelafalan yang ramah anak serta bebas iklan yang mengganggu. Saat ini sedang dalam tahap penyelesaian akhir.
                                    </p>
                                </div>
                                <a
                                    href="https://t.me/keluargaberkembang"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        minHeight: 46,
                                        padding: "10px 16px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(255, 253, 249, 0.35)",
                                        color: "#FFFDF9",
                                        textDecoration: "none",
                                        fontSize: 13,
                                        fontWeight: 700,
                                    }}
                                >
                                    Ikuti Kabar Rilis di Saluran Telegram
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ SECTION 5: FAQ NYATA BERDASARKAN PERTANYAAN PEMBELI (#faq) ═══ */}
                <section id="faq" style={{ padding: "84px 0", background: "#FFFDF9", borderBottom: "1px solid #E5DEC9" }}>
                    <div className="kb-container">
                        <div className="kb-faq-grid">
                            {/* Left Column: Honest Summary & 3 Server Options Callout */}
                            <div>
                                <div style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    color: "#3F5142",
                                    marginBottom: 8,
                                }}>
                                    Tanya Jawab Transparan
                                </div>
                                <h2 style={{ fontSize: "clamp(26px, 3.2vw, 36px)", lineHeight: 1.15, marginBottom: 14 }}>
                                    Jawaban jujur atas pertanyaan yang paling sering ditanyakan pasangan keluarga
                                </h2>
                                <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 24 }}>
                                    Kami menuliskan rincian teknis dan biaya apa adanya di depan agar Anda bisa memilih jalur yang paling sesuai dengan kenyamanan rumah tangga Anda.
                                </p>

                                {/* Summary Card: 3 SaaS Tiers (default) or 3 Server Options (showAllCatalog) */}
                                <div style={{
                                    background: "#F7F3EB",
                                    border: "1px solid #E5DEC9",
                                    borderRadius: 18,
                                    padding: "22px 22px",
                                }}>
                                    <div className="kb-handwritten" style={{ fontSize: 21, color: "#9E472D", marginBottom: 6 }}>
                                        {showAllCatalog
                                            ? "✎ Ringkasan 3 Opsi Menjalankan Bot AI 24 Jam:"
                                            : "✎ Ringkasan 3 Pilihan Paket Keluarga Berkembang:"}
                                    </div>
                                    {showAllCatalog ? (
                                        <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
                                            <div style={{ paddingBottom: 10, borderBottom: "1px solid #E5DEC9" }}>
                                                <strong style={{ color: "#1F2922" }}>1. Jalur Cloud Free Tier (<span className="kb-mono">Rp 0 / bulan</span>):</strong>
                                                <div style={{ color: "#4A584D", marginTop: 2 }}>
                                                    Cocok bagi pemilik kartu debit/kredit berlogo Visa/Mastercard untuk verifikasi akun gratis Google Cloud / Azure.
                                                </div>
                                            </div>
                                            <div style={{ paddingBottom: 10, borderBottom: "1px solid #E5DEC9" }}>
                                                <strong style={{ color: "#1F2922" }}>2. Jalur VPS Lokal Tanpa Kartu Kredit (<span className="kb-mono">~Rp 25.000 / bulan</span>):</strong>
                                                <div style={{ color: "#4A584D", marginTop: 2 }}>
                                                    Pembayaran mudah menggunakan QRIS tanpa memerlukan kartu kredit.
                                                </div>
                                            </div>
                                            <div>
                                                <strong style={{ color: "#1F2922" }}>3. Jalur Terima Beres via @KaraAutoBot (<span className="kb-mono">Mulai Rp 9.000</span>):</strong>
                                                <div style={{ color: "#4A584D", marginTop: 2 }}>
                                                    Tanpa urus teknis sama sekali: Paket Sachet Rp 9.000 (7 hari), Paket Hemat Rp 19.000 (30 hari), atau Paket Lengkap Grup WA Suami-Istri Rp 29.000/bulan.
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
                                            <div style={{ paddingBottom: 10, borderBottom: "1px solid #E5DEC9" }}>
                                                <strong style={{ color: "#1F2922" }}>1. Paket Mandiri Web & Android (<span className="kb-mono">Rp 0 / Selamanya</span>):</strong>
                                                <div style={{ color: "#4A584D", marginTop: 2 }}>
                                                    Catat sendiri di Web/HP tanpa biaya langganan. Termasuk Rekening Bersama vs Privat, Adu Harga Minimarket, Stok Kulkas, dan Export Excel.
                                                </div>
                                            </div>
                                            <div style={{ paddingBottom: 10, borderBottom: "1px solid #E5DEC9" }}>
                                                <strong style={{ color: "#1F2922" }}>2. Paket Sachet & Hemat (<span className="kb-mono">Rp 9.000 / 7 hari · Rp 19.000 / 30 hari</span>):</strong>
                                                <div style={{ color: "#4A584D", marginTop: 2 }}>
                                                    Malas ketik manual? Kirim foto struk belanja atau chat via Web & Telegram, langsung tercatat otomatis dalam 5 detik.
                                                </div>
                                            </div>
                                            <div>
                                                <strong style={{ color: "#1F2922" }}>3. Paket Lengkap Grup WhatsApp (<span className="kb-mono">Rp 29.000 / 30 hari</span>):</strong>
                                                <div style={{ color: "#4A584D", marginTop: 2 }}>
                                                    Paling praktis untuk suami-istri (~Rp 900/hari berdua): asisten AI masuk ke Grup WhatsApp keluarga + Telegram + Scan Struk Otomatis.
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Interactive Accordion */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {visibleFaqs.map((item, idx) => {
                                    const isOpen = openFaqIdx === idx;
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                background: isOpen ? "#F7F3EB" : "#FFFDF9",
                                                border: isOpen ? "1.5px solid #3F5142" : "1px solid #D5CCB8",
                                                borderRadius: 16,
                                                overflow: "hidden",
                                                transition: "all 0.2s",
                                            }}
                                        >
                                            <button
                                                type="button"
                                                aria-expanded={isOpen}
                                                onClick={() => setOpenFaqIdx(isOpen ? -1 : idx)}
                                                style={{
                                                    width: "100%",
                                                    padding: "18px 20px",
                                                    minHeight: 56,
                                                    background: "transparent",
                                                    border: "none",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 16,
                                                    textAlign: "left",
                                                    cursor: "pointer",
                                                    color: "#1F2922",
                                                    fontFamily: "'Fredoka', sans-serif",
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <span>{item.q}</span>
                                                <span style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background: isOpen ? "#3F5142" : "#EFE8D8",
                                                    color: isOpen ? "#FFFDF9" : "#1F2922",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    flexShrink: 0,
                                                }}>
                                                    {isOpen ? "−" : "+"}
                                                </span>
                                            </button>
                                            {isOpen && (
                                                <div style={{
                                                    padding: "0 20px 20px",
                                                    fontSize: 15,
                                                    color: "#4A584D",
                                                    lineHeight: 1.65,
                                                    borderTop: "1px solid #E5DEC9",
                                                    paddingTop: 14,
                                                }}>
                                                    {item.a}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ═══ SECTION 6: FOOTER & INFORMASI LEGAL / KONTAK RESMI ═══ */}
            <footer style={{ background: "#F7F3EB", color: "#1F2922", padding: "64px 0 40px" }}>
                <div className="kb-container">
                    <div className="kb-footer-grid" style={{ marginBottom: 44 }}>
                        {/* Col 1: Brand Identity */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                                <img
                                    src="/logo-icon.png"
                                    alt="Logo Keluarga Berkembang"
                                    width={38}
                                    height={38}
                                    style={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 10,
                                        objectFit: "cover",
                                        border: "1px solid #D5CCB8",
                                        background: "#FFFDF9",
                                    }}
                                />
                                <div>
                                    <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 18, fontWeight: 600 }}>
                                        Keluarga Berkembang
                                    </div>
                                    <div style={{ fontSize: 12, color: "#4A584D", fontWeight: 600 }}>
                                        Berkembang Bersama dalam Kehangatan
                                    </div>
                                </div>
                            </div>
                            <p style={{ fontSize: 14, color: "#4A584D", marginBottom: 16 }}>
                                Ekosistem perangkat lunak pengelolaan keuangan rumah tangga, manajemen stok dapur, kalkulator harga minimarket, dan asisten AI keluarga Indonesia.
                            </p>
                            <div className="kb-mono" style={{ fontSize: 12, color: "#2E3D30", fontWeight: 700 }}>
                                https://keluargaberkembang.com
                            </div>
                        </div>

                        {/* Col 2: Ekosistem & Produk */}
                        <div>
                            <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                                Produk & Layanan
                            </div>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, fontSize: 14 }}>
                                <li>
                                    <a href="https://kelola.keluargaberkembang.com" style={{ color: "#4A584D", textDecoration: "none", fontWeight: 600 }}>
                                        Paket Mandiri Web & Android (Rp 0)
                                    </a>
                                </li>
                                <li>
                                    <a href="#paket" style={{ color: "#4A584D", textDecoration: "none", fontWeight: 600 }}>
                                        Paket Sachet & Hemat AI (Mulai Rp 9.000)
                                    </a>
                                </li>
                                <li>
                                    <a href="#paket" style={{ color: "#4A584D", textDecoration: "none", fontWeight: 600 }}>
                                        Paket Lengkap Grup WA Suami-Istri (Rp 29.000)
                                    </a>
                                </li>
                                {showAllCatalog && (
                                    <>
                                        <li>
                                            <a href="#paket" style={{ color: "#4A584D", textDecoration: "none", fontWeight: 600 }}>
                                                Ebook Panduan + Source Code (Rp 99.000)
                                            </a>
                                        </li>
                                        <li>
                                            <a href="#paket" style={{ color: "#4A584D", textDecoration: "none", fontWeight: 600 }}>
                                                Bundel VIP & Bimbingan 14 Hari (Rp 599.000)
                                            </a>
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>

                        {/* Col 3: Dokumen Legal (Wajib KYC Duitku) */}
                        <div>
                            <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                                Dokumen Legal & Kebijakan
                            </div>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, fontSize: 14 }}>
                                <li>
                                    <a
                                        href="/tos"
                                        onClick={(e) => handleLegalLink(e, "/tos")}
                                        style={{ color: "#3F5142", textDecoration: "underline", fontWeight: 700 }}
                                    >
                                        Syarat & Ketentuan Layanan (/tos)
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="/privacy"
                                        onClick={(e) => handleLegalLink(e, "/privacy")}
                                        style={{ color: "#3F5142", textDecoration: "underline", fontWeight: 700 }}
                                    >
                                        Kebijakan Privasi Data (/privacy)
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="/refund"
                                        onClick={(e) => handleLegalLink(e, "/refund")}
                                        style={{ color: "#3F5142", textDecoration: "underline", fontWeight: 700 }}
                                    >
                                        Kebijakan Pengembalian Dana (/refund)
                                    </a>
                                </li>
                                <li>
                                    <a href="#faq" style={{ color: "#4A584D", textDecoration: "none", fontWeight: 600 }}>
                                        Informasi Pengiriman Produk Digital
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* Col 4: Kontak & Layanan Pelanggan Resmi */}
                        <div>
                            <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                                Layanan Pelanggan Resmi
                            </div>
                            <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#4A584D" }}>
                                <div>
                                    <strong style={{ color: "#1F2922" }}>Email Resmi:</strong><br />
                                    <a href="mailto:halo@keluargaberkembang.com" style={{ color: "#3F5142", fontWeight: 700, textDecoration: "underline" }}>
                                        halo@keluargaberkembang.com
                                    </a>
                                </div>
                                <div>
                                    <strong style={{ color: "#1F2922" }}>Bantuan Teknis & Klaim Refund:</strong><br />
                                    <a href="mailto:support@keluargaberkembang.com" style={{ color: "#3F5142", fontWeight: 700, textDecoration: "underline" }}>
                                        support@keluargaberkembang.com
                                    </a>
                                </div>
                                <div>
                                    <strong style={{ color: "#1F2922" }}>Telegram Resmi (24 Jam):</strong><br />
                                    <a href="https://t.me/KaraAutoBot" target="_blank" rel="noopener noreferrer" style={{ color: "#3F5142", fontWeight: 700, textDecoration: "underline" }}>
                                        @KaraAutoBot
                                    </a>
                                    {" · "}
                                    <a href="https://t.me/keluargaberkembang" target="_blank" rel="noopener noreferrer" style={{ color: "#3F5142", fontWeight: 700, textDecoration: "underline" }}>
                                        @keluargaberkembang
                                    </a>
                                </div>
                                <div style={{ fontSize: 12, color: "#4A584D", marginTop: 4 }}>
                                    Jam Dukungan Admin: Senin s/d Minggu, 08.00 - 21.00 WIB
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        paddingTop: 24,
                        borderTop: "1px solid #D5CCB8",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        fontSize: 13,
                        color: "#4A584D",
                    }}>
                        <div>
                            © {new Date().getFullYear()} <strong>Keluarga Berkembang</strong>. Seluruh hak cipta dilindungi undang-undang.
                        </div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontWeight: 600 }}>
                            <a href="/tos" onClick={(e) => handleLegalLink(e, "/tos")} style={{ color: "#4A584D", textDecoration: "none" }}>Syarat Layanan</a>
                            <a href="/privacy" onClick={(e) => handleLegalLink(e, "/privacy")} style={{ color: "#4A584D", textDecoration: "none" }}>Kebijakan Privasi</a>
                            <a href="/refund" onClick={(e) => handleLegalLink(e, "/refund")} style={{ color: "#4A584D", textDecoration: "none" }}>Kebijakan Refund</a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ═══ LIGHTBOX MODAL FOR SCREENSHOTS ═══ */}
            {lightboxShot && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={lightboxShot.label}
                    onClick={() => setLightboxShot(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(31, 41, 34, 0.82)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 20,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#FFFDF9",
                            border: "1px solid #D5CCB8",
                            borderRadius: 20,
                            maxWidth: 1060,
                            width: "100%",
                            maxHeight: "92vh",
                            overflowY: "auto",
                            padding: 20,
                            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
                        }}
                    >
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 14,
                            paddingBottom: 12,
                            borderBottom: "1px solid #E5DEC9",
                        }}>
                            <div>
                                <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 18, fontWeight: 600, color: "#1F2922" }}>
                                    {lightboxShot.label}
                                </div>
                                <div style={{ fontSize: 13, color: "#4A584D" }}>
                                    {lightboxShot.caption}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLightboxShot(null)}
                                aria-label="Tutup pratinjau gambar"
                                style={{
                                    minHeight: 44,
                                    padding: "8px 16px",
                                    borderRadius: 10,
                                    border: "1px solid #D5CCB8",
                                    background: "#F7F3EB",
                                    color: "#1F2922",
                                    fontFamily: "'Fredoka', sans-serif",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                ✕ Tutup (Esc)
                            </button>
                        </div>
                        <div style={{ textAlign: "center", background: "#F7F3EB", borderRadius: 12, padding: 12 }}>
                            <img
                                src={lightboxShot.src}
                                alt={lightboxShot.label}
                                style={{ maxWidth: "100%", maxHeight: "74vh", height: "auto", borderRadius: 8 }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ STOREFRONT ORDER / CHECKOUT MODAL (DUITKU KYC READY) ═══ */}
            <Modal open={!!selectedProduct} onClose={closeOrderModal}>
                {({ isDesktop }) => selectedProduct && (
                    <div style={{
                        background: "#FFFDF9",
                        border: "1px solid #D5CCB8",
                        borderRadius: isDesktop ? 24 : "24px 24px 0 0",
                        padding: isDesktop ? "32px 32px 28px" : "24px 20px 28px",
                        maxHeight: "92vh",
                        overflowY: "auto",
                        color: "#1F2922",
                        position: "relative",
                    }}>
                        <button
                            type="button"
                            onClick={closeOrderModal}
                            aria-label="Tutup formulir pemesanan"
                            style={{
                                position: "absolute",
                                top: 14,
                                right: 14,
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                border: "1px solid #D5CCB8",
                                background: "#F7F3EB",
                                color: "#1F2922",
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            ✕
                        </button>

                        {!orderInvoice ? (
                            <form onSubmit={handleOrderSubmit} noValidate>
                                <div style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: 99,
                                    background: "#E6EFE8",
                                    color: "#2E3D30",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    marginBottom: 8,
                                }}>
                                    Formulir Pemesanan Produk Digital
                                </div>
                                <h2 style={{ fontSize: 22, marginBottom: 6, paddingRight: 40 }}>
                                    {selectedProduct.name}
                                </h2>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                                    {(selectedSubOption?.originalPriceDisplay || selectedProduct.originalPriceDisplay) && (
                                        <span className="kb-mono" style={{ fontSize: 15, color: "#847D70", textDecoration: "line-through", fontWeight: 600 }}>
                                            {selectedSubOption ? selectedSubOption.originalPriceDisplay : selectedProduct.originalPriceDisplay}
                                        </span>
                                    )}
                                    <span className="kb-mono" style={{ fontSize: 22, fontWeight: 700, color: "#9E472D" }}>
                                        {selectedSubOption ? selectedSubOption.priceDisplay : selectedProduct.priceDisplay}
                                    </span>
                                    {(selectedSubOption?.discountBadge || selectedProduct.discountBadge) && (
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: "3px 8px",
                                            borderRadius: 99,
                                            background: "#2E3D30",
                                            color: "#FFFDF9",
                                            textTransform: "uppercase",
                                        }}>
                                            {selectedSubOption ? selectedSubOption.discountBadge : selectedProduct.discountBadge}
                                        </span>
                                    )}
                                </div>

                                {/* Sub-option selector if product has durations/variants */}
                                {selectedProduct.subOptions && (
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4A584D", textTransform: "uppercase", marginBottom: 8 }}>
                                            Pilih Paket / Durasi Layanan
                                        </label>
                                        <div style={{ display: "grid", gap: 8 }}>
                                            {selectedProduct.subOptions.map((opt) => {
                                                const active = selectedSubOption && selectedSubOption.id === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setSelectedSubOption(opt)}
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            gap: 12,
                                                            padding: "12px 14px",
                                                            minHeight: 46,
                                                            borderRadius: 12,
                                                            border: active ? "2px solid #3F5142" : "1px solid #D5CCB8",
                                                            background: active ? "#E6EFE8" : "#F7F3EB",
                                                            color: "#1F2922",
                                                            cursor: "pointer",
                                                            textAlign: "left",
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        <span>{opt.label}</span>
                                                        <span className="kb-mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                            {opt.originalPriceDisplay && (
                                                                <span style={{ color: "#847D70", textDecoration: "line-through", fontSize: 11.5, fontWeight: 500 }}>
                                                                    {opt.originalPriceDisplay}
                                                                </span>
                                                            )}
                                                            <span style={{ color: "#2E3D30" }}>{opt.priceDisplay}</span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Buyer Name */}
                                <div style={{ marginBottom: 14 }}>
                                    <label htmlFor="order-name" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4A584D", textTransform: "uppercase", marginBottom: 6 }}>
                                        Nama Lengkap Penerima
                                    </label>
                                    <input
                                        id="order-name"
                                        type="text"
                                        placeholder="Contoh: Budi Santoso"
                                        value={orderForm.buyerName}
                                        onChange={(e) => setOrderForm((p) => ({ ...p, buyerName: e.target.value }))}
                                        style={{
                                            width: "100%",
                                            padding: "12px 14px",
                                            minHeight: 46,
                                            borderRadius: 10,
                                            border: `1px solid ${orderErrors.buyerName ? "#B83B2A" : "#D5CCB8"}`,
                                            background: "#F7F3EB",
                                            color: "#1F2922",
                                            fontSize: 14,
                                        }}
                                    />
                                    {orderErrors.buyerName && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 4 }}>
                                            {orderErrors.buyerName}
                                        </div>
                                    )}
                                </div>

                                {/* Buyer Email */}
                                <div style={{ marginBottom: 14 }}>
                                    <label htmlFor="order-email" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4A584D", textTransform: "uppercase", marginBottom: 6 }}>
                                        Alamat Email Pengiriman Produk Digital
                                    </label>
                                    <input
                                        id="order-email"
                                        type="email"
                                        placeholder="nama@email.com"
                                        value={orderForm.buyerEmail}
                                        onChange={(e) => setOrderForm((p) => ({ ...p, buyerEmail: e.target.value }))}
                                        style={{
                                            width: "100%",
                                            padding: "12px 14px",
                                            minHeight: 46,
                                            borderRadius: 10,
                                            border: `1px solid ${orderErrors.buyerEmail ? "#B83B2A" : "#D5CCB8"}`,
                                            background: "#F7F3EB",
                                            color: "#1F2922",
                                            fontSize: 14,
                                        }}
                                    />
                                    {orderErrors.buyerEmail && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 4 }}>
                                            {orderErrors.buyerEmail}
                                        </div>
                                    )}
                                </div>

                                {/* Buyer WhatsApp / Telegram */}
                                <div style={{ marginBottom: 14 }}>
                                    <label htmlFor="order-contact" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4A584D", textTransform: "uppercase", marginBottom: 6 }}>
                                        Nomor WhatsApp / Username Telegram
                                    </label>
                                    <input
                                        id="order-contact"
                                        type="text"
                                        placeholder="Contoh: 08123456789 atau @username"
                                        value={orderForm.buyerContact}
                                        onChange={(e) => setOrderForm((p) => ({ ...p, buyerContact: e.target.value }))}
                                        style={{
                                            width: "100%",
                                            padding: "12px 14px",
                                            minHeight: 46,
                                            borderRadius: 10,
                                            border: `1px solid ${orderErrors.buyerContact ? "#B83B2A" : "#D5CCB8"}`,
                                            background: "#F7F3EB",
                                            color: "#1F2922",
                                            fontSize: 14,
                                        }}
                                    />
                                    {orderErrors.buyerContact && (
                                        <div style={{ fontSize: 12, color: "#B83B2A", fontWeight: 600, marginTop: 4 }}>
                                            {orderErrors.buyerContact}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Method */}
                                <div style={{ marginBottom: 18 }}>
                                    <label htmlFor="order-payment" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#4A584D", textTransform: "uppercase", marginBottom: 6 }}>
                                        Metode Pembayaran Resmi (IDR)
                                    </label>
                                    <select
                                        id="order-payment"
                                        value={orderForm.paymentMethod}
                                        onChange={(e) => setOrderForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                                        style={{
                                            width: "100%",
                                            padding: "12px 14px",
                                            minHeight: 46,
                                            borderRadius: 10,
                                            border: "1px solid #D5CCB8",
                                            background: "#F7F3EB",
                                            color: "#1F2922",
                                            fontSize: 14,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <option value="QRIS">QRIS Instan (Semua Bank & Dompet Digital)</option>
                                        <option value="VA_BCA">Virtual Account BCA</option>
                                        <option value="VA_MANDIRI">Virtual Account Bank Mandiri</option>
                                        <option value="VA_BRI">Virtual Account BRI</option>
                                        <option value="VA_BNI">Virtual Account BNI</option>
                                    </select>
                                </div>

                                <div style={{
                                    background: "#F7F3EB",
                                    border: "1px solid #E5DEC9",
                                    borderRadius: 12,
                                    padding: "10px 14px",
                                    fontSize: 12,
                                    color: "#4A584D",
                                    marginBottom: 18,
                                }}>
                                    Dengan melanjutkan pemesanan, Anda menyetujui{" "}
                                    <a href="/tos" onClick={(e) => { closeOrderModal(); handleLegalLink(e, "/tos"); }} style={{ color: "#3F5142", fontWeight: 700 }}>Syarat Layanan</a>{" "}
                                    dan{" "}
                                    <a href="/refund" onClick={(e) => { closeOrderModal(); handleLegalLink(e, "/refund"); }} style={{ color: "#3F5142", fontWeight: 700 }}>Kebijakan Pengembalian Dana</a>.
                                </div>

                                <button
                                    type="submit"
                                    disabled={orderSubmitting}
                                    className="kb-btn-primary"
                                    style={{ width: "100%" }}
                                >
                                    {orderSubmitting ? "Membuat Ringkasan Pesanan..." : "Buat Ringkasan Pesanan & Instruksi Bayar"}
                                </button>
                            </form>
                        ) : (
                            <div>
                                <div style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: 99,
                                    background: "#E6EFE8",
                                    color: "#2E3D30",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    marginBottom: 8,
                                }}>
                                    ✓ RINGKASAN PESANAN TERCATAT
                                </div>
                                <h2 style={{ fontSize: 22, marginBottom: 4 }}>
                                    Nomor Pesanan: <span className="kb-mono">{orderInvoice.invoiceId}</span>
                                </h2>
                                <p style={{ fontSize: 13, color: "#4A584D", marginBottom: 16 }}>
                                    Dibuat pada {orderInvoice.createdAt}
                                </p>

                                <div style={{
                                    background: "#F7F3EB",
                                    border: "1px solid #E5DEC9",
                                    borderRadius: 14,
                                    padding: "16px 18px",
                                    marginBottom: 18,
                                    fontSize: 13,
                                    display: "grid",
                                    gap: 8,
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ color: "#4A584D" }}>Produk:</span>
                                        <strong style={{ textAlign: "right" }}>{orderInvoice.itemName}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ color: "#4A584D" }}>Total Tagihan:</span>
                                        <strong className="kb-mono" style={{ color: "#9E472D", fontSize: 16 }}>{orderInvoice.priceDisplay}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ color: "#4A584D" }}>Metode Bayar:</span>
                                        <strong>{orderInvoice.paymentMethod}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ color: "#4A584D" }}>Penerima:</span>
                                        <strong>{orderInvoice.buyerName} ({orderInvoice.buyerEmail})</strong>
                                    </div>
                                </div>

                                <div style={{
                                    background: "#FAF1E2",
                                    border: "1px solid #E5D4B8",
                                    borderRadius: 12,
                                    padding: "12px 14px",
                                    fontSize: 13,
                                    color: "#7A4710",
                                    marginBottom: 18,
                                }}>
                                    <strong>Pengiriman Otomatis:</strong> {orderInvoice.deliveryMethod}
                                </div>

                                <div style={{ display: "grid", gap: 10 }}>
                                    <a
                                        href={`https://t.me/KaraAutoBot?start=${encodeURIComponent(orderInvoice.invoiceId)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="kb-btn-primary"
                                        style={{ width: "100%", textAlign: "center" }}
                                    >
                                        Lanjutkan Pembayaran Otomatis via @KaraAutoBot
                                    </a>
                                    <a
                                        href={`mailto:halo@keluargaberkembang.com?subject=${encodeURIComponent(`Pesanan ${orderInvoice.invoiceId} - ${orderInvoice.itemName}`)}&body=${encodeURIComponent(`Halo Tim Keluarga Berkembang,\n\nSaya ingin menyelesaikan pesanan berikut:\nNomor Invoice: ${orderInvoice.invoiceId}\nProduk: ${orderInvoice.itemName}\nNominal: ${orderInvoice.priceDisplay}\nMetode Pembayaran: ${orderInvoice.paymentMethod}\nNama: ${orderInvoice.buyerName}\nEmail: ${orderInvoice.buyerEmail}\nKontak WA/Telegram: ${orderInvoice.buyerContact}\n\nTerima kasih.`)}`}
                                        className="kb-btn-secondary"
                                        style={{ width: "100%", textAlign: "center" }}
                                    >
                                        Kirim Salinan Invoice via Email Resmi
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ═══ AUTH MODALS ═══ */}
            <SignupModal
                open={showSignup}
                onClose={closeSignup}
                form={signupForm}
                setForm={setSignupForm}
                errors={formErrors}
                setErrors={setFormErrors}
                step={formStep}
                setStep={setFormStep}
                onSubmit={handleSignup}
                isLoading={isLoading}
                onSwitchToLogin={() => { closeSignup(); setShowLogin(true); }}
            />
            <LoginModal
                open={showLogin}
                onClose={closeLogin}
                form={loginForm}
                setForm={setLoginForm}
                errors={formErrors}
                onSubmit={handleLogin}
                isLoading={isLoading}
                onSwitchToSignup={() => { closeLogin(); setShowSignup(true); }}
                onForgotPassword={() => { closeLogin(); setShowForgotPassword(true); }}
            />
            <ForgotPasswordModal
                open={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
                onBackToLogin={() => { setShowForgotPassword(false); setShowLogin(true); }}
            />
        </div>
    );
};

export default LandingPage;
