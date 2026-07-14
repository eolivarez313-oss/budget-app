interface ProgressBarProps {
  value: number
  max: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, max, size = 'md' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#06C68A'
  const h = size === 'sm' ? 4 : 6

  return (
    <div style={{ width: '100%', background: '#E4E4E4', borderRadius: 99, height: h, overflow: 'hidden' }}>
      <div style={{
        height: h, borderRadius: 99,
        width: `${pct}%`, background: color,
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}
