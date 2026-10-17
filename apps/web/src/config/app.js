// ── Konfigurasi Nama & Branding Aplikasi ────────────────────────────────────
// Ganti nilai di file .env untuk mengubah nama aplikasi secara global:
//   VITE_APP_NAME=NamaAplikasiKamu
//   VITE_APP_TAGLINE=Tagline Kamu

const rawName = import.meta.env.VITE_APP_NAME;
const rawTagline = import.meta.env.VITE_APP_TAGLINE;

export const APP_NAME =
    !rawName || rawName === "Karaya" || rawName === "Eko Nugroho"
        ? "Keluarga Berkembang"
        : rawName;

export const APP_TAGLINE =
    !rawTagline || rawTagline === "Wealth Ledger" || rawTagline === "Catatan Keuangan Pribadi"
        ? "Berkembang Bersama dalam Kehangatan"
        : rawTagline;

export const APP_AI_NAME = `${APP_NAME} AI`;
