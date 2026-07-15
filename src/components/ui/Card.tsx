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
  const base: CSSProperties = {
    background: '#FAFAFA',
    border: '1px solid #E4E4E4',
    borderRadius: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: hover ? 'pointer' : undefined,
    ...style,
  }

  if (hover) {
    return (
      <motion.div
        className={className}
        onClick={onClick}
        style={base}
        whileHover={{
          boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
          y: -2,
          borderColor: '#D0D0D0',
        } as any}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={className}
      style={base}
    >
      {children}
    </div>
  )
}
