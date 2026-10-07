import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { requireFeature } from './features'
import { resolveMemberRef } from './resolver'

export interface BeneficiaryOut {
  id: string
  name: string
  kind: 'member' | 'child' | 'relative' | 'property' | 'other'
  member_id: string | null
  aliases: string[]
  icon: string
  color: string
}

const SELECT = `
  select b.id, coalesce(m.display_name, b.name) as name, b.kind, b.member_id, b.aliases, b.icon, b.color
  from beneficiaries b
  left join household_members m on m.id = b.member_id and m.deleted_at is null
`

export async function listBeneficiaries(actor: Actor): Promise<BeneficiaryOut[]> {
  await requireFeature(actor, 'beneficiary')
  return withActor(actor, async (tx) => {
    const rows = await tx.unsafe<BeneficiaryOut[]>(
      `${SELECT} where b.household_id = $1 and b.deleted_at is null order by b.sort_order, b.created_at`,
      [actor.householdId],
    )
    return rows
  })
}

export async function createBeneficiary(
  actor: Actor,
  input: { name: string; kind: 'member' | 'child' | 'relative' | 'property' | 'other'; member?: string; aliases: string[]; icon?: string; color?: string },
): Promise<BeneficiaryOut> {
  await requireFeature(actor, 'beneficiary')
  return withActor(actor, async (tx) => {
    const memberId = input.kind === 'member' && input.member ? ((await resolveMemberRef(tx, actor, { member: input.member })) ?? null) : null
    try {
      const [row] = await tx<{ id: string }[]>`
        insert into beneficiaries (household_id, name, kind, member_id, aliases, icon, color)
        values (${actor.householdId}, ${input.name}, ${input.kind}, ${memberId}, ${input.aliases}, ${input.icon ?? '👤'}, ${input.color ?? '#6366f1'})
        returning id
      `
      const rows = await tx.unsafe<BeneficiaryOut[]>(`${SELECT} where b.id = $1`, [row!.id])
      return rows[0]!
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw ApiError.fromCode('validation_error', { message: 'Sudah ada beneficiary dengan nama ini (atau member ini sudah punya baris beneficiary).', details: { field: 'name' } })
      }
      throw err
    }
  })
}

export async function updateBeneficiary(actor: Actor, id: string, input: { name?: string; aliases?: string[]; icon?: string; color?: string }): Promise<BeneficiaryOut> {
  await requireFeature(actor, 'beneficiary')
  return withActor(actor, async (tx) => {
    const [existing] = await tx<{ id: string }[]>`select id from beneficiaries where id = ${id} and household_id = ${actor.householdId} and deleted_at is null`
    if (!existing) throw ApiError.fromCode('beneficiary_not_found')
    try {
      await tx`
        update beneficiaries set
          name = coalesce(${input.name ?? null}, name),
          aliases = coalesce(${input.aliases ?? null}, aliases),
          icon = coalesce(${input.icon ?? null}, icon),
          color = coalesce(${input.color ?? null}, color),
          updated_at = now()
        where id = ${id} and household_id = ${actor.householdId}
      `
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw ApiError.fromCode('validation_error', { message: 'Sudah ada beneficiary lain dengan nama ini.', details: { field: 'name' } })
      }
      throw err
    }
    const rows = await tx.unsafe<BeneficiaryOut[]>(`${SELECT} where b.id = $1`, [id])
    return rows[0]!
  })
}

/** Soft delete — transaksi lama TETAP menyimpan beneficiary_id (riwayat), lihat 10-fitur-opsional-keluarga.md §3.4. */
export async function deleteBeneficiary(actor: Actor, id: string): Promise<{ success: true }> {
  await requireFeature(actor, 'beneficiary')
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update beneficiaries set deleted_at = now(), updated_at = now()
      where id = ${id} and household_id = ${actor.householdId} and deleted_at is null
      returning id
    `
    if (!row) throw ApiError.fromCode('beneficiary_not_found')
    return { success: true as const }
  })
}
