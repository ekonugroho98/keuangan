#!/usr/bin/env bash
# Generate packages/shared/src/api-client/schema.d.ts dari OpenAPI apps/api yang sedang jalan
# (02-monorepo.md §4, §10). Jalankan `pnpm --filter @karaya/api dev` di terminal lain dulu,
# atau skrip ini akan gagal konek ke localhost:8787.
set -euo pipefail
API_URL="${API_URL:-http://localhost:8787}"

echo "Mengambil OpenAPI dari ${API_URL}/v1/openapi.json ..."
pnpm exec openapi-typescript "${API_URL}/v1/openapi.json" -o packages/shared/src/api-client/schema.d.ts

echo "schema.d.ts diperbarui."
