import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Target, TrendingUp,
  CreditCard, BarChart3, RefreshCw, Settings, DollarSign, Activity
} from 'lucide-react'
import { useStore } from '../../store/useStore'

const NAVY = '#1B2030'
const GREEN = '#06C68A'
const GREEN_BG = 'rgba(6,198,138,0.12)'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/analysis', icon: Activity, label: 'Analysis' },
  { to: '/budgets', icon: PieChart, label: 'Budgets' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/net-worth', icon: TrendingUp, label: 'Net Worth' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/subscriptions', icon: RefreshCw, label: 'Bills' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const { state } = useStore()

  return (
    <aside style={{
      width: 224,
      minWidth: 224,
      background: NAVY,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: GREEN,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <DollarSign size={18} color="#fff" />
          </div>
          <div>
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
              {state.settings.name || 'My Budget'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>Personal Finance</p>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Menu</p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="nav-item"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? GREEN : 'rgba(255,255,255,0.5)',
              background: isActive ? GREEN_BG : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} color={isActive ? GREEN : 'rgba(255,255,255,0.4)'} style={{ flexShrink: 0 }} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Synced to cloud</p>
        </div>
      </div>
    </aside>
  )
}
