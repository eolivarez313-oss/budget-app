import { ReactNode } from 'react'

interface BadgeProps { children: ReactNode; color?: string; className?: string }
export function Badge({ children, color = '#6b7280' }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
      background: color + '18', color,
      border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  )
}
