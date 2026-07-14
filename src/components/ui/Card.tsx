import { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  hover?: boolean
}

export function Card({ children, className = '', style, onClick, hover }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: '#FAFAFA',
        border: '1px solid #E4E4E4',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: hover ? 'box-shadow 0.15s, border-color 0.15s' : undefined,
        cursor: hover ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={hover ? e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)'
        ;(e.currentTarget as HTMLElement).style.borderColor = '#D0D0D0'
      } : undefined}
      onMouseLeave={hover ? e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
        ;(e.currentTarget as HTMLElement).style.borderColor = '#E4E4E4'
      } : undefined}
    >
      {children}
    </div>
  )
}
