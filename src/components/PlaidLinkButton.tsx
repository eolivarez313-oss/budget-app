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

export function PlaidLinkButton({ onSuccess, label = 'Connect Bank Account' }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading-token' | 'ready' | 'syncing' | 'error'>('loading-token')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createLinkToken()
      .then(token => { setLinkToken(token); setStatus('ready') })
      .catch(e => { setError(e.message); setStatus('error') })
  }, [])

  const handleSuccess: PlaidLinkOnSuccess = useCallback(async (publicToken, metadata) => {
    setStatus('syncing')
    setError(null)
    try {
      await exchangeToken(publicToken, metadata)
      await syncPlaidData()
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link account')
      setStatus('error')
    }
  }, [onSuccess])

  const handleExit: PlaidLinkOnExit = useCallback((err) => {
    if (err) { setError(err.error_message ?? 'Link cancelled'); setStatus('error') }
    else { setStatus('ready') }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handleSuccess,
    onExit: handleExit,
  })

  const isLoading = status === 'loading-token' || status === 'syncing'
  const statusLabel = status === 'syncing' ? 'Syncing transactions…' : status === 'loading-token' ? 'Preparing…' : label

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Button
        onClick={() => open()}
        disabled={!ready || isLoading}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        {isLoading
          ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
          : <Link2 size={15} />}
        {statusLabel}
      </Button>
      {error && (
        <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{error}</p>
      )}
    </div>
  )
}
