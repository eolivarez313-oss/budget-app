import { useEffect, useRef } from 'react'

interface AnimatedNumberProps {
  value: number
  format?: (v: number) => string
  duration?: number
  className?: string
  style?: React.CSSProperties
}

export function AnimatedNumber({ value, format, duration = 550, className, style }: AnimatedNumberProps) {
  const ref  = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const raf  = useRef<number | null>(null)

  useEffect(() => {
    const from = prev.current
    const to   = value
    prev.current = to
    if (from === to || !ref.current) return
    if (raf.current) cancelAnimationFrame(raf.current)

    const start = performance.now()
    const render = (now: number) => {
      const t      = Math.min((now - start) / duration, 1)
      const eased  = 1 - Math.pow(1 - t, 3)            // ease-out cubic
      const cur    = from + (to - from) * eased
      if (ref.current) {
        ref.current.textContent = format ? format(cur) : String(Math.round(cur))
      }
      if (t < 1) raf.current = requestAnimationFrame(render)
    }
    raf.current = requestAnimationFrame(render)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value, duration, format])

  return (
    <span ref={ref} className={className} style={style}>
      {format ? format(value) : value}
    </span>
  )
}
