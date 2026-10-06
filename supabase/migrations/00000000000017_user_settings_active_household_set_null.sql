-- Bug ditemukan saat verifikasi manual DELETE /v1/me: user_settings.active_household_id punya FK
-- ke households TANPA on delete cascade/set null (default NO ACTION), jadi menghapus household
-- (deleteMyAccount / households_delete policy) selalu gagal 23503 kalau user itu sedang menjadikan
-- household itu active_household_id-nya sendiri — yang SELALU terjadi tepat setelah onboarding
-- (create_household mengisi active_household_id = household baru). Ganti jadi ON DELETE SET NULL:
-- kehilangan household aktif bukan error, cukup null-kan preferensinya; HouseholdProvider.jsx
-- sudah menangani active_household_id null dengan fallback ke membership pertama yang tersisa.
alter table user_settings drop constraint user_settings_active_household_id_fkey;
alter table user_settings add constraint user_settings_active_household_id_fkey
  foreign key (active_household_id) references households(id) on delete set null;
