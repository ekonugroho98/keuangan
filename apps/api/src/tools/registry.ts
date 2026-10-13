import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'
import { resolveAccountRef } from '../services/resolver'
import { getHouseholdTimezone } from '../services/households'
import * as households from '../services/households'
import * as accountsSvc from '../services/accounts'
import * as categoriesSvc from '../services/categories'
import * as transactionsSvc from '../services/transactions'
import * as transfersSvc from '../services/transfers'
import * as summarySvc from '../services/summary'
import * as budgetsSvc from '../services/budgets'
import * as debtsSvc from '../services/debts'
import * as goalsSvc from '../services/goals'
import * as piutangSvc from '../services/piutang'
import * as recurringsSvc from '../services/recurrings'
import { resolveName } from '../services/resolve'
import * as beneficiariesSvc from '../services/beneficiaries'
import * as reportsSvc from '../services/reports'
import * as shoppingSvc from '../services/shopping'
import * as pantrySvc from '../services/pantry'
import { ingestReceipt } from '../services/receipts'

/**
 * Registry tunggal untuk Hermes/agent (06-agent-integration.md §2). Satu sumber kebenaran yang
 * menghasilkan TIGA bentuk berbeda:
 *   1. `apps/api/tools/hermes-tools.json` (lewat `pnpm gen:tools`, scripts/gen-tools.ts) — dibaca
 *      Hermes sebagai function-calling tools; tiap tool = satu panggilan HTTP (`endpoint`).
 *   2. Tool definitions untuk `/v1/ai/chat` internal (`handler` di bawah memanggil service layer
 *      LANGSUNG, bukan HTTP — lebih cepat, tanpa overhead jaringan/auth ulang).
 *   3. Tabel dokumentasi markdown (`pnpm gen:tools --md`).
 * `handler` TIDAK ikut di-emit ke hermes-tools.json (function tidak bisa di-JSON.stringify) —
 * lihat scripts/gen-tools.ts.
 *
 * `feature` (opsional, 10-fitur-opsional-keluarga.md §2.4): tool yang HANYA berguna kalau fitur
 * opsional itu aktif (mis. list_beneficiaries tanpa beneficiary diaktifkan selalu 403). Hermes
 * menyaring tool mana yang ditawarkan ke model berdasarkan `GET /v1/households/current` →
 * `.features` — manifest ini tetap berisi SEMUA tool (statis/publik), penyaringan di sisi agent.
 * Tool INTI yang cuma MENDAPAT satu parameter opsional baru saat fitur aktif (mis. `beneficiary`
 * di record_expense) TIDAK diberi `feature` di sini — tool itu sendiri tetap berguna saat fitur
 * mati, hanya param itu yang tidak boleh dipakai (dijelaskan di deskripsi parameter masing-masing).
 */
export interface JsonSchema {
  type: string
  description?: string
  properties?: Record<string, JsonSchema & { enum?: string[]; format?: string }>
  required?: string[]
  items?: JsonSchema
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema
  endpoint: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; body?: Record<string, unknown> }
  scope: 'read' | 'write'
  idempotent: boolean
  handler: (actor: Actor, args: Record<string, unknown>) => Promise<unknown>
  /** Lihat catatan panjang di atas TOOLS soal kapan field ini diisi. */
  feature?: 'beneficiary' | 'monthly_report' | 'reconciliation' | 'shopping_stock'
}

function str(description: string, extra?: Partial<JsonSchema & { enum?: string[]; format?: string }>): JsonSchema & { enum?: string[]; format?: string } {
  return { type: 'string', description, ...extra } as JsonSchema & { enum?: string[]; format?: string }
}
function num(description: string): JsonSchema {
  return { type: 'number', description } as JsonSchema
}
/**
 * Model sering mengisi param opsional dengan `null`/"" (deskripsinya pun bilang "Kosongkan") —
 * untuk `beneficiary` itu berbahaya: null !== undefined dianggap "disentuh" oleh resolver dan
 * memicu gate 400 di household yang fiturnya mati. Normalkan ke undefined (review 2026-10-08).
 */
function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'list_accounts',
    description: 'Daftar akun dengan saldo dan pemilik. Pakai untuk "saldo kita berapa?", "akun apa saja yang ada", "BCA istri sisa berapa".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/accounts' },
    scope: 'read',
    idempotent: true,
    handler: async (actor) => accountsSvc.listAccounts(actor),
  },
  {
    name: 'list_members',
    description: 'Anggota household dan alias mereka. Jarang dipakai langsung oleh user; berguna saat agent perlu tahu nama/alias member yang valid sebelum memanggil tool lain.',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/members' },
    scope: 'read',
    idempotent: true,
    handler: async (actor) => households.listMembers(actor),
  },
  {
    name: 'list_categories',
    description: 'Daftar kategori beserta alias. Panggil sebelum mencatat transaksi kalau ragu kategori mana yang valid.',
    parameters: { type: 'object', properties: { type: str('Filter tipe kategori', { enum: ['income', 'expense', 'all'] }) } },
    endpoint: { method: 'GET', path: '/v1/categories' },
    scope: 'read',
    idempotent: true,
    handler: async (actor, args) => categoriesSvc.listCategories(actor, (args.type as 'income' | 'expense' | 'all' | undefined) ?? 'all'),
  },
  {
    name: 'resolve_name',
    description: 'Cocokkan nama akun/kategori/member/hutang/goal/piutang yang disebut user ke entitas sebenarnya. Dipakai internal agent saat perlu id pasti sebelum memanggil tool aksi (mis. "cicilan motor itu hutang yang mana").',
    parameters: {
      type: 'object',
      properties: {
        kind: str('Jenis entitas yang dicari', { enum: ['account', 'category', 'member', 'debt', 'goal', 'piutang'] }),
        query: str('Nama seperti disebut user, mis. "BCA istri", "cicilan motor"'),
        type: str('Hanya untuk kind=category: filter income/expense', { enum: ['income', 'expense'] }),
      },
      required: ['kind', 'query'],
    },
    endpoint: { method: 'POST', path: '/v1/resolve' },
    scope: 'read',
    idempotent: true,
    handler: async (actor, args) =>
      resolveName(actor, { kind: args.kind as never, query: String(args.query), type: args.type as 'income' | 'expense' | undefined }),
  },
  {
    name: 'get_summary',
    description: 'Ringkasan keuangan periode tertentu: total masuk/keluar, kategori teratas, saldo. Pakai untuk "gimana keuangan bulan ini", "pengeluaran istri bulan lalu berapa", "bulan ini hemat gak", "bulan ini keluar buat anak berapa" (scope=beneficiary, hanya kalau fitur aktif). Jangan jumlahkan manual dari search_transactions, selalu pakai tool ini untuk ringkasan.',
    parameters: {
      type: 'object',
      properties: {
        period: str('Periode ringkasan', { enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'all'] }),
        scope: str('Lingkup: seluruh household, satu anggota, atau satu penerima manfaat (F-A, hanya kalau fitur aktif)', { enum: ['household', 'member', 'beneficiary'] }),
        member: str('Nama/alias anggota (hanya kalau scope=member), mis. "istri", "Eko"'),
        beneficiary: str('Nama penerima manfaat atau "bersama" (hanya kalau scope=beneficiary, F-A)'),
      },
      required: ['period'],
    },
    endpoint: { method: 'GET', path: '/v1/summary' },
    scope: 'read',
    idempotent: true,
    handler: async (actor, args) =>
      summarySvc.getSummary(actor, {
        period: String(args.period ?? 'this_month'),
        scope: (args.scope as 'household' | 'member' | 'beneficiary' | undefined) ?? 'household',
        attribution: 'owner',
        compare: false,
        memberRef: args.member ? { member: String(args.member) } : undefined,
        beneficiaryRef: optStr(args.beneficiary) ? { beneficiary: optStr(args.beneficiary) } : undefined,
      }),
  },
  {
    name: 'get_budget_status',
    description: 'Sisa anggaran per kategori untuk satu bulan. Pakai untuk "sisa anggaran makan bulan ini", "budget transport masih ada?".',
    parameters: {
      type: 'object',
      properties: {
        month: str('Bulan format YYYY-MM, default bulan berjalan'),
        scope: str('Lingkup anggaran', { enum: ['household', 'member'] }),
      },
    },
    endpoint: { method: 'GET', path: '/v1/budgets/status' },
    scope: 'read',
    idempotent: true,
    handler: async (actor, args) => {
      const month = String(args.month ?? new Date().toISOString().slice(0, 7))
      return budgetsSvc.getBudgetStatus(actor, month, (args.scope as 'household' | 'member' | undefined) ?? 'household')
    },
  },
  {
    name: 'search_transactions',
    description: 'Cari transaksi dengan filter tanggal/tipe/kategori/akun/member. Pakai untuk "pengeluaran di atas 500rb minggu ini", "transaksi BCA suami kemarin", "belanja apa aja di Indomaret" (cari di catatan).',
    parameters: {
      type: 'object',
      properties: {
        period: str('Periode cepat, alternatif dari from/to', { enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year'] }),
        from: str('Tanggal mulai YYYY-MM-DD (dipakai kalau period tidak diisi)'),
        to: str('Tanggal akhir YYYY-MM-DD'),
        type: str('Tipe transaksi', { enum: ['income', 'expense', 'transfer'] }),
        account: str('Nama akun atau UUID'),
        category: str('Nama kategori atau UUID'),
        member: str('Nama/alias anggota pemilik akun'),
        q: str('Cari di catatan/note, mis. "indomaret"'),
        min_amount: num('Nominal minimum'),
        max_amount: num('Nominal maksimum'),
        beneficiary: str('F-A, opsional, HANYA kalau fitur aktif: filter nama penerima manfaat, atau "bersama" untuk transaksi yang tidak untuk siapa-siapa tertentu.'),
      },
    },
    endpoint: { method: 'GET', path: '/v1/transactions' },
    scope: 'read',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      return transactionsSvc.listTransactions(
        actor,
        {
          period: args.period as string | undefined,
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          type: args.type as string | undefined,
          account: args.account as string | undefined,
          category: args.category as string | undefined,
          member: args.member as string | undefined,
          q: args.q as string | undefined,
          min_amount: args.min_amount as number | undefined,
          max_amount: args.max_amount as number | undefined,
          beneficiary: optStr(args.beneficiary),
          attribution: 'owner',
          include_deleted: false,
          limit: 50,
        },
        timezone,
      )
    },
  },
  {
    name: 'record_expense',
    description: 'Catat PENGELUARAN dari satu akun. Gunakan saat user menyebut belanja/bayar/beli. Sebutkan akun persis seperti kata user (mis. "BCA istri", "cash", "gopay suami"). Kalau user tidak menyebut akun, tanya dulu, jangan menebak. Kategori pilih dari list_categories; kalau tidak yakin pakai nama yang paling dekat, API akan mencocokkan alias. Contoh: "catat belanja sayur 45rb dari BCA istri" → {amount_text:"45rb", account:"BCA istri", category:"Makanan", note:"belanja sayur"}. HANYA kalau fitur "untuk siapa" aktif (cek features.beneficiary di household saat ini) DAN user eksplisit sebut penerima (mis. "buat anak", "buat ortu") → isi juga beneficiary; kalau tidak disebut, JANGAN diisi/ditebak.',
    parameters: {
      type: 'object',
      properties: {
        amount_text: str('Nominal seperti diucapkan: "45rb", "1,2 juta", "45000"'),
        account: str('Nama akun atau UUID. Boleh mengandung pemilik: "BCA istri".'),
        category: str('Nama kategori atau UUID'),
        note: str('Keterangan singkat, mis. "belanja sayur"'),
        date: str('YYYY-MM-DD; default hari ini (WIB). "kemarin" → isi tanggal kemarin.', { format: 'date' }),
        beneficiary: str('F-A, HANYA kalau fitur aktif & user sebut eksplisit: nama penerima manfaat (mis. "anak", "ortu", nama anak). Kosongkan kalau tidak disebut — jangan menebak.'),
      },
      required: ['amount_text', 'account', 'category'],
    },
    endpoint: { method: 'POST', path: '/v1/transactions', body: { type: 'expense' } },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      return transactionsSvc.createTransaction(actor, { type: 'expense', ...pickAmountAccountCategory(args), beneficiary: optStr(args.beneficiary) }, timezone)
    },
  },
  {
    name: 'record_income',
    description: 'Catat PEMASUKAN ke satu akun. Gunakan saat user menyebut gaji/terima/dapat. Contoh: "gaji masuk 12 juta ke BCA suami" → {amount_text:"12 juta", account:"BCA suami", category:"Gaji"}.',
    parameters: {
      type: 'object',
      properties: {
        amount_text: str('Nominal seperti diucapkan'),
        account: str('Nama akun atau UUID tujuan dana masuk'),
        category: str('Nama kategori atau UUID, mis. "Gaji", "Freelance"'),
        note: str('Keterangan singkat'),
        date: str('YYYY-MM-DD; default hari ini', { format: 'date' }),
      },
      required: ['amount_text', 'account', 'category'],
    },
    endpoint: { method: 'POST', path: '/v1/transactions', body: { type: 'income' } },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      return transactionsSvc.createTransaction(actor, { type: 'income', ...pickAmountAccountCategory(args) }, timezone)
    },
  },
  {
    name: 'record_expense_batch',
    description: 'Catat BEBERAPA pengeluaran sekaligus dari SATU akun yang sama. Pakai saat user menyebut beberapa belanja dalam satu kalimat. Contoh: "tadi di pasar: sayur 20rb, ayam 45rb, buah 30rb, semua dari cash istri" → account:"cash istri", items:[{amount_text:"20rb",category:"Makanan",note:"sayur"},…].',
    parameters: {
      type: 'object',
      properties: {
        account: str('Nama akun atau UUID, berlaku untuk SEMUA item'),
        date: str('YYYY-MM-DD; default hari ini', { format: 'date' }),
        items: {
          type: 'array',
          description: 'Daftar item pengeluaran',
          items: {
            type: 'object',
            properties: {
              amount_text: str('Nominal item'), category: str('Nama kategori dari list_categories, dipilih dari JENIS barang item ini (sabun → Shopping, pulsa → Utilitas, obat → Kesehatan, sayur/lauk → Makanan); jangan semua Makanan. Ragu → "Lainnya".'), note: str('Keterangan item'),
              beneficiary: str('F-A, opsional: penerima manfaat item ini (hanya kalau fitur aktif & disebut eksplisit)'),
              titipan: str('Nama orang yang menitip, HANYA kalau user bilang item ini titipan orang lain yang akan mengganti uangnya → masuk Piutang + catatan piutang otomatis. Jangan isi kalau tidak disebut.'),
            },
            required: ['amount_text', 'category'],
          },
        },
      },
      required: ['account', 'items'],
    },
    endpoint: { method: 'POST', path: '/v1/transactions/batch' },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      const raw = (args.items as Array<{ amount_text?: string; amount?: number; category?: string; note?: string; beneficiary?: unknown; titipan?: unknown }>) ?? []
      const items = raw.map((i) => ({ ...i, beneficiary: optStr(i.beneficiary), titipan: optStr(i.titipan) }))
      return transactionsSvc.createTransactionBatch(actor, { account: args.account as string, date: args.date as string | undefined, items }, timezone)
    },
  },
  {
    name: 'record_transfer',
    description: 'Pindah dana antar akun milik household sendiri. Pakai untuk "transfer 2 juta dari BCA suami ke tabungan bersama", "topup gopay 100rb dari BCA".',
    parameters: {
      type: 'object',
      properties: {
        amount_text: str('Nominal transfer'),
        from_account: str('Nama akun atau UUID sumber dana'),
        to_account: str('Nama akun atau UUID tujuan dana'),
        note: str('Keterangan singkat'),
        date: str('YYYY-MM-DD; default hari ini', { format: 'date' }),
      },
      required: ['amount_text', 'from_account', 'to_account'],
    },
    endpoint: { method: 'POST', path: '/v1/transfers' },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      return transfersSvc.createTransfer(
        actor,
        { amount_text: args.amount_text as string, from_account: args.from_account as string, to_account: args.to_account as string, note: args.note as string | undefined, date: args.date as string | undefined },
        timezone,
      )
    },
  },
  {
    name: 'update_transaction',
    description: 'Ubah transaksi yang SUDAH tercatat (biasanya yang baru saja dicatat pada balasan sebelumnya). Perlu transaction_id dari hasil tool sebelumnya. Contoh: "eh salah, yang tadi 54rb bukan 45rb", "ganti kategorinya jadi Transport", "eh itu tadi buat anak" (isi beneficiary), "balikin yang tadi ke bersama" (beneficiary:"bersama").',
    parameters: {
      type: 'object',
      properties: {
        transaction_id: str('UUID transaksi yang mau diubah, dari respons tool sebelumnya'),
        amount_text: str('Nominal baru (opsional)'),
        category: str('Kategori baru (opsional)'),
        note: str('Catatan baru (opsional)'),
        date: str('Tanggal baru YYYY-MM-DD (opsional)', { format: 'date' }),
        beneficiary: str('F-A, opsional, HANYA kalau fitur aktif: nama penerima baru, atau kata "bersama"/"keluarga" untuk mengosongkan (kembali jadi pengeluaran bersama).'),
      },
      required: ['transaction_id'],
    },
    endpoint: { method: 'PATCH', path: '/v1/transactions/{transaction_id}' },
    scope: 'write',
    idempotent: false,
    handler: async (actor, args) =>
      transactionsSvc.updateTransaction(actor, String(args.transaction_id), {
        amount_text: args.amount_text as string | undefined,
        category: args.category as string | undefined,
        note: args.note as string | undefined,
        date: args.date as string | undefined,
        beneficiary: optStr(args.beneficiary),
      }),
  },
  {
    name: 'delete_transaction',
    description: 'Hapus (soft-delete) satu transaksi. Perlu transaction_id. Pakai untuk "hapus transaksi terakhir", "batalkan yang tadi" (gabungkan dengan search_transactions dulu kalau id belum diketahui).',
    parameters: { type: 'object', properties: { transaction_id: str('UUID transaksi yang mau dihapus') }, required: ['transaction_id'] },
    endpoint: { method: 'DELETE', path: '/v1/transactions/{transaction_id}' },
    scope: 'write',
    idempotent: false,
    handler: async (actor, args) => transactionsSvc.deleteTransaction(actor, String(args.transaction_id)),
  },
  {
    name: 'adjust_balance',
    description: 'Set saldo akun ke nominal aktual (koreksi, bukan transaksi baru). Pakai untuk "saldo BCA istri sekarang 3.250.000", "koreksi saldo cash jadi 150rb".',
    parameters: {
      type: 'object',
      properties: {
        account: str('Nama akun atau UUID yang mau dikoreksi'),
        new_balance: num('Saldo aktual yang benar sekarang'),
        note: str('Keterangan opsional'),
      },
      required: ['account', 'new_balance'],
    },
    endpoint: { method: 'POST', path: '/v1/accounts/{account_id}/adjust-balance' },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const accountId = await withActor(actor, (tx) => resolveAccountRef(tx, actor, { account: String(args.account) }))
      return accountsSvc.adjustBalance(actor, accountId, Number(args.new_balance), undefined, args.note as string | undefined)
    },
  },
  {
    name: 'list_debts',
    description: 'Hutang dan sisa cicilan. Pakai untuk "hutang kita tinggal berapa", "cicilan apa saja bulan ini".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/debts' },
    scope: 'read',
    idempotent: true,
    handler: async (actor) => debtsSvc.listDebts(actor, 'active'),
  },
  {
    name: 'pay_debt',
    description: 'Bayar cicilan hutang. Perlu debt_id (pakai resolve_name kind=debt dulu kalau belum tahu). Pakai untuk "bayar cicilan motor 1,2 juta dari BCA suami".',
    parameters: {
      type: 'object',
      properties: {
        debt_id: str('UUID hutang, dari resolve_name kind=debt'),
        amount_text: str('Nominal pembayaran'),
        account: str('Nama akun atau UUID sumber dana'),
        date: str('YYYY-MM-DD; default hari ini', { format: 'date' }),
      },
      required: ['debt_id', 'amount_text', 'account'],
    },
    endpoint: { method: 'POST', path: '/v1/debts/{debt_id}/payments' },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      return debtsSvc.payDebt(actor, String(args.debt_id), { amount_text: args.amount_text as string, account: args.account as string, date: args.date as string | undefined, allow_overpay: false }, timezone)
    },
  },
  {
    name: 'list_goals',
    description: 'Target tabungan dan progresnya. Pakai untuk "tabungan liburan sudah berapa".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/goals' },
    scope: 'read',
    idempotent: true,
    handler: async (actor) => goalsSvc.listGoals(actor),
  },
  {
    name: 'contribute_goal',
    description: 'Tambah tabungan ke target. Perlu goal_id (pakai resolve_name kind=goal dulu kalau belum tahu). Pakai untuk "nabung 500rb ke dana darurat dari BCA bersama".',
    parameters: {
      type: 'object',
      properties: {
        goal_id: str('UUID goal, dari resolve_name kind=goal'),
        amount_text: str('Nominal setoran'),
        account: str('Nama akun atau UUID sumber dana (opsional — kosongkan kalau cuma mencatat progres tanpa potong saldo)'),
        date: str('YYYY-MM-DD; default hari ini', { format: 'date' }),
      },
      required: ['goal_id', 'amount_text'],
    },
    endpoint: { method: 'POST', path: '/v1/goals/{goal_id}/contributions' },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      return goalsSvc.contributeGoal(actor, String(args.goal_id), { amount_text: args.amount_text as string, account: (args.account as string | undefined) ?? null, date: args.date as string | undefined }, timezone)
    },
  },
  {
    name: 'list_piutang',
    description: 'Piutang (uang yang dipinjamkan ke orang lain) dan sisanya. Pakai untuk "si Budi masih utang berapa ke kita".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/piutang' },
    scope: 'read',
    idempotent: true,
    handler: async (actor) => piutangSvc.listPiutang(actor),
  },
  {
    name: 'receive_piutang',
    description: 'Catat penerimaan pembayaran piutang dari orang lain. Perlu piutang_id (pakai resolve_name kind=piutang dulu kalau belum tahu). Pakai untuk "Budi bayar 250rb ke BCA suami".',
    parameters: {
      type: 'object',
      properties: {
        piutang_id: str('UUID piutang, dari resolve_name kind=piutang'),
        amount_text: str('Nominal yang diterima'),
        account: str('Nama akun atau UUID tujuan dana'),
        date: str('YYYY-MM-DD; default hari ini', { format: 'date' }),
      },
      required: ['piutang_id', 'amount_text', 'account'],
    },
    endpoint: { method: 'POST', path: '/v1/piutang/{piutang_id}/receipts' },
    scope: 'write',
    idempotent: true,
    handler: async (actor, args) => {
      const timezone = await getHouseholdTimezone(actor)
      return piutangSvc.receivePiutang(actor, String(args.piutang_id), { amount_text: args.amount_text as string, account: args.account as string, date: args.date as string | undefined, allow_overpay: false }, timezone)
    },
  },
  {
    name: 'list_recurrings',
    description: 'Tagihan rutin dan jatuh temponya. Pakai untuk "tagihan apa yang jatuh tempo minggu ini".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/recurrings' },
    scope: 'read',
    idempotent: true,
    handler: async (actor) => recurringsSvc.listRecurrings(actor),
  },
  {
    name: 'run_recurrings',
    description: 'Jalankan semua tagihan rutin yang sudah jatuh tempo sekarang. Pakai untuk "jalankan tagihan rutin sekarang". Biasanya tidak perlu dipanggil manual (ada fallback otomatis), tapi boleh dipakai kalau user minta eksplisit.',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'POST', path: '/v1/recurrings/run' },
    scope: 'write',
    idempotent: true,
    handler: async (actor) => recurringsSvc.runRecurrings(actor),
  },

  // ── F-A beneficiary (10-fitur-opsional-keluarga.md §3.5) ────────────────────────────────────
  {
    name: 'list_beneficiaries',
    description: 'Daftar "untuk siapa" yang sudah dikenal (anak, orang tua, dll). Panggil sebelum mencatat/mengubah transaksi dengan beneficiary kalau ragu nama yang valid, atau saat user tanya "siapa aja yang bisa dipilih".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/beneficiaries' },
    scope: 'read',
    idempotent: true,
    feature: 'beneficiary',
    handler: async (actor) => beneficiariesSvc.listBeneficiaries(actor),
  },
  {
    name: 'add_beneficiary',
    description: 'Tambah "untuk siapa" baru. Pakai saat user minta eksplisit menambah penerima baru, mis. "tambah Seno sebagai penerima", "nanti kalau beli buat kontrakan catat sebagai Kontrakan". Kind "child"/"relative"/"property"/"other" — pilih yang paling cocok, default "other" kalau ragu.',
    parameters: {
      type: 'object',
      properties: {
        name: str('Nama penerima, mis. "Anak", "Seno", "Kontrakan"'),
        kind: str('Jenis', { enum: ['child', 'relative', 'property', 'other'] }),
      },
      required: ['name'],
    },
    endpoint: { method: 'POST', path: '/v1/beneficiaries' },
    scope: 'write',
    idempotent: true,
    feature: 'beneficiary',
    handler: async (actor, args) => beneficiariesSvc.createBeneficiary(actor, { name: String(args.name), kind: (args.kind as 'child' | 'relative' | 'property' | 'other') ?? 'other', aliases: [] }),
  },

  // ── F-B laporan bulanan (10-fitur-opsional-keluarga.md §4) — SELALU tersedia, tidak di-gate ──
  {
    name: 'get_monthly_report',
    description: 'Laporan bulanan siap-kirim: total masuk/keluar, kategori terbesar, piutang belum lunas, hutang jatuh tempo, saldo tiap akun, dan ringkasan teks siap kirim (`text_id`). Pakai untuk "laporan bulan ini", "gimana keuangan bulan lalu" kalau user minta ringkasan lengkap (bukan sekadar get_summary), atau saat dipicu jadwal pengiriman otomatis (features.monthly_report). SELALU tersedia — tidak perlu fitur apa pun aktif.',
    parameters: {
      type: 'object',
      properties: { month: str('YYYY-MM; kosongkan untuk bulan sebelumnya (default)') },
    },
    endpoint: { method: 'GET', path: '/v1/reports/monthly' },
    scope: 'read',
    idempotent: true,
    handler: async (actor, args) => reportsSvc.getMonthlyReport(actor, { month: args.month as string | undefined }),
  },

  // ── F-D belanja & pantry (10-fitur-opsional-keluarga.md §6) ─────────────────────────────────
  {
    name: 'ingest_receipt',
    description: 'Catat SATU STRUK sekaligus: transaksi pengeluaran per item + coret item yang cocok di daftar belanja + tambah stok pantry — semua dalam satu langkah. Pakai saat user kirim foto struk atau sebut beberapa barang belanjaan dengan harga dari SATU toko/transaksi. Beda dari record_expense_batch: ini JUGA mencoba mencocokkan ke shopping list & pantry (boleh dimatikan per panggilan lewat shopping/pantry:false kalau user eksplisit tidak mau). Kategori ditentukan PER ITEM dari jenis barangnya, bukan dari nama toko: struk minimarket biasanya campuran (makanan/bahan masak → kategori makanan; sabun/deterjen/tisu/popok → belanja/Shopping; pulsa/token listrik → Utilitas; obat/vitamin → Kesehatan). Jangan menjatuhkan semua item ke Makanan. Note transaksi otomatis berformat "[Nama Toko] Nama item" — kirim merchant kalau terbaca. Item TITIPAN (dibelikan untuk orang lain yang akan mengganti uangnya) → isi items[].titipan dengan nama orangnya: masuk Piutang + catatan piutang otomatis, dan respons memuat `piutang[]` — sebutkan ke user.',
    parameters: {
      type: 'object',
      properties: {
        account: str('Nama akun atau UUID yang dipakai bayar'),
        date: str('YYYY-MM-DD; default hari ini', { format: 'date' }),
        merchant: str('Nama toko, kalau disebut/terbaca'),
        ref_no: str('Nomor referensi/RRN di struk, kalau ada (opsional, berguna untuk rekonsiliasi nanti)'),
        items: {
          type: 'array',
          description: 'Daftar item di struk',
          items: {
            type: 'object',
            properties: {
              name: str('Nama item persis seperti di struk atau diucapkan user'),
              qty: num('Jumlah unit, default 1'),
              amount: num('Harga item ini dalam rupiah (bukan per-unit kalau qty>1, total item ini)'),
              category: str('Nama kategori dari list_categories, dipilih dari JENIS barang ini (bukan toko). Ragu → "Lainnya" atau kosongkan: API menebak dari nama item, dan nama tak dikenal dipetakan ke kategori household terdekat (tidak pernah error).'),
              for: str('F-A, opsional, HANYA kalau fitur aktif: penerima manfaat item ini'),
              titipan: str('Nama orang yang MENITIP, HANYA kalau user bilang item ini titipan/dibelikan untuk orang lain yang akan mengganti uangnya ("sabunnya titipan Bu Ani"). Item itu masuk kategori Piutang + otomatis dibuatkan catatan piutang atas nama orang itu (bukan pengeluaran keluarga). Jangan isi kalau tidak disebut.'),
            },
            required: ['name', 'amount'],
          },
        },
        total: num('Total struk kalau disebut/terbaca — dipakai untuk validasi (harus sama dengan jumlah semua item)'),
        shopping: { type: 'boolean', description: 'Default true. false HANYA kalau user eksplisit minta jangan coret daftar belanja.' } as JsonSchema,
        pantry: { type: 'boolean', description: 'Default true. false HANYA kalau user eksplisit minta jangan tambah stok.' } as JsonSchema,
      },
      required: ['account', 'items'],
    },
    endpoint: { method: 'POST', path: '/v1/receipts/ingest' },
    scope: 'write',
    idempotent: true,
    feature: 'shopping_stock',
    handler: async (actor, args) => {
      // Number(): model internal bisa mengirim angka sebagai string ("25000") — tanpa coerce,
      // reduce() di ingestReceipt akan MENYAMBUNG string, bukan menjumlah (review 2026-10-08).
      const items = (args.items as Array<{ name: string; qty?: unknown; amount: unknown; category?: string; for?: unknown; titipan?: unknown }>) ?? []
      return ingestReceipt(actor, {
        account: args.account as string | undefined,
        date: args.date as string | undefined,
        merchant: optStr(args.merchant),
        ref_no: optStr(args.ref_no),
        items: items.map((i) => ({ name: i.name, qty: i.qty == null ? 1 : Number(i.qty), amount: Number(i.amount), category: i.category, for: optStr(i.for), titipan: optStr(i.titipan) })),
        total: args.total == null ? undefined : Number(args.total),
        shopping: args.shopping !== false,
        pantry: args.pantry !== false,
      })
    },
  },
  {
    name: 'list_shopping',
    description: 'Daftar belanja yang masih perlu dibeli. Pakai untuk "apa aja yang perlu dibeli", "daftar belanja kita apa".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/shopping' },
    scope: 'read',
    idempotent: true,
    feature: 'shopping_stock',
    handler: async (actor) => shoppingSvc.listShopping(actor, 'needed'),
  },
  {
    name: 'add_shopping_item',
    description: 'Tambah satu item ke daftar belanja. Pakai untuk "tambahin telur ke daftar belanja", "inget beli sabun cuci" — TANPA harga/nada "sudah terjadi" (kalau user sebut harga dan sudah dibeli, itu record_expense/ingest_receipt, bukan ini).',
    parameters: {
      type: 'object',
      properties: { name: str('Nama item, mis. "Telur"'), qty_text: str('Jumlah kalau disebut, mis. "2 kg", "1 dus"') },
      required: ['name'],
    },
    endpoint: { method: 'POST', path: '/v1/shopping' },
    scope: 'write',
    idempotent: true,
    feature: 'shopping_stock',
    handler: async (actor, args) => shoppingSvc.createShoppingItem(actor, { name: String(args.name), qty_text: args.qty_text as string | undefined, notes: '' }),
  },
  {
    name: 'mark_bought',
    description: 'Tandai item di daftar belanja sudah dibeli (TANPA ikut mencatat transaksi uangnya — kalau user juga sebut harga dan belum dicatat, pakai ingest_receipt/record_expense dulu). Perlu shopping_item_id dari list_shopping.',
    parameters: { type: 'object', properties: { shopping_item_id: str('UUID item, dari list_shopping') }, required: ['shopping_item_id'] },
    endpoint: { method: 'PATCH', path: '/v1/shopping/{shopping_item_id}', body: { status: 'bought' } },
    scope: 'write',
    idempotent: false,
    feature: 'shopping_stock',
    handler: async (actor, args) => shoppingSvc.updateShoppingItem(actor, String(args.shopping_item_id), { status: 'bought' }),
  },
  {
    name: 'shopping_suggestions',
    description: 'Barang di stok yang sudah menipis dan belum ada di daftar belanja. Pakai untuk "ada yang perlu ditambahin ke belanja gak dari stok yang menipis".',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/shopping/suggestions' },
    scope: 'read',
    idempotent: true,
    feature: 'shopping_stock',
    handler: async (actor) => shoppingSvc.listShoppingSuggestions(actor),
  },
  {
    name: 'list_pantry',
    description: 'Daftar stok rumah (kulkas/freezer/lemari). Pakai untuk "ada apa aja di kulkas", "stok minyak masih ada gak", "apa yang mau basi". Kalau user tanya SPESIFIK lokasi (kulkas/freezer/lemari), tetap panggil tool ini dan filter sendiri dari hasilnya.',
    parameters: { type: 'object', properties: {} },
    endpoint: { method: 'GET', path: '/v1/pantry' },
    scope: 'read',
    idempotent: true,
    feature: 'shopping_stock',
    handler: async (actor) => pantrySvc.listPantry(actor),
  },
  {
    name: 'adjust_pantry',
    description: 'Ubah jumlah stok satu item (dipakai/habis/dibuang/koreksi) TANPA lewat struk. Perlu pantry_item_id dari list_pantry. Pakai untuk "abis telur 4", "telurnya dibuang 2 karena busuk", "ternyata minyaknya masih 1 botol" (adjust dengan reason sesuai). delta negatif = berkurang, positif = bertambah.',
    parameters: {
      type: 'object',
      properties: {
        pantry_item_id: str('UUID item, dari list_pantry'),
        delta: num('Perubahan jumlah: negatif kalau berkurang (dipakai/dibuang), positif kalau bertambah'),
        reason: str('Alasan perubahan', { enum: ['consume', 'expired', 'adjust', 'purchase'] }),
      },
      required: ['pantry_item_id', 'delta', 'reason'],
    },
    endpoint: { method: 'POST', path: '/v1/pantry/{pantry_item_id}/movements' },
    scope: 'write',
    idempotent: false,
    feature: 'shopping_stock',
    handler: async (actor, args) =>
      pantrySvc.addPantryMovement(actor, String(args.pantry_item_id), { delta: Number(args.delta), reason: args.reason as 'consume' | 'expired' | 'adjust' | 'purchase', note: '' }),
  },
]

function pickAmountAccountCategory(args: Record<string, unknown>) {
  return {
    amount_text: args.amount_text as string | undefined,
    amount: args.amount as number | undefined,
    account: args.account as string | undefined,
    category: args.category as string | undefined,
    note: args.note as string | undefined,
    date: args.date as string | undefined,
  }
}

export function toolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name)
}
