import { useState } from 'react'
import { Plus, Edit2, Trash2, PlusCircle } from 'lucide-react'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Input, Select, Textarea, Field } from '../components/ui/Input'
import { formatCurrency, daysUntil } from '../utils/formatters'
import { Goal, GoalType } from '../types'
import { uuid } from '../utils/uuid'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

const TEMPLATES = [
  { key: 'emergency_fund', label: '🛡️ Emergency Fund', type: 'emergency_fund' as GoalType, color: GREEN },
  { key: 'down_payment', label: '🏠 Home Down Payment', type: 'savings' as GoalType, color: '#4A6CF7' },
  { key: 'debt_payoff', label: '💳 Pay Off Debt', type: 'debt_payoff' as GoalType, color: '#ef4444' },
  { key: 'retirement', label: '🏖️ Retirement', type: 'retirement' as GoalType, color: '#8b5cf6' },
  { key: 'vacation', label: '✈️ Vacation', type: 'purchase' as GoalType, color: '#f59e0b' },
  { key: 'new_car', label: '🚗 New Car', type: 'purchase' as GoalType, color: '#0ea5e9' },
  { key: 'investment', label: '📈 Investment Goal', type: 'investment' as GoalType, color: '#a78bfa' },
  { key: 'custom', label: '⭐ Custom Goal', type: 'savings' as GoalType, color: '#64748b' },
]

function GoalModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Goal }) {
  const { state, dispatch } = useStore()
  const [step, setStep] = useState(initial ? 1 : 0)
  const [template, setTemplate] = useState(initial?.template || '')
  const [form, setForm] = useState({
    name: initial?.name || '',
    targetAmount: initial?.targetAmount?.toString() || '',
    currentAmount: initial?.currentAmount?.toString() || '0',
    targetDate: initial?.targetDate || '',
    type: initial?.type || 'savings' as GoalType,
    color: initial?.color || GREEN,
    accountId: initial?.accountId || '',
    notes: initial?.notes || '',
  })
  const [err, setErr] = useState('')

  function selectTemplate(t: typeof TEMPLATES[0]) {
    setTemplate(t.key)
    setForm(f => ({ ...f, type: t.type, color: t.color, name: t.label.split(' ').slice(1).join(' ') }))
    setStep(1)
  }

  function save() {
    if (!form.name.trim()) return setErr('Name is required')
    const target = parseFloat(form.targetAmount)
    if (isNaN(target) || target <= 0) return setErr('Enter a valid target amount')
    const current = parseFloat(form.currentAmount) || 0
    setErr('')
    const goal: Goal = {
      id: initial?.id || uuid(),
      name: form.name.trim(),
      targetAmount: target,
      currentAmount: current,
      targetDate: form.targetDate || undefined,
      type: form.type,
      color: form.color,
      accountId: form.accountId || undefined,
      notes: form.notes,
      template,
    }
    dispatch({ type: initial ? 'UPDATE_GOAL' : 'ADD_GOAL', payload: goal })
    onClose()
  }

  const COLORS = [GREEN, '#4A6CF7', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b']

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Goal' : 'New Goal'}>
      {step === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: '#8A94A6' }}>Choose a goal template to get started:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TEMPLATES.map(t => (
              <button key={t.key} onClick={() => selectTemplate(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px',
                  borderRadius: 10, border: '1px solid #E4E4E4', background: '#FAFAFA',
                  cursor: 'pointer', fontSize: 13, color: NAVY, textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GREEN; (e.currentTarget as HTMLElement).style.background = 'rgba(6,198,138,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E4E4E4'; (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
              >{t.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{err}</p>}
          <Field label="Goal Name">
            <Input placeholder="e.g. Emergency Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Target Amount">
              <Input type="number" placeholder="10000" min="1" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} />
            </Field>
            <Field label="Current Amount">
              <Input type="number" placeholder="0" min="0" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Target Date (optional)">
              <Input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
            </Field>
            <Field label="Linked Account (optional)">
              <Select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                <option value="">None</option>
                {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Color">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s',
                  }} />
              ))}
            </div>
          </Field>
          <Field label="Notes (optional)">
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={save} style={{ flex: 1 }}>Save Goal</Button>
            {!initial && <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>}
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function AddFundsModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { dispatch } = useStore()
  const [amount, setAmount] = useState('')
  function save() {
    const n = parseFloat(amount)
    if (!isNaN(n) && n > 0) {
      dispatch({ type: 'UPDATE_GOAL', payload: { ...goal, currentAmount: Math.min(goal.targetAmount, goal.currentAmount + n) } })
      onClose()
    }
  }
  return (
    <Modal open onClose={onClose} title={`Add Funds to ${goal.name}`} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Amount to Add">
          <Input type="number" placeholder="0.00" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={save} style={{ flex: 1 }}>Add Funds</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

export function Goals() {
  const { state, dispatch } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [addFunds, setAddFunds] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)
  const sym = state.settings.currencySymbol

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: '-0.5px' }}>Goals</h1>
          <p style={{ fontSize: 13, color: '#8A94A6', marginTop: 3 }}>{state.goals.length} active goal{state.goals.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus size={15} /> New Goal</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {state.goals.map(goal => {
          const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0
          const remaining = goal.targetAmount - goal.currentAmount
          const days = goal.targetDate ? daysUntil(goal.targetDate) : null
          const radialData = [{ value: pct, fill: goal.color }]
          return (
            <Card key={goal.id} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{goal.name}</h3>
                <div style={{ display: 'flex', gap: 4 }}>
                  <IconButton size="sm" onClick={() => setEditing(goal)}><Edit2 size={13} /></IconButton>
                  <IconButton size="sm" variant="danger" onClick={() => setDeletingGoal(goal)}><Trash2 size={13} /></IconButton>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                      <RadialBar background={{ fill: '#E4E4E4' }} dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{Math.round(pct)}%</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: goal.color }}>{pct.toFixed(0)}%</p>
                  <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 2 }}>{formatCurrency(goal.currentAmount, sym)} saved</p>
                  <p style={{ fontSize: 12, color: '#8A94A6' }}>{formatCurrency(goal.targetAmount, sym)} goal</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8A94A6' }}>Remaining</span>
                  <span style={{ color: NAVY, fontWeight: 500 }}>{formatCurrency(Math.max(0, remaining), sym)}</span>
                </div>
                {days !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8A94A6' }}>Days left</span>
                    <span style={{ color: days < 30 ? '#f59e0b' : NAVY, fontWeight: 500 }}>{days > 0 ? `${days} days` : 'Past due'}</span>
                  </div>
                )}
              </div>

              {pct < 100 && (
                <Button variant="secondary" onClick={() => setAddFunds(goal)} style={{ marginTop: 14, width: '100%' }}>
                  <PlusCircle size={14} /> Add Funds
                </Button>
              )}
              {pct >= 100 && (
                <div style={{ marginTop: 14, padding: '9px', textAlign: 'center', fontSize: 13, color: GREEN, background: 'rgba(6,198,138,0.08)', borderRadius: 8 }}>
                  🎉 Goal Reached!
                </div>
              )}
            </Card>
          )
        })}

        {state.goals.length === 0 && (
          <div style={{ gridColumn: 'span 3' }}>
            <Card style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ color: '#8A94A6', marginBottom: 16, fontSize: 14 }}>No goals yet. Set your first financial goal!</p>
              <Button onClick={() => setShowAdd(true)}><Plus size={15} /> Create Goal</Button>
            </Card>
          </div>
        )}
      </div>

      {showAdd && <GoalModal open onClose={() => setShowAdd(false)} />}
      {editing && <GoalModal open onClose={() => setEditing(null)} initial={editing} />}
      {addFunds && <AddFundsModal goal={addFunds} onClose={() => setAddFunds(null)} />}
      <ConfirmModal
        open={!!deletingGoal}
        title="Delete goal?"
        message={deletingGoal ? `"${deletingGoal.name}" and all its progress will be permanently removed.` : ''}
        confirmLabel="Delete"
        onConfirm={() => { if (deletingGoal) dispatch({ type: 'DELETE_GOAL', payload: deletingGoal.id }); setDeletingGoal(null) }}
        onCancel={() => setDeletingGoal(null)}
      />
    </div>
  )
}
