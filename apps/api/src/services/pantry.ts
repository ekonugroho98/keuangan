import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { parseReceiptNote } from '@karaya/shared/format'
import { PANTRY_LOCATION_ALIASES } from '@karaya/shared/schemas'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { requireFeature } from './features'
import { getHouseholdTimezone } from './households'
import { resolvePeriod } from './period'

export interface PantryItemOut {
  id: string
  name: string
  unit: string
  qty: number
  min_qty: number | null
  location: 'fridge' | 'freezer' | 'shelf' | 'other'
  category: string | null
  expires_at: string | null
  expires_estimated: boolean
  aliases: string[]
}

const SELECT = `select id, name, unit, qty::float as qty, min_qty::float as min_qty, location::text as location, category, expires_at::text as expires_at, expires_estimated, aliases from pantry_items`

/** Terima nama lokasi Indonesia atau Inggris (§6.4); nama yang tidak dikenal -> validation_error. */
export function normalizeLocation(input: string | undefined, field = 'location'): 'fridge' | 'freezer' | 'shelf' | 'other' | undefined {
  if (input === undefined) return undefined
  const key = input.trim().toLowerCase()
  const value = PANTRY_LOCATION_ALIASES[key]
  if (!value) throw ApiError.fromCode('validation_error', { message: `Lokasi "${input}" tidak dikenal.`, details: { field, allowed: Object.keys(PANTRY_LOCATION_ALIASES) } })
  return value
}

export async function listPantry(actor: Actor, location?: string): Promise<PantryItemOut[]> {
  await requireFeature(actor, 'shopping_stock')
  const loc = normalizeLocation(location, 'location')
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<PantryItemOut[]>(
      loc
        ? `${SELECT} where household_id = $1 and deleted_at is null and location = $2 order by name`
        : `${SELECT} where household_id = $1 and deleted_at is null order by location, name`,
      loc ? [actor.householdId, loc] : [actor.householdId],
    )
    return rows
  })
}

export async function createPantryItem(
  actor: Actor,
  input: { name: string; unit: string; qty: number; min_qty?: number; location?: string; category?: string; expires_at?: string; expires_estimated: boolean; aliases: string[] },
): Promise<PantryItemOut> {
  await requireFeature(actor, 'shopping_stock')
  const location = normalizeLocation(input.location) ?? 'other'
  return withActor(actor, async (tx) => {
    try {
      const [row] = await tx<{ id: string }[]>`
        insert into pantry_items (household_id, name, unit, qty, min_qty, location, category, expires_at, expires_estimated, aliases)
        values (${actor.householdId}, ${input.name}, ${input.unit}, ${input.qty}, ${input.min_qty ?? null}, ${location}, ${input.category ?? null}, ${input.expires_at ?? null}, ${input.expires_estimated}, ${input.aliases})
        returning id
      `
      const rows = await tx.unsafe<PantryItemOut[]>(`${SELECT} where id = $1`, [row!.id])
      return rows[0]!
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw ApiError.fromCode('validation_error', { message: 'Sudah ada item pantry dengan nama ini.', details: { field: 'name' } })
      }
      throw err
    }
  })
}

export async function updatePantryItem(
  actor: Actor,
  id: string,
  input: { name?: string; unit?: string; min_qty?: number | null; location?: string; category?: string | null; expires_at?: string | null; expires_estimated?: boolean; aliases?: string[] },
): Promise<PantryItemOut> {
  await requireFeature(actor, 'shopping_stock')
  const location = normalizeLocation(input.location)
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from pantry_items where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('pantry_item_not_found')
    try {
      await tx`
        update pantry_items set
          name = coalesce(${input.name ?? null}, name),
          unit = coalesce(${input.unit ?? null}, unit),
          min_qty = case when ${input.min_qty === undefined} then min_qty else ${input.min_qty ?? null}::numeric end,
          location = coalesce(${location ?? null}, location),
          category = case when ${input.category === undefined} then category else ${input.category ?? null}::text end,
          expires_at = case when ${input.expires_at === undefined} then expires_at else ${input.expires_at ?? null}::date end,
          expires_estimated = coalesce(${input.expires_estimated ?? null}, expires_estimated),
          aliases = coalesce(${input.aliases ?? null}, aliases),
          updated_at = now()
        where id = ${id} and household_id = ${actor.householdId}
      `
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw ApiError.fromCode('validation_error', { message: 'Sudah ada item pantry lain dengan nama ini.', details: { field: 'name' } })
      }
      throw err
    }
    const rows = await tx.unsafe<PantryItemOut[]>(`${SELECT} where id = $1`, [id])
    return rows[0]!
  })
}

export async function deletePantryItem(actor: Actor, id: string): Promise<{ success: true }> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update pantry_items set deleted_at = now(), updated_at = now()
      where id = ${id} and household_id = ${actor.householdId} and deleted_at is null
      returning id
    `
    if (!row) throw ApiError.fromCode('pantry_item_not_found')
    return { success: true as const }
  })
}

export async function addPantryMovement(actor: Actor, id: string, input: { delta: number; reason: 'purchase' | 'consume' | 'adjust' | 'expired'; note: string }): Promise<PantryItemOut> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    await tx`select apply_pantry_movement(${actor.householdId}, ${actor.memberId}, ${id}, ${input.delta}, ${input.reason}, null, ${input.note})`
    const rows = await tx.unsafe<PantryItemOut[]>(`${SELECT} where id = $1`, [id])
    if (!rows[0]) throw ApiError.fromCode('pantry_item_not_found')
    return rows[0]
  })
}

export interface ExpiringItem {
  id: string
  name: string
  qty: number
  unit: string
  location: string
  expires_at: string
  expires_estimated: boolean
  days_left: number
}

/**
 * §6.6: `within_days` dari parameter (default dipanggil Hermes dengan nilai flag `days_before`);
 * `text_id` kosong -> Hermes tidak kirim pesan. `excludeAcked` (query `?exclude_acked=true`) DIPAKAI
 * KHUSUS oleh cron pengingat terjadwal — pertanyaan manual lewat chat/web TIDAK mengirim param ini,
 * jadi selalu lihat semua. Aturan spec §6.4 "diingatkan sekali, sekali lagi di hari H, lalu berhenti":
 * tampil kalau BELUM pernah di-ack, ATAU hari ini tepat hari H dan ack-nya dari hari sebelumnya.
 * Setelah lewat hari H dan sudah di-ack, berhenti (review 2026-10-07: versi awal hanya menyaring
 * `notified_on = hari ini`, jadi barang yang sama diingatkan ulang tiap hari sampai basi).
 */
export async function getExpiring(actor: Actor, withinDays: number, includeExpired: boolean, excludeAcked: boolean) {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    const rows = await tx<{ id: string; name: string; qty: string; unit: string; location: string; expires_at: string; expires_estimated: boolean; days_left: number }[]>`
      select id, name, qty::text, unit, location::text as location, expires_at::text as expires_at, expires_estimated,
        (expires_at - current_date)::int as days_left
      from pantry_items
      where household_id = ${actor.householdId} and deleted_at is null and qty > 0 and expires_at is not null
        and expires_at <= current_date + ${withinDays}::int
        and (${includeExpired} or expires_at >= current_date)
        and (
          not ${excludeAcked}
          or expiry_notified_on is null
          or (expires_at = current_date and expiry_notified_on < current_date)
        )
      order by expires_at
    `
    const expired = rows.filter((r) => r.days_left < 0).map(mapExpiring)
    const expiring = rows.filter((r) => r.days_left >= 0).map(mapExpiring)
    const text = buildExpiringText(expired, expiring)
    return { expired, expiring, text_id: text }
  })
}

function mapExpiring(r: { id: string; name: string; qty: string; unit: string; location: string; expires_at: string; expires_estimated: boolean; days_left: number }): ExpiringItem {
  return { id: r.id, name: r.name, qty: Number(r.qty), unit: r.unit, location: r.location, expires_at: r.expires_at, expires_estimated: r.expires_estimated, days_left: r.days_left }
}

const LOCATION_LABEL_ID: Record<string, string> = { fridge: 'Kulkas', freezer: 'Freezer', shelf: 'Lemari', other: 'Lainnya' }

function buildExpiringText(expired: ExpiringItem[], expiring: ExpiringItem[]): string {
  if (expired.length === 0 && expiring.length === 0) return ''
  const lines = ['🥛 Pantry — cek hari ini']
  const describe = (i: ExpiringItem) => `${i.name} (${LOCATION_LABEL_ID[i.location] ?? i.location}${i.expires_estimated ? ', perkiraan' : ''} ${i.expires_at.slice(8, 10)}/${i.expires_at.slice(5, 7)})`
  for (const i of expired) lines.push(`Sudah lewat: ${describe(i)}`)
  for (const i of expiring) {
    const label = i.days_left === 0 ? 'Hari ini' : i.days_left === 1 ? 'Besok' : `${i.days_left} hari lagi`
    lines.push(`${label}: ${describe(i)}`)
  }
  lines.push('Balas "X dibuang" / "X udah abis" biar stoknya diupdate.')
  return lines.join('\n')
}

export async function ackExpiring(actor: Actor, ids: string[]): Promise<{ success: true }> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    await tx`update pantry_items set expiry_notified_on = current_date where id = any(${ids}) and household_id = ${actor.householdId}`
    return { success: true as const }
  })
}

// ── Auto-Stok dari Transaksi Belanja (§6.9) ───────────────────────────────────────────

const FREEZER_RE = /\b(ayam|daging|sapi|kambing|ikan|mujair|nila|lele|tongkol|bandeng|salmon|tuna|dori|cumi|sotong|udang|kepiting|kerang|sosis|nugget|pangsit|dimsum|bakso|otak[-\s]*otak|frozen|es\s*krim|ice\s*cream)\b/i
const FRIDGE_RE = /\b(sayur|bayam|kangkung|sawi|pakcoy|wortel|tomat|cabe|cabai|bawang\s*daun|daun\s*bawang|seledri|brokoli|kembang\s*kol|kol|kubis|buncis|kacang\s*panjang|timun|terong|labu|jagung|oyong|tauge|toge|jamur|jeruk|pisang|apel|anggur|mangga|pepaya|semangka|melon|alpukat|pir|buah|tempe|tahu|telur|telor|susu|keju|mentega|margarin|butter|yogurt|yoghurt|yakult|cincau|santan\s*segar)\b/i
const SHELF_RE = /\b(beras|minyak|tepung|terigu|maizena|tapioka|sagu|gula|garam|kecap|saus|saos|sambal|mie|mi\s*instan|indomie|bihun|soun|makaroni|pasta|spaghetti|bumbu|ladaku|merica|lada|ketumbar|kapulaga|kayu\s*manis|bunga\s*lawang|cengkeh|pala|asam\s*jawa|kemiri|kunyit|jahe|lengkuas|sereh|serai|daun\s*salam|daun\s*jeruk|bawang\s*merah|bawang\s*putih|bawang\s*bombay|penyedap|royco|masako|sasa|ajinomoto|totole|kaldu|santan|kara|teh|kopi|sirup|madu|selai|meses|cokelat\s*bubuk|galon|aqua|air\s*mineral|roti|popok|pampers|diapers|sabun|shampoo|odol|pasta\s*gigi|deterjen|rinso|sunlight|mama\s*lemon|tisu|tissue)\b/i

const LONGER_FRIDGE_RE = /\b(telur|telor|jeruk|apel|pir|keju|mentega|margarin|butter|yakult|susu\s*uht)\b/i
const SHORT_SHELF_RE = /\b(roti|donat|bolu)\b/i
const NON_STOCK_SNACK_RE = /^(es\s+teh|es\s+jeruk|kopi\s+kenangan|janji\s+jiwa|fore\s+coffee|gofood|grabfood|shopeefood|parkir|bensin|pertalite|pertamax|tol|pulsa|token\s+listrik|keripik|chiki|permen|biskuit|wafer|Seblak|Martabak|Nasi\s+Padang|Nasi\s+Goreng|Mie\s+Ayam|Bakso\s+Malang|Sate\s+Ayam|Pecel\s+Lele)\b/i

export function inferPantryLocation(itemName: string): 'fridge' | 'freezer' | 'shelf' | 'other' {
  const s = itemName.trim()
  if (FREEZER_RE.test(s)) return 'freezer'
  if (SHELF_RE.test(s)) return 'shelf'
  if (FRIDGE_RE.test(s)) return 'fridge'
  return 'fridge'
}

export function inferExpiryDate(
  itemName: string,
  location: 'fridge' | 'freezer' | 'shelf' | 'other',
  baseDateStr?: string,
): string | null {
  const base = baseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)
    ? new Date(`${baseDateStr}T00:00:00Z`)
    : new Date()
  if (Number.isNaN(base.getTime())) return null

  let addDays: number | null = null
  if (location === 'freezer') {
    addDays = 30
  } else if (location === 'fridge') {
    addDays = LONGER_FRIDGE_RE.test(itemName) ? 14 : 5
  } else if (location === 'shelf') {
    addDays = SHORT_SHELF_RE.test(itemName) ? 4 : null
  }
  if (addDays === null) return null
  const target = new Date(base.getTime() + addDays * 86_400_000)
  return target.toISOString().slice(0, 10)
}

/**
 * Mengurai nama barang, kuantitas, dan satuan dari note transaksi atau nama item struk.
 * Contoh:
 *  - "[Hari Hari Pasar Swalayan BCP] Ayam Broiler 3 ekor" -> { cleanName: "Ayam Broiler", qty: 3, unit: "ekor" }
 *  - "[Kios Sayur Caman] Pisang 1 sikat" -> { cleanName: "Pisang", qty: 1, unit: "sikat" }
 *  - "[Kios Sayur Caman] Ikan mujair 0.5 kg" -> { cleanName: "Ikan mujair", qty: 0.5, unit: "kg" }
 *  - "[Kios Sayur Caman] Wortel x3" -> { cleanName: "Wortel", qty: 3, unit: "pcs" }
 */
export function extractStockItemInfo(
  rawNoteOrName: string,
  explicitQty?: number | null,
): { cleanName: string; qty: number; unit: string } {
  const parsed = parseReceiptNote(rawNoteOrName || '')
  let name = (parsed.name || rawNoteOrName || '').trim()
  // Buang tag awalan seperti [KANTOR], [PRIBADI], [KELUARGA]
  name = name.replace(/^\[(?:KANTOR|PRIBADI|KELUARGA|RUMAH)\]\s*/i, '').trim()
  // Buang akhiran (titipan ...) jika ada
  name = name.replace(/\s*\(titipan[^)]*\)\s*$/i, '').trim()

  const baseQty = explicitQty && explicitQty > 0 ? explicitQty : parsed.qty && parsed.qty > 0 ? parsed.qty : 1

  // Cek pola "<Nama Barang> <angka> <satuan dapur>" di akhir kalimat
  // Satuan dapur kontekstual (ekor, ikat, sikat, sisir, papan, tray, bungkus, bks, pak, pack, potong, ptg, butir, btr, buah, bh, kg, ons, liter, galon)
  const unitMatch = name.match(
    /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(ekor|ikat|sikat|sisir|papan|tray|bungkus|bks|pak|pack|potong|ptg|butir|btr|buah|bh|kg|ons|galon)$/i,
  )
  if (unitMatch) {
    const cleanName = unitMatch[1]!.trim()
    const num = Number(unitMatch[2]!.replace(',', '.'))
    const rawUnit = unitMatch[3]!.toLowerCase()
    const unitMap: Record<string, string> = {
      bks: 'bungkus',
      pak: 'pack',
      ptg: 'potong',
      btr: 'butir',
      bh: 'buah',
    }
    const unit = unitMap[rawUnit] ?? rawUnit
    if (cleanName && num > 0) {
      return { cleanName, qty: +(num * (baseQty > 1 && baseQty !== num ? baseQty : 1)).toFixed(3), unit }
    }
  }

  // Cek pola "<Nama Barang> x<angka>" atau "<Nama Barang> (<angka> pcs)"
  const multMatch = name.match(/^(.+?)\s+(?:x(\d+(?:[.,]\d+)?)|\((\d+(?:[.,]\d+)?)\s*(pcs|pack|bungkus|ekor|ikat|kg)\))$/i)
  if (multMatch) {
    const cleanName = multMatch[1]!.trim()
    const num = Number((multMatch[2] ?? multMatch[3] ?? '1').replace(',', '.'))
    const unit = (multMatch[4] ?? 'pcs').toLowerCase()
    if (cleanName && num > 0) {
      return { cleanName, qty: num, unit }
    }
  }

  return {
    cleanName: name,
    qty: baseQty,
    unit: 'pcs',
  }
}

export interface SyncPurchaseResult {
  action: 'updated' | 'created' | 'skipped'
  id?: string
  name: string
  qty_before?: number
  qty_after?: number
  unit?: string
  location?: string
}

export async function syncPurchaseToPantry(
  tx: postgres.TransactionSql,
  actor: Actor,
  params: {
    txId?: string
    rawName: string
    explicitQty?: number | null
    categoryName?: string | null
    date?: string
    isTitipan?: boolean
    createNewItems: boolean
    sourceLabel?: string
  },
): Promise<SyncPurchaseResult> {
  if (params.isTitipan) {
    return { action: 'skipped', name: params.rawName }
  }
  const catLower = (params.categoryName ?? '').trim().toLowerCase()
  if (['piutang', 'transfer', 'koreksi saldo', 'tabungan & goal', 'hutang & cicilan'].includes(catLower)) {
    return { action: 'skipped', name: params.rawName }
  }

  // Idempotensi: jika transaksi ini sudah pernah tercatat di pantry_movements, lewati
  if (params.txId) {
    const [existingMov] = await tx<{ id: string }[]>`
      select id from pantry_movements
      where household_id = ${actor.householdId} and transaction_id = ${params.txId}
      limit 1
    `
    if (existingMov) {
      return { action: 'skipped', name: params.rawName }
    }
  }

  const info = extractStockItemInfo(params.rawName, params.explicitQty)
  if (!info.cleanName || info.cleanName.length < 2) {
    return { action: 'skipped', name: params.rawName }
  }

  // 1. Cari kecocokan di pantry_items yang sudah ada
  const [pantryRow] = await tx<{ id: string; name: string; qty: string; unit: string; location: string; expires_at: string | null }[]>`
    select id, name, qty::text, unit, location::text as location, expires_at::text as expires_at
    from pantry_items
    where id = find_pantry_match(${actor.householdId}, ${info.cleanName})
  `

  const notePrefix = params.sourceLabel ?? 'otomatis dari belanja'

  if (pantryRow) {
    const before = Number(pantryRow.qty)
    await tx`
      select apply_pantry_movement(
        ${actor.householdId},
        ${actor.memberId},
        ${pantryRow.id},
        ${info.qty},
        'purchase',
        ${params.txId ?? null},
        ${notePrefix + ': ' + info.cleanName}
      )
    `
    // Bila stok sebelumnya habis (<= 0), perbarui estimasi kedaluwarsa untuk batch baru
    if (before <= 0) {
      const loc = (pantryRow.location as 'fridge' | 'freezer' | 'shelf' | 'other') || 'fridge'
      const newExp = inferExpiryDate(pantryRow.name, loc, params.date)
      if (newExp) {
        await tx`
          update pantry_items
          set expires_at = ${newExp}::date, expires_estimated = true, expiry_notified_on = null, updated_at = now()
          where id = ${pantryRow.id} and household_id = ${actor.householdId}
        `
      }
    }
    return {
      action: 'updated',
      id: pantryRow.id,
      name: pantryRow.name,
      qty_before: before,
      qty_after: +(before + info.qty).toFixed(3),
      unit: pantryRow.unit,
      location: pantryRow.location,
    }
  }

  // 2. Jika belum ada di pantry_items, cek apakah boleh membuat item baru
  const rawGroceryRe =
    /\b(ayam|daging|sapi|kambing|ikan|mujair|nila|lele|salmon|tuna|tongkol|bandeng|udang|cumi|sosis|nugget|sayur|bayam|kangkung|sawi|brokoli|wortel|kentang|tomat|timun|terong|buncis|kacang|kol|kubis|cabe|cabai|bawang|jeruk|apel|anggur|mangga|pisang|pepaya|semangka|melon|buah|tempe|tahu|telur|susu|keju|yogurt|yakult|mentega|butter|beras|minyak|tepung|gula|garam|kecap|saus|sambal|mie|indomie|pasta|bumbu|royco|masako|sasa|ladaku|ketumbar|merica|lada|kemiri|kunyit|jahe|lengkuas|serai|sereh|daun\s+salam|daun\s+jeruk|kapulaga|kayu\s+manis|bunga\s+lawang|cengkeh|asam\s+jawa|santan|kara|teh|kopi\s+bubuk|galon|aqua)\b/i
  const isBahanMakanan =
    catLower === 'bahan makanan' ||
    catLower === 'groceries' ||
    catLower === 'sembako' ||
    (catLower.includes('makanan') && rawGroceryRe.test(info.cleanName))
  if (!params.createNewItems || !isBahanMakanan || NON_STOCK_SNACK_RE.test(info.cleanName)) {
    return { action: 'skipped', name: info.cleanName }
  }

  const location = inferPantryLocation(info.cleanName)
  const expiresAt = inferExpiryDate(info.cleanName, location, params.date)
  const safeName = info.cleanName.slice(0, 80)

  // Insert dengan qty=0 terlebih dahulu, lalu tambahkan melalui apply_pantry_movement agar tercatat di pantry_movements dengan transaction_id
  const [inserted] = await tx<{ id: string; name: string }[]>`
    insert into pantry_items (
      household_id, name, unit, qty, min_qty, location, category, expires_at, expires_estimated, aliases
    )
    values (
      ${actor.householdId},
      ${safeName},
      ${info.unit},
      0,
      1,
      ${location},
      'Bahan Makanan',
      ${expiresAt},
      ${expiresAt !== null},
      '{}'::text[]
    )
    on conflict (household_id, lower(name)) where deleted_at is null
    do update set updated_at = now()
    returning id, name
  `
  if (!inserted) {
    return { action: 'skipped', name: info.cleanName }
  }

  await tx`
    select apply_pantry_movement(
      ${actor.householdId},
      ${actor.memberId},
      ${inserted.id},
      ${info.qty},
      'purchase',
      ${params.txId ?? null},
      ${notePrefix + ': ' + safeName}
    )
  `

  return {
    action: 'created',
    id: inserted.id,
    name: inserted.name,
    qty_before: 0,
    qty_after: info.qty,
    unit: info.unit,
    location,
  }
}

/**
 * Ketika transaksi dihapus (soft-delete), batalkan penambahan stok yang berasal dari transaksi tersebut.
 */
export async function reversePurchaseFromPantry(
  tx: postgres.TransactionSql,
  householdId: string,
  memberId: string,
  transactionId: string,
): Promise<void> {
  const movements = await tx<{ id: string; pantry_item_id: string; delta: string }[]>`
    select id, pantry_item_id, delta::text
    from pantry_movements
    where household_id = ${householdId}
      and transaction_id = ${transactionId}
      and reason = 'purchase'
      and delta > 0
  `
  for (const mov of movements) {
    const deltaNum = Number(mov.delta)
    if (deltaNum > 0) {
      await tx`
        update pantry_items
        set qty = greatest(0, qty - ${deltaNum}), updated_at = now()
        where id = ${mov.pantry_item_id} and household_id = ${householdId} and deleted_at is null
      `
      await tx`
        delete from pantry_movements where id = ${mov.id} and household_id = ${householdId}
      `
    }
  }
}

/**
 * Endpoint `POST /v1/pantry/sync-purchases`: menarik belanjaan Bahan Makanan dari transaksi
 * pada periode berjalan (`this_month` atau `last_30_days`) yang belum masuk ke stok rumah.
 */
export async function syncPurchasesForPeriod(
  actor: Actor,
  period: 'this_month' | 'last_30_days' = 'this_month',
) {
  await requireFeature(actor, 'shopping_stock')
  const timezone = await getHouseholdTimezone(actor)
  const resolved = resolvePeriod(period, timezone)

  return withActor(actor, async (tx) => {
    const txRows = await tx<{
      id: string
      note: string
      date: string
      category_name: string
      item_qty: string | null
    }[]>`
      select t.id, t.note, t.date::text as date, c.name as category_name, pp.qty::text as item_qty
      from transactions t
      join categories c on c.id = t.category_id
      left join product_prices pp on pp.transaction_id = t.id
      where t.household_id = ${actor.householdId}
        and t.deleted_at is null
        and t.type = 'expense'
        and t.date >= ${resolved.from}::date
        and t.date <= ${resolved.to}::date
        and lower(c.name) in ('bahan makanan', 'groceries', 'sembako')
        and not exists (
          select 1 from pantry_movements pm
          where pm.household_id = ${actor.householdId}
            and pm.transaction_id = t.id
        )
      order by t.date asc, t.created_at asc
    `

    const created: SyncPurchaseResult[] = []
    const updated: SyncPurchaseResult[] = []
    let skipped = 0

    for (const row of txRows) {
      const explicitQty = row.item_qty != null ? Number(row.item_qty) : undefined
      const res = await syncPurchaseToPantry(tx, actor, {
        txId: row.id,
        rawName: row.note,
        explicitQty,
        categoryName: row.category_name,
        date: row.date,
        isTitipan: /\(titipan\b/i.test(row.note),
        createNewItems: true,
        sourceLabel: 'sinkron belanja',
      })
      if (res.action === 'created') created.push(res)
      else if (res.action === 'updated') updated.push(res)
      else skipped++
    }

    return {
      period: { from: resolved.from, to: resolved.to },
      scanned: txRows.length,
      created_count: created.length,
      updated_count: updated.length,
      skipped_count: skipped,
      created,
      updated,
    }
  })
}
