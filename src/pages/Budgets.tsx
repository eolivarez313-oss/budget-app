import { useState } from 'react'
import { Plus, X, AlertTriangle, Receipt } from 'lucide-react'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select, Field } from '../components/ui/Input'
import { formatCurrency } from '../utils/formatters'
import { Budget, Subscription, AppSettings } from '../types'
import { uuid } from '../utils/uuid'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'
const BILLS_COLOR = '#f97316'
const UNALLOCATED_COLOR = '#D0D5DD'
const WEEKLY_SENTINEL = 'weekly'

function weeklyFromSub(sub: Subscription): number {
  if (sub.frequency === 'weekly') return sub.amount
  if (sub.frequency === 'yearly') return sub.amount / 52
  return sub.amount / 4
}

function getWeeklyPaycheck(settings: AppSettings): number {
  const { paycheckAmount, payFrequency, monthlyIncome } = settings
  if (paycheckAmount && paycheckAmount > 0) {
    if (payFrequency === 'weekly') return paycheckAmount
    if (payFrequency === 'biweekly' || payFrequency === 'semi-monthly') return paycheckAmount / 2
    if (payFrequency === 'monthly') return paycheckAmount / 4
    return paycheckAmount / 4
  }
  return (monthlyIncome || 0) / 4
}


interface PieSlice {
  id: string
  name: string
  value: number
  color: string
  isBills?: boolean
  isUnallocated?: boolean
  budgetId?: string
  categoryId?: string
  icon?: string
}

// ─── Add Category Modal ────────────────────────────────────────────────────────

function AddCategoryModal({ open, onClose, weeklyPaycheck, weeklyBills, totalAllocated, existingBudgets }: {
  open: boolean
  onClose: () => void
  weeklyPaycheck: number
  weeklyBills: number
  totalAllocated: number
  existingBudgets: Budget[]
}) {
  const { state, dispatch } = useStore()
  const sym = state.settings.currencySymbol
  const [form, setForm] = useState({ categoryId: '', amount: '' })
  const [err, setErr] = useState('')

  const availableCategories = state.categories
    .filter(c => c.type === 'expense')
    .filter(c => !existingBudgets.some(b => b.categoryId === c.id))

  const remaining = weeklyPaycheck - weeklyBills - totalAllocated

  function save() {
    if (!form.categoryId) return setErr('Select a category')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount < 0) return setErr('Enter a valid amount')
    const newTotal = totalAllocated + amount
    if (newTotal + weeklyBills > weeklyPaycheck) {
      return setErr(`Exceeds weekly paycheck by ${formatCurrency(newTotal + weeklyBills - weeklyPaycheck, sym)}`)
    }
    setErr('')
    dispatch({
      type: 'ADD_BUDGET',
      payload: { id: uuid(), categoryId: form.categoryId, monthlyLimit: amount, month: WEEKLY_SENTINEL },
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Budget Category" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {err && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
            {err}
          </div>
        )}

        {availableCategories.length === 0 ? (
          <p style={{ fontSize: 13, color: '#8A94A6', textAlign: 'center', padding: '20px 0' }}>
            All expense categories have been budgeted. Add new categories in Transactions.
          </p>
        ) : (
          <>
            <Field label="Category">
              <Select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Choose a category…</option>
                {availableCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </Select>
            </Field>

            <Field label="Weekly amount">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9CA3AF', pointerEvents: 'none' }}>{sym}</span>
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  step="1"
                  value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setErr('') }}
                  style={{ paddingLeft: 28 }}
                  autoFocus
                />
              </div>
            </Field>

            <p style={{ fontSize: 12, color: '#8A94A6' }}>
              {remaining > 0
                ? `${formatCurrency(remaining, sym)} of your weekly paycheck is still unallocated.`
                : 'Your weekly paycheck is fully allocated.'}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={save} style={{ flex: 1 }}>Add to Budget</Button>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function Budgets() {
  const { state, dispatch } = useStore()
  const sym = state.settings.currencySymbol

  const weeklyPaycheck = getWeeklyPaycheck(state.settings)
  const activeSubs = state.subscriptions.filter(s => s.status === 'active')
  const weeklyBills = activeSubs.reduce((s, sub) => s + weeklyFromSub(sub), 0)

  const weeklyBudgets = state.budgets.filter(b => b.month === WEEKLY_SENTINEL)
  const totalAllocated = weeklyBudgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const remaining = weeklyPaycheck - weeklyBills - totalAllocated

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editForm, setEditForm] = useState({ amount: '' })
  const [editErr, setEditErr] = useState('')
  const [confirmDeleteBudget, setConfirmDeleteBudget] = useState(false)

  // ── Build pie slices ──────────────────────────────────────────────────────

  const slices: PieSlice[] = []

  if (weeklyBills > 0) {
    slices.push({ id: 'bills', name: 'Bills', value: weeklyBills, color: BILLS_COLOR, isBills: true })
  }

  for (const budget of weeklyBudgets) {
    if (budget.monthlyLimit <= 0) continue
    const cat = state.categories.find(c => c.id === budget.categoryId)
    slices.push({
      id: budget.id,
      name: cat?.name || 'Unknown',
      value: budget.monthlyLimit,
      color: cat?.color || '#8A94A6',
      budgetId: budget.id,
      categoryId: budget.categoryId,
      icon: cat?.icon,
    })
  }

  if (remaining > 0) {
    slices.push({ id: 'unallocated', name: 'Unallocated', value: remaining, color: UNALLOCATED_COLOR, isUnallocated: true })
  }

  const totalPie = slices.reduce((s, sl) => s + sl.value, 0)
  const selectedSlice = slices.find(s => s.id === selectedId) ?? null
  const selectedBudget = selectedSlice?.budgetId ? weeklyBudgets.find(b => b.id === selectedSlice.budgetId) : undefined
  // ── Interactions ──────────────────────────────────────────────────────────

  function handleSliceClick(slice: PieSlice) {
    if (slice.isUnallocated) return
    setSelectedId(prev => prev === slice.id ? null : slice.id)
    setEditErr('')
    if (slice.budgetId) {
      const b = weeklyBudgets.find(wb => wb.id === slice.budgetId)
      setEditForm({ amount: b?.monthlyLimit.toString() || '0' })
    }
  }

  function handleSaveEdit() {
    if (!selectedBudget) return
    const newAmount = parseFloat(editForm.amount)
    if (isNaN(newAmount) || newAmount < 0) return setEditErr('Enter a valid amount')
    const otherAllocated = totalAllocated - selectedBudget.monthlyLimit
    if (otherAllocated + newAmount + weeklyBills > weeklyPaycheck) {
      return setEditErr(`Exceeds weekly paycheck by ${formatCurrency(otherAllocated + newAmount + weeklyBills - weeklyPaycheck, sym)}`)
    }
    setEditErr('')
    dispatch({ type: 'UPDATE_BUDGET', payload: { ...selectedBudget, monthlyLimit: newAmount } })
    setSelectedId(null)
  }

  function handleDeleteBudget() {
    if (!selectedBudget) return
    setConfirmDeleteBudget(true)
  }

  // ── Empty state: no paycheck set ──────────────────────────────────────────

  if (weeklyPaycheck <= 0) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: '-0.5px' }}>This Week's Budget</h1>
          <p style={{ fontSize: 13, color: '#8A94A6', marginTop: 3 }}>Allocate your weekly paycheck across categories</p>
        </div>
        <Card style={{ padding: '60px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>💰</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: NAVY, marginBottom: 8 }}>Set your paycheck amount first</p>
          <p style={{ fontSize: 13, color: '#8A94A6', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
            Go to Settings to enter your paycheck amount and pay frequency, then come back to build your weekly budget.
          </p>
          <Button variant="secondary" onClick={() => { window.location.href = '/settings' }}>Go to Settings</Button>
        </Card>
      </div>
    )
  }

  const billsOverPaycheck = weeklyBills > weeklyPaycheck
  const fullyAllocated = remaining <= 0
  const overAllocated = remaining < 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: '-0.5px' }}>This Week's Budget</h1>
          <p style={{ fontSize: 13, color: '#8A94A6', marginTop: 3 }}>Click a slice to edit your weekly allocation</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}><Plus size={15} /> Add Category</Button>
      </div>

      {/* Bills overage warning */}
      {billsOverPaycheck && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>
            Your weekly bills ({formatCurrency(weeklyBills, sym)}) exceed your weekly paycheck ({formatCurrency(weeklyPaycheck, sym)}). Review your bills or update your paycheck in Settings.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Weekly Paycheck', value: formatCurrency(weeklyPaycheck, sym), color: NAVY, sub: undefined },
          { label: 'Weekly Bills', value: formatCurrency(weeklyBills, sym), color: BILLS_COLOR, sub: undefined },
          { label: 'Allocated', value: formatCurrency(totalAllocated, sym), color: '#4A6CF7', sub: undefined },
          {
            label: 'Left to Budget This Week',
            value: formatCurrency(Math.abs(remaining), sym),
            color: overAllocated ? '#dc2626' : fullyAllocated ? GREEN : NAVY,
            sub: overAllocated ? '⚠ Over budget' : fullyAllocated ? '✓ Fully allocated' : undefined,
          },
        ].map(s => (
          <Card key={s.label} style={{ padding: '16px 18px', textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</p>
            {s.sub && <p style={{ fontSize: 11, color: s.color, marginTop: 4 }}>{s.sub}</p>}
          </Card>
        ))}
      </div>

      {/* Main layout: chart + panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

        {/* Pie chart card */}
        <Card style={{ padding: '24px' }}>
          {slices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 0' }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>🥧</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: NAVY, marginBottom: 6 }}>No categories yet</p>
              <p style={{ fontSize: 13, color: '#8A94A6', marginBottom: 20 }}>
                Add budget categories to start splitting your {formatCurrency(weeklyPaycheck, sym)}/week paycheck.
              </p>
              <Button onClick={() => setShowAddModal(true)}><Plus size={14} /> Add Category</Button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', marginBottom: 4 }}>
                Weekly Paycheck — {formatCurrency(weeklyPaycheck, sym)}
              </p>

              {/* Chart with center label */}
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={310}>
                  <PieChart>
                    <Pie
                      data={slices}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={130}
                      paddingAngle={slices.length > 1 ? 2 : 0}
                      dataKey="value"
                      onClick={(_data, index) => handleSliceClick(slices[index])}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      {slices.map((slice) => {
                        const isSelected = selectedId === slice.id
                        return (
                          <Cell
                            key={slice.id}
                            fill={slice.color}
                            stroke={isSelected ? slice.color : slice.isBills ? '#c2410c' : slice.isUnallocated ? '#B8BEC8' : 'white'}
                            strokeWidth={isSelected ? 4 : slice.isBills ? 2.5 : slice.isUnallocated ? 0 : 1}
                            opacity={selectedId && !isSelected ? 0.45 : 1}
                          />
                        )
                      })}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null
                        const d = payload[0].payload as PieSlice
                        const pct = totalPie > 0 ? ((d.value / totalPie) * 100).toFixed(1) : '0'
                        return (
                          <div style={{
                            background: '#FAFAFA', border: '1px solid #E4E4E4', borderRadius: 8,
                            padding: '10px 14px', fontSize: 12,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                          }}>
                            <p style={{ fontWeight: 600, color: NAVY, marginBottom: 4 }}>
                              {d.icon ? `${d.icon} ` : ''}{d.name}
                            </p>
                            <p style={{ color: d.color, fontWeight: 600, marginBottom: 2 }}>
                              {formatCurrency(d.value, sym)}/week
                            </p>
                            <p style={{ color: '#8A94A6' }}>{pct}% of paycheck</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut center label */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    {selectedSlice && !selectedSlice.isUnallocated ? (
                      <>
                        <p style={{ fontSize: 11, color: '#8A94A6', marginBottom: 2 }}>{selectedSlice.icon || ''} {selectedSlice.name}</p>
                        <p style={{ fontSize: 22, fontWeight: 700, color: selectedSlice.color }}>
                          {formatCurrency(selectedSlice.value, sym)}
                        </p>
                        <p style={{ fontSize: 11, color: '#8A94A6' }}>
                          {totalPie > 0 ? ((selectedSlice.value / totalPie) * 100).toFixed(0) : 0}% of check
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 11, color: '#8A94A6', marginBottom: 2 }}>per week</p>
                        <p style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>
                          {formatCurrency(weeklyPaycheck, sym)}
                        </p>
                        <p style={{ fontSize: 11, color: fullyAllocated ? GREEN : '#8A94A6' }}>
                          {fullyAllocated ? '✓ fully allocated' : `${formatCurrency(Math.max(0, remaining), sym)} left`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: 12, justifyContent: 'center' }}>
                {slices.map(s => {
                  const pct = totalPie > 0 ? ((s.value / totalPie) * 100).toFixed(0) : '0'
                  const isSelected = selectedId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSliceClick(s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                        background: isSelected ? s.color + '14' : 'none',
                        border: `1px solid ${isSelected ? s.color + '40' : 'transparent'}`,
                        cursor: s.isUnallocated ? 'default' : 'pointer',
                        padding: '3px 8px', borderRadius: 20,
                        opacity: selectedId && !isSelected ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ color: '#6b7280' }}>{s.icon ? `${s.icon} ` : ''}{s.name}</span>
                      <span style={{ color: NAVY, fontWeight: 600 }}>{pct}%</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </Card>

        {/* Details / edit panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {!selectedSlice ? (
            /* Default: remaining summary */
            <Card style={{ padding: '24px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                Left to budget from this week's paycheck
              </p>
              <p style={{
                fontSize: 38, fontWeight: 700, letterSpacing: '-1.5px', marginBottom: 4,
                color: overAllocated ? '#dc2626' : fullyAllocated ? GREEN : NAVY,
              }}>
                {formatCurrency(Math.abs(remaining), sym)}
              </p>
              <p style={{ fontSize: 12, color: '#8A94A6', marginBottom: 20 }}>
                {overAllocated
                  ? `Over-allocated by ${formatCurrency(-remaining, sym)}`
                  : fullyAllocated
                    ? 'Your full paycheck is allocated.'
                    : `from your ${formatCurrency(weeklyPaycheck, sym)} weekly paycheck`}
              </p>

              {overAllocated && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 16 }}>
                  Reduce a category allocation to fix the over-budget.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#8A94A6' }}>Paycheck</span>
                  <span style={{ color: NAVY, fontWeight: 500 }}>{formatCurrency(weeklyPaycheck, sym)}</span>
                </div>
                {weeklyBills > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#8A94A6' }}>Bills</span>
                    <span style={{ color: BILLS_COLOR, fontWeight: 500 }}>− {formatCurrency(weeklyBills, sym)}</span>
                  </div>
                )}
                {totalAllocated > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#8A94A6' }}>Categories</span>
                    <span style={{ color: '#4A6CF7', fontWeight: 500 }}>− {formatCurrency(totalAllocated, sym)}</span>
                  </div>
                )}
                <div style={{ height: 1, background: '#E4E4E4' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: NAVY, fontWeight: 600 }}>Remaining</span>
                  <span style={{ color: overAllocated ? '#dc2626' : fullyAllocated ? GREEN : NAVY, fontWeight: 700 }}>
                    {formatCurrency(remaining, sym)}
                  </span>
                </div>
              </div>

              {weeklyBudgets.length === 0 && (
                <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 20, lineHeight: 1.6 }}>
                  <strong style={{ color: GREEN }}>Tip:</strong> Bills are automatically pulled from your Bills list. Use "Add Category" to allocate the rest of your paycheck.
                </p>
              )}

              {slices.length > 0 && !fullyAllocated && (
                <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 16 }}>
                  Click a slice to adjust its weekly allocation.
                </p>
              )}
            </Card>

          ) : selectedSlice.isBills ? (
            /* Bills breakdown panel */
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${BILLS_COLOR}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={17} style={{ color: BILLS_COLOR }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>Bills</p>
                    <p style={{ fontSize: 11, color: '#8A94A6' }}>Fixed weekly obligations</p>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A94A6', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: 30, fontWeight: 700, color: BILLS_COLOR, marginBottom: 2 }}>
                {formatCurrency(weeklyBills, sym)}
              </p>
              <p style={{ fontSize: 12, color: '#8A94A6', marginBottom: 20 }}>
                per week · {weeklyPaycheck > 0 ? ((weeklyBills / weeklyPaycheck) * 100).toFixed(1) : 0}% of paycheck
              </p>

              <p style={{ fontSize: 10, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Breakdown
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {activeSubs.map(sub => {
                  const cat = state.categories.find(c => c.id === sub.categoryId)
                  return (
                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{cat?.icon}</span> {sub.name}
                      </span>
                      <span style={{ fontSize: 13, color: NAVY, fontWeight: 500 }}>
                        {formatCurrency(weeklyFromSub(sub), sym)}/wk
                      </span>
                    </div>
                  )
                })}
              </div>

              <p style={{ fontSize: 11, color: '#8A94A6', marginTop: 16 }}>
                Manage bills in the Bills section. This slice is calculated automatically.
              </p>
            </Card>

          ) : selectedSlice.isUnallocated ? (
            /* Unallocated panel */
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>Unallocated</p>
                <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A94A6', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: 30, fontWeight: 700, color: '#8A94A6', marginBottom: 8 }}>
                {formatCurrency(remaining, sym)}
              </p>
              <p style={{ fontSize: 13, color: '#8A94A6', lineHeight: 1.6 }}>
                This portion of your weekly paycheck hasn't been assigned to a category. Add categories to budget it out.
              </p>
              <Button style={{ marginTop: 20, width: '100%' }} onClick={() => { setSelectedId(null); setShowAddModal(true) }}>
                <Plus size={14} /> Add Category
              </Button>
            </Card>

          ) : (
            /* Category edit panel */
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: (selectedSlice.color || GREEN) + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {selectedSlice.icon || '📦'}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{selectedSlice.name}</p>
                    <p style={{ fontSize: 11, color: '#8A94A6' }}>
                      {totalPie > 0 ? ((selectedSlice.value / totalPie) * 100).toFixed(1) : 0}% of this week's paycheck
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A94A6', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>

              <Field label="Weekly allocation">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9CA3AF', pointerEvents: 'none' }}>{sym}</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.amount}
                    onChange={e => { setEditForm({ amount: e.target.value }); setEditErr('') }}
                    style={{ paddingLeft: 28, fontSize: 15 }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit() }}
                  />
                </div>
              </Field>

              {editErr && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginTop: 12 }}>
                  {editErr}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button onClick={handleSaveEdit} style={{ flex: 1 }}>Save</Button>
                <Button variant="secondary" onClick={() => setSelectedId(null)}>Cancel</Button>
              </div>

              <button
                onClick={handleDeleteBudget}
                style={{ marginTop: 14, background: 'none', border: 'none', fontSize: 12, color: '#dc2626', cursor: 'pointer', padding: 0, display: 'block' }}
              >
                Remove this category
              </button>
            </Card>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <AddCategoryModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          weeklyPaycheck={weeklyPaycheck}
          weeklyBills={weeklyBills}
          totalAllocated={totalAllocated}
          existingBudgets={weeklyBudgets}
        />
      )}
      <ConfirmModal
        open={confirmDeleteBudget}
        title="Remove budget category?"
        message={selectedBudget ? `The "${slices.find(s => s.budgetId === selectedBudget.id)?.name || 'category'}" allocation will be removed from your weekly budget.` : ''}
        confirmLabel="Remove"
        onConfirm={() => {
          if (selectedBudget) dispatch({ type: 'DELETE_BUDGET', payload: selectedBudget.id })
          setConfirmDeleteBudget(false)
          setSelectedId(null)
        }}
        onCancel={() => setConfirmDeleteBudget(false)}
      />
    </div>
  )
}
