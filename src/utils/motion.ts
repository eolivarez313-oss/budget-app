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
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
}
