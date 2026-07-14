import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider, useStore } from './store/useStore'
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
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <DollarSign size={28} className="text-white" />
          </div>
          <p className="text-slate-400 text-sm">Loading your finances...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/net-worth" element={<NetWorth />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
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
