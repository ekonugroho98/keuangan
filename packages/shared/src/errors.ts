// Daftar error.code stabil (05-api.md §7). apps/api memakai ini untuk error-handler;
// apps/web memakai ini untuk memetakan code -> terjemahan lokal (07-frontend.md §5).

export const ERROR_CODES = [
  'validation_error', 'invalid_period', 'invalid_amount_text', 'invalid_cursor',
  'ai_not_configured', 'weak_password',
  'unauthorized', 'invalid_token', 'token_expired', 'invalid_api_key', 'api_key_revoked',
  'api_key_expired', 'api_key_member_removed', 'invalid_signature', 'invalid_secret',
  'forbidden', 'insufficient_scope', 'not_household_member', 'jwt_required',
  'forbidden_account', 'forbidden_owner', 'private_scope', 'scope_exceeds_role',
  'invitation_email_mismatch',
  'not_found', 'account_not_found', 'category_not_found', 'member_not_found',
  'transaction_not_found', 'debt_not_found', 'goal_not_found', 'piutang_not_found',
  'recurring_not_found', 'budget_not_found', 'invitation_invalid',
  'ambiguous_account', 'ambiguous_category', 'ambiguous_member', 'ambiguous_debt',
  'ambiguous_goal', 'ambiguous_piutang', 'duplicate_account_name', 'duplicate_category_name',
  'duplicate_budget', 'already_member', 'last_owner', 'last_owner_with_members',
  'cannot_remove_self', 'idempotency_in_progress', 'duplicate_recurring_execution',
  'invitation_expired',
  'payload_too_large',
  'insufficient_funds', 'same_account_transfer', 'category_type_mismatch', 'category_reserved',
  'category_in_use', 'transfer_edit_limited', 'would_make_balance_negative',
  'account_has_balance', 'account_has_transactions', 'account_in_use_by_recurring',
  'private_requires_owner', 'reassign_required', 'debt_already_settled', 'piutang_already_settled',
  'overpayment', 'batch_too_large', 'idempotency_key_reused', 'provider_no_vision',
  'actor_mismatch',
  'rate_limited',
  'internal_error',
  'upstream_ai_error',
  'database_unavailable',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ApiErrorBody {
  error: {
    code: ErrorCode | (string & {})
    message: string
    hint?: string
    candidates?: unknown[]
    details?: Record<string, unknown>
    request_id?: string
  }
}

/** HTTP status per code (05-api.md §7). Code yang tidak terdaftar default ke 500. */
export const ERROR_HTTP_STATUS: Partial<Record<ErrorCode, number>> = {
  validation_error: 400, invalid_period: 400, invalid_amount_text: 400, invalid_cursor: 400,
  ai_not_configured: 400, weak_password: 400,
  unauthorized: 401, invalid_token: 401, token_expired: 401, invalid_api_key: 401,
  api_key_revoked: 401, api_key_expired: 401, api_key_member_removed: 401,
  invalid_signature: 401, invalid_secret: 401,
  forbidden: 403, insufficient_scope: 403, not_household_member: 403, jwt_required: 403,
  forbidden_account: 403, forbidden_owner: 403, private_scope: 403, scope_exceeds_role: 403,
  invitation_email_mismatch: 403,
  not_found: 404, account_not_found: 404, category_not_found: 404, member_not_found: 404,
  transaction_not_found: 404, debt_not_found: 404, goal_not_found: 404, piutang_not_found: 404,
  recurring_not_found: 404, budget_not_found: 404, invitation_invalid: 404,
  ambiguous_account: 409, ambiguous_category: 409, ambiguous_member: 409, ambiguous_debt: 409,
  ambiguous_goal: 409, ambiguous_piutang: 409, duplicate_account_name: 409,
  duplicate_category_name: 409, duplicate_budget: 409, already_member: 409, last_owner: 409,
  last_owner_with_members: 409, cannot_remove_self: 409, idempotency_in_progress: 409,
  duplicate_recurring_execution: 409,
  invitation_expired: 410,
  payload_too_large: 413,
  insufficient_funds: 422, same_account_transfer: 422, category_type_mismatch: 422,
  category_reserved: 422, category_in_use: 422, transfer_edit_limited: 422,
  would_make_balance_negative: 422, account_has_balance: 422, account_has_transactions: 422,
  account_in_use_by_recurring: 422, private_requires_owner: 422, reassign_required: 422,
  debt_already_settled: 422, piutang_already_settled: 422, overpayment: 422,
  batch_too_large: 422, idempotency_key_reused: 422, provider_no_vision: 422,
  actor_mismatch: 422,
  rate_limited: 429,
  internal_error: 500,
  upstream_ai_error: 502,
  database_unavailable: 503,
}

/**
 * Pesan default Bahasa Indonesia per code, dipakai saat DB function melempar error dengan hanya
 * `message = '<code>'` (tanpa teks siap tampil). Fungsi SQL yang punya konteks lebih spesifik
 * (nama akun, nominal) membangun pesan sendiri di service layer dari `details`.
 */
export const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  validation_error: 'Data yang dikirim tidak valid.',
  invalid_period: 'Periode tidak dikenali. Gunakan this_month, last_month, YYYY-MM, atau from & to.',
  invalid_amount_text: 'Nominal tidak bisa dibaca. Contoh format: "45rb", "1,2 juta", atau angka penuh.',
  invalid_cursor: 'Cursor pagination tidak valid.',
  ai_not_configured: 'API key AI belum diatur. Buka Settings > AI Coach.',
  weak_password: 'Password minimal 8 karakter.',
  unauthorized: 'Token autentikasi tidak ditemukan.',
  invalid_token: 'Token tidak valid atau rusak.',
  token_expired: 'Sesi sudah berakhir, silakan login ulang.',
  invalid_api_key: 'API key tidak valid.',
  api_key_revoked: 'API key sudah dicabut.',
  api_key_expired: 'API key sudah kedaluwarsa.',
  api_key_member_removed: 'Pemilik API key ini sudah tidak jadi anggota household.',
  invalid_signature: 'Signature tidak valid.',
  invalid_secret: 'Secret tidak valid.',
  forbidden: 'Kamu tidak punya akses untuk melakukan ini.',
  insufficient_scope: 'API key ini tidak punya izin menulis.',
  not_household_member: 'Kamu bukan anggota household ini.',
  jwt_required: 'Endpoint ini hanya bisa diakses lewat aplikasi web (JWT), bukan API key.',
  forbidden_account: 'Akun ini privat milik anggota lain, kamu tidak bisa mencatat ke sana.',
  forbidden_owner: 'Hanya owner yang bisa membuat akun untuk anggota lain.',
  private_scope: 'Member ini punya akun privat; ringkasan per-member tidak tersedia.',
  scope_exceeds_role: 'Scope API key melebihi peranmu di household.',
  invitation_email_mismatch: 'Email akunmu tidak cocok dengan undangan ini.',
  not_found: 'Data tidak ditemukan.',
  account_not_found: 'Akun tidak ditemukan.',
  category_not_found: 'Kategori tidak ditemukan.',
  member_not_found: 'Anggota tidak ditemukan.',
  transaction_not_found: 'Transaksi tidak ditemukan.',
  debt_not_found: 'Hutang tidak ditemukan.',
  goal_not_found: 'Target tidak ditemukan.',
  piutang_not_found: 'Piutang tidak ditemukan.',
  recurring_not_found: 'Transaksi berulang tidak ditemukan.',
  budget_not_found: 'Anggaran tidak ditemukan.',
  invitation_invalid: 'Kode undangan tidak valid.',
  ambiguous_account: 'Ada lebih dari satu akun yang cocok.',
  ambiguous_category: 'Ada lebih dari satu kategori yang cocok.',
  ambiguous_member: 'Ada lebih dari satu anggota yang cocok.',
  ambiguous_debt: 'Ada lebih dari satu hutang yang cocok.',
  ambiguous_goal: 'Ada lebih dari satu target yang cocok.',
  ambiguous_piutang: 'Ada lebih dari satu piutang yang cocok.',
  duplicate_account_name: 'Sudah ada akun dengan nama ini untuk pemilik yang sama.',
  duplicate_category_name: 'Sudah ada kategori dengan nama ini.',
  duplicate_budget: 'Anggaran untuk kategori dan bulan ini sudah ada.',
  already_member: 'Sudah jadi anggota household ini.',
  last_owner: 'Household harus punya minimal satu owner.',
  last_owner_with_members: 'Kamu owner satu-satunya dan household masih punya anggota lain.',
  cannot_remove_self: 'Gunakan endpoint keluar household, bukan hapus diri sendiri.',
  idempotency_in_progress: 'Request dengan key ini sedang diproses, coba lagi sebentar.',
  duplicate_recurring_execution: 'Transaksi untuk tanggal ini sudah pernah dibuat dari recurring yang sama.',
  invitation_expired: 'Undangan sudah kedaluwarsa.',
  payload_too_large: 'Data yang dikirim terlalu besar.',
  insufficient_funds: 'Saldo tidak cukup.',
  same_account_transfer: 'Akun asal dan tujuan transfer harus berbeda.',
  category_type_mismatch: 'Kategori tidak cocok dengan tipe transaksi.',
  category_reserved: 'Kategori ini dipakai sistem dan tidak bisa diubah/dihapus.',
  category_in_use: 'Kategori masih dipakai transaksi lain.',
  transfer_edit_limited: 'Transfer hanya bisa diubah catatan dan tanggalnya.',
  would_make_balance_negative: 'Menghapus ini akan membuat saldo akun negatif.',
  account_has_balance: 'Akun masih punya saldo, kosongkan dulu sebelum dihapus.',
  account_has_transactions: 'Akun masih punya transaksi.',
  account_in_use_by_recurring: 'Akun masih dipakai transaksi berulang aktif.',
  private_requires_owner: 'Akun privat harus punya pemilik.',
  reassign_required: 'Anggota ini masih punya akun, pindahkan dulu kepemilikannya.',
  debt_already_settled: 'Hutang ini sudah lunas.',
  piutang_already_settled: 'Piutang ini sudah lunas.',
  overpayment: 'Jumlah melebihi sisa yang harus dibayar.',
  batch_too_large: 'Maksimal 100 item per batch.',
  idempotency_key_reused: 'Idempotency-Key ini sudah dipakai dengan data berbeda.',
  provider_no_vision: 'Provider AI ini tidak mendukung membaca gambar.',
  actor_mismatch: 'Terjadi kesalahan identitas internal. Laporkan sebagai bug.',
  rate_limited: 'Terlalu banyak request, coba lagi nanti.',
  internal_error: 'Terjadi kesalahan pada server.',
  upstream_ai_error: 'Layanan AI sedang bermasalah.',
  database_unavailable: 'Database sedang tidak bisa diakses.',
}

export const ERROR_HINTS: Partial<Record<ErrorCode, string>> = {
  ambiguous_account: 'Sebutkan pemilik akun (mis. "BCA suami") atau kirim account_id dari salah satu kandidat.',
  ambiguous_category: 'Pilih salah satu kandidat atau kirim category_id.',
  ambiguous_member: 'Sebutkan nama lengkap member.',
  account_not_found: 'Lihat GET /v1/accounts untuk daftar akun yang ada.',
  category_not_found: 'Lihat GET /v1/categories atau buat kategori baru.',
  insufficient_funds: 'Pilih akun lain, kurangi nominal, atau koreksi saldo lewat adjust-balance.',
  category_reserved: 'Gunakan endpoint khusus (mis. POST /v1/transfers untuk kategori Transfer).',
  transfer_edit_limited: 'Hapus transfer ini lalu buat transfer baru dengan nilai yang benar.',
  overpayment: 'Kirim allow_overpay: true kalau pembayaran memang disengaja lebih besar.',
  idempotency_key_reused: 'Gunakan Idempotency-Key baru untuk request yang berbeda.',
  reassign_required: 'Kirim reassign_to_member_id (UUID member lain, atau "joint").',
  last_owner: 'Jadikan anggota lain owner dulu sebelum mengubah peran ini.',
}

/** Error terstruktur yang dilempar service layer; error-handler apps/api mengubahnya jadi ApiErrorBody. */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly hint?: string
  readonly candidates?: unknown[]
  readonly details?: Record<string, unknown>
  readonly status: number

  constructor(code: ErrorCode, message: string, opts?: { hint?: string; candidates?: unknown[]; details?: Record<string, unknown>; status?: number }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.hint = opts?.hint
    this.candidates = opts?.candidates
    this.details = opts?.details
    this.status = opts?.status ?? ERROR_HTTP_STATUS[code] ?? 500
  }

  /** Bangun ApiError dari code saja, memakai pesan & hint default (ERROR_MESSAGES/ERROR_HINTS). */
  static fromCode(code: ErrorCode, opts?: { details?: Record<string, unknown>; message?: string; hint?: string; candidates?: unknown[] }): ApiError {
    return new ApiError(code, opts?.message ?? ERROR_MESSAGES[code] ?? `Error: ${code}`, {
      hint: opts?.hint ?? ERROR_HINTS[code],
      details: opts?.details,
      candidates: opts?.candidates,
    })
  }

  toBody(requestId?: string): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.hint ? { hint: this.hint } : {}),
        ...(this.candidates ? { candidates: this.candidates } : {}),
        ...(this.details ? { details: this.details } : {}),
        ...(requestId ? { request_id: requestId } : {}),
      },
    }
  }
}
