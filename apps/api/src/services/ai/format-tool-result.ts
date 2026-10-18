const fmtRp = (n: unknown) => `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

interface Acc { id: string; name: string; icon?: string; type: string; balance: number | null }
interface Tx {
  id: string
  type: string
  amount: number
  date: string
  note: string
  qty?: number | null
  unit_price?: number | null
  discount?: number | null
  normal_unit_price?: number | null
  total_size_label?: string | null
  canonical_name?: string | null
  category?: { name: string }
  account?: { name: string }
}

/**
 * Format hasil tool (object dari service layer, bukan HTTP) jadi teks Bahasa Indonesia untuk
 * dibacakan LLM (06-agent-integration.md §3 aturan 4: "konfirmasi dengan saldo baru dari respons").
 * Tool baca yang sering dipakai (list_accounts/get_summary/search_transactions/list_debts/
 * list_goals/list_piutang) dapat format rapi khusus; sisanya (termasuk semua tool tulis) pakai
 * formatter generik yang mengambil field umum (amount/balance/remaining/note) — cukup untuk LLM
 * menyusun kalimat konfirmasi tanpa perlu tahu bentuk persis tiap endpoint.
 */
export function formatToolResult(name: string, result: unknown): string {
  switch (name) {
    case 'list_accounts': {
      const { data, totals } = result as { data: Acc[]; totals: { visible_balance: number } }
      const rows = data.map((a) => `  ${a.icon || '💳'} ${a.name} (${a.type}): ${a.balance !== null ? fmtRp(a.balance) : 'privat'}`).join('\n')
      return `Akun keuangan (total saldo terlihat: ${fmtRp(totals.visible_balance)}):\n${rows || '  (belum ada akun)'}`
    }
    case 'get_summary': {
      const s = result as { period: { label: string; from: string; to: string }; totals: { income: number; expense: number; net: number; saving_rate_pct: number }; top_categories: Array<{ category: string; spent: number }> }
      const cats = s.top_categories.map((c) => `  ${c.category}: ${fmtRp(c.spent)}`).join('\n')
      return `Ringkasan ${s.period.label} (${s.period.from} s/d ${s.period.to}):\nPemasukan: ${fmtRp(s.totals.income)}\nPengeluaran: ${fmtRp(s.totals.expense)}\nSisa: ${fmtRp(s.totals.net)}\nSaving rate: ${s.totals.saving_rate_pct}%\nTop pengeluaran:\n${cats || '  (tidak ada)'}`
    }
    case 'search_transactions': {
      const { data } = result as { data: Tx[] }
      if (!data.length) return 'Tidak ada transaksi yang cocok dengan filter itu.'
      const rows = data
        .map((t) => {
          const meta: string[] = []
          if (t.qty != null && t.qty > 1) meta.push(`qty: ${t.qty}${t.unit_price ? ` @${fmtRp(t.unit_price)}` : ''}`)
          if (t.discount && t.discount > 0) {
            const normalTotal = t.amount + t.discount
            meta.push(`harga asli: ${t.qty && t.qty > 1 && t.normal_unit_price ? `@${fmtRp(t.normal_unit_price)} (total ${fmtRp(normalTotal)})` : fmtRp(normalTotal)}, diskon: -${fmtRp(t.discount)}`)
          }
          if (t.total_size_label) meta.push(`total ukuran: ${t.total_size_label}`)
          if (t.canonical_name) meta.push(`produk: ${t.canonical_name}`)
          const metaSuffix = meta.length ? ` (${meta.join(', ')})` : ''
          return `${t.date} | ${t.type === 'income' ? 'Pemasukan' : t.type === 'transfer' ? 'Transfer' : 'Pengeluaran'} | ${fmtRp(t.amount)}${metaSuffix} | ${t.category?.name ?? '-'} | ${t.note || '-'} | ${t.account?.name ?? '-'}`
        })
        .join('\n')
      return `${data.length} transaksi ditemukan:\n${rows}`
    }
    case 'list_debts': {
      const debts = result as Array<{ name: string; remaining: number; total: number; monthly: number; due_date: string | null }>
      if (!debts.length) return 'Tidak ada hutang yang tercatat.'
      const total = debts.reduce((a, d) => a + d.remaining, 0)
      const rows = debts.map((d) => `  ${d.name}: sisa ${fmtRp(d.remaining)} dari ${fmtRp(d.total)} | cicilan ${fmtRp(d.monthly)}/bln | jatuh tempo: ${d.due_date ?? '-'}`).join('\n')
      return `Hutang & cicilan (total sisa: ${fmtRp(total)}):\n${rows}`
    }
    case 'list_goals': {
      const goals = result as Array<{ name: string; current: number; target: number; pct: number }>
      if (!goals.length) return 'Belum ada target finansial.'
      const rows = goals.map((g) => `  ${g.name}: ${fmtRp(g.current)} / ${fmtRp(g.target)} (${g.pct}%)`).join('\n')
      return `Target finansial (${goals.length} goal):\n${rows}`
    }
    case 'list_piutang': {
      const items = result as Array<{ borrower_name: string; remaining: number; total: number; due_date: string | null }>
      if (!items.length) return 'Tidak ada piutang yang tercatat.'
      const total = items.reduce((a, p) => a + p.remaining, 0)
      const rows = items.map((p) => `  ${p.borrower_name}: sisa ${fmtRp(p.remaining)} dari ${fmtRp(p.total)}${p.due_date ? ` | jatuh tempo ${p.due_date}` : ''}`).join('\n')
      return `Piutang (total sisa: ${fmtRp(total)}):\n${rows}`
    }
    case 'list_recurrings': {
      const items = result as Array<{ name: string; amount: number; frequency: string; next_date: string; status: string }>
      if (!items.length) return 'Tidak ada transaksi berulang yang tercatat.'
      const rows = items.map((r) => `  ${r.name}: ${fmtRp(r.amount)} / ${r.frequency} | berikutnya ${r.next_date} (${r.status})`).join('\n')
      return `Transaksi berulang:\n${rows}`
    }
    case 'run_recurrings': {
      const r = result as { executed: number; skipped: unknown[] }
      return r.executed > 0 ? `${r.executed} transaksi berulang berhasil dijalankan.` : 'Tidak ada transaksi berulang yang jatuh tempo sekarang.'
    }
    case 'list_members': {
      const members = result as Array<{ display_name: string; role: string; aliases: string[] }>
      return members.map((m) => `  ${m.display_name} (${m.role})${m.aliases.length ? `, alias: ${m.aliases.join(', ')}` : ''}`).join('\n')
    }
    case 'list_categories': {
      const cats = result as Array<{ name: string; type: string }>
      return cats.map((c) => `  ${c.name} (${c.type})`).join('\n')
    }
    case 'get_budget_status': {
      const s = result as { period?: { label?: string }; items?: Array<{ category: { name: string }; amount: number; spent: number; remaining: number; pct: number }> }
      const items = s.items ?? []
      if (!items.length) return 'Belum ada anggaran untuk bulan ini.'
      const rows = items.map((i) => `  ${i.category.name}: terpakai ${fmtRp(i.spent)} dari ${fmtRp(i.amount)}, sisa ${fmtRp(i.remaining)} (${i.pct}%)`).join('\n')
      return `Status anggaran ${s.period?.label ?? ''}:\n${rows}`
    }
    // ── F-A/F-B/F-D (10-fitur-opsional-keluarga.md), review 2026-10-08: tanpa case ini, tool
    // BACA baru jatuh ke formatGenericWriteResult yang mengubah ARRAY jadi "Berhasil." — model
    // tidak pernah melihat datanya lalu mengarang jawaban.
    case 'list_beneficiaries': {
      const items = result as Array<{ name: string; kind: string; aliases: string[] }>
      if (!items.length) return 'Belum ada "untuk siapa" yang terdaftar.'
      return `Daftar "untuk siapa":\n${items.map((b) => `  ${b.name} (${b.kind})${b.aliases.length ? `, alias: ${b.aliases.join(', ')}` : ''}`).join('\n')}`
    }
    case 'add_beneficiary': {
      const b = result as { name: string; kind: string }
      return `"${b.name}" (${b.kind}) ditambahkan sebagai penerima.`
    }
    case 'get_monthly_report': {
      const r = result as { text_id: string; piutang_open?: unknown[]; largest_transactions?: Array<{ date: string; note: string; amount: number }> }
      const largest = (r.largest_transactions ?? []).slice(0, 3).map((t) => `  ${t.date} ${fmtRp(t.amount)} ${t.note}`).join('\n')
      return `${r.text_id}${largest ? `\nTransaksi terbesar:\n${largest}` : ''}`
    }
    case 'list_shopping': {
      const items = result as Array<{ id: string; name: string; qty_text: string | null; notes: string }>
      if (!items.length) return 'Daftar belanja kosong.'
      return `Perlu dibeli (${items.length}):\n${items.map((i) => `  [${i.id}] ${i.name}${i.qty_text ? ` ${i.qty_text}` : ''}${i.notes ? ` — ${i.notes}` : ''}`).join('\n')}`
    }
    case 'add_shopping_item': {
      const i = result as { name: string }
      return `"${i.name}" ditambahkan ke daftar belanja.`
    }
    case 'mark_bought': {
      const i = result as { name: string }
      return `"${i.name}" ditandai sudah dibeli.`
    }
    case 'shopping_suggestions': {
      const items = result as Array<{ pantry_item_id: string; name: string; qty: number; min_qty: number }>
      if (!items.length) return 'Tidak ada stok yang menipis.'
      return `Stok menipis, belum ada di daftar belanja:\n${items.map((s) => `  ${s.name} (sisa ${s.qty}, min ${s.min_qty})`).join('\n')}`
    }
    case 'list_pantry': {
      const items = result as Array<{ id: string; name: string; qty: number; unit: string; location: string; expires_at: string | null; expires_estimated: boolean; min_qty: number | null }>
      if (!items.length) return 'Stok rumah kosong.'
      const label: Record<string, string> = { fridge: 'Kulkas', freezer: 'Freezer', shelf: 'Lemari', other: 'Lainnya' }
      const byLoc = new Map<string, typeof items>()
      for (const i of items) byLoc.set(i.location, [...(byLoc.get(i.location) ?? []), i])
      return [...byLoc.entries()]
        .map(([loc, list]) => `${label[loc] ?? loc}:\n${list.map((i) => `  [${i.id}] ${i.name}: ${i.qty} ${i.unit}${i.min_qty != null && i.qty <= i.min_qty ? ' (menipis)' : ''}${i.expires_at ? ` | exp ${i.expires_estimated ? '~' : ''}${i.expires_at}` : ''}`).join('\n')}`)
        .join('\n')
    }
    case 'adjust_pantry': {
      const i = result as { name: string; qty: number; unit: string }
      return `Stok "${i.name}" sekarang ${i.qty} ${i.unit}.`
    }
    case 'ingest_receipt': {
      const r = result as { transactions: Tx[]; account: { balance: number | null }; shopping?: { marked_bought: Array<{ name: string }>; unmatched: string[] }; pantry?: { updated: Array<{ name: string; qty_after: number }>; unmatched: string[] } }
      const total = r.transactions.reduce((a, t) => a + Number(t.amount), 0)
      const lines = [`${r.transactions.length} item dicatat, total ${fmtRp(total)}${r.account.balance !== null ? `, saldo akun sekarang ${fmtRp(r.account.balance)}` : ''}.`]
      if (r.shopping) lines.push(`Belanja: ${r.shopping.marked_bought.length ? `dicoret ${r.shopping.marked_bought.map((s) => s.name).join(', ')}` : 'tidak ada yang cocok'}${r.shopping.unmatched.length ? ` (tidak di daftar: ${r.shopping.unmatched.join(', ')})` : ''}.`)
      if (r.pantry) lines.push(`Stok: ${r.pantry.updated.length ? r.pantry.updated.map((p) => `${p.name} → ${p.qty_after}`).join(', ') : 'tidak ada yang cocok'}${r.pantry.unmatched.length ? ` (tidak di stok: ${r.pantry.unmatched.join(', ')})` : ''}.`)
      return lines.join('\n')
    }
    case 'compare_prices': {
      const r = result as { query: string; products: Array<{ summary: string }> }
      if (!r.products?.length) return `Belum ada riwayat harga untuk "${r.query || 'produk tersebut'}".`
      return r.products.map((p) => `  • ${p.summary}`).join('\n')
    }
    case 'analyze_spending': {
      const r = result as { text_id: string; top_places?: Array<{ place: string; total: number; count: number; discount_total?: number; discount_count?: number }> }
      const discPlaces = (r.top_places ?? []).filter((p) => p.discount_total && p.discount_total > 0)
      const discLine = discPlaces.length
        ? `\nToko pemberi diskon: ${discPlaces.map((p) => `${p.place} (hemat ${fmtRp(p.discount_total)} dari ${p.discount_count} item)`).join(', ')}.`
        : ''
      return `${r.text_id}${discLine}`
    }
    default:
      return formatGenericWriteResult(result)
  }
}

/** Fallback untuk resolve_name dan semua tool TULIS (record_*, update_*, delete_*, pay_debt, dst.). */
function formatGenericWriteResult(result: unknown): string {
  if (result === null || result === undefined) return 'Berhasil.'
  if (typeof result !== 'object') return String(result)
  const r = result as Record<string, unknown>

  if ('status' in r) {
    // bentuk resolve_name: {status, match?, candidates?}
    if (r.status === 'ok') return `Ditemukan: ${JSON.stringify(r.match)}`
    if (r.status === 'ambiguous') return `Ambigu, ada beberapa kandidat: ${JSON.stringify(r.candidates)}`
    return `Tidak ditemukan.${r.candidates ? ` Saran: ${JSON.stringify(r.candidates)}` : ''}`
  }

  const parts: string[] = []
  if (r.success === true && Object.keys(r).length === 1) return 'Berhasil.'
  for (const [key, val] of Object.entries(r)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = val as Record<string, unknown>
      const bits: string[] = []
      if (typeof nested.balance === 'number') bits.push(`saldo ${fmtRp(nested.balance)}`)
      if (typeof nested.remaining === 'number') bits.push(`sisa ${fmtRp(nested.remaining)}`)
      if (typeof nested.current === 'number') bits.push(`progres ${fmtRp(nested.current)}`)
      if (typeof nested.amount === 'number') bits.push(`nominal ${fmtRp(nested.amount)}`)
      if (typeof nested.note === 'string' && nested.note) bits.push(`catatan "${nested.note}"`)
      if (bits.length) parts.push(`${key}: ${bits.join(', ')}`)
    }
  }
  return parts.length ? `Berhasil. ${parts.join('; ')}.` : 'Berhasil.'
}
