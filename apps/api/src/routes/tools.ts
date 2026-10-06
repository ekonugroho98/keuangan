import { Hono } from 'hono'
import manifest from '../../tools/hermes-tools.json'

// GET /v1/tools/hermes.json (06-agent-integration.md §6): auth none, publik — Hermes memuatnya
// sekali saat setup sebelum tahu API key apa pun. File di-generate dari registry lewat
// `pnpm gen:tools` (scripts/gen-tools.ts, dijalankan manual atau lewat CI), bukan on-the-fly di
// sini, supaya hasilnya stabil/di-diff di git (kriteria selesai F6-T4: "git diff --exit-code").
// Diimpor langsung (bukan dibaca via fs + import.meta.url saat runtime) supaya isinya ter-inline
// ke bundle esbuild (scripts/build-function.mjs) — path relatif berbasis import.meta.url rusak
// setelah bundling karena lokasi file bundle beda dari lokasi source aslinya.
export const toolsApp = new Hono()

toolsApp.get('/v1/tools/hermes.json', (c) => {
  return c.json(manifest)
})
