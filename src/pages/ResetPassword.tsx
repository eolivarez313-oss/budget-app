import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

export function ResetPassword() {
  const { updatePassword, user } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Supabase puts the user in session after clicking the reset link
  // If no user, the link may be invalid or expired
  const reqs = passwordRequirements(password)
  const passwordValid = reqs.every(r => r.met)
  const confirmError = confirm && password !== confirm ? 'Passwords do not match.' : ''

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate('/login', { replace: true }), 2500)
      return () => clearTimeout(t)
    }
  }, [done])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordValid || password !== confirm) return
    setError(''); setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      setError(error.includes('expired') ? 'This reset link has expired. Please request a new one.' : error)
    } else {
      setDone(true)
    }
  }

  if (done) {
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

  if (!user) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is invalid or has expired.">
        <div style={{ textAlign: 'center' }}>
          <Button onClick={() => navigate('/forgot-password')} style={{ width: '100%' }}>
            Request a new reset link
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid oklch(0.56 0.15 25 / 0.2)',
            borderRadius: 'var(--r-md)', padding: '10px 14px',
            fontSize: 'var(--text-label)', color: 'var(--danger)',
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

        <Field label="Confirm new password" error={confirmError}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" disabled={loading || !passwordValid || !!confirmError} style={{ width: '100%' }}>
          {loading ? 'Updating…' : 'Set new password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
