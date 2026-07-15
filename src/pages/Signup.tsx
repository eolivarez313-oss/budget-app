import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input, Field } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface PasswordReq { label: string; met: boolean }

function passwordRequirements(pw: string): PasswordReq[] {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'At least one letter', met: /[a-zA-Z]/.test(pw) },
    { label: 'At least one number', met: /[0-9]/.test(pw) },
  ]
}

function isPasswordValid(pw: string) {
  return passwordRequirements(pw).every(r => r.met)
}

interface CheckEmailProps {
  email: string
  onResend: () => Promise<void>
}

function CheckEmailScreen({ email, onResend }: CheckEmailProps) {
  const [cooldown, setCooldown] = useState(0)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleResend() {
    if (cooldown > 0) return
    await onResend()
    setMsg('Email resent!')
    setCooldown(60)
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`We sent a verification link to ${email}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 24 }}>✉️</span>
        </div>

        <div style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <p>Click the link in the email to verify your account.</p>
          <p style={{ marginTop: 8 }}>Can't find it? Check your spam folder.</p>
        </div>

        <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)', marginBottom: 10 }}>
            Didn't receive it?
          </p>
          <button
            onClick={handleResend}
            disabled={cooldown > 0}
            style={{
              fontSize: 'var(--text-label)', color: 'var(--primary)', fontWeight: 500,
              background: 'none', border: 'none', cursor: cooldown > 0 ? 'default' : 'pointer',
              opacity: cooldown > 0 ? 0.5 : 1,
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
          </button>
          {msg && <p style={{ fontSize: 'var(--text-micro)', color: 'var(--success)', marginTop: 6 }}>{msg}</p>}
        </div>

        <p style={{ fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
          Already verified?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export function Signup() {
  const { signUp, resendVerification, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (user) navigate('/hub', { replace: true })
  }, [user])

  const emailError = emailTouched && email && !validateEmail(email) ? 'Please enter a valid email address.' : ''
  const reqs = passwordRequirements(password)
  const passwordValid = isPasswordValid(password)
  const confirmError = confirm && password !== confirm ? 'Passwords do not match.' : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailTouched(true)
    setError('')

    if (!validateEmail(email)) return
    if (!passwordValid) return
    if (password !== confirm) return

    setLoading(true)
    const { error, needsVerification } = await signUp(email, password)
    setLoading(false)

    if (error === 'EMAIL_EXISTS') {
      setError('An account with this email already exists.')
      return
    }
    if (error) {
      setError(error)
      return
    }
    if (needsVerification) {
      setDone(true)
    } else {
      navigate('/hub', { replace: true })
    }
  }

  if (done) {
    return (
      <CheckEmailScreen
        email={email}
        onResend={async () => { await resendVerification(email) }}
      />
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start managing your finances with Meridian">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {error && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid oklch(0.56 0.15 25 / 0.2)',
            borderRadius: 'var(--r-md)', padding: '10px 14px',
            fontSize: 'var(--text-label)', color: 'var(--danger)',
          }}>
            {error}
            {error.includes('already exists') && (
              <>{' '}<Link to="/login" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>Log in instead.</Link></>
            )}
          </div>
        )}

        <Field label="Email" error={emailError}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            required
          />
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Password">
            <div style={{ position: 'relative' }}>
              <Input
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPass(p => !p)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center',
              }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          {/* Live password requirements */}
          {password.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 2 }}>
              {reqs.map(req => (
                <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {req.met
                    ? <Check size={12} color="var(--success)" />
                    : <X size={12} color="var(--text-dim)" />
                  }
                  <span style={{
                    fontSize: 'var(--text-micro)',
                    color: req.met ? 'var(--success)' : 'var(--text-dim)',
                    transition: 'color 0.15s',
                  }}>{req.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Confirm password" error={confirmError}>
          <div style={{ position: 'relative' }}>
            <Input
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={{ paddingRight: 44 }}
            />
            <button type="button" onClick={() => setShowConfirm(p => !p)} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}>
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        <Button
          type="submit"
          disabled={loading || !passwordValid || !!confirmError}
          style={{ width: '100%', marginTop: 4 }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
