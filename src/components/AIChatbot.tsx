import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Minimize2, Bot } from 'lucide-react'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/formatters'
import {
  getMonthIncome, getMonthExpenses, getCategorySpent,
  getNetWorth, getTotalAssets, getTotalLiabilities, getSavingsRate
} from '../utils/calculations'

const GREEN = '#06C68A'
const NAVY = '#1A1F36'

declare global {
  interface Window { puter: any }
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

function buildFinancialContext(state: ReturnType<typeof useStore>['state']): string {
  const { transactions, categories, budgets, accounts, goals, subscriptions, settings } = state
  const sym = settings.currencySymbol

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const monthlyIncome = settings.monthlyIncome || getMonthIncome(transactions, month)
  const monthExpenses = getMonthExpenses(transactions, month)
  const savingsRate = getSavingsRate(monthlyIncome, monthExpenses)
  const netWorth = getNetWorth(accounts)
  const assets = getTotalAssets(accounts)
  const liabilities = getTotalLiabilities(accounts)

  // Budget status
  const monthBudgets = budgets.filter(b => b.month === month)
  const budgetLines = monthBudgets.map(b => {
    const cat = categories.find(c => c.id === b.categoryId)
    const spent = getCategorySpent(transactions, b.categoryId, month)
    const pct = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0
    const status = pct >= 100 ? '🔴 OVER BUDGET' : pct >= 80 ? '🟡 near limit' : '🟢 on track'
    return `  - ${cat?.name || 'Unknown'}: ${formatCurrency(spent, sym)} / ${formatCurrency(b.monthlyLimit, sym)} (${pct}%) ${status}`
  }).join('\n')

  // Category spending this month
  const spendMap: Record<string, number> = {}
  transactions.filter(t => t.type === 'expense' && t.date.startsWith(month)).forEach(t => {
    const cat = categories.find(c => c.id === t.categoryId)
    const name = cat?.name || 'Uncategorized'
    spendMap[name] = (spendMap[name] || 0) + t.amount
  })
  const topSpending = Object.entries(spendMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, amt]) => `  - ${name}: ${formatCurrency(amt, sym)}`).join('\n')

  // Recent transactions (last 15)
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
    .map(t => {
      const cat = categories.find(c => c.id === t.categoryId)
      return `  - ${t.date}: ${t.description} ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, sym)} (${cat?.name || 'Uncategorized'})`
    }).join('\n')

  // Goals
  const goalLines = goals.slice(0, 5).map(g => {
    const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0
    return `  - ${g.name}: ${formatCurrency(g.currentAmount, sym)} / ${formatCurrency(g.targetAmount, sym)} (${pct}%)`
  }).join('\n')

  // Accounts
  const accountLines = accounts.slice(0, 6).map(a =>
    `  - ${a.name} (${a.type}): ${formatCurrency(a.balance, sym)}`
  ).join('\n')

  // Active subscriptions
  const subTotal = subscriptions.filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.frequency === 'monthly' ? s.amount : s.frequency === 'yearly' ? s.amount / 12 : s.amount * 4.33), 0)

  return `You are a helpful personal finance assistant built into the user's budget app. Be concise, friendly, and always reference the user's actual numbers. Do not give generic advice — ground every response in their real data.

CURRENT FINANCIAL SNAPSHOT (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}):
Monthly Income: ${formatCurrency(monthlyIncome, sym)}
This Month's Expenses: ${formatCurrency(monthExpenses, sym)}
Savings Rate: ${savingsRate}%
Net Worth: ${formatCurrency(netWorth, sym)} (Assets: ${formatCurrency(assets, sym)}, Liabilities: ${formatCurrency(liabilities, sym)})
Active Subscriptions/Bills: ${formatCurrency(subTotal, sym)}/mo

BUDGET STATUS THIS MONTH:
${budgetLines || '  No budgets set'}

TOP SPENDING CATEGORIES THIS MONTH:
${topSpending || '  No expenses recorded'}

RECENT TRANSACTIONS:
${recent || '  No transactions'}

SAVINGS GOALS:
${goalLines || '  No goals set'}

ACCOUNTS:
${accountLines || '  No accounts'}

Keep responses under 150 words unless the user asks for detail. Use the user's actual numbers in your answers.`
}

export function AIChatbot() {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [puterReady, setPuterReady] = useState(false)
  const [authState, setAuthState] = useState<'unknown' | 'signed-in' | 'signed-out'>('unknown')
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = setInterval(() => {
      if (window.puter) {
        setPuterReady(true)
        clearInterval(check)
        try {
          setAuthState(window.puter.auth.isSignedIn() ? 'signed-in' : 'signed-out')
        } catch { setAuthState('signed-out') }
      }
    }, 300)
    return () => clearInterval(check)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function signIn() {
    setError('')
    try {
      await window.puter.auth.signIn()
      setAuthState('signed-in')
    } catch {
      setError('Sign-in was cancelled or failed. Try again.')
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError('')

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const systemPrompt = buildFinancialContext(state)
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ]

      const response = await window.puter.ai.chat(apiMessages, { model: 'claude-opus-4-5' })
      const reply = typeof response === 'string'
        ? response
        : response?.message?.content?.[0]?.text
          ?? response?.content?.[0]?.text
          ?? response?.text
          ?? 'Sorry, I could not parse the response.'

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.toLowerCase().includes('sign') || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('login')) {
        setAuthState('signed-out')
        setError('Session expired. Please sign in again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      setMessages(prev => prev.slice(0, -1)) // remove the user message that failed
      setInput(text) // restore input
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
            width: 52, height: 52, borderRadius: '50%',
            background: GREEN, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(6,198,138,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(6,198,138,0.55)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(6,198,138,0.4)' }}
          title="AI Finance Assistant"
        >
          <MessageCircle size={22} color="#fff" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
          width: 380, height: 560, borderRadius: 16,
          background: '#FAFAFA', border: '1px solid #E4E4E4',
          boxShadow: '0 16px 60px rgba(27,32,48,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: NAVY, padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(6,198,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={17} color={GREEN} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Finance Assistant</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Powered by Claude via Puter</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                <Minimize2 size={15} />
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Auth gate */}
          {authState === 'signed-out' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 28px', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(6,198,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={24} color={GREEN} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Sign in to use the AI assistant</p>
                <p style={{ fontSize: 12, color: '#8A94A6', lineHeight: 1.6 }}>
                  This assistant runs through Puter — a free platform that lets you use AI without sharing API keys. Sign in once and it's ready to go.
                </p>
              </div>
              {error && <p style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, width: '100%' }}>{error}</p>}
              <button onClick={signIn} style={{
                background: GREEN, color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                width: '100%', transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                Sign in with Puter (free)
              </button>
              <p style={{ fontSize: 11, color: '#B0B0B0' }}>The rest of the app works normally without signing in.</p>
            </div>
          )}

          {/* Loading puter */}
          {authState === 'unknown' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: '#8A94A6' }}>Loading…</p>
            </div>
          )}

          {/* Chat messages */}
          {authState === 'signed-in' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <p style={{ fontSize: 13, color: '#8A94A6', textAlign: 'center' }}>Ask me anything about your finances.</p>
                    {[
                      'Why am I over budget this month?',
                      'How can I improve my savings rate?',
                      'What are my biggest expenses?',
                    ].map(q => (
                      <button key={q} onClick={() => { setInput(q) }} style={{
                        background: '#fff', border: '1px solid #E4E4E4', borderRadius: 10,
                        padding: '9px 13px', fontSize: 12, color: NAVY, cursor: 'pointer',
                        textAlign: 'left', transition: 'border-color 0.15s, background 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GREEN; (e.currentTarget as HTMLElement).style.background = 'rgba(6,198,138,0.04)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E4E4E4'; (e.currentTarget as HTMLElement).style.background = '#fff' }}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {m.role === 'assistant' && (
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(6,198,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                        <Bot size={13} color={GREEN} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '78%', padding: '9px 13px', borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: m.role === 'user' ? GREEN : '#fff',
                      border: m.role === 'user' ? 'none' : '1px solid #E4E4E4',
                      fontSize: 13, color: m.role === 'user' ? '#fff' : NAVY,
                      lineHeight: 1.55, whiteSpace: 'pre-wrap',
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(6,198,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bot size={13} color={GREEN} />
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #E4E4E4', borderRadius: '12px 12px 12px 4px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: '50%', background: '#B0B0B0',
                          animation: 'chatDot 1.2s ease-in-out infinite',
                          animationDelay: `${i * 0.2}s`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <p style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca' }}>{error}</p>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid #E4E4E4', display: 'flex', gap: 8, flexShrink: 0, background: '#fff' }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Ask about your finances…"
                  disabled={loading}
                  style={{
                    flex: 1, border: '1px solid #E4E4E4', borderRadius: 10,
                    padding: '9px 13px', fontSize: 13, color: NAVY,
                    background: loading ? '#F9F9F9' : '#fff', outline: 'none',
                    fontFamily: 'inherit', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = GREEN}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = '#E4E4E4'}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                    background: input.trim() && !loading ? GREEN : '#E4E4E4',
                    cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}>
                  <Send size={14} color={input.trim() && !loading ? '#fff' : '#B0B0B0'} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes chatDot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.25); }
        }
      `}</style>
    </>
  )
}
