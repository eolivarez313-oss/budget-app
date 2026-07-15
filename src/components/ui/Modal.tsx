import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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

  const widths = { sm: 420, md: 520, lg: 760 }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative', width: '100%', maxWidth: widths[size],
              maxHeight: 'calc(100vh - 64px)',
              background: '#FAFAFA', borderRadius: 16,
              border: '1px solid #E4E4E4',
              boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
            }}
          >
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
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#E4E4E4' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F0F0F0' }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto' }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
