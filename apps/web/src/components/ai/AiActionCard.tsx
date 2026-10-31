import React, { useState } from 'react'
import { api, unwrap } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import type { AiAction } from '../../services/aiChatStream'

const fmtRp = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`

export type AiActionCardProps = {
  action: AiAction & { applied?: boolean }
  onMarkApplied: (systemNote?: string) => void
  onInvalidate: () => void
  onShowToast?: (msg: string, type?: string) => void
  onOpenExpenseModal?: (draft: {
    account?: string
    category?: string
    amount?: number
    date?: string
    note?: string
  }) => void
  onOpenGoalModal?: (draft: {
    name?: string
    target?: number
    deadline?: string
  }) => void
}

type ExistingBudgetRow = {
  id: string
  category?: { id?: string; name?: string }
}

export function AiActionCard({
  action,
  onMarkApplied,
  onInvalidate,
  onShowToast,
  onOpenExpenseModal,
  onOpenGoalModal,
}: AiActionCardProps) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const applied = Boolean(action.applied)
  const applyLabel = t('ai.action.apply') === 'ai.action.apply' ? 'Terapkan' : t('ai.action.apply')
  const appliedLabel =
    t('ai.action.applied') === 'ai.action.applied' ? 'Sudah diterapkan' : t('ai.action.applied')
  const detailsLabel =
    t('ai.action.details') === 'ai.action.details' ? 'Lihat detail' : t('ai.action.details')

  const payload = action.payload ?? {}

  const budgetMonth = typeof payload.month === 'string' ? payload.month : ''
  const budgetItems: Array<{ category: string; amount: number }> = Array.isArray(payload.items)
    ? (payload.items as Array<{ category: string; amount: number }>).filter(
        (it) => it && typeof it.category === 'string' && typeof it.amount === 'number',
      )
    : []
  const budgetTotal = budgetItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)

  const shoppingItems: Array<{ name: string; qty?: number; unit?: string }> = Array.isArray(
    payload.items,
  )
    ? (payload.items as Array<{ name: string; qty?: number; unit?: string }>).filter(
        (it) => it && typeof it.name === 'string',
      )
    : []

  const confirmText = (() => {
    const raw = t('ai.action.confirm_budget')
    const tmpl =
      raw === 'ai.action.confirm_budget'
        ? 'Buat {count} anggaran senilai {total}?'
        : raw
    return tmpl
      .replace('{count}', String(budgetItems.length))
      .replace('{total}', fmtRp(budgetTotal))
  })()

  const executeApplyBudget = async () => {
    setBusy(true)
    setErrorMsg(null)
    try {
      // Ambil daftar anggaran bulan terkait terlebih dahulu untuk deteksi kategori yang sudah ada
      const existingRows = (await unwrap(
        await api.GET('/v1/budgets', {
          params: { query: { month: budgetMonth } },
        }),
      )) as ExistingBudgetRow[]

      const byCat = new Map<string, string>()
      for (const row of existingRows ?? []) {
        const catName = row.category?.name?.trim().toLowerCase()
        if (catName && row.id) byCat.set(catName, row.id)
      }

      let created = 0
      let updated = 0
      const failures: string[] = []

      for (const item of budgetItems) {
        const key = item.category.trim().toLowerCase()
        const existingId = byCat.get(key)
        try {
          if (existingId) {
            await unwrap(
              await api.PATCH('/v1/budgets/{id}', {
                params: { path: { id: existingId } },
                body: { amount: item.amount },
              }),
            )
            updated += 1
          } else {
            await unwrap(
              await api.POST('/v1/budgets', {
                body: {
                  category: item.category,
                  amount: item.amount,
                  month: budgetMonth,
                },
              }),
            )
            created += 1
          }
        } catch (err) {
          const e = err as Error & { status?: number; hint?: string }
          // Jika server mengembalikan 409 (sudah ada), coba ambil ulang dan PATCH
          if (e.status === 409) {
            try {
              const refreshed = (await unwrap(
                await api.GET('/v1/budgets', {
                  params: { query: { month: budgetMonth } },
                }),
              )) as ExistingBudgetRow[]
              const match = (refreshed ?? []).find(
                (r) => r.category?.name?.trim().toLowerCase() === key,
              )
              if (match?.id) {
                await unwrap(
                  await api.PATCH('/v1/budgets/{id}', {
                    params: { path: { id: match.id } },
                    body: { amount: item.amount },
                  }),
                )
                updated += 1
                continue
              }
            } catch {
              // jatuh ke pelaporan gagal di bawah
            }
          }
          failures.push(
            `${item.category}: ${e.message || 'Gagal'}${e.hint ? ` (${e.hint})` : ''}`,
          )
        }
      }

      onInvalidate()

      if (failures.length > 0 && created + updated === 0) {
        setErrorMsg(`Gagal menerapkan anggaran — ${failures.join('; ')}`)
        return
      }

      const doneBase =
        t('ai.action.done_budget') === 'ai.action.done_budget'
          ? 'Anggaran berhasil diterapkan'
          : t('ai.action.done_budget')
      const summaryParts: string[] = []
      if (created > 0) summaryParts.push(`${created} anggaran dibuat`)
      if (updated > 0) summaryParts.push(`${updated} diperbarui`)
      const summaryDetail = summaryParts.length ? ` (${summaryParts.join(', ')})` : ''

      onShowToast?.(`✅ ${doneBase}${summaryDetail}`)
      setConfirming(false)

      if (failures.length > 0) {
        setErrorMsg(`Sebagian pos gagal: ${failures.join('; ')}`)
        onMarkApplied(
          `✅ ${doneBase} untuk ${budgetMonth}${summaryDetail}. ⚠️ Gagal sebagian: ${failures.join('; ')}`,
        )
      } else {
        onMarkApplied(`✅ ${doneBase} (${budgetItems.length} pos, ${fmtRp(budgetTotal)}).`)
      }
    } catch (err) {
      const e = err as Error & { hint?: string }
      setErrorMsg(`${e.message || 'Gagal menerapkan anggaran'}${e.hint ? ` (${e.hint})` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const executeAddShopping = async () => {
    setBusy(true)
    setErrorMsg(null)
    try {
      let added = 0
      const failures: string[] = []
      for (const item of shoppingItems) {
        try {
          await unwrap(
            await api.POST('/v1/shopping', {
              body: {
                name: item.name,
                qty: item.qty ?? 1,
                unit: item.unit ?? 'pcs',
                notes: '',
              },
            }),
          )
          added += 1
        } catch (err) {
          const e = err as Error & { hint?: string }
          failures.push(`${item.name}: ${e.message || 'Gagal'}${e.hint ? ` (${e.hint})` : ''}`)
        }
      }
      onInvalidate()
      if (failures.length > 0 && added === 0) {
        setErrorMsg(`Gagal menambah daftar belanja — ${failures.join('; ')}`)
        return
      }
      onShowToast?.(`✅ ${added} item ditambahkan ke daftar belanja`)
      onMarkApplied(`✅ ${added} item ditambahkan ke daftar belanja.`)
    } finally {
      setBusy(false)
    }
  }

  const handlePrimaryClick = () => {
    if (applied || busy) return
    if (action.type === 'apply_budget') {
      setConfirming(true)
      return
    }
    if (action.type === 'record_expense') {
      onOpenExpenseModal?.({
        account: typeof payload.account === 'string' ? payload.account : undefined,
        category: typeof payload.category === 'string' ? payload.category : undefined,
        amount: typeof payload.amount === 'number' ? payload.amount : undefined,
        date: typeof payload.date === 'string' ? payload.date : undefined,
        note: typeof payload.note === 'string' ? payload.note : undefined,
      })
      onMarkApplied()
      return
    }
    if (action.type === 'add_shopping') {
      void executeAddShopping()
      return
    }
    if (action.type === 'set_goal') {
      onOpenGoalModal?.({
        name: typeof payload.name === 'string' ? payload.name : undefined,
        target: typeof payload.target === 'number' ? payload.target : undefined,
        deadline: typeof payload.deadline === 'string' ? payload.deadline : undefined,
      })
      onMarkApplied()
    }
  }

  return (
    <div
      data-testid={`ai-action-card-${action.type}`}
      style={{
        marginTop: 8,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'var(--bg-surface-low)',
        border: '1px solid var(--color-border-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--color-text)' }}>
          ⚡ {action.label}
        </div>
        {action.type === 'apply_budget' && (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--color-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {budgetItems.length} pos · {fmtRp(budgetTotal)}
          </span>
        )}
      </div>

      {/* Ringkasan per tipe */}
      {action.type === 'apply_budget' && (expanded || budgetItems.length <= 4) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            fontSize: 11.5,
            color: 'var(--color-text-muted)',
            paddingTop: 2,
          }}
        >
          {(expanded ? budgetItems : budgetItems.slice(0, 4)).map((it, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{it.category}</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                {fmtRp(it.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {action.type === 'record_expense' && (
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
          {String(payload.category || '')} —{' '}
          <strong style={{ color: 'var(--color-text)' }}>{fmtRp(Number(payload.amount || 0))}</strong>
          {payload.account ? ` (${String(payload.account)})` : ''}
          {expanded && payload.note ? ` · "${String(payload.note)}"` : ''}
        </div>
      )}

      {action.type === 'add_shopping' && (
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
          {(expanded ? shoppingItems : shoppingItems.slice(0, 4))
            .map((it) => `${it.name}${it.qty ? ` (${it.qty}${it.unit ? ` ${it.unit}` : ''})` : ''}`)
            .join(', ')}
        </div>
      )}

      {action.type === 'set_goal' && (
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
          {String(payload.name || '')} —{' '}
          <strong style={{ color: 'var(--color-text)' }}>{fmtRp(Number(payload.target || 0))}</strong>
          {payload.deadline ? ` (target ${String(payload.deadline)})` : ''}
        </div>
      )}

      {confirming && !applied && (
        <div
          data-testid="ai-action-confirm"
          style={{
            marginTop: 4,
            padding: '8px 10px',
            borderRadius: 9,
            background: 'var(--color-primary-soft)',
            border: '1px solid var(--color-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
            {confirmText}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void executeApplyBudget()}
              style={{
                padding: '5px 12px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {busy ? 'Menerapkan…' : applyLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              style={{
                padding: '5px 10px',
                borderRadius: 7,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-muted)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>⚠️ {errorMsg}</div>
      )}

      {!confirming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <button
            type="button"
            disabled={applied || busy}
            onClick={handlePrimaryClick}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: 'none',
              background: applied ? 'var(--color-border-soft)' : 'var(--color-primary)',
              color: applied ? 'var(--color-muted)' : 'var(--color-on-primary)',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: applied || busy ? 'default' : 'pointer',
            }}
          >
            {applied ? `✓ ${appliedLabel}` : busy ? 'Memproses…' : applyLabel}
          </button>
          {(action.type === 'apply_budget' || action.type === 'add_shopping') && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                padding: '4px 8px',
                borderRadius: 7,
                border: 'none',
                background: 'transparent',
                color: 'var(--color-muted)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Sembunyikan' : detailsLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AiActionCard
