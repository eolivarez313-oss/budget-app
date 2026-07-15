import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input, Field } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Login() {
  const { signIn, user, resendVerification } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from ?? '/hub'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [unverified, setUnverified] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMsg, setResendMsg] = useState('')

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setError(''); setUnverified(false); setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (!error) {
      navigate(from, { replace: true })
    } else if (error === 'EMAIL_NOT_CONFIRMED') {
      setUnverified(true)
    } else {
      setError(error)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setResendMsg('')
    const { error } = await resendVerification(email)
    if (error) {
      setResendMsg('Could not resend — please try again.')
    } else {
      setResendMsg('Verification email sent!')
      setResendCooldown(60)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Meridian account">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Unverified email banner */}
        {unverified && (
          <div style={{
            background: 'var(--warning-dim)', border: '1px solid oklch(0.7 0.12 60 / 0.3)',
            borderRadius: 'var(--r-md)', padding: '12px 14px',
          }}>
            <p style={{ fontSize: 'var(--text-label)', color: 'oklch(0.5 0.1 60)', fontWeight: 500, marginBottom: 6 }}>
              Please verify your email before logging in.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              style={{
                fontSize: 'var(--text-label)', color: 'var(--primary)',
                background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                padding: 0, opacity: resendCooldown > 0 ? 0.5 : 1, fontWeight: 500,
              }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
            </button>
            {resendMsg && <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 4 }}>{resendMsg}</p>}
          </div>
        )}

        {/* General error */}
        {error && !unverified && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid oklch(0.56 0.15 25 / 0.2)',
            borderRadius: 'var(--r-md)', padding: '10px 14px',
            fontSize: 'var(--text-label)', color: 'var(--danger)',
          }}>{error}</div>
        )}

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

        <Field label="Password">
          <div style={{ position: 'relative' }}>
            <Input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center',
              }}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        <div style={{ textAlign: 'right', marginTop: -8 }}>
          <Link to="/forgot-password" style={{ fontSize: 'var(--text-label)', color: 'var(--primary)', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
