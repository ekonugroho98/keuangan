import { ApiError } from '@karaya/shared/errors'
import type { Actor } from '../auth/actor'
import { withActor, withUserClaims, withAnon } from '../db/tx'

interface InvitationRow {
  id: string; email: string | null; code: string; role: string
  display_name_suggestion: string | null; status: string; expires_at: string; created_at: string
}

export async function listInvitations(actor: Actor) {
  return withActor(actor, async (tx) => {
    const rows = await tx<InvitationRow[]>`
      select id, email, code, role, display_name_suggestion, status, expires_at::text, created_at::text
      from household_invitations where household_id = ${actor.householdId} order by created_at desc
    `
    // accept_url tidak disimpan di DB, sama seperti di createInvitation() — dihitung dari code di
    // kedua tempat. Bug ditemukan: endpoint ini sebelumnya TIDAK menyertakan accept_url sama
    // sekali, jadi re-fetch daftar undangan (setelah createInvitation awal) membuat frontend
    // merangkai "undefined" ke URL saat user klik "Salin link" pada undangan yang sudah ada.
    return rows.map((row) => ({ ...row, accept_url: `/join/${row.code}` }))
  })
}

export async function createInvitation(actor: Actor, input: { email?: string; role: 'owner' | 'member' | 'viewer'; display_name_suggestion?: string }) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<[{ result: { id: string; code: string; email: string | null; role: string; expires_at: string } }]>`
      select to_jsonb(create_invitation(${actor.householdId}, ${actor.memberId}, ${input.email ?? null}, ${input.role}, ${input.display_name_suggestion ?? null})) as result
    `
    const inv = row!.result
    return { id: inv.id, code: inv.code, email: inv.email, role: inv.role, expires_at: inv.expires_at, accept_url: `/join/${inv.code}` }
  })
}

export async function revokeInvitation(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      update household_invitations set status = 'revoked'
      where id = ${id} and household_id = ${actor.householdId} and status = 'pending'
      returning id
    `
    if (!row) throw ApiError.fromCode('invitation_invalid')
    return { success: true }
  })
}

/** Tanpa auth (dipanggil dari halaman /join/:code sebelum user login). */
export async function previewInvitation(code: string) {
  return withAnon(async (tx) => {
    const [row] = await tx<[{ result: unknown }]>`select preview_invitation(${code}) as result`
    return row!.result
  })
}

export async function acceptInvitation(userId: string, code: string, input: { display_name: string; mode: 'fresh' | 'merge' }) {
  return withUserClaims(userId, async (tx) => {
    const [row] = await tx<[{ result: { id: string; household_id: string } }]>`
      select to_jsonb(accept_invitation(${code}, ${userId}, ${input.display_name}, ${input.mode})) as result
    `
    return row!.result
  })
}
