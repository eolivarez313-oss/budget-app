import { useState, useCallback, useEffect, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess, PlaidLinkOnExit, PlaidLinkOnEvent } from 'react-plaid-link'
import { createLinkToken, exchangeToken, syncPlaidData } from '../lib/plaidApi'
import { Button } from './ui/Button'
import { Link2, Loader2 } from 'lucide-react'

interface Props {
  onSuccess: () => void
  label?: string
}

// Inner component: only mounted once we have a valid token.
// usePlaidLink is never called with null/empty token.
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
    if (err) {
      console.error('[Plaid] onExit error:', err)
      setError(err.error_message ?? err.error_code ?? 'Link cancelled')
    }
  }, [])

  const handleEvent: PlaidLinkOnEvent = useCallback((eventName, metadata) => {
    console.log('[Plaid] event:', eventName, metadata)
  }, [])

  const openedRef = useRef(false)
  const { open, ready, error: plaidError } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
    onEvent: handleEvent,
    onLoad: () => console.log('[Plaid] Link script loaded, ready to open'),
  })

  // Auto-open once ready (user already clicked to fetch token)
  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true
      console.log('[Plaid] auto-opening Link, ready=true')
      open()
    }
  }, [ready, open])

  // Surface the SDK-level error (e.g. script failed to load)
  const displayError = error ?? (plaidError ? String(plaidError) : null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Button
        onClick={() => {
          console.log('[Plaid] open() called, ready:', ready)
          open()
        }}
        disabled={!ready || syncing}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        {syncing
          ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
          : <Link2 size={15} />}
        {syncing ? 'Syncing transactions…' : label}
      </Button>
      {displayError && (
        <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{displayError}</p>
      )}
    </div>
  )
}

export function PlaidLinkButton({ onSuccess, label = 'Connect Bank Account' }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Lazy: fetch token on first click, then mount the inner component.
  // This ensures the token is always fresh when open() is called.
  const handleClick = useCallback(async () => {
    if (linkToken) return // already fetched, inner component handles open()
    setFetching(true)
    setFetchError(null)
    try {
      const token = await createLinkToken()
      console.log('[Plaid] link_token received, mounting PlaidLinkInner')
      setLinkToken(token)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to create link token')
    } finally {
      setFetching(false)
    }
  }, [linkToken])

  // Before token is fetched: show the clickable "Connect" button
  if (!linkToken) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Button
          onClick={handleClick}
          disabled={fetching}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {fetching
            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            : <Link2 size={15} />}
          {fetching ? 'Preparing…' : label}
        </Button>
        {fetchError && (
          <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{fetchError}</p>
        )}
      </div>
    )
  }

  // Token fetched: mount inner component which calls usePlaidLink with a valid token.
  // usePlaidLink initializes and opens automatically once ready.
  return <PlaidLinkInner linkToken={linkToken} label={label} onSuccess={onSuccess} />
}
