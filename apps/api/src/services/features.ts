import type postgres from 'postgres'
import { ApiError } from '@karaya/shared/errors'
import { HouseholdFeaturesSchema, type HouseholdFeatures } from '@karaya/shared/schemas'
import type { Actor } from '../auth/actor'
import { withActor } from '../db/tx'

/**
 * F-0 (10-fitur-opsional-keluarga.md §2): flag opsional per household. Cache ringan per proses,
 * pola sama dengan tzCache di services/households.ts — flag jarang berubah tapi dicek di hampir
 * setiap handler fitur opsional, TTL pendek supaya toggle tetap terasa langsung tanpa restart.
 */
const featuresCache = new Map<string, { features: HouseholdFeatures; expiresAt: number }>()

export function invalidateFeaturesCache(householdId: string) {
  featuresCache.delete(householdId)
}

/**
 * `{}` dari DB (household belum pernah menyentuh fitur opsional) di-parse jadi semua `enabled:false`
 * lewat default zod. Skema penyimpanan TIDAK strict (kunci asing di-strip) — dan kalau isinya
 * benar-benar rusak (tipe salah karena edit manual/rollback), JANGAN melempar: kolom ini dibaca
 * oleh summary/households/current/bootstrap, satu baris jsonb cacat tidak boleh membuat semua
 * endpoint inti household itu 500. Fallback = semua fitur mati + log, bukan error.
 */
export function parseHouseholdFeatures(raw: unknown): HouseholdFeatures {
  const parsed = HouseholdFeaturesSchema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  console.error('[features] households.features tidak valid, fallback semua mati:', parsed.error.issues)
  return HouseholdFeaturesSchema.parse({})
}

export async function getHouseholdFeatures(actor: Actor): Promise<HouseholdFeatures> {
  const cached = featuresCache.get(actor.householdId)
  if (cached && cached.expiresAt > Date.now()) return cached.features

  return withActor(actor, async (tx) => {
    const features = await getHouseholdFeaturesInTx(tx, actor.householdId)
    featuresCache.set(actor.householdId, { features, expiresAt: Date.now() + 30_000 })
    return features
  })
}

/**
 * Varian tanpa cache/koneksi baru, dipakai saat SUDAH berada di dalam transaksi `withActor` lain
 * — menghindari membuka koneksi kedua dari pool untuk satu request yang sama.
 */
export async function getHouseholdFeaturesInTx(tx: postgres.TransactionSql, householdId: string): Promise<HouseholdFeatures> {
  const [row] = await tx<{ features: unknown }[]>`select features from households where id = ${householdId}`
  return parseHouseholdFeatures(row?.features)
}

type FeatureKey = keyof HouseholdFeatures

/**
 * Dipanggil LANGSUNG di awal fungsi service (bukan middleware `.use('*', ...)` — pola yang sama
 * dengan assertScope/requireJwtOnly, lihat catatan bug wildcard kumulatif di apps/api/src/app.ts).
 * Tulis DAN baca ke fitur yang mati sama-sama 403 (10-fitur-opsional-keluarga.md §2.2) — supaya
 * agent tidak salah simpul "datanya kosong" padahal fiturnya belum pernah dinyalakan.
 */
export async function requireFeature(actor: Actor, feature: FeatureKey): Promise<void> {
  const features = await getHouseholdFeatures(actor)
  if (!features[feature].enabled) {
    throw ApiError.fromCode('feature_disabled', { details: { feature } })
  }
}

/**
 * F-A (10-fitur-opsional-keluarga.md §2.2 pengecualian): field/filter OPSIONAL `beneficiary`/
 * `beneficiary_id` di endpoint INTI (transactions, summary, receipts) saat fitur mati -> 400
 * validation_error dengan hint, BUKAN feature_disabled (403) dan BUKAN diam-diam diabaikan.
 * Tinggal di sini (bukan per call-site) dan dipanggil dari resolveBeneficiaryRef, supaya setiap
 * jalur yang me-resolve beneficiary otomatis kena gate — review 2026-10-07 menemukan jalur ke-5
 * (`receipts/ingest`, `items[].for`) lolos karena gate-nya tadinya diulang manual di 4 tempat.
 */
export async function assertBeneficiaryFieldAllowed(tx: postgres.TransactionSql, actor: Actor, field = 'beneficiary'): Promise<void> {
  const features = await getHouseholdFeaturesInTx(tx, actor.householdId)
  if (!features.beneficiary.enabled) {
    throw ApiError.fromCode('validation_error', {
      message: 'Field "untuk siapa" (beneficiary) belum aktif untuk household ini.',
      hint: 'Aktifkan di Settings > Household > Fitur opsional.',
      details: { field },
    })
  }
}
