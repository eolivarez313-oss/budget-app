import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, ArrowRight, Users, User } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/formatters'
import { Workspace } from '../types'

// Accent palette — one per budget card, cycles
const ACCENTS = [
  { dark: 'oklch(0.42 0.075 155)', light: 'oklch(0.93 0.02 155)' }, // forest green
  { dark: 'oklch(0.45 0.12 240)',  light: 'oklch(0.93 0.02 240)' }, // steel blue
  { dark: 'oklch(0.50 0.13 30)',   light: 'oklch(0.93 0.02 30)'  }, // terracotta
  { dark: 'oklch(0.42 0.09 290)',  light: 'oklch(0.93 0.02 290)' }, // plum
  { dark: 'oklch(0.48 0.10 195)',  light: 'oklch(0.93 0.02 195)' }, // teal
  { dark: 'oklch(0.52 0.12 60)',   light: 'oklch(0.93 0.02 60)'  }, // amber
]

function greeting(name: string) {
  const h = new Date().getHours()
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const first = name?.trim().split(' ')[0] ?? ''
  return first ? `Good ${period}, ${first}.` : `Good ${period}.`
}

function getPaycheck(ws: Workspace) {
  const ppm = ({ weekly: 4, biweekly: 2, 'semi-monthly': 2, monthly: 1 } as Record<string, number>)[ws.settings.payFrequency || 'biweekly'] ?? 2
  return ws.settings.paycheckAmount || (ws.settings.monthlyIncome || 0) / ppm
}

function getRemaining(ws: Workspace) {
  const ppm = ({ weekly: 4, biweekly: 2, 'semi-monthly': 2, monthly: 1 } as Record<string, number>)[ws.settings.payFrequency || 'biweekly'] ?? 2
  const paycheck = ws.settings.paycheckAmount || (ws.settings.monthlyIncome || 0) / ppm
  const billsMonthly = ws.subscriptions
    .filter(s => s.status === 'active')
    .reduce((s, sub) => s + (sub.frequency === 'monthly' ? sub.amount : sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount * 4.33), 0)
  const allocated = ws.budgets.filter(b => b.month === 'weekly').reduce((s, b) => s + b.monthlyLimit, 0)
  return paycheck - billsMonthly / ppm - allocated
}

export function Hub() {
  const { workspaces, profile, switchWorkspace } = useStore()
  const navigate = useNavigate()

  function enter(wsId: string) {
    switchWorkspace(wsId)
    navigate('/home')
  }

  const hasWorkspaces = workspaces.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <header style={{
        padding: '24px 52px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0,
        background: 'var(--background)',
        zIndex: 10,
      }}>
        <span style={{
          fontFamily: '"Fraunces", ui-serif, Georgia, serif',
          fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)',
        }}>
          Meridian
        </span>
        <button
          onClick={() => navigate('/profile')}
          style={{
            fontSize: 13, fontWeight: 500, color: 'var(--text-muted)',
            background: 'var(--secondary)', border: '1px solid var(--border)',
            borderRadius: 9999, padding: '7px 18px', cursor: 'pointer',
            fontFamily: '"Inter", system-ui, sans-serif',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
        >
          {profile.name || 'Profile'}
        </button>
      </header>

      {/* Main */}
      <main style={{ flex: 1, padding: '0 52px 80px', width: '100%', maxWidth: 1120, margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Greeting */}
        <div style={{ padding: '60px 0 52px' }}>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: '"Fraunces", ui-serif, Georgia, serif',
              fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1,
              marginBottom: 14,
            }}
          >
            {greeting(profile.name)}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 400 }}
          >
            {hasWorkspaces ? 'Where would you like to go today?' : 'Welcome — let\'s set up your first budget.'}
          </motion.p>
        </div>

        {/* Budget grid */}
        {hasWorkspaces ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {workspaces.map((ws, i) => {
              const a = ACCENTS[i % ACCENTS.length]
              const paycheck = getPaycheck(ws)
              const remaining = getRemaining(ws)
              const sym = ws.settings.currencySymbol || '$'
              return (
                <motion.div
                  key={ws.id}
                  variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } }}
                  whileHover={{ y: -5, boxShadow: '0 16px 40px rgba(30,25,20,0.10)' }}
                  onClick={() => enter(ws.id)}
                  style={{
                    background: 'var(--card)', borderRadius: 20, padding: '28px',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${a.dark}`,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(30,25,20,0.04)',
                    transition: 'box-shadow 0.2s',
                    position: 'relative', overflow: 'hidden',
                    minHeight: 220,
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Type badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 9999,
                    background: a.light, marginBottom: 14, alignSelf: 'flex-start',
                  }}>
                    {ws.type === 'household'
                      ? <Users size={10} color={a.dark} />
                      : <User size={10} color={a.dark} />}
                    <span style={{ fontSize: 10, fontWeight: 700, color: a.dark, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {ws.type}
                    </span>
                  </div>

                  {/* Name */}
                  <h2 style={{
                    fontFamily: '"Fraunces", ui-serif, Georgia, serif',
                    fontSize: 22, fontWeight: 600, color: 'var(--text)',
                    letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6,
                  }}>
                    {ws.name}
                  </h2>

                  {/* Contributors */}
                  {ws.type === 'household' && ws.contributors.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {ws.contributors.map(c => c.name).join(' · ')}
                    </p>
                  )}

                  {/* Key figure */}
                  <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                    {paycheck > 0 ? (
                      <>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                          Per paycheck
                        </p>
                        <p style={{
                          fontFamily: '"Fraunces", ui-serif, Georgia, serif',
                          fontSize: 26, fontWeight: 700, color: 'var(--text)',
                          letterSpacing: '-0.02em', lineHeight: 1,
                        }}>
                          {formatCurrency(paycheck, sym)}
                        </p>
                        {paycheck > 0 && remaining !== paycheck && (
                          <p style={{ fontSize: 11, color: remaining >= 0 ? a.dark : 'var(--destructive)', marginTop: 4 }}>
                            {remaining >= 0
                              ? `${formatCurrency(remaining, sym)} unallocated`
                              : `${formatCurrency(-remaining, sym)} over`}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add income in Settings →</p>
                    )}
                  </div>

                  {/* Arrow */}
                  <div style={{
                    position: 'absolute', bottom: 24, right: 24,
                    width: 30, height: 30, borderRadius: '50%',
                    background: a.light,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArrowRight size={13} color={a.dark} />
                  </div>
                </motion.div>
              )
            })}

            {/* Create new budget card */}
            <motion.button
              variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } }}
              whileHover={{ y: -5 }}
              onClick={() => navigate('/workspace/new')}
              style={{
                border: '2px dashed var(--border-strong)', borderRadius: 20,
                padding: '28px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: 220, gap: 14,
                background: 'transparent', fontFamily: 'inherit',
                transition: 'background 0.18s, border-color 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={22} color="var(--text-muted)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontFamily: '"Inter", system-ui, sans-serif' }}>
                  New budget
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: '"Inter", system-ui, sans-serif' }}>
                  Personal or household
                </p>
              </div>
            </motion.button>
          </motion.div>
        ) : (
          /* Zero budgets */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => navigate('/workspace/new')}
            style={{
              maxWidth: 460, border: '1px solid var(--border)', borderRadius: 24,
              padding: '56px 48px', cursor: 'pointer',
              background: 'var(--card)', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(30,25,20,0.04)',
              transition: 'box-shadow 0.2s',
            }}
            whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(30,25,20,0.08)' }}
          >
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'var(--accent)', margin: '0 auto 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={26} color="var(--accent-foreground)" />
            </div>
            <h2 style={{
              fontFamily: '"Fraunces", ui-serif, Georgia, serif',
              fontSize: 24, fontWeight: 600, color: 'var(--text)',
              letterSpacing: '-0.02em', marginBottom: 12,
            }}>
              Create your first budget
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28 }}>
              Meridian gives you a clear, steady view of your money — one budget at a time. Let's begin.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 9999,
              background: 'var(--primary)', color: 'var(--primary-foreground)',
              fontSize: 14, fontWeight: 500, fontFamily: '"Inter", system-ui, sans-serif',
            }}>
              Get started <ArrowRight size={14} />
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
