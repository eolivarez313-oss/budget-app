import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input, Field } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

const OTP_EXPIRY = 600

export function Login() {
  const { signIn, user, resendVerification, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from ?? '/hub'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // OTP verification state (for unverified accounts)
  const [showOtp, setShowOtp] = useState(false)
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resendMsg, setResendMsg] = useState('')
  const [expiry, setExpiry] = useState(OTP_EXPIRY)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user])

  useEffect(() => {
    if (!showOtp || expiry <= 0) return
    const t = setTimeout(() => setExpiry(e => e - 1), 1000)
    return () => clearTimeout(t)
  }, [expiry, showOtp])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function formatExpiry(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setError(''); setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (!error) {
      navigate(from, { replace: true })
    } else if (error === 'EMAIL_NOT_CONFIRMED') {
      // Send a fresh OTP and show the verification UI
      await resendVerification(email)
      setShowOtp(true)
      setExpiry(OTP_EXPIRY)
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } else {
      setError(error)
    }
  }

  // OTP digit handling
  function handleDigitChange(i: number, value: string) {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = char
    setDigits(next)
    setOtpError('')
    if (char && i < 5) inputRefs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus()
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

  async function handleResend() {
    if (cooldown > 0) return
    await resendVerification(email)
    setCooldown(60)
    setExpiry(OTP_EXPIRY)
    setDigits(['', '', '', '', '', ''])
    setResendMsg('New code sent!')
    inputRefs.current[0]?.focus()
    setTimeout(() => setResendMsg(''), 4000)
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = digits.join('')
    if (token.length < 6) { setOtpError('Please enter all 6 digits.'); return }
    setOtpLoading(true); setOtpError('')
    const { error } = await verifyOtp(email, token, 'signup')
    setOtpLoading(false)
    if (error) { setOtpError(error); return }
    // Verified — now sign in
    await signIn(email, password)
  }

  // ── OTP verification screen ────────────────────────────────────────────────
  if (showOtp) {
    return (
      <AuthLayout
        title="Verify your email"
        subtitle={`We sent a 6-digit code to ${email}`}
      >
        <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            textAlign: 'center', fontSize: 'var(--text-micro)',
            color: expiry < 120 ? 'var(--danger)' : 'var(--text-muted)',
          }}>
            {expiry > 0 ? `Code expires in ${formatExpiry(expiry)}` : 'Code expired — resend below'}
          </div>

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
                style={{
                  width: 44, height: 52, textAlign: 'center',
                  fontSize: 22, fontWeight: 700, fontFamily: '"Fraunces", serif',
                  borderRadius: 10,
                  border: `1.5px solid ${otpError ? 'var(--danger)' : d ? 'var(--primary)' : 'var(--border)'}`,
                  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
                }}
              />
            ))}
          </div>

          {otpError && (
            <div style={{
              background: 'var(--danger-dim)', border: '1px solid oklch(0.56 0.15 25 / 0.2)',
              borderRadius: 'var(--r-md)', padding: '10px 14px',
              fontSize: 'var(--text-label)', color: 'var(--danger)', textAlign: 'center',
            }}>{otpError}</div>
          )}

          <Button type="submit" disabled={otpLoading || digits.some(d => !d) || expiry <= 0} style={{ width: '100%' }}>
            {otpLoading ? 'Verifying…' : 'Verify & sign in'}
          </Button>

          <div style={{ textAlign: 'center', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
            Didn't receive it?{' '}
            <button type="button" onClick={handleResend} disabled={cooldown > 0} style={{
              background: 'none', border: 'none', cursor: cooldown > 0 ? 'default' : 'pointer',
              color: 'var(--primary)', fontWeight: 500, fontSize: 'var(--text-label)',
              opacity: cooldown > 0 ? 0.5 : 1,
            }}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            {resendMsg && <span style={{ color: 'var(--success)', marginLeft: 6 }}>{resendMsg}</span>}
          </div>

          <p style={{ textAlign: 'center', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
            <button type="button" onClick={() => setShowOtp(false)} style={{
              background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500,
            }}>
              ← Back to login
            </button>
          </p>
        </form>
      </AuthLayout>
    )
  }

  // ── Login form ─────────────────────────────────────────────────────────────
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Meridian account">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {error && (
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
            <button type="button" onClick={() => setShowPass(p => !p)} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}>
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
