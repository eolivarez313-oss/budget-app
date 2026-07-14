import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Trash2, Edit2, Filter, Upload, AlertTriangle } from 'lucide-react'
import { ImportModal } from '../components/ImportModal'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Input, Select, Textarea, Field } from '../components/ui/Input'
import { DatePicker } from '../components/ui/DatePicker'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { formatCurrency, formatDate } from '../utils/formatters'
import { Transaction, TransactionType } from '../types'
import { uuid } from '../utils/uuid'
import { saveCorrection, detectDirection } from '../utils/categorize'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

interface TransactionModalProps { open: boolean; onClose: () => void; initial?: Transaction }
export function TransactionModal({ open, onClose, initial }: TransactionModalProps) {
  const { state, dispatch } = useStore()
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const [form, setForm] = useState({
    date: initial?.date || today,
    description: initial?.description || '',
    amount: initial?.amount?.toString() || '',
    type: initial?.type || 'expense' as TransactionType,
    categoryId: initial?.categoryId || state.categories.find(c => c.type === 'expense')?.id || '',
    accountId: initial?.accountId || state.accounts[0]?.id || '',
    notes: initial?.notes || '',
    isRecurring: initial?.isRecurring || false,
    recurringFrequency: initial?.recurringFrequency || 'monthly' as 'weekly'|'biweekly'|'monthly'|'yearly',
  })
  const [err, setErr] = useState('')

  const filteredCats = state.categories.filter(c => c.type === form.type)

  function save() {
    if (!form.description.trim()) return setErr('Description is required')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return setErr('Enter a valid amount')
    if (!form.categoryId) return setErr('Select a category')
    if (!form.accountId) return setErr('Select an account')
    setErr('')
    const tx: Transaction = {
      id: initial?.id || uuid(),
      date: form.date,
      description: form.description.trim(),
      amount,
      type: form.type,
      categoryId: form.categoryId,
      accountId: form.accountId,
      notes: form.notes,
      isRecurring: form.isRecurring,
      recurringFrequency: form.isRecurring ? form.recurringFrequency : undefined,
    }
    // When the user edits an existing transaction and changes its category, persist
    // that as a learned correction so future imports auto-categorize correctly.
    if (initial && form.categoryId !== initial.categoryId && form.categoryId) {
      const dir = detectDirection(tx.description)
      saveCorrection(tx.description, form.categoryId, dir)
    }
    dispatch({ type: initial ? 'UPDATE_TRANSACTION' : 'ADD_TRANSACTION', payload: tx })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Transaction' : 'Add Transaction'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {err && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{err}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TransactionType, categoryId: '' }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </Select>
          </Field>
          <Field label="Date">
            <DatePicker value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} max={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()} />
          </Field>
        </div>
        <Field label="Description">
          <Input placeholder="e.g. Whole Foods" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>
        <Field label="Amount">
          <Input type="number" placeholder="0.00" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Category">
            <Select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Select category</option>
              {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Account">
            <Select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Textarea rows={2} placeholder="Any notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="recurring" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))}
            style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} />
          <label htmlFor="recurring" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Recurring transaction</label>
        </div>
        {form.isRecurring && (
          <Field label="Frequency">
            <Select value={form.recurringFrequency} onChange={e => setForm(f => ({ ...f, recurringFrequency: e.target.value as any }))}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button onClick={save} style={{ flex: 1 }}>Save Transaction</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

export function Transactions() {
  const { state, dispatch } = useStore()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Bulk delete state
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  const [confirmingBulk, setConfirmingBulk] = useState(false)

  // Single delete state
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null)

  const bulkMatches = (bulkFrom && bulkTo && bulkFrom <= bulkTo)
    ? state.transactions.filter(t => t.date >= bulkFrom && t.date <= bulkTo)
    : []
  const bulkTotal = bulkMatches.reduce((s, t) => s + t.amount, 0)

  function executeBulkDelete() {
    for (const t of bulkMatches) {
      dispatch({ type: 'DELETE_TRANSACTION', payload: t.id })
    }
    setConfirmingBulk(false)
    setShowBulkDelete(false)
    setBulkFrom('')
    setBulkTo('')
  }

  const filtered = state.transactions.filter(t => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat && t.categoryId !== filterCat) return false
    if (filterType && t.type !== filterType) return false
    if (filterMonth && !t.date.startsWith(filterMonth)) return false
    return true
  }).sort((a, b) => b.date.localeCompare(a.date))

  function deleteTransaction(tx: Transaction) {
    setDeletingTx(tx)
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: '-0.5px' }}>Transactions</h1>
          <p style={{ fontSize: 13, color: '#8A94A6', marginTop: 3 }}>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => { setShowBulkDelete(v => !v); setConfirmingBulk(false) }}>
            <Trash2 size={14} /> Bulk Delete
          </Button>
          <Button variant="secondary" onClick={() => setShowImport(true)}><Upload size={14} /> Import Transactions</Button>
          <Button onClick={() => setShowAdd(true)}><Plus size={15} /> Add Transaction</Button>
        </div>
      </div>

      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A94A6', pointerEvents: 'none' }} />
            <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <Button variant="secondary" onClick={() => setShowFilters(f => !f)}>
            <Filter size={14} /> Filters {showFilters ? '▲' : '▼'}
          </Button>
        </div>
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </Select>
            <Select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All categories</option>
              {state.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
            <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          </div>
        )}
      </Card>

      {/* Bulk delete panel */}
      {showBulkDelete && (
        <Card style={{ padding: '18px 20px', border: '1px solid #fecaca', background: '#fff8f8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Trash2 size={15} style={{ color: '#ef4444' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>Bulk Delete by Date Range</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <Field label="From date">
              <DatePicker value={bulkFrom} onChange={setBulkFrom} max={bulkTo || undefined} placeholder="Start date" />
            </Field>
            <Field label="To date">
              <DatePicker value={bulkTo} onChange={setBulkTo} min={bulkFrom || undefined} placeholder="End date" />
            </Field>
            <Button
              variant="danger"
              disabled={bulkMatches.length === 0}
              onClick={() => setConfirmingBulk(true)}
              style={{ marginBottom: 1 }}
            >
              Delete {bulkMatches.length > 0 ? bulkMatches.length : ''} Transaction{bulkMatches.length !== 1 ? 's' : ''}
            </Button>
          </div>
          {bulkFrom && bulkTo && bulkFrom <= bulkTo && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: bulkMatches.length > 0 ? '#fef2f2' : 'rgba(0,0,0,0.03)', border: `1px solid ${bulkMatches.length > 0 ? '#fecaca' : '#E4E4E4'}` }}>
              {bulkMatches.length > 0 ? (
                <p style={{ fontSize: 13, color: '#dc2626' }}>
                  <strong>{bulkMatches.length}</strong> transaction{bulkMatches.length !== 1 ? 's' : ''} found between {bulkFrom} and {bulkTo} · total {formatCurrency(bulkTotal, state.settings.currencySymbol)}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: '#8A94A6' }}>No transactions in this date range.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Bulk delete confirmation modal */}
      {confirmingBulk && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setConfirmingBulk(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 16, border: '1px solid #fecaca', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', width: '100%', maxWidth: 440, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Confirm bulk delete</h2>
                <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 2 }}>This cannot be undone</p>
              </div>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6b7280' }}>Transactions</span>
                <span style={{ fontWeight: 600, color: NAVY }}>{bulkMatches.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6b7280' }}>Total amount</span>
                <span style={{ fontWeight: 600, color: NAVY }}>{formatCurrency(bulkTotal, state.settings.currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6b7280' }}>Date range</span>
                <span style={{ fontWeight: 600, color: NAVY }}>{bulkFrom} → {bulkTo}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#374151' }}>
              You are about to permanently delete <strong>{bulkMatches.length} transaction{bulkMatches.length !== 1 ? 's' : ''}</strong>. This action cannot be reversed.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setConfirmingBulk(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button variant="danger" onClick={executeBulkDelete} style={{ flex: 1 }}>
                <Trash2 size={14} /> Delete {bulkMatches.length} Transaction{bulkMatches.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Card>
        {filtered.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#8A94A6', fontSize: 14 }}>No transactions found.</div>
        )}
        {filtered.map((t, i) => {
          const cat = state.categories.find(c => c.id === t.categoryId)
          const acc = state.accounts.find(a => a.id === t.accountId)
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid #EBEBEB' : 'none',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F5F5'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {cat?.icon || '💳'}
                </div>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 500, color: NAVY }}>{t.description}</p>
                  <p style={{ fontSize: 11, color: '#8A94A6', marginTop: 2 }}>{cat?.name} · {acc?.name} · {formatDate(t.date)}</p>
                </div>
                {t.isRecurring && (
                  <span style={{ fontSize: 11, color: GREEN, background: 'rgba(6,198,138,0.1)', padding: '2px 8px', borderRadius: 99 }}>Recurring</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.type === 'income' ? GREEN : NAVY }}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, state.settings.currencySymbol)}
                </span>
                <IconButton onClick={() => setEditing(t)}><Edit2 size={13} /></IconButton>
                <IconButton variant="danger" onClick={() => deleteTransaction(t)}><Trash2 size={13} /></IconButton>
              </div>
            </div>
          )
        })}
      </Card>

      {showAdd && <TransactionModal open={showAdd} onClose={() => setShowAdd(false)} />}
      {editing && <TransactionModal open={!!editing} onClose={() => setEditing(null)} initial={editing} />}
      {showImport && <ImportModal open={showImport} onClose={() => setShowImport(false)} />}
      <ConfirmModal
        open={!!deletingTx}
        title="Delete transaction?"
        message={deletingTx ? `"${deletingTx.description}" (${state.settings.currencySymbol}${deletingTx.amount.toFixed(2)}) will be permanently removed.` : ''}
        confirmLabel="Delete"
        onConfirm={() => { if (deletingTx) dispatch({ type: 'DELETE_TRANSACTION', payload: deletingTx.id }); setDeletingTx(null) }}
        onCancel={() => setDeletingTx(null)}
      />
    </div>
  )
}
