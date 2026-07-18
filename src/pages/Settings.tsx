import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, Edit2, Download, Check, ChevronDown, ChevronUp, Upload, FileText, Clock } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Input, Select, Field } from '../components/ui/Input'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { TaxBreakdown } from '../components/TaxBreakdown'
import { PaystubUpload } from '../components/PaystubUpload'
import { PaystubHistory } from '../components/PaystubHistory'
import { calculateTaxes, US_STATES, FilingStatus } from '../lib/taxes'
import { loadPaystubs } from '../lib/paystubDb'
import { Category, Paystub } from '../types'
import { uuid } from '../utils/uuid'
import { supabase } from '../lib/supabase'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

function fmtPayDate(d: string): string {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

const ICONS = ['🛒','🍽️','🚗','🎬','🛍️','⚡','💪','🏠','💰','💻','📈','✈️','🏥','📚','🎮','☕','🐕','👶','🎁','🔧','📱','🏋️','🎵','🍺']

const PERIODS_PER_MONTH: Record<string, number> = {
  weekly: 52 / 12, biweekly: 26 / 12, 'semi-monthly': 2, monthly: 1,
}

const FREQ_LABEL: Record<string, string> = {
  weekly: 'week', biweekly: '2 weeks', 'semi-monthly': 'semi-month', monthly: 'month',
}

function CategoryModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Category }) {
  const { dispatch } = useStore()
  const [form, setForm] = useState({
    name: initial?.name || '',
    type: (initial?.type || 'expense') as 'income' | 'expense',
    color: initial?.color || GREEN,
    icon: initial?.icon || '💳',
    keywords: initial?.keywords?.join(', ') || '',
  })
  const [err, setErr] = useState('')

  function save() {
    if (!form.name.trim()) return setErr('Name is required')
    setErr('')
    const keywords = form.keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length >= 2)
    const cat: Category = {
      id: initial?.id || uuid(),
      name: form.name.trim(),
      type: form.type,
      color: form.color,
      icon: form.icon,
      keywords: keywords.length > 0 ? keywords : undefined,
    }
    dispatch({ type: initial ? 'UPDATE_CATEGORY' : 'ADD_CATEGORY', payload: cat })
    onClose()
  }

  const COLORS = [GREEN, '#4A6CF7', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b', '#f97316', '#84cc16']

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Category' : 'Add Category'} size="sm">
      <form onSubmit={e => { e.preventDefault(); save() }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {err && <p style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-dim)', padding: '8px 12px', borderRadius: 8 }}>{err}</p>}
        <Field label="Name">
          <Input autoFocus placeholder="Groceries" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Type — sets which transactions match">
          <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
            <option value="expense">Expense (debit / outgoing money)</option>
            <option value="income">Income (credit / incoming money)</option>
          </Select>
        </Field>
        <Field label="Custom keywords (optional, comma-separated)">
          <Input
            placeholder="e.g. whole foods, trader joe, sprouts"
            value={form.keywords}
            onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
          />
        </Field>
        <Field label="Icon">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
            {ICONS.map(icon => (
              <button type="button" key={icon} onClick={() => setForm(f => ({ ...f, icon }))}
                style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: 18, border: 'none',
                  background: form.icon === icon ? 'rgba(6,198,138,0.15)' : '#F0F0F0',
                  outline: form.icon === icon ? `2px solid ${GREEN}` : 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (form.icon !== icon) (e.currentTarget as HTMLElement).style.background = '#E8E8E8' }}
                onMouseLeave={e => { if (form.icon !== icon) (e.currentTarget as HTMLElement).style.background = '#F0F0F0' }}>
                {icon}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button type="button" key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                  outline: form.color === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 2, transform: form.color === c ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s',
                }} />
            ))}
          </div>
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="submit" style={{ flex: 1 }}>Save</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}

export function Settings() {
  const { state, dispatch } = useStore()
  const s = state.settings

  // ── Paystub state ────────────────────────────────────────────────────────────
  const [paystubs, setPaystubs] = useState<Paystub[]>([])
  const [paystubsLoading, setPaystubsLoading] = useState(true)
  const [showPaystubUpload, setShowPaystubUpload] = useState(false)
  const [showPaystubHistory, setShowPaystubHistory] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        loadPaystubs(user.id)
          .then(ps => setPaystubs(ps))
          .catch(() => {})
          .finally(() => setPaystubsLoading(false))
      } else {
        setPaystubsLoading(false)
      }
    })
  }, [])

  function handlePaystubConfirmed(paystub: Paystub) {
    // Add to local list (most recent first)
    setPaystubs(prev => {
      const filtered = prev.filter(p => p.payDate !== paystub.payDate || p.employerName !== paystub.employerName)
      return [paystub, ...filtered].sort((a, b) => {
        if (!a.payDate || !b.payDate) return 0
        return a.payDate > b.payDate ? -1 : 1
      })
    })
    // Propagate net pay as the confirmed take-home (single source of truth)
    if (paystub.netPay) {
      const perPeriod = paystub.netPay
      const ppm = PERIODS_PER_MONTH[payFrequency] ?? 1
      const monthly = perPeriod * ppm
      const netHourly = grossAnnual > 0 && (s.hourlyRate ?? 0) > 0
        ? (monthly * 12) / (grossAnnual / (s.hourlyRate ?? 1))
        : undefined
      const sourceLabel = [
        'Paystub',
        paystub.employerName,
        paystub.payDate ? fmtPayDate(paystub.payDate) : null,
      ].filter(Boolean).join(' — ')
      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: {
          paycheckAmount: perPeriod,
          monthlyIncome: monthly,
          netMonthlyIncome: monthly,
          paycheckSource: sourceLabel,
          ...(netHourly !== undefined ? { netHourlyRate: netHourly } : {}),
        },
      })
      setActualPaycheck(perPeriod.toFixed(2))
    }
    setShowPaystubUpload(false)
  }

  // ── General ──────────────────────────────────────────────────────────────────
  const [budgetName, setBudgetName] = useState(s.name)
  const [currencySymbol, setCurrencySymbol] = useState(s.currencySymbol)
  const [monthlySavings, setMonthlySavings] = useState(s.monthlySavings?.toString() || '')
  const [payFrequency, setPayFrequency] = useState<'weekly' | 'biweekly' | 'semi-monthly' | 'monthly'>(s.payFrequency || 'biweekly')
  const [saved, setSaved] = useState(false)

  // ── Income — single always-editable field ────────────────────────────────────
  // Canonical: paycheckAmount (per-period). Derive monthly for display.
  const ppm = PERIODS_PER_MONTH[payFrequency] ?? 1
  const perLabel = FREQ_LABEL[payFrequency] ?? 'period'

  const initPaycheck = (): string => {
    if (s.paycheckAmount && s.paycheckAmount > 0) return s.paycheckAmount.toFixed(2)
    const mi = s.netMonthlyIncome ?? s.monthlyIncome
    if (mi && mi > 0) return (mi / ppm).toFixed(2)
    return ''
  }
  const [actualPaycheck, setActualPaycheck] = useState(initPaycheck)
  const [incomeSaved, setIncomeSaved] = useState(false)

  // ── Tax calculator inputs ─────────────────────────────────────────────────────
  const [filingStatus, setFilingStatus] = useState<FilingStatus>(s.filingStatus ?? 'single')
  const [stateCode, setStateCode] = useState(s.stateCode ?? 'TX')
  const [preTax401kPct, setPreTax401kPct] = useState(s.preTax401kPct?.toString() ?? '0')
  const [preTaxHealthcare, setPreTaxHealthcare] = useState(s.preTaxHealthcareAnnual?.toString() ?? '0')
  const [showBreakdown, setShowBreakdown] = useState(false)

  const { hourlyRate, hoursPerDay, workDays } = s
  const grossAnnual = (hourlyRate ?? 0) * (hoursPerDay ?? 8) * (workDays?.length ?? 5) * 52

  const taxBreakdown = useMemo(() => {
    if (!grossAnnual) return null
    return calculateTaxes({
      grossAnnual,
      filingStatus,
      stateCode,
      payFrequency: payFrequency as any,
      preTax401kPct: parseFloat(preTax401kPct) || 0,
      preTaxHealthcareAnnual: parseFloat(preTaxHealthcare) || 0,
    })
  }, [grossAnnual, filingStatus, stateCode, payFrequency, preTax401kPct, preTaxHealthcare])

  // ── Category modals ───────────────────────────────────────────────────────────
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [deletingCat, setDeletingCat] = useState<Category | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // ── Save functions ────────────────────────────────────────────────────────────

  /** Saves General settings — name, currency, savings goal, pay frequency.
   *  Does NOT touch income (that's Income & Pay's responsibility). */
  function saveSettings() {
    const savings = parseFloat(monthlySavings)
    // When payFrequency changes, keep monthly income stable and re-derive paycheckAmount
    const currentMonthly = s.netMonthlyIncome ?? s.monthlyIncome
    const newPaycheckAmount = currentMonthly ? currentMonthly / (PERIODS_PER_MONTH[payFrequency] ?? 1) : s.paycheckAmount
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        name: budgetName.trim() || 'My Budget',
        currencySymbol: currencySymbol.trim() || '$',
        monthlySavings: isNaN(savings) || savings <= 0 ? undefined : savings,
        payFrequency: payFrequency as any,
        ...(newPaycheckAmount ? { paycheckAmount: newPaycheckAmount } : {}),
      },
    })
    // Sync local actualPaycheck input to reflect new frequency
    if (currentMonthly) setActualPaycheck((currentMonthly / (PERIODS_PER_MONTH[payFrequency] ?? 1)).toFixed(2))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  /** Saves the user's actual take-home pay.
   *  Writes paycheckAmount, monthlyIncome, netMonthlyIncome, and netHourlyRate
   *  so every part of the app (Dashboard, Home, Analysis, Calendar, etc.) updates immediately. */
  function saveIncome() {
    const perPeriod = parseFloat(actualPaycheck)
    if (!perPeriod || perPeriod <= 0) return
    const monthly = perPeriod * ppm
    const netHourly = grossAnnual > 0 && (hourlyRate ?? 0) > 0
      ? (monthly * 12) / (grossAnnual / (hourlyRate ?? 1))
      : undefined
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        paycheckAmount: perPeriod,
        monthlyIncome: monthly,
        netMonthlyIncome: monthly,
        ...(netHourly !== undefined ? { netHourlyRate: netHourly } : {}),
        filingStatus,
        stateCode,
        preTax401kPct: parseFloat(preTax401kPct) || 0,
        preTaxHealthcareAnnual: parseFloat(preTaxHealthcare) || 0,
      },
    })
    setIncomeSaved(true)
    setTimeout(() => setIncomeSaved(false), 2500)
  }

  function deleteCategory(id: string) {
    const cat = state.categories.find(c => c.id === id)
    if (cat?.isDefault) return
    setDeletingCat(cat || null)
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'budget-data.json'; a.click()
    URL.revokeObjectURL(url)
  }

  function executeClearAllData() {
    const empty = {
      accounts: [], transactions: [], categories: [], budgets: [],
      goals: [], netWorthHistory: [], subscriptions: [],
      settings: { currency: 'USD', currencySymbol: '$', theme: 'dark', name: 'My Budget', dashboardWidgets: [] },
    }
    try { localStorage.setItem('budget_app_v1', JSON.stringify(empty)) } catch {}
    window.location.reload()
  }

  function executeResetToDemo() {
    dispatch({ type: 'RESET' })
  }

  // ── Derived display values ────────────────────────────────────────────────────
  const userNetPerPeriod = parseFloat(actualPaycheck) || 0
  const userNetMonthly = userNetPerPeriod * ppm
  const grossPerPeriod = taxBreakdown?.grossPay ?? 0

  // Deduction breakdown when both gross and net are known
  const totalDeductionsPerPeriod = grossPerPeriod > 0 && userNetPerPeriod > 0
    ? grossPerPeriod - userNetPerPeriod
    : null

  const taxDeductionsPerPeriod = taxBreakdown
    ? taxBreakdown.federalTax + taxBreakdown.socialSecurity + taxBreakdown.medicare + taxBreakdown.stateTax
    : 0
  const preTaxDeductionsPerPeriod = taxBreakdown?.preTaxDeductions ?? 0
  const estimatedTotalDeductions = taxDeductionsPerPeriod + preTaxDeductionsPerPeriod
  const otherDeductionsPerPeriod = totalDeductionsPerPeriod !== null
    ? Math.max(0, totalDeductionsPerPeriod - estimatedTotalDeductions)
    : 0

  const expCats = state.categories.filter(c => c.type === 'expense')
  const incCats = state.categories.filter(c => c.type === 'income')

  const catRow = (c: Category) => (
    <div key={c.id}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F5F5'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{c.icon}</span>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{c.name}</span>
        {c.isDefault && <span style={{ fontSize: 10, color: '#B0B0B0' }}>default</span>}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <IconButton size="sm" onClick={() => setEditingCat(c)}><Edit2 size={12} /></IconButton>
        {!c.isDefault && (
          <IconButton size="sm" variant="danger" onClick={() => deleteCategory(c.id)}><Trash2 size={12} /></IconButton>
        )}
      </div>
    </div>
  )

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Manage your preferences and categories</p>
      </div>

      {/* ── General ─────────────────────────────────────────────────────────── */}
      <Card style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>General</p>
        <form onSubmit={e => { e.preventDefault(); saveSettings() }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 160px', gap: 14, marginBottom: 16 }}>
            <Field label="Budget name">
              <Input value={budgetName} onChange={e => setBudgetName(e.target.value)} placeholder="My Budget" />
            </Field>
            <Field label="Currency">
              <Input value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)} placeholder="$" />
            </Field>
            <Field label={`Monthly savings goal (${currencySymbol || '$'})`}>
              <Input
                type="number"
                value={monthlySavings}
                onChange={e => setMonthlySavings(e.target.value)}
                placeholder="e.g. 800"
                min="0"
                step="any"
              />
            </Field>
            <Field label="Pay frequency">
              <Select value={payFrequency} onChange={e => setPayFrequency(e.target.value as any)}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly (every 2 wks)</option>
                <option value="semi-monthly">Semi-monthly (2x/mo)</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button type="submit" style={{ minWidth: 120 }}>
              {saved ? <><Check size={14} /> Saved!</> : 'Save Settings'}
            </Button>
            <Button type="button" variant="secondary" onClick={exportData}><Download size={13} /> Export</Button>
            <div style={{ flex: 1 }} />
            <Button type="button" variant="secondary" onClick={() => setConfirmClearAll(true)}>Clear All Data</Button>
            <Button type="button" variant="danger" onClick={() => setConfirmReset(true)}>Reset to Demo</Button>
          </div>
        </form>
      </Card>

      {/* ── Income & Pay ─────────────────────────────────────────────────────── */}
      <Card style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Income & Pay</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Your take-home pay is the single figure used for budget allocations, paycheck planner, Calendar earnings, and all spending analyses. Update it anytime your paycheck changes.
        </p>

        {/* Take-home input — always shown, always editable */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Your actual take-home pay
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Enter what actually hits your bank account each pay period. This overrides any calculated estimate.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', pointerEvents: 'none',
              }}>
                {currencySymbol || '$'}
              </span>
              <Input
                type="number" min="0" step="0.01"
                value={actualPaycheck}
                onChange={e => setActualPaycheck(e.target.value)}
                placeholder="0.00"
                style={{ paddingLeft: 24, fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              / {perLabel}
            </span>
            {userNetPerPeriod > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                = {currencySymbol || '$'}{userNetMonthly.toFixed(0)}/mo
              </span>
            )}
          </div>

          {/* Gross / Net / Deduction summary — only when we have both */}
          {grossPerPeriod > 0 && userNetPerPeriod > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14,
            }}>
              {[
                { label: `Gross / ${perLabel}`, value: `${currencySymbol || '$'}${grossPerPeriod.toFixed(2)}`, muted: false },
                { label: `Take-home / ${perLabel}`, value: `${currencySymbol || '$'}${userNetPerPeriod.toFixed(2)}`, muted: false },
                {
                  label: 'Total deductions',
                  value: totalDeductionsPerPeriod !== null && totalDeductionsPerPeriod >= 0
                    ? `${currencySymbol || '$'}${totalDeductionsPerPeriod.toFixed(2)}`
                    : '—',
                  muted: true,
                },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'var(--background)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    {item.label}
                  </p>
                  <p style={{
                    fontFamily: '"Fraunces", serif', fontSize: 15, fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums', color: 'var(--text)',
                  }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Deduction breakdown detail */}
          {totalDeductionsPerPeriod !== null && totalDeductionsPerPeriod > 0 && taxBreakdown && (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', marginBottom: 14,
              padding: '10px 12px', background: 'var(--background)', borderRadius: 8,
              border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Estimated deduction breakdown:</p>
              {taxBreakdown.federalTax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Federal income tax</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{currencySymbol || '$'}{taxBreakdown.federalTax.toFixed(2)}</span>
                </div>
              )}
              {taxBreakdown.stateTax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>State income tax</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{currencySymbol || '$'}{taxBreakdown.stateTax.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Social Security (6.2%)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{currencySymbol || '$'}{taxBreakdown.socialSecurity.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Medicare (1.45%)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{currencySymbol || '$'}{taxBreakdown.medicare.toFixed(2)}</span>
              </div>
              {taxBreakdown.preTaxDeductions > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pre-tax deductions (401k, health)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{currencySymbol || '$'}{taxBreakdown.preTaxDeductions.toFixed(2)}</span>
                </div>
              )}
              {otherDeductionsPerPeriod > 0.5 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)' }}>
                  <span>Other / additional withholdings</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{currencySymbol || '$'}{otherDeductionsPerPeriod.toFixed(2)}</span>
                </div>
              )}
              {totalDeductionsPerPeriod < estimatedTotalDeductions - 1 && (
                <p style={{ marginTop: 4, fontSize: 11, color: 'oklch(0.72 0.18 145)' }}>
                  Your actual take-home is higher than the estimate — your employer may withhold less than the standard calculation.
                </p>
              )}
            </div>
          )}

          {/* Paystub source label */}
          {s.paycheckSource && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <FileText size={12} color={GREEN} />
              <span style={{ fontSize: 11, color: GREEN, fontWeight: 500 }}>{s.paycheckSource}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={saveIncome} disabled={!actualPaycheck || parseFloat(actualPaycheck) <= 0}>
              {incomeSaved ? <><Check size={14} /> Saved!</> : 'Save take-home pay'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowPaystubUpload(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={13} /> Upload paystub
            </Button>
            {taxBreakdown && (
              <Button variant="secondary" onClick={() => setActualPaycheck(taxBreakdown.netPay.toFixed(2))}>
                Use estimate: {currencySymbol || '$'}{taxBreakdown.netPay.toFixed(2)} / {perLabel}
              </Button>
            )}
          </div>
        </div>

        {/* Tax calculator — only when hourly rate is configured */}
        {grossAnnual > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Tax estimate calculator</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Based on {currencySymbol || '$'}{(hourlyRate ?? 0).toFixed(2)}/hr × {hoursPerDay ?? 8}h × {workDays?.length ?? 5} days/wk
                  — gross {currencySymbol || '$'}{taxBreakdown ? taxBreakdown.grossPay.toFixed(2) : '—'} / {perLabel}
                </p>
              </div>
              <button
                onClick={() => setShowBreakdown(b => !b)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontSize: 12, fontWeight: 500 }}>
                {showBreakdown ? <><ChevronUp size={13} /> Hide breakdown</> : <><ChevronDown size={13} /> Show breakdown</>}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: showBreakdown ? 16 : 0 }}>
              <Field label="Filing status">
                <Select value={filingStatus} onChange={e => setFilingStatus(e.target.value as FilingStatus)}>
                  <option value="single">Single</option>
                  <option value="married">Married filing jointly</option>
                  <option value="hoh">Head of household</option>
                </Select>
              </Field>
              <Field label="State of residence">
                <Select value={stateCode} onChange={e => setStateCode(e.target.value)}>
                  {US_STATES.map(s => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="401k contribution (% of gross)">
                <Input
                  type="number" min="0" max="100" step="0.5"
                  value={preTax401kPct}
                  onChange={e => setPreTax401kPct(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Health/dental premium (annual $)">
                <Input
                  type="number" min="0" step="1"
                  value={preTaxHealthcare}
                  onChange={e => setPreTaxHealthcare(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            {showBreakdown && taxBreakdown && (
              <TaxBreakdown
                breakdown={taxBreakdown}
                payFrequency={payFrequency}
              />
            )}
          </>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Complete the income setup in onboarding to unlock the tax estimate calculator.
          </p>
        )}
      </Card>

      {/* ── PTO Widget ──────────────────────────────────────────────────────── */}
      {(() => {
        const latestWithPto = paystubs.find(p => p.ptoRemaining != null || p.ptoAccrued != null)
        if (!latestWithPto) return null
        return (
          <Card style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>PTO / Vacation Balance</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  From {latestWithPto.employerName ?? 'paystub'} · {latestWithPto.payDate ? fmtPayDate(latestWithPto.payDate) : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                {latestWithPto.ptoAccrued != null && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accrued</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{latestWithPto.ptoAccrued}h</p>
                  </div>
                )}
                {latestWithPto.ptoUsed != null && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Used</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{latestWithPto.ptoUsed}h</p>
                  </div>
                )}
                {latestWithPto.ptoRemaining != null && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>{latestWithPto.ptoRemaining}h</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )
      })()}

      {/* ── Paystub History ──────────────────────────────────────────────────── */}
      <Card style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Paystub History</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {paystubs.length > 0 ? `${paystubs.length} paystub${paystubs.length !== 1 ? 's' : ''} uploaded` : 'No paystubs yet'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={() => setShowPaystubUpload(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Upload size={11} /> Upload
            </Button>
            {paystubs.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setShowPaystubHistory(h => !h)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> {showPaystubHistory ? 'Hide' : 'View all'}
              </Button>
            )}
          </div>
        </div>

        {paystubsLoading && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading…</p>
        )}

        {!paystubsLoading && paystubs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <FileText size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upload your first paystub to confirm your exact take-home pay and start tracking history.</p>
          </div>
        )}

        {!paystubsLoading && paystubs.length > 0 && !showPaystubHistory && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Latest: {fmtPayDate(paystubs[0].payDate ?? '')}
                {paystubs[0].employerName ? ` · ${paystubs[0].employerName}` : ''}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Net {paystubs[0].netPay != null ? `${currencySymbol || '$'}${paystubs[0].netPay.toFixed(2)}` : '—'}
                {paystubs[0].grossPay != null ? ` · Gross ${currencySymbol || '$'}${paystubs[0].grossPay.toFixed(2)}` : ''}
              </p>
            </div>
            {paystubs[0].ytdGross != null && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>YTD Gross</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{currencySymbol || '$'}{paystubs[0].ytdGross.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}

        {showPaystubHistory && (
          <PaystubHistory
            paystubs={paystubs}
            currencySymbol={currencySymbol || '$'}
            onDeleted={id => setPaystubs(prev => prev.filter(p => p.id !== id))}
          />
        )}
      </Card>

      {/* ── Categories ───────────────────────────────────────────────────────── */}
      <Card style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Categories</p>
          <Button size="sm" onClick={() => setShowCatModal(true)}><Plus size={12} /> Add Category</Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Expense</p>
            {expCats.map(catRow)}
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Income</p>
            {incCats.map(catRow)}
          </div>
        </div>
      </Card>

      {/* ── Merchant Rules ────────────────────────────────────────────────────── */}
      {Object.keys(state.merchantRules || {}).length > 0 && (
        <Card style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Learned Merchant Rules</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Manually corrected category assignments — applied automatically to future transactions</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(state.merchantRules || {}).map(([key, categoryId]) => {
              const cat = state.categories.find(c => c.id === categoryId)
              return (
                <div key={key}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F5F5'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>
                    <span style={{ fontSize: 12, color: cat ? NAVY : '#dc2626' }}>{cat ? `${cat.icon} ${cat.name}` : 'Deleted category'}</span>
                  </div>
                  <IconButton size="sm" variant="danger" onClick={() => dispatch({ type: 'DELETE_MERCHANT_RULE', payload: key })}>
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {showPaystubUpload && userId && (
        <PaystubUpload
          open
          onClose={() => setShowPaystubUpload(false)}
          userId={userId}
          existingPaystubs={paystubs}
          onConfirmed={handlePaystubConfirmed}
        />
      )}

      {showCatModal && <CategoryModal open onClose={() => setShowCatModal(false)} />}
      {editingCat && <CategoryModal open onClose={() => setEditingCat(null)} initial={editingCat} />}
      <ConfirmModal
        open={!!deletingCat}
        title="Delete category?"
        message={deletingCat ? `"${deletingCat.name}" will be permanently deleted. Transactions using it won't be affected.` : ''}
        confirmLabel="Delete"
        onConfirm={() => { if (deletingCat) dispatch({ type: 'DELETE_CATEGORY', payload: deletingCat.id }); setDeletingCat(null) }}
        onCancel={() => setDeletingCat(null)}
      />
      <ConfirmModal
        open={confirmClearAll}
        title="Clear all data?"
        message="This will permanently erase all your accounts, transactions, budgets, and goals. The app will reset to an empty state."
        confirmLabel="Clear Everything"
        onConfirm={() => { setConfirmClearAll(false); executeClearAllData() }}
        onCancel={() => setConfirmClearAll(false)}
      />
      <ConfirmModal
        open={confirmReset}
        title="Reset to demo data?"
        message="All your current data will be replaced with demo data. This cannot be undone."
        confirmLabel="Reset"
        onConfirm={() => { setConfirmReset(false); executeResetToDemo() }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
