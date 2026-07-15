import { ReactNode, CSSProperties } from 'react'
import { motion } from 'framer-motion'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  hover?: boolean
}

export function Card({ children, className = '', style, onClick, hover }: CardProps) {
  const cls = `card-surface${className ? ' ' + className : ''}`

  if (hover || onClick) {
    return (
      <motion.div
        className={cls}
        onClick={onClick}
        style={{ cursor: hover || onClick ? 'pointer' : undefined, ...style }}
        whileHover={{ background: 'var(--secondary)', y: -2 } as any}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}
