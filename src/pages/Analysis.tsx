import { useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Award, Calendar } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell as RechartsCell, ReferenceLine,
} from 'recharts'
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, parseISO, differenceInDays } from 'date-fns'
import { DatePicker } from '../components/ui/DatePicker'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { formatCurrency } from '../utils/formatters'
import { Subscription, AppSettings } from '../types'

const GREEN = '#06C68A'
const NAVY = 'var(--text)'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const BILLS_COLOR = '#f97316'
const GRAY = 'var(--text-muted)'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekStart(dateStr: string) {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}
function weekEnd(ws: string) {
  return format(endOfWeek(parseISO(ws), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}
function weekLabel(ws: string) {
  const s = parseISO(ws)
  const e = endOfWeek(s, { weekStartsOn: 1 })
  return `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`
}
function weeklyFromSub(sub: Subscription): number {
  if (sub.frequency === 'weekly') return sub.amount
  if (sub.frequency === 'yearly') return sub.amount / 52
  return sub.amount / 4
}
function getWeeklyPaycheck(settings: AppSettings): number {
  const { paycheckAmount, payFrequency, monthlyIncome } = settings
  if (paycheckAmount && paycheckAmount > 0) {
    if (payFrequency === 'weekly') return paycheckAmount
    if (payFrequency === 'biweekly' || payFrequency === 'semi-monthly') return paycheckAmount / 2
    if (payFrequency === 'monthly') return paycheckAmount / 4
    return paycheckAmount / 4
  }
  return (monthlyIncome || 0) / 4
}
function todayStr() { return format(new Date(), 'yyyy-MM-dd') }
function fourWeeksAgo() { return format(subWeeks(new Date(), 4), 'yyyy-MM-dd') }

const tt = {
  contentStyle: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
    fontSize: 12, color: 'var(--text)', boxShadow: '0 4px 12px rgba(27,32,48,0.08)',
  },
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function StatTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <Card style={{ padding: '18px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</p>}
    </Card>
  )
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <Card style={{ padding: '56px 32px', textAlign: 'center' }}>
      <p style={{ fontSize: 36, marginBottom: 14 }}>{icon}</p>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto' }}>{body}</p>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'weekly' | 'range'

export function Analysis() {
  const { state } = useStore()
  const sym = state.settings.currencySymbol

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('weekly')

  // Weekly nav
  const [currentWS, setCurrentWS] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  )
  const prevWeek = () => setCurrentWS(ws => format(subWeeks(parseISO(ws), 1), 'yyyy-MM-dd'))
  const nextWeek = () => setCurrentWS(ws => format(addWeeks(parseISO(ws), 1), 'yyyy-MM-dd'))
  const isCurrentWeek = currentWS === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const currentWE = weekEnd(currentWS)

  // Range picker
  const [rangeFrom, setRangeFrom] = useState(fourWeeksAgo)
  const [rangeTo, setRangeTo] = useState(todayStr)
  const rangeValid = rangeFrom && rangeTo && rangeFrom <= rangeTo
  const rangeDays = rangeValid ? differenceInDays(parseISO(rangeTo), parseISO(rangeFrom)) + 1 : 0
  const weekCount = Math.max(1, rangeDays / 7) // proportional weeks in range

  // ── Shared data ───────────────────────────────────────────────────────────
  const weeklyBudgets = state.budgets.filter(b => b.month === 'weekly')
  const activeSubs = state.subscriptions.filter(s => s.status === 'active')
  const weeklyBillsTotal = activeSubs.reduce((s, sub) => s + weeklyFromSub(sub), 0)
  const weeklyPaycheck = getWeeklyPaycheck(state.settings)

  // ── Period-specific values ─────────────────────────────────────────────────
  const periodStart = viewMode === 'weekly' ? currentWS : rangeFrom
  const periodEnd   = viewMode === 'weekly' ? currentWE  : rangeTo
  const budgetScale = viewMode === 'weekly' ? 1 : weekCount

  const periodTxs = state.transactions.filter(
    t => t.type === 'expense' && rangeValid && t.date >= periodStart && t.date <= periodEnd
  )
  const totalActual   = periodTxs.reduce((s, t) => s + t.amount, 0)
  const totalBudgeted = (weeklyBudgets.reduce((s, b) => s + b.monthlyLimit, 0) + weeklyBillsTotal) * budgetScale
  const totalDiff     = totalBudgeted - totalActual

  // ── Category breakdown ─────────────────────────────────────────────────────
  const budgetedCatIds = new Set(weeklyBudgets.map(b => b.categoryId))

  const categoryRows = weeklyBudgets.map(budget => {
    const cat    = state.categories.find(c => c.id === budget.categoryId)
    const scaled = budget.monthlyLimit * budgetScale
    const spent  = periodTxs.filter(t => t.categoryId === budget.categoryId).reduce((s, t) => s + t.amount, 0)
    const diff   = scaled - spent
    return {
      catId:    budget.categoryId,
      name:     cat?.name  || 'Unknown',
      icon:     cat?.icon  || '💳',
      color:    cat?.color || GRAY,
      budgeted: scaled,
      spent,
      diff,
      over: diff < 0,
      pct: scaled > 0 ? Math.min(150, (spent / scaled) * 100) : 0,
    }
  }).sort((a, b) => a.diff - b.diff)

  const unbudgetedTxs = periodTxs.filter(t => !budgetedCatIds.has(t.categoryId))
  const unbudgetedByCat: Record<string, { name: string; icon: string; total: number }> = {}
  for (const t of unbudgetedTxs) {
    const cat = state.categories.find(c => c.id === t.categoryId)
    const key = t.categoryId || 'uncategorized'
    if (!unbudgetedByCat[key]) unbudgetedByCat[key] = { name: cat?.name || 'Uncategorized', icon: cat?.icon || '💳', total: 0 }
    unbudgetedByCat[key].total += t.amount
  }
  const unbudgetedTotal = unbudgetedTxs.reduce((s, t) => s + t.amount, 0)

  const biggestExpenses = [...periodTxs].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const overBudgetCategories = categoryRows.filter(r => r.over)
  const hasNoData = periodTxs.length === 0

  // ── 8-week trend (weekly mode only) ───────────────────────────────────────
  const trendWeeks = Array.from({ length: 8 }, (_, i) => {
    const ws = format(subWeeks(parseISO(currentWS), 7 - i), 'yyyy-MM-dd')
    const we = weekEnd(ws)
    const spent = state.transactions
      .filter(t => t.type === 'expense' && t.date >= ws && t.date <= we)
      .reduce((s, t) => s + t.amount, 0)
    return { label: format(parseISO(ws), 'MMM d'), ws, spent, budgeted: totalBudgeted, isCurrent: ws === currentWS }
  })
  const hasAnyTrendData = trendWeeks.slice(0, 7).some(w => w.spent > 0)

  // ── Week-by-week breakdown within custom range ─────────────────────────────
  const rangeWeeks = (() => {
    if (!rangeValid || rangeDays <= 7) return []
    const weeks: { label: string; spent: number; budgeted: number }[] = []
    let ws = weekStart(rangeFrom)
    while (ws <= rangeTo) {
      const we = weekEnd(ws)
      const clampStart = ws < rangeFrom ? rangeFrom : ws
      const clampEnd   = we > rangeTo   ? rangeTo   : we
      const clampDays  = differenceInDays(parseISO(clampEnd), parseISO(clampStart)) + 1
      const scale      = clampDays / 7
      const spent = state.transactions
        .filter(t => t.type === 'expense' && t.date >= clampStart && t.date <= clampEnd)
        .reduce((s, t) => s + t.amount, 0)
      weeks.push({
        label: format(parseISO(ws), 'MMM d'),
        spent,
        budgeted: (weeklyBudgets.reduce((s, b) => s + b.monthlyLimit, 0) + weeklyBillsTotal) * scale,
      })
      ws = format(addWeeks(parseISO(ws), 1), 'yyyy-MM-dd')
    }
    return weeks
  })()

  // ── Paycheck guard ─────────────────────────────────────────────────────────
  if (weeklyPaycheck <= 0) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader />
        <EmptyState
          icon="📊"
          title="Set up your paycheck first"
          body="Go to Settings to enter your income and pay frequency, then create a weekly budget to start analysis."
        />
      </div>
    )
  }

  const periodLabel = viewMode === 'weekly'
    ? weekLabel(currentWS)
    : `${format(parseISO(rangeFrom), 'MMM d')} – ${format(parseISO(rangeTo), 'MMM d, yyyy')}`

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Analysis</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Budget vs. actual · {periodLabel}</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['weekly', 'range'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                style={{
                  padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: viewMode === m ? 600 : 400, transition: 'all 0.15s',
                  background: viewMode === m ? '#fff' : 'transparent',
                  color: viewMode === m ? NAVY : GRAY,
                  boxShadow: viewMode === m ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                }}>
                {m === 'weekly' ? '📅 Weekly' : '📆 Date Range'}
              </button>
            ))}
          </div>

          {/* Weekly nav */}
          {viewMode === 'weekly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={prevWeek} style={navBtnStyle()}>
                <ChevronLeft size={15} color={NAVY} />
              </button>
              <span style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '6px 16px', borderRadius: 8,
                background: isCurrentWeek ? 'rgba(6,198,138,0.1)' : 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                minWidth: 170, textAlign: 'center',
              }}>
                {isCurrentWeek ? 'This Week' : weekLabel(currentWS)}
              </span>
              <button onClick={nextWeek} disabled={isCurrentWeek} style={navBtnStyle(isCurrentWeek)}>
                <ChevronRight size={15} color={NAVY} />
              </button>
            </div>
          )}

          {/* Range picker */}
          {viewMode === 'range' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>From</label>
                <DatePicker value={rangeFrom} onChange={setRangeFrom} max={rangeTo || todayStr()} style={{ width: 152 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>To</label>
                <DatePicker value={rangeTo} onChange={setRangeTo} min={rangeFrom} max={todayStr()} style={{ width: 152 }} />
              </div>
              {rangeValid && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {rangeDays} days · {weekCount.toFixed(1)} wks
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Invalid range warning ── */}
      {viewMode === 'range' && !rangeValid && rangeFrom && rangeTo && rangeFrom > rangeTo && (
        <div style={{ padding: '10px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: RED, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> End date must be on or after start date.
        </div>
      )}

      {/* ── Overspending banner ── */}
      {overBudgetCategories.length > 0 && !hasNoData && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={14} style={{ color: RED, flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: RED }}>
              Over budget in {overBudgetCategories.length} categor{overBudgetCategories.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {overBudgetCategories.map(r => (
              <span key={r.catId} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'var(--danger-dim)', color: RED, fontWeight: 500 }}>
                {r.icon} {r.name}: +{formatCurrency(-r.diff, sym)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatTile label={viewMode === 'weekly' ? 'Weekly Budget' : `${weekCount.toFixed(1)}-Week Budget`} value={formatCurrency(totalBudgeted, sym)} color={NAVY} />
        <StatTile label="Actually Spent" value={formatCurrency(totalActual, sym)} color={totalActual > totalBudgeted ? RED : NAVY} />
        <StatTile
          label={totalDiff >= 0 ? 'Under Budget' : 'Over Budget'}
          value={formatCurrency(Math.abs(totalDiff), sym)}
          color={totalDiff >= 0 ? GREEN : RED}
        />
        <StatTile
          label="Transactions"
          value={String(periodTxs.length)}
          color={NAVY}
          sub={periodTxs.length === 0 ? 'Import via Transactions page' : undefined}
        />
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* Left: categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {weeklyBillsTotal > 0 && (
            <Card style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: BILLS_COLOR + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧾</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Bills (fixed)</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {viewMode === 'range' ? `${formatCurrency(weeklyBillsTotal, sym)}/wk × ${weekCount.toFixed(1)} wks` : 'Fixed weekly obligation'}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: BILLS_COLOR }}>{formatCurrency(weeklyBillsTotal * budgetScale, sym)}</span>
              </div>
            </Card>
          )}

          {hasNoData ? (
            <EmptyState
              icon="📂"
              title={viewMode === 'range' ? 'No transactions in this range' : 'No transactions this week yet'}
              body="Go to Transactions and use Import Transactions to add your spending."
            />
          ) : categoryRows.length === 0 ? (
            <Card style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                No weekly budget categories set. Create allocations in <strong>Budgets</strong> to see budget vs. actual here.
              </p>
            </Card>
          ) : (
            categoryRows.map(r => (
              <Card key={r.catId} style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: r.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {r.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatCurrency(r.spent, sym)} of {formatCurrency(r.budgeted, sym)}
                        {viewMode === 'range' && <span style={{ color: 'var(--text-dim)' }}> ({weekCount.toFixed(1)} wks)</span>}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
                    background: r.over ? '#fee2e2' : 'rgba(6,198,138,0.1)',
                    color: r.over ? RED : GREEN,
                  }}>
                    {r.over ? '▲' : '▼'} {formatCurrency(Math.abs(r.diff), sym)}
                  </span>
                </div>
                <div style={{ width: '100%', background: 'var(--surface)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: 5, borderRadius: 99,
                    width: `${Math.min(100, r.pct)}%`,
                    background: r.over ? RED : r.pct > 80 ? AMBER : GREEN,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  <span>{Math.round(r.pct)}% used</span>
                  <span style={{ color: r.over ? RED : GREEN, fontWeight: 500 }}>
                    {r.over ? `Over by ${formatCurrency(-r.diff, sym)}` : `${formatCurrency(r.diff, sym)} remaining`}
                  </span>
                </div>
              </Card>
            ))
          )}

          {unbudgetedTotal > 0 && (
            <Card style={{ padding: '16px 20px', border: '1px solid #fde68a' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: AMBER, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Unbudgeted · {formatCurrency(unbudgetedTotal, sym)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Spending in categories with no weekly budget set.</p>
              {Object.entries(unbudgetedByCat).map(([catId, b]) => (
                <div key={catId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{b.icon} {b.name}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatCurrency(b.total, sym)}</span>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Biggest expenses */}
          <Card style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Award size={14} color={NAVY} />
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Top Expenses</p>
            </div>
            {biggestExpenses.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No expenses in this period.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {biggestExpenses.map((t, i) => {
                  const cat = state.categories.find(c => c.id === t.categoryId)
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', width: 18, flexShrink: 0 }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{cat?.icon} {cat?.name} · {t.date}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{formatCurrency(t.amount, sym)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Bar chart: budget vs actual */}
          {categoryRows.length > 0 && !hasNoData && (
            <Card style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Budget vs. Actual</p>
              <ResponsiveContainer width="100%" height={Math.max(100, categoryRows.length * 28)}>
                <BarChart
                  data={categoryRows.map(r => ({ name: `${r.icon} ${r.name}`, spent: r.spent, budgeted: r.budgeted, over: r.over }))}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 64 }}
                  barSize={7}
                  barCategoryGap="35%"
                >
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip {...tt} formatter={(v: any) => formatCurrency(Number(v), sym)} />
                  <Bar dataKey="budgeted" fill="#EBEBEB" radius={[0, 4, 4, 0]} name="Budgeted" />
                  <Bar dataKey="spent" radius={[0, 4, 4, 0]} name="Spent">
                    {categoryRows.map((r, i) => <RechartsCell key={i} fill={r.over ? RED : GREEN} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Trend / breakdown chart */}
          <Card style={{ padding: '20px 22px' }}>
            {viewMode === 'weekly' ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Weekly Spending Trend</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Last 8 weeks vs. budget</p>
                {!hasAnyTrendData ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <TrendingUp size={26} style={{ color: '#E4E4E4', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Trend appears after importing transactions from prior weeks.</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={trendWeeks} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" />
                        <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip {...tt} formatter={(v: any) => formatCurrency(Number(v), sym)} />
                        {totalBudgeted > 0 && (
                          <ReferenceLine y={totalBudgeted} stroke={GREEN} strokeDasharray="4 3" strokeWidth={1.5}
                            label={{ value: 'Budget', position: 'insideTopRight', fontSize: 10, fill: GREEN }} />
                        )}
                        <Line type="monotone" dataKey="spent" stroke={NAVY} strokeWidth={2} dot={{ fill: NAVY, r: 3 }} name="Spent" />
                      </LineChart>
                    </ResponsiveContainer>
                    {trendWeeks.length >= 2 && (() => {
                      const thisSpent = trendWeeks[trendWeeks.length - 1].spent
                      const lastSpent = trendWeeks[trendWeeks.length - 2].spent
                      if (lastSpent === 0) return null
                      const delta = thisSpent - lastSpent
                      const pct = Math.abs((delta / lastSpent) * 100).toFixed(0)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12 }}>
                          {delta < 0
                            ? <TrendingDown size={13} style={{ color: GREEN }} />
                            : <TrendingUp size={13} style={{ color: RED }} />
                          }
                          <span style={{ color: delta < 0 ? GREEN : RED, fontWeight: 500 }}>{delta < 0 ? '−' : '+'}{pct}% vs. last week</span>
                          <span style={{ color: 'var(--text-muted)' }}>({formatCurrency(Math.abs(delta), sym)} {delta < 0 ? 'less' : 'more'})</span>
                        </div>
                      )
                    })()}
                  </>
                )}
              </>
            ) : rangeWeeks.length > 0 ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Week-by-Week Breakdown</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Spending within selected range</p>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={rangeWeeks} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip {...tt} formatter={(v: any) => formatCurrency(Number(v), sym)} />
                    <Bar dataKey="budgeted" fill="#EBEBEB" radius={[4, 4, 0, 0]} name="Budgeted" barSize={10} />
                    <Bar dataKey="spent" fill={NAVY} radius={[4, 4, 0, 0]} name="Spent" barSize={10}>
                      {rangeWeeks.map((w, i) => <RechartsCell key={i} fill={w.spent > w.budgeted ? RED : GREEN} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Calendar size={26} style={{ color: '#E4E4E4', margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select a range longer than one week to see a breakdown.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Style helpers (keep out of render) ──────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Analysis</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Budget vs. actual spending by week</p>
    </div>
  )
}

function navBtnStyle(disabled = false): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8,
    border: '1px solid var(--border)',
    background: disabled ? '#F9F9F9' : '#F0F0F0',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.35 : 1, flexShrink: 0,
  }
}

