import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input, Field } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

function passwordRequirements(pw: string) {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'At least one letter', met: /[a-zA-Z]/.test(pw) },
    { label: 'At least one number', met: /[0-9]/.test(pw) },
  ]
}

const OTP_EXPIRY_SECONDS = 600

type Step = 'email' | 'otp' | 'done'

export function ForgotPassword() {
  const { sendPasswordReset, verifyOtp, updatePassword } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  // OTP step
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resendMsg, setResendMsg] = useState('')
  const [expiry, setExpiry] = useState(OTP_EXPIRY_SECONDS)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Password step (shown alongside OTP)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (step !== 'otp') return
    if (expiry <= 0) return
    const t = setTimeout(() => setExpiry(e => e - 1), 1000)
    return () => clearTimeout(t)
  }, [expiry, step])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Redirect to login after success
  useEffect(() => {
    if (step !== 'done') return
    const t = setTimeout(() => navigate('/login', { replace: true }), 2500)
    return () => clearTimeout(t)
  }, [step])

  function formatExpiry(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailLoading(true)
    await sendPasswordReset(email)
    setEmailLoading(false)
    setStep('otp')
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }

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
    await sendPasswordReset(email)
    setCooldown(60)
    setExpiry(OTP_EXPIRY_SECONDS)
    setDigits(['', '', '', '', '', ''])
    setResendMsg('New code sent!')
    inputRefs.current[0]?.focus()
    setTimeout(() => setResendMsg(''), 4000)
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = digits.join('')
    if (token.length < 6) { setOtpError('Please enter all 6 digits.'); return }
    if (!reqs.every(r => r.met)) { setOtpError('Please choose a valid new password.'); return }
    if (password !== confirm) { setOtpError('Passwords do not match.'); return }

    setOtpLoading(true)
    setOtpError('')

    // Verify OTP first — this creates a recovery session
    const { error: otpErr } = await verifyOtp(email, token, 'recovery')
    if (otpErr) {
      setOtpLoading(false)
      setOtpError(otpErr)
      return
    }

    // Now set the new password in the recovery session
    const { error: pwErr } = await updatePassword(password)
    setOtpLoading(false)
    if (pwErr) {
      setOtpError(pwErr)
      return
    }

    setStep('done')
  }

  const reqs = passwordRequirements(password)
  const allDigitsFilled = digits.every(d => d !== '')

  // ── Step: email ──────────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="Enter your email and we'll send you a 6-digit code."
      >
        <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          <Button type="submit" disabled={emailLoading || !email} style={{ width: '100%' }}>
            {emailLoading ? 'Sending…' : 'Send reset code'}
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

  // ── Step: done ───────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <AuthLayout title="Password updated" subtitle="Your password has been changed. Redirecting to login…">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={24} color="var(--accent-foreground)" />
          </div>
        </div>
      </AuthLayout>
    )
  }

  // ── Step: OTP + new password ─────────────────────────────────────────────────
  return (
    <AuthLayout
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${email}`}
    >
      <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Expiry */}
        <div style={{
          textAlign: 'center', fontSize: 'var(--text-micro)',
          color: expiry < 120 ? 'var(--danger)' : 'var(--text-muted)',
          transition: 'color 0.3s',
        }}>
          {expiry > 0 ? `Code expires in ${formatExpiry(expiry)}` : 'Code expired — resend below'}
        </div>

        {/* Digit boxes */}
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
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
            />
          ))}
        </div>

        {/* Resend */}
        <div style={{ textAlign: 'center', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
          Didn't receive it?{' '}
          <button type="button" onClick={handleResend} disabled={cooldown > 0} style={{
            background: 'none', border: 'none', cursor: cooldown > 0 ? 'default' : 'pointer',
            color: 'var(--primary)', fontWeight: 500, fontSize: 'var(--text-micro)',
            opacity: cooldown > 0 ? 0.5 : 1,
          }}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
          {resendMsg && <span style={{ color: 'var(--success)', marginLeft: 6 }}>{resendMsg}</span>}
        </div>

        {/* New password */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="New password">
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
                  <span style={{ fontSize: 'var(--text-micro)', color: req.met ? 'var(--success)' : 'var(--text-dim)', transition: 'color 0.15s' }}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Field label="Confirm new password" error={confirm && password !== confirm ? 'Passwords do not match.' : ''}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </Field>
        </div>

        {otpError && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid oklch(0.56 0.15 25 / 0.2)',
            borderRadius: 'var(--r-md)', padding: '10px 14px',
            fontSize: 'var(--text-label)', color: 'var(--danger)', textAlign: 'center',
          }}>
            {otpError}
          </div>
        )}

        <Button
          type="submit"
          disabled={otpLoading || !allDigitsFilled || !reqs.every(r => r.met) || password !== confirm || expiry <= 0}
          style={{ width: '100%' }}
        >
          {otpLoading ? 'Updating password…' : 'Reset password'}
        </Button>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
          <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
            Back to login
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
