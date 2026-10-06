import { ApiError, ERROR_CODES, type ErrorCode } from '@karaya/shared/errors'

const KNOWN_CODES = new Set<string>(ERROR_CODES)

function isErrorCode(s: string): s is ErrorCode {
  return KNOWN_CODES.has(s)
}

/**
 * Petakan error dari postgres.js (fungsi plpgsql yang RAISE EXCEPTION USING ERRCODE='P0001',
 * MESSAGE='<code>', DETAIL='<json>') jadi ApiError (03-database.md §8.1). Error Postgres lain
 * (constraint violation mentah, RLS, koneksi putus) jadi internal_error/database_unavailable
 * supaya detail internal tidak bocor ke klien.
 */
export function mapDbError(err: unknown): ApiError {
  const pgErr = err as { code?: string; message?: string; detail?: string; severity?: string } | undefined

  if (pgErr?.code === 'P0001' && pgErr.message && isErrorCode(pgErr.message)) {
    let details: Record<string, unknown> | undefined
    if (pgErr.detail) {
      try {
        details = JSON.parse(pgErr.detail) as Record<string, unknown>
      } catch {
        // DETAIL bukan JSON (jarang terjadi pada fungsi kita) — biarkan details kosong.
      }
    }
    return ApiError.fromCode(pgErr.message, {
      details,
      message: buildMessageWithDetails(pgErr.message, details),
    })
  }

  if (pgErr?.code === '42501') {
    // RLS/permission denied yang lolos dari pengecekan eksplisit fungsi — seharusnya tidak terjadi
    // kalau validasi service layer benar, tapi tetap ditangani supaya tidak bocor jadi 500 mentah.
    return ApiError.fromCode('forbidden')
  }

  if (pgErr?.code === 'CONNECTION_ENDED' || pgErr?.code === 'CONNECTION_CLOSED' || pgErr?.code === 'ECONNREFUSED') {
    return ApiError.fromCode('database_unavailable')
  }

  console.error('[db] unmapped error', err)
  return ApiError.fromCode('internal_error')
}

function buildMessageWithDetails(code: ErrorCode, details?: Record<string, unknown>): string | undefined {
  if (!details) return undefined
  switch (code) {
    case 'insufficient_funds': {
      const balance = details.balance as number | undefined
      const needed = details.needed as number | undefined
      const accountName = details.account_name as string | undefined
      if (balance !== undefined && needed !== undefined) {
        return `Saldo${accountName ? ` ${accountName}` : ''} (Rp ${balance.toLocaleString('id-ID')}) tidak cukup untuk Rp ${needed.toLocaleString('id-ID')}.`
      }
      return undefined
    }
    case 'overpayment': {
      const remaining = details.remaining as number | undefined
      if (remaining !== undefined) return `Jumlah melebihi sisa Rp ${remaining.toLocaleString('id-ID')}.`
      return undefined
    }
    case 'category_in_use': {
      const count = details.count as number | undefined
      if (count !== undefined) return `Kategori masih dipakai ${count} transaksi.`
      return undefined
    }
    case 'account_has_transactions': {
      const count = details.count as number | undefined
      if (count !== undefined) return `Akun masih punya ${count} transaksi.`
      return undefined
    }
    default:
      return undefined
  }
}
