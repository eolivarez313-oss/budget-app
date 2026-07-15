import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Wordmark */}
      <Link to="/login" style={{ textDecoration: 'none', marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: '"Fraunces", ui-serif, Georgia, serif',
              fontSize: 18, fontWeight: 700, color: 'var(--accent-foreground)',
              letterSpacing: '-0.03em',
            }}>M</span>
          </div>
          <span style={{
            fontFamily: '"Fraunces", ui-serif, Georgia, serif',
            fontSize: 20, fontWeight: 700, color: 'var(--text)',
            letterSpacing: '-0.03em',
          }}>Meridian</span>
        </div>
      </Link>

      {/* Card */}
      <div className="card-surface" style={{
        width: '100%', maxWidth: 420,
        padding: '36px 32px',
      }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <h1 style={{
            fontFamily: '"Fraunces", ui-serif, Georgia, serif',
            fontSize: '1.5rem', fontWeight: 700,
            color: 'var(--text)', letterSpacing: '-0.03em',
            marginBottom: subtitle ? 8 : 0,
          }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
