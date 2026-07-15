import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, ArrowLeftRight, Activity, MessageCircle, ArrowRight, AlertTriangle, Calendar, TrendingUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { formatCurrency, currentMonth } from '../utils/formatters'
import { getMonthIncome, getMonthExpenses, getCategorySpent } from '../utils/calculations'
import { motion } from 'framer-motion'
import { transitions } from '../utils/motion'

function greeting(name: string): string {
  const h = new Date().getHours()
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return name ? `Good ${period}, ${name.split(' ')[0]}.` : `Good ${period}.`
}

function daysUntilNextPaycheck(): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOfWeek = today.getDay()
  return (5 - dayOfWeek + 7) % 7
}

interface NamePromptProps { onSave: (name: string) => void }
function NamePrompt({ onSave }: NamePromptProps) {
  const [name, setName] = useState('')
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 20,
        border: '1px solid var(--border)', padding: '40px 36px',
        width: '100%', maxWidth: 420, textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>👋</div>
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

  const activeSubs = state.subscriptions.filter(s => s.status === 'active')
  const billsMonthly = activeSubs.reduce((s, sub) =>
    s + (sub.frequency === 'monthly' ? sub.amount : sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount * 4.33), 0)
  const weeklyPaycheck = paycheckAmount / (ppm / 4)
  const weeklyBills = billsMonthly / 4
  const weeklyBudgets = state.budgets.filter(b => b.month === 'weekly')
  const weeklyAllocated = weeklyBudgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const weeklyRemaining = weeklyPaycheck - weeklyBills - weeklyAllocated
  const dayOfWeek = new Date().getDay()
  const daysLeftInWeek = 7 - dayOfWeek
  const safeToSpendToday = daysLeftInWeek > 0 ? Math.max(0, weeklyRemaining / daysLeftInWeek) : 0

  const daysToPaycheck = daysUntilNextPaycheck()

  const monthBudgets = state.budgets.filter(b => b.month === month)
  const overBudget = monthBudgets.filter(b => {
    const spent = getCategorySpent(state.transactions, b.categoryId, month)
    return spent > b.monthlyLimit
  })
  const overBudgetCat = overBudget.length > 0
    ? state.categories.find(c => c.id === overBudget[0].categoryId)
    : null

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId)

  const greetingName = (() => {
    if (activeWs?.type === 'household' && profile.myContributorId) {
      const me = activeWs.contributors.find(c => c.id === profile.myContributorId)
      if (me) return me.name
    }
    return profile.name
  })()

  // Month totals for stat row
  const monthlySpent   = getMonthExpenses(state.transactions, month)
  const monthlyIncome  = income
  const monthRemaining = monthlyIncome - billsMonthly - monthlySpent

  // Recent transactions (last 5)
  const recentTx = [...state.transactions]
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  const noName = !profile.name

  return (
    <>
      {noName && <NamePrompt onSave={name => updateProfile({ name })} />}

      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 920, margin: '0 auto', width: '100%' }}>

        {/* ── Hero + side column ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>

          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="card-surface"
            style={{ padding: '32px 36px' }}
          >
            {/* Budget badge */}
            {activeWs && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 9999,
                background: 'var(--accent)', marginBottom: 20,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-foreground)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-foreground)', letterSpacing: '0.07em' }}>
                  {activeWs.name}
                </span>
              </div>
            )}

            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>
              Safe to spend today
            </p>
            <AnimatedNumber
              value={safeToSpendToday}
              format={v => formatCurrency(v, sym)}
              className="font-display"
              style={{
                display: 'block',
                fontSize: 'clamp(44px, 6vw, 60px)', fontWeight: 700, lineHeight: 1,
                color: safeToSpendToday > 0 ? 'var(--primary)' : 'var(--destructive)',
                letterSpacing: '-0.03em', marginBottom: 10,
              }}
            />
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.55 }}>
              {greeting(greetingName)}&ensp;
              {weeklyRemaining >= 0
                ? `${formatCurrency(weeklyRemaining, sym)} left in your weekly envelope.`
                : `You're ${formatCurrency(-weeklyRemaining, sym)} over this week's envelope.`
              }
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button onClick={() => navigate('/budgets')} style={{ gap: 8 }}>
                Open budget <ArrowRight size={14} />
              </Button>
              <Button variant="secondary" onClick={() => navigate('/transactions')} style={{ gap: 8 }}>
                <ArrowLeftRight size={14} /> Transactions
              </Button>
            </div>
          </motion.div>

          {/* Side column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Next paycheck */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="card-surface"
              style={{ padding: '22px 24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'oklch(0.93 0.02 240)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={13} color="oklch(0.42 0.09 240)" />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Next paycheck
                </span>
              </div>
              <p className="font-display" style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {daysToPaycheck === 0 ? 'Today' : (
                  <AnimatedNumber value={daysToPaycheck} format={v => `${Math.round(v)}d`} />
                )}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                {paycheckAmount > 0 ? `${formatCurrency(paycheckAmount, sym)} expected` : 'Set paycheck in Settings'}
              </p>
            </motion.div>

            {/* Budget status */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="card-surface"
              style={{ padding: '22px 24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: overBudgetCat ? 'oklch(0.93 0.04 60)' : 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {overBudgetCat
                    ? <AlertTriangle size={13} color="oklch(0.50 0.12 60)" />
                    : <PieChart size={13} color="var(--accent-foreground)" />
                  }
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Budget status
                </span>
              </div>
              {overBudgetCat ? (
                <>
                  <p className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'oklch(0.50 0.12 60)', lineHeight: 1.2 }}>
                    {overBudget.length} over
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                    {overBudgetCat.icon} {overBudgetCat.name} exceeded
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>On track</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                    {monthBudgets.length > 0 ? `${monthBudgets.length} budgets within limit` : 'No budgets set yet'}
                  </p>
                </>
              )}
            </motion.div>

            {/* Analysis link */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => navigate('/analysis')}
              className="card-surface"
              style={{
                padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'transparent', fontFamily: 'inherit',
                width: '100%', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Activity size={15} color="var(--text-muted)" />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>View analysis</span>
              <ArrowRight size={13} color="var(--text-dim)" />
            </motion.button>
          </div>
        </div>

        {/* ── Stat row ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}
        >
          {[
            { label: 'Monthly income', value: formatCurrency(monthlyIncome, sym), icon: TrendingUp, color: 'oklch(0.42 0.075 155)' },
            { label: 'Spent this month', value: formatCurrency(monthlySpent, sym), icon: ArrowLeftRight, color: 'oklch(0.52 0.13 30)' },
            { label: 'Bills & subs', value: formatCurrency(billsMonthly, sym), icon: Calendar, color: 'oklch(0.46 0.10 240)' },
          ].map((stat, i) => (
            <div key={stat.label} className="card-surface" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: stat.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <stat.icon size={14} color={stat.color} />
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{stat.label}</p>
                <p className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Recent activity ───────────────────────────────────────── */}
        {recentTx.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="card-surface"
            style={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recent activity
              </p>
              <button
                onClick={() => navigate('/transactions')}
                style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                See all →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentTx.map((tx, i) => {
                const cat = state.categories.find(c => c.id === tx.categoryId)
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 10,
                    background: i % 2 === 0 ? 'transparent' : 'var(--secondary)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{cat?.icon || '•'}</span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{tx.description}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tx.date}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--destructive)' }}>
                      −{formatCurrency(tx.amount, sym)}
                    </p>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Quick links ───────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
            Jump to
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { icon: ArrowLeftRight, label: 'Transactions', to: '/transactions' },
              { icon: Activity,        label: 'Analysis',    to: '/analysis' },
              { icon: PieChart,        label: 'Budget',      to: '/budgets' },
              { icon: MessageCircle,   label: 'AI Chat',     to: '/dashboard' },
            ].map(({ icon: Icon, label, to }) => (
              <Card key={label} hover onClick={() => navigate(to)} style={{ padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
                <Icon size={18} color="var(--primary)" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</p>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
