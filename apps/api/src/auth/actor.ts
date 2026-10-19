/**
 * Actor: siapa yang bertindak atas sebuah request (05-api.md §3). Fase 3 hanya JWT; API key
 * menyusul Fase 6 (credential akan jadi 'api_key' dan scope dari api_keys.scope).
 */
export interface Actor {
  userId: string
  email?: string
  householdId: string
  memberId: string
  role: 'owner' | 'member' | 'viewer'
  credential: 'jwt' | 'api_key'
  scope: 'read' | 'write' | 'admin'
  apiKeyId?: string
}

export function canWrite(actor: Actor): boolean {
  return actor.scope === 'write' || actor.scope === 'admin'
}

export function canAdmin(actor: Actor): boolean {
  return actor.scope === 'admin'
}
