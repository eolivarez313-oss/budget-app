import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Pencil } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatCurrency, currentMonth } from '../utils/formatters'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Field } from '../components/ui/Input'
import { transitions, cardVariants } from '../utils/motion'
import { Transaction, Category } from '../types'

// ── Lane persistence key ──────────────────────────────────────────────────────
const LANES_KEY = 'meridian_flow_lanes'

// ── Color palette for custom lanes ───────────────────────────────────────────
const LANE_COLORS = [
  { name: 'Forest',     value: 'oklch(0.42 0.075 155)' },
  { name: 'Terracotta', value: 'oklch(0.52 0.13 30)'   },
  { name: 'Steel',      value: 'oklch(0.46 0.10 240)'  },
  { name: 'Plum',       value: 'oklch(0.44 0.10 295)'  },
  { name: 'Amber',      value: 'oklch(0.55 0.13 60)'   },
  { name: 'Teal',       value: 'oklch(0.48 0.10 195)'  },
]

// ── Data model ────────────────────────────────────────────────────────────────
interface Lane {
  id:          string
  name:        string
  color:       string
  type:        'income' | 'bills' | 'savings' | 'discretionary' | 'custom'
  categoryIds: string[]   // for custom lanes: which categories to include
  isDefault:   boolean
}

function loadCustomLanes(): Lane[] {
  try { return JSON.parse(localStorage.getItem(LANES_KEY) || '[]') } catch { return [] }
}
function saveCustomLanes(lanes: Lane[]) {
  localStorage.setItem(LANES_KEY, JSON.stringify(lanes))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function weekLabel(date: Date): number {
  return Math.ceil(date.getDate() / 7)  // 1–5
}

function monthWeeks(month: string): { label: string; start: number; end: number }[] {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return [
    { label: 'Wk 1', start: 1,  end: Math.min(7,    days) },
    { label: 'Wk 2', start: 8,  end: Math.min(14,   days) },
    { label: 'Wk 3', start: 15, end: Math.min(21,   days) },
    { label: 'Wk 4', start: 22, end: Math.min(28,   days) },
    ...(days > 28 ? [{ label: 'Wk 5', start: 29, end: days }] : []),
  ]
}

function txPosition(date: string, month: string): number {
  const day  = parseInt(date.split('-')[2], 10)
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return ((day - 1) / (days - 1)) * 100  // 0–100%
}

// ── Lane transaction filter ───────────────────────────────────────────────────
function txForLane(
  lane: Lane,
  txs: Transaction[],
  month: string,
  billCategoryIds: Set<string>,
  savingsCategoryIds: Set<string>,
): Transaction[] {
  const monthTxs = txs.filter(t => t.date.startsWith(month))
  if (lane.type === 'income')        return monthTxs.filter(t => t.type === 'income')
  if (lane.type === 'bills')         return monthTxs.filter(t => t.type === 'expense' && billCategoryIds.has(t.categoryId))
  if (lane.type === 'savings')       return monthTxs.filter(t => t.type === 'expense' && savingsCategoryIds.has(t.categoryId))
  if (lane.type === 'discretionary') return monthTxs.filter(t => t.type === 'expense' && !billCategoryIds.has(t.categoryId) && !savingsCategoryIds.has(t.categoryId))
  if (lane.type === 'custom')        return monthTxs.filter(t => lane.categoryIds.includes(t.categoryId))
  return []
}

function laneTotal(txs: Transaction[]): number {
  return txs.reduce((s, t) => s + t.amount, 0)
}

// ── Create Lane modal ─────────────────────────────────────────────────────────
interface CreateLaneProps {
  categories: Category[]
  onSave:     (lane: Lane) => void
  onClose:    () => void
}

function CreateLaneModal({ categories, onSave, onClose }: CreateLaneProps) {
  const [step, setStep]   = useState<'name' | 'color' | 'cats'>('name')
  const [name, setName]   = useState('')
  const [color, setColor] = useState(LANE_COLORS[0].value)
  const [cats, setCats]   = useState<string[]>([])

  const expenseCats = categories.filter(c => c.type === 'expense')

  function toggleCat(id: string) {
    setCats(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  function save() {
    const lane: Lane = {
      id:          Math.random().toString(36).slice(2),
      name:        name.trim(),
      color,
      type:        'custom',
      categoryIds: cats,
      isDefault:   false,
    }
    onSave(lane)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transitions.fast}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={transitions.base}
        style={{
          position: 'relative', width: '100%', maxWidth: 460,
          background: 'var(--card)', borderRadius: 20,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>New lane</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {(['name','color','cats'] as const).map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 99,
              background: (['name','color','cats'].indexOf(step) >= i) ? 'var(--primary)' : 'var(--border)',
              transition: 'background 0.25s',
            }} />
          ))}
        </div>

        {step === 'name' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.55 }}>
              Give your lane a name — e.g. "Side income", "Rent", or "Partner A".
            </p>
            <Field label="Lane name">
              <Input
                value={name} autoFocus
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep('color') }}
                placeholder="e.g. Side income"
              />
            </Field>
            <Button onClick={() => setStep('color')} disabled={!name.trim()} style={{ width: '100%', marginTop: 16 }}>
              Next: choose color
            </Button>
          </div>
        )}

        {step === 'color' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Pick an accent color for <strong>{name}</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {LANE_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  style={{
                    padding: '10px 0', borderRadius: 10, cursor: 'pointer', border: 'none',
                    background: c.value + '22',
                    outline: color === c.value ? `2px solid ${c.value}` : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'outline 0.15s',
                  }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: c.value }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep('name')} style={{ flex: 1 }}>Back</Button>
              <Button onClick={() => setStep('cats')} style={{ flex: 1 }}>Next: categories</Button>
            </div>
          </div>
        )}

        {step === 'cats' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
              Which categories feed into this lane? Skip to include all.
            </p>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {expenseCats.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => toggleCat(cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                    background: cats.includes(cat.id) ? 'var(--accent)' : 'var(--secondary)',
                    border: 'none', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.12s',
                  }}
                >
                  <span style={{ fontSize: 15 }}>{cat.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{cat.name}</span>
                  {cats.includes(cat.id) && <Check size={12} color="var(--accent-foreground)" />}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep('color')} style={{ flex: 1 }}>Back</Button>
              <Button onClick={save} style={{ flex: 1, background: color }}>Create lane</Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Transaction detail popover ────────────────────────────────────────────────
function TxDetail({ tx, cat, sym, onClose }: { tx: Transaction; cat?: Category; sym: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={transitions.fast}
      style={{
        position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
        transform: 'translateX(-50%)',
        width: 220, background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px', zIndex: 100,
        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{cat?.icon || '•'}</span>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{tx.description}</p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tx.date} · {cat?.name}</p>
        </div>
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: tx.type === 'income' ? 'var(--primary)' : 'var(--destructive)', fontFamily: '"Fraunces", ui-serif, Georgia, serif' }}>
        {tx.type === 'income' ? '+' : '−'}{formatCurrency(tx.amount, sym)}
      </p>
    </motion.div>
  )
}

// ── Single swimlane row ───────────────────────────────────────────────────────
interface LaneRowProps {
  lane:   Lane
  txs:    Transaction[]
  cats:   Category[]
  sym:    string
  month:  string
  weeks:  { label: string; start: number; end: number }[]
  onRemove?: () => void
}

function LaneRow({ lane, txs, cats, sym, month, weeks, onRemove }: LaneRowProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const total = laneTotal(txs)
  const bg    = lane.color + '10'
  const bdr   = lane.color + '40'

  return (
    <motion.div variants={cardVariants} style={{ display: 'flex', gap: 0, alignItems: 'stretch', minHeight: 88 }}>
      {/* Lane label */}
      <div style={{
        width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '12px 16px',
        background: 'var(--card)', borderRight: `3px solid ${lane.color}`,
        borderRadius: '12px 0 0 12px', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: lane.color, flexShrink: 0 }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{lane.name}</p>
          {onRemove && (
            <button onClick={onRemove} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
              <X size={10} />
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: lane.color, fontFamily: '"Fraunces", ui-serif, Georgia, serif', letterSpacing: '-0.02em' }}>
          {formatCurrency(total, sym)}
        </p>
        <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{txs.length} transaction{txs.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Timeline area */}
      <div style={{
        flex: 1, position: 'relative',
        background: bg, border: `1px solid ${bdr}`,
        borderLeft: 'none', borderRadius: '0 12px 12px 0',
        overflow: 'visible',
      }}>
        {/* Week grid lines */}
        {weeks.slice(1).map((w, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${(w.start - 1) / 31 * 100}%`,
            width: 1, background: lane.color + '25',
          }} />
        ))}

        {/* Week labels (top) */}
        {weeks.map(w => (
          <div key={w.label} style={{
            position: 'absolute', top: 6,
            left: `${((w.start + w.end) / 2 - 1) / 31 * 100}%`,
            transform: 'translateX(-50%)',
            fontSize: 8, fontWeight: 600, color: lane.color + 'aa', letterSpacing: '0.06em',
          }}>
            {w.label}
          </div>
        ))}

        {/* Transactions */}
        {txs.map(tx => {
          const left = txPosition(tx.date, month)
          const cat  = cats.find(c => c.id === tx.categoryId)
          return (
            <div
              key={tx.id}
              style={{ position: 'absolute', left: `${left}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}
              onMouseEnter={() => setHovered(tx.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <motion.div
                whileHover={{ scale: 1.12 }}
                transition={transitions.fast}
                style={{
                  padding: '4px 8px', borderRadius: 9999,
                  background: lane.color, color: '#fff',
                  fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', boxShadow: `0 2px 8px ${lane.color}55`,
                }}
              >
                {formatCurrency(tx.amount, sym)}
              </motion.div>
              <AnimatePresence>
                {hovered === tx.id && (
                  <TxDetail tx={tx} cat={cat} sym={sym} onClose={() => setHovered(null)} />
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {/* Empty state */}
        {txs.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 10, color: lane.color + '60', fontStyle: 'italic' }}>No activity this month</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Flow arrows (SVG overlay showing income→lane splits) ──────────────────────
interface FlowArrowsProps {
  incomeTotal: number
  billsTotal:  number
  savingsTotal: number
  discTotal:   number
  sym: string
}
function FlowSummary({ incomeTotal, billsTotal, savingsTotal, discTotal, sym }: FlowArrowsProps) {
  if (incomeTotal === 0) return null
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)',
      padding: '14px 20px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto',
    }}>
      {/* Income */}
      <div style={{ textAlign: 'center', minWidth: 90 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: LANE_COLORS[0].value, margin: '0 auto 4px' }} />
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Income</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: LANE_COLORS[0].value, fontFamily: '"Fraunces", ui-serif, serif' }}>{formatCurrency(incomeTotal, sym)}</p>
      </div>

      {/* Arrows */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px' }}>
        {[
          { label: 'Bills',         value: billsTotal,   color: LANE_COLORS[1].value },
          { label: 'Savings',       value: savingsTotal, color: LANE_COLORS[2].value },
          { label: 'Discretionary', value: discTotal,    color: LANE_COLORS[3].value },
        ].filter(x => x.value > 0).map(x => (
          <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${LANE_COLORS[0].value}88, ${x.color}88)`, position: 'relative' }}>
              <div style={{ position: 'absolute', right: -4, top: -4, width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${x.color}88` }} />
            </div>
            <div style={{ textAlign: 'right', minWidth: 100 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{x.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: x.color, fontFamily: '"Fraunces", ui-serif, serif' }}>{formatCurrency(x.value, sym)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Flow component ───────────────────────────────────────────────────────
export function Flow() {
  const { state }  = useStore()
  const sym        = state.settings.currencySymbol || '$'
  const month      = currentMonth()
  const weeks      = monthWeeks(month)
  const [showCreate, setShowCreate]       = useState(false)
  const [customLanes, setCustomLanes]     = useState<Lane[]>(loadCustomLanes)

  // Determine bill categories (those associated with active subscriptions)
  const billCategoryIds = useMemo(() => {
    const ids = new Set<string>()
    state.subscriptions.filter(s => s.status === 'active').forEach(s => ids.add(s.categoryId))
    return ids
  }, [state.subscriptions])

  // Determine savings categories (keywords heuristic)
  const savingsCategoryIds = useMemo(() => {
    const SAVINGS_KEYWORDS = /savings?|invest|goal|emergency|401k|ira|transfer/i
    const ids = new Set<string>()
    state.categories.filter(c => SAVINGS_KEYWORDS.test(c.name)).forEach(c => ids.add(c.id))
    return ids
  }, [state.categories])

  // Default lanes
  const defaultLanes: Lane[] = [
    { id: 'income',        name: 'Income',        color: LANE_COLORS[0].value, type: 'income',        categoryIds: [], isDefault: true },
    { id: 'bills',         name: 'Bills',         color: LANE_COLORS[1].value, type: 'bills',         categoryIds: [], isDefault: true },
    { id: 'savings',       name: 'Savings',       color: LANE_COLORS[2].value, type: 'savings',       categoryIds: [], isDefault: true },
    { id: 'discretionary', name: 'Discretionary', color: LANE_COLORS[3].value, type: 'discretionary', categoryIds: [], isDefault: true },
  ]

  const allLanes = [...defaultLanes, ...customLanes]

  function addLane(lane: Lane) {
    const next = [...customLanes, lane]
    setCustomLanes(next)
    saveCustomLanes(next)
    setShowCreate(false)
  }

  function removeLane(id: string) {
    const next = customLanes.filter(l => l.id !== id)
    setCustomLanes(next)
    saveCustomLanes(next)
  }

  // Compute totals for flow summary
  const incomeLaneTxs = txForLane(defaultLanes[0], state.transactions, month, billCategoryIds, savingsCategoryIds)
  const billsLaneTxs  = txForLane(defaultLanes[1], state.transactions, month, billCategoryIds, savingsCategoryIds)
  const savLaneTxs    = txForLane(defaultLanes[2], state.transactions, month, billCategoryIds, savingsCategoryIds)
  const discLaneTxs   = txForLane(defaultLanes[3], state.transactions, month, billCategoryIds, savingsCategoryIds)

  // Format month label
  const [y, m] = month.split('-').map(Number)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 4 }}>
            Flow
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {monthLabel} · money movement across lanes
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} style={{ gap: 6 }}>
          <Plus size={14} /> Add lane
        </Button>
      </div>

      {/* Flow summary */}
      <FlowSummary
        incomeTotal={laneTotal(incomeLaneTxs)}
        billsTotal={laneTotal(billsLaneTxs)}
        savingsTotal={laneTotal(savLaneTxs)}
        discTotal={laneTotal(discLaneTxs)}
        sym={sym}
      />

      {/* Swimlanes */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {allLanes.map(lane => {
          const lTxs = txForLane(lane, state.transactions, month, billCategoryIds, savingsCategoryIds)
          return (
            <LaneRow
              key={lane.id}
              lane={lane}
              txs={lTxs}
              cats={state.categories}
              sym={sym}
              month={month}
              weeks={weeks}
              onRemove={lane.isDefault ? undefined : () => removeLane(lane.id)}
            />
          )
        })}
      </motion.div>

      {/* Legend / tip */}
      <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: 28 }}>
        Hover any transaction pill to see details · Time flows left → right across {monthLabel}
      </p>

      {/* Create lane modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateLaneModal
            categories={state.categories}
            onSave={addLane}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
