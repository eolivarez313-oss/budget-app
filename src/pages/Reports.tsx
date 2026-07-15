import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatMonth } from '../utils/formatters'
import { getMonthIncome, getMonthExpenses, getSpendingByCategory } from '../utils/calculations'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

const TABS = ['Cash Flow', 'Spending', 'Merchants', 'Summary']

const tt = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)', boxShadow: '0 4px 12px rgba(27,32,48,0.08)' },
}

export function Reports() {
  const { state } = useStore()
  const [tab, setTab] = useState('Cash Flow')
  const { transactions, categories, settings } = state
  const sym = settings.currencySymbol

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  const cashFlowData = months.map(m => ({
    label: new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    income: getMonthIncome(transactions, m),
    expenses: getMonthExpenses(transactions, m),
    net: getMonthIncome(transactions, m) - getMonthExpenses(transactions, m),
  }))

  const currentMonth = months[months.length - 1]
  const spendingMap = getSpendingByCategory(transactions, currentMonth)
  const spendingData = Object.entries(spendingMap)
    .map(([id, amt]) => ({ name: categories.find(c => c.id === id)?.name || 'Other', value: amt, color: categories.find(c => c.id === id)?.color || '#64748b' }))
    .sort((a, b) => b.value - a.value)

  const merchantMap: Record<string, number> = {}
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const name = t.merchantName || t.description
    merchantMap[name] = (merchantMap[name] || 0) + t.amount
  })
  const merchants = Object.entries(merchantMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const summaryData = months.slice(-6).map(m => ({
    month: formatMonth(m).split(' ')[0],
    income: getMonthIncome(transactions, m),
    expenses: getMonthExpenses(transactions, m),
    savings: Math.max(0, getMonthIncome(transactions, m) - getMonthExpenses(transactions, m)),
  }))

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Reports</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Analyze your financial patterns</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#E4E4E4', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t ? '#FAFAFA' : 'transparent',
              color: tab === t ? NAVY : '#8A94A6',
              boxShadow: tab === t ? '0 1px 4px rgba(27,32,48,0.08)' : 'none',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (tab !== t) (e.currentTarget as HTMLElement).style.color = NAVY }}
            onMouseLeave={e => { if (tab !== t) (e.currentTarget as HTMLElement).style.color = '#8A94A6' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Cash Flow' && (
        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>12-Month Income vs Expenses</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={cashFlowData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8D8D8" />
              <XAxis dataKey="label" tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...tt} formatter={(v: any) => formatCurrency(v, sym)} />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted)' }} />
              <Bar dataKey="income" name="Income" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#E4E7EC" radius={[4, 4, 0, 0]} />
              <Bar dataKey="net" name="Net" fill="#4A6CF7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {tab === 'Spending' && (
        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Spending by Category — {formatMonth(currentMonth)}</p>
          {spendingData.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No expense data this month.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {spendingData.map(d => {
              const max = spendingData[0]?.value || 1
              return (
                <div key={d.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{d.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(d.value, sym)}</span>
                  </div>
                  <div style={{ width: '100%', background: '#E4E4E4', borderRadius: 99, height: 6 }}>
                    <div style={{ height: 6, borderRadius: 99, width: `${(d.value / max) * 100}%`, background: d.color, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {tab === 'Merchants' && (
        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Top Merchants by Spending</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E4E4' }}>
                {['#', 'Merchant', 'Total Spent'].map((h, i) => (
                  <th key={h} style={{ padding: '8px 0', textAlign: i === 2 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchants.map(([name, amt], i) => (
                <tr key={name} style={{ borderBottom: '1px solid #D8D8D8' }}>
                  <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ padding: '12px 0', color: 'var(--text)' }}>{name}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--text)', fontWeight: 500 }}>{formatCurrency(amt, sym)}</td>
                </tr>
              ))}
              {merchants.length === 0 && <tr><td colSpan={3} style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No data yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'Summary' && (
        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>6-Month Summary</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E4E4' }}>
                {['Month','Income','Expenses','Savings','Rate'].map((h, i) => (
                  <th key={h} style={{ padding: '8px 0', textAlign: i > 0 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryData.map(r => {
                const rate = r.income > 0 ? Math.round((r.savings / r.income) * 100) : 0
                return (
                  <tr key={r.month} style={{ borderBottom: '1px solid #D8D8D8' }}>
                    <td style={{ padding: '12px 0', color: 'var(--text)', fontWeight: 500 }}>{r.month}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: GREEN, fontWeight: 500 }}>{formatCurrency(r.income, sym)}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--text)' }}>{formatCurrency(r.expenses, sym)}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: '#4A6CF7', fontWeight: 500 }}>{formatCurrency(r.savings, sym)}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                        color: rate >= 20 ? GREEN : rate >= 10 ? '#f59e0b' : '#8A94A6',
                        background: rate >= 20 ? 'rgba(6,198,138,0.1)' : rate >= 10 ? 'rgba(245,158,11,0.1)' : '#D8D8D8',
                      }}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
