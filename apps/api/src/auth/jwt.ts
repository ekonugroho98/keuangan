import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { ApiError } from '@karaya/shared/errors'
import { env } from '../env'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks && env.SUPABASE_URL) {
    jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  }
  return jwks
}

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string
  email?: string
  role?: string
}

/**
 * Verifikasi JWT Supabase (05-api.md §3.1). Coba JWKS (asimetris, project baru) dulu; kalau project
 * masih memakai secret simetris lama, fallback ke HS256 dengan SUPABASE_JWT_SECRET. Salah satu
 * dari keduanya harus tersedia dan berhasil, selain itu `unauthorized`/`invalid_token`.
 */
export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload> {
  const jwksSet = getJwks()

  if (jwksSet) {
    try {
      const { payload } = await jwtVerify(token, jwksSet, { audience: 'authenticated' })
      return payload as SupabaseJwtPayload
    } catch {
      // Jatuh ke fallback HS256 di bawah kalau project ini masih symmetric-only.
    }
  }

  if (env.SUPABASE_JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
      const { payload } = await jwtVerify(token, secret, { audience: 'authenticated' })
      return payload as SupabaseJwtPayload
    } catch (err) {
      if (err instanceof Error && err.name === 'JWTExpired') {
        throw ApiError.fromCode('token_expired')
      }
      throw ApiError.fromCode('invalid_token')
    }
  }

  throw ApiError.fromCode('invalid_token', { message: 'Server belum dikonfigurasi untuk verifikasi token (JWKS/secret tidak ada).' })
}
