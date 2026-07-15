interface ProgressBarProps {
  value:      number
  max:        number
  size?:      'sm' | 'md'
  color?:     string
}

export function ProgressBar({ value, max, size = 'md', color }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const resolvedColor = color ?? (pct >= 100 ? 'var(--destructive)' : pct >= 80 ? 'oklch(0.55 0.13 60)' : 'var(--primary)')
  const h = size === 'sm' ? 4 : 6

  return (
    <div style={{ width: '100%', background: 'var(--secondary)', borderRadius: 99, height: h, overflow: 'hidden' }}>
      <div style={{
        height: h, borderRadius: 99,
        width: `${pct}%`, background: resolvedColor,
        transition: 'width 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />
    </div>
  )
}
