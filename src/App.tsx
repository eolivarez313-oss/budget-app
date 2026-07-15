import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider, useStore } from './store/useStore'
import { Layout } from './components/layout/Layout'
import { Navigate } from 'react-router-dom'
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
import { DollarSign } from 'lucide-react'

const ONBOARDING_KEY = 'budget_onboarding_done'

function AppRoutes() {
  const { loading } = useStore()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!loading) {
      const done = localStorage.getItem(ONBOARDING_KEY)
      if (!done) setShowOnboarding(true)
    }
  }, [loading])

  function completeOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(6,198,138,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DollarSign size={26} color="#06C68A" />
          </div>
          <div style={{
            position: 'absolute', inset: -4, borderRadius: 20,
            border: '2px solid transparent',
            borderTopColor: '#06C68A',
            animation: 'spin 0.9s linear infinite',
          }} />
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading your finances…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <>
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/net-worth" element={<NetWorth />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/workspace/new" element={<WorkspaceCreate />} />
        </Routes>
      </Layout>
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </StoreProvider>
  )
}
