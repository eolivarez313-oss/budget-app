import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

const GREEN = '#06C68A'

const base: React.CSSProperties = {
  width: '100%',
  background: '#F5F5F5',
  border: '1px solid #E4E4E4',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13.5,
  color: '#1A1F36',
  fontFamily: 'inherit',
  outline: 'none',
  lineHeight: 1.5,
  transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
}

interface FieldProps { label?: string; error?: string; children: ReactNode }
export function Field({ label, error, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: '#4B5563' }}>{label}</label>}
      {children}
      {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>{error}</p>}
    </div>
  )
}

export function Input({ style, onFocus, onBlur, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      style={{ ...base, ...style }}
      onFocus={e => {
        e.currentTarget.style.borderColor = GREEN
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(6,198,138,0.12)`
        e.currentTarget.style.background = '#fff'
        onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = '#E4E4E4'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.background = '#F5F5F5'
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
      {/* Custom chevron */}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 14, pointerEvents: 'none',
        }}
      >
        <path d="M5 7.5L10 12.5L15 7.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Textarea({ style, onFocus, onBlur, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      style={{ ...base, resize: 'none', ...style }}
      onFocus={e => {
        e.currentTarget.style.borderColor = GREEN
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(6,198,138,0.12)`
        e.currentTarget.style.background = '#fff'
        onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = '#E4E4E4'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.background = '#F5F5F5'
        onBlur?.(e)
      }}
      {...props}
    />
  )
}
