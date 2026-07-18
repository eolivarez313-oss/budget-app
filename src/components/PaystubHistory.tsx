import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Trash2, Download, TrendingUp, TrendingDown, Minus, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { Paystub } from '../types'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { ConfirmModal } from './ui/ConfirmModal'
import { deletePaystub } from '../lib/paystubDb'

const GREEN = '#06C68A'
const BLUE = '#4A6CF7'
const WARN = '#f59e0b'

interface Props {
  paystubs: Paystub[]
  currencySymbol: string
  onDeleted: (id: string) => void
}

function fmt(n?: number | null, sym = '$'): string {
  if (n == null) return '—'
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d?: string): string {
  if (!d) return '—'
  try {
    return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

function fmtShort(d?: string): string {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  catch { return d }
}

function ChangeTag({ current, prior }: { current?: number | null; prior?: number | null }) {
  if (current == null || prior == null) return null
  const diff = current - prior
  if (Math.abs(diff) < 0.5) return <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>No change</span>
  const up = diff > 0
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, marginLeft: 6,
      color: up ? GREEN : WARN,
      display: 'inline-flex', alignItems: 'center', gap: 2,
    }}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}{fmt(diff)}
    </span>
  )
}

export function PaystubHistory({ paystubs, currencySymbol, onDeleted }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const sym = currencySymbol || '$'

  const sorted = [...paystubs].sort((a, b) => {
    if (!a.payDate && !b.payDate) return 0
    if (!a.payDate) return 1
    if (!b.payDate) return -1
    return a.payDate < b.payDate ? -1 : 1
  })

  // YTD totals from most recent paystub that has YTD data
  const latestWithYtd = [...sorted].reverse().find(p => p.ytdGross != null)

  // Chart data
  const chartData = sorted
    .filter(p => p.payDate && (p.grossPay != null || p.netPay != null))
    .map(p => ({
      date: fmtShort(p.payDate),
      gross: p.grossPay ?? undefined,
      net: p.netPay ?? undefined,
      employer: p.employerName ?? '',
    }))

  async function handleDelete() {
    if (!deletingId) return
    await deletePaystub(deletingId)
    onDeleted(deletingId)
    setDeletingId(null)
  }

  function exportTaxSummary() {
    if (!latestWithYtd) return
    const rows = [
      ['Field', 'Year-to-Date'],
      ['Gross Pay', latestWithYtd.ytdGross ?? ''],
      ['Federal Income Tax', latestWithYtd.ytdFederalTax ?? ''],
      ['State Income Tax', latestWithYtd.ytdStateTax ?? ''],
      ['Social Security (OASDI)', latestWithYtd.ytdSocialSecurity ?? ''],
      ['Medicare', latestWithYtd.ytdMedicare ?? ''],
      ['Net Pay', latestWithYtd.ytdNet ?? ''],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ytd-tax-summary.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (!paystubs.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
        <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
        <p style={{ fontSize: 13 }}>No paystubs uploaded yet.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── YTD Summary ──────────────────────────────────────────────────────── */}
      {latestWithYtd && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Year-to-Date Totals
            </p>
            <Button size="sm" variant="secondary" onClick={exportTaxSummary} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={11} /> Export for taxes
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'YTD Gross Pay', value: fmt(latestWithYtd.ytdGross, sym) },
              { label: 'YTD Total Taxes', value: fmt((latestWithYtd.ytdFederalTax ?? 0) + (latestWithYtd.ytdStateTax ?? 0) + (latestWithYtd.ytdSocialSecurity ?? 0) + (latestWithYtd.ytdMedicare ?? 0), sym) },
              { label: 'YTD Net Pay', value: fmt(latestWithYtd.ytdNet, sym) },
              { label: 'YTD Federal Tax', value: fmt(latestWithYtd.ytdFederalTax, sym) },
              { label: 'YTD State Tax', value: fmt(latestWithYtd.ytdStateTax, sym) },
              { label: 'YTD FICA (SS + Medicare)', value: fmt((latestWithYtd.ytdSocialSecurity ?? 0) + (latestWithYtd.ytdMedicare ?? 0), sym) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
                <p style={{ fontFamily: '"Fraunces", serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
              </div>
            ))}
          </div>
          {latestWithYtd && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              As of {fmtDate(latestWithYtd.payDate)} paystub
              {latestWithYtd.employerName ? ` · ${latestWithYtd.employerName}` : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Trend chart ──────────────────────────────────────────────────────── */}
      {chartData.length >= 2 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Gross &amp; Net Pay Over Time
          </p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${sym}${(v / 1000).toFixed(1)}k`} />
                <Tooltip
                  formatter={(v: number | string | Array<number | string>, name: string) => [fmt(typeof v === 'number' ? v : 0, sym), name === 'gross' ? 'Gross Pay' : 'Net Pay']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend formatter={(v) => v === 'gross' ? 'Gross Pay' : 'Net Pay'} iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="gross" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="net" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Paystub list ─────────────────────────────────────────────────────── */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Upload History ({paystubs.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...paystubs].reverse().map((p, idx) => {
            const priorSorted = sorted.filter(x => x.payDate && p.payDate && x.payDate < p.payDate)
            const prior = priorSorted.length > 0 ? priorSorted[priorSorted.length - 1] : null
            const isExpanded = expanded === p.id

            return (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: 'var(--surface)' }}
                  onClick={() => setExpanded(isExpanded ? null : p.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {fmtDate(p.payDate)}
                      </span>
                      {p.employerName && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {p.employerName}</span>
                      )}
                      {idx === 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: GREEN, background: 'rgba(6,198,138,0.12)', padding: '1px 6px', borderRadius: 99 }}>Latest</span>
                      )}
                    </div>
                    {p.periodStart && p.periodEnd && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>GROSS</p>
                      <p style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                        {fmt(p.grossPay, sym)}
                        {prior && <ChangeTag current={p.grossPay} prior={prior.grossPay} />}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>NET</p>
                      <p style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: GREEN }}>
                        {fmt(p.netPay, sym)}
                        {prior && <ChangeTag current={p.netPay} prior={prior.netPay} />}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <IconButton size="sm" variant="danger" onClick={e => { e.stopPropagation(); setDeletingId(p.id) }}>
                        <Trash2 size={12} />
                      </IconButton>
                      {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px' }}>
                      {/* Current period */}
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Current Period</p>
                        {[
                          { label: 'Gross Pay', val: p.grossPay },
                          { label: 'Federal Tax', val: p.federalTax },
                          { label: 'State Tax', val: p.stateTax },
                          { label: 'Social Security', val: p.socialSecurity },
                          { label: 'Medicare', val: p.medicare },
                          ...p.preTaxDeductions.map(d => ({ label: `${d.name} (pre-tax)`, val: d.current })),
                          ...p.postTaxDeductions.map(d => ({ label: `${d.name} (post-tax)`, val: d.current })),
                          { label: 'Net Pay', val: p.netPay, bold: true },
                        ].filter(r => r.val != null).map(({ label, val, bold }) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                            <span style={{ fontSize: 12, fontWeight: bold ? 700 : 400, color: bold ? GREEN : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(val as number, sym)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* YTD */}
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Year-to-Date</p>
                        {[
                          { label: 'YTD Gross', val: p.ytdGross },
                          { label: 'YTD Federal', val: p.ytdFederalTax },
                          { label: 'YTD State', val: p.ytdStateTax },
                          { label: 'YTD Soc. Security', val: p.ytdSocialSecurity },
                          { label: 'YTD Medicare', val: p.ytdMedicare },
                          ...p.preTaxDeductions.map(d => ({ label: `YTD ${d.name}`, val: d.ytd })),
                          ...p.postTaxDeductions.map(d => ({ label: `YTD ${d.name}`, val: d.ytd })),
                          { label: 'YTD Net', val: p.ytdNet, bold: true },
                        ].filter(r => r.val != null).map(({ label, val, bold }) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                            <span style={{ fontSize: 12, fontWeight: bold ? 700 : 400, color: bold ? GREEN : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(val as number, sym)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PTO */}
                    {(p.ptoAccrued != null || p.ptoUsed != null || p.ptoRemaining != null) && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>PTO Balance</p>
                        <div style={{ display: 'flex', gap: 20 }}>
                          {p.ptoAccrued != null && <span style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Accrued:</span> {p.ptoAccrued}h</span>}
                          {p.ptoUsed != null && <span style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Used:</span> {p.ptoUsed}h</span>}
                          {p.ptoRemaining != null && <span style={{ fontSize: 12, fontWeight: 600, color: GREEN }}><span style={{ color: 'var(--text-muted)' }}>Remaining:</span> {p.ptoRemaining}h</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <ConfirmModal
        open={!!deletingId}
        title="Delete paystub?"
        message="This will remove the paystub from your history. Your current take-home pay setting will not change."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
