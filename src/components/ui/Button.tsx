import { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', children, style, disabled, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, fontWeight: 500, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s, transform 0.1s, opacity 0.15s, box-shadow 0.15s',
    letterSpacing: '0.01em',
  }

  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--accent)',   color: '#fff',           borderColor: 'var(--accent)' },
    secondary: { background: 'rgba(255,255,255,0.06)', color: 'var(--text)', borderColor: 'var(--border)' },
    danger:    { background: 'var(--danger-dim)',     color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' },
    ghost:     { background: 'transparent',      color: 'var(--text-muted)', borderColor: 'transparent' },
  }

  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: '5px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '11px 22px', fontSize: 14 },
  }

  const hovers: Record<string, string> = {
    primary:   'var(--accent-hover)',
    secondary: 'rgba(255,255,255,0.1)',
    danger:    'rgba(239,68,68,0.2)',
    ghost:     'rgba(255,255,255,0.05)',
  }

  const disabledStyle: React.CSSProperties = disabled ? { opacity: 0.4 } : {}

  return (
    <button
      style={{ ...base, ...variants[variant], ...sizes[size], ...disabledStyle, ...style }}
      disabled={disabled}
      {...props}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = hovers[variant]
        props.onMouseEnter?.(e as any)
      }}
      onMouseLeave={e => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = variants[variant].background as string
        props.onMouseLeave?.(e as any)
      }}
    >
      {children}
    </button>
  )
}
