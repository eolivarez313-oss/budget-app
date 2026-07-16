import { Info } from 'lucide-react'
import { TaxBreakdown as TaxBreakdownData } from '../lib/taxes'

interface Props {
  breakdown: TaxBreakdownData
  payFrequency: string
  compact?: boolean
  /** When provided, overrides the displayed net/take-home figures with a user-confirmed actual value */
  confirmedNetPay?: { perPeriod: number; annual: number }
}

const FREQ_LABEL: Record<string, string> = {
  weekly: 'week',
  biweekly: '2 weeks',
  'semi-monthly': 'semi-month',
  monthly: 'month',
}

export function TaxBreakdown({ breakdown, payFrequency, compact, confirmedNetPay }: Props) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)

  const fmtDec = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(n)

  const per = FREQ_LABEL[payFrequency] ?? 'period'

  const displayNetPay = confirmedNetPay?.perPeriod ?? breakdown.netPay
  const displayAnnualNet = confirmedNetPay?.annual ?? breakdown.annualNet
  const isCorrected = !!confirmedNetPay

  const rows: { label: string; value: number; annual: number; color?: string; bold?: boolean; indent?: boolean; tag?: string }[] = [
    { label: `Gross pay / ${per}`, value: breakdown.grossPay, annual: breakdown.annualGross, bold: true },
    ...(breakdown.preTaxDeductions > 0 ? [
      { label: 'Pre-tax deductions', value: -breakdown.preTaxDeductions, annual: -breakdown.annualPreTax, indent: true, color: 'var(--text-muted)' },
    ] : []),
    { label: 'Federal income tax', value: -breakdown.federalTax, annual: -breakdown.annualFederalTax, indent: true, color: 'oklch(0.72 0.18 25)' },
    { label: 'Social Security (6.2%)', value: -breakdown.socialSecurity, annual: -breakdown.annualSocialSecurity, indent: true, color: 'oklch(0.72 0.18 25)' },
    { label: 'Medicare (1.45%)', value: -breakdown.medicare, annual: -breakdown.annualMedicare, indent: true, color: 'oklch(0.72 0.18 25)' },
    ...(breakdown.stateTax > 0 ? [
      { label: 'State income tax', value: -breakdown.stateTax, annual: -breakdown.annualStateTax, indent: true, color: 'oklch(0.72 0.18 25)' },
    ] : []),
    { label: `Take-home / ${per}`, value: displayNetPay, annual: displayAnnualNet, bold: true, color: 'oklch(0.72 0.18 145)', tag: isCorrected ? 'corrected' : undefined },
  ]

  if (compact) {
    return (
      <div style={{
        background: 'var(--background)', borderRadius: 10, border: '1px solid var(--border)',
        padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingLeft: r.indent ? 12 : 0,
          }}>
            <span style={{
              fontSize: 12, color: r.bold ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: r.bold ? 600 : 400,
            }}>
              {r.indent && <span style={{ color: 'var(--border)', marginRight: 6 }}>−</span>}
              {r.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: r.bold ? 700 : 500, color: r.color ?? 'var(--text)' }}>
              {r.value < 0 ? `-${fmt(-r.value)}` : fmt(r.value)}
            </span>
          </div>
        ))}
        <div style={{
          marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 5,
        }}>
          <Info size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          Estimated take-home pay — actual withholding may vary based on your employer's payroll setup and your specific W-4 elections.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <StatCard label={`Gross / ${per}`} value={fmtDec(breakdown.grossPay)} />
        <StatCard label={`Net / ${per}`} value={fmtDec(displayNetPay)} highlight tag={isCorrected ? 'corrected' : undefined} />
        <StatCard label="Effective rate" value={`${breakdown.effectiveRate.toFixed(1)}%`} />
      </div>

      {/* Breakdown table */}
      <div style={{
        background: 'var(--background)', borderRadius: 12, border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto',
          padding: '8px 14px', borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <span>Item</span>
          <span style={{ textAlign: 'right', minWidth: 90 }}>Per {per}</span>
          <span style={{ textAlign: 'right', minWidth: 100 }}>Annual</span>
        </div>

        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto',
            padding: '9px 14px',
            paddingLeft: r.indent ? 26 : 14,
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
            background: r.bold ? 'var(--surface)' : 'transparent',
          }}>
            <span style={{
              fontSize: 13, color: r.bold ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: r.bold ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {r.indent && <span style={{ color: 'var(--border)' }}>−</span>}
              {r.label}
              {r.tag === 'corrected' && (
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: 'oklch(0.35 0.08 60 / 0.3)', color: 'oklch(0.72 0.14 60)',
                  padding: '1px 5px', borderRadius: 4 }}>corrected</span>
              )}
            </span>
            <span style={{
              fontSize: 13, fontWeight: r.bold ? 700 : 500,
              color: r.color ?? 'var(--text)',
              textAlign: 'right', minWidth: 90,
            }}>
              {r.value < 0 ? `-${fmtDec(-r.value)}` : fmtDec(r.value)}
            </span>
            <span style={{
              fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', minWidth: 100,
            }}>
              {r.annual < 0 ? `-${fmt(-r.annual)}` : fmt(r.annual)}
            </span>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 6,
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
        padding: '8px 12px', background: 'var(--surface)', borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <strong style={{ color: 'var(--text)' }}>Estimated take-home pay.</strong>{' '}
          Actual withholding may vary based on your employer's payroll setup, W-4 elections,
          and local taxes not included here. Based on 2025 IRS Publication 15-T tables.
        </span>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight, tag }: { label: string; value: string; highlight?: boolean; tag?: string }) {
  return (
    <div style={{
      background: highlight ? 'oklch(0.20 0.05 145)' : 'var(--background)',
      border: `1px solid ${highlight ? 'oklch(0.35 0.08 145)' : 'var(--border)'}`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        {tag === 'corrected' && (
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            background: 'oklch(0.35 0.08 60 / 0.3)', color: 'oklch(0.72 0.14 60)',
            padding: '1px 5px', borderRadius: 4 }}>corrected</span>
        )}
      </div>
      <div style={{
        fontSize: 16, fontWeight: 700, fontFamily: '"Fraunces", serif',
        color: highlight ? 'oklch(0.72 0.18 145)' : 'var(--text)',
      }}>{value}</div>
    </div>
  )
}
