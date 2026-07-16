import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input, Field } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function passwordRequirements(pw: string) {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'At least one letter', met: /[a-zA-Z]/.test(pw) },
    { label: 'At least one number', met: /[0-9]/.test(pw) },
  ]
}

// ── OTP entry screen ──────────────────────────────────────────────────────────

const OTP_EXPIRY_SECONDS = 600 // 10 minutes

interface OtpScreenProps {
  email: string
  onVerify: (token: string) => Promise<{ error: string | null }>
  onResend: () => Promise<void>
}

function OtpScreen({ email, onVerify, onResend }: OtpScreenProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resendMsg, setResendMsg] = useState('')
  const [expiry, setExpiry] = useState(OTP_EXPIRY_SECONDS)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown to expiry
  useEffect(() => {
    if (expiry <= 0) return
    const t = setTimeout(() => setExpiry(e => e - 1), 1000)
    return () => clearTimeout(t)
  }, [expiry])

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function formatExpiry(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  function handleDigitChange(i: number, value: string) {
    // Only keep last character, must be digit
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = char
    setDigits(next)
    setError('')
    if (char && i < 5) {
      inputRefs.current[i + 1]?.focus()
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = [...digits]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? ''
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = digits.join('')
    if (token.length < 6) { setError('Please enter all 6 digits.'); return }
    setLoading(true)
    setError('')
    const { error } = await onVerify(token)
    setLoading(false)
    if (error) setError(error)
  }

  async function handleResend() {
    if (cooldown > 0) return
    setError('')
    await onResend()
    setResendMsg('New code sent!')
    setCooldown(60)
    setExpiry(OTP_EXPIRY_SECONDS)
    setDigits(['', '', '', '', '', ''])
    inputRefs.current[0]?.focus()
    setTimeout(() => setResendMsg(''), 4000)
  }

  const allFilled = digits.every(d => d !== '')

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`We sent a 6-digit code to ${email}`}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Expiry notice */}
        <div style={{
          textAlign: 'center', fontSize: 'var(--text-micro)',
          color: expiry < 120 ? 'var(--danger)' : 'var(--text-muted)',
          transition: 'color 0.3s',
        }}>
          {expiry > 0
            ? `Code expires in ${formatExpiry(expiry)}`
            : 'Code expired — please request a new one below'}
        </div>

        {/* 6-digit boxes */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={d}
              onChange={e => handleDigitChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              autoFocus={i === 0}
              style={{
                width: 44, height: 52, textAlign: 'center',
                fontSize: 22, fontWeight: 700, fontFamily: '"Fraunces", serif',
                borderRadius: 10,
                border: `1.5px solid ${error ? 'var(--danger)' : d ? 'var(--primary)' : 'var(--border)'}`,
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid oklch(0.56 0.15 25 / 0.2)',
            borderRadius: 'var(--r-md)', padding: '10px 14px',
            fontSize: 'var(--text-label)', color: 'var(--danger)', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading || !allFilled || expiry <= 0} style={{ width: '100%' }}>
          {loading ? 'Verifying…' : 'Verify email'}
        </Button>

        {/* Resend */}
        <div style={{ textAlign: 'center', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
          Didn't receive it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            style={{
              background: 'none', border: 'none', cursor: cooldown > 0 ? 'default' : 'pointer',
              color: 'var(--primary)', fontWeight: 500, fontSize: 'var(--text-label)',
              opacity: cooldown > 0 ? 0.5 : 1,
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
          {resendMsg && <span style={{ color: 'var(--success)', marginLeft: 6 }}>{resendMsg}</span>}
        </div>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
          Wrong email?{' '}
          <Link to="/signup" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
            Go back
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

// ── Signup form ───────────────────────────────────────────────────────────────

export function Signup() {
  const { signUp, verifyOtp, resendVerification, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingOtp, setAwaitingOtp] = useState(false)

  useEffect(() => {
    if (user) navigate('/hub', { replace: true })
  }, [user])

  const emailError = emailTouched && email && !validateEmail(email) ? 'Please enter a valid email address.' : ''
  const reqs = passwordRequirements(password)
  const passwordValid = reqs.every(r => r.met)
  const confirmError = confirm && password !== confirm ? 'Passwords do not match.' : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailTouched(true)
    setError('')
    if (!validateEmail(email) || !passwordValid || password !== confirm) return

    setLoading(true)
    const { error, needsVerification } = await signUp(email, password)
    setLoading(false)

    if (error === 'EMAIL_EXISTS') {
      setError('An account with this email already exists.')
      return
    }
    if (error) { setError(error); return }
    if (needsVerification) setAwaitingOtp(true)
    else navigate('/hub', { replace: true })
  }

  if (awaitingOtp) {
    return (
      <OtpScreen
        email={email}
        onVerify={token => verifyOtp(email, token, 'signup')}
        onResend={() => resendVerification(email).then(() => {})}
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

          {password.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 2 }}>
              {reqs.map(req => (
                <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {req.met ? <Check size={12} color="var(--success)" /> : <X size={12} color="var(--text-dim)" />}
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
