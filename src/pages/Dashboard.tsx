import { useState, useRef } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, Zap, AlertTriangle, CheckCircle, Info, Plus, Calendar } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { formatCurrency, formatShortDate, currentMonth } from '../utils/formatters'
import {
  getMonthIncome, getMonthExpenses, getNetWorth, getTotalAssets,
  getSavingsRate, getSpendingByCategory, getLast6MonthsCashFlow, getCategorySpent, getFinancialHealthScore
} from '../utils/calculations'
import { TransactionModal } from './Transactions'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

const tt = {
  contentStyle: { background: '#FAFAFA', border: '1px solid #E4E4E4', borderRadius: 8, fontSize: 12, color: NAVY, boxShadow: '0 4px 12px rgba(27,32,48,0.08)' },
  cursor: { fill: '#EBEBEB' },
}

function StatCard({ title, value, sub, icon: Icon, positive }: { title: string; value: string; sub?: string; icon: any; positive?: boolean }) {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{title}</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: positive ? GREEN : NAVY, letterSpacing: '-0.5px' }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: positive ? 'rgba(6,198,138,0.1)' : '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color={positive ? GREEN : '#8A94A6'} />
        </div>
      </div>
    </Card>
  )
}

function HealthRing({ score }: { score: number }) {
  const color = score >= 75 ? GREEN : score >= 50 ? '#f59e0b' : '#dc2626'
  const label = score >= 75 ? 'Great' : score >= 50 ? 'Fair' : 'Needs Work'
  const dash = (score / 100) * 100
  return (
    <Card style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
        <svg viewBox="0 0 36 36" style={{ width: 64, height: 64, transform: 'rotate(-90deg)' }}>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E4E4E4" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${dash} ${100 - dash}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{score}</span>
        </div>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Financial Health</p>
        <p style={{ fontSize: 18, fontWeight: 700, color }}>{label}</p>
        <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 2 }}>Score: {score} / 100</p>
      </div>
    </Card>
  )
}

function Insight({ type, message }: { type: 'good' | 'warning' | 'info'; message: string }) {
  const cfg = {
    good: { icon: CheckCircle, color: GREEN, bg: 'rgba(6,198,138,0.08)', border: 'rgba(6,198,138,0.2)' },
    warning: { icon: AlertTriangle, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    info: { icon: Info, color: '#4A6CF7', bg: '#EFF3FF', border: '#C7D4FD' },
  }[type]
  const Icon = cfg.icon
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <Icon size={14} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{message}</p>
    </div>
  )
}

const SEC = { fontSize: 11, fontWeight: 600, color: '#8A94A6', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 14 }

export function Dashboard() {
  const { state, dispatch } = useStore()
  const [showAddTx, setShowAddTx] = useState(false)
  const [savingsInput, setSavingsInput] = useState('')
  const [savingsEditing, setSavingsEditing] = useState(false)
  const savingsRef = useRef<HTMLInputElement>(null)
  const [paycheckInput, setPaycheckInput] = useState('')
  const [paycheckEditing, setPaycheckEditing] = useState(false)
  const month = currentMonth()
  const { transactions, accounts, budgets, categories, goals, subscriptions } = state
  const sym = state.settings.currencySymbol

  // Use the most recent month that has expense transactions (falls back to current month)
  const monthsWithExpenses = [...new Set(
    transactions.filter(t => t.type === 'expense').map(t => t.date.substring(0, 7))
  )].sort().reverse()
  const chartMonth = monthsWithExpenses[0] || month

  const txIncome = getMonthIncome(transactions, month)
  const income = txIncome > 0 ? txIncome : (state.settings.monthlyIncome || 0)
  const txExpenses = getMonthExpenses(transactions, month)
  const activeSubs = subscriptions.filter(s => s.status === 'active')
  const billsMonthly = activeSubs.reduce((s, sub) => s + (sub.frequency === 'monthly' ? sub.amount : sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount * 4.33), 0)
  const expenses = txExpenses + billsMonthly
  const savingsAllocated = state.settings.monthlySavings || 0

  // Paycheck planner — use clean whole divisors
  const payFrequency = state.settings.payFrequency || 'biweekly'
  const paychecksPerMonth: Record<string, number> = { weekly: 4, biweekly: 2, 'semi-monthly': 2, monthly: 1 }
  const freqLabel: Record<string, string> = { weekly: 'Weekly', biweekly: 'Every 2 Weeks', 'semi-monthly': 'Twice a Month', monthly: 'Monthly' }
  const ppm = paychecksPerMonth[payFrequency]
  // Use user-entered paycheck amount if available, otherwise estimate from monthly income
  const paycheckAmount = state.settings.paycheckAmount || (income > 0 ? income / ppm : 0)
  const paycheckBills = billsMonthly / ppm
  const paycheckTxExpenses = txExpenses / ppm
  const paycheckSavings = savingsAllocated / ppm
  const paycheckRemaining = paycheckAmount - paycheckBills - paycheckTxExpenses - paycheckSavings
  const netWorth = getNetWorth(accounts)
  const assets = getTotalAssets(accounts)
  const savingsRate = getSavingsRate(income, expenses)
  const healthScore = getFinancialHealthScore(savingsRate, budgets, transactions, goals)
  const cashFlow = getLast6MonthsCashFlow(transactions)
  // Spending map: transaction expenses for chartMonth + bills as their own categories
  const spendingMap = getSpendingByCategory(transactions, chartMonth)

  // Merge transaction spending with bills (grouped by category)
  const combinedSpendingMap: Record<string, { name: string; value: number; color: string }> = {}
  Object.entries(spendingMap).forEach(([catId, amount]) => {
    const cat = categories.find(c => c.id === catId)
    if (cat) combinedSpendingMap[catId] = { name: cat.name, value: amount, color: cat.color }
  })
  activeSubs.forEach(sub => {
    const cat = categories.find(c => c.id === sub.categoryId)
    const monthly = sub.frequency === 'monthly' ? sub.amount : sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount * 4.33
    if (cat) {
      if (combinedSpendingMap[sub.categoryId]) {
        combinedSpendingMap[sub.categoryId].value += monthly
      } else {
        combinedSpendingMap[sub.categoryId] = { name: cat.name, value: monthly, color: cat.color }
      }
    }
  })
  const spendingData = Object.values(combinedSpendingMap)
    .sort((a, b) => b.value - a.value).slice(0, 6)

  const chartMonthLabel = new Date(chartMonth + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const monthBudgets = budgets.filter(b => b.month === month)

  const insights: { type: 'good' | 'warning' | 'info'; message: string }[] = []
  if (savingsRate >= 20) insights.push({ type: 'good', message: `Saving ${savingsRate}% of income this month — excellent!` })
  else if (savingsRate > 0) insights.push({ type: 'info', message: `Saving ${savingsRate}% of income. Aim for 20%+ for financial security.` })
  monthBudgets.forEach(b => {
    const cat = categories.find(c => c.id === b.categoryId)
    const spent = getCategorySpent(transactions, b.categoryId, month)
    const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0
    if (pct >= 100) insights.push({ type: 'warning', message: `${cat?.name} is over budget by ${formatCurrency(spent - b.monthlyLimit, sym)}` })
    else if (pct >= 80) insights.push({ type: 'warning', message: `${cat?.name} at ${Math.round(pct)}% — running close` })
  })
  if (billsMonthly > 0) insights.push({ type: 'info', message: `${activeSubs.length} active bill${activeSubs.length !== 1 ? 's' : ''} costing ${formatCurrency(billsMonthly, sym)}/mo` })
  if (!state.settings.monthlyIncome && txIncome === 0) insights.push({ type: 'info', message: 'Set your monthly take-home income in Settings to get accurate savings rate and budget calculations.' })
  if (insights.length === 0) insights.push({ type: 'info', message: 'Add accounts and transactions to see personalized insights.' })

  const upcomingBills = Object.values(
    transactions.filter(t => t.isRecurring && t.type === 'expense')
      .reduce((acc, t) => { if (!acc[t.description]) acc[t.description] = t; return acc }, {} as Record<string, typeof transactions[0]>)
  ).slice(0, 5)

  const projectedBalance = (() => {
    const pts = []
    let balance = accounts.find(a => a.type === 'checking')?.balance || 0
    const ri = transactions.filter(t => t.isRecurring && t.type === 'income')
    const re = transactions.filter(t => t.isRecurring && t.type === 'expense')
    for (let i = 0; i <= 30; i += 5) {
      if (i > 0) {
        balance += ri.reduce((s, t) => s + (t.recurringFrequency === 'biweekly' ? (t.amount / 14) * 5 : t.recurringFrequency === 'monthly' ? (t.amount / 30) * 5 : 0), 0)
        balance -= re.reduce((s, t) => s + (t.recurringFrequency === 'monthly' ? (t.amount / 30) * 5 : t.recurringFrequency === 'weekly' ? t.amount * 0.71 : 0), 0)
      }
      pts.push({ day: i === 0 ? 'Today' : `+${i}d`, balance: Math.round(balance) })
    }
    return pts
  })()

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#8A94A6', marginTop: 3 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => setShowAddTx(true)}><Plus size={15} /> Add Transaction</Button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard title="Net Worth" value={formatCurrency(netWorth, sym)} sub={`Assets: ${formatCurrency(assets, sym)}`} icon={TrendingUp} positive={netWorth > 0} />
        <StatCard title="Monthly Income" value={formatCurrency(income, sym)} icon={DollarSign} positive />
        <StatCard title="Monthly Expenses" value={formatCurrency(expenses, sym)} sub={billsMonthly > 0 ? `incl. ${formatCurrency(billsMonthly, sym)} in bills` : undefined} icon={TrendingDown} />
        <StatCard title="Savings Rate" value={`${savingsRate}%`} sub={savingsAllocated > 0 ? `Goal: ${formatCurrency(savingsAllocated, sym)}/mo` : `Saved ${formatCurrency(Math.max(0, income - expenses), sym)}`} icon={Percent} positive={savingsRate >= 20} />
      </div>

      {/* Monthly Breakdown */}
      {income > 0 && (
        <Card style={{ padding: '20px 24px' }}>
          <p style={SEC}>Monthly Breakdown</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Take-Home Income', value: income, color: GREEN, sign: '+', bold: true },
              { label: 'Bills & Subscriptions', value: -billsMonthly, color: '#ef4444', sign: '-', bold: false },
              { label: 'Other Expenses', value: -txExpenses, color: '#f59e0b', sign: '-', bold: false },
              ...(savingsAllocated > 0 ? [{ label: 'Savings Allocated', value: -savingsAllocated, color: '#4A6CF7', sign: '-', bold: false }] : []),
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: row.bold ? 600 : 400 }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.sign}{formatCurrency(Math.abs(row.value), sym)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Remaining</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: income - expenses - savingsAllocated >= 0 ? GREEN : '#ef4444' }}>
                {formatCurrency(Math.max(0, income - expenses - savingsAllocated), sym)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Paycheck Planner */}
      {income > 0 && (
        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={SEC}>Paycheck Planner</p>
              <p style={{ fontSize: 12, color: '#8A94A6', marginTop: -10 }}>{freqLabel[payFrequency]}</p>
            </div>
            {/* Editable paycheck amount */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#8A94A6' }}>My paycheck:</span>
              {paycheckEditing ? (
                <form onSubmit={e => {
                  e.preventDefault()
                  const val = parseFloat(paycheckInput)
                  const updated = { ...state.settings, paycheckAmount: isNaN(val) || val <= 0 ? undefined : val }
                  dispatch({ type: 'UPDATE_SETTINGS', payload: updated })
                  try {
                    const raw = JSON.parse(localStorage.getItem('budget_app_v1') || '{}')
                    raw.settings = { ...raw.settings, paycheckAmount: updated.paycheckAmount }
                    localStorage.setItem('budget_app_v1', JSON.stringify(raw))
                  } catch {}
                  setPaycheckEditing(false)
                }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, color: '#8A94A6' }}>{sym}</span>
                  <input
                    type="number" min="0" step="any" placeholder="0"
                    value={paycheckInput}
                    onChange={e => setPaycheckInput(e.target.value)}
                    onBlur={e => e.currentTarget.form?.requestSubmit()}
                    style={{ width: 90, padding: '4px 8px', fontSize: 14, fontWeight: 700, border: `2px solid ${GREEN}`, borderRadius: 6, outline: 'none', background: '#fff', color: NAVY, textAlign: 'right' }}
                    autoFocus
                  />
                </form>
              ) : (
                <button
                  onClick={() => { setPaycheckInput(paycheckAmount > 0 ? paycheckAmount.toFixed(2) : ''); setPaycheckEditing(true) }}
                  style={{ fontSize: 14, fontWeight: 700, color: state.settings.paycheckAmount ? NAVY : '#8A94A6', background: state.settings.paycheckAmount ? '#F0F0F0' : 'transparent', border: `1px dashed ${state.settings.paycheckAmount ? '#C0C8D8' : '#C0C8D8'}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', minWidth: 80, textAlign: 'right' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EBEBEB' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = state.settings.paycheckAmount ? '#F0F0F0' : 'transparent' }}
                >
                  {paycheckAmount > 0 ? formatCurrency(paycheckAmount, sym) : '+ Enter'}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar showing paycheck allocation */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 10, borderRadius: 99, background: '#EBEBEB', overflow: 'hidden', display: 'flex' }}>
              {paycheckAmount > 0 && [
                { value: paycheckBills, color: '#ef4444' },
                { value: paycheckTxExpenses, color: '#f59e0b' },
                { value: paycheckSavings, color: '#4A6CF7' },
                { value: Math.max(0, paycheckRemaining), color: GREEN },
              ].map((seg, i) => (
                <div key={i} style={{ width: `${Math.min(100, (seg.value / paycheckAmount) * 100)}%`, background: seg.color, transition: 'width 0.3s' }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 32px' }}>
            {/* Bills row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F4F4F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Bills & Subscriptions</p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>{formatCurrency(billsMonthly, sym)}/mo ÷ {ppm} paychecks</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{formatCurrency(paycheckBills, sym)}</span>
            </div>

            {/* Savings row — inline editable */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F4F4F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4A6CF7', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Savings per Paycheck</p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>
                    {paycheckSavings > 0 ? `= ${formatCurrency(savingsAllocated, sym)}/mo · click to edit` : 'tap amount to set'}
                  </p>
                </div>
              </div>
              {savingsEditing ? (
                <form onSubmit={e => {
                  e.preventDefault()
                  const perCheck = parseFloat(savingsInput)
                  const monthly = isNaN(perCheck) || perCheck < 0 ? 0 : Math.round(perCheck * ppm * 100) / 100
                  const updated = { ...state.settings, monthlySavings: monthly || undefined }
                  dispatch({ type: 'UPDATE_SETTINGS', payload: updated })
                  try {
                    const raw = JSON.parse(localStorage.getItem('budget_app_v1') || '{}')
                    raw.settings = { ...raw.settings, monthlySavings: monthly || undefined }
                    localStorage.setItem('budget_app_v1', JSON.stringify(raw))
                  } catch {}
                  setSavingsEditing(false)
                }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#8A94A6' }}>{sym}</span>
                  <input
                    ref={savingsRef}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={savingsInput}
                    onChange={e => setSavingsInput(e.target.value)}
                    onBlur={e => {
                      // auto-save on blur too
                      e.currentTarget.form?.requestSubmit()
                    }}
                    style={{
                      width: 80, padding: '4px 8px', fontSize: 14, fontWeight: 700,
                      border: `2px solid ${GREEN}`, borderRadius: 6, outline: 'none',
                      background: '#fff', color: '#1A1F36', textAlign: 'right',
                    }}
                    autoFocus
                  />
                </form>
              ) : (
                <button
                  onClick={() => {
                    setSavingsInput(paycheckSavings > 0 ? paycheckSavings.toFixed(2) : '')
                    setSavingsEditing(true)
                  }}
                  style={{
                    fontSize: 14, fontWeight: 700, color: '#4A6CF7',
                    background: paycheckSavings > 0 ? 'rgba(74,108,247,0.08)' : '#F0F0F0',
                    border: `1px dashed ${paycheckSavings > 0 ? '#4A6CF7' : '#C0C8D8'}`,
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                    transition: 'all 0.15s',
                    minWidth: 64, textAlign: 'right',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,108,247,0.12)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = paycheckSavings > 0 ? 'rgba(74,108,247,0.08)' : '#F0F0F0' }}
                >
                  {paycheckSavings > 0 ? formatCurrency(paycheckSavings, sym) : '+ Set'}
                </button>
              )}
            </div>

            {/* Other Expenses row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F4F4F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Other Expenses</p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>based on this month's spending</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(paycheckTxExpenses, sym)}</span>
            </div>

            {/* Spending money left row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F4F4F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Spending Money Left</p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>after bills & savings</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>{formatCurrency(Math.max(0, paycheckRemaining), sym)}</span>
            </div>
          </div>

          {paycheckRemaining < 0 && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ Your bills and savings exceed your paycheck by {formatCurrency(Math.abs(paycheckRemaining), sym)}. Consider adjusting your budget in Settings.
            </div>
          )}
        </Card>
      )}

      {/* Health + Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        <HealthRing score={healthScore} />
        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Zap size={14} color="#9ca3af" />
            <p style={SEC}>Smart Insights</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.slice(0, 3).map((ins, i) => <Insight key={i} {...ins} />)}
          </div>
        </Card>
      </div>

      {/* Budget Overview */}
      {monthBudgets.length > 0 && (
        <Card style={{ padding: '20px 24px' }}>
          <p style={SEC}>Budget Overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 32px' }}>
            {monthBudgets.map(b => {
              const cat = categories.find(c => c.id === b.categoryId)
              const spent = getCategorySpent(transactions, b.categoryId, month)
              return (
                <div key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{cat?.icon}</span> {cat?.name}
                    </span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      {formatCurrency(spent, sym)} / {formatCurrency(b.monthlyLimit, sym)}
                    </span>
                  </div>
                  <ProgressBar value={spent} max={b.monthlyLimit} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card style={{ padding: '20px 24px' }}>
          <p style={SEC}>6-Month Cash Flow</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cashFlow} barSize={18}>
              <XAxis dataKey="label" tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...tt} formatter={(v: any) => formatCurrency(v, sym)} />
              <Bar dataKey="income" name="Income" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#E4E7EC" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <p style={{ ...SEC, marginBottom: 0 }}>Spending by Category</p>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{chartMonthLabel}{chartMonth !== month ? ' (most recent)' : ''}</span>
          </div>
          {spendingData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={spendingData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={3}>
                    {spendingData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip {...tt} formatter={(v: any) => formatCurrency(v, sym)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {spendingData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{formatCurrency(d.value, sym)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>No expense data this month.</p>}
        </Card>
      </div>

      {/* Projection + Upcoming */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card style={{ padding: '20px 24px' }}>
          <p style={SEC}>30-Day Balance Projection</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={projectedBalance}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
              <Tooltip {...tt} formatter={(v: any) => formatCurrency(v, sym)} />
              <Area type="monotone" dataKey="balance" stroke={GREEN} fill="url(#balGrad)" strokeWidth={2} name="Balance" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Calendar size={13} color="#9ca3af" />
            <p style={SEC}>Upcoming Recurring Bills</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {upcomingBills.length > 0 ? upcomingBills.map(t => {
              const cat = categories.find(c => c.id === t.categoryId)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{cat?.icon}</div>
                    <div>
                      <p style={{ fontSize: 13, color: NAVY, fontWeight: 500 }}>{t.description}</p>
                      <p style={{ fontSize: 11, color: '#8A94A6' }}>{cat?.name}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{formatCurrency(t.amount, sym)}</span>
                </div>
              )
            }) : <p style={{ fontSize: 13, color: '#9ca3af' }}>No recurring bills found.</p>}
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card style={{ padding: '20px 24px' }}>
        <p style={SEC}>Recent Transactions</p>
        <div>
          {transactions.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>No transactions yet. Add your first one above.</p>}
          {transactions.slice(0, 8).map((t, i) => {
            const cat = categories.find(c => c.id === t.categoryId)
            const acc = accounts.find(a => a.id === t.accountId)
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < Math.min(transactions.length, 8) - 1 ? '1px solid #f4f4f5' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {cat?.icon || '💳'}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{t.description}</p>
                    <p style={{ fontSize: 11, color: '#8A94A6', marginTop: 2 }}>{acc?.name} · {formatShortDate(t.date)}</p>
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.type === 'income' ? GREEN : NAVY }}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, sym)}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {showAddTx && <TransactionModal open={showAddTx} onClose={() => setShowAddTx(false)} />}
    </div>
  )
}
