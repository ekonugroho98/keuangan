import { useState, useEffect } from "react";

const TABS = [
    { id: "tos", path: "/tos", label: "Syarat & Ketentuan Layanan" },
    { id: "privacy", path: "/privacy", label: "Kebijakan Privasi" },
    { id: "refund", path: "/refund", label: "Kebijakan Pengembalian Dana (Refund)" },
];

export default function LegalPage({ initialTab = "tos", onNavigate }) {
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [initialTab]);

    const handleTabChange = (tab) => {
        setActiveTab(tab.id);
        if (onNavigate) {
            onNavigate(tab.path);
        } else {
            window.history.pushState({}, "", tab.path);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const goHome = (e) => {
        e.preventDefault();
        if (onNavigate) {
            onNavigate("/");
        } else {
            window.location.href = "/";
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "#FFFDF9",
            color: "#1F2922",
            fontFamily: "'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif",
            lineHeight: 1.65,
        }}>
            {/* Top Bar */}
            <header style={{
                position: "sticky",
                top: 0,
                zIndex: 50,
                background: "rgba(255, 253, 249, 0.94)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderBottom: "1px solid #E5DEC9",
            }}>
                <div style={{
                    maxWidth: 1120,
                    margin: "0 auto",
                    padding: "14px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                }}>
                    <a
                        href="/"
                        onClick={goHome}
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
                            width={38}
                            height={38}
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                objectFit: "cover",
                                border: "1px solid #E5DEC9",
                                background: "#FFFDF9",
                            }}
                        />
                        <div>
                            <div style={{
                                fontFamily: "'Fredoka', sans-serif",
                                fontWeight: 600,
                                fontSize: 18,
                                color: "#1F2922",
                                lineHeight: 1.15,
                            }}>Keluarga Berkembang</div>
                            <div style={{ fontSize: 12, color: "#4A584D", fontWeight: 600 }}>
                                Dokumen Resmi & Ketentuan Layanan
                            </div>
                        </div>
                    </a>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <a
                            href="/"
                            onClick={goHome}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "10px 18px",
                                minHeight: 44,
                                borderRadius: 10,
                                border: "1px solid #D5CCB8",
                                background: "#F7F3EB",
                                color: "#1F2922",
                                textDecoration: "none",
                                fontSize: 14,
                                fontWeight: 700,
                            }}
                        >
                            Kembali ke Beranda
                        </a>
                        <a
                            href="https://kelola.keluargaberkembang.com"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "10px 18px",
                                minHeight: 44,
                                borderRadius: 10,
                                background: "#3F5142",
                                color: "#FFFDF9",
                                textDecoration: "none",
                                fontSize: 14,
                                fontWeight: 700,
                                fontFamily: "'Fredoka', sans-serif",
                            }}
                        >
                            Buka Aplikasi Web
                        </a>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px 80px" }}>
                {/* Header Section */}
                <div style={{
                    background: "#F7F3EB",
                    border: "1px solid #E5DEC9",
                    borderRadius: 20,
                    padding: "28px 28px",
                    marginBottom: 28,
                }}>
                    <div style={{
                        display: "inline-block",
                        padding: "5px 12px",
                        borderRadius: 99,
                        background: "#E6EFE8",
                        color: "#2E3D30",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        marginBottom: 12,
                    }}>
                        Informasi Legal & Kepatuhan Transaksi Digital
                    </div>
                    <h1 style={{
                        fontFamily: "'Fredoka', sans-serif",
                        fontSize: "clamp(26px, 4vw, 36px)",
                        color: "#1F2922",
                        lineHeight: 1.15,
                        marginBottom: 10,
                    }}>
                        Ketentuan Layanan, Privasi, & Pengembalian Dana
                    </h1>
                    <p style={{ fontSize: 15, color: "#4A584D", maxWidth: "65ch", margin: 0 }}>
                        Dokumen ini mengatur hak, kewajiban, perlindungan privasi data rumah tangga, alur pengiriman produk digital, serta jaminan pengembalian dana pada seluruh ekosistem <strong>Keluarga Berkembang</strong> (<code>keluargaberkembang.com</code> dan <code>kelola.keluargaberkembang.com</code>).
                    </p>
                    <div style={{
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop: "1px solid #E5DEC9",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 20,
                        fontSize: 13,
                        color: "#4A584D",
                        fontWeight: 600,
                    }}>
                        <span>Pembaruan Terakhir: 20 Oktober 2026</span>
                        <span>Berlaku untuk: Seluruh Pengguna & Pembeli Produk Digital</span>
                        <span>Mata Uang Transaksi: Rupiah (IDR / Rp)</span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <nav
                    aria-label="Navigasi dokumen legal"
                    style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 32,
                        borderBottom: "1px solid #E5DEC9",
                        paddingBottom: 16,
                    }}
                >
                    {TABS.map((t) => {
                        const isActive = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleTabChange(t)}
                                style={{
                                    padding: "12px 20px",
                                    minHeight: 44,
                                    borderRadius: 12,
                                    border: isActive ? "1px solid #2E3D30" : "1px solid #D5CCB8",
                                    background: isActive ? "#3F5142" : "#F7F3EB",
                                    color: isActive ? "#FFFDF9" : "#1F2922",
                                    fontFamily: "'Fredoka', sans-serif",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Tab 1: Syarat & Ketentuan (/tos) */}
                {activeTab === "tos" && (
                    <article style={{
                        background: "#FFFDF9",
                        border: "1px solid #E5DEC9",
                        borderRadius: 20,
                        padding: "32px 28px",
                        boxShadow: "0 10px 30px -15px rgba(31, 41, 34, 0.06)",
                    }}>
                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 24, color: "#1F2922", marginBottom: 16 }}>
                            1. Ruang Lingkup Layanan Keluarga Berkembang
                        </h2>
                        <p style={{ fontSize: 15, color: "#1F2922", marginBottom: 16, maxWidth: "68ch" }}>
                            <strong>Keluarga Berkembang</strong> adalah platform teknologi dan penerbit produk edukasi digital yang menyediakan perangkat lunak pengelolaan keuangan rumah tangga, manajemen stok kebutuhan dapur, pembanding harga minimarket, serta layanan asisten AI keluarga berbasis pesan instan.
                        </p>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 24, maxWidth: "68ch" }}>
                            Dengan mengakses situs <code>https://keluargaberkembang.com</code>, menggunakan aplikasi web di <code>https://kelola.keluargaberkembang.com</code>, atau membeli produk digital kami, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh Syarat dan Ketentuan Layanan ini.
                        </p>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 14 }}>
                            2. Katalog Produk Digital & Harga Resmi (Rupiah / IDR)
                        </h2>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 16, maxWidth: "68ch" }}>
                            Seluruh produk dan layanan yang ditawarkan di Keluarga Berkembang merupakan produk digital dan layanan perangkat lunak (SaaS) dengan rincian harga resmi dalam mata uang Rupiah (Rp) sebagai berikut:
                        </p>

                        <div style={{
                            overflowX: "auto",
                            marginBottom: 28,
                            border: "1px solid #E5DEC9",
                            borderRadius: 14,
                        }}>
                            <table style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 14,
                                textAlign: "left",
                            }}>
                                <thead>
                                    <tr style={{ background: "#F7F3EB", borderBottom: "1px solid #E5DEC9" }}>
                                        <th style={{ padding: "14px 16px", fontWeight: 700, color: "#1F2922" }}>Nama Produk / Layanan</th>
                                        <th style={{ padding: "14px 16px", fontWeight: 700, color: "#1F2922" }}>Jenis & Durasi</th>
                                        <th style={{ padding: "14px 16px", fontWeight: 700, color: "#1F2922" }}>Harga Resmi (IDR)</th>
                                        <th style={{ padding: "14px 16px", fontWeight: 700, color: "#1F2922" }}>Metode Pengiriman</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: "1px solid #E5DEC9" }}>
                                        <td style={{ padding: "14px 16px", fontWeight: 700 }}>Aplikasi Web & Android Keluarga Berkembang</td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Akses Web App & APK Mandiri</td>
                                        <td style={{ padding: "14px 16px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#2E3D30" }}>Rp 0 (Akses Dasar)</td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Akses langsung via <code>kelola.keluargaberkembang.com</code></td>
                                    </tr>
                                    <tr style={{ borderBottom: "1px solid #E5DEC9", background: "#FCF9F2" }}>
                                        <td style={{ padding: "14px 16px", fontWeight: 700 }}>Ebook Panduan Mandiri Step-by-Step + Source Code</td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Sekali Bayar (Akses Selamanya)</td>
                                        <td style={{ padding: "14px 16px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#9E472D" }}>Rp 99.000</td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Tautan unduhan PDF/HTML interaktif (37 layar) & paket kode sumber dikirim instan ke email/Telegram</td>
                                    </tr>
                                    <tr style={{ borderBottom: "1px solid #E5DEC9" }}>
                                        <td style={{ padding: "14px 16px", fontWeight: 700 }}>Sewa Workspace Asisten AI Keluarga Siap Pakai</td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Langganan Harian / Mingguan / Bulanan</td>
                                        <td style={{ padding: "14px 16px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#2E3D30" }}>
                                            Rp 10.000 / hari<br />
                                            Rp 49.000 / 7 hari<br />
                                            Rp 149.000 / 30 hari
                                        </td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Aktivasi container otomatis dalam 3 menit via bot resmi <code>@KaraAutoBot</code></td>
                                    </tr>
                                    <tr style={{ background: "#FCF9F2" }}>
                                        <td style={{ padding: "14px 16px", fontWeight: 700 }}>Bundel VIP: Ebook + Voucher Kuota Token AI & Bimbingan Privat 14 Hari</td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Paket Lengkap + Pendampingan 14 Hari</td>
                                        <td style={{ padding: "14px 16px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#9E472D" }}>
                                            Rp 599.000<br />
                                            <span style={{ fontSize: 12, color: "#4A584D", fontWeight: 500 }}>(Upgrade dari Ebook: Rp 500.000)</span>
                                        </td>
                                        <td style={{ padding: "14px 16px", color: "#4A584D" }}>Unduhan Ebook instan + Kode Voucher Token AI + Undangan sesi bimbingan privat</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            3. Mekanisme Pembayaran & Pengiriman Produk Digital Otomatis
                        </h2>
                        <ul style={{ paddingLeft: 20, marginBottom: 24, color: "#1F2922", fontSize: 15 }}>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Saluran Pembayaran Resmi:</strong> Seluruh transaksi diproses dalam mata uang Rupiah (IDR) menggunakan gerbang pembayaran (Payment Gateway) resmi berlisensi di Indonesia melalui metode <strong>QRIS</strong> (mendukung seluruh aplikasi perbankan dan dompet digital) serta <strong>Virtual Account Bank Nasional</strong>.
                            </li>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Verifikasi Otomatis (Real-Time):</strong> Sistem kami menerima notifikasi pembayaran (callback) secara otomatis begitu dana terkonfirmasi oleh gerbang pembayaran tanpa perlu mengirimkan bukti transfer manual.
                            </li>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Waktu Pengiriman (SLA Pemenuhan Pesanan):</strong> Untuk pembelian Ebook dan Voucher Kuota Token AI, tautan unduhan dan kode lisensi dikirimkan seketika (kurang dari 1 menit) ke alamat email dan/atau akun Telegram pembeli. Untuk layanan Sewa Workspace Asisten AI, container pribadi menyala dan siap ditautkan ke Telegram atau Grup WhatsApp keluarga dalam waktu maksimal 3 menit.
                            </li>
                        </ul>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            4. Hak Kekayaan Intelektual & Lisensi Penggunaan
                        </h2>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 16, maxWidth: "68ch" }}>
                            Pembelian Ebook Panduan Mandiri dan paket kode sumber memberikan <strong>Lisensi Penggunaan Pribadi & Keluarga (Personal/Household License)</strong> kepada pembeli. Pembeli berhak memodifikasi dan menjalankan kode sumber untuk keperluan rumah tangga sendiri. Pembeli dilarang memperjualbelikan ulang file Ebook atau mendistribusikan ulang materi panduan secara komersial tanpa izin tertulis dari Keluarga Berkembang.
                        </p>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            5. Aturan Penggunaan Layanan Asisten AI & Web App
                        </h2>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 0, maxWidth: "68ch" }}>
                            Pengguna wajib menjaga kerahasiaan kata sandi akun dan kode akses workspace masing-masing. Layanan Asisten AI Keluarga hanya boleh digunakan untuk keperluan produktivitas rumah tangga yang sah menurut hukum Republik Indonesia dan dilarang keras digunakan untuk pengiriman pesan spam, penipuan, atau aktivitas melanggar hukum.
                        </p>
                    </article>
                )}

                {/* Tab 2: Kebijakan Privasi (/privacy) */}
                {activeTab === "privacy" && (
                    <article style={{
                        background: "#FFFDF9",
                        border: "1px solid #E5DEC9",
                        borderRadius: 20,
                        padding: "32px 28px",
                        boxShadow: "0 10px 30px -15px rgba(31, 41, 34, 0.06)",
                    }}>
                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 24, color: "#1F2922", marginBottom: 16 }}>
                            1. Komitmen Perlindungan Privasi Data Rumah Tangga
                        </h2>
                        <p style={{ fontSize: 15, color: "#1F2922", marginBottom: 16, maxWidth: "68ch" }}>
                            Kami memahami bahwa catatan keuangan suami-istri, daftar belanja, dan percakapan di dalam grup keluarga adalah informasi yang sangat pribadi. <strong>Keluarga Berkembang</strong> merancang arsitektur basis data dengan prinsip isolasi rumah tangga (<em>Household Data Isolation</em>) dan pemisahan privasi akun secara ketat.
                        </p>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            2. Data yang Kami Kumpulkan
                        </h2>
                        <ul style={{ paddingLeft: 20, marginBottom: 24, color: "#1F2922", fontSize: 15 }}>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Data Identitas Akun:</strong> Nama panggilan/lengkap, alamat email, dan kata sandi yang disimpan dalam bentuk terenkripsi (hashed) melalui sistem autentikasi aman.
                            </li>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Data Pencatatan Rumah Tangga:</strong> Catatan pemasukan, pengeluaran, anggaran bulanan, daftar belanja, perbandingan harga toko, dan stok barang dapur yang Anda masukkan melalui aplikasi web atau asisten bot.
                            </li>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Data Transaksi Pembelian:</strong> Riwayat pembelian paket produk digital, status pembayaran dari gerbang pembayaran resmi, dan alamat pengiriman produk digital (email atau ID Telegram). Kami tidak menyimpan nomor kartu kredit/debit atau PIN perbankan Anda.
                            </li>
                        </ul>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            3. Pemisahan Rekening Privat vs Bersama
                        </h2>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 24, maxWidth: "68ch" }}>
                            Di dalam aplikasi <code>kelola.keluargaberkembang.com</code>, setiap rekening atau dompet yang diberi label <strong>Privat</strong> hanya dapat dilihat rincian saldonya oleh pemilik akun tersebut. Anggota keluarga lain di dalam rumah tangga yang sama hanya dapat melihat rincian transaksi pada rekening yang secara eksplisit diatur sebagai <strong>Bersama (Shared)</strong>.
                        </p>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            4. Penggunaan & Penyimpanan Data
                        </h2>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 16, maxWidth: "68ch" }}>
                            Data yang dikumpulkan semata-mata digunakan untuk menampilkan laporan keuangan keluarga Anda, mengekspor laporan Excel (.xlsx), dan memproses pencatatan otomatis melalui asisten AI keluarga. <strong>Keluarga Berkembang tidak pernah menjual, menyewakan, atau mempertukarkan data keuangan keluarga Anda kepada pengiklan maupun pihak ketiga mana pun.</strong>
                        </p>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            5. Hak Ekspor & Penghapusan Data Permanen
                        </h2>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 0, maxWidth: "68ch" }}>
                            Anda memiliki kendali penuh atas data Anda. Kapan saja, Anda dapat mengunduh seluruh riwayat transaksi rumah tangga ke dalam format lembar kerja Excel (<code>.xlsx</code>) atau meminta penghapusan akun beserta seluruh data rumah tangga secara permanen melalui menu pengaturan aplikasi atau dengan menghubungi <code>support@keluargaberkembang.com</code>.
                        </p>
                    </article>
                )}

                {/* Tab 3: Kebijakan Pengembalian Dana / Refund (/refund) */}
                {activeTab === "refund" && (
                    <article style={{
                        background: "#FFFDF9",
                        border: "1px solid #E5DEC9",
                        borderRadius: 20,
                        padding: "32px 28px",
                        boxShadow: "0 10px 30px -15px rgba(31, 41, 34, 0.06)",
                    }}>
                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 24, color: "#1F2922", marginBottom: 16 }}>
                            1. Jaminan Kepuasan & Kebijakan Pengembalian Dana (Refund Policy)
                        </h2>
                        <p style={{ fontSize: 15, color: "#1F2922", marginBottom: 20, maxWidth: "68ch" }}>
                            <strong>Keluarga Berkembang</strong> berkomitmen memberikan layanan perangkat lunak dan produk digital yang berfungsi sesuai deskripsi. Kebijakan pengembalian dana ini disusun secara transparan untuk melindungi hak konsumen dan memenuhi standar verifikasi transaksi elektronik.
                        </p>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            2. Kondisi yang Berhak Mendapatkan Pengembalian Dana 100%
                        </h2>
                        <ul style={{ paddingLeft: 20, marginBottom: 24, color: "#1F2922", fontSize: 15 }}>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Kegagalan Pengiriman Produk Digital:</strong> Apabila pembeli telah menyelesaikan pembayaran dan dana telah terpotong, namun tautan unduhan Ebook, kode voucher, atau akses layanan tidak terkirim dan tim dukungan kami gagal mengirimkannya dalam waktu maksimal 1x24 jam sejak laporan diterima.
                            </li>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Pembayaran Ganda (Double Charge):</strong> Apabila terjadi pemotongan saldo lebih dari satu kali untuk satu pesanan produk yang sama akibat gangguan teknis jaringan pembayaran. Kelebihan dana akan dikembalikan 100% secara utuh.
                            </li>
                            <li style={{ marginBottom: 10 }}>
                                <strong>Kendala Teknis Layanan Sewa Workspace AI:</strong> Apabila container Workspace Asisten AI yang disewa mengalami kegagalan sistem (gagal menyala atau tidak dapat terhubung) dan tim teknis kami tidak dapat memperbaikinya dalam waktu 1x24 jam, pelanggan berhak memilih pengembalian dana penuh (100%) atau penggantian masa aktif layanan.
                            </li>
                        </ul>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            3. Ketentuan Khusus Produk Unduhan (Ebook & Source Code)
                        </h2>
                        <p style={{ fontSize: 15, color: "#4A584D", marginBottom: 24, maxWidth: "68ch" }}>
                            Mengingat sifat produk <strong>Ebook Panduan Mandiri + Source Code</strong> yang berupa file digital tanpa proteksi penguncian (DRM-free) yang langsung dapat diunduh dan disimpan oleh pembeli, permohonan pengembalian dana karena alasan berubah pikiran setelah file berhasil diunduh tidak dapat diproses. Namun, jika pembeli mengalami kesulitan saat mempraktikkan panduan, pembeli berhak mendapatkan bantuan teknis melalui saluran dukungan resmi kami atau melakukan peningkatan (upgrade) ke paket Bimbingan Privat dengan cukup membayar selisih harganya.
                        </p>

                        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, color: "#1F2922", marginBottom: 12 }}>
                            4. Prosedur & Waktu Pemrosesan Pengembalian Dana
                        </h2>
                        <ol style={{ paddingLeft: 20, marginBottom: 0, color: "#1F2922", fontSize: 15 }}>
                            <li style={{ marginBottom: 10 }}>
                                Hubungi layanan pelanggan resmi kami melalui email <strong>support@keluargaberkembang.com</strong> atau Telegram <strong>@KaraAutoBot</strong> maksimal <strong>7 (tujuh) hari kalender</strong> sejak tanggal transaksi.
                            </li>
                            <li style={{ marginBottom: 10 }}>
                                Sertakan alamat email transaksi, nomor referensi pembayaran (QRIS / Virtual Account), serta penjelasan kendala yang dialami.
                            </li>
                            <li style={{ marginBottom: 0 }}>
                                Tim kami akan memverifikasi permohonan dalam waktu maksimal 1x24 jam. Pengembalian dana yang disetujui akan ditransfer kembali ke rekening bank atau dompet digital asal pembeli dalam waktu <strong>1 hingga 3 hari kerja</strong> tanpa potongan biaya administrasi.
                            </li>
                        </ol>
                    </article>
                )}

                {/* Official Contact Box (Always Visible for KYC Reviewer) */}
                <section
                    aria-label="Informasi Kontak Resmi dan Layanan Pelanggan"
                    style={{
                        marginTop: 36,
                        background: "#2E3D30",
                        color: "#FFFDF9",
                        borderRadius: 20,
                        padding: "32px 28px",
                    }}
                >
                    <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#D5E3D7",
                        marginBottom: 8,
                    }}>
                        Identitas Penyelenggara & Layanan Pelanggan Resmi
                    </div>
                    <h2 style={{
                        fontFamily: "'Fredoka', sans-serif",
                        fontSize: "clamp(22px, 3vw, 28px)",
                        color: "#FFFDF9",
                        marginBottom: 12,
                    }}>
                        Hubungi Tim Keluarga Berkembang
                    </h2>
                    <p style={{ fontSize: 15, color: "#E6EFE8", maxWidth: "65ch", marginBottom: 24 }}>
                        Jika Anda memiliki pertanyaan mengenai produk digital, membutuhkan bantuan aktivasi Workspace Asisten AI, atau ingin mengajukan klaim pengembalian dana, silakan hubungi saluran resmi kami di bawah ini:
                    </p>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: 16,
                    }}>
                        <div style={{
                            background: "rgba(255, 253, 249, 0.08)",
                            border: "1px solid rgba(255, 253, 249, 0.18)",
                            borderRadius: 14,
                            padding: "18px 20px",
                        }}>
                            <div style={{ fontSize: 12, color: "#D5E3D7", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                                Identitas Brand & Platform
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFFDF9", marginBottom: 4 }}>
                                Keluarga Berkembang
                            </div>
                            <div style={{ fontSize: 13, color: "#E6EFE8" }}>
                                Portal Utama: <code>keluargaberkembang.com</code><br />
                                Aplikasi Web: <code>kelola.keluargaberkembang.com</code>
                            </div>
                        </div>

                        <div style={{
                            background: "rgba(255, 253, 249, 0.08)",
                            border: "1px solid rgba(255, 253, 249, 0.18)",
                            borderRadius: 14,
                            padding: "18px 20px",
                        }}>
                            <div style={{ fontSize: 12, color: "#D5E3D7", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                                Email Layanan Pelanggan
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                                <a href="mailto:halo@keluargaberkembang.com" style={{ color: "#FFFDF9", textDecoration: "underline" }}>
                                    halo@keluargaberkembang.com
                                </a>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                                <a href="mailto:support@keluargaberkembang.com" style={{ color: "#E6EFE8", textDecoration: "underline" }}>
                                    support@keluargaberkembang.com
                                </a>
                            </div>
                        </div>

                        <div style={{
                            background: "rgba(255, 253, 249, 0.08)",
                            border: "1px solid rgba(255, 253, 249, 0.18)",
                            borderRadius: 14,
                            padding: "18px 20px",
                        }}>
                            <div style={{ fontSize: 12, color: "#D5E3D7", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                                Telegram & Jam Operasional
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                                <a href="https://t.me/KaraAutoBot" target="_blank" rel="noopener noreferrer" style={{ color: "#FFFDF9", textDecoration: "underline" }}>
                                    @KaraAutoBot (Layanan 24 Jam)
                                </a>
                            </div>
                            <div style={{ fontSize: 13, color: "#E6EFE8" }}>
                                Dukungan Admin: Senin s/d Minggu (08.00 - 21.00 WIB) via{" "}
                                <a href="https://t.me/keluargaberkembang" target="_blank" rel="noopener noreferrer" style={{ color: "#FFFDF9", textDecoration: "underline" }}>
                                    @keluargaberkembang
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
