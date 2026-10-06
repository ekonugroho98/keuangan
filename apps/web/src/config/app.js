// ── Konfigurasi Nama & Branding Aplikasi ────────────────────────────────────
// Ganti nilai di file .env untuk mengubah nama aplikasi secara global:
//   VITE_APP_NAME=NamaAplikasiKamu
//   VITE_APP_TAGLINE=Tagline Kamu

export const APP_NAME    = import.meta.env.VITE_APP_NAME    || "Karaya";
export const APP_TAGLINE = import.meta.env.VITE_APP_TAGLINE || "Wealth Ledger";
export const APP_AI_NAME = `${APP_NAME} AI`;
