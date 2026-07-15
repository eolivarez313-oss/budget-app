import type { CSSProperties, MouseEvent } from 'react'

// Shared motion standard — use these everywhere instead of ad-hoc values.
// Goal: responsive & alive, not slow or showy. 150–350ms range, ease-out.

export const EASE = [0.16, 1, 0.3, 1] as const          // spring-like ease-out
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const  // material ease

export const transitions = {
  fast:   { duration: 0.15, ease: EASE },
  base:   { duration: 0.22, ease: EASE },
  medium: { duration: 0.32, ease: EASE },
  slow:   { duration: 0.45, ease: EASE },
  page:   { duration: 0.22, ease: EASE_STANDARD },
  number: { duration: 0.55, ease: EASE },  // for count-up animations
  stagger: { staggerChildren: 0.06 },
} as const

export const cardVariants = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: transitions.medium },
}

export const pageVariants = {
  initial: { opacity: 0, y: 10, scale: 0.99 },
  animate: { opacity: 1, y: 0,  scale: 1    },
  exit:    { opacity: 0, y: -6, scale: 1.005 },
}

// 3D tilt — call onMouseMove/onMouseLeave on any element for card depth
export function get3DTiltStyle(
  e: MouseEvent<HTMLElement>,
  strength = 5,
): CSSProperties {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width  - 0.5
  const y = (e.clientY - rect.top)  / rect.height - 0.5
  return {
    transform: `perspective(800px) rotateX(${(-y * strength).toFixed(2)}deg) rotateY(${(x * strength).toFixed(2)}deg) translateY(-2px) translateZ(4px)`,
    transition: 'transform 0.08s ease, box-shadow 0.08s ease',
    boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
    willChange: 'transform',
  }
}

export const tilt3DReset: CSSProperties = {
  transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px) translateZ(0px)',
  transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease',
  boxShadow: 'none',
  willChange: 'transform',
}
