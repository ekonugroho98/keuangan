#!/usr/bin/env bash
# Gabungkan semua migrasi menjadi satu file supabase/setup.sql untuk ditempel di SQL Editor Supabase.
# Jalankan ulang setiap kali ada migrasi baru: bash scripts/gen-setup-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."
out=supabase/setup.sql
{
  echo "-- Karaya Finance: skema database lengkap (gabungan semua file supabase/migrations)."
  echo "-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> tempel SELURUH isi file ini -> Run."
  echo "-- Hanya untuk project BARU yang masih kosong. Jangan dijalankan dua kali."
  echo "-- Dibuat otomatis oleh scripts/gen-setup-sql.sh; jangan diedit manual."
  for f in supabase/migrations/*.sql; do
    echo
    echo "-- ===================================================================="
    echo "-- $(basename "$f")"
    echo "-- ===================================================================="
    cat "$f"
    echo
  done
} > "$out"
echo "ditulis: $out ($(wc -l < "$out") baris)"
