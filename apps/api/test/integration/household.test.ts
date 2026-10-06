import { SignJWT } from 'jose'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'

// Integration test Fase 5 (household: undangan, anggota, merge). Butuh Postgres lokal sungguhan,
// sama seperti transactions.test.ts. EKO sudah ada di seed.sql; user undangan dibuat/dihapus
// sendiri oleh file ini (insert auth.users langsung) karena household_members.user_id punya FK
// ke auth.users — bukan bagian dari seed.sql supaya tidak mengotori fixture test lain.
const EKO_USER_ID = '00000000-0000-0000-0000-0000000000e0'
const INVITEE_USER_ID = '00000000-0000-0000-0000-0000000000a1'
const MERGE_USER_ID = '00000000-0000-0000-0000-0000000000a2'

async function checkDb(): Promise<boolean> {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 })
    await sql`select 1`
    await sql.end()
    return true
  } catch {
    return false
  }
}

async function mintJwt(sub: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
  return new SignJWT({ sub, aud: 'authenticated', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

// karaya_api (role di DATABASE_URL biasa) TIDAK punya grant ke auth.users/household_invitations
// (lihat 03-database.md §7.4) — sengaja, supaya app runtime tidak pernah bisa bypass RLS. Fixture
// test (insert auth.users, cleanup lintas tabel) butuh role superuser lokal yang sama dengan yang
// dipakai psql manual saat apply migrasi (lihat PROGRESS.md). Hanya dipakai test, tidak pernah oleh
// apps/api sendiri.
const TEST_ADMIN_DATABASE_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres'

const dbReachable = await checkDb()
if (!dbReachable) {
  console.warn('[integration] DATABASE_URL tidak terjangkau, test household.test.ts dilewati.')
}

describe.skipIf(!dbReachable || process.env.CI === 'true')('household integration (DB lokal)', () => {
  const admin = postgres(TEST_ADMIN_DATABASE_URL, { prepare: false, max: 1 })

  beforeAll(async () => {
    await admin`
      insert into auth.users (id, email) values
        (${INVITEE_USER_ID}, 'invitee-test@example.test'),
        (${MERGE_USER_ID}, 'merge-test@example.test')
      on conflict (id) do nothing
    `
  })

  afterAll(async () => {
    // Urutan FK: audit_log/invitations/accounts/budgets dulu baru household_members, baru
    // households/auth.users. audit_log baru ikut diperiksa di sini sejak Fase 6: auditMiddleware()
    // global mencatat SETIAP request (bukan cuma mutasi), jadi request test di atas sudah pasti
    // meninggalkan baris audit_log yang mereferensikan household_members lewat actor_member_id.
    await admin`delete from audit_log where actor_member_id in (select id from household_members where user_id in (${EKO_USER_ID}, ${INVITEE_USER_ID}, ${MERGE_USER_ID}))`
    await admin`delete from household_invitations where invited_by in (select id from household_members where user_id = ${EKO_USER_ID})`
    await admin`delete from accounts where owner_member_id in (select id from household_members where user_id in (${INVITEE_USER_ID}, ${MERGE_USER_ID}))`
    await admin`delete from household_members where user_id in (${INVITEE_USER_ID}, ${MERGE_USER_ID})`
    await admin`delete from households where created_by in (${INVITEE_USER_ID}, ${MERGE_USER_ID})`
    await admin`delete from user_settings where user_id in (${INVITEE_USER_ID}, ${MERGE_USER_ID})`
    await admin`delete from auth.users where id in (${INVITEE_USER_ID}, ${MERGE_USER_ID})`
    await admin.end()
  })

  it('owner membuat undangan, siapa pun bisa preview tanpa login, lalu user baru accept (mode fresh)', async () => {
    const app = buildApp()
    const ownerToken = await mintJwt(EKO_USER_ID)

    const createRes = await app.request('/v1/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    })
    expect(createRes.status).toBe(201)
    const invitation = await createRes.json()
    expect(invitation.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    // Preview TANPA Authorization header sama sekali — endpoint ini harus publik.
    const previewRes = await app.request(`/v1/invitations/${invitation.code}`)
    expect(previewRes.status).toBe(200)
    const preview = await previewRes.json()
    expect(preview.household_name).toBe('Keluarga Eko')

    const inviteeToken = await mintJwt(INVITEE_USER_ID)
    const acceptRes = await app.request(`/v1/invitations/${invitation.code}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inviteeToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Tamu Test', mode: 'fresh' }),
    })
    expect(acceptRes.status).toBe(201)
    const member = await acceptRes.json()
    expect(member.role).toBe('member')

    // Anggota baru bisa ubah nama sendiri tanpa jadi owner (members_update RLS policy).
    const selfPatchRes = await app.request(`/v1/members/${member.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${inviteeToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Nama Baru' }),
    })
    expect(selfPatchRes.status).toBe(200)
    expect((await selfPatchRes.json()).display_name).toBe('Nama Baru')

    // Keluar sendiri, lalu diundang & accept LAGI — unique index household_members harus partial
    // (where deleted_at is null), bukan constraint tabel penuh, supaya rejoin tidak 500.
    const leaveRes = await app.request('/v1/members/me/leave', { method: 'POST', headers: { Authorization: `Bearer ${inviteeToken}` } })
    expect(leaveRes.status).toBe(200)

    const meAfterLeave = await app.request('/v1/me', { headers: { Authorization: `Bearer ${inviteeToken}` } })
    expect((await meAfterLeave.json()).memberships).toHaveLength(0)

    const invitation2Res = await app.request('/v1/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    })
    const invitation2 = await invitation2Res.json()
    const rejoinRes = await app.request(`/v1/invitations/${invitation2.code}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inviteeToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Tamu Test 2', mode: 'fresh' }),
    })
    expect(rejoinRes.status).toBe(201)

    // Owner tidak bisa hapus diri sendiri lewat DELETE /v1/members/{id} — harus lewat leave.
    const ownerMemberRes = await app.request('/v1/members', { headers: { Authorization: `Bearer ${ownerToken}` } })
    const ownerMember = (await ownerMemberRes.json()).find((m: { display_name: string }) => m.display_name === 'Eko')
    const selfDeleteRes = await app.request(`/v1/members/${ownerMember.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ownerToken}` } })
    expect(selfDeleteRes.status).toBe(409)
    expect((await selfDeleteRes.json()).error.code).toBe('cannot_remove_self')
  })

  it('merge: akun & kategori household sumber pindah ke target, membership household lama tidak lagi muncul di /v1/me', async () => {
    const app = buildApp()
    const mergeUserToken = await mintJwt(MERGE_USER_ID)

    const createHhRes = await app.request('/v1/households', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mergeUserToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rumah Merge Test', timezone: 'Asia/Jakarta', display_name: 'Merge Test' }),
    })
    expect(createHhRes.status).toBe(201)

    const addAccountRes = await app.request('/v1/accounts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mergeUserToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dompet Merge Test', type: 'cash', opening_balance: 10_000, owner: 'me' }),
    })
    expect(addAccountRes.status).toBe(201)

    const ownerToken = await mintJwt(EKO_USER_ID)
    const invRes = await app.request('/v1/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'owner' }),
    })
    const invitation = await invRes.json()

    const acceptRes = await app.request(`/v1/invitations/${invitation.code}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mergeUserToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Merge Test', mode: 'merge' }),
    })
    expect(acceptRes.status).toBe(201)

    const accountsRes = await app.request('/v1/accounts', { headers: { Authorization: `Bearer ${mergeUserToken}` } })
    const accountNames = (await accountsRes.json()).data.map((a: { name: string }) => a.name)
    expect(accountNames).toContain('Dompet Merge Test')

    const meRes = await app.request('/v1/me', { headers: { Authorization: `Bearer ${mergeUserToken}` } })
    const memberships = (await meRes.json()).memberships
    expect(memberships).toHaveLength(1)
    expect(memberships[0].household_name).toBe('Keluarga Eko')
  })

  it('PATCH /v1/households/current settings langsung ter-reflect di response (bukan nilai lama)', async () => {
    const app = buildApp()
    const ownerToken = await mintJwt(EKO_USER_ID)
    const patchRes = await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { owners_can_view_private_totals: true } }),
    })
    expect(patchRes.status).toBe(200)
    expect((await patchRes.json()).settings.owners_can_view_private_totals).toBe(true)

    const resetRes = await app.request('/v1/households/current', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { owners_can_view_private_totals: false } }),
    })
    expect((await resetRes.json()).settings.owners_can_view_private_totals).toBe(false)
  })
})
