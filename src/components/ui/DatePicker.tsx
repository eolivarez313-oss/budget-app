import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import {
  format, parseISO, isValid, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameDay, isSameMonth,
} from 'date-fns'

const GREEN = '#06C68A'
const NAVY  = '#1A1F36'
const GRAY  = '#8A94A6'

interface DatePickerProps {
  value: string          // YYYY-MM-DD or ''
  onChange: (val: string) => void
  min?: string           // YYYY-MM-DD
  max?: string           // YYYY-MM-DD
  placeholder?: string
  style?: React.CSSProperties
  className?: string
}

export function DatePicker({ value, onChange, min, max, placeholder = 'Pick a date', style }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) { try { const d = parseISO(value); if (isValid(d)) return d } catch {} }
    return new Date()
  })

  useEffect(() => {
    if (value) {
      try { const d = parseISO(value); if (isValid(d)) setViewDate(d) } catch {}
    }
  }, [value])

  // Close on outside click (check against both trigger and portal)
  const portalRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (portalRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  function openCalendar() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  const selectedDate = value ? (() => { try { const d = parseISO(value); return isValid(d) ? d : null } catch { return null } })() : null
  const today = new Date()

  // Build full calendar grid (pad to complete weeks)
  const monthStart = startOfMonth(viewDate)
  const monthEnd   = endOfMonth(viewDate)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 0 })
  const days: Date[] = []
  let d = calStart
  while (d <= calEnd) { days.push(d); d = addDays(d, 1) }

  function selectDay(day: Date) {
    const str = format(day, 'yyyy-MM-dd')
    if (min && str < min) return
    if (max && str > max) return
    onChange(str)
    setOpen(false)
  }

  function isDisabled(day: Date): boolean {
    const str = format(day, 'yyyy-MM-dd')
    if (min && str < min) return true
    if (max && str > max) return true
    return false
  }

  // Compute popover position: below trigger by default, above if near bottom of viewport
  const popoverStyle: React.CSSProperties = rect ? (() => {
    const spaceBelow = window.innerHeight - rect.bottom
    const popH = 280 // approx popover height
    const top = spaceBelow >= popH || spaceBelow > rect.top
      ? rect.bottom + window.scrollY + 6
      : rect.top + window.scrollY - popH - 6
    // Align left of trigger, but clamp so it doesn't go off right edge
    const left = Math.min(rect.left + window.scrollX, window.innerWidth - 272)
    return { position: 'absolute', top, left, zIndex: 99999 }
  })() : { display: 'none' }

  const displayValue = selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        ref={btnRef}
        type="button"
        onClick={openCalendar}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8,
          border: `1px solid ${open ? GREEN : '#E4E4E4'}`,
          background: '#FAFAFA', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 13, color: displayValue ? NAVY : GRAY,
          textAlign: 'left', whiteSpace: 'nowrap', outline: 'none',
          boxShadow: open ? `0 0 0 2px ${GREEN}30` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <Calendar size={13} style={{ color: GRAY, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{displayValue || placeholder}</span>
      </button>

      {open && createPortal(
        <div ref={portalRef} style={popoverStyle}>
          <div style={{
            background: '#fff', border: '1px solid #E4E4E4', borderRadius: 12,
            boxShadow: '0 8px 28px rgba(27,32,48,0.14)', padding: '14px 16px',
            width: 256,
          }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button type="button"
                onClick={() => setViewDate(v => subMonths(v, 1))}
                style={navBtnStyle}>
                <ChevronLeft size={14} color={NAVY} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button type="button"
                onClick={() => setViewDate(v => addMonths(v, 1))}
                style={navBtnStyle}>
                <ChevronRight size={14} color={NAVY} />
              </button>
            </div>

            {/* Day-of-week labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(lbl => (
                <div key={lbl} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: GRAY }}>
                  {lbl}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {days.map((day, i) => {
                const selected  = selectedDate && isSameDay(day, selectedDate)
                const isToday   = isSameDay(day, today)
                const inMonth   = isSameMonth(day, viewDate)
                const disabled  = isDisabled(day)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => !disabled && selectDay(day)}
                    style={{
                      width: 32, height: 32, borderRadius: 6, border: 'none', fontFamily: 'inherit',
                      background: selected ? GREEN : 'transparent',
                      color: selected ? '#fff' : disabled ? '#D0D0D0' : inMonth ? NAVY : '#C0C8D8',
                      fontSize: 12, fontWeight: selected || isToday ? 600 : 400,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      outline: isToday && !selected ? `2px solid ${GREEN}` : 'none',
                      outlineOffset: -2,
                      opacity: disabled ? 0.45 : 1,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!disabled && !selected) (e.currentTarget as HTMLElement).style.background = '#F0F2F5' }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            {/* Today shortcut */}
            <div style={{ marginTop: 10, textAlign: 'center', borderTop: '1px solid #F0F0F0', paddingTop: 10 }}>
              <button
                type="button"
                onClick={() => { selectDay(today); setViewDate(today) }}
                style={{ fontSize: 12, color: GREEN, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Today
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid #E4E4E4',
  background: '#F5F5F5', cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontFamily: 'inherit',
}
