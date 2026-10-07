import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { requireFeature } from './features'

export interface ShoppingItemOut {
  id: string
  name: string
  qty_text: string | null
  notes: string
  status: 'needed' | 'bought' | 'cancelled'
  source: 'manual' | 'suggested' | 'receipt'
  bought_transaction_id: string | null
}

const SELECT = `select id, name, qty_text, notes, status, source, bought_transaction_id from shopping_items`

export async function listShopping(actor: Actor, status?: 'needed' | 'bought' | 'cancelled'): Promise<ShoppingItemOut[]> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<ShoppingItemOut[]>(
      `${SELECT} where household_id = $1 and deleted_at is null and status = $2 order by created_at`,
      [actor.householdId, status ?? 'needed'],
    )
    return rows
  })
}

export async function createShoppingItem(actor: Actor, input: { name: string; qty_text?: string; notes: string }): Promise<ShoppingItemOut> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into shopping_items (household_id, name, qty_text, notes, added_by_member_id)
      values (${actor.householdId}, ${input.name}, ${input.qty_text ?? null}, ${input.notes}, ${actor.memberId})
      returning id
    `
    const rows = await tx.unsafe<ShoppingItemOut[]>(`${SELECT} where id = $1`, [row!.id])
    return rows[0]!
  })
}

export async function updateShoppingItem(
  actor: Actor,
  id: string,
  input: { name?: string; qty_text?: string | null; notes?: string; status?: 'needed' | 'bought' | 'cancelled'; transaction_id?: string },
): Promise<ShoppingItemOut> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from shopping_items where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('shopping_item_not_found')
    if (input.transaction_id) {
      // FK saja tidak cukup: FK check mem-bypass RLS, jadi UUID transaksi household LAIN akan
      // diterima (dan sukses/gagal FK jadi oracle keberadaan UUID asing). Cek eksplisit di sini.
      const [txRow] = await tx<{ id: string }[]>`select id from transactions where id = ${input.transaction_id} and household_id = ${actor.householdId} and deleted_at is null`
      if (!txRow) throw ApiError.fromCode('transaction_not_found', { details: { field: 'transaction_id' } })
    }
    const boughtAt = input.status === 'bought' ? new Date().toISOString() : null
    await tx`
      update shopping_items set
        name = coalesce(${input.name ?? null}, name),
        qty_text = case when ${input.qty_text === undefined} then qty_text else ${input.qty_text ?? null} end,
        notes = coalesce(${input.notes ?? null}, notes),
        status = coalesce(${input.status ?? null}, status),
        bought_transaction_id = coalesce(${input.transaction_id ?? null}, bought_transaction_id),
        bought_at = coalesce(${boughtAt}, bought_at),
        updated_at = now()
      where id = ${id} and household_id = ${actor.householdId}
    `
    const rows = await tx.unsafe<ShoppingItemOut[]>(`${SELECT} where id = $1`, [id])
    return rows[0]!
  })
}

export async function deleteShoppingItem(actor: Actor, id: string): Promise<{ success: true }> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update shopping_items set deleted_at = now(), updated_at = now()
      where id = ${id} and household_id = ${actor.householdId} and deleted_at is null
      returning id
    `
    if (!row) throw ApiError.fromCode('shopping_item_not_found')
    return { success: true as const }
  })
}

export interface ShoppingSuggestion {
  pantry_item_id: string
  name: string
  qty: number
  min_qty: number
}

/** Barang di pantry yang qty-nya <= min_qty dan BELUM ada di daftar belanja 'needed' (§6.4). */
export async function listShoppingSuggestions(actor: Actor): Promise<ShoppingSuggestion[]> {
  await requireFeature(actor, 'shopping_stock')
  return withActor(actor, async (tx) => {
    const rows = await tx<ShoppingSuggestion[]>`
      select p.id as pantry_item_id, p.name, p.qty::float as qty, p.min_qty::float as min_qty
      from pantry_items p
      where p.household_id = ${actor.householdId} and p.deleted_at is null
        and p.min_qty is not null and p.qty <= p.min_qty
        and not exists (
          select 1 from shopping_items s
          where s.household_id = p.household_id and s.deleted_at is null and s.status = 'needed'
            and (s.pantry_item_id = p.id or lower(s.name) = lower(p.name))
        )
      order by p.name
    `
    return rows
  })
}
