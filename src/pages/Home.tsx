import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, ArrowLeftRight, Activity, MessageCircle, ArrowRight, AlertTriangle, Calendar, Wallet, LayoutDashboard } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Field } from '../components/ui/Input'
import { formatCurrency, currentMonth } from '../utils/formatters'
import { getMonthIncome, getMonthExpenses, getCategorySpent } from '../utils/calculations'

const ACCENT = 'var(--accent)'

const SUBLINES = [
  "Here's where things stand.",
  "Ready when you are.",
  "Let's get to it.",
  "Your numbers at a glance.",
  "Take a look.",
  "Let's see what's going on.",
]

function greeting(name: string): string {
  const h = new Date().getHours()
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return name ? `Good ${period}, ${name.split(' ')[0]}.` : `Good ${period}.`
}

// Stable subline per day (rotates daily, not randomly on every render)
function dailySubline(): string {
  const dayIndex = new Date().getDay()
  return SUBLINES[dayIndex % SUBLINES.length]
}

// Paychecks land every Friday. Returns 0 if today is Friday.
function daysUntilNextPaycheck(): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOfWeek = today.getDay() // 0=Sun … 5=Fri … 6=Sat
  return (5 - dayOfWeek + 7) % 7   // 0 on Friday, 6 on Saturday, 5 on Sunday, …
}

interface NamePromptProps {
  onSave: (name: string) => void
}

function NamePrompt({ onSave }: NamePromptProps) {
  const [name, setName] = useState('')
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--elevated)', borderRadius: 20,
        border: '1px solid var(--border)', padding: '40px 36px',
        width: '100%', maxWidth: 420, textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>👋</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          What should we call you?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.5 }}>
          We'll use your name for the greeting on the home screen.
        </p>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }}>
          <Input
            placeholder="Your first name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ textAlign: 'center', fontSize: 16, marginBottom: 16 }}
            autoFocus
          />
          <Button type="submit" disabled={!name.trim()} style={{ width: '100%', padding: '12px', fontSize: 14 }}>
            Let's go <ArrowRight size={15} />
          </Button>
        </form>
      </div>
    </div>
  )
}

export function Home() {
  const { state, profile, workspaces, activeWorkspaceId, updateProfile } = useStore()
  const navigate = useNavigate()
  const sym = state.settings.currencySymbol

  const month = currentMonth()
  const txIncome = getMonthIncome(state.transactions, month)
  const income = state.settings.monthlyIncome || txIncome

  const payFrequency = state.settings.payFrequency || 'biweekly'
  const ppmMap: Record<string, number> = { weekly: 4, biweekly: 2, 'semi-monthly': 2, monthly: 1 }
  const ppm = ppmMap[payFrequency] ?? 2
  const paycheckAmount = state.settings.paycheckAmount || (income > 0 ? income / ppm : 0)

  // Safe to spend today = remaining budget / days left in week
  const activeSubs = state.subscriptions.filter(s => s.status === 'active')
  const billsMonthly = activeSubs.reduce((s, sub) =>
    s + (sub.frequency === 'monthly' ? sub.amount : sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount * 4.33), 0)
  const weeklyPaycheck = paycheckAmount / (ppm / 4) // normalize to weekly
  const weeklyBills = billsMonthly / 4
  const weeklyBudgets = state.budgets.filter(b => b.month === 'weekly')
  const weeklyAllocated = weeklyBudgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const weeklyRemaining = weeklyPaycheck - weeklyBills - weeklyAllocated
  const dayOfWeek = new Date().getDay() // 0=Sun ... 6=Sat
  const daysLeftInWeek = 7 - dayOfWeek
  const safeToSpendToday = daysLeftInWeek > 0 ? Math.max(0, weeklyRemaining / daysLeftInWeek) : 0

  const daysToPaycheck = daysUntilNextPaycheck()

  // Over-budget categories this month
  const monthBudgets = state.budgets.filter(b => b.month === month)
  const overBudget = monthBudgets.filter(b => {
    const spent = getCategorySpent(state.transactions, b.categoryId, month)
    return spent > b.monthlyLimit
  })
  const overBudgetCat = overBudget.length > 0
    ? state.categories.find(c => c.id === overBudget[0].categoryId)
    : null

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId)

  // Resolve whose name to show: for household workspaces use the contributor marked as "me",
  // otherwise fall back to the profile name (personal budget or no contributor selected).
  const greetingName = (() => {
    if (activeWs?.type === 'household' && profile.myContributorId) {
      const me = activeWs.contributors.find(c => c.id === profile.myContributorId)
      if (me) return me.name
    }
    return profile.name
  })()

  const noName = !profile.name

  return (
    <>
      {noName && <NamePrompt onSave={name => updateProfile({ name })} />}

      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 860, margin: '0 auto', width: '100%' }}>

        {/* Greeting */}
        <div>
          {activeWs && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 20,
              background: 'var(--accent-dim)', border: '1px solid rgba(6,198,138,0.2)',
              marginBottom: 14,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, letterSpacing: '0.04em' }}>
                {activeWs.name}
              </span>
            </div>
          )}
          <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            {greeting(greetingName)}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
            {dailySubline()}
          </p>
        </div>

        {/* Snapshot row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {/* Safe to spend */}
          <Card style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={14} color={ACCENT} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Safe to spend today
              </span>
            </div>
            <p style={{ fontSize: 30, fontWeight: 700, color: safeToSpendToday > 0 ? ACCENT : 'var(--danger)', letterSpacing: '-0.5px', lineHeight: 1 }}>
              {formatCurrency(safeToSpendToday, sym)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              {weeklyRemaining >= 0 ? `${formatCurrency(weeklyRemaining, sym)} left this week` : 'Over weekly budget'}
            </p>
          </Card>

          {/* Days to paycheck */}
          <Card style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--info-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={14} color="var(--info)" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Next paycheck
              </span>
            </div>
            <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 }}>
              {daysToPaycheck === 0 ? 'Today' : `${daysToPaycheck}d`}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              {paycheckAmount > 0 ? `${formatCurrency(paycheckAmount, sym)} expected` : 'Set paycheck in Settings'}
            </p>
          </Card>

          {/* Budget status */}
          <Card style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: overBudgetCat ? 'var(--warning-dim)' : 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {overBudgetCat
                  ? <AlertTriangle size={14} color="var(--warning)" />
                  : <PieChart size={14} color={ACCENT} />
                }
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Budget status
              </span>
            </div>
            {overBudgetCat ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--warning)', lineHeight: 1.2 }}>
                  {overBudget.length} {overBudget.length === 1 ? 'category' : 'categories'} over
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  {overBudgetCat.icon} {overBudgetCat.name} exceeded this month
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 22, fontWeight: 700, color: ACCENT, lineHeight: 1.2 }}>On track</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  {monthBudgets.length > 0 ? `All ${monthBudgets.length} budgets within limit` : 'No budgets set yet'}
                </p>
              </>
            )}
          </Card>
        </div>

        {/* Primary CTA */}
        <Card style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                View your budget
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Allocate your {paycheckAmount > 0 ? formatCurrency(paycheckAmount, sym) : ''} paycheck across categories.
              </p>
            </div>
            <Button onClick={() => navigate('/budgets')} style={{ gap: 8 }}>
              Open budget <ArrowRight size={14} />
            </Button>
          </div>
        </Card>

        {/* Quick links */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            Jump to
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { icon: ArrowLeftRight, label: 'Transactions', to: '/transactions' },
              { icon: Activity,       label: 'Analysis',     to: '/analysis' },
              { icon: LayoutDashboard, label: 'Dashboard',  to: '/dashboard' },
              { icon: MessageCircle,  label: 'AI Chat',     action: 'chat' },
            ].map(({ icon: Icon, label, to, action }) => (
              <Card
                key={label}
                hover
                onClick={() => { if (to) navigate(to) }}
                style={{ padding: '16px', textAlign: 'center', cursor: 'pointer' }}
              >
                <Icon size={20} color={ACCENT} style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</p>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}

