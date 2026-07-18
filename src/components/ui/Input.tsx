import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

const base: React.CSSProperties = {
  width: '100%',
  background: 'var(--secondary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '10px 12px',
  fontSize: 'var(--text-label)',
  color: 'var(--text)',
  outline: 'none',
  lineHeight: 1.5,
  transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
}

interface FieldProps { label?: ReactNode; error?: string; children: ReactNode }
export function Field({ label, error, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>}
      {children}
      {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 2 }}>{error}</p>}
    </div>
  )
}

export function Input({ style, onFocus, onBlur, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      style={{ ...base, ...style }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--ring)'
        e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.42 0.075 155 / 0.12)'
        e.currentTarget.style.background = 'var(--card)'
        onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.background = 'var(--secondary)'
        onBlur?.(e)
      }}
      {...props}
    />
  )
}

export function Select({ style, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <select
        style={{
          ...base,
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          paddingRight: 36,
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 14, pointerEvents: 'none',
        }}
      >
        <path d="M5 7.5L10 12.5L15 7.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Textarea({ style, onFocus, onBlur, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      style={{ ...base, resize: 'none', ...style }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--ring)'
        e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.42 0.075 155 / 0.12)'
        e.currentTarget.style.background = 'var(--card)'
        onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.background = 'var(--secondary)'
        onBlur?.(e)
      }}
      {...props}
    />
  )
}
