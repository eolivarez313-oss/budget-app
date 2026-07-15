import { useState } from 'react'
import { User, Bell, Moon, Trash2, ChevronRight, Check, KeyRound, Mail, Shield, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuth } from '../lib/auth'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Field } from '../components/ui/Input'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { formatCurrency } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'

const ACCENT = 'var(--accent)'

function Initials({ name, size = 72 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name.slice(0, 2).toUpperCase() || '?')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)',
      border: '2px solid var(--accent-foreground)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: 'var(--accent-foreground)',
      letterSpacing: '-1px', flexShrink: 0,
      fontFamily: '"Fraunces", ui-serif, Georgia, serif',
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
          background: danger ? 'var(--danger-dim)' : 'var(--secondary)',
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

function passwordRequirements(pw: string) {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'At least one letter', met: /[a-zA-Z]/.test(pw) },
    { label: 'At least one number', met: /[0-9]/.test(pw) },
  ]
}

export function Profile() {
  const { profile, updateProfile, workspaces, activeWorkspaceId, deleteWorkspace, switchWorkspace } = useStore()
  const { user, updatePassword, updateEmail, deleteAccount, signOut } = useAuth()
  const navigate = useNavigate()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile.name)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Change password modal
  const [showChangePass, setShowChangePass] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState(false)
  const [passLoading, setPassLoading] = useState(false)

  // Change email modal
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  // Delete account confirm
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

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
            : <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <p className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
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
                width: 32, height: 32, borderRadius: 8, background: ws.id === activeWorkspaceId ? 'var(--accent)' : 'var(--secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: ws.id === activeWorkspaceId ? 'var(--accent-foreground)' : 'var(--text-muted)',
              }}>
                {ws.name[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  {ws.name}
                  {ws.id === activeWorkspaceId && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: 'var(--accent-foreground)', background: 'var(--accent)', padding: '2px 6px', borderRadius: 9999 }}>
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

      {/* Household: "I am" contributor picker */}
      {workspaces.some(w => w.id === activeWorkspaceId && w.type === 'household' && w.contributors.length > 0) && (() => {
        const hw = workspaces.find(w => w.id === activeWorkspaceId)!
        return (
          <Section title="I am">
            <div style={{ padding: '8px 10px' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 8px 10px', lineHeight: 1.5 }}>
                Select which contributor is you — the home screen greeting will use this name.
              </p>
              {hw.contributors.map((c, i) => {
                const isMe = profile.myContributorId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => updateProfile({ myContributorId: isMe ? undefined : c.id })}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: isMe ? 'var(--accent)' : 'transparent',
                      marginBottom: i < hw.contributors.length - 1 ? 2 : 0,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
                    onMouseLeave={e => { if (!isMe) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: isMe ? 600 : 400, color: isMe ? 'var(--accent-foreground)' : 'var(--text)' }}>
                      {c.name}
                    </span>
                    {isMe && <Check size={14} color="var(--accent-foreground)" />}
                  </button>
                )
              })}
            </div>
          </Section>
        )
      })()}

      {/* Preferences */}
      <Section title="Preferences">
        <Row icon={Moon} label="Appearance" value="Light mode" action="Default" />
        <Row icon={Bell} label="Notifications" value="Coming soon" />
      </Section>

      {/* Account security */}
      <Section title="Account">
        <Row
          icon={Mail}
          label="Email address"
          value={user?.email ?? '—'}
          action="Change"
          onAction={() => { setNewEmail(''); setEmailError(''); setEmailSuccess(false); setShowChangeEmail(true) }}
        />
        <Row
          icon={KeyRound}
          label="Password"
          value="••••••••"
          action="Change"
          onAction={() => { setNewPass(''); setConfirmPass(''); setPassError(''); setPassSuccess(false); setShowChangePass(true) }}
        />
        <Row
          icon={Shield}
          label="Delete account"
          value="Permanently removes all data"
          danger
          onAction={() => setShowDeleteAccount(true)}
        />
      </Section>

      {/* Change password modal */}
      <Modal open={showChangePass} onClose={() => setShowChangePass(false)} title="Change password" size="sm">
        {passSuccess ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <Check size={32} color="var(--success)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 'var(--text-label)', color: 'var(--text)' }}>Password updated successfully.</p>
            <Button style={{ marginTop: 16, width: '100%' }} onClick={() => setShowChangePass(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={async e => {
            e.preventDefault()
            const reqs = passwordRequirements(newPass)
            if (!reqs.every(r => r.met)) { setPassError('Password does not meet requirements.'); return }
            if (newPass !== confirmPass) { setPassError('Passwords do not match.'); return }
            setPassError(''); setPassLoading(true)
            const { error } = await updatePassword(newPass)
            setPassLoading(false)
            if (error) setPassError(error)
            else setPassSuccess(true)
          }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {passError && (
              <p style={{ fontSize: 'var(--text-label)', color: 'var(--danger)', background: 'var(--danger-dim)', padding: '8px 12px', borderRadius: 8 }}>{passError}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Field label="New password">
                <Input type="password" autoComplete="new-password" placeholder="••••••••" value={newPass} onChange={e => setNewPass(e.target.value)} required />
              </Field>
              {newPass.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 2 }}>
                  {passwordRequirements(newPass).map(req => (
                    <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {req.met ? <Check size={11} color="var(--success)" /> : <X size={11} color="var(--text-dim)" />}
                      <span style={{ fontSize: 'var(--text-micro)', color: req.met ? 'var(--success)' : 'var(--text-dim)' }}>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Field label="Confirm new password">
              <Input type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
            </Field>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="secondary" type="button" onClick={() => setShowChangePass(false)}>Cancel</Button>
              <Button type="submit" disabled={passLoading}>{passLoading ? 'Updating…' : 'Update password'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Change email modal */}
      <Modal open={showChangeEmail} onClose={() => setShowChangeEmail(false)} title="Change email" size="sm">
        {emailSuccess ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <Check size={32} color="var(--success)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 'var(--text-label)', color: 'var(--text)' }}>Check your new email address to confirm the change.</p>
            <Button style={{ marginTop: 16, width: '100%' }} onClick={() => setShowChangeEmail(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={async e => {
            e.preventDefault()
            if (!newEmail.includes('@')) { setEmailError('Please enter a valid email address.'); return }
            setEmailError(''); setEmailLoading(true)
            const { error } = await updateEmail(newEmail)
            setEmailLoading(false)
            if (error) setEmailError(error)
            else setEmailSuccess(true)
          }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {emailError && (
              <p style={{ fontSize: 'var(--text-label)', color: 'var(--danger)', background: 'var(--danger-dim)', padding: '8px 12px', borderRadius: 8 }}>{emailError}</p>
            )}
            <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>Current: <strong style={{ color: 'var(--text)' }}>{user?.email}</strong></p>
            <Field label="New email address">
              <Input type="email" autoComplete="email" placeholder="new@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
            </Field>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>A confirmation link will be sent to your new email address.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setShowChangeEmail(false)}>Cancel</Button>
              <Button type="submit" disabled={emailLoading}>{emailLoading ? 'Sending…' : 'Send confirmation'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete account confirm */}
      <ConfirmModal
        open={showDeleteAccount}
        title="Delete your account?"
        message={`This will permanently delete your account and all data: ${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}, all transactions, budgets, accounts, goals, and bills. This cannot be undone.`}
        confirmLabel={deleteLoading ? 'Deleting…' : 'Delete my account'}
        onConfirm={async () => {
          setDeleteLoading(true)
          await deleteAccount()
          setDeleteLoading(false)
          navigate('/login', { replace: true })
        }}
        onCancel={() => setShowDeleteAccount(false)}
      />

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
