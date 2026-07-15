import { useState } from 'react'
import { User, Bell, Moon, Trash2, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Field } from '../components/ui/Input'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { formatCurrency } from '../utils/formatters'

const ACCENT = 'var(--accent)'

function Initials({ name, size = 72 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name.slice(0, 2).toUpperCase() || '?')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent), #04b07a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff',
      letterSpacing: '-1px', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, paddingLeft: 4 }}>
        {title}
      </p>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {children}
      </Card>
    </div>
  )
}

function Row({ icon: Icon, label, value, action, onAction, danger }: {
  icon: any; label: string; value?: string; action?: string
  onAction?: () => void; danger?: boolean
}) {
  return (
    <div
      onClick={onAction}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        cursor: onAction ? 'pointer' : 'default',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (onAction) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: danger ? 'var(--danger-dim)' : '#F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} color={danger ? 'var(--danger)' : 'var(--text-muted)'} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--text)' }}>{label}</p>
          {value && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{value}</p>}
        </div>
      </div>
      {action && <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>{action} <ChevronRight size={13} /></span>}
    </div>
  )
}

export function Profile() {
  const { profile, updateProfile, workspaces, activeWorkspaceId, deleteWorkspace, switchWorkspace } = useStore()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile.name)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId)
  const sym = activeWs?.settings.currencySymbol ?? '$'
  const netWorth = (activeWs?.accounts ?? []).reduce((s, a) => s + a.balance, 0)

  function saveName() {
    const n = nameInput.trim()
    if (n) updateProfile({ name: n })
    setEditingName(false)
  }

  const wsToDelete = workspaces.find(w => w.id === confirmDelete)

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 600 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Profile</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Your account and preferences</p>
      </div>

      {/* Avatar + name */}
      <Card style={{ padding: '28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {profile.name
            ? <Initials name={profile.name} size={72} />
            : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E9EBEF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={28} color="var(--text-muted)" />
              </div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <form onSubmit={e => { e.preventDefault(); saveName() }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  style={{ fontSize: 15 }}
                />
                <Button type="submit" size="sm">Save</Button>
                <Button variant="secondary" size="sm" onClick={() => { setEditingName(false); setNameInput(profile.name) }}>Cancel</Button>
              </form>
            ) : (
              <>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                  {profile.name || 'No name set'}
                </p>
                <button
                  onClick={() => { setNameInput(profile.name); setEditingName(true) }}
                  style={{ fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 2 }}
                >
                  Edit name
                </button>
              </>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: editingName ? 8 : 4 }}>
              Net worth: {formatCurrency(netWorth, sym)}
            </p>
          </div>
        </div>
      </Card>

      {/* Workspaces */}
      <Section title="Workspaces">
        {workspaces.map((ws, i) => (
          <div
            key={ws.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: i < workspaces.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: ws.id === activeWorkspaceId ? 'var(--accent-dim)' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: ws.id === activeWorkspaceId ? ACCENT : 'var(--text-muted)',
              }}>
                {ws.name[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  {ws.name}
                  {ws.id === activeWorkspaceId && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: ACCENT, background: 'var(--accent-dim)', padding: '2px 6px', borderRadius: 4 }}>
                      ACTIVE
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 1 }}>
                  {ws.type} · {ws.contributors.length > 0 ? `${ws.contributors.length} contributors` : 'Solo'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {ws.id !== activeWorkspaceId && (
                <Button size="sm" variant="secondary" onClick={() => switchWorkspace(ws.id)}>Switch</Button>
              )}
              {workspaces.length > 1 && (
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(ws.id)}>
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <Row icon={Moon} label="Appearance" value="Dark mode" action="Default" />
        <Row icon={Bell} label="Notifications" value="Coming soon" />
      </Section>

      {/* Confirm delete workspace */}
      <ConfirmModal
        open={!!confirmDelete}
        title={`Delete "${wsToDelete?.name}"?`}
        message={`This will permanently delete the workspace and all its transactions, budgets, accounts, goals, and bills. This cannot be undone.`}
        confirmLabel="Delete workspace"
        onConfirm={() => {
          if (confirmDelete) deleteWorkspace(confirmDelete)
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
