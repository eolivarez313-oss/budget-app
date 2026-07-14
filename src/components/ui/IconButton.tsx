import { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'default' | 'danger'
  size?: 'sm' | 'md'
}

export function IconButton({ children, variant = 'default', size = 'md', style, ...props }: IconButtonProps) {
  const sz = size === 'sm' ? 26 : 30
  const pad = size === 'sm' ? 5 : 6

  const hoverBg = variant === 'danger' ? '#fee2e2' : '#EBEBEB'
  const hoverColor = variant === 'danger' ? '#dc2626' : '#374151'

  return (
    <button
      style={{
        width: sz, height: sz,
        padding: pad,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'transparent',
        borderRadius: 6, cursor: 'pointer',
        color: '#B0B8C8',
        transition: 'all 0.15s',
        flexShrink: 0,
        ...style,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = hoverBg
        el.style.color = hoverColor
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.color = '#B0B8C8'
      }}
      {...props}
    >
      {children}
    </button>
  )
}
