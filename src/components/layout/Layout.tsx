import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { AIChatbot } from '../AIChatbot'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#D8D8D8', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '32px 40px' }}>
        {children}
      </main>
      <AIChatbot />
    </div>
  )
}
