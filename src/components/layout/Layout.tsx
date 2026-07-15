import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { AIChatbot } from '../AIChatbot'

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1, minWidth: 0, overflowY: 'auto',
        padding: '32px 40px',
        position: 'relative',
        background: 'var(--bg)',
      }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <AIChatbot />
    </div>
  )
}
