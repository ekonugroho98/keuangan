import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'

export interface CategoryOut {
  id: string
  name: string
  aliases: string[]
  type: 'income' | 'expense' | 'both'
  icon: string
  color: string
  is_system: boolean
  system_key: string | null
}

export async function listCategories(actor: Actor, type?: 'income' | 'expense' | 'all') {
  return withActor(actor, async (tx) => {
    const rows = await tx<CategoryOut[]>`
      select id, name, aliases, type, icon, color, is_system, system_key
      from categories
      where household_id = ${actor.householdId} and deleted_at is null
        ${type && type !== 'all' ? tx`and type in (${type}, 'both')` : tx``}
      order by sort_order, name
    `
    return rows
  })
}

export async function createCategory(actor: Actor, input: { name: string; type: string; icon?: string; color?: string; aliases: string[] }) {
  if (actor.role !== 'owner') throw ApiError.fromCode('insufficient_scope')
  return withActor(actor, async (tx) => {
    try {
      const [row] = await tx<CategoryOut[]>`
        insert into categories (household_id, name, type, icon, color, aliases)
        values (${actor.householdId}, ${input.name}, ${input.type}, ${input.icon ?? '📦'}, ${input.color ?? '#6366f1'}, ${input.aliases})
        returning id, name, aliases, type, icon, color, is_system, system_key
      `
      return row!
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw ApiError.fromCode('duplicate_category_name')
      }
      throw err
    }
  })
}

export async function updateCategory(actor: Actor, id: string, input: { name?: string; aliases?: string[]; icon?: string; color?: string }) {
  if (actor.role !== 'owner') throw ApiError.fromCode('insufficient_scope')
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ is_system: boolean }[]>`select is_system from categories where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('category_not_found')
    if (existing.is_system && (input.name === undefined)) {
      // kategori sistem boleh di-rename/alias tapi tetap diproses normal di bawah
    }
    const [row] = await tx<CategoryOut[]>`
      update categories set
        name = coalesce(${input.name ?? null}, name),
        aliases = coalesce(${input.aliases ?? null}, aliases),
        icon = coalesce(${input.icon ?? null}, icon),
        color = coalesce(${input.color ?? null}, color),
        updated_at = now()
      where id = ${id} and household_id = ${actor.householdId}
      returning id, name, aliases, type, icon, color, is_system, system_key
    `
    return row!
  })
}

export async function deleteCategory(actor: Actor, id: string, mergeInto?: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<CategoryOut[]>`
      select * from delete_category(${actor.householdId}, ${actor.memberId}, ${id}, ${mergeInto ?? null})
    `
    return row
  })
}
