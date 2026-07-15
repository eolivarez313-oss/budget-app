import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from './Button'

interface ConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmModal({
  open, onConfirm, onCancel, title, message, confirmLabel = 'Delete', danger = true,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={onCancel}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative', width: '100%', maxWidth: 400,
              background: 'var(--elevated)', borderRadius: 18,
              border: danger ? '1px solid rgba(220,38,38,0.2)' : '1px solid var(--border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
              padding: '24px 28px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: danger ? 'var(--danger-dim)' : '#EDE8DF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={18} style={{ color: danger ? 'var(--danger)' : 'var(--text-muted)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>This cannot be undone</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>{message}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} style={{ flex: 1 }}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
