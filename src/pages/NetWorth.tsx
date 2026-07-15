import { useState } from 'react'
import { TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { useStore } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { formatCurrency, formatShortDate } from '../utils/formatters'
import { getTotalAssets, getTotalLiabilities, getNetWorth } from '../utils/calculations'
import { uuid } from '../utils/uuid'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

const tt = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)', boxShadow: '0 4px 12px rgba(27,32,48,0.08)' },
}

export function NetWorth() {
  const { state, dispatch } = useStore()
  const { accounts, netWorthHistory, settings } = state
  const sym = settings.currencySymbol

  const netWorth = getNetWorth(accounts)
  const assets = getTotalAssets(accounts)
  const liabilities = getTotalLiabilities(accounts)

  const chartData = netWorthHistory.map(e => ({
    date: formatShortDate(e.date),
    netWorth: e.assets - e.liabilities,
    assets: e.assets,
    liabilities: e.liabilities,
  }))

  const prev = netWorthHistory.length >= 2 ? netWorthHistory[netWorthHistory.length - 2] : null
  const prevNW = prev ? prev.assets - prev.liabilities : null
  const change = prevNW !== null ? netWorth - prevNW : null
  const changePct = prevNW && prevNW !== 0 ? ((netWorth - prevNW) / Math.abs(prevNW)) * 100 : null

  function snapshotNow() {
    const d = new Date()
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    dispatch({ type: 'ADD_NET_WORTH_ENTRY', payload: { id: uuid(), date, assets, liabilities } })
  }

  const donutData = [
    { name: 'Assets', value: assets, color: GREEN },
    { name: 'Liabilities', value: liabilities, color: '#ef4444' },
  ]

  const assetAccounts = accounts.filter(a => a.balance > 0)
  const liabilityAccounts = accounts.filter(a => a.balance < 0)

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Net Worth</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Track your financial progress over time</p>
        </div>
        <Button variant="secondary" onClick={snapshotNow}><Plus size={15} /> Snapshot Now</Button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Card style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Net Worth</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: netWorth >= 0 ? NAVY : '#dc2626', letterSpacing: '-1px' }}>{formatCurrency(netWorth, sym)}</p>
          {change !== null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, fontSize: 12, color: change >= 0 ? GREEN : '#dc2626' }}>
              {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change >= 0 ? '+' : ''}{formatCurrency(change, sym)} ({changePct?.toFixed(1)}%)
            </div>
          )}
        </Card>
        <Card style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Total Assets</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: GREEN }}>{formatCurrency(assets, sym)}</p>
        </Card>
        <Card style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Total Liabilities</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(liabilities, sym)}</p>
        </Card>
      </div>

      {/* Chart + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Net Worth Over Time</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" />
              <XAxis dataKey="date" tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8A94A6', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...tt} formatter={(v: any) => formatCurrency(v, sym)} />
              <Line type="monotone" dataKey="netWorth" stroke={GREEN} strokeWidth={2.5} dot={{ fill: GREEN, r: 4 }} name="Net Worth" />
              <Line type="monotone" dataKey="assets" stroke="#4A6CF7" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Assets" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Allocation</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...tt} formatter={(v: any) => formatCurrency(v, sym)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {donutData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                  <span style={{ color: 'var(--text-muted)' }}>{d.name}</span>
                </div>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatCurrency(d.value, sym)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Assets & Liabilities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Assets</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assetAccounts.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 4, height: 32, borderRadius: 99, background: a.color }} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.type}</p>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{formatCurrency(a.balance, sym)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E4E4E4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Assets</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{formatCurrency(assets, sym)}</span>
          </div>
        </Card>

        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Liabilities</p>
            <Button size="sm" variant="secondary" onClick={() => {
              window.location.href = '/accounts'
            }}><Plus size={11} /> Add Liability</Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {liabilityAccounts.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No liabilities — add a credit card, loan, or mortgage to track debt.</p>}
            {liabilityAccounts.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 4, height: 32, borderRadius: 99, background: a.color }} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.type}</p>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(Math.abs(a.balance), sym)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E4E4E4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Liabilities</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(liabilities, sym)}</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
