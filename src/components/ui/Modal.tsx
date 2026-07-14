import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 420, md: 520, lg: 760 }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div
        onClick={onClose}
        className="modal-backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }}
      />
      <div className="modal-panel" style={{
        position: 'relative', width: '100%', maxWidth: widths[size],
        maxHeight: 'calc(100vh - 64px)',
        background: '#FAFAFA', borderRadius: 16,
        border: '1px solid #E4E4E4',
        boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #EEEEEE', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1A1F36' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid #E4E4E4',
              background: '#F0F0F0', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#6b7280',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#E4E4E4' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F0F0F0' }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
