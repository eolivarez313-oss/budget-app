import { ReactNode, CSSProperties, useState } from 'react'
import { get3DTiltStyle, tilt3DReset } from '../../utils/motion'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  hover?: boolean
}

export function Card({ children, className = '', style, onClick, hover }: CardProps) {
  const cls = `card-surface${className ? ' ' + className : ''}`
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({})

  if (hover || onClick) {
    return (
      <div
        className={cls}
        onClick={onClick}
        style={{ cursor: 'pointer', ...style, ...tiltStyle }}
        onMouseMove={e => setTiltStyle(get3DTiltStyle(e, 4))}
        onMouseLeave={() => setTiltStyle(tilt3DReset)}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}
