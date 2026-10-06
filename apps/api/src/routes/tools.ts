import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'

// GET /v1/tools/hermes.json (06-agent-integration.md §6): auth none, publik — Hermes memuatnya
// sekali saat setup sebelum tahu API key apa pun. File di-generate dari registry lewat
// `pnpm gen:tools` (scripts/gen-tools.ts, dijalankan manual atau lewat CI), bukan on-the-fly di
// sini, supaya hasilnya stabil/di-diff di git (kriteria selesai F6-T4: "git diff --exit-code").
const MANIFEST_PATH = fileURLToPath(new URL('../../tools/hermes-tools.json', import.meta.url))

export const toolsApp = new Hono()

toolsApp.get('/v1/tools/hermes.json', (c) => {
  const json = readFileSync(MANIFEST_PATH, 'utf8')
  return c.body(json, 200, { 'Content-Type': 'application/json' })
})
