-- 0021: feature flag opsional per household (10-fitur-opsional-keluarga.md §2).
-- Kosong ('{}') berarti semua fitur mati; aplikasi/API mengisi default di layer TS (HouseholdFeaturesSchema),
-- bukan di sini, supaya menambah fitur baru tidak butuh migrasi ALTER ulang untuk nilai default-nya.

alter table households add column features jsonb not null default '{}'::jsonb;

comment on column households.features is
  'Toggle fitur opsional "kelola keluarga" per household (10-fitur-opsional-keluarga.md §2). '
  'Kosong = semua mati. Bentuk divalidasi di packages/shared/src/schemas/household.ts (HouseholdFeaturesSchema), '
  'bukan di DB — kolom ini sengaja jsonb bebas supaya menambah fitur baru tidak perlu migrasi skema.';
