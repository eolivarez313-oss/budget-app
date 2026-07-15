import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { transitions } from '../utils/motion'

// ─── SVG layout constants ─────────────────────────────────────────────────────
const NODE_W   = 14
const NODE_GAP = 14
const REF_H    = 500   // pixel height = 100% of income
const MIN_H    = 18
const PAD_TOP  = 30
const PAD_BTM  = 30
const SVG_W    = 1020
// Column left-edges (room for left labels and right labels)
const COL_X = [150, 340, 590, 840] as [number, number, number, number]

// ─── Color palette ────────────────────────────────────────────────────────────
const INCOME_COLOR        = 'oklch(0.72 0.13 68)'
const SAVINGS_COLOR       = 'oklch(0.46 0.09 155)'
const FIXED_COLOR         = 'oklch(0.56 0.14 28)'
const DISCRETIONARY_COLOR = 'oklch(0.50 0.10 240)'
const UNSPENT_COLOR       = 'oklch(0.62 0.03 100)'

const SAVINGS_RE = /savings?|invest|goal|emergency|401k|ira|transfer/i

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scaleH(value: number, total: number): number {
  if (total <= 0) return MIN_H
  return Math.max(MIN_H, Math.round((value / total) * REF_H))
}

function stackNodes(values: number[], total: number): { y: number; h: number }[] {
  const hs = values.map(v => scaleH(v, total))
  const totalH = hs.reduce((s, h) => s + h, 0) + NODE_GAP * Math.max(0, hs.length - 1)
  let y = PAD_TOP + Math.max(0, (REF_H - totalH) / 2)
  return hs.map(h => {
    const pos = { y, h }
    y += h + NODE_GAP
    return pos
  })
}

// Smooth S-curve ribbon
function ribbonPath(
  sx: number, sy: number, sh: number,
  tx: number, ty: number, th: number,
): string {
  const cpx = sx + (tx - sx) * 0.5
  return (
    `M${sx},${sy} ` +
    `C${cpx},${sy} ${cpx},${ty} ${tx},${ty} ` +
    `L${tx},${ty + th} ` +
    `C${cpx},${ty + th} ${cpx},${sy + sh} ${sx},${sy + sh} ` +
    `Z`
  )
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtAmt(n: number, sym = '$'): string {
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`
  return `${sym}${Math.round(n).toLocaleString()}`
}

function pct(value: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AllocGroup {
  key: string
  label: string
  color: string
  total: number
  cats: { id: string; name: string; icon: string; amount: number }[]
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Flow() {
  const { state } = useStore()
  const transactions  = state.transactions  ?? []
  const categories    = state.categories    ?? []
  const subscriptions = state.subscriptions ?? []
  const settings      = state.settings      ?? {}
  const sym = settings.currencySymbol ?? '$'

  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null)

  const month = currentMonth()

  // ── Compute source data ────────────────────────────────────────────────────
  const data = useMemo(() => {
    const incomeTxs  = transactions.filter((t: any) => t.type === 'income'  && String(t.date ?? '').startsWith(month))
    const expenseTxs = transactions.filter((t: any) => t.type === 'expense' && String(t.date ?? '').startsWith(month))

    const billCatIds = new Set<string>(
      subscriptions
        .filter((s: any) => s.status === 'active' || s.active)
        .map((s: any) => s.categoryId)
        .filter(Boolean),
    )
    const savingsCatIds = new Set<string>(
      categories.filter((c: any) => SAVINGS_RE.test(c.name ?? '')).map((c: any) => c.id),
    )

    let totalIncome: number = incomeTxs.reduce((s: number, t: any) => s + (t.amount ?? 0), 0)
    if (totalIncome === 0) totalIncome = settings.monthlyIncome ?? settings.paycheckAmount ?? 0

    // Income sources grouped by category
    const incomeByCat: Record<string, { name: string; icon: string; amount: number }> = {}
    for (const t of incomeTxs) {
      const cat = categories.find((c: any) => c.id === t.categoryId)
      const key = cat?.id ?? 'paycheck'
      if (!incomeByCat[key]) incomeByCat[key] = { name: cat?.name ?? 'Paycheck', icon: cat?.icon ?? '💵', amount: 0 }
      incomeByCat[key].amount += t.amount ?? 0
    }
    let incomeSources = Object.entries(incomeByCat).map(([id, v]) => ({ id, ...v }))
    if (incomeSources.length === 0 && totalIncome > 0) {
      incomeSources = [{ id: 'paycheck', name: 'Paycheck', icon: '💵', amount: totalIncome }]
    }

    // Expense groups
    const groups: Record<string, AllocGroup> = {
      savings:       { key: 'savings',       label: 'Savings',     color: SAVINGS_COLOR,       total: 0, cats: [] },
      fixed:         { key: 'fixed',         label: 'Fixed Costs', color: FIXED_COLOR,         total: 0, cats: [] },
      discretionary: { key: 'discretionary', label: 'Spending',    color: DISCRETIONARY_COLOR, total: 0, cats: [] },
    }

    const catAmounts: Record<string, number> = {}
    for (const t of expenseTxs) {
      if (!t.categoryId) continue
      catAmounts[t.categoryId] = (catAmounts[t.categoryId] ?? 0) + (t.amount ?? 0)
    }

    for (const [catId, amount] of Object.entries(catAmounts)) {
      const cat = categories.find((c: any) => c.id === catId)
      const entry = { id: catId, name: cat?.name ?? 'Other', icon: cat?.icon ?? '📂', amount: amount as number }
      if (savingsCatIds.has(catId)) {
        groups.savings.total += amount as number; groups.savings.cats.push(entry)
      } else if (billCatIds.has(catId)) {
        groups.fixed.total += amount as number; groups.fixed.cats.push(entry)
      } else {
        groups.discretionary.total += amount as number; groups.discretionary.cats.push(entry)
      }
    }

    const totalSpent = groups.savings.total + groups.fixed.total + groups.discretionary.total
    const unspent = Math.max(0, totalIncome - totalSpent)

    const allocs: AllocGroup[] = [
      groups.savings,
      groups.fixed,
      groups.discretionary,
      ...(unspent > 100 ? [{ key: 'unspent', label: 'Unspent', color: UNSPENT_COLOR, total: unspent, cats: [] }] : []),
    ].filter(a => a.total > 0)

    return { incomeSources, totalIncome, allocs, unspent }
  }, [transactions, categories, subscriptions, settings, month])

  // ── Build Sankey layout ────────────────────────────────────────────────────
  const sankey = useMemo(() => {
    const { incomeSources, totalIncome, allocs } = data
    if (totalIncome <= 0) return null

    const col1 = stackNodes(incomeSources.map(s => s.amount), totalIncome)
    const col2 = [{ y: PAD_TOP, h: REF_H }]
    const col3 = stackNodes(allocs.map(a => a.total), totalIncome)

    // Col 4: categories grouped under their allocation, centered within the alloc band
    const col4Groups: { items: { y: number; h: number }[] }[] = []
    for (let i = 0; i < allocs.length; i++) {
      const alloc = allocs[i]
      const allocPos = col3[i]
      if (alloc.cats.length === 0) {
        col4Groups.push({ items: [{ y: allocPos.y, h: allocPos.h }] })
        continue
      }
      const catHs   = alloc.cats.map(c => scaleH(c.amount, totalIncome))
      const totalCH = catHs.reduce((s, h) => s + h, 0) + NODE_GAP * (catHs.length - 1)
      let cy = allocPos.y + (allocPos.h - totalCH) / 2
      if (cy < PAD_TOP) cy = PAD_TOP
      const items = catHs.map(h => { const pos = { y: cy, h }; cy += h + NODE_GAP; return pos })
      col4Groups.push({ items })
    }

    // ── Ribbons ───────────────────────────────────────────────────────────────
    const ribbons: { id: string; path: string; color: string; opacity: number; value: number; label: string }[] = []

    // Col 1 → Col 2
    let tgtY2 = col2[0].y
    for (let i = 0; i < incomeSources.length; i++) {
      const src = col1[i]
      const v = incomeSources[i].amount
      const th = scaleH(v, totalIncome)
      ribbons.push({ id: `src-${i}`, path: ribbonPath(COL_X[0] + NODE_W, src.y, src.h, COL_X[1], tgtY2, th), color: INCOME_COLOR, opacity: 0.30, value: v, label: incomeSources[i].name })
      tgtY2 += th
    }

    // Col 2 → Col 3
    let srcY2 = col2[0].y
    for (let i = 0; i < allocs.length; i++) {
      const tgt = col3[i]
      const v = allocs[i].total
      const sh = scaleH(v, totalIncome)
      ribbons.push({ id: `alloc-${allocs[i].key}`, path: ribbonPath(COL_X[1] + NODE_W, srcY2, sh, COL_X[2], tgt.y, tgt.h), color: allocs[i].color, opacity: 0.30, value: v, label: allocs[i].label })
      srcY2 += sh
    }

    // Col 3 → Col 4
    for (let i = 0; i < allocs.length; i++) {
      const alloc = allocs[i]
      if (alloc.cats.length === 0) continue
      const srcPos = col3[i]
      const group = col4Groups[i]
      let srcY3 = srcPos.y
      for (let j = 0; j < alloc.cats.length; j++) {
        const cat = alloc.cats[j]
        const tgt = group.items[j]
        if (!tgt) continue
        const v = cat.amount
        const sh = scaleH(v, totalIncome)
        ribbons.push({ id: `cat-${cat.id}`, path: ribbonPath(COL_X[2] + NODE_W, srcY3, sh, COL_X[3], tgt.y, tgt.h), color: alloc.color, opacity: 0.24, value: v, label: cat.name })
        srcY3 += sh
      }
    }

    const maxY = Math.max(
      ...col1.map(n => n.y + n.h),
      ...col3.map(n => n.y + n.h),
      ...col4Groups.flatMap(g => g.items.map(i => i.y + i.h)),
    )
    const svgH = Math.max(REF_H + PAD_TOP + PAD_BTM, maxY + PAD_BTM + 40)

    return { col1, col2, col3, col4Groups, incomeSources: data.incomeSources, allocs, ribbons, svgH, totalIncome }
  }, [data])

  if (!sankey) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
        <TrendingUp size={36} color="var(--text-dim)" strokeWidth={1.5} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
          No income data for this month. Add income transactions or set a monthly income in Settings.
        </p>
      </div>
    )
  }

  const { col1, col2, col3, col4Groups, incomeSources, allocs, ribbons, svgH, totalIncome } = sankey

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: '"Fraunces", ui-serif, Georgia, serif',
          fontSize: 28, fontWeight: 700, color: 'var(--text)',
          letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
        }}>Flow</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Where your money comes from — and where it goes.
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 24, flexWrap: 'wrap' }}>
        {allocs.map(a => (
          <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              {a.label} · {fmtAmt(a.total, sym)} ({pct(a.total, totalIncome)})
            </span>
          </div>
        ))}
      </div>

      {/* Sankey SVG */}
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${SVG_W} ${svgH}`} style={{ width: '100%', minWidth: 680, height: 'auto', display: 'block' }}>

          {/* Column header labels */}
          {(['SOURCES', 'INCOME', 'GROUPS', 'CATEGORIES'] as const).map((label, ci) => (
            <text key={label} x={COL_X[ci] + NODE_W / 2} y={PAD_TOP - 14}
              textAnchor="middle" fill="var(--text-dim)"
              fontSize={8} fontFamily="Inter, sans-serif" letterSpacing={1} fontWeight={600}>
              {label}
            </text>
          ))}

          {/* Ribbons (behind nodes) */}
          {ribbons.map(r => (
            <path
              key={r.id}
              d={r.path}
              fill={r.color}
              fillOpacity={hovered === r.id ? 0.68 : r.opacity}
              style={{ cursor: 'crosshair', transition: 'fill-opacity 0.15s ease' }}
              onMouseEnter={e => { setHovered(r.id); setTooltip({ x: e.clientX, y: e.clientY, label: r.label, value: r.value }) }}
              onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
              onMouseLeave={() => { setHovered(null); setTooltip(null) }}
            />
          ))}

          {/* Column 1: Income source nodes */}
          {col1.map((pos, i) => {
            const src = incomeSources[i]
            const showSub = pos.h >= 28
            return (
              <g key={`src-${i}`}>
                <rect x={COL_X[0]} y={pos.y} width={NODE_W} height={pos.h} fill={INCOME_COLOR} rx={3} />
                <text x={COL_X[0] - 10} y={pos.y + pos.h / 2 - (showSub ? 6 : 0)}
                  textAnchor="end" dominantBaseline="middle"
                  fill="var(--text)" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={500}>
                  {src.icon} {src.name}
                </text>
                {showSub && (
                  <text x={COL_X[0] - 10} y={pos.y + pos.h / 2 + 8}
                    textAnchor="end" dominantBaseline="middle"
                    fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">
                    {fmtAmt(src.amount, sym)} · {pct(src.amount, totalIncome)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Column 2: Income total node */}
          {col2.map(pos => (
            <g key="income-node">
              <rect x={COL_X[1]} y={pos.y} width={NODE_W} height={pos.h} fill={INCOME_COLOR} rx={3} />
              <text x={COL_X[1] + NODE_W / 2} y={pos.y + pos.h + 14}
                textAnchor="middle" dominantBaseline="hanging"
                fill="var(--text)" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600}>
                {fmtAmt(totalIncome, sym)}
              </text>
              <text x={COL_X[1] + NODE_W / 2} y={pos.y + pos.h + 28}
                textAnchor="middle" dominantBaseline="hanging"
                fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">
                total income
              </text>
            </g>
          ))}

          {/* Column 3: Allocation group nodes */}
          {col3.map((pos, i) => {
            const alloc = allocs[i]
            const showSub = pos.h >= 28
            return (
              <g key={`alloc-${alloc.key}`}>
                <rect x={COL_X[2]} y={pos.y} width={NODE_W} height={pos.h} fill={alloc.color} rx={3} />
                <text x={COL_X[2] + NODE_W + 10} y={pos.y + pos.h / 2 - (showSub ? 6 : 0)}
                  textAnchor="start" dominantBaseline="middle"
                  fill="var(--text)" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600}>
                  {alloc.label}
                </text>
                {showSub && (
                  <text x={COL_X[2] + NODE_W + 10} y={pos.y + pos.h / 2 + 8}
                    textAnchor="start" dominantBaseline="middle"
                    fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">
                    {fmtAmt(alloc.total, sym)} · {pct(alloc.total, totalIncome)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Column 4: Category nodes */}
          {allocs.map((alloc, i) => {
            if (alloc.cats.length === 0) {
              const pos = col3[i]
              return (
                <g key={`uncat-${alloc.key}`}>
                  <rect x={COL_X[3]} y={pos.y} width={NODE_W} height={pos.h} fill={alloc.color} rx={3} />
                  <text x={COL_X[3] + NODE_W + 10} y={pos.y + pos.h / 2}
                    textAnchor="start" dominantBaseline="middle"
                    fill="var(--text-muted)" fontSize={10} fontFamily="Inter, sans-serif">
                    {alloc.label}
                  </text>
                </g>
              )
            }
            return alloc.cats.map((cat, j) => {
              const pos = col4Groups[i]?.items[j]
              if (!pos) return null
              const showSub = pos.h >= 26
              return (
                <g key={`cat-${cat.id}`}>
                  <rect x={COL_X[3]} y={pos.y} width={NODE_W} height={pos.h} fill={alloc.color} rx={3} />
                  <text x={COL_X[3] + NODE_W + 10} y={pos.y + pos.h / 2 - (showSub ? 5 : 0)}
                    textAnchor="start" dominantBaseline="middle"
                    fill="var(--text)" fontSize={10} fontFamily="Inter, sans-serif">
                    {cat.icon} {cat.name.length > 18 ? cat.name.slice(0, 16) + '…' : cat.name}
                  </text>
                  {showSub && (
                    <text x={COL_X[3] + NODE_W + 10} y={pos.y + pos.h / 2 + 7}
                      textAnchor="start" dominantBaseline="middle"
                      fill="var(--text-muted)" fontSize={8.5} fontFamily="Inter, sans-serif">
                      {fmtAmt(cat.amount, sym)}
                    </text>
                  )}
                </g>
              )
            })
          })}
        </svg>
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={transitions.fast}
            style={{
              position: 'fixed',
              left: tooltip.x + 14,
              top: tooltip.y - 20,
              pointerEvents: 'none',
              zIndex: 9999,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '8px 12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{tooltip.label}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
              {sym}{tooltip.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 36 }}>
        <div className="card-surface" style={{ padding: '16px 18px' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Total Income</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
            {sym}{totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        {allocs.filter(a => a.key !== 'unspent').map(a => (
          <div key={a.key} className="card-surface" style={{ padding: '16px 18px', borderLeft: `3px solid ${a.color}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{a.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
              {sym}{a.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>{pct(a.total, totalIncome)} of income</p>
          </div>
        ))}
        {data.unspent > 0 && (
          <div className="card-surface" style={{ padding: '16px 18px', borderLeft: `3px solid ${UNSPENT_COLOR}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Net Saved</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.03em', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
              {sym}{data.unspent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>{pct(data.unspent, totalIncome)} of income</p>
          </div>
        )}
      </div>
    </div>
  )
}
