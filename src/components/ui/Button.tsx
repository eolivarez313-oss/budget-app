import { ReactNode, ButtonHTMLAttributes } from 'react'

const GREEN = '#06C68A'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
    border: '1px solid transparent', fontFamily: 'inherit',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  }

  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: GREEN, color: '#fff', borderColor: GREEN },
    secondary: { background: '#F0F0F0', color: '#374151', borderColor: '#E4E4E4' },
    danger:    { background: '#fff1f2', color: '#dc2626', borderColor: '#fecaca' },
    ghost:     { background: 'transparent', color: '#6b7280', borderColor: 'transparent' },
  }

  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: '5px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '11px 22px', fontSize: 14 },
  }

  const hovers: Record<string, string> = {
    primary: '#04b07a', secondary: '#f9fafb', danger: '#fee2e2', ghost: '#f5f6fa',
  }

  const disabledStyle: React.CSSProperties = props.disabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}

  return (
    <button
      style={{ ...base, ...variants[variant], ...sizes[size], ...disabledStyle, ...style }}
      {...props}
      onMouseEnter={e => { if (!props.disabled) (e.currentTarget as HTMLElement).style.background = hovers[variant] }}
      onMouseLeave={e => { if (!props.disabled) (e.currentTarget as HTMLElement).style.background = variants[variant].background as string }}
    >
      {children}
    </button>
  )
}
