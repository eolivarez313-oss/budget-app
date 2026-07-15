import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input, Field } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function ForgotPassword() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await sendPasswordReset(email)
    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for this email, a reset link has been sent.">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 24 }}>🔑</span>
          </div>
          <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            The link expires after one hour. Check your spam folder if you don't see it.
          </p>
          <Link to="/login" style={{ fontSize: 'var(--text-label)', color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
            Back to login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new password."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" disabled={loading || !email} style={{ width: '100%' }}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
        Remembered it?{' '}
        <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
          Back to login
        </Link>
      </p>
    </AuthLayout>
  )
}
