import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, LayoutDashboard, ArrowLeftRight, PieChart, Target, TrendingUp,
  CreditCard, BarChart3, RefreshCw, Settings, Activity,
  ChevronDown, Plus, Check, User,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { makeWorkspace } from '../../store/useStore'
import { getInitialData } from '../../store/initialData'
import { uuid } from '../../utils/uuid'

const nav = [
  { to: '/home',          icon: Home,           label: 'Home',         exact: true },
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',   exact: true },
  { to: '/transactions',  icon: ArrowLeftRight,  label: 'Transactions', exact: false },
  { to: '/analysis',      icon: Activity,        label: 'Analysis',     exact: false },
  { to: '/budgets',       icon: PieChart,        label: 'Budgets',      exact: false },
  { to: '/goals',         icon: Target,          label: 'Goals',        exact: false },
  { to: '/net-worth',     icon: TrendingUp,      label: 'Net Worth',    exact: false },
  { to: '/accounts',      icon: CreditCard,      label: 'Accounts',     exact: false },
  { to: '/subscriptions', icon: RefreshCw,       label: 'Bills',        exact: false },
  { to: '/reports',       icon: BarChart3,       label: 'Reports',      exact: false },
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
      background: 'linear-gradient(135deg, var(--accent), #04b07a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff',
      flexShrink: 0, letterSpacing: '-0.5px',
    }}>
      {initials}
    </div>
  )
}

export function Sidebar() {
  const { workspaces, activeWorkspaceId, profile, switchWorkspace, createWorkspace } = useStore()
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
      {/* Workspace switcher */}
      <div style={{ padding: '20px 14px 14px', position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: dropdownOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { if (!dropdownOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>
              {(activeWs?.name ?? 'B')[0].toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              {activeWs?.name ?? 'My Budget'}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
              {activeWs?.type ?? 'personal'}
            </p>
          </div>
          <ChevronDown size={13} color="var(--text-muted)" style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <>
            <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            <div style={{
              position: 'absolute', top: '100%', left: 14, right: 14, zIndex: 100,
              background: 'var(--elevated)', border: '1px solid var(--border)',
              borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              padding: '6px',
              marginTop: 4,
            }}>
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                    background: ws.id === activeWorkspaceId ? 'var(--accent-dim)' : 'transparent',
                    border: 'none', transition: 'background 0.12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (ws.id !== activeWorkspaceId) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { if (ws.id !== activeWorkspaceId) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>
                    {ws.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ws.type}</p>
                  </div>
                  {ws.id === activeWorkspaceId && <Check size={13} color="var(--accent)" />}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
              <button
                onClick={handleCreateWorkspace}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  color: 'var(--accent)', fontSize: 13, fontWeight: 500,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Plus size={13} /> New workspace
              </button>
            </div>
          </>
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
              padding: '8px 12px', borderRadius: 8,
              textDecoration: 'none', fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} color={isActive ? 'var(--accent)' : 'var(--text-dim)'} style={{ flexShrink: 0 }} />
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
            background: isActive ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            transition: 'background 0.15s',
          })}
        >
          {profile.name
            ? <Initials name={profile.name} size={30} />
            : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
