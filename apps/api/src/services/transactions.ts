import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { parseAmountId, AmountParseError } from '@karaya/shared/format'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveAccountRef, resolveCategoryRef, resolveMemberRef, resolveBeneficiaryRef, resolveEffectiveRecorder, resolveExplicitRecorder } from './resolver'
import { resolvePeriod, todayInTz } from './period'
import { learnKeywords, refineAgentCategory } from './categorize'
import { createTitipanPiutang, detectTitipan, piutangCategoryId, titipanDisplayName, type TitipanCreated } from './titipan'
import { canonicalizeProducts, recordPrices, syncTransactionPrice, type PriceItem } from './prices'
import { formatReceiptNote, parseReceiptNote } from '@karaya/shared/format'

// Gate fitur beneficiary ada di dalam resolveBeneficiaryRef (features.ts) — di sini hanya perlu
// tahu apakah field disentuh, untuk memutuskan apakah key `beneficiary_id` ikut ditulis.
function touchesBeneficiary(ref: { beneficiary_id?: string | null; beneficiary?: string }): boolean {
  return ref.beneficiary_id !== undefined || ref.beneficiary !== undefined
}

/** Sumber transaksi: lewat API key (Hermes/agent) → 'api_key', lewat web (JWT) → 'web'. Sebelumnya selalu 'web'. */
export function txSource(actor: Actor): 'web' | 'api_key' {
  return actor.credential === 'api_key' ? 'api_key' : 'web'
}

function parseAmount(input: { amount?: number; amount_text?: string }): number {
  try {
    if (input.amount !== undefined) return input.amount
    return parseAmountId(input.amount_text!)
  } catch (err) {
    if (err instanceof AmountParseError) {
      throw ApiError.fromCode('invalid_amount_text', { details: { input: err.input } })
    }
    throw err
  }
}

export interface TxRow {
  id: string
  type: string
  amount: string
  date: string
  note: string
  account_id: string
  account_name: string
  account_owner_member_id: string | null
  account_owner_display_name: string | null
  to_account_id: string | null
  to_account_name: string | null
  to_account_owner_member_id: string | null
  to_account_owner_display_name: string | null
  category_id: string
  category_name: string
  category_icon: string
  category_color: string
  beneficiary_id: string | null
  beneficiary_name: string | null
  beneficiary_kind: string | null
  recorded_by_member_id: string
  recorded_by_display_name: string
  source: string
  recurring_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  item_qty?: string | null
  item_unit_price?: string | null
  item_discount?: string | null
  item_normal_unit_price?: string | null
  item_size_value?: string | null
  item_size_unit?: 'g' | 'ml' | 'pcs' | null
  item_canonical_name?: string | null
}

function formatTotalSize(qty: number | null, sizeVal: number | null, sizeUnit: string | null): string | null {
  if (!sizeVal || !sizeUnit || sizeVal <= 0) return null
  const total = (qty && qty > 0 ? qty : 1) * sizeVal
  if (sizeUnit === 'g' && total >= 1000) return `${+(total / 1000).toFixed(2)} kg`
  if (sizeUnit === 'ml' && total >= 1000) return `${+(total / 1000).toFixed(2)} L`
  return `${+total.toFixed(2)} ${sizeUnit}`
}

export function mapTx(r: TxRow) {
  const qty = r.item_qty != null ? Number(r.item_qty) : null
  const unitPrice = r.item_unit_price != null ? Math.round(Number(r.item_unit_price)) : null
  const discount = r.item_discount != null ? Math.round(Number(r.item_discount)) : null
  const normalUnitPrice = r.item_normal_unit_price != null ? Math.round(Number(r.item_normal_unit_price)) : unitPrice
  const sizeValue = r.item_size_value != null ? Number(r.item_size_value) : null
  const sizeUnit = r.item_size_unit ?? null
  const totalSizeLabel = formatTotalSize(qty, sizeValue, sizeUnit)
  const canonicalName = r.item_canonical_name ?? null

  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    date: r.date,
    note: r.note,
    ...(qty !== null
      ? {
          qty,
          unit_price: unitPrice,
          discount: discount ?? 0,
          normal_unit_price: normalUnitPrice,
          size_value: sizeValue,
          size_unit: sizeUnit,
          total_size_label: totalSizeLabel,
          canonical_name: canonicalName,
        }
      : {}),
    account: { id: r.account_id, name: r.account_name, owner: r.account_owner_member_id ? { member_id: r.account_owner_member_id, display_name: r.account_owner_display_name } : null },
    to_account: r.to_account_id ? { id: r.to_account_id, name: r.to_account_name, owner: r.to_account_owner_member_id ? { member_id: r.to_account_owner_member_id, display_name: r.to_account_owner_display_name } : null } : null,
    category: { id: r.category_id, name: r.category_name, icon: r.category_icon, color: r.category_color },
    beneficiary: r.beneficiary_id ? { id: r.beneficiary_id, name: r.beneficiary_name!, kind: r.beneficiary_kind! } : null,
    recorded_by: { member_id: r.recorded_by_member_id, display_name: r.recorded_by_display_name },
    source: r.source,
    recurring_id: r.recurring_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted_at: r.deleted_at,
  }
}

export const TX_SELECT = `
  select t.id, t.type, t.amount::text, t.date::text, t.note,
         t.account_id, a.name as account_name, a.owner_member_id as account_owner_member_id, am.display_name as account_owner_display_name,
         t.to_account_id, ta.name as to_account_name, ta.owner_member_id as to_account_owner_member_id, tam.display_name as to_account_owner_display_name,
         t.category_id, c.name as category_name, c.icon as category_icon, c.color as category_color,
         t.beneficiary_id, coalesce(bm.display_name, b.name) as beneficiary_name, b.kind::text as beneficiary_kind,
         t.recorded_by_member_id, rm.display_name as recorded_by_display_name,
         t.source, t.recurring_id, t.created_at, t.updated_at, t.deleted_at,
         pp.qty::text as item_qty, pp.unit_price::text as item_unit_price,
         pp.discount::text as item_discount, round((pp.amount + pp.discount)::numeric / pp.qty, 2)::text as item_normal_unit_price,
         pp.size_value::text as item_size_value, pp.size_unit as item_size_unit,
         coalesce(pa.canonical_name, pk.canonical_name) as item_canonical_name
  from transactions t
  join accounts a on a.id = t.account_id
  left join household_members am on am.id = a.owner_member_id
  left join accounts ta on ta.id = t.to_account_id
  left join household_members tam on tam.id = ta.owner_member_id
  join categories c on c.id = t.category_id
  left join beneficiaries b on b.id = t.beneficiary_id
  left join household_members bm on bm.id = b.member_id and bm.deleted_at is null
  join household_members rm on rm.id = t.recorded_by_member_id
  left join product_prices pp on pp.transaction_id = t.id
  left join product_aliases pa on pa.household_id = t.household_id and pa.keyword = pp.keyword
  left join product_knowledge pk on pk.keyword = pp.keyword
`

export interface TransactionListQuery {
  period?: string
  from?: string
  to?: string
  type?: string
  account_id?: string
  account?: string
  category_id?: string
  category?: string
  member_id?: string
  member?: string
  beneficiary_id?: string
  beneficiary?: string
  attribution: 'owner' | 'recorded_by'
  q?: string
  min_amount?: number
  max_amount?: number
  include_deleted: boolean
  limit: number
  cursor?: string
}

function decodeCursor(cursor?: string): { date: string; createdAt: string; id: string } | null {
  if (!cursor) return null
  try {
    const [date, createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    return { date: date!, createdAt: createdAt!, id: id! }
  } catch {
    throw ApiError.fromCode('invalid_cursor')
  }
}

function encodeCursor(date: string, createdAt: string, id: string): string {
  return Buffer.from(`${date}|${createdAt}|${id}`, 'utf8').toString('base64url')
}

/** Bangun klausa WHERE + array parameter secara dinamis, $N selalu sinkron dengan posisi di params. */
function buildTxFilter(
  actor: Actor,
  query: TransactionListQuery,
  resolved: { dateFrom?: string; dateTo?: string; accountId?: string; categoryId?: string; memberId?: string; beneficiaryId?: string | 'none' },
  cur: { date: string; createdAt: string; id: string } | null,
): { where: string; params: postgres.ParameterOrJSON<never>[] } {
  const params: postgres.ParameterOrJSON<never>[] = [actor.householdId]
  const clauses = ['t.household_id = $1']
  const push = (v: postgres.ParameterOrJSON<never>) => { params.push(v); return `$${params.length}` }

  if (!query.include_deleted) clauses.push('t.deleted_at is null')
  if (resolved.dateFrom) clauses.push(`t.date >= ${push(resolved.dateFrom)}`)
  if (resolved.dateTo) clauses.push(`t.date <= ${push(resolved.dateTo)}`)
  if (query.type) clauses.push(`t.type = ${push(query.type)}`)
  if (resolved.accountId) {
    const p = push(resolved.accountId)
    clauses.push(`(t.account_id = ${p} or t.to_account_id = ${p})`)
  }
  if (resolved.categoryId) clauses.push(`t.category_id = ${push(resolved.categoryId)}`)
  if (resolved.memberId) {
    const p = push(resolved.memberId)
    clauses.push(query.attribution === 'recorded_by' ? `t.recorded_by_member_id = ${p}` : `(a.owner_member_id = ${p} or ta.owner_member_id = ${p})`)
  }
  if (resolved.beneficiaryId === 'none') {
    clauses.push('t.beneficiary_id is null')
  } else if (resolved.beneficiaryId) {
    clauses.push(`t.beneficiary_id = ${push(resolved.beneficiaryId)}`)
  }
  if (query.q) {
    const pq = push(`%${query.q}%`)
    clauses.push(
      `(t.note ilike ${pq} or exists (select 1 from product_prices ppq left join product_aliases paq on paq.household_id = t.household_id and paq.keyword = ppq.keyword left join product_knowledge pkq on pkq.keyword = ppq.keyword where ppq.transaction_id = t.id and coalesce(paq.canonical_name, pkq.canonical_name, ppq.base_name) ilike ${pq}))`,
    )
  }
  if (query.min_amount !== undefined) clauses.push(`t.amount >= ${push(query.min_amount)}`)
  if (query.max_amount !== undefined) clauses.push(`t.amount <= ${push(query.max_amount)}`)
  if (cur) {
    const pd = push(cur.date)
    const pc = push(cur.createdAt)
    const pi = push(cur.id)
    clauses.push(`(t.date, t.created_at, t.id) < (${pd}, ${pc}, ${pi})`)
  }
  return { where: clauses.join(' and '), params }
}

export async function listTransactions(actor: Actor, query: TransactionListQuery, timezone: string) {
  return withActor(actor, async (tx) => {
    let dateFrom = query.from
    let dateTo = query.to
    if (query.period) {
      const p = resolvePeriod(query.period, timezone, query.from, query.to)
      dateFrom = p.from
      dateTo = p.to
    }

    const accountId = query.account_id || query.account ? await resolveAccountRef(tx, actor, query, 'account') : undefined
    const categoryId = query.category_id || query.category ? await resolveCategoryRef(tx, actor, query) : undefined
    const memberId = query.member_id || query.member ? await resolveMemberRef(tx, actor, query) : undefined
    // null dari resolver = eksplisit "bersama"/"keluarga"/"none" -> hanya beneficiary_id IS NULL;
    // undefined = tidak difilter. Sentinel & gate semuanya di dalam resolveBeneficiaryRef.
    const resolvedBeneficiary = await resolveBeneficiaryRef(tx, actor, query)
    const beneficiaryId: string | 'none' | undefined = resolvedBeneficiary === null ? 'none' : resolvedBeneficiary
    const cur = decodeCursor(query.cursor)
    const resolved = { dateFrom, dateTo, accountId, categoryId, memberId, beneficiaryId }

    const { where, params } = buildTxFilter(actor, query, resolved, cur)
    const limitParam = params.length + 1
    const rows = await tx.unsafe<TxRow[]>(
      `${TX_SELECT} where ${where} order by t.date desc, t.created_at desc, t.id desc limit $${limitParam}`,
      [...params, query.limit + 1],
    )

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!.date, page[page.length - 1]!.created_at, page[page.length - 1]!.id) : null

    // Totals: hitung ulang filter TANPA klausa cursor (totals atas seluruh hasil filter, 05-api.md §4.5).
    const { where: totalsWhere, params: totalsParams } = buildTxFilter(actor, query, resolved, null)
    const [totalsRow] = await tx.unsafe<{ income: string; expense: string; transfer: string; count: string }[]>(
      `select
         coalesce(sum(case when t.type='income' then t.amount end),0)::text as income,
         coalesce(sum(case when t.type='expense' then t.amount end),0)::text as expense,
         coalesce(sum(case when t.type='transfer' then t.amount end),0)::text as transfer,
         count(*)::text as count
       from transactions t
       join accounts a on a.id = t.account_id
       left join accounts ta on ta.id = t.to_account_id
       where ${totalsWhere}`,
      totalsParams,
    )

    return {
      data: page.map(mapTx),
      next_cursor: nextCursor,
      has_more: hasMore,
      totals: {
        income: Number(totalsRow!.income), expense: Number(totalsRow!.expense),
        transfer: Number(totalsRow!.transfer), count: Number(totalsRow!.count),
      },
    }
  })
}

export async function getTransaction(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1 and t.household_id = $2 and t.deleted_at is null`, [id, actor.householdId])
    if (rows.length === 0) throw ApiError.fromCode('transaction_not_found')
    return mapTx(rows[0]!)
  })
}

export interface CreateTransactionInput {
  type: 'income' | 'expense'
  amount?: number
  amount_text?: string
  account_id?: string
  account?: string
  category_id?: string
  category?: string
  date?: string
  note?: string
  beneficiary_id?: string
  beneficiary?: string
  recorded_by_id?: string
  recorded_by?: string
}

export async function createTransaction(actor: Actor, input: CreateTransactionInput, timezone: string) {
  const amount = parseAmount(input)
  const parsedNote = input.type === 'expense' && input.note ? parseReceiptNote(input.note) : null
  if (parsedNote?.merchant && parsedNote.name) {
    await canonicalizeProducts(actor, [parsedNote.name])
  }
  return withActor(actor, async (tx) => {
    const explicitRecorderId = await resolveExplicitRecorder(tx, actor, input)
    const accountId = await resolveAccountRef(tx, actor, input, 'account', explicitRecorderId)
    const recorderId = await resolveEffectiveRecorder(tx, actor, input, accountId, explicitRecorderId)
    const resolvedCategoryId = await resolveCategoryRef(tx, actor, input, input.type)
    const categoryId = actor.credential === 'api_key' && input.type === 'expense'
      ? await refineAgentCategory(tx, actor.householdId, input.note, resolvedCategoryId)
      : resolvedCategoryId
    const beneficiaryId = (await resolveBeneficiaryRef(tx, actor, input)) ?? null
    const txDate = input.date ?? todayInTz(timezone)
    const [row] = await tx<{ id: string }[]>`
      select id from post_transaction(
        ${actor.householdId}, ${actor.memberId}, ${input.type}, ${accountId}, ${categoryId},
        ${amount}, ${txDate}, ${input.note ?? ''}, ${txSource(actor)}, null, ${beneficiaryId}
      )
    `
    if (recorderId !== actor.memberId) {
      await tx`update transactions set recorded_by_member_id = ${recorderId} where id = ${row!.id}`
    }
    if (parsedNote?.merchant) {
      await syncTransactionPrice(tx, actor.householdId, {
        id: row!.id,
        type: input.type,
        amount,
        date: txDate,
        note: input.note ?? '',
      })
    }
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [row!.id])
    const [accRow] = await tx<{ balance: string }[]>`select balance::text from v_account_balances where account_id = ${accountId}`
    return { transaction: mapTx(rows[0]!), account: { id: accountId, balance: Number(accRow!.balance) } }
  })
}

export async function createTransactionBatch(actor: Actor, input: { account_id?: string; account?: string; date?: string; recorded_by_id?: string; recorded_by?: string; items: Array<{ amount?: number; amount_text?: string; qty?: number; discount?: number; category_id?: string; category?: string; note?: string; beneficiary_id?: string; beneficiary?: string; titipan?: string }> }, timezone: string) {
  // Item berformat struk "[Toko] Nama item" (modal scan web) → riwayat harga per toko (prices.ts).
  // Kanonikalisasi di luar transaksi DB; biasanya sudah ter-cache sejak scan, jadi tanpa panggilan AI.
  const parsedNotes = input.items.map((i) => (i.note ? parseReceiptNote(i.note) : null))
  const priceNames = parsedNotes.filter((p) => p?.merchant).map((p) => p!.name)
  if (priceNames.length) await canonicalizeProducts(actor, priceNames)
  return withActor(actor, async (tx) => {
    const explicitRecorderId = await resolveExplicitRecorder(tx, actor, input)
    const accountId = await resolveAccountRef(tx, actor, input, 'account', explicitRecorderId)
    const recorderId = await resolveEffectiveRecorder(tx, actor, input, accountId, explicitRecorderId)
    const piutangCatId = await piutangCategoryId(tx, actor.householdId)
    // Titipan (titipan.ts): field `titipan`, kata "titipan" di note, ATAU kategori dipilih "Piutang"
    // (dropdown modal web) → kategori Piutang + catatan piutang atas nama orangnya.
    const items = await Promise.all(
      input.items.map(async (item, idx) => {
        const resolvedCat0 = await resolveCategoryRef(tx, actor, item, 'expense')
        const resolvedCat = actor.credential === 'api_key' ? await refineAgentCategory(tx, actor.householdId, item.note, resolvedCat0) : resolvedCat0
        const titipan = detectTitipan(item.note, item.titipan) ?? (resolvedCat === piutangCatId ? { borrower: 'Titipan' } : null)
        const baseNote = titipan ? titipanDisplayName(item.note ?? '', titipan) : (item.note ?? '')
        const parsed = parsedNotes[idx]
        const withQtyNote =
          item.qty && item.qty > 1 && baseNote
            ? parsed?.merchant
              ? formatReceiptNote(titipan ? titipanDisplayName(parsed.name, titipan) : parsed.name, parsed.merchant, parsed.refNo, item.qty)
              : formatReceiptNote(baseNote, null, null, item.qty)
            : baseNote
        return {
          amount: parseAmount(item),
          category_id: titipan ? piutangCatId : resolvedCat,
          note: withQtyNote.slice(0, 500),
          beneficiary_id: (await resolveBeneficiaryRef(tx, actor, item)) ?? null,
          titipan,
        }
      }),
    )
    const date = input.date ?? todayInTz(timezone)
    // BUG NYATA ditemukan saat implementasi F-A (belum pernah ketahuan — tidak ada test yang
    // memanggil /v1/transactions/batch sebelumnya): `${JSON.stringify(items)}::jsonb` membuat
    // postgres.js men-stringify ULANG nilai yang sudah string karena melihat cast `::jsonb` di
    // tagged template, menghasilkan jsonb STRING SCALAR (bukan ARRAY) -> post_transactions_batch
    // akan gagal di `jsonb_array_length(p_items)`. `tx.json(items)` adalah satu-satunya cara aman
    // (pola sama dengan routes/me.ts).
    const dbItems = items.map(({ titipan: _t, ...rest }) => rest)
    const createdRows = await tx<{ id: string; note: string; amount: string }[]>`
      select id, note, amount::text from post_transactions_batch(${actor.householdId}, ${actor.memberId}, ${accountId}, ${date}, ${tx.json(dbItems as unknown as postgres.JSONValue)}, ${txSource(actor)})
    `
    const ids = createdRows.map((r) => r.id)
    if (recorderId !== actor.memberId && ids.length > 0) {
      await tx.unsafe(`update transactions set recorded_by_member_id = $1 where id = any($2::uuid[])`, [recorderId, ids])
    }
    // Lewat web (JWT) user sudah meninjau kategori tiap item di modal scan sebelum menyimpan — itu
    // konfirmasi manusia, jadi dipelajari (category_keywords). Lewat API key kategori masih tebakan
    // agent; belajar baru terjadi saat user mengoreksinya (updateTransaction). Titipan tidak dipelajari.
    if (actor.credential === 'jwt') await learnKeywords(tx, actor.householdId, items.filter((i) => !i.titipan).map((i) => ({ note: i.note, categoryId: i.category_id })))
    // Korelasi item → baris lewat note+amount (urutan RETURNING tidak dijamin), pola sama dengan receipts.ts.
    const remaining = [...createdRows]
    const titipanCreated: TitipanCreated[] = []
    const pricesByMerchant = new Map<string, PriceItem[]>()
    for (const [i, it] of items.entries()) {
      const pos = remaining.findIndex((r) => r.note === it.note && Number(r.amount) === it.amount)
      const txId = pos === -1 ? undefined : remaining.splice(pos, 1)[0]!.id
      const parsed = parsedNotes[i]
      const itemName = parsed?.name || it.note || 'item'
      if (it.titipan) titipanCreated.push({ txId, borrower: it.titipan.borrower, name: itemName, amount: it.amount })
      if (parsed?.merchant) {
        const list = pricesByMerchant.get(parsed.merchant) ?? []
        list.push({
          transaction_id: txId,
          name: parsed.name,
          qty: input.items[i]?.qty ?? parsed.qty,
          amount: it.amount,
          discount: input.items[i]?.discount,
        })
        pricesByMerchant.set(parsed.merchant, list)
      }
    }
    const piutang = titipanCreated.length ? await createTitipanPiutang(tx, actor, { accountId, ownerMemberId: recorderId, created: titipanCreated }) : []
    for (const [merchant, list] of pricesByMerchant) await recordPrices(tx, actor.householdId, merchant, date, list)
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = any($1::uuid[])`, [ids])
    const [accRow] = await tx<{ balance: string }[]>`select balance::text from v_account_balances where account_id = ${accountId}`
    return { transactions: rows.map(mapTx), account: { id: accountId, balance: Number(accRow!.balance) }, ...(piutang.length ? { piutang } : {}) }
  })
}

export interface UpdateTransactionInput {
  amount?: number
  amount_text?: string
  type?: 'income' | 'expense'
  account_id?: string
  account?: string
  category_id?: string
  category?: string
  date?: string
  note?: string
  qty?: number
  discount?: number
  beneficiary_id?: string | null
  beneficiary?: string
  recorded_by_id?: string
  recorded_by?: string
}

export async function updateTransaction(actor: Actor, id: string, input: UpdateTransactionInput) {
  const parsedNote = input.note ? parseReceiptNote(input.note) : null
  if (parsedNote?.merchant && parsedNote.name) {
    await canonicalizeProducts(actor, [parsedNote.name])
  }
  return withActor(actor, async (tx) => {
    const newRecorderId = await resolveExplicitRecorder(tx, actor, input)
    const patch: Record<string, unknown> = {}
    if (input.amount !== undefined || input.amount_text !== undefined) patch.amount = parseAmount(input)
    if (input.type !== undefined) patch.type = input.type
    if (input.account_id || input.account) patch.account_id = await resolveAccountRef(tx, actor, input, 'account', newRecorderId)
    if (input.category_id || input.category) patch.category_id = await resolveCategoryRef(tx, actor, input)
    if (input.date !== undefined) patch.date = input.date
    if (input.note !== undefined) patch.note = input.note
    if (touchesBeneficiary(input)) {
      // null eksplisit di body -> resolveBeneficiaryRef mengembalikan undefined -> ?? null di sini
      // sengaja menulis KEY `beneficiary_id` dengan nilai jsonb null (bukan key dihilangkan) supaya
      // update_transaction (p_patch ? 'beneficiary_id') membedakan "tidak disentuh" vs "dikosongkan".
      patch.beneficiary_id = (await resolveBeneficiaryRef(tx, actor, input)) ?? null
    }

    await tx`select update_transaction(${actor.householdId}, ${actor.memberId}, ${id}, ${tx.json(patch as unknown as postgres.JSONValue)})`
    if (newRecorderId) {
      await tx`update transactions set recorded_by_member_id = ${newRecorderId} where id = ${id}`
    }
    let rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [id])
    // Sinkronkan juga ke product_prices bila nominal/tanggal/note/type/qty/discount berubah
    if (patch.amount !== undefined || patch.date !== undefined || patch.note !== undefined || patch.type !== undefined || input.qty !== undefined || input.discount !== undefined) {
      await syncTransactionPrice(tx, actor.householdId, {
        id: rows[0]!.id,
        type: rows[0]!.type,
        amount: Number(rows[0]!.amount),
        date: rows[0]!.date,
        note: rows[0]!.note,
        qty: input.qty,
        discount: input.discount,
      })
      rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [id])
    }
    // Koreksi kategori eksplisit (web maupun Hermes) = sinyal terkuat untuk gudang kata kunci.
    if (typeof patch.category_id === 'string') await learnKeywords(tx, actor.householdId, [{ note: rows[0]!.note, categoryId: patch.category_id }])
    return mapTx(rows[0]!)
  })
}

export async function deleteTransaction(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    await tx`select delete_transaction(${actor.householdId}, ${actor.memberId}, ${id})`
    // TX_SELECT tidak menyertakan filter deleted_at; baris yang baru di-soft-delete tetap terbaca di sini.
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [id])
    return mapTx(rows[0]!)
  })
}

export async function restoreTransaction(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    await tx`select restore_transaction(${actor.householdId}, ${actor.memberId}, ${id})`
    const rows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = $1`, [id])
    return mapTx(rows[0]!)
  })
}
