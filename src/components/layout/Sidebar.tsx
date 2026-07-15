import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, LayoutDashboard, ArrowLeftRight, PieChart, Target, TrendingUp,
  CreditCard, BarChart3, RefreshCw, Settings, Activity,
  ChevronDown, Plus, Check, User,
} from 'lucide-react'
import { useStore } from '../../store/useStore'

const nav = [
  { to: '/home',          icon: Home,            label: 'Overview',     exact: true },
  { to: '/budgets',       icon: PieChart,        label: 'Budget',       exact: false },
  { to: '/transactions',  icon: ArrowLeftRight,  label: 'Transactions', exact: false },
  { to: '/analysis',      icon: Activity,        label: 'Analysis',     exact: false },
  { to: '/goals',         icon: Target,          label: 'Goals',        exact: false },
  { to: '/accounts',      icon: CreditCard,      label: 'Accounts',     exact: false },
  { to: '/net-worth',     icon: TrendingUp,      label: 'Net Worth',    exact: false },
  { to: '/subscriptions', icon: RefreshCw,       label: 'Bills',        exact: false },
  { to: '/reports',       icon: BarChart3,       label: 'Reports',      exact: false },
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',    exact: true },
  { to: '/settings',      icon: Settings,        label: 'Settings',     exact: false },
]

function Initials({ name, size = 32 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name.slice(0, 2).toUpperCase() || '?')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: 'var(--primary-foreground)',
      flexShrink: 0, letterSpacing: '-0.5px',
    }}>
      {initials}
    </div>
  )
}

export function Sidebar() {
  const { workspaces, activeWorkspaceId, profile, switchWorkspace } = useStore()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId) ?? workspaces[0]

  function handleCreateWorkspace() {
    setDropdownOpen(false)
    navigate('/workspace/new')
  }

  function handleSwitch(id: string) {
    switchWorkspace(id)
    setDropdownOpen(false)
  }

  const displayName = profile.name || activeWs?.name || 'My Budget'

  return (
    <aside style={{
      width: 220, minWidth: 220, flexShrink: 0,
      background: 'var(--sidebar)',
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh',
      borderRight: '1px solid var(--border)',
    }}>
      {/* ── Meridian wordmark + back-to-hub ─────────────────────── */}
      <div style={{ padding: '20px 16px 0' }}>
        {/* Wordmark row — clickable → /hub */}
        <button
          onClick={() => navigate('/hub')}
          title="Back to Hub"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', borderRadius: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Home size={13} color="var(--accent-foreground)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: '"Fraunces", ui-serif, Georgia, serif',
              fontSize: 14, fontWeight: 600, color: 'var(--text)',
              letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              Meridian
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Back to hub</p>
          </div>
        </button>

        {/* Current budget block */}
        <div style={{ padding: '10px 12px 14px' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Current budget
          </p>
          {/* Dropdown trigger */}
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeWs?.name ?? 'My Budget'}
            </span>
            <ChevronDown size={12} color="var(--text-muted)" style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div style={{ position: 'relative' }}>
            <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            <div className="card-surface" style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: '6px',
            }}>
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                    background: ws.id === activeWorkspaceId ? 'var(--accent)' : 'transparent',
                    border: 'none', transition: 'background 0.12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (ws.id !== activeWorkspaceId) (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
                  onMouseLeave={e => { if (ws.id !== activeWorkspaceId) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, background: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--primary-foreground)',
                  }}>
                    {ws.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ws.type}</p>
                  </div>
                  {ws.id === activeWorkspaceId && <Check size={12} color="var(--accent-foreground)" />}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
              <button
                onClick={handleCreateWorkspace}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  color: 'var(--primary)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Plus size={12} /> New budget
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav label */}
      <div style={{ padding: '4px 20px 6px' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Menu</p>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {nav.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className="nav-item"
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 10,
              textDecoration: 'none', fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent-foreground)' : 'var(--text-muted)',
              background: isActive ? 'var(--accent)' : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} color={isActive ? 'var(--accent-foreground)' : 'var(--text-dim)'} style={{ flexShrink: 0 }} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile footer */}
      <div style={{ padding: '14px', borderTop: '1px solid var(--border)' }}>
        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 10,
            textDecoration: 'none',
            background: isActive ? 'var(--accent)' : 'var(--surface)',
            border: '1px solid var(--border)',
            transition: 'background 0.15s',
          })}
        >
          {profile.name
            ? <Initials name={profile.name} size={30} />
            : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} color="var(--text-muted)" />
              </div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>View profile</p>
          </div>
        </NavLink>
      </div>
    </aside>
  )
}
