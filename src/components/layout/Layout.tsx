import { ReactNode, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { AIChatbot } from '../AIChatbot'
import { pageVariants, transitions } from '../../utils/motion'

const SIDEBAR_KEY = 'meridian_sidebar_collapsed'

export function Layout({ children }: { children: ReactNode }) {
  const location  = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--background)', overflow: 'hidden' }}>

      <Sidebar collapsed={collapsed} onToggle={toggle} />

      <main style={{
        flex: 1, minWidth: 0, overflowY: 'auto',
        padding: '36px 44px',
        position: 'relative',
        background: 'var(--background)',
        transition: 'padding 0.25s ease',
      }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.page}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <AIChatbot />
    </div>
  )
}
