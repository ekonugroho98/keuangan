import { buildApp } from './app'

// `hono/vercel` deprecated (removed di Hono v5) — adapternya cuma `(req) => app.fetch(req)`, dan
// kontrak Node function Vercel sekarang (Web-standard Request/Response) butuh export per method
// HTTP (gaya Next.js App Router), bukan satu `export default`. Lihat error asli yang ditemukan:
// "this.raw.headers.get is not a function" — req yang dikirim Vercel ke default export bukan
// Request standar, cuma GET/POST/dst named export yang dapat Request standar.
const app = buildApp()
const handler = app.fetch.bind(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
export const HEAD = handler
