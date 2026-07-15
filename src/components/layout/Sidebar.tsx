import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, LayoutDashboard, ArrowLeftRight, PieChart, Target, TrendingUp,
  CreditCard, BarChart3, RefreshCw, Settings, Activity,
  ChevronDown, Plus, Check, User, Waves, ChevronsLeft, ChevronsRight, LogOut,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../lib/auth'

const nav = [
  { to: '/home',          icon: Home,            label: 'Overview'     },
  { to: '/budgets',       icon: PieChart,        label: 'Budget'       },
  { to: '/transactions',  icon: ArrowLeftRight,  label: 'Transactions' },
  { to: '/analysis',      icon: Activity,        label: 'Analysis'     },
  { to: '/flow',          icon: Waves,           label: 'Flow'         },
  { to: '/goals',         icon: Target,          label: 'Goals'        },
  { to: '/accounts',      icon: CreditCard,      label: 'Accounts'     },
  { to: '/net-worth',     icon: TrendingUp,      label: 'Net Worth'    },
  { to: '/subscriptions', icon: RefreshCw,       label: 'Bills'        },
  { to: '/reports',       icon: BarChart3,       label: 'Reports'      },
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/settings',      icon: Settings,        label: 'Settings'     },
]

function Initials({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name.slice(0, 2).toUpperCase() || '?')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--primary)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: 'var(--primary-foreground)',
      letterSpacing: '-0.5px',
    }}>
      {initials}
    </div>
  )
}

interface SidebarProps {
  collapsed:  boolean
  onToggle:   () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { workspaces, activeWorkspaceId, profile, switchWorkspace } = useStore()
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId) ?? workspaces[0]

  function handleCreateWorkspace() { setDropdownOpen(false); navigate('/workspace/new') }
  function handleSwitch(id: string) { switchWorkspace(id); setDropdownOpen(false) }

  const W = collapsed ? 52 : 220

  return (
    <motion.aside
      animate={{ width: W, minWidth: W }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: 'var(--sidebar)',
        display: 'flex', flexDirection: 'column',
        height: '100vh', flexShrink: 0,
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* ── Top: Hub / wordmark ─────────────────────────────── */}
      <div style={{ padding: collapsed ? '14px 0' : '16px 12px 0', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/hub')}
          title="Back to Hub"
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 8,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '8px 0' : '8px 10px', borderRadius: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--accent)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Home size={13} color="var(--accent-foreground)" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: 'hidden', flexShrink: 0 }}
              >
                <p style={{
                  fontFamily: '"Fraunces", ui-serif, Georgia, serif',
                  fontSize: 13, fontWeight: 600, color: 'var(--text)',
                  letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap',
                }}>Meridian</p>
                <p style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Back to hub</p>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Current budget block — hidden when collapsed */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '8px 10px 10px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                  Current budget
                </p>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {activeWs?.name ?? 'My Budget'}
                  </span>
                  <ChevronDown size={11} color="var(--text-muted)"
                    style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>

              {dropdownOpen && (
                <div style={{ position: 'relative' }}>
                  <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                  <div className="card-surface" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: '5px' }}>
                    {workspaces.map(ws => (
                      <button key={ws.id} onClick={() => handleSwitch(ws.id)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 9px', borderRadius: 9, cursor: 'pointer',
                        background: ws.id === activeWorkspaceId ? 'var(--accent)' : 'transparent',
                        border: 'none', transition: 'background 0.12s', textAlign: 'left',
                      }}
                        onMouseEnter={e => { if (ws.id !== activeWorkspaceId) (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
                        onMouseLeave={e => { if (ws.id !== activeWorkspaceId) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, background: 'var(--primary)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: 'var(--primary-foreground)',
                        }}>{ws.name[0].toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</p>
                        </div>
                        {ws.id === activeWorkspaceId && <Check size={11} color="var(--accent-foreground)" />}
                      </button>
                    ))}
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <button onClick={handleCreateWorkspace} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 9px', borderRadius: 9, cursor: 'pointer',
                      background: 'transparent', border: 'none', fontFamily: 'inherit',
                      color: 'var(--primary)', fontSize: 11, fontWeight: 500,
                      transition: 'background 0.12s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <Plus size={11} /> New budget
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav links ───────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: '2px 18px 4px', flexShrink: 0 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Menu</p>
        </div>
      )}

      <nav style={{ flex: 1, padding: collapsed ? '4px 0' : '0 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 9,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '9px 0' : '7px 10px',
              borderRadius: collapsed ? 0 : 9,
              textDecoration: 'none', fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent-foreground)' : 'var(--text-muted)',
              background: isActive ? (collapsed ? 'transparent' : 'var(--accent)') : 'transparent',
              transition: 'all 0.15s',
              borderLeft: isActive && collapsed ? `3px solid var(--primary)` : '3px solid transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={14} color={isActive ? 'var(--accent-foreground)' : 'var(--text-dim)'} style={{ flexShrink: 0 }} />
                {!collapsed && label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Profile footer + toggle ──────────────────────────── */}
      <div style={{ padding: collapsed ? '10px 0' : '10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Profile */}
        <NavLink
          to="/profile"
          title={collapsed ? (profile.name || 'Profile') : undefined}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 8,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '7px 0' : '7px 8px',
            borderRadius: collapsed ? 0 : 9,
            textDecoration: 'none',
            background: isActive && !collapsed ? 'var(--accent)' : 'transparent',
            border: collapsed ? 'none' : '1px solid var(--border)',
            transition: 'background 0.15s',
          })}
        >
          {profile.name
            ? <Initials name={profile.name} size={collapsed ? 24 : 26} />
            : <div style={{ width: collapsed ? 24 : 26, height: collapsed ? 24 : 26, borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={12} color="var(--text-muted)" />
              </div>
          }
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.name || 'Profile'}
              </p>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>View profile</p>
            </div>
          )}
        </NavLink>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{
            width: '100%', marginTop: 4,
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 6, padding: collapsed ? '7px 0' : '7px 10px', borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <LogOut size={13} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ fontSize: 10, fontWeight: 500 }}>Sign out</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%', marginTop: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '7px 0', borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          {collapsed
            ? <ChevronsRight size={13} color="var(--text-dim)" />
            : <><ChevronsLeft size={13} /><span style={{ fontSize: 10, fontWeight: 500 }}>Collapse</span></>
          }
        </button>
      </div>
    </motion.aside>
  )
}
