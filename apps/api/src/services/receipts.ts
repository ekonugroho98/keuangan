import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { requireFeature } from './features'
import { resolveAccountRef, resolveCategoryRef, resolveBeneficiaryRef } from './resolver'
import { classifyItems } from './categorize'
import { formatReceiptNote } from '@karaya/shared/format'
import { canonicalizeProducts, recordPrices, type PriceItem } from './prices'
import { createTitipanPiutang, detectTitipan, piutangCategoryId, titipanDisplayName, type TitipanCreated } from './titipan'
import { todayInTz } from './period'
import { getHouseholdTimezone } from './households'
import { TX_SELECT, mapTx, type TxRow } from './transactions'

interface ReceiptItemInput {
  name: string
  qty: number
  amount: number
  category_id?: string
  category?: string
  for?: string
  titipan?: string
}

export interface IngestReceiptInput {
  account_id?: string
  account?: string
  date?: string
  merchant?: string
  items: ReceiptItemInput[]
  total?: number
  ref_no?: string
  shopping: boolean
  pantry: boolean
}

/**
 * F-D (10-fitur-opsional-keluarga.md §6.3): satu struk -> post_transactions_batch (sumber
 * kebenaran uang, TIDAK diduplikasi di sini) + coret shopping list + tambah stok pantry, SEMUA
 * dalam satu transaksi DB (kalau batch gagal — mis. saldo kurang — tidak ada yang tercoret/
 * bertambah: exception dari post_transactions_batch membatalkan seluruh `withActor`).
 */
export async function ingestReceipt(actor: Actor, input: IngestReceiptInput) {
  await requireFeature(actor, 'shopping_stock')

  const sumAmount = input.items.reduce((s, i) => s + i.amount, 0)
  if (input.total !== undefined && input.total !== sumAmount) {
    throw ApiError.fromCode('receipt_total_mismatch', { details: { sum_items: sumAmount, total: input.total } })
  }

  const timezone = await getHouseholdTimezone(actor)
  // `category` dari agent adalah teks bebas (bisa kosong, typo, atau nama taksonomi lain seperti
  // "Makanan & Minuman"/"Tagihan") — diklasifikasi dulu (categorize.ts: kata kunci yang dipelajari
  // user > jawaban agent > gudang produk > regex > pencarian web > "Lainnya") SEBELUM transaksi DB
  // utama dibuka, karena pencarian web bisa lambat. Satu item tak dikenal tidak lagi menggagalkan
  // seluruh struk dan tidak nyasar lewat fuzzy match.
  // Titipan (titipan.ts): barang untuk orang lain yang akan mengganti uangnya → kategori Piutang +
  // catatan piutang otomatis; tidak ikut diklasifikasi (bukan pengeluaran keluarga) dan tidak dipelajari.
  const titipan = input.items.map((item) => detectTitipan(item.name, item.titipan))
  const toClassify = input.items.map((item, idx) => ({ idx, name: item.name, aiCategory: item.category })).filter((x) => !titipan[x.idx])
  const classifiedList = await classifyItems(actor, toClassify, { webLookup: true })
  const classified = new Map(toClassify.map((x, i) => [x.idx, classifiedList[i]!]))
  // Perbandingan harga antar toko (prices.ts): seragamkan nama kasir → produk kanonik (satu panggilan AI
  // BYOK per struk, di-cache global) SEBELUM transaksi DB dibuka. Best-effort, tidak pernah gagal.
  if (input.merchant) await canonicalizeProducts(actor, input.items.map((i) => i.name))
  return withActor(actor, async (tx) => {
    const accountId = await resolveAccountRef(tx, actor, input)
    const piutangCatId = titipan.some(Boolean) ? await piutangCategoryId(tx, actor.householdId) : null
    // Note kanonik "[Toko] Nama item [ref: NOMOR]" (formatReceiptNote): toko di depan supaya terbaca
    // dan bisa diurai untuk perbandingan harga antar toko; `[ref: ...]` untuk F-C rekonsiliasi
    // (spec §5.4: ref_no di note = +40 skor). Dipotong ke 500 (check constraint transactions.note).
    const displayNames = input.items.map((item, idx) => titipanDisplayName(item.name, titipan[idx]!))
    const noteFor = (idx: number) => formatReceiptNote(displayNames[idx]!, input.merchant, input.ref_no).slice(0, 500)
    const items = await Promise.all(
      input.items.map(async (item, idx) => ({
        amount: item.amount,
        category_id: titipan[idx]
          ? piutangCatId!
          : item.category_id
            ? await resolveCategoryRef(tx, actor, item, 'expense')
            : await resolveCategoryRef(tx, actor, { category: classified.get(idx)!.category }, 'expense'),
        note: noteFor(idx),
        // Gate fitur F-A ada di dalam resolveBeneficiaryRef — `for` saat beneficiary mati -> 400.
        beneficiary_id: item.for ? ((await resolveBeneficiaryRef(tx, actor, { beneficiary: item.for })) ?? null) : null,
      })),
    )
    const date = input.date ?? todayInTz(timezone)

    const createdIdRows = await tx<{ id: string; note: string; amount: string }[]>`
      select id, note, amount::text from post_transactions_batch(
        ${actor.householdId}, ${actor.memberId}, ${accountId}, ${date}, ${tx.json(items as unknown as postgres.JSONValue)}, 'web'
      )
    `

    // Korelasi item asli -> baris transaksi yang baru dibuat lewat note+amount (bukan index posisi
    // array — jsonb_array_elements TIDAK dijamin Postgres mempertahankan urutan untuk
    // INSERT...SELECT...RETURNING tanpa ORDER BY eksplisit; note+amount tahan terhadap itu, dan
    // note di sini SELALU persis noteFor(item.name) yang kita kirim sebagai item.note di atas).
    const remaining = [...createdIdRows]
    function takeMatch(idx: number, amount: number): string | undefined {
      const expected = noteFor(idx)
      const pos = remaining.findIndex((r) => r.note === expected && Number(r.amount) === amount)
      if (pos === -1) return undefined
      return remaining.splice(pos, 1)[0]!.id
    }

    const shoppingMarked: { id: string; name: string }[] = []
    const shoppingUnmatched: string[] = []
    const pantryUpdated: { name: string; qty_before: number; qty_after: number }[] = []
    const pantryUnmatched: string[] = []
    const titipanCreated: TitipanCreated[] = []
    const priceItems: PriceItem[] = []

    for (const [idx, item] of input.items.entries()) {
      const txId = takeMatch(idx, item.amount)
      priceItems.push({ transaction_id: txId, name: item.name, qty: item.qty, amount: item.amount })
      if (titipan[idx]) titipanCreated.push({ txId, borrower: titipan[idx]!.borrower, name: item.name, amount: item.amount })

      if (input.shopping) {
        const [match] = await tx<{ id: string | null }[]>`select find_shopping_match(${actor.householdId}, ${item.name}) as id`
        if (match?.id) {
          await tx`update shopping_items set status = 'bought', bought_transaction_id = ${txId ?? null}, bought_at = now(), updated_at = now() where id = ${match.id}`
          shoppingMarked.push({ id: match.id, name: item.name })
        } else {
          shoppingUnmatched.push(item.name)
        }
      }

      if (input.pantry) {
        const [pantryRow] = await tx<{ id: string; qty: string }[]>`
          select id, qty::text from pantry_items where id = find_pantry_match(${actor.householdId}, ${item.name})
        `
        if (pantryRow) {
          const before = Number(pantryRow.qty)
          await tx`select apply_pantry_movement(${actor.householdId}, ${actor.memberId}, ${pantryRow.id}, ${item.qty}, 'purchase', ${txId ?? null}, ${'dari struk: ' + item.name})`
          pantryUpdated.push({ name: item.name, qty_before: before, qty_after: before + item.qty })
        } else {
          pantryUnmatched.push(item.name)
        }
      }
    }

    const piutang = titipanCreated.length ? await createTitipanPiutang(tx, actor, { accountId, merchant: input.merchant, created: titipanCreated }) : []
    const pricesRecorded = await recordPrices(tx, actor.householdId, input.merchant, date, priceItems)

    const ids = createdIdRows.map((r) => r.id)
    const fullRows = await tx.unsafe<TxRow[]>(`${TX_SELECT} where t.id = any($1::uuid[])`, [ids])
    const [accRow] = await tx<{ balance: string }[]>`select balance::text from v_account_balances where account_id = ${accountId}`

    return {
      transactions: fullRows.map(mapTx),
      account: { id: accountId, balance: accRow ? Number(accRow.balance) : null },
      ...(piutang.length ? { piutang } : {}),
      prices_recorded: pricesRecorded,
      ...(input.shopping ? { shopping: { marked_bought: shoppingMarked, unmatched: shoppingUnmatched } } : {}),
      ...(input.pantry ? { pantry: { updated: pantryUpdated, unmatched: pantryUnmatched } } : {}),
    }
  })
}
