// Bundle src/vercel-handler.ts menjadi satu file api/index.js (semua import, termasuk
// @karaya/shared, di-inline) sebelum dideploy ke Vercel. Diperlukan karena project ini
// "type": "module" (ESM) — builder Node function Vercel tidak mem-bundle entrypoint TS secara
// otomatis untuk project ESM, jadi import relatif tanpa ekstensi (`.js`) gagal di-resolve saat
// runtime (ERR_MODULE_NOT_FOUND). Bundling sendiri menghilangkan masalah itu sepenuhnya: tidak
// ada lagi import antar-file yang perlu di-resolve Node saat runtime.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

await build({
  entryPoints: [join(here, '../src/vercel-handler.ts')],
  outfile: join(here, '../api/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
})

console.log('Bundled apps/api/api/index.js')
