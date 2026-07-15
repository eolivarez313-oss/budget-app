import { ReactNode, CSSProperties } from 'react'
import { motion } from 'framer-motion'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  hover?: boolean
}

const base: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
}

export function Card({ children, className = '', style, onClick, hover }: CardProps) {
  const merged = { ...base, cursor: hover || onClick ? 'pointer' : undefined, ...style }

  if (hover || onClick) {
    return (
      <motion.div
        className={className}
        onClick={onClick}
        style={merged}
        whileHover={{ background: 'var(--surface-hover)', y: -2 } as any}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={className} style={merged}>
      {children}
    </div>
  )
}
