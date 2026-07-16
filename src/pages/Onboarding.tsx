import { useState, useEffect } from 'react'
import { Check, Plus, X, ChevronRight, ArrowLeft } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuth } from '../lib/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { uuid } from '../utils/uuid'
import { currentMonth } from '../utils/formatters'
import { Category, Subscription, Budget, Goal, WorkDay } from '../types'

// ── Constants ──────────────────────────────────────────────────────────────

const DRAFT_KEY = 'meridian_onboarding_v2'
const TOTAL_STEPS = 8

const ALL_DAYS: WorkDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DEFAULT_WORK_DAYS: WorkDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const STARTER_CATEGORIES = [
  { name: 'Groceries',      icon: '🛒', color: 'oklch(0.62 0.15 145)' },
  { name: 'Dining Out',     icon: '🍽️', color: 'oklch(0.65 0.18 40)'  },
  { name: 'Transportation', icon: '🚗', color: 'oklch(0.60 0.14 255)' },
  { name: 'Entertainment',  icon: '🎬', color: 'oklch(0.58 0.16 290)' },
  { name: 'Shopping',       icon: '🛍️', color: 'oklch(0.63 0.17 330)' },
  { name: 'Health',         icon: '💪', color: 'oklch(0.60 0.14 165)' },
  { name: 'Coffee',         icon: '☕', color: 'oklch(0.60 0.12 55)'  },
]

const BILL_PRESETS = [
  { name: 'Rent / Mortgage', icon: '🏠' },
  { name: 'Utilities',       icon: '⚡' },
  { name: 'Phone',           icon: '📱' },
  { name: 'Internet',        icon: '🌐' },
  { name: 'Insurance',       icon: '🛡️' },
  { name: 'Streaming',       icon: '📺' },
]

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
}

// ── Draft type ─────────────────────────────────────────────────────────────

interface DraftBill {
  id: string
  name: string
  amount: string
  frequency: 'weekly' | 'monthly' | 'yearly'
  icon: string
}

interface DraftCategory {
  id: string
  name: string
  icon: string
  color: string
  selected: boolean
}

interface OnboardingDraft {
  step: number
  firstName: string
  budgetType: 'personal' | 'household'
  hourlyRate: string
  workDays: WorkDay[]
  hoursPerDay: string
  payFrequency: 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly'
  paycheckDay: string
  bills: DraftBill[]
  categories: DraftCategory[]
  allocations: Record<string, string>
  goalName: string
  goalAmount: string
  goalDate: string
  goalSkipped: boolean
}

function freshDraft(): OnboardingDraft {
  return {
    step: 1, firstName: '', budgetType: 'personal',
    hourlyRate: '', workDays: [...DEFAULT_WORK_DAYS], hoursPerDay: '8',
    payFrequency: 'biweekly', paycheckDay: 'Fri',
    bills: [],
    categories: STARTER_CATEGORIES.map(c => ({ ...c, id: uuid(), selected: true })),
    allocations: {}, goalName: '', goalAmount: '', goalDate: '', goalSkipped: false,
  }
}

function loadDraft(): OnboardingDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return { ...freshDraft(), ...JSON.parse(raw) }
  } catch {}
  return freshDraft()
}

function saveDraftToStorage(draft: OnboardingDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch {}
}

// ── Helpers ────────────────────────────────────────────────────────────────

function monthlyFromBill(b: DraftBill): number {
  const amt = parseFloat(b.amount) || 0
  if (b.frequency === 'weekly')  return amt * 52 / 12
  if (b.frequency === 'yearly')  return amt / 12
  return amt
}

function computeMonthlyIncome(draft: OnboardingDraft): number {
  const rate = parseFloat(draft.hourlyRate) || 0
  const hours = parseFloat(draft.hoursPerDay) || 8
  const days = draft.workDays.length
  return rate * hours * days * 52 / 12
}

function evenSplit(categories: DraftCategory[], remaining: number): Record<string, string> {
  const selected = categories.filter(c => c.selected)
  if (!selected.length) return {}
  const each = Math.max(0, Math.floor(remaining / selected.length))
  const result: Record<string, string> = {}
  selected.forEach(c => { result[c.id] = String(each) })
  return result
}

// ── Shared UI ──────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ width: '100%', marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Step {step} of {TOTAL_STEPS}
        </span>
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
          {Math.round((step / TOTAL_STEPS) * 100)}%
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--secondary)', borderRadius: 99 }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'var(--primary)',
          width: `${(step / TOTAL_STEPS) * 100}%`,
          transition: 'width 0.4s var(--ease-out)',
        }} />
      </div>
    </div>
  )
}

function LiteracyTip({ children }: { children: string }) {
  return (
    <div style={{
      background: 'var(--accent)', borderRadius: 'var(--r-md)',
      padding: '10px 14px', marginBottom: 20,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
      <p style={{ fontSize: 'var(--text-label)', color: 'var(--accent-foreground)', lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  )
}

function NavButtons({
  onBack, onNext, onSkip, nextLabel = 'Continue', nextDisabled = false, isLast = false,
}: {
  onBack?: () => void; onNext: () => void; onSkip?: () => void
  nextLabel?: string; nextDisabled?: boolean; isLast?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28 }}>
      {onBack && (
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 'var(--text-label)', padding: '8px 0',
        }}>
          <ArrowLeft size={14} /> Back
        </button>
      )}
      <div style={{ flex: 1 }} />
      {onSkip && (
        <button onClick={onSkip} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 'var(--text-label)', padding: '8px 12px',
        }}>
          Skip for now
        </button>
      )}
      <Button onClick={onNext} disabled={nextDisabled} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {nextLabel}
        {!isLast && <ChevronRight size={14} />}
      </Button>
    </div>
  )
}

// ── Step 1: Welcome & Name ─────────────────────────────────────────────────

function Step1({ draft, setDraft }: { draft: OnboardingDraft; setDraft: (d: OnboardingDraft) => void }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <span style={{ fontFamily: '"Fraunces", serif', fontSize: 24, fontWeight: 700, color: 'var(--accent-foreground)', letterSpacing: '-0.03em' }}>M</span>
        </div>
        <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 8 }}>
          Welcome to Meridian
        </h2>
        <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Let's get you set up in about 3 minutes. You can skip anything and come back later.
        </p>
      </div>

      <LiteracyTip>A budget that reflects how you actually live is one you'll stick to.</LiteracyTip>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            First name
          </label>
          <Input
            autoFocus
            placeholder="What should we call you?"
            value={draft.firstName}
            onChange={e => setDraft({ ...draft, firstName: e.target.value })}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Budget type
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['personal', 'household'] as const).map(type => (
              <button key={type} onClick={() => setDraft({ ...draft, budgetType: type })} style={{
                padding: '14px 12px', borderRadius: 'var(--r-lg)', textAlign: 'left',
                border: `2px solid ${draft.budgetType === type ? 'var(--primary)' : 'var(--border)'}`,
                background: draft.budgetType === type ? 'var(--accent)' : 'var(--card)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{type === 'personal' ? '👤' : '👥'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{type}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {type === 'personal' ? 'Just me' : 'Shared with others'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Income & Schedule ──────────────────────────────────────────────

function Step2({ draft, setDraft }: { draft: OnboardingDraft; setDraft: (d: OnboardingDraft) => void }) {
  function toggleDay(day: WorkDay) {
    const days = draft.workDays.includes(day)
      ? draft.workDays.filter(d => d !== day)
      : [...draft.workDays, day]
    setDraft({ ...draft, workDays: days })
  }

  return (
    <div>
      <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
        Your income
      </h2>
      <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        This powers your daily earnings tracker — so you can see what each day is worth.
      </p>

      <LiteracyTip>Seeing earnings in hours worked (not just dollars) makes every purchase more tangible.</LiteracyTip>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Hourly pay rate
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none' }}>$</span>
            <Input
              type="number" min="0" step="0.01"
              placeholder="25.00"
              value={draft.hourlyRate}
              onChange={e => setDraft({ ...draft, hourlyRate: e.target.value })}
              style={{ paddingLeft: 26 }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Days you typically work
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_DAYS.map(day => {
              const active = draft.workDays.includes(day)
              return (
                <button key={day} onClick={() => toggleDay(day)} style={{
                  padding: '8px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-foreground)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>{day}</button>
              )
            })}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Hours per work day
          </label>
          <Input
            type="number" min="1" max="24" step="0.5"
            value={draft.hoursPerDay}
            onChange={e => setDraft({ ...draft, hoursPerDay: e.target.value })}
          />
        </div>

        {parseFloat(draft.hourlyRate) > 0 && (
          <div style={{ background: 'var(--secondary)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
            <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
              Estimated monthly income:{' '}
              <strong style={{ color: 'var(--text)' }}>
                ${computeMonthlyIncome(draft).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </strong>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 3: Pay Cycle ──────────────────────────────────────────────────────

const PAYDAY_OPTIONS: Record<string, string[]> = {
  weekly:       ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  biweekly:     ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  'semi-monthly': ['1', '15'],
  monthly:      Array.from({ length: 28 }, (_, i) => String(i + 1)),
}

const FREQ_OPTIONS = [
  { value: 'weekly',       label: 'Weekly',       sub: 'Every week' },
  { value: 'biweekly',     label: 'Every 2 weeks', sub: 'Most common' },
  { value: 'semi-monthly', label: 'Twice a month', sub: '1st & 15th etc.' },
  { value: 'monthly',      label: 'Monthly',       sub: 'Once a month' },
]

function Step3({ draft, setDraft }: { draft: OnboardingDraft; setDraft: (d: OnboardingDraft) => void }) {
  const paydays = PAYDAY_OPTIONS[draft.payFrequency]

  function setFreq(freq: OnboardingDraft['payFrequency']) {
    const firstOption = PAYDAY_OPTIONS[freq][0]
    setDraft({ ...draft, payFrequency: freq, paycheckDay: firstOption })
  }

  return (
    <div>
      <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
        When do you get paid?
      </h2>
      <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Your pay cycle determines how we structure your weekly budget resets.
      </p>

      <LiteracyTip>Aligning your budget to your paycheck cycle means money is always accounted for before it arrives.</LiteracyTip>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Pay frequency
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {FREQ_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setFreq(opt.value as any)} style={{
                padding: '12px', borderRadius: 'var(--r-md)', textAlign: 'left',
                border: `2px solid ${draft.payFrequency === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                background: draft.payFrequency === opt.value ? 'var(--accent)' : 'var(--card)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Payday
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {paydays.map(day => (
              <button key={day} onClick={() => setDraft({ ...draft, paycheckDay: day })} style={{
                padding: '8px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${draft.paycheckDay === day ? 'var(--primary)' : 'var(--border)'}`,
                background: draft.paycheckDay === day ? 'var(--accent)' : 'transparent',
                color: draft.paycheckDay === day ? 'var(--accent-foreground)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}>
                {['semi-monthly', 'monthly'].includes(draft.payFrequency) ? `${day}${day === '1' ? 'st' : day === '2' ? 'nd' : day === '3' ? 'rd' : 'th'}` : day}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Bills ──────────────────────────────────────────────────────────

function Step4({ draft, setDraft }: { draft: OnboardingDraft; setDraft: (d: OnboardingDraft) => void }) {
  function addPreset(preset: typeof BILL_PRESETS[0]) {
    const exists = draft.bills.some(b => b.name === preset.name)
    if (exists) return
    setDraft({ ...draft, bills: [...draft.bills, { id: uuid(), name: preset.name, amount: '', frequency: 'monthly', icon: preset.icon }] })
  }

  function addBlank() {
    setDraft({ ...draft, bills: [...draft.bills, { id: uuid(), name: '', amount: '', frequency: 'monthly', icon: '💳' }] })
  }

  function updateBill(id: string, field: keyof DraftBill, value: string) {
    setDraft({ ...draft, bills: draft.bills.map(b => b.id === id ? { ...b, [field]: value } : b) })
  }

  function removeBill(id: string) {
    setDraft({ ...draft, bills: draft.bills.filter(b => b.id !== id) })
  }

  const billsTotal = draft.bills.reduce((s, b) => s + monthlyFromBill(b), 0)

  return (
    <div>
      <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
        Recurring bills
      </h2>
      <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Add your fixed monthly expenses. You can always add more from the Bills section later.
      </p>

      <LiteracyTip>Fixed costs are the foundation of every budget — knowing this number first makes everything else easier to plan around.</LiteracyTip>

      {/* Quick-add presets */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Quick add</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BILL_PRESETS.map(p => (
            <button key={p.name} onClick={() => addPreset(p)} style={{
              padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
              border: '1.5px solid var(--border)', background: 'var(--card)',
              color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--card)' }}
            >
              {p.icon} {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bill list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
        {draft.bills.map(b => (
          <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{b.icon}</span>
            <input
              placeholder="Bill name"
              value={b.name}
              onChange={e => updateBill(b.id, 'name', e.target.value)}
              style={{ flex: 2, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', minWidth: 0 }}
            />
            <div style={{ position: 'relative', flexShrink: 0, width: 80 }}>
              <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }}>$</span>
              <input
                type="number" min="0" placeholder="0"
                value={b.amount}
                onChange={e => updateBill(b.id, 'amount', e.target.value)}
                style={{ width: '100%', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px 5px 18px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <select
              value={b.frequency}
              onChange={e => updateBill(b.id, 'frequency', e.target.value)}
              style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', fontSize: 11, color: 'var(--text-muted)', outline: 'none', flexShrink: 0 }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <button onClick={() => removeBill(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, display: 'flex', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addBlank} style={{
        width: '100%', marginTop: 8, padding: '10px', borderRadius: 'var(--r-md)',
        border: '1.5px dashed var(--border)', background: 'transparent',
        color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'border-color 0.12s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
      >
        <Plus size={14} /> Add another bill
      </button>

      {billsTotal > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--secondary)', borderRadius: 'var(--r-md)' }}>
          <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
            Monthly bills total: <strong style={{ color: 'var(--text)' }}>${billsTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
          </p>
        </div>
      )}
    </div>
  )
}

// ── Step 5: Categories ─────────────────────────────────────────────────────

function Step5({ draft, setDraft }: { draft: OnboardingDraft; setDraft: (d: OnboardingDraft) => void }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  function toggleCat(id: string) {
    setDraft({ ...draft, categories: draft.categories.map(c => c.id === id ? { ...c, selected: !c.selected } : c) })
  }

  function addCustom() {
    if (!newName.trim()) return
    setDraft({ ...draft, categories: [...draft.categories, { id: uuid(), name: newName.trim(), icon: '📌', color: 'oklch(0.55 0.12 240)', selected: true }] })
    setNewName(''); setAdding(false)
  }

  return (
    <div>
      <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
        Spending categories
      </h2>
      <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Choose which categories to track. You can add, rename, or remove any of these later.
      </p>

      <LiteracyTip>Categories turn your bank statement into a story — you'll see patterns you didn't know existed.</LiteracyTip>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {draft.categories.map(cat => (
          <button key={cat.id} onClick={() => toggleCat(cat.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            border: `2px solid ${cat.selected ? 'var(--primary)' : 'var(--border)'}`,
            background: cat.selected ? 'var(--accent)' : 'var(--card)',
            cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{cat.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{cat.name}</span>
            {cat.selected && <Check size={15} color="var(--primary)" />}
          </button>
        ))}

        {adding ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Input autoFocus placeholder="Category name" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
            />
            <Button size="sm" onClick={addCustom}>Add</Button>
            <Button size="sm" variant="secondary" onClick={() => { setAdding(false); setNewName('') }}>Cancel</Button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{
            padding: '10px', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--border)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Plus size={14} /> Add a category
          </button>
        )}
      </div>
    </div>
  )
}

// ── Step 6: Budget Allocation ──────────────────────────────────────────────

function Step6({ draft, setDraft }: { draft: OnboardingDraft; setDraft: (d: OnboardingDraft) => void }) {
  const monthly = computeMonthlyIncome(draft)
  const billsTotal = draft.bills.reduce((s, b) => s + monthlyFromBill(b), 0)
  const remaining = Math.max(0, monthly - billsTotal)
  const selected = draft.categories.filter(c => c.selected)

  const totalAllocated = selected.reduce((s, c) => s + (parseFloat(draft.allocations[c.id] ?? '0') || 0), 0)
  const leftover = remaining - totalAllocated

  useEffect(() => {
    if (selected.length > 0 && Object.keys(draft.allocations).length === 0) {
      setDraft({ ...draft, allocations: evenSplit(draft.categories, remaining) })
    }
  }, [])

  return (
    <div>
      <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
        Your first budget
      </h2>
      <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Here's a suggested split based on your income and bills. Adjust to match your life.
      </p>

      <LiteracyTip>The 50/30/20 rule is a starting point — what matters is a budget you'll actually follow.</LiteracyTip>

      {/* Summary bar */}
      <div style={{ background: 'var(--secondary)', borderRadius: 'var(--r-md)', padding: '14px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
          {[
            { label: 'Monthly income', value: monthly, color: 'var(--success)' },
            { label: 'Fixed bills', value: billsTotal, color: 'var(--danger)' },
            { label: 'Available', value: remaining, color: 'var(--primary)' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                ${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected.length === 0 ? (
        <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
          Go back to Step 5 to select at least one category.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selected.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, width: 24 }}>{cat.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
              <div style={{ position: 'relative', width: 90, flexShrink: 0 }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }}>$</span>
                <input
                  type="number" min="0"
                  value={draft.allocations[cat.id] ?? ''}
                  onChange={e => setDraft({ ...draft, allocations: { ...draft.allocations, [cat.id]: e.target.value } })}
                  style={{ width: '100%', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px 7px 22px', fontSize: 13, color: 'var(--text)', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unallocated</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: leftover >= 0 ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
              {leftover >= 0 ? '+' : ''}{leftover < 0 ? '-' : ''}${Math.abs(leftover).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 7: Goal ───────────────────────────────────────────────────────────

function Step7({ draft, setDraft }: { draft: OnboardingDraft; setDraft: (d: OnboardingDraft) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>
          A savings goal
        </h2>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--secondary)', padding: '3px 8px', borderRadius: 99, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
          Optional
        </span>
      </div>
      <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Set a target to work toward. You can skip this and add goals anytime from the Goals section.
      </p>

      <LiteracyTip>People with a specific savings goal save 3× more than those without one — even a rough target helps.</LiteracyTip>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            What are you saving for?
          </label>
          <Input placeholder="e.g. Emergency fund, Vacation, New laptop…"
            value={draft.goalName} onChange={e => setDraft({ ...draft, goalName: e.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Target amount
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none' }}>$</span>
            <Input type="number" min="0" placeholder="1,000"
              value={draft.goalAmount} onChange={e => setDraft({ ...draft, goalAmount: e.target.value })}
              style={{ paddingLeft: 26 }} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Target date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <Input type="date" value={draft.goalDate} onChange={e => setDraft({ ...draft, goalDate: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

// ── Step 8: Summary ────────────────────────────────────────────────────────

function Step8({ draft }: { draft: OnboardingDraft }) {
  const monthly = computeMonthlyIncome(draft)
  const billsTotal = draft.bills.reduce((s, b) => s + monthlyFromBill(b), 0)
  const selectedCats = draft.categories.filter(c => c.selected)
  const totalAllocated = selectedCats.reduce((s, c) => s + (parseFloat(draft.allocations[c.id] ?? '0') || 0), 0)

  const items = [
    { label: 'Name', value: draft.firstName || '—' },
    { label: 'Budget type', value: draft.budgetType === 'personal' ? 'Personal' : 'Household' },
    { label: 'Monthly income', value: monthly > 0 ? `$${monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—' },
    { label: 'Pay schedule', value: `${draft.workDays.join(', ')} · ${parseFloat(draft.hoursPerDay) || 0}h/day at $${parseFloat(draft.hourlyRate) || 0}/hr` },
    { label: 'Pay frequency', value: FREQ_OPTIONS.find(f => f.value === draft.payFrequency)?.label ?? '—' },
    { label: 'Monthly bills', value: billsTotal > 0 ? `$${billsTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${draft.bills.length} bill${draft.bills.length !== 1 ? 's' : ''})` : 'None added' },
    { label: 'Categories', value: selectedCats.length > 0 ? selectedCats.map(c => c.name).join(', ') : 'None' },
    { label: 'Budget allocated', value: totalAllocated > 0 ? `$${totalAllocated.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo` : '—' },
    { label: 'Savings goal', value: draft.goalName && draft.goalAmount ? `${draft.goalName} · $${parseFloat(draft.goalAmount).toLocaleString()}` : 'None set' },
  ]

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 6 }}>
          You're all set{draft.firstName ? `, ${draft.firstName}` : ''}!
        </h2>
        <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Here's a summary of your setup. You can change any of this later.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', background: 'var(--card)', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Onboarding ─────────────────────────────────────────────────────────

interface OnboardingProps { onComplete: () => void }

export function Onboarding({ onComplete }: OnboardingProps) {
  const { dispatch } = useStore()
  const { user } = useAuth()
  const [draft, _setDraft] = useState<OnboardingDraft>(loadDraft)

  function setDraft(d: OnboardingDraft) {
    _setDraft(d)
    saveDraftToStorage(d)
  }

  function next() { setDraft({ ...draft, step: Math.min(draft.step + 1, TOTAL_STEPS) }) }
  function back() { setDraft({ ...draft, step: Math.max(draft.step - 1, 1) }) }

  async function finish() {
    const monthly = computeMonthlyIncome(draft)
    const billsTotal = draft.bills.reduce((s, b) => s + monthlyFromBill(b), 0)

    // 1. Profile name
    if (draft.firstName) {
      dispatch({ type: 'UPDATE_PROFILE', payload: { name: draft.firstName } })
    }

    // 2. Settings
    dispatch({
      type: 'UPDATE_SETTINGS', payload: {
        name: draft.firstName || 'My Budget',
        monthlyIncome: monthly || undefined,
        payFrequency: draft.payFrequency,
        paycheckDay: draft.paycheckDay,
        hourlyRate: parseFloat(draft.hourlyRate) || undefined,
        workDays: draft.workDays.length > 0 ? draft.workDays : undefined,
        hoursPerDay: parseFloat(draft.hoursPerDay) || undefined,
        paycheckAmount: draft.payFrequency === 'biweekly'
          ? monthly * 12 / 26
          : draft.payFrequency === 'weekly'
          ? monthly * 12 / 52
          : monthly,
      },
    })

    // 3. Categories (expense)
    for (const cat of draft.categories.filter(c => c.selected)) {
      const c: Category = { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, type: 'expense' }
      dispatch({ type: 'ADD_CATEGORY', payload: c })
    }

    // 4. Bills as subscriptions
    for (const bill of draft.bills.filter(b => b.name.trim() && parseFloat(b.amount) > 0)) {
      const sub: Subscription = {
        id: uuid(), name: bill.name.trim(), amount: parseFloat(bill.amount),
        frequency: bill.frequency, categoryId: '', status: 'active', transactionIds: [],
      }
      dispatch({ type: 'ADD_SUBSCRIPTION', payload: sub })
    }

    // 5. Budgets
    const month = currentMonth()
    for (const cat of draft.categories.filter(c => c.selected)) {
      const limit = parseFloat(draft.allocations[cat.id] ?? '0') || 0
      if (limit > 0) {
        const b: Budget = { id: uuid(), categoryId: cat.id, monthlyLimit: limit, month }
        dispatch({ type: 'ADD_BUDGET', payload: b })
      }
    }

    // 6. Goal
    if (draft.goalName.trim() && parseFloat(draft.goalAmount) > 0 && !draft.goalSkipped) {
      const g: Goal = {
        id: uuid(), name: draft.goalName.trim(),
        targetAmount: parseFloat(draft.goalAmount),
        currentAmount: 0, type: 'savings', color: 'oklch(0.42 0.075 155)',
        targetDate: draft.goalDate || undefined,
      }
      dispatch({ type: 'ADD_GOAL', payload: g })
    }

    localStorage.removeItem(DRAFT_KEY)
    onComplete()
  }

  const step = draft.step

  // Per-step canContinue check
  const canContinue = (() => {
    if (step === 1) return draft.firstName.trim().length > 0
    if (step === 2) return parseFloat(draft.hourlyRate) > 0 && draft.workDays.length > 0
    return true
  })()

  const onSkip = (step === 4 || step === 7) ? () => next() : undefined

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--background)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '32px 16px 64px',
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: '"Fraunces", serif', fontSize: 14, fontWeight: 700, color: 'var(--accent-foreground)', letterSpacing: '-0.03em' }}>M</span>
          </div>
          <span style={{ fontFamily: '"Fraunces", serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>Meridian</span>
        </div>

        <ProgressBar step={step} />

        {/* Step content */}
        <div className="card-surface" style={{ padding: '28px 24px', marginBottom: 0 }}>
          {step === 1 && <Step1 draft={draft} setDraft={setDraft} />}
          {step === 2 && <Step2 draft={draft} setDraft={setDraft} />}
          {step === 3 && <Step3 draft={draft} setDraft={setDraft} />}
          {step === 4 && <Step4 draft={draft} setDraft={setDraft} />}
          {step === 5 && <Step5 draft={draft} setDraft={setDraft} />}
          {step === 6 && <Step6 draft={draft} setDraft={setDraft} />}
          {step === 7 && <Step7 draft={draft} setDraft={setDraft} />}
          {step === 8 && <Step8 draft={draft} />}

          <NavButtons
            onBack={step > 1 ? back : undefined}
            onNext={step === 8 ? finish : next}
            onSkip={onSkip}
            nextLabel={step === 8 ? '✓ Start using Meridian' : 'Continue'}
            nextDisabled={!canContinue}
            isLast={step === 8}
          />
        </div>
      </div>
    </div>
  )
}
