Status: done (Fase A, B, dan C selesai)
Terakhir diubah: 2026-10-31 (rev. 4)
Bergantung pada: 05-api.md (§3.3 jwt-only `/v1/ai/*`, §7 error code), 06-agent-integration.md (registry tool), 07-frontend.md (AiView, Sidebar AI settings), 10-fitur-opsional-keluarga.md (gate tool per fitur)

> **Riwayat perubahan**
> | Tanggal | Bagian | Perubahan | Alasan |
> |---|---|---|---|
> | 2026-10-31 | (file baru) | Spec perbaikan tampilan dan interaksi AI chat web: render Markdown, streaming + status langkah, kartu aksi + chip lanjutan | Pemilik produk 2026-10-31: balasan AI di widget chat tampil sebagai Markdown mentah (`###`, `**`, pipa tabel) dan terasa pasif (tunggu lama, muncul sekaligus, tidak ada aksi). Ditulis sebagai spec supaya bisa dikerjakan agen lain. |

# 12 — AI Chat Web: tampilan & interaksi (render, streaming, kartu aksi)

## 1. Masalah dan tujuan

### 1.1 Kondisi sekarang (dibaca dari kode 2026-10-31)

| Hal | Kondisi | File |
|---|---|---|
| Render bubble AI | `{m.text}` dengan `white-space: pre-wrap`; tidak ada parser Markdown di `apps/web` (tidak ada `react-markdown`/`marked` di lockfile) | `apps/web/src/components/dashboard/AiFloatingChat.jsx` baris 351–392; `apps/web/src/components/dashboard/views/AiView.jsx` baris 164–186 |
| Format yang diminta ke model | Tidak ada aturan format di system prompt; model bebas memakai `###`, tabel 3 kolom, `---` | `apps/api/src/services/ai/chat.ts` `buildSystemPrompt()` dan `buildEnrichedPrompt()` |
| Alur request | Satu `POST /v1/ai/chat` JSON, loop tool-calling maksimal 3 iterasi dengan budget 32 detik, jawaban dikirim utuh di akhir | `chat.ts` `chatWithAi()`; `apps/web/src/pages/Dashboard.jsx` `handleAi()` baris 579–620 |
| Indikator saat menunggu | Teks statis "Memproses data keluarga..." + titik berkedip. `AiView.jsx` punya cabang `role === "thinking"` tapi `Dashboard.jsx` tidak pernah mem-push pesan dengan role itu (sisa kode lama) | `AiFloatingChat.jsx` baris 394–426; `AiView.jsx` baris 147–163 |
| Tool tulis | Web **sudah** mengirim `allow_write: true` (komentar di `chat.ts` baris 49–50 yang bilang "belum ada toggle UI, default read-only" sudah basi) | `Dashboard.jsx` baris 599 |
| Hasil tulis | `result.mutated` memicu `queryClient.invalidateQueries()` | `Dashboard.jsx` baris 607–609 |
| Batas jawaban | `max_tokens: 1024` di semua provider; rencana bulanan panjang bisa terpotong | `chat.ts` `callOpenAiCompatible`, `callAnthropic`, `callGoogle` |
| Klien API | `api.POST()` dari `apps/web/src/api/client.ts` (openapi-fetch, token dari `supabase.auth.getSession()`, base URL `VITE_API_BASE_URL`) | `apps/web/src/api/client.ts` |
| Hosting API | Vercel Node, `maxDuration: 60`, region `sin1`, semua route lewat `api/index.js` | `apps/api/vercel.json` |
| Hono | `^4.6.11` (punya `hono/streaming` → `streamSSE`) | `apps/api/package.json` |

Bukti visual: balasan "Rekapitulasi Rencana Alokasi November 2026" tampil sebagai `### 📋 …`, `| Kelompok Pos | Alokasi (Rp) | Porsi (%) |`, `**TOTAL**`, dan baris `---` di widget selebar 400 px.

### 1.2 Tujuan

1. Balasan AI terbaca rapi di widget 400 px dan di HP 360 px: heading, bullet, bold, tabel 2 kolom; tabel lebar berubah jadi kartu.
2. Jawaban terlihat mengalir: token muncul bertahap, dan pengguna tahu langkah apa yang sedang dijalankan ("Mencari transaksi…").
3. Jawaban bisa ditindaklanjuti satu klik: kartu aksi (terapkan anggaran, catat pengeluaran, tambah belanjaan) dengan konfirmasi, plus chip pertanyaan lanjutan yang disarankan AI.

### 1.3 Bukan tujuan

- Mengubah Hermes/Telegram. Prompt Hermes ada di `SYSTEM_PROMPT.md` dan skill VPS, terpisah dari `chat.ts`.
- Mengganti model atau provider. BYOK multi-provider tetap.
- Menulis ulang `AiFloatingChat.jsx`/`AiView.jsx` dari nol; perubahan terbatas pada bagian yang disebut di §8.

## 2. Prinsip dan batasan (dari CLAUDE.md dan spec lain)

- Styling `apps/web`: inline style + CSS variable (`var(--color-*)`, `var(--bg-*)`), tanpa Tailwind/CSS modules. Komponen baru ditulis `.tsx`.
- Semua teks UI lewat `t("key")`; kunci baru ditambahkan ke 6 bahasa di `apps/web/src/i18n/translations.js`.
- `/v1/ai/*` tetap **jwt-only** (`requireJwtOnly`), lihat 05-api.md §3.3.
- Endpoint JSON `POST /v1/ai/chat` **tidak dihapus**: tetap jadi fallback web dan kontrak untuk klien lain.
- Error code baru wajib masuk `packages/shared/src/errors.ts` dan tabel 05-api.md §7. Fase ini tidak menambah error code; pakai `upstream_ai_error` dan `validation_error` yang ada.
- Tidak ada migrasi database.
- Komentar kode Bahasa Indonesia, identifier Inggris.

## 3. Fase A — Render Markdown dan disiplin format (prioritas 1)

### 3.1 Dependensi

Tambah ke `apps/web/package.json`: `react-markdown` dan `remark-gfm` (versi stabil terbaru saat implementasi, pin exact). Alasan memilih ini, bukan parser buatan sendiri: tabel GFM, list bersarang, dan escaping sudah benar; HTML mentah **tidak** dirender secara default (tanpa `rehype-raw`), jadi aman dari injeksi lewat balasan model.

### 3.2 Komponen `apps/web/src/components/ai/AiMessage.tsx`

```ts
type Props = { text: string; variant: 'floating' | 'page' }   // floating = widget 400 px, page = AiView
```

Pemetaan elemen (semua lewat prop `components` react-markdown, style inline + CSS var):

| Elemen Markdown | Render |
|---|---|
| `h1`–`h3` | Satu gaya saja: label kecil 11–12 px, `font-weight: 700`, `letter-spacing: .04em`, `text-transform: uppercase`, warna `var(--color-primary)`, margin atas 10 px. Emoji di awal heading dibiarkan. |
| `p` | 13 px (floating) / 14 px (page), `line-height: 1.6`, margin bawah 6 px, paragraf terakhir tanpa margin |
| `ul`/`ol` | `padding-left: 18px`, jarak antar item 2 px |
| `strong` | `font-weight: 700`, warna `var(--color-text)` (angka rupiah akan menonjol) |
| `code` inline | `font-family: ui-monospace`, latar `var(--bg-surface-low)`, radius 4 px, padding 1–4 px |
| `pre` | Latar `var(--bg-surface-low)`, scroll horizontal, 12 px |
| `a` | `target="_blank" rel="noopener noreferrer"`, warna `var(--color-primary)` |
| `hr` | Tidak dirender (`() => null`) |
| `img` | Tidak dirender |
| `table` | Komponen `AiTable` (§3.3) |
| `blockquote` | Garis kiri 3 px `var(--color-border-strong)`, teks `var(--color-muted)` |

Bubble **user** tetap teks biasa (tidak lewat Markdown), bubble `error` tetap seperti sekarang.

### 3.3 `AiTable`: tabel 2 kolom tetap tabel, lebih dari 2 jadi kartu

Diterapkan di dalam `AiMessage.tsx` lewat `components.table`, dengan membaca jumlah kolom dari header.

- **≤ 2 kolom**: tabel biasa, lebar 100 %, header 11 px uppercase `var(--color-muted)`, sel kanan `text-align: right` kalau isinya angka/rupiah (deteksi regex `^[Rp\s\d.,%+-]+$`), garis antar baris `var(--color-border-soft)`. Tanpa scroll horizontal.
- **> 2 kolom**: setiap baris data jadi kartu: sel pertama = judul kartu (bold), sel lainnya = baris `label : nilai` (label dari header). Baris yang sel pertamanya `TOTAL`/`Total` diberi latar `var(--color-primary-soft)`. Contoh dari screenshot: 4 kartu pos anggaran + 1 kartu TOTAL, masing-masing "Alokasi: Rp 7.045.000" dan "Porsi: 47,0 %".
- Mode `page` (AiView, lebar sampai 560 px): batas naik jadi 3 kolom sebelum berubah kartu.

### 3.4 Aturan format di system prompt (server)

Tambah aturan 8 di `buildSystemPrompt()` dan satu kalimat setara di `buildEnrichedPrompt()` (`apps/api/src/services/ai/chat.ts`):

```
8. FORMAT JAWABAN (dirender sebagai Markdown di layar HP selebar 360 px):
   - Mulai dengan 1 kalimat jawaban langsung, baru rincian.
   - Boleh heading "###" maksimal 1 per jawaban. Jangan pakai "---".
   - Rincian pakai bullet pendek; angka rupiah ditulis tebal, format Rp 1.500.000.
   - Tabel hanya kalau perlu membandingkan, maksimal 2 kolom (misal "Pos | Nominal") dan maksimal 8 baris; lebih dari itu pakai bullet berkelompok.
   - Emoji maksimal 3 per jawaban. Panjang jawaban maksimal ±1.500 karakter kecuali user minta rinci.
```

`max_tokens` dinaikkan 1024 → 2048 di `callOpenAiCompatible`, `callAnthropic`, `callGoogle` (ketiganya BYOK; biaya tambahan hanya terjadi kalau jawaban memang panjang). `temperature` tetap.

Komentar basi di `chat.ts` baris 49–50 ("belum ada toggle UI untuk ini, jadi secara default chat tetap read-only") diperbaiki: web mengirim `allow_write: true` sejak Fase 6.

### 3.5 Pemakaian

- `AiFloatingChat.jsx` baris 390: `{m.text}` → `m.role === "ai" ? <AiMessage text={m.text} variant="floating" /> : m.text`. Hapus `whiteSpace: "pre-wrap"` untuk bubble `ai` (Markdown mengatur spasi sendiri); pertahankan untuk `user`/`error`.
- `AiView.jsx` baris 186: sama, `variant="page"`.

### 3.6 Kriteria selesai Fase A

1. Balasan contoh di §1.1 (rencana alokasi November, 3 kolom) tampil sebagai 5 kartu tanpa satu pun karakter `#`, `|`, `*`, `---` terlihat, di lebar 360 px dan 400 px tanpa scroll horizontal, mode terang dan gelap.
2. Balasan dengan tabel 2 kolom tampil sebagai tabel rapi dengan kolom angka rata kanan.
3. Balasan berisi `<script>alert(1)</script>` atau `<img src=x onerror=…>` tampil sebagai teks, tidak dieksekusi.
4. Test Vitest `AiMessage.test.tsx`: (a) tabel 3 kolom → jumlah elemen kartu = jumlah baris data; (b) `hr` tidak dirender; (c) link punya `rel="noopener noreferrer"`.
5. `pnpm typecheck`, `pnpm lint`, `pnpm test` hijau.

## 4. Fase B — Streaming dan status langkah (prioritas 2)

### 4.1 Endpoint baru `POST /v1/ai/chat/stream`

- Auth: jwt-only, sama dengan `/v1/ai/chat`. Body: `AiChatBodySchema` yang sama.
- Response: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. Implementasi dengan `streamSSE` dari `hono/streaming`.
- Didaftarkan di `apps/api/src/routes/ai.ts`. Karena `@hono/zod-openapi` tidak bisa mendeskripsikan SSE dengan baik, route ini boleh dibuat dengan `aiApp.post(...)` biasa + validasi body manual lewat `AiChatBodySchema.safeParse` (400 `validation_error` kalau gagal), dan dicatat di 05-api.md §4 sebagai endpoint non-OpenAPI.
- Heartbeat komentar `: ping` setiap 10 detik selama menunggu upstream, supaya proxy tidak memutus koneksi.

### 4.2 Format event

```
event: status
data: {"step":"tool","tool":"search_transactions","label":"Mencari transaksi…"}

event: status
data: {"step":"thinking","label":"Menyusun jawaban…"}

event: token
data: {"text":"Sisa jatah aman harian kamu "}

event: done
data: {"reply":"<teks lengkap>","mutated":false,"tools_used":["search_transactions"],"elapsed_ms":4210}

event: error
data: {"code":"upstream_ai_error","message":"API error 429"}
```

- `done` selalu membawa `reply` lengkap (klien menimpa teks hasil gabungan token dengan `reply`, supaya tidak ada selisih karena chunk hilang).
- Setelah `error` tidak ada event lain. Setelah `done` stream ditutup.
- `status.step` ∈ `tool | thinking | writing`. `writing` dikirim sekali tepat sebelum token pertama.

### 4.3 Label manusiawi per tool

File baru `apps/api/src/services/ai/tool-labels.ts`, satu peta `TOOL_LABELS: Record<string,string>`; default `"Mengambil data…"`. Isi awal:

| Tool | Label |
|---|---|
| `search_transactions` | Mencari transaksi… |
| `get_summary`, `get_monthly_report`, `analyze_spending` | Menghitung ringkasan… |
| `get_budget_status` | Mengecek anggaran… |
| `record_expense`, `record_expense_batch` | Mencatat pengeluaran… |
| `record_income` | Mencatat pemasukan… |
| `record_transfer` | Mencatat transfer… |
| `update_transaction`, `delete_transaction`, `adjust_balance` | Memperbarui catatan… |
| `list_debts`, `pay_debt` | Mengecek hutang & cicilan… |
| `list_piutang`, `receive_piutang` | Mengecek piutang… |
| `list_goals`, `contribute_goal` | Mengecek target tabungan… |
| `get_investments` | Mengecek investasi… |
| `list_shopping`, `add_shopping_item`, `mark_bought`, `shopping_suggestions` | Mengecek daftar belanja… |
| `list_pantry`, `adjust_pantry` | Mengecek stok rumah… |
| `compare_prices`, `merge_products` | Membandingkan harga… |
| `ingest_receipt` | Membaca struk… |
| `list_recurrings`, `run_recurrings` | Mengecek transaksi rutin… |
| `list_beneficiaries`, `add_beneficiary` | Mengecek penerima… |
| `memory` | Menyimpan ingatan keluarga… |
| `list_accounts`, `list_members`, `list_categories`, `resolve_name` | Mengecek data keluarga… |

Label dikirim dari server (bukan dipetakan di klien) supaya Hermes/klien lain nanti bisa memakai event yang sama.

### 4.4 Perubahan `chatWithAi` (server)

- Refactor menjadi `chatWithAi(actor, messages, allowWrite, onEvent?)`. Tanpa `onEvent`, perilaku dan hasil **identik** dengan sekarang (endpoint JSON tidak berubah). Dengan `onEvent`, setiap langkah memanggil `onEvent({type:'status'|'token', ...})`; nilai kembalian tetap `{reply, mutated, tools_used}` yang dipakai untuk event `done`.
- Saat sebuah iterasi menghasilkan `tool_calls`, kirim satu `status` per tool **sebelum** `executeTool`, lalu jalankan paralel seperti sekarang.
- **Jalur OpenAI-compatible** (Gatekeeper/9router, OpenAI, Mistral, xAI, DeepSeek, Kimi): panggilan upstream memakai `stream: true` dan parser SSE upstream (baris `data: {...}` / `data: [DONE]`). Delta `content` diteruskan sebagai `token`; delta `tool_calls` dikumpulkan per `index` (gabungkan potongan `arguments`). Kalau di akhir chunk ternyata ada `tool_calls`, teks yang terlanjur diteruskan **tidak ditarik**; server kirim `status` lalu lanjut iterasi, dan jawaban akhir ditambahkan setelahnya. Timeout upstream 22 detik berlaku untuk waktu sampai chunk pertama, bukan total.
- **Jalur Anthropic dan Google**: Fase B cukup mengirim `status` per tool dan `writing`, lalu `reply` utuh sebagai satu `token` + `done`. Streaming asli kedua provider masuk pertanyaan terbuka Q-12-1.
- `TIME_BUDGET_MS` tetap 32 detik untuk loop tool; batas total request 50 detik (di bawah `maxDuration` 60) — lewat dari itu server mengirim `error` `upstream_ai_error` dengan pesan "Waktu habis, coba pertanyaan yang lebih spesifik".
- `AbortSignal` request klien (`c.req.raw.signal`) diteruskan ke fetch upstream supaya tombol Berhenti benar-benar menghentikan pemakaian token.

### 4.5 Klien: `apps/web/src/services/aiChatStream.ts`

```ts
export function streamAiChat(body: AiChatBody, handlers: {
  onStatus(s: {step: string; tool?: string; label: string}): void
  onToken(text: string): void
  onDone(r: {reply: string; mutated?: boolean; tools_used?: string[]; actions?: AiAction[]; suggestions?: string[]}): void
  onError(e: {code: string; message: string}): void
}, signal: AbortSignal): Promise<void>
```

- `fetch(`${baseUrl}/v1/ai/chat/stream`)` dengan header `Authorization: Bearer <token>` dan `X-Household-Id` dari sumber yang sama dengan `apps/web/src/api/client.ts` (ekspor helper `getAuthHeaders()` dari file itu, jangan duplikasi logika sesi).
- Parser SSE manual: `response.body.getReader()` + `TextDecoder`, pecah per `\n\n`, baca `event:` dan `data:`; abaikan baris komentar.
- **Fallback**: kalau `response.headers.get('content-type')` bukan `text/event-stream`, atau fetch gagal sebelum event pertama diterima, panggil `api.POST("/v1/ai/chat")` lama dan panggil `onDone` dengan hasilnya. Kalau gagal **setelah** token diterima, tampilkan teks yang sudah ada + pesan error kecil di bawahnya, jangan panggil fallback (hindari jawaban ganda dan tool tulis dijalankan dua kali).

### 4.6 State dan UI (`Dashboard.jsx`, `AiFloatingChat.jsx`, `AiView.jsx`)

Bentuk pesan diperluas:

```ts
{ role: 'ai', text: string, streaming?: boolean, status?: string, tools_used?: string[],
  actions?: AiAction[], suggestions?: string[] }
```

- `handleAi()`: push pesan user, lalu push pesan `{role:'ai', text:'', streaming:true, status:'Memproses…'}`; `onStatus` memperbarui `status` pesan terakhir; `onToken` menambah `text`; `onDone` menimpa `text` dengan `reply`, set `streaming:false`, simpan `actions`/`suggestions`, dan `invalidateQueries()` kalau `mutated`. Pola push `role:'thinking'` dihapus dari `AiView.jsx` (ganti ke field `status`).
- Tampilan bubble AI yang `streaming`: teks dirender lewat `AiMessage` (Markdown parsial boleh terlihat setengah jadi, itu wajar), kursor `▍` berkedip di akhir, dan di **atas** bubble satu baris 11 px `var(--color-muted)` berisi ikon roda gigi + `status`. Baris status hilang saat `done`.
- Tombol kirim berubah jadi **Berhenti** (ikon ■) selama streaming; klik → `AbortController.abort()`, pesan ditandai selesai dengan teks apa adanya + catatan kecil "Dihentikan".
- Pesan `aiTyping` lama (tiga titik "Memproses data keluarga...") dihapus karena digantikan bubble streaming.
- Auto-scroll: hanya kalau pengguna sedang di dasar daftar (toleransi 40 px); kalau sedang scroll ke atas, jangan paksa turun.

### 4.7 Kriteria selesai Fase B

1. Dengan provider Gatekeeper model `kb-fast`, token pertama tampil < 3 detik sesudah kirim pada pertanyaan tanpa tool ("halo"), dan status "Mencari transaksi…" tampil saat pertanyaan butuh tool ("transaksi terbesar bulan ini").
2. Tombol Berhenti menghentikan tampilan dalam < 300 ms dan log server menunjukkan fetch upstream dibatalkan.
3. Fallback: blokir `/v1/ai/chat/stream` lewat DevTools (request blocking) → jawaban tetap datang lewat endpoint JSON, tanpa pesan ganda.
4. Provider Anthropic dan Google (BYOK uji) tetap menjawab benar lewat endpoint stream.
5. Endpoint JSON lama lulus test integrasi yang ada tanpa perubahan.
6. Uji curl manual ke Gatekeeper dengan `stream:true` + `tools` membuktikan delta `tool_calls` diteruskan utuh (lihat Q-12-2); hasil dicatat di PROGRESS.md.

## 5. Fase C — Kartu aksi dan chip lanjutan (prioritas 3)

### 5.1 Blok terstruktur dari model

Model diminta (aturan 9 di system prompt) menutup jawaban dengan satu blok kode berbahasa `kb-actions` berisi JSON:

```json
{
  "suggestions": ["Bandingkan dengan Oktober", "Mana pos yang bisa dipangkas?"],
  "actions": [
    { "type": "apply_budget", "label": "Terapkan ke Anggaran November",
      "payload": { "month": "2026-11", "items": [ { "category": "Kos/Sewa", "amount": 7045000 } ] } }
  ]
}
```

Aturan ke model: `suggestions` 0–3 butir, ≤ 40 karakter, berupa pertanyaan lanjutan yang relevan; `actions` hanya kalau jawaban memang berisi sesuatu yang bisa dieksekusi; `category` harus dari Daftar Nama Kategori Valid; nominal integer rupiah.

Server (`chat.ts`, fungsi baru `extractActions(reply)`):
- Cari blok ```` ```kb-actions ```` terakhir, `JSON.parse`, validasi dengan zod `AiActionsBlockSchema` (di `packages/shared/src/schemas/ai.ts`). Blok dihapus dari `reply` apa pun hasil validasinya; kalau tidak valid, `actions`/`suggestions` kosong (toleran, tidak pernah error ke user).
- `AiChatResponseSchema` dapat field opsional `actions` dan `suggestions`; event `done` membawa keduanya.

### 5.2 Tipe aksi yang didukung (whitelist, divalidasi zod di server)

| `type` | `payload` | Eksekusi di klien (deterministik, **tidak** lewat model) |
|---|---|---|
| `apply_budget` | `{ month: 'YYYY-MM', items: [{category, amount}] }` | Untuk tiap item: `POST /v1/budgets` (`CreateBudgetBodySchema`: `category`, `amount`, `month`). Kalau respons `409`/kategori sudah punya anggaran bulan itu → `PATCH /v1/budgets/{id}` dengan `amount` (ambil id dari `GET /v1/budgets?month=`). Ringkasan hasil: "4 anggaran dibuat, 1 diperbarui". |
| `record_expense` | `{ account, category, amount, date, note? }` | Buka `AddTransactionModal` **terisi** payload (user menekan Simpan sendiri). Tidak langsung POST. |
| `add_shopping` | `{ items: [{name, qty?, unit?}] }` | `POST /v1/shopping` per item (hanya kalau `features.shopping_stock.enabled`; kalau mati, kartu tidak ditampilkan). |
| `set_goal` | `{ name, target, deadline? }` | Buka modal goal terisi. |

Tipe di luar daftar diabaikan (dibuang saat validasi).

### 5.3 UI kartu aksi

- Di bawah bubble AI, satu kartu per aksi: judul = `label`, ringkasan payload (untuk `apply_budget`: daftar `kategori — Rp x`, total), tombol utama **Terapkan** dan tombol kecil **Lihat detail** (expand payload).
- Klik Terapkan → dialog konfirmasi ringkas ("Buat 4 anggaran November senilai Rp 15.000.000?") → eksekusi → toast + `queryClient.invalidateQueries()` + pesan sistem di chat `{role:'ai', text:'✅ Anggaran November diterapkan (4 pos).'}`. Kartu berubah jadi status "Sudah diterapkan" dan tombol nonaktif (simpan flag `applied` di pesan).
- Gagal sebagian → pesan error menyebut item yang gagal beserta `hint` dari `ApiError`.

### 5.4 Chip lanjutan

- Setelah `done` dengan `suggestions` tidak kosong, baris chip di atas input menampilkan `suggestions` (bukan `CONTEXT_PROMPTS`). Klik chip = kirim teks itu. Chip kontekstual kembali saat `activeMenu` berubah atau percakapan di-reset.
- Chip saran tidak pernah `fillOnly`.

### 5.5 Kenyamanan kecil (ikut Fase C)

- Tombol per bubble AI (muncul saat hover/desktop, selalu tampil di HP, 11 px): **Salin** (`navigator.clipboard.writeText(text)`) dan **Ulangi** (kirim ulang pesan user tepat sebelumnya).
- Input `AiFloatingChat.jsx` dan `AiView.jsx` menjadi `textarea` auto-grow 1–4 baris; Enter kirim, Shift+Enter baris baru; placeholder tetap.
- Setelah reset percakapan, fokus kembali ke input (desktop).

### 5.6 Kriteria selesai Fase C

1. Pertanyaan "buatkan budgeting November total 15 juta" menghasilkan jawaban + kartu `apply_budget`; Terapkan membuat baris di `GET /v1/budgets?month=2026-11` sesuai payload; halaman Anggaran langsung memperlihatkannya.
2. Blok `kb-actions` tidak pernah terlihat di bubble, termasuk saat JSON-nya rusak.
3. Payload dengan `type` asing atau `category` tidak valid dibuang server (test unit `extractActions`).
4. Chip saran tampil maksimal 3 dan hilang saat menu berubah.
5. Salin menyalin teks Markdown mentah (bukan HTML).

## 6. Keamanan

- Tidak memakai `rehype-raw`; HTML dalam balasan tidak pernah dirender.
- Link eksternal selalu `rel="noopener noreferrer"`; skema `javascript:` ditolak (react-markdown sudah membersihkan, tetap ditest).
- Aksi tulis dari kartu selalu lewat konfirmasi pengguna dan endpoint REST biasa dengan validasi zod yang sudah ada; model tidak bisa memicu tulis di luar whitelist §5.2.
- Server tidak mencatat isi pesan ke log; hanya `tools_used`, `elapsed_ms`, provider, dan model.
- Stream dibatalkan klien → upstream dibatalkan (`AbortSignal`), supaya token BYOK pengguna tidak terus terpakai.

## 7. i18n — kunci baru (tambahkan ke 6 bahasa)

`ai.status.processing`, `ai.status.writing`, `ai.stop`, `ai.stopped`, `ai.copy`, `ai.copied`, `ai.retry`, `ai.action.apply`, `ai.action.applied`, `ai.action.details`, `ai.action.confirm_budget` (dengan placeholder `{count}` dan `{total}`), `ai.action.done_budget`, `ai.error.timeout`. Label status per tool (§4.3) datang dari server dalam Bahasa Indonesia; terjemahannya menyusul (Q-12-3).

## 8. Daftar perubahan file

| File | Perubahan | Fase |
|---|---|---|
| `apps/web/package.json` | + `react-markdown`, `remark-gfm` | A |
| `apps/web/src/components/ai/AiMessage.tsx` (baru) | Renderer Markdown + `AiTable` | A |
| `apps/web/src/components/ai/AiMessage.test.tsx` (baru) | Test §3.6 | A |
| `apps/web/src/components/dashboard/AiFloatingChat.jsx` | Pakai `AiMessage`; bubble streaming + status + Berhenti; kartu aksi; chip saran; textarea; tombol Salin/Ulangi | A, B, C |
| `apps/web/src/components/dashboard/views/AiView.jsx` | Sama dengan di atas, `variant="page"`; hapus cabang `role === "thinking"` | A, B, C |
| `apps/web/src/pages/Dashboard.jsx` | `handleAi` pakai `streamAiChat` + fallback; state pesan baru; handler aksi | B, C |
| `apps/web/src/services/aiChatStream.ts` (baru) | Klien SSE + fallback | B |
| `apps/web/src/api/client.ts` | Ekspor `getAuthHeaders()` | B |
| `apps/web/src/components/ai/AiActionCard.tsx` (baru) | Kartu aksi + konfirmasi + eksekusi §5.2 | C |
| `apps/web/src/i18n/translations.js` | Kunci §7 | A–C |
| `apps/api/src/services/ai/chat.ts` | Aturan format 8 (+9 di Fase C), `max_tokens` 2048, `onEvent`, parser SSE upstream, `extractActions`, komentar basi diperbaiki | A, B, C |
| `apps/api/src/services/ai/tool-labels.ts` (baru) | `TOOL_LABELS` | B |
| `apps/api/src/routes/ai.ts` | `POST /v1/ai/chat/stream` | B |
| `packages/shared/src/schemas/ai.ts` | `AiChatResponseSchema` + `actions`, `suggestions`; `AiActionsBlockSchema` | C |
| `docs/spec/05-api.md` | §4: catat `/v1/ai/chat/stream` (SSE, jwt-only) dan field respons baru | B, C |
| `docs/spec/07-frontend.md` | Baris `AiView`: indikator status streaming, kartu aksi | B, C |
| `docs/spec/PROGRESS.md` | Status tiap fase + hasil verifikasi | A–C |

## 9. Urutan kerja dan verifikasi

1. Fase A dulu, utuh, lalu commit (`feat(ai-chat): render markdown + aturan format jawaban`). Verifikasi dengan `pnpm typecheck && pnpm lint && pnpm test`, lalu uji manual: kirim "buatkan budgeting untuk bulan november total 15 juta" di widget pada lebar 360 px (DevTools) dan desktop, mode terang dan gelap.
2. Sebelum Fase B: jalankan uji curl Q-12-2 ke Gatekeeper; kalau delta `tool_calls` rusak, jalur Gatekeeper memakai strategi non-stream untuk iterasi tool dan `stream:true` hanya untuk panggilan tanpa tools (panggilan akhir setelah `MAX_ITER` atau saat `toolDefs` kosong), dan catat keputusan di riwayat spec ini.
3. Fase B, commit terpisah. Verifikasi §4.7, termasuk test integrasi endpoint stream (Vitest: baca event `status`/`done` dari respons `text/event-stream` dengan provider mock).
4. Fase C, commit terpisah. Verifikasi §5.6.
5. Setiap fase selesai: update `PROGRESS.md` (tanggal, hasil perintah, screenshot sebelum/sesudah disimpan di `docs/panduan-assets/ai-chat/`).

## 10. Pertanyaan terbuka

- **Q-12-1** Streaming asli untuk Anthropic (`stream: true`, event `content_block_delta`) dan Google (`streamGenerateContent?alt=sse`): dikerjakan setelah Fase B stabil, atau cukup envelope status + jawaban utuh? Usulan: tunda; mayoritas pengguna memakai Gatekeeper.
- **Q-12-2** Apakah 9router (Gatekeeper) meneruskan delta `tool_calls` dengan benar saat `stream:true`? Harus diuji curl sebelum Fase B (lihat §9 langkah 2).
- **Q-12-3** Label status dari server berbahasa Indonesia saja. Kalau i18n 6 bahasa harus konsisten, server mengirim `tool` dan klien memetakan ke `t("ai.tool.<name>")`; biaya: 35 kunci × 6 bahasa.
- **Q-12-4** `max_tokens` 2048 menambah biaya BYOK pada jawaban panjang. Alternatif: 1536. Keputusan pemilik produk.
- **Q-12-5** Apakah kartu `apply_budget` perlu menimpa anggaran yang sudah ada tanpa tanya? Usulan: tanya lewat dialog konfirmasi yang menyebut "3 pos sudah punya anggaran, akan diperbarui".
