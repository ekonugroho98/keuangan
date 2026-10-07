import { ApiError } from '@karaya/shared/errors'
import { PANTRY_LOCATION_ALIASES } from '@karaya/shared/schemas'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { requireFeature } from './features'

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
