import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, ArrowUpRight, Home } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/formatters'
import { currentMonth } from '../utils/formatters'
import { Workspace } from '../types'

// ── Accent palette (border color, badge bg, badge text) ──────────────────────
const ACCENTS = [
  { border: 'oklch(0.42 0.075 155)', badgeBg: 'oklch(0.93 0.025 155)', badgeText: 'oklch(0.32 0.065 155)' }, // forest green
  { border: 'oklch(0.52 0.13 30)',   badgeBg: 'oklch(0.93 0.025 30)',  badgeText: 'oklch(0.38 0.11 30)'  }, // terracotta
  { border: 'oklch(0.46 0.10 240)',  badgeBg: 'oklch(0.93 0.018 240)', badgeText: 'oklch(0.34 0.09 240)' }, // steel blue
  { border: 'oklch(0.44 0.10 295)',  badgeBg: 'oklch(0.93 0.018 295)', badgeText: 'oklch(0.34 0.08 295)' }, // plum
  { border: 'oklch(0.55 0.13 60)',   badgeBg: 'oklch(0.94 0.028 60)',  badgeText: 'oklch(0.40 0.11 60)'  }, // amber
  { border: 'oklch(0.48 0.10 195)',  badgeBg: 'oklch(0.93 0.018 195)', badgeText: 'oklch(0.34 0.08 195)' }, // teal
]

const PPM: Record<string, number> = { weekly: 4, biweekly: 2, 'semi-monthly': 2, monthly: 1 }

const DAY_NAMES   = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
const MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                     'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']

function dateLine(): string {
  const now = new Date()
  return `${DAY_NAMES[now.getDay()]} · ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`
}

function greeting(name: string): string {
  const h   = new Date().getHours()
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const first = name?.trim().split(' ')[0] ?? ''
  return first ? `Good ${tod}, ${first}.` : `Good ${tod}.`
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface CardMeta {
  statLabel: string
  statValue: string
  footer: string
  badge: string          // badge label text
}

function getCardMeta(ws: Workspace): CardMeta {
  const ppm      = PPM[ws.settings.payFrequency || 'biweekly'] ?? 2
  const paycheck = ws.settings.paycheckAmount || (ws.settings.monthlyIncome || 0) / ppm
  const sym      = ws.settings.currencySymbol || '$'

  if (ws.type === 'household') {
    const pooled = ws.contributors.reduce((s, c) => {
      return s + c.incomeAmount * (PPM[c.payFrequency] ?? 2)
    }, 0)
    const others = ws.contributors.slice(1).map(c => c.name.split(' ')[0]).filter(Boolean)
    return {
      statLabel: 'POOLED BALANCE',
      statValue: formatCurrency(pooled, sym),
      footer:    others.length > 0 ? `Shared with ${others.join(', ')}` : 'Household budget',
      badge:     'HOUSEHOLD',
    }
  }

  // Personal — compute remaining this month
  if (paycheck > 0) {
    const monthlyIncome = paycheck * ppm
    const billsMonthly  = ws.subscriptions
      .filter(s => s.status === 'active')
      .reduce((s, sub) => s + (sub.frequency === 'monthly' ? sub.amount : sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount * 4.33), 0)
    const mon      = currentMonth()
    const budgeted = ws.budgets.filter(b => b.month === mon).reduce((s, b) => s + b.monthlyLimit, 0)
    const spent    = ws.transactions.filter(t => t.type === 'expense' && t.date.startsWith(mon)).reduce((s, t) => s + t.amount, 0)
    const remaining = monthlyIncome - billsMonthly - spent
    return {
      statLabel: 'REMAINING THIS MONTH',
      statValue: formatCurrency(Math.abs(remaining), sym),
      footer:    remaining >= 0
        ? `${formatCurrency(paycheck, sym)} paycheck`
        : `${formatCurrency(-remaining, sym)} over budget`,
      badge:     'PERSONAL',
    }
  }

  return {
    statLabel: 'BUDGET',
    statValue: '—',
    footer:    'Add income in Settings',
    badge:     'PERSONAL',
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface BudgetCardProps {
  ws:       Workspace
  accent:   typeof ACCENTS[number]
  featured: boolean
  onEnter:  () => void
}

function BudgetCard({ ws, accent, featured, onEnter }: BudgetCardProps) {
  const meta = getCardMeta(ws)

  return (
    <motion.div
      onClick={onEnter}
      whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(30,25,20,0.09)' }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        gridColumn: featured ? '1 / 3' : undefined,
        background: featured ? `oklch(from ${accent.border} calc(l + 0.56) calc(c * 0.08) h / 1)` : 'var(--card)',
        border:     '1px solid var(--border)',
        borderLeft: `4px solid ${accent.border}`,
        borderRadius: 18,
        padding: featured ? '28px 32px 26px' : '22px 24px 20px',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(30,25,20,0.04)',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        minHeight: featured ? 220 : 180,
        overflow: 'hidden',
      }}
    >
      {/* Top row: badge + MOST RECENT */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 10px', borderRadius: 9999,
          background: accent.badgeBg,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: accent.badgeText, letterSpacing: '0.09em' }}>
            {meta.badge}
          </span>
        </div>

        {/* Most recent tag */}
        {featured && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.06em', fontWeight: 500 }}>
              ≈ MOST RECENT
            </span>
          </div>
        )}
      </div>

      {/* Budget name */}
      <h2 style={{
        fontFamily: '"Fraunces", ui-serif, Georgia, serif',
        fontSize: featured ? 26 : 20,
        fontWeight: 600, color: 'var(--text)',
        letterSpacing: '-0.02em', lineHeight: 1.2,
        marginBottom: 18,
      }}>
        {ws.name}
      </h2>

      {/* Contributors (household only) */}
      {ws.type === 'household' && ws.contributors.length > 1 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, marginTop: -10 }}>
          {ws.contributors.map(c => c.name.split(' ')[0]).join(' + ')}
        </p>
      )}

      {/* Stat */}
      <div style={{ marginTop: 'auto' }}>
        <p style={{
          fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5,
        }}>
          {meta.statLabel}
        </p>
        <p style={{
          fontFamily: '"Fraunces", ui-serif, Georgia, serif',
          fontSize: featured ? 34 : 26,
          fontWeight: 700, color: 'var(--text)',
          letterSpacing: '-0.025em', lineHeight: 1,
        }}>
          {meta.statValue}
        </p>
      </div>

      {/* Footer row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {featured ? `Last opened · ${timeAgo(ws.createdAt)}` : meta.footer}
        </p>

        {/* Arrow button */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: accent.badgeBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ArrowUpRight size={13} color={accent.border} />
        </div>
      </div>
    </motion.div>
  )
}

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3, background: 'var(--secondary)' }}
      transition={{ duration: 0.18 }}
      style={{
        border: '1.5px dashed var(--border-strong)',
        borderRadius: 18, padding: '28px 24px',
        cursor: 'pointer', background: 'transparent', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: 160, gap: 12,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Plus size={18} color="var(--text-muted)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3, fontFamily: '"Inter", system-ui, sans-serif' }}>
          Create new budget
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: '"Inter", system-ui, sans-serif' }}>
          Envelope, goal, or shared pool
        </p>
      </div>
    </motion.button>
  )
}

// ── Main Hub component ────────────────────────────────────────────────────────

export function Hub() {
  const { workspaces, activeWorkspaceId, profile, switchWorkspace } = useStore()
  const navigate = useNavigate()

  // Active workspace always first (featured)
  const sorted = [
    ...workspaces.filter(w => w.id === activeWorkspaceId),
    ...workspaces.filter(w => w.id !== activeWorkspaceId),
  ]

  const hasWorkspaces = sorted.length > 0

  function enter(wsId: string) {
    switchWorkspace(wsId)
    navigate('/home')
  }

  const initial = profile.name?.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={{
        padding: '20px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, background: 'var(--background)', zIndex: 10,
      }}>
        {/* Wordmark + HUB tag */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: '"Fraunces", ui-serif, Georgia, serif',
            fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)',
          }}>
            Meridian
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'var(--text-dim)',
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            · HUB
          </span>
        </div>

        {/* Profile pill */}
        <button
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px 6px 8px', borderRadius: 9999,
            background: 'var(--secondary)', border: '1px solid var(--border)',
            cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: ACCENTS[0].badgeBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: ACCENTS[0].badgeText,
          }}>
            {initial}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            {profile.name?.split(' ')[0] || 'Profile'}
          </span>
        </button>
      </header>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, padding: '52px 48px 80px',
        width: '100%', maxWidth: 1120, margin: '0 auto', boxSizing: 'border-box',
      }}>

        {/* Date + Greeting */}
        <div style={{ marginBottom: 52 }}>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            {dateLine()}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: '"Fraunces", ui-serif, Georgia, serif',
              fontSize: 'clamp(38px, 5.5vw, 56px)', fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.08,
              marginBottom: 14,
            }}
          >
            {greeting(profile.name)}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 480 }}
          >
            {hasWorkspaces ? (
              <>
                Choose a place to land. Each budget is{' '}
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--text)' }}>its own small world</em>;
                {' '}open one to see today in detail.
              </>
            ) : (
              <>Welcome to Meridian. Create your first budget to begin.</>
            )}
          </motion.p>
        </div>

        {/* ── Budget grid ─────────────────────────────────────────── */}
        {hasWorkspaces ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 18,
            }}
          >
            {sorted.map((ws, i) => (
              <motion.div
                key={ws.id}
                style={{ gridColumn: i === 0 ? '1 / 3' : undefined }}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                <BudgetCard
                  ws={ws}
                  accent={ACCENTS[i % ACCENTS.length]}
                  featured={i === 0}
                  onEnter={() => enter(ws.id)}
                />
              </motion.div>
            ))}

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <CreateCard onClick={() => navigate('/workspace/new')} />
            </motion.div>
          </motion.div>
        ) : (
          /* ── Empty state ─────────────────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: 440 }}
          >
            <div
              onClick={() => navigate('/workspace/new')}
              style={{
                border: '1px solid var(--border)', borderRadius: 20,
                padding: '52px 44px', cursor: 'pointer',
                background: 'var(--card)', textAlign: 'center',
                boxShadow: '0 1px 3px rgba(30,25,20,0.04)',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: ACCENTS[0].badgeBg, margin: '0 auto 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={24} color={ACCENTS[0].border} />
              </div>
              <h2 style={{
                fontFamily: '"Fraunces", ui-serif, Georgia, serif',
                fontSize: 22, fontWeight: 600, color: 'var(--text)',
                letterSpacing: '-0.02em', marginBottom: 10,
              }}>
                Create your first budget
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 26 }}>
                Meridian gives you a clear, steady view of your money — one budget at a time.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 22px', borderRadius: 9999,
                background: 'var(--primary)', color: 'var(--primary-foreground)',
                fontSize: 13, fontWeight: 500,
              }}>
                Get started <ArrowUpRight size={14} />
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ── Footer slogan ────────────────────────────────────────────── */}
      <footer style={{ padding: '24px 48px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <p style={{
          fontSize: 9, fontWeight: 700, color: 'var(--text-dim)',
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>
          Meridian · a calmer way to spend
        </p>
      </footer>
    </div>
  )
}
