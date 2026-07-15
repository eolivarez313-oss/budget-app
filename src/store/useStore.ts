import { createContext, useContext, useReducer, useEffect, ReactNode, createElement, useState } from 'react'
import { AppState, Account, Transaction, Category, Budget, Goal, NetWorthEntry, Subscription, AppSettings } from '../types'
import { getInitialData } from './initialData'
import * as db from '../lib/db'

type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'ADD_ACCOUNT'; payload: Account }
  | { type: 'UPDATE_ACCOUNT'; payload: Account }
  | { type: 'DELETE_ACCOUNT'; payload: string }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'ADD_BUDGET'; payload: Budget }
  | { type: 'UPDATE_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: string }
  | { type: 'ADD_GOAL'; payload: Goal }
  | { type: 'UPDATE_GOAL'; payload: Goal }
  | { type: 'DELETE_GOAL'; payload: string }
  | { type: 'ADD_NET_WORTH_ENTRY'; payload: NetWorthEntry }
  | { type: 'ADD_SUBSCRIPTION'; payload: Subscription }
  | { type: 'UPDATE_SUBSCRIPTION'; payload: Subscription }
  | { type: 'DELETE_SUBSCRIPTION'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SAVE_MERCHANT_RULE'; payload: { key: string; categoryId: string } }
  | { type: 'DELETE_MERCHANT_RULE'; payload: string }
  | { type: 'RESET' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE': return action.payload
    case 'ADD_ACCOUNT': return { ...state, accounts: [...state.accounts, action.payload] }
    case 'UPDATE_ACCOUNT': return { ...state, accounts: state.accounts.map(a => a.id === action.payload.id ? action.payload : a) }
    case 'DELETE_ACCOUNT': return { ...state, accounts: state.accounts.filter(a => a.id !== action.payload) }
    case 'ADD_TRANSACTION': return { ...state, transactions: [action.payload, ...state.transactions] }
    case 'UPDATE_TRANSACTION': return { ...state, transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'DELETE_TRANSACTION': return { ...state, transactions: state.transactions.filter(t => t.id !== action.payload) }
    case 'ADD_CATEGORY': return { ...state, categories: [...state.categories, action.payload] }
    case 'UPDATE_CATEGORY': return { ...state, categories: state.categories.map(c => c.id === action.payload.id ? action.payload : c) }
    case 'DELETE_CATEGORY': return { ...state, categories: state.categories.filter(c => c.id !== action.payload) }
    case 'ADD_BUDGET': return { ...state, budgets: [...state.budgets, action.payload] }
    case 'UPDATE_BUDGET': return { ...state, budgets: state.budgets.map(b => b.id === action.payload.id ? action.payload : b) }
    case 'DELETE_BUDGET': return { ...state, budgets: state.budgets.filter(b => b.id !== action.payload) }
    case 'ADD_GOAL': return { ...state, goals: [...state.goals, action.payload] }
    case 'UPDATE_GOAL': return { ...state, goals: state.goals.map(g => g.id === action.payload.id ? action.payload : g) }
    case 'DELETE_GOAL': return { ...state, goals: state.goals.filter(g => g.id !== action.payload) }
    case 'ADD_NET_WORTH_ENTRY': return { ...state, netWorthHistory: [...state.netWorthHistory, action.payload] }
    case 'ADD_SUBSCRIPTION': return { ...state, subscriptions: [...state.subscriptions, action.payload] }
    case 'UPDATE_SUBSCRIPTION': return { ...state, subscriptions: state.subscriptions.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_SUBSCRIPTION': return { ...state, subscriptions: state.subscriptions.filter(s => s.id !== action.payload) }
    case 'UPDATE_SETTINGS': return { ...state, settings: { ...state.settings, ...action.payload } }
    case 'SAVE_MERCHANT_RULE': return { ...state, merchantRules: { ...state.merchantRules, [action.payload.key]: action.payload.categoryId } }
    case 'DELETE_MERCHANT_RULE': { const rules = { ...state.merchantRules }; delete rules[action.payload]; return { ...state, merchantRules: rules } }
    case 'RESET': return getInitialData()
    default: return state
  }
}

// Sync action to Supabase (fire-and-forget)
function syncToSupabase(action: Action, newState: AppState) {
  switch (action.type) {
    case 'ADD_ACCOUNT': case 'UPDATE_ACCOUNT': db.upsertAccount(action.payload); break
    case 'DELETE_ACCOUNT': db.deleteAccount(action.payload); break
    case 'ADD_TRANSACTION': case 'UPDATE_TRANSACTION': db.upsertTransaction(action.payload); break
    case 'DELETE_TRANSACTION': db.deleteTransaction(action.payload); break
    case 'ADD_CATEGORY': case 'UPDATE_CATEGORY': db.upsertCategory(action.payload); break
    case 'DELETE_CATEGORY': db.deleteCategory(action.payload); break
    case 'ADD_BUDGET': case 'UPDATE_BUDGET': db.upsertBudget(action.payload); break
    case 'DELETE_BUDGET': db.deleteBudget(action.payload); break
    case 'ADD_GOAL': case 'UPDATE_GOAL': db.upsertGoal(action.payload); break
    case 'DELETE_GOAL': db.deleteGoal(action.payload); break
    case 'ADD_NET_WORTH_ENTRY': db.upsertNetWorthEntry(action.payload); break
    case 'ADD_SUBSCRIPTION': case 'UPDATE_SUBSCRIPTION': db.upsertSubscription(action.payload); break
    case 'DELETE_SUBSCRIPTION': db.deleteSubscription(action.payload); break
    case 'UPDATE_SETTINGS': db.saveSettings(newState.settings); break
    case 'RESET': db.seedDatabase(newState); break
  }
}

function dedup<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  return (arr || []).filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true })
}

function dedupState(s: AppState): AppState {
  // Migrate any rules previously stored in the old localStorage key
  let merchantRules: Record<string, string> = s.merchantRules || {}
  try {
    const old = JSON.parse(localStorage.getItem('budget_categorize_v2') || '{}') as Record<string, { categoryId: string }>
    for (const [k, v] of Object.entries(old)) {
      const base = k.replace(/\|.*$/, '') // strip |direction suffix
      if (base && v.categoryId && !merchantRules[base]) {
        merchantRules = { ...merchantRules, [base]: v.categoryId }
      }
    }
    if (Object.keys(old).length > 0) localStorage.removeItem('budget_categorize_v2')
  } catch {}
  return {
    ...s,
    accounts: dedup(s.accounts),
    transactions: dedup(s.transactions),
    categories: dedup(s.categories),
    budgets: dedup(s.budgets),
    goals: dedup(s.goals),
    netWorthHistory: dedup(s.netWorthHistory),
    subscriptions: dedup(s.subscriptions),
    merchantRules,
  }
}

interface StoreContextType {
  state: AppState
  dispatch: React.Dispatch<Action>
  loading: boolean
}

const StoreContext = createContext<StoreContextType | null>(null)

export const EMPTY: AppState = {
  accounts: [], transactions: [], categories: [], budgets: [],
  goals: [], netWorthHistory: [], subscriptions: [],
  settings: { currency: 'USD', currencySymbol: '$', theme: 'dark', name: 'My Budget', dashboardWidgets: [] },
  merchantRules: {},
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [loading, setLoading] = useState(true)

  // Load state on mount — localStorage is the single source of truth
  useEffect(() => {
    const localRaw = (() => { try { return localStorage.getItem('budget_app_v1') } catch { return null } })()

    if (localRaw) {
      // localStorage exists → always use it, no network needed
      try {
        const parsed = JSON.parse(localRaw)
        dispatch({ type: 'SET_STATE', payload: dedupState(parsed) })
      } catch {
        dispatch({ type: 'SET_STATE', payload: getInitialData() })
      }
      setLoading(false)
      return
    }

    // No localStorage yet → try Supabase, then fall back to demo data
    db.loadState().then(async remote => {
      if (remote && remote.accounts.length > 0) {
        dispatch({ type: 'SET_STATE', payload: dedupState(remote) })
      } else {
        const initial = getInitialData()
        dispatch({ type: 'SET_STATE', payload: initial })
        await db.seedDatabase(initial)
      }
      setLoading(false)
    }).catch(() => {
      dispatch({ type: 'SET_STATE', payload: getInitialData() })
      setLoading(false)
    })
  }, [])

  // Also keep localStorage as a fast cache
  useEffect(() => {
    if (!loading) {
      try { localStorage.setItem('budget_app_v1', JSON.stringify(state)) } catch {}
    }
  }, [state, loading])

  function wrappedDispatch(action: Action) {
    dispatch(action)
    const newState = reducer(state, action)
    syncToSupabase(action, newState)
  }

  return createElement(StoreContext.Provider, { value: { state, dispatch: wrappedDispatch, loading } }, children)
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
