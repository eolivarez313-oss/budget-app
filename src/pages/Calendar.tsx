import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Clock, X, Edit2, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { WorkDay } from '../types'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseDate(str: string) {
  const [y, m, d] = str.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

export function Calendar() {
  const { state, dispatch } = useStore()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [editingHours, setEditingHours] = useState(false)
  const [draftHours, setDraftHours] = useState('')

  const { settings, transactions, dayOverrides } = state
  const hourlyRate = settings.hourlyRate ?? 0
  const hoursPerDay = settings.hoursPerDay ?? 8
  const workDays: WorkDay[] = settings.workDays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  function isWorkDay(dateStr: string): boolean {
    const { year: y, month: m, day: d } = parseDate(dateStr)
    const dow = new Date(y, m, d).getDay()
    const label = DAY_LABELS[dow] as WorkDay
    return workDays.includes(label)
  }

  function hoursForDay(dateStr: string): number | null {
    if (dateStr in dayOverrides) return dayOverrides[dateStr]
    if (isWorkDay(dateStr)) return hoursPerDay
    return null
  }

  function earnedForDay(dateStr: string): number {
    const h = hoursForDay(dateStr)
    if (h === null) return 0
    return h * hourlyRate
  }

  function spentForDay(dateStr: string): number {
    return transactions
      .filter(t => t.date === dateStr && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  }

  // Calendar grid
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  // Monthly summary
  const monthlyNet = useMemo(() => {
    let net = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = toDateStr(year, month, d)
      net += earnedForDay(ds) - spentForDay(ds)
    }
    return net
  }, [year, month, dayOverrides, transactions, settings])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelectedDay(null)
  }

  function openDay(dateStr: string) {
    setSelectedDay(dateStr)
    setEditingHours(false)
    setDraftHours(String(hoursForDay(dateStr) ?? 0))
  }

  function saveOverride() {
    const h = parseFloat(draftHours)
    if (!selectedDay) return
    if (isNaN(h) || h < 0) return
    if (h === 0 && !(selectedDay in dayOverrides) && !isWorkDay(selectedDay)) {
      setEditingHours(false)
      return
    }
    dispatch({ type: 'SET_DAY_OVERRIDE', payload: { date: selectedDay, hours: h } })
    setEditingHours(false)
  }

  function removeOverride() {
    if (!selectedDay) return
    dispatch({ type: 'REMOVE_DAY_OVERRIDE', payload: selectedDay })
    setEditingHours(false)
  }

  const selectedEarned = selectedDay ? earnedForDay(selectedDay) : 0
  const selectedSpent = selectedDay ? spentForDay(selectedDay) : 0
  const selectedNet = selectedEarned - selectedSpent
  const selectedHours = selectedDay ? hoursForDay(selectedDay) : null
  const selectedTxns = selectedDay
    ? transactions.filter(t => t.date === selectedDay && t.type === 'expense')
    : []
  const hasOverride = selectedDay ? selectedDay in dayOverrides : false

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n))
  const fmtDec = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CalendarDays size={20} color="var(--accent-foreground)" />
        </div>
        <div>
          <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Calendar
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Daily earnings & spending</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Calendar panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Month nav */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '16px 20px',
            border: '1px solid var(--border)', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={prevMonth} style={navBtn}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', minWidth: 160, textAlign: 'center' }}>
                  {MONTH_NAMES[month]} {year}
                </span>
                <button onClick={nextMonth} style={navBtn}>
                  <ChevronRight size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  padding: '6px 14px', borderRadius: 8,
                  background: monthlyNet >= 0 ? 'oklch(0.25 0.06 145)' : 'oklch(0.25 0.06 25)',
                  color: monthlyNet >= 0 ? 'oklch(0.75 0.18 145)' : 'oklch(0.75 0.18 25)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  Net this month: {monthlyNet >= 0 ? '+' : '-'}{fmt(monthlyNet)}
                </div>
                <button onClick={goToday} style={{
                  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
                  cursor: 'pointer', fontWeight: 500,
                }}>
                  Today
                </button>
              </div>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const ds = toDateStr(year, month, day)
                const isToday = ds === todayStr
                const isFuture = ds > todayStr
                const isSel = ds === selectedDay
                const earned = earnedForDay(ds)
                const spent = spentForDay(ds)
                const net = earned - spent
                const hasData = earned > 0 || spent > 0
                const hasOvr = ds in dayOverrides

                return (
                  <button
                    key={ds}
                    onClick={() => openDay(ds)}
                    style={{
                      padding: '8px 6px 6px',
                      borderRadius: 10,
                      border: isSel
                        ? '2px solid var(--primary)'
                        : isToday
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      background: isSel ? 'var(--primary-subtle, oklch(0.18 0.04 255))' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                      minHeight: 64,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{
                      fontSize: 12, fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                    }}>
                      {day}
                      {hasOvr && <span style={{ marginLeft: 2, fontSize: 8, verticalAlign: 'super', color: 'var(--primary)' }}>●</span>}
                    </span>
                    {hasData && !isFuture && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: net >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.72 0.18 25)',
                      }}>
                        {net >= 0 ? '+' : '-'}{fmt(net)}
                      </span>
                    )}
                    {!hasData && earned > 0 && isFuture && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
                        +{fmt(earned)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.72 0.18 145)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Positive day</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.72 0.18 25)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Negative day</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--primary)' }}>●</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Custom hours</span>
            </div>
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDay && (() => {
          const { year: sy, month: sm, day: sd } = parseDate(selectedDay)
          const dowLabel = DAY_LABELS[new Date(sy, sm, sd).getDay()]
          return (
            <div style={{
              width: 300, flexShrink: 0,
              background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
              padding: 20, position: 'sticky', top: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{dowLabel}</div>
                  <div style={{ fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                    {MONTH_NAMES[sm]} {sd}, {sy}
                  </div>
                </div>
                <button onClick={() => setSelectedDay(null)} style={{ ...navBtn, color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Earnings row */}
              <div style={detailCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earned</span>
                  {!editingHours && (
                    <button onClick={() => { setEditingHours(true); setDraftHours(String(selectedHours ?? 0)) }} style={smallBtn}>
                      <Edit2 size={12} /> Edit hours
                    </button>
                  )}
                </div>

                {editingHours ? (
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="number"
                        value={draftHours}
                        onChange={e => setDraftHours(e.target.value)}
                        min={0} max={24} step={0.5}
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 8,
                          border: '1px solid var(--border)', background: 'var(--background)',
                          color: 'var(--text)', fontSize: 14,
                        }}
                        autoFocus
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hrs</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveOverride} style={{ ...smallBtn, flex: 1, justifyContent: 'center', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none' }}>
                        <Check size={12} /> Save
                      </button>
                      {hasOverride && (
                        <button onClick={removeOverride} style={{ ...smallBtn, color: 'var(--text-muted)' }}>
                          Reset
                        </button>
                      )}
                      <button onClick={() => setEditingHours(false)} style={{ ...smallBtn, color: 'var(--text-muted)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'oklch(0.72 0.18 145)', fontFamily: '"Fraunces", serif' }}>
                        {fmtDec(selectedEarned)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      {selectedHours !== null
                        ? `${selectedHours}h × $${hourlyRate}/hr`
                        : 'No scheduled hours'}
                      {hasOverride && <span style={{ color: 'var(--primary)', fontSize: 10, fontWeight: 600 }}>(custom)</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Spending */}
              <div style={{ ...detailCard, marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Spent
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: selectedSpent > 0 ? 'oklch(0.72 0.18 25)' : 'var(--text-muted)', fontFamily: '"Fraunces", serif', marginBottom: 8 }}>
                  {fmtDec(selectedSpent)}
                </div>
                {selectedTxns.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No transactions recorded</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedTxns.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.72 0.18 25)', flexShrink: 0 }}>
                          −{fmtDec(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Net */}
              <div style={{
                marginTop: 10, padding: '12px 14px', borderRadius: 10,
                background: selectedNet >= 0 ? 'oklch(0.20 0.05 145)' : 'oklch(0.20 0.05 25)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Net</span>
                <span style={{
                  fontSize: 18, fontWeight: 700, fontFamily: '"Fraunces", serif',
                  color: selectedNet >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.72 0.18 25)',
                }}>
                  {selectedNet >= 0 ? '+' : ''}{fmtDec(selectedNet)}
                </span>
              </div>
            </div>
          )
        })()}
      </div>

      <style>{`
        @media (max-width: 700px) {
          .cal-outer { flex-direction: column !important; }
          .cal-detail { width: 100% !important; position: static !important; }
        }
      `}</style>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const detailCard: React.CSSProperties = {
  background: 'var(--background)', borderRadius: 10, padding: '12px 14px',
  border: '1px solid var(--border)',
}

const smallBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
  borderRadius: 6, border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
}
