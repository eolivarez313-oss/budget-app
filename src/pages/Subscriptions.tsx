import { useState } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, XCircle, AlertCircle } from 'lucide-react'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Input, Select, Field } from '../components/ui/Input'
import { formatCurrency } from '../utils/formatters'
import { Subscription } from '../types'
import { uuid } from '../utils/uuid'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

function SubModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Subscription }) {
  const { state, dispatch } = useStore()
  const [form, setForm] = useState({
    name: initial?.name || '',
    amount: initial?.amount?.toString() || '',
    frequency: initial?.frequency || 'monthly' as 'weekly'|'monthly'|'yearly',
    categoryId: initial?.categoryId || state.categories.find(c => c.type === 'expense')?.id || '',
    status: initial?.status || 'active' as 'active'|'negotiating'|'cancelled',
  })
  const [err, setErr] = useState('')

  function save() {
    if (!form.name.trim()) return setErr('Name is required')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return setErr('Enter a valid amount')
    setErr('')
    const sub: Subscription = {
      id: initial?.id || uuid(),
      name: form.name.trim(),
      amount,
      frequency: form.frequency,
      categoryId: form.categoryId,
      status: form.status,
      transactionIds: initial?.transactionIds || [],
    }
    dispatch({ type: initial ? 'UPDATE_SUBSCRIPTION' : 'ADD_SUBSCRIPTION', payload: sub })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Bill' : 'Add Bill'} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {err && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
            {err}
          </div>
        )}
        <Field label="Service Name">
          <Input placeholder="Netflix" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Amount">
            <Input type="number" placeholder="0.00" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="Frequency">
            <Select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
        </div>
        <Field label="Category">
          <Select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
            {state.categories.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
            <option value="active">Active</option>
            <option value="negotiating">Negotiating</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={save} style={{ flex: 1 }}>Save</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

function monthlyAmount(sub: Subscription): number {
  if (sub.frequency === 'monthly') return sub.amount
  if (sub.frequency === 'yearly') return sub.amount / 12
  return sub.amount * 4.33
}

const STATUS_CFG = {
  active: { color: GREEN, bg: 'rgba(6,198,138,0.1)', icon: RefreshCw, label: 'Active' },
  negotiating: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: AlertCircle, label: 'Negotiating' },
  cancelled: { color: '#8A94A6', bg: '#EBEBEB', icon: XCircle, label: 'Cancelled' },
}

export function Subscriptions() {
  const { state, dispatch } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [deletingSub, setDeletingSub] = useState<Subscription | null>(null)
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none')
  const sym = state.settings.currencySymbol

  function sortSubs(subs: Subscription[]) {
    if (sortOrder === 'asc') return [...subs].sort((a, b) => monthlyAmount(a) - monthlyAmount(b))
    if (sortOrder === 'desc') return [...subs].sort((a, b) => monthlyAmount(b) - monthlyAmount(a))
    return subs
  }

  const active = sortSubs(state.subscriptions.filter(s => s.status === 'active'))
  const negotiating = sortSubs(state.subscriptions.filter(s => s.status === 'negotiating'))
  const cancelled = sortSubs(state.subscriptions.filter(s => s.status === 'cancelled'))

  const totalMonthly = active.reduce((s, sub) => s + monthlyAmount(sub), 0)
  const totalYearly = totalMonthly * 12

  const renderSubs = (subs: Subscription[]) => subs.map(sub => {
    const cat = state.categories.find(c => c.id === sub.categoryId)
    const cfg = STATUS_CFG[sub.status]
    const Icon = cfg.icon
    return (
      <Card key={sub.id} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{cat?.icon || '📦'}</div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 500, color: NAVY }}>{sub.name}</p>
              <p style={{ fontSize: 11, color: '#8A94A6' }}>{cat?.name} · {sub.frequency}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: NAVY }}>{formatCurrency(sub.amount, sym)}/{sub.frequency === 'monthly' ? 'mo' : sub.frequency === 'yearly' ? 'yr' : 'wk'}</p>
              {sub.frequency !== 'monthly' && <p style={{ fontSize: 11, color: '#8A94A6' }}>{formatCurrency(monthlyAmount(sub), sym)}/mo</p>}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 99 }}>
              <Icon size={10} /> {cfg.label}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <IconButton size="sm" onClick={() => setEditing(sub)}><Edit2 size={13} /></IconButton>
              <IconButton size="sm" variant="danger" onClick={() => setDeletingSub(sub)}><Trash2 size={13} /></IconButton>
            </div>
          </div>
        </div>
      </Card>
    )
  })

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: '-0.5px' }}>Bills</h1>
          <p style={{ fontSize: 13, color: '#8A94A6', marginTop: 3 }}>{active.length} active bill{active.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#8A94A6', fontWeight: 500 }}>Sort by:</span>
            {(['none', 'asc', 'desc'] as const).map((opt) => (
              <button key={opt} onClick={() => setSortOrder(opt)}
                style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                  border: `1px solid ${sortOrder === opt ? GREEN : '#E4E4E4'}`,
                  background: sortOrder === opt ? 'rgba(6,198,138,0.08)' : '#FAFAFA',
                  color: sortOrder === opt ? GREEN : '#8A94A6',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (sortOrder !== opt) (e.currentTarget as HTMLElement).style.borderColor = '#C0C8D8' }}
                onMouseLeave={e => { if (sortOrder !== opt) (e.currentTarget as HTMLElement).style.borderColor = '#E4E4E4' }}
              >
                {opt === 'none' ? 'Default' : opt === 'asc' ? 'Low → High' : 'High → Low'}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowAdd(true)}><Plus size={15} /> Add Bill</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Monthly Total', value: formatCurrency(totalMonthly, sym), color: NAVY },
          { label: 'Annual Total', value: formatCurrency(totalYearly, sym), color: '#f59e0b' },
          { label: 'Active Count', value: String(active.length), color: '#4A6CF7' },
        ].map(s => (
          <Card key={s.label} style={{ padding: '18px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Active</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{renderSubs(active)}</div>
        </div>
      )}
      {negotiating.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Negotiating</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{renderSubs(negotiating)}</div>
        </div>
      )}
      {cancelled.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cancelled</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{renderSubs(cancelled)}</div>
        </div>
      )}

      {state.subscriptions.length === 0 && (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <RefreshCw size={32} style={{ color: '#E4E4E4', margin: '0 auto 12px' }} />
          <p style={{ color: '#8A94A6', marginBottom: 16, fontSize: 14 }}>Track your recurring bills here</p>
          <Button onClick={() => setShowAdd(true)}><Plus size={15} /> Add Bill</Button>
        </Card>
      )}

      {showAdd && <SubModal open onClose={() => setShowAdd(false)} />}
      {editing && <SubModal open onClose={() => setEditing(null)} initial={editing} />}
      <ConfirmModal
        open={!!deletingSub}
        title="Remove bill?"
        message={deletingSub ? `"${deletingSub.name}" (${sym}${deletingSub.amount}/${deletingSub.frequency === 'monthly' ? 'mo' : deletingSub.frequency === 'yearly' ? 'yr' : 'wk'}) will be permanently removed.` : ''}
        confirmLabel="Remove"
        onConfirm={() => { if (deletingSub) dispatch({ type: 'DELETE_SUBSCRIPTION', payload: deletingSub.id }); setDeletingSub(null) }}
        onCancel={() => setDeletingSub(null)}
      />
    </div>
  )
}
