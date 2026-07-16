import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { StoreProvider, useStore } from './store/useStore'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Budgets } from './pages/Budgets'
import { Goals } from './pages/Goals'
import { NetWorth } from './pages/NetWorth'
import { Accounts } from './pages/Accounts'
import { Subscriptions } from './pages/Subscriptions'
import { Reports } from './pages/Reports'
import { Analysis } from './pages/Analysis'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { Home } from './pages/Home'
import { Profile } from './pages/Profile'
import { WorkspaceCreate } from './pages/WorkspaceCreate'
import { Hub } from './pages/Hub'
import { Flow } from './pages/Flow'
import { Calendar } from './pages/Calendar'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'

const ONBOARDING_KEY = (userId: string) => `budget_onboarding_done_${userId}`
const HUB_ROUTES = ['/hub', '/workspace/new']

// ── Loading spinner (shared) ─────────────────────────────────────────────────

function Spinner({ label = 'Loading Meridian…' }: { label?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--background)', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: '"Fraunces", ui-serif, Georgia, serif',
            fontSize: 22, fontWeight: 700, color: 'var(--accent-foreground)',
            letterSpacing: '-0.03em',
          }}>M</span>
        </div>
        <div style={{
          position: 'absolute', inset: -4, borderRadius: 20,
          border: '2px solid transparent',
          borderTopColor: 'var(--primary)',
          animation: 'spin 0.9s linear infinite',
        }} />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Route guard: redirect to /login if not authenticated ─────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

// ── App routes (protected) ───────────────────────────────────────────────────

function AppRoutes() {
  const { loading } = useStore()
  const { user } = useAuth()
  const location = useLocation()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      const done = localStorage.getItem(ONBOARDING_KEY(user.id))
      if (!done) setShowOnboarding(true)
    }
  }, [loading, user])

  function completeOnboarding() {
    if (user) localStorage.setItem(ONBOARDING_KEY(user.id), '1')
    setShowOnboarding(false)
  }

  if (loading) return <Spinner />

  const isHubRoute = HUB_ROUTES.some(r => location.pathname === r)

  if (isHubRoute) {
    return (
      <>
        {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
        <Routes>
          <Route path="/hub" element={<Hub />} />
          <Route path="/workspace/new" element={<WorkspaceCreate />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/hub" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/net-worth" element={<NetWorth />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Routes>
      </Layout>
    </>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* All other routes require authentication */}
            <Route path="/*" element={
              <RequireAuth>
                <AppRoutes />
              </RequireAuth>
            } />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </AuthProvider>
  )
}
