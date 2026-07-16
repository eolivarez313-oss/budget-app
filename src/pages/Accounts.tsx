import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit2, Trash2, CreditCard, PiggyBank, TrendingUp, Wallet, Building,
  RefreshCw, Unlink, AlertCircle, Building2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Input, Select, Field } from '../components/ui/Input'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { formatCurrency } from '../utils/formatters'
import { Account, AccountType } from '../types'
import { uuid } from '../utils/uuid'
import { PlaidLinkButton } from '../components/PlaidLinkButton'
import { getLinkedItems, unlinkPlaidItem, syncPlaidData, type PlaidItem } from '../lib/plaidApi'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

const TYPE_ICONS: Record<AccountType, any> = {
  checking: Wallet, savings: PiggyBank, credit: CreditCard,
  investment: TrendingUp, loan: Building, cash: Wallet,
  '401k': TrendingUp, ira: TrendingUp,
}

function AccountModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Account }) {
  const { dispatch } = useStore()
  const [form, setForm] = useState({
    name: initial?.name || '',
    type: initial?.type || 'checking' as AccountType,
    balance: initial?.balance?.toString() || '',
    institution: initial?.institution || '',
    color: initial?.color || GREEN,
    interestRate: initial?.interestRate?.toString() || '',
    returnPercent: initial?.returnPercent?.toString() || '',
  })
  const [err, setErr] = useState('')

  function save() {
    if (!form.name.trim()) return setErr('Name is required')
    const balance = parseFloat(form.balance)
    if (isNaN(balance)) return setErr('Enter a valid balance')
    setErr('')
    const account: Account = {
      id: initial?.id || uuid(),
      name: form.name.trim(),
      type: form.type,
      balance: ['credit', 'loan'].includes(form.type) ? -Math.abs(balance) : balance,
      institution: form.institution || undefined,
      color: form.color,
      interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined,
      returnPercent: form.returnPercent ? parseFloat(form.returnPercent) : undefined,
    }
    dispatch({ type: initial ? 'UPDATE_ACCOUNT' : 'ADD_ACCOUNT', payload: account })
    onClose()
  }

  const COLORS = [GREEN, '#4A6CF7', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b']

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Account' : 'Add Account'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {err && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
            {err}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Account Name">
            <Input placeholder="Chase Checking" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="investment">Investment</option>
              <option value="401k">401(k)</option>
              <option value="ira">IRA</option>
              <option value="loan">Loan</option>
              <option value="cash">Cash</option>
            </Select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={['credit','loan'].includes(form.type) ? 'Balance Owed' : 'Current Balance'}>
            <Input type="number" placeholder="0.00" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
          </Field>
          <Field label="Institution (optional)">
            <Input placeholder="Chase Bank" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
          </Field>
        </div>
        {form.type === 'savings' && (
          <Field label="Interest Rate % (optional)">
            <Input type="number" placeholder="4.5" min="0" step="0.1" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} />
          </Field>
        )}
        {['investment','401k','ira'].includes(form.type) && (
          <Field label="Annual Return % (optional)">
            <Input type="number" placeholder="7.0" min="0" step="0.1" value={form.returnPercent} onChange={e => setForm(f => ({ ...f, returnPercent: e.target.value }))} />
          </Field>
        )}
        <Field label="Color">
          <div style={{ display: 'flex', gap: 8 }}>
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
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={save} style={{ flex: 1 }}>Save Account</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

function PlaidItemCard({ item, onSync, onUnlink, syncing, unlinking }: {
  item: PlaidItem
  onSync: () => void
  onUnlink: () => void
  syncing: boolean
  unlinking: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const syncedAt = item.last_synced_at
    ? new Date(item.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never synced'

  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'oklch(0.20 0.04 220)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Building2 size={18} style={{ color: '#4A6CF7' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.institution_name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {item.plaid_accounts.length} account{item.plaid_accounts.length !== 1 ? 's' : ''} · {syncedAt}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {item.error_code && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)' }}>
              <AlertCircle size={12} /> Reconnect needed
            </span>
          )}
          <IconButton
            size="sm"
            onClick={onSync}
            disabled={syncing}
            title="Sync transactions"
            style={{ width: 'auto', padding: '4px 8px', gap: 4, fontSize: 12, borderRadius: 6 }}
          >
            <RefreshCw size={12} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
            <span style={{ fontFamily: 'inherit' }}>{syncing ? 'Syncing…' : 'Sync'}</span>
          </IconButton>
          <IconButton
            size="sm"
            variant="danger"
            onClick={onUnlink}
            disabled={unlinking}
            title="Unlink institution"
            style={{ width: 'auto', padding: '4px 8px', gap: 4, fontSize: 12, borderRadius: 6 }}
          >
            <Unlink size={12} />
            <span style={{ fontFamily: 'inherit' }}>Unlink</span>
          </IconButton>
          <IconButton
            size="sm"
            onClick={() => setExpanded(e => !e)}
            style={{ width: 28, height: 28, borderRadius: 6 }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </IconButton>
        </div>
      </div>

      {expanded && item.plaid_accounts.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {item.plaid_accounts.map(acc => (
            <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{acc.name}</span>
                {acc.mask && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>···{acc.mask}</span>}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, textTransform: 'capitalize' }}>
                  {acc.subtype ?? acc.type}
                </span>
              </div>
              {acc.balance_current != null && (
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(acc.balance_current)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function Accounts() {
  const { state, dispatch } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const sym = state.settings.currencySymbol

  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([])
  const [plaidLoading, setPlaidLoading] = useState(true)
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null)
  const [confirmUnlink, setConfirmUnlink] = useState<PlaidItem | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const loadPlaidItems = useCallback(async () => {
    try {
      const items = await getLinkedItems()
      setPlaidItems(items)
    } catch {
      // Plaid not configured — silently skip
    } finally {
      setPlaidLoading(false)
    }
  }, [])

  useEffect(() => { loadPlaidItems() }, [loadPlaidItems])

  async function handleSync(itemId: string) {
    setSyncingItemId(itemId)
    try {
      await syncPlaidData()
      window.location.reload()
    } catch (e) {
      console.error('Sync failed:', e)
      setSyncingItemId(null)
    }
  }

  async function handleUnlink(item: PlaidItem) {
    setUnlinkingId(item.id)
    try {
      await unlinkPlaidItem(item.id)
      window.location.reload()
    } catch (e) {
      console.error('Unlink failed:', e)
      setUnlinkingId(null)
      setConfirmUnlink(null)
    }
  }

  function deleteAccount(account: Account) {
    setDeletingAccount(account)
  }

  const manualAccounts = state.accounts.filter(a => !(a as any).plaid_account_id)
  const byType = manualAccounts.reduce((acc, a) => {
    const group = ['checking','savings','cash'].includes(a.type) ? 'Cash & Savings'
      : ['credit','loan'].includes(a.type) ? 'Credit & Loans'
      : 'Investments'
    if (!acc[group]) acc[group] = []
    acc[group].push(a)
    return acc
  }, {} as Record<string, Account[]>)

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Accounts</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{state.accounts.length} account{state.accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PlaidLinkButton onSuccess={() => window.location.reload()} label="Connect Bank" />
          <Button onClick={() => setShowAdd(true)}><Plus size={15} /> Add Manual</Button>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Cash & Savings', value: state.accounts.filter(a => ['checking','savings','cash'].includes(a.type)).reduce((s,a) => s+a.balance, 0), color: GREEN },
          { label: 'Investments', value: state.accounts.filter(a => ['investment','401k','ira'].includes(a.type)).reduce((s,a) => s+a.balance, 0), color: '#4A6CF7' },
          { label: 'Debt', value: state.accounts.filter(a => ['credit','loan'].includes(a.type)).reduce((s,a) => s+a.balance, 0), color: 'var(--danger)' },
        ].map(s => (
          <Card key={s.label} style={{ padding: '18px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{formatCurrency(s.value, sym)}</p>
          </Card>
        ))}
      </div>

      {/* Connected Banks (Plaid) */}
      {!plaidLoading && plaidItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Connected Banks
          </h2>
          {plaidItems.map(item => (
            <PlaidItemCard
              key={item.id}
              item={item}
              syncing={syncingItemId === item.id}
              unlinking={unlinkingId === item.id}
              onSync={() => handleSync(item.id)}
              onUnlink={() => setConfirmUnlink(item)}
            />
          ))}
        </div>
      )}

      {/* Manual accounts by group */}
      {Object.entries(byType).map(([group, accs]) => (
        <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{group}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {accs.map(a => {
              const Icon = TYPE_ICONS[a.type] || Wallet
              return (
                <Card key={a.id} style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: a.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={20} style={{ color: a.color }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{a.name}</p>
                        {a.institution && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.institution}</p>}
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.type}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 17, fontWeight: 700, color: a.balance < 0 ? '#dc2626' : NAVY }}>
                        {formatCurrency(a.balance, sym)}
                      </p>
                      {a.interestRate && <p style={{ fontSize: 11, color: GREEN }}>{a.interestRate}% APY</p>}
                      {a.returnPercent && <p style={{ fontSize: 11, color: '#4A6CF7' }}>{a.returnPercent}% return</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid #EBEBEB' }}>
                    <IconButton size="sm" onClick={() => setEditing(a)} style={{ width: 'auto', padding: '4px 8px', gap: 4, fontSize: 12, borderRadius: 6 }}>
                      <Edit2 size={12} /> <span style={{ fontFamily: 'inherit' }}>Edit</span>
                    </IconButton>
                    <IconButton size="sm" variant="danger" onClick={() => deleteAccount(a)} style={{ width: 'auto', padding: '4px 8px', gap: 4, fontSize: 12, borderRadius: 6 }}>
                      <Trash2 size={12} /> <span style={{ fontFamily: 'inherit' }}>Delete</span>
                    </IconButton>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {showAdd && <AccountModal open onClose={() => setShowAdd(false)} />}
      {editing && <AccountModal open onClose={() => setEditing(null)} initial={editing} />}

      <ConfirmModal
        open={!!deletingAccount}
        title="Delete account?"
        message={deletingAccount ? `"${deletingAccount.name}" will be removed. Transactions linked to it will remain.` : ''}
        confirmLabel="Delete"
        onConfirm={() => { if (deletingAccount) dispatch({ type: 'DELETE_ACCOUNT', payload: deletingAccount.id }); setDeletingAccount(null) }}
        onCancel={() => setDeletingAccount(null)}
      />

      <ConfirmModal
        open={!!confirmUnlink}
        title="Unlink bank?"
        message={confirmUnlink ? `This will remove "${confirmUnlink.institution_name}" and its connected accounts. Imported transactions will remain in your history.` : ''}
        confirmLabel="Unlink"
        onConfirm={() => { if (confirmUnlink) handleUnlink(confirmUnlink) }}
        onCancel={() => setConfirmUnlink(null)}
      />
    </div>
  )
}
