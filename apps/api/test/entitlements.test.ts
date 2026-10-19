import { describe, expect, it } from 'vitest'
import { PAID_FEATURE_KEYS } from '@karaya/shared/schemas'
import { computeHouseholdPlanStatus } from '../src/services/entitlements'

describe('computeHouseholdPlanStatus (Fondasi Paket & Entitlements)', () => {
  it('saat enforcePaidFeatures = false (default early adopter), semua 7 fitur terbuka walau tier = free', () => {
    const status = computeHouseholdPlanStatus({ plan_tier: 'free', plan_expires_at: null, entitlements: {} }, false)
    expect(status.tier).toBe('free')
    expect(status.effective_tier).toBe('free')
    expect(status.is_active).toBe(false)
    expect(status.enforce_paid_features).toBe(false)
    for (const key of PAID_FEATURE_KEYS) {
      expect(status.entitlements[key]).toBe(true)
    }
  })

  it('saat enforcePaidFeatures = true, tier = lifetime selalu aktif tanpa batas waktu', () => {
    const status = computeHouseholdPlanStatus(
      { plan_tier: 'lifetime', plan_expires_at: '2020-01-01T00:00:00Z', entitlements: {} },
      true,
    )
    expect(status.tier).toBe('lifetime')
    expect(status.effective_tier).toBe('lifetime')
    expect(status.is_active).toBe(true)
    expect(status.enforce_paid_features).toBe(true)
    for (const key of PAID_FEATURE_KEYS) {
      expect(status.entitlements[key]).toBe(true)
    }
  })

  it('saat enforcePaidFeatures = true, tier = pro aktif jika expires_at null atau di masa depan', () => {
    const future = new Date(Date.now() + 86_400_000 * 30).toISOString()
    const status = computeHouseholdPlanStatus({ plan_tier: 'pro', plan_expires_at: future, entitlements: {} }, true)
    expect(status.tier).toBe('pro')
    expect(status.effective_tier).toBe('pro')
    expect(status.is_active).toBe(true)
    for (const key of PAID_FEATURE_KEYS) {
      expect(status.entitlements[key]).toBe(true)
    }
  })

  it('saat enforcePaidFeatures = true, tier = pro yang sudah lewat expires_at otomatis turun ke effective_tier = free', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString()
    const status = computeHouseholdPlanStatus({ plan_tier: 'pro', plan_expires_at: past, entitlements: {} }, true)
    expect(status.tier).toBe('pro')
    expect(status.effective_tier).toBe('free')
    expect(status.is_active).toBe(false)
    for (const key of PAID_FEATURE_KEYS) {
      expect(status.entitlements[key]).toBe(false)
    }
  })

  it('mendukung add-on per fitur lewat JSONB entitlements walau tier = free dan enforcePaidFeatures = true', () => {
    const status = computeHouseholdPlanStatus(
      {
        plan_tier: 'free',
        plan_expires_at: null,
        entitlements: { receipt_storage: true, price_compare: true },
      },
      true,
    )
    expect(status.effective_tier).toBe('free')
    expect(status.entitlements.receipt_storage).toBe(true)
    expect(status.entitlements.price_compare).toBe(true)
    expect(status.entitlements.api_access).toBe(false)
    expect(status.entitlements.multi_member).toBe(false)
    expect(status.entitlements.shopping_stock).toBe(false)
    expect(status.entitlements.beneficiary).toBe(false)
    expect(status.entitlements.excel_export).toBe(false)
  })
})
