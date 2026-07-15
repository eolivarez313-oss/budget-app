import { useState } from 'react'
import { DollarSign, Trash2, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Field } from '../components/ui/Input'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { getInitialData } from '../store/initialData'
import { useAuth } from '../lib/auth'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

interface OnboardingProps {
  onComplete: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { dispatch } = useStore()
  const { user } = useAuth()
  const [step, setStep] = useState<'choose' | 'clearing' | 'name'>('choose')
  const [appName, setAppName] = useState('')
  const [currencySymbol, setCurrencySymbol] = useState('$')

  async function startFresh() {
    setStep('clearing')
    await Promise.all([
      supabase.from('transactions').delete().neq('id', 'x'),
      supabase.from('budgets').delete().neq('id', 'x'),
      supabase.from('goals').delete().neq('id', 'x'),
      supabase.from('net_worth_history').delete().neq('id', 'x'),
      supabase.from('subscriptions').delete().neq('id', 'x'),
    ])
    await supabase.from('accounts').delete().neq('id', 'x')
    await supabase.from('categories').delete().neq('id', 'x')
    localStorage.removeItem('budget_app_v1')
    setStep('name')
  }

  async function finish() {
    const name = appName.trim() || ''
    const initial = getInitialData()
    const cleanState = {
      ...initial,
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      netWorthHistory: [],
      subscriptions: [],
      settings: { ...initial.settings, name: name || 'My Budget', currencySymbol: currencySymbol || '$' },
    }
    const { seedDatabase } = await import('../lib/db')
    if (user) await seedDatabase(cleanState, user.id)
    dispatch({ type: 'SET_STATE', payload: cleanState })
    if (name) dispatch({ type: 'UPDATE_PROFILE', payload: { name } } as any)
    onComplete()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#D8D8D8',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: GREEN,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(6,198,138,0.35)',
          }}>
            <DollarSign size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: NAVY, letterSpacing: '-0.5px' }}>Welcome</h1>
          <p style={{ fontSize: 14, color: '#8A94A6', marginTop: 8 }}>Let's set up your personal finance app</p>
        </div>

        {/* Step: choose */}
        {step === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={startFresh}
              style={{
                width: '100%', padding: '20px 22px',
                background: '#FAFAFA', border: `2px solid ${GREEN}`,
                borderRadius: 16, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(6,198,138,0.06)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: NAVY, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Trash2 size={16} color={GREEN} /> Start Fresh
                </p>
                <p style={{ fontSize: 13, color: '#8A94A6' }}>Clear demo data and set up your real accounts</p>
              </div>
              <ArrowRight size={18} color="#C0C8D8" />
            </button>

            <button
              onClick={onComplete}
              style={{
                width: '100%', padding: '20px 22px',
                background: '#FAFAFA', border: '1px solid #E4E4E4',
                borderRadius: 16, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0F0F0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: NAVY, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <CheckCircle size={16} color={GREEN} /> Explore Demo
                </p>
                <p style={{ fontSize: 13, color: '#8A94A6' }}>Browse with sample data, replace it later</p>
              </div>
              <ArrowRight size={18} color="#C0C8D8" />
            </button>
          </div>
        )}

        {/* Step: clearing */}
        {step === 'clearing' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: `3px solid ${GREEN}`, borderTopColor: 'transparent',
              margin: '0 auto 16px',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#8A94A6', fontSize: 14 }}>Clearing demo data…</p>
          </div>
        )}

        {/* Step: name */}
        {step === 'name' && (
          <div style={{
            background: '#FAFAFA', border: '1px solid #E4E4E4',
            borderRadius: 16, padding: '28px 28px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: NAVY, marginBottom: 20 }}>Quick setup</h2>
            <form onSubmit={e => { e.preventDefault(); finish() }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="App name (optional)">
                <Input
                  placeholder="My Budget"
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Currency symbol">
                <Input
                  placeholder="$"
                  value={currencySymbol}
                  onChange={e => setCurrencySymbol(e.target.value)}
                />
              </Field>
              <Button type="submit" style={{ width: '100%', marginTop: 4 }}>
                Let's go <ArrowRight size={16} />
              </Button>
            </form>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
