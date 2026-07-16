import { useState, useMemo } from 'react'
import { Plus, Trash2, Edit2, Download, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Input, Select, Field } from '../components/ui/Input'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { TaxBreakdown } from '../components/TaxBreakdown'
import { calculateTaxes, US_STATES, FilingStatus } from '../lib/taxes'
import { Category } from '../types'
import { uuid } from '../utils/uuid'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

const ICONS = ['🛒','🍽️','🚗','🎬','🛍️','⚡','💪','🏠','💰','💻','📈','✈️','🏥','📚','🎮','☕','🐕','👶','🎁','🔧','📱','🏋️','🎵','🍺']

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
  const [name, setName] = useState(state.settings.name)
  const [currencySymbol, setCurrencySymbol] = useState(state.settings.currencySymbol)
  const [monthlyIncome, setMonthlyIncome] = useState(state.settings.monthlyIncome?.toString() || '')
  const [monthlySavings, setMonthlySavings] = useState(state.settings.monthlySavings?.toString() || '')
  const [payFrequency, setPayFrequency] = useState<'weekly' | 'biweekly' | 'semi-monthly' | 'monthly'>(state.settings.payFrequency || 'biweekly')
  const [saved, setSaved] = useState(false)

  // Tax inputs
  const [filingStatus, setFilingStatus] = useState<FilingStatus>(state.settings.filingStatus ?? 'single')
  const [stateCode, setStateCode] = useState(state.settings.stateCode ?? 'TX')
  const [preTax401kPct, setPreTax401kPct] = useState(state.settings.preTax401kPct?.toString() ?? '0')
  const [preTaxHealthcare, setPreTaxHealthcare] = useState(state.settings.preTaxHealthcareAnnual?.toString() ?? '0')
  const [taxSaved, setTaxSaved] = useState(false)

  // Income verification step
  // 'unconfirmed' = show "does this match?", 'confirmed' = show saved value, 'input' = correction input open
  const [verifyPhase, setVerifyPhase] = useState<'unconfirmed' | 'confirmed' | 'input'>(
    state.settings.netMonthlyIncome ? 'confirmed' : 'unconfirmed'
  )
  const [actualPaycheck, setActualPaycheck] = useState('')

  // Alias kept for the override-input path
  const verifyOverride = verifyPhase === 'input'

  // Live tax preview — recalculates whenever inputs change
  const { hourlyRate, hoursPerDay, workDays } = state.settings
  const grossAnnual = (hourlyRate ?? 0) * (hoursPerDay ?? 8) * ((workDays?.length ?? 5)) * 52

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
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [deletingCat, setDeletingCat] = useState<Category | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const PERIODS_PER_MONTH: Record<string, number> = {
    weekly: 52 / 12, biweekly: 26 / 12, 'semi-monthly': 2, monthly: 1,
  }

  function saveTaxSettings() {
    if (!taxBreakdown) return
    const netMonthly = taxBreakdown.annualNet / 12
    const netHourly = grossAnnual > 0 && (hourlyRate ?? 0) > 0
      ? taxBreakdown.annualNet / (grossAnnual / (hourlyRate ?? 1))
      : undefined
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        filingStatus,
        stateCode,
        preTax401kPct: parseFloat(preTax401kPct) || 0,
        preTaxHealthcareAnnual: parseFloat(preTaxHealthcare) || 0,
        netMonthlyIncome: netMonthly,
        netHourlyRate: netHourly,
        monthlyIncome: netMonthly,
      },
    })
    setMonthlyIncome(netMonthly.toFixed(2))
    setVerifyPhase('confirmed')
    setTaxSaved(true)
    setTimeout(() => setTaxSaved(false), 2500)
  }

  function saveVerifiedPaycheck() {
    const perPeriod = parseFloat(actualPaycheck)
    if (!perPeriod || perPeriod <= 0) return
    const monthly = perPeriod * (PERIODS_PER_MONTH[payFrequency] ?? 1)
    const netHourly = grossAnnual > 0 && (hourlyRate ?? 0) > 0
      ? (monthly * 12) / (grossAnnual / (hourlyRate ?? 1))
      : undefined
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        filingStatus,
        stateCode,
        preTax401kPct: parseFloat(preTax401kPct) || 0,
        preTaxHealthcareAnnual: parseFloat(preTaxHealthcare) || 0,
        netMonthlyIncome: monthly,
        netHourlyRate: netHourly,
        monthlyIncome: monthly,
      },
    })
    setMonthlyIncome(monthly.toFixed(2))
    setActualPaycheck('')
    setVerifyPhase('confirmed')
    setTaxSaved(true)
    setTimeout(() => setTaxSaved(false), 2500)
  }

  function saveSettings() {
    const income = parseFloat(monthlyIncome)
    const savings = parseFloat(monthlySavings)
    const updated = {
      name: name.trim() || 'My Budget',
      currencySymbol: currencySymbol.trim() || '$',
      monthlyIncome: isNaN(income) || income <= 0 ? undefined : income,
      monthlySavings: isNaN(savings) || savings <= 0 ? undefined : savings,
      payFrequency: payFrequency as any,
    }
    dispatch({ type: 'UPDATE_SETTINGS', payload: updated })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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

      {/* General settings — wrapped in form so Enter key works */}
      <Card style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>General</p>
        <form onSubmit={e => { e.preventDefault(); saveSettings() }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 1fr 160px', gap: 14, marginBottom: 16 }}>
            <Field label="App Name">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Budget" />
            </Field>
            <Field label="Currency">
              <Input value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)} placeholder="$" />
            </Field>
            <Field label={`Monthly Take-Home Pay (${currencySymbol || '$'})`}>
              <Input
                type="number"
                value={monthlyIncome}
                onChange={e => setMonthlyIncome(e.target.value)}
                placeholder="e.g. 4500"
                min="0"
                step="any"
              />
            </Field>
            <Field label={`Monthly Savings Goal (${currencySymbol || '$'})`}>
              <Input
                type="number"
                value={monthlySavings}
                onChange={e => setMonthlySavings(e.target.value)}
                placeholder="e.g. 800"
                min="0"
                step="any"
              />
            </Field>
            <Field label="Pay Frequency">
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

      {/* Income & Taxes */}
      <Card style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Income & Taxes</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {grossAnnual > 0
            ? `Based on $${(state.settings.hourlyRate ?? 0).toFixed(2)}/hr × ${state.settings.hoursPerDay ?? 8}h × ${state.settings.workDays?.length ?? 5} days/wk`
            : 'Complete the income step in onboarding first to unlock take-home pay calculation.'}
        </p>

        {grossAnnual > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
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

            {taxBreakdown && (
              <div style={{ marginBottom: 16 }}>
                <TaxBreakdown breakdown={taxBreakdown} payFrequency={payFrequency} />
              </div>
            )}

            {/* ── Verification / confirmation block ── */}
            {taxBreakdown && (() => {
              const freqLabel: Record<string, string> = {
                weekly: 'week', biweekly: '2 weeks', 'semi-monthly': 'semi-month', monthly: 'month',
              }
              const perLabel = freqLabel[payFrequency] ?? 'period'
              const confirmedMonthly = state.settings.netMonthlyIncome
              const estimatedMonthly = taxBreakdown.annualNet / 12
              const confirmedPerPeriod = confirmedMonthly
                ? confirmedMonthly / (PERIODS_PER_MONTH[payFrequency] ?? 1)
                : null
              const gap = confirmedMonthly ? confirmedMonthly - estimatedMonthly : 0
              const isCorrected = Math.abs(gap) > 5

              // ── phase: correction input open ──────────────────────────
              if (verifyPhase === 'input') {
                return (
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '16px 18px', marginBottom: 14,
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      Enter your actual take-home pay
                    </p>
                    <Field label={`Actual amount per ${perLabel} ($)`}>
                      <Input
                        type="number" min="0" step="0.01"
                        value={actualPaycheck}
                        onChange={e => setActualPaycheck(e.target.value)}
                        placeholder={taxBreakdown.netPay.toFixed(2)}
                        autoFocus
                      />
                    </Field>
                    {actualPaycheck && Math.abs(parseFloat(actualPaycheck) - taxBreakdown.netPay) > 5 && (
                      <p style={{
                        fontSize: 12, color: 'var(--text-muted)',
                        background: 'oklch(0.20 0.04 60 / 0.5)', border: '1px solid oklch(0.35 0.08 60 / 0.4)',
                        borderRadius: 8, padding: '8px 12px',
                      }}>
                        Your actual take-home is ${Math.abs(parseFloat(actualPaycheck) - taxBreakdown.netPay).toFixed(0)}{' '}
                        {parseFloat(actualPaycheck) < taxBreakdown.netPay ? 'lower' : 'higher'} than estimated — may be due to
                        additional withholdings not captured here (local taxes, garnishments, extra W-4 elections).
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button onClick={saveVerifiedPaycheck} disabled={!actualPaycheck || parseFloat(actualPaycheck) <= 0}>
                        {taxSaved ? <><Check size={14} /> Saved!</> : 'Save my actual paycheck'}
                      </Button>
                      <Button variant="secondary" onClick={() => setVerifyPhase(confirmedMonthly ? 'confirmed' : 'unconfirmed')}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )
              }

              // ── phase: confirmed — show the ACTUAL saved value ────────
              if (verifyPhase === 'confirmed' && confirmedMonthly) {
                return (
                  <div style={{
                    background: isCorrected ? 'oklch(0.20 0.04 60 / 0.35)' : 'oklch(0.20 0.05 145 / 0.25)',
                    border: `1px solid ${isCorrected ? 'oklch(0.40 0.08 60 / 0.4)' : 'oklch(0.42 0.075 155 / 0.35)'}`,
                    borderRadius: 12, padding: '16px 18px', marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Check size={13} color={isCorrected ? 'oklch(0.72 0.14 60)' : 'oklch(0.72 0.18 145)'} />
                          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                            color: isCorrected ? 'oklch(0.72 0.14 60)' : 'oklch(0.72 0.18 145)' }}>
                            {taxSaved ? 'Saved!' : isCorrected ? 'Corrected take-home' : 'Confirmed take-home'}
                          </p>
                        </div>
                        <p style={{
                          fontFamily: '"Fraunces", serif', fontSize: 26, fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums', color: 'var(--text)', lineHeight: 1, marginBottom: 4,
                        }}>
                          ${confirmedPerPeriod!.toFixed(2)}
                          <span style={{ fontSize: 13, fontFamily: 'inherit', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                            / {perLabel}
                          </span>
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          ${confirmedMonthly.toFixed(0)}/mo
                          {isCorrected && (
                            <span> · {gap < 0 ? 'lower' : 'higher'} than the ${taxBreakdown.netPay.toFixed(2)} estimate by ${Math.abs(gap / (PERIODS_PER_MONTH[payFrequency] ?? 1)).toFixed(0)}/{perLabel.replace('2 ', '')}</span>
                          )}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => {
                        setActualPaycheck(confirmedPerPeriod!.toFixed(2))
                        setVerifyPhase('input')
                      }}>
                        Edit
                      </Button>
                    </div>
                  </div>
                )
              }

              // ── phase: unconfirmed — ask the question ─────────────────
              return (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '16px 18px', marginBottom: 14,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    Does this match your actual paycheck?
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Estimated take-home:{' '}
                    <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                      ${taxBreakdown.netPay.toFixed(2)}
                    </strong>{' '}
                    per {perLabel}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={saveTaxSettings} style={{ minWidth: 160 }}>
                      Yes, use this amount
                    </Button>
                    <Button variant="secondary" onClick={() => {
                      setActualPaycheck(taxBreakdown.netPay.toFixed(2))
                      setVerifyPhase('input')
                    }}>
                      No, enter my actual amount
                    </Button>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </Card>

      {/* Categories */}
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

      {/* Merchant Rules */}
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
