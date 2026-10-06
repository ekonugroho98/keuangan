// Generate apps/api/tools/hermes-tools.json dari apps/api/src/tools/registry.ts (06-agent-integration.md
// §2, 08-rencana-implementasi.md F6-T4). `handler` sengaja TIDAK ikut diemit (function, bukan data
// serializable) — hanya field yang relevan untuk Hermes: name/description/parameters/endpoint/scope/idempotent.
// Jalankan: pnpm gen:tools (JSON saja) atau pnpm gen:tools --md (JSON + tabel markdown ke stdout).
import { writeFileSync } from 'node:fs'

// registry.ts mengimpor service layer yang transitif mengimpor env.ts (validasi env SEKALI saat
// modul dimuat) — skrip ini hanya butuh metadata TOOLS (name/description/parameters/dst.), tidak
// pernah memanggil handler/DB sungguhan, jadi aman diisi placeholder di sini (sama persis dengan
// pola apps/api/vitest.config.ts) supaya `pnpm gen:tools` bisa jalan di CI tanpa secret produksi.
process.env.API_PUBLIC_URL ??= 'http://localhost:8787'
process.env.CORS_ORIGINS ??= 'http://localhost:5173'
process.env.DATABASE_URL ??= 'postgres://karaya_api:placeholder@localhost:54329/postgres'
process.env.SUPABASE_JWT_SECRET ??= 'placeholder-for-gen-tools-script-only-min-32-chars'
process.env.API_KEY_PEPPER ??= 'placeholder-for-gen-tools-script-only-min-32-chars'

const OUT_PATH = 'apps/api/tools/hermes-tools.json'

async function main() {
  const { TOOLS } = await import('../apps/api/src/tools/registry')
  const manifest = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    endpoint: t.endpoint,
    scope: t.scope,
    idempotent: t.idempotent,
  }))
  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`✅ ${OUT_PATH} ditulis ulang (${manifest.length} tool).`)

  if (process.argv.includes('--md')) {
    const rows = TOOLS.map((t) => `| \`${t.name}\` | \`${t.endpoint.method} ${t.endpoint.path}\` | ${t.scope} | ${t.description.split('.')[0]}. |`)
    console.log('\n| Tool | Endpoint | Scope | Deskripsi singkat |')
    console.log('|---|---|---|---|')
    console.log(rows.join('\n'))
  }
}

main()
