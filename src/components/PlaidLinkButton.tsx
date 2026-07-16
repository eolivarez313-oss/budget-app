import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess, PlaidLinkOnExit } from 'react-plaid-link'
import { createLinkToken, exchangeToken, syncPlaidData } from '../lib/plaidApi'
import { Button } from './ui/Button'
import { Link2, Loader2 } from 'lucide-react'

interface Props {
  onSuccess: () => void
  label?: string
}

// Inner component: only mounted once we have a valid token.
// This guarantees usePlaidLink is never called with null/empty token.
function PlaidLinkInner({
  linkToken,
  label,
  onSuccess,
}: {
  linkToken: string
  label: string
  onSuccess: () => void
}) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken, metadata) => {
      setSyncing(true)
      setError(null)
      try {
        await exchangeToken(publicToken, metadata)
        await syncPlaidData()
        onSuccess()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to link account')
        setSyncing(false)
      }
    },
    [onSuccess],
  )

  const handleExit: PlaidLinkOnExit = useCallback((err) => {
    if (err) setError(err.error_message ?? 'Link cancelled')
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Button
        onClick={() => open()}
        disabled={!ready || syncing}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        {syncing
          ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
          : <Link2 size={15} />}
        {syncing ? 'Syncing transactions…' : label}
      </Button>
      {error && (
        <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{error}</p>
      )}
    </div>
  )
}

export function PlaidLinkButton({ onSuccess, label = 'Connect Bank Account' }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createLinkToken()
      .then(token => { setLinkToken(token); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <Button disabled style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        Preparing…
      </Button>
    )
  }

  if (error || !linkToken) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Button disabled style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={15} />
          {label}
        </Button>
        <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>
          {error ?? 'Failed to initialize'}
        </p>
      </div>
    )
  }

  return <PlaidLinkInner linkToken={linkToken} label={label} onSuccess={onSuccess} />
}
