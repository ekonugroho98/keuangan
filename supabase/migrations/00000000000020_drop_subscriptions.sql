-- Fase 6: fitur subscription/payment/Midtrans DIBATALKAN TOTAL atas instruksi pemilik produk
-- (2026-10-06) — project ini tidak pernah punya pembayaran sungguhan. Lihat
-- docs/spec/PROGRESS.md § "Pembatalan total subscription/Midtrans" untuk konteks lengkap.
--
-- `subscriptions` dibuat di migrasi 00000000000003_domain_tables.sql (Fase 2, sudah lama live di
-- produksi) — migrasi itu SENGAJA tidak diubah (prinsip: jangan tulis ulang migrasi yang sudah
-- diterapkan). `upsert_subscription` sempat dibuat di migrasi 00000000000020_subscriptions_upsert.sql
-- yang sudah dihapus dari folder ini (belum pernah jadi bagian riwayat git yang di-commit). Memakai
-- IF EXISTS di semua langkah supaya aman dijalankan baik di DB yang baru di-reset (fungsi lama tidak
-- pernah ada) maupun di produksi (fungsi lama memang ada).

drop function if exists upsert_subscription(uuid, text, timestamptz, text);
-- DROP TABLE membawa serta policy (subscriptions_select) dan index-nya; tidak perlu DROP POLICY
-- terpisah (yang justru akan error "relation does not exist" kalau dijalankan saat tabel tak ada).
drop table if exists subscriptions;
