import { createContext, useContext, useReducer, useEffect, ReactNode, createElement, useState } from 'react'
import {
  AppState, Account, Transaction, Category, Budget, Goal,
  NetWorthEntry, Subscription, AppSettings,
  Workspace, RootState, UserProfile, Contributor,
} from '../types'
import { getInitialData } from './initialData'
import * as db from '../lib/db'
import { uuid } from '../utils/uuid'
import { supabase } from '../lib/supabase'

// ── Action union ─────────────────────────────────────────────────────────────

type WorkspaceAction =
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

type RootAction =
  | { type: 'SET_ROOT_STATE'; payload: RootState }
  | { type: 'CREATE_WORKSPACE'; payload: Workspace }
  | { type: 'SWITCH_WORKSPACE'; payload: string }
  | { type: 'DELETE_WORKSPACE'; payload: string }
  | { type: 'UPDATE_WORKSPACE_NAME'; payload: { id: string; name: string } }
  | { type: 'ADD_CONTRIBUTOR'; payload: { workspaceId: string; contributor: Contributor } }
  | { type: 'REMOVE_CONTRIBUTOR'; payload: { workspaceId: string; contributorId: string } }
  | { type: 'UPDATE_PROFILE'; payload: Partial<UserProfile> }

export type Action = WorkspaceAction | RootAction

// ── Workspace-level reducer ──────────────────────────────────────────────────

function workspaceReducer(ws: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'SET_STATE': return { ...ws, ...action.payload }
    case 'ADD_ACCOUNT': return { ...ws, accounts: [...ws.accounts, action.payload] }
    case 'UPDATE_ACCOUNT': return { ...ws, accounts: ws.accounts.map(a => a.id === action.payload.id ? action.payload : a) }
    case 'DELETE_ACCOUNT': return { ...ws, accounts: ws.accounts.filter(a => a.id !== action.payload) }
    case 'ADD_TRANSACTION': return { ...ws, transactions: [action.payload, ...ws.transactions] }
    case 'UPDATE_TRANSACTION': return { ...ws, transactions: ws.transactions.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'DELETE_TRANSACTION': return { ...ws, transactions: ws.transactions.filter(t => t.id !== action.payload) }
    case 'ADD_CATEGORY': return { ...ws, categories: [...ws.categories, action.payload] }
    case 'UPDATE_CATEGORY': return { ...ws, categories: ws.categories.map(c => c.id === action.payload.id ? action.payload : c) }
    case 'DELETE_CATEGORY': return { ...ws, categories: ws.categories.filter(c => c.id !== action.payload) }
    case 'ADD_BUDGET': return { ...ws, budgets: [...ws.budgets, action.payload] }
    case 'UPDATE_BUDGET': return { ...ws, budgets: ws.budgets.map(b => b.id === action.payload.id ? action.payload : b) }
    case 'DELETE_BUDGET': return { ...ws, budgets: ws.budgets.filter(b => b.id !== action.payload) }
    case 'ADD_GOAL': return { ...ws, goals: [...ws.goals, action.payload] }
    case 'UPDATE_GOAL': return { ...ws, goals: ws.goals.map(g => g.id === action.payload.id ? action.payload : g) }
    case 'DELETE_GOAL': return { ...ws, goals: ws.goals.filter(g => g.id !== action.payload) }
    case 'ADD_NET_WORTH_ENTRY': return { ...ws, netWorthHistory: [...ws.netWorthHistory, action.payload] }
    case 'ADD_SUBSCRIPTION': return { ...ws, subscriptions: [...ws.subscriptions, action.payload] }
    case 'UPDATE_SUBSCRIPTION': return { ...ws, subscriptions: ws.subscriptions.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_SUBSCRIPTION': return { ...ws, subscriptions: ws.subscriptions.filter(s => s.id !== action.payload) }
    case 'UPDATE_SETTINGS': return { ...ws, settings: { ...ws.settings, ...action.payload } }
    case 'SAVE_MERCHANT_RULE': return { ...ws, merchantRules: { ...ws.merchantRules, [action.payload.key]: action.payload.categoryId } }
    case 'DELETE_MERCHANT_RULE': {
      const rules = { ...ws.merchantRules }
      delete rules[action.payload]
      return { ...ws, merchantRules: rules }
    }
    case 'RESET': return { ...makeWorkspace(getInitialData(), ws.id, ws.name, ws.type) }
    default: return ws
  }
}

// ── Root reducer ─────────────────────────────────────────────────────────────

function rootReducer(root: RootState, action: Action): RootState {
  switch (action.type) {
    case 'SET_ROOT_STATE': return action.payload
    case 'CREATE_WORKSPACE': return { ...root, workspaces: [...root.workspaces, action.payload], activeWorkspaceId: action.payload.id }
    case 'SWITCH_WORKSPACE': return { ...root, activeWorkspaceId: action.payload }
    case 'DELETE_WORKSPACE': {
      const remaining = root.workspaces.filter(w => w.id !== action.payload)
      const newActive = root.activeWorkspaceId === action.payload
        ? (remaining[0]?.id ?? root.activeWorkspaceId)
        : root.activeWorkspaceId
      return { ...root, workspaces: remaining, activeWorkspaceId: newActive }
    }
    case 'UPDATE_WORKSPACE_NAME':
      return { ...root, workspaces: root.workspaces.map(w => w.id === action.payload.id ? { ...w, name: action.payload.name } : w) }
    case 'ADD_CONTRIBUTOR':
      return { ...root, workspaces: root.workspaces.map(w => w.id === action.payload.workspaceId ? { ...w, contributors: [...w.contributors, action.payload.contributor] } : w) }
    case 'REMOVE_CONTRIBUTOR':
      return { ...root, workspaces: root.workspaces.map(w => w.id === action.payload.workspaceId ? { ...w, contributors: w.contributors.filter(c => c.id !== action.payload.contributorId) } : w) }
    case 'UPDATE_PROFILE': return { ...root, profile: { ...root.profile, ...action.payload } }
    default: {
      return {
        ...root,
        workspaces: root.workspaces.map(w => {
          if (w.id !== root.activeWorkspaceId) return w
          const updated = workspaceReducer(w, action as WorkspaceAction)
          if (action.type === 'UPDATE_SETTINGS' && (action as any).payload?.name) {
            return { ...updated, name: (action as any).payload.name }
          }
          return updated
        }),
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function makeWorkspace(
  appState: AppState, id: string, name: string,
  type: 'personal' | 'household' = 'personal',
  contributors: Contributor[] = [],
): Workspace {
  return { ...appState, id, name, type, contributors, createdAt: new Date().toISOString() }
}

function dedup<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  return (arr || []).filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function dedupWorkspace(ws: Workspace): Workspace {
  let merchantRules: Record<string, string> = ws.merchantRules || {}
  try {
    const old = JSON.parse(localStorage.getItem('budget_categorize_v2') || '{}') as Record<string, { categoryId: string }>
    for (const [k, v] of Object.entries(old)) {
      const base = k.replace(/\|.*$/, '')
      if (base && v.categoryId && !merchantRules[base]) {
        merchantRules = { ...merchantRules, [base]: v.categoryId }
      }
    }
    if (Object.keys(old).length > 0) localStorage.removeItem('budget_categorize_v2')
  } catch {}
  return {
    ...ws,
    accounts: dedup(ws.accounts),
    transactions: dedup(ws.transactions),
    categories: dedup(ws.categories),
    budgets: dedup(ws.budgets),
    goals: dedup(ws.goals),
    netWorthHistory: dedup(ws.netWorthHistory),
    subscriptions: dedup(ws.subscriptions),
    merchantRules,
  }
}

function migrateToRootState(appState: AppState): RootState {
  const wsId = uuid()
  const profileName = appState.settings?.name || ''
  return {
    activeWorkspaceId: wsId,
    profile: { name: profileName },
    workspaces: [
      dedupWorkspace(makeWorkspace(
        appState, wsId,
        profileName ? `${profileName}'s Budget` : 'Personal Budget',
        'personal',
      )),
    ],
  }
}

function storageKey(userId: string) { return `budget_root_v1_${userId}` }
const LEGACY_ROOT_KEY = 'budget_root_v1'
const LEGACY_KEY = 'budget_app_v1'

function loadFromStorage(userId: string): RootState | null {
  try {
    // Try user-scoped key first
    const userRaw = localStorage.getItem(storageKey(userId))
    if (userRaw) {
      const parsed = JSON.parse(userRaw) as RootState
      return { ...parsed, workspaces: parsed.workspaces.map(dedupWorkspace) }
    }
    // Check for pre-auth legacy data to migrate
    const rootRaw = localStorage.getItem(LEGACY_ROOT_KEY)
    if (rootRaw) {
      const parsed = JSON.parse(rootRaw) as RootState
      return { ...parsed, workspaces: parsed.workspaces.map(dedupWorkspace) }
    }
    const legacyRaw = localStorage.getItem(LEGACY_KEY)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as AppState
      return migrateToRootState(legacy)
    }
  } catch {}
  return null
}

function syncToSupabase(action: Action, activeWorkspace: Workspace, userId: string) {
  switch (action.type) {
    case 'ADD_ACCOUNT': case 'UPDATE_ACCOUNT': db.upsertAccount(action.payload, userId); break
    case 'DELETE_ACCOUNT': db.deleteAccount(action.payload); break
    case 'ADD_TRANSACTION': case 'UPDATE_TRANSACTION': db.upsertTransaction(action.payload, userId); break
    case 'DELETE_TRANSACTION': db.deleteTransaction(action.payload); break
    case 'ADD_CATEGORY': case 'UPDATE_CATEGORY': db.upsertCategory(action.payload, userId); break
    case 'DELETE_CATEGORY': db.deleteCategory(action.payload); break
    case 'ADD_BUDGET': case 'UPDATE_BUDGET': db.upsertBudget(action.payload, userId); break
    case 'DELETE_BUDGET': db.deleteBudget(action.payload); break
    case 'ADD_GOAL': case 'UPDATE_GOAL': db.upsertGoal(action.payload, userId); break
    case 'DELETE_GOAL': db.deleteGoal(action.payload); break
    case 'ADD_NET_WORTH_ENTRY': db.upsertNetWorthEntry(action.payload, userId); break
    case 'ADD_SUBSCRIPTION': case 'UPDATE_SUBSCRIPTION': db.upsertSubscription(action.payload, userId); break
    case 'DELETE_SUBSCRIPTION': db.deleteSubscription(action.payload); break
    case 'UPDATE_SETTINGS': db.saveSettings(activeWorkspace.settings, userId); break
    case 'RESET': db.seedDatabase(activeWorkspace, userId); break
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const EMPTY_WS: Workspace = makeWorkspace(
  {
    accounts: [], transactions: [], categories: [], budgets: [],
    goals: [], netWorthHistory: [], subscriptions: [],
    settings: { currency: 'USD', currencySymbol: '$', theme: 'dark', name: '', dashboardWidgets: [] },
    merchantRules: {},
  },
  'personal', 'Personal Budget', 'personal',
)

const EMPTY_ROOT: RootState = {
  workspaces: [EMPTY_WS],
  activeWorkspaceId: 'personal',
  profile: { name: '' },
}

interface StoreContextType {
  state: AppState
  dispatch: React.Dispatch<Action>
  loading: boolean
  workspaces: Workspace[]
  activeWorkspaceId: string
  profile: UserProfile
  switchWorkspace: (id: string) => void
  createWorkspace: (ws: Workspace) => void
  deleteWorkspace: (id: string) => void
  updateProfile: (p: Partial<UserProfile>) => void
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [rootState, rootDispatch] = useReducer(rootReducer, EMPTY_ROOT)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Watch auth state and load user data when authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        loadUserData(session.user.id)
      } else {
        setUserId(null)
        rootDispatch({ type: 'SET_ROOT_STATE', payload: EMPTY_ROOT })
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserData(uid: string) {
    setLoading(true)
    setUserId(uid)

    const stored = loadFromStorage(uid)
    if (stored) {
      rootDispatch({ type: 'SET_ROOT_STATE', payload: stored })
      // Migrate any pre-auth legacy data to this user's account
      await migrateLegacyData(uid, stored)
      setLoading(false)
      return
    }

    // No local data → try Supabase
    try {
      const remote = await db.loadState(uid)
      if (remote && remote.accounts.length > 0) {
        rootDispatch({ type: 'SET_ROOT_STATE', payload: migrateToRootState(remote) })
      } else {
        const initial = getInitialData()
        const root = migrateToRootState(initial)
        rootDispatch({ type: 'SET_ROOT_STATE', payload: root })
        await db.seedDatabase(root.workspaces[0], uid)
      }
    } catch {
      rootDispatch({ type: 'SET_ROOT_STATE', payload: migrateToRootState(getInitialData()) })
    }
    setLoading(false)
  }

  // One-time migration: stamp pre-auth data with this user's ID in Supabase
  async function migrateLegacyData(uid: string, state: RootState) {
    const hadLegacy = !!localStorage.getItem(LEGACY_ROOT_KEY) || !!localStorage.getItem(LEGACY_KEY)
    if (!hadLegacy) return
    try {
      for (const ws of state.workspaces) {
        await db.seedDatabase(ws, uid)
      }
      localStorage.removeItem(LEGACY_ROOT_KEY)
      localStorage.removeItem(LEGACY_KEY)
    } catch {}
  }

  // Persist to user-scoped localStorage
  useEffect(() => {
    if (!loading && userId) {
      try { localStorage.setItem(storageKey(userId), JSON.stringify(rootState)) } catch {}
    }
  }, [rootState, loading, userId])

  const activeWorkspace = rootState.workspaces.find(w => w.id === rootState.activeWorkspaceId)
    ?? rootState.workspaces[0]
    ?? EMPTY_WS

  function wrappedDispatch(action: Action) {
    rootDispatch(action)
    if (userId) {
      const nextRoot = rootReducer(rootState, action)
      const nextActive = nextRoot.workspaces.find(w => w.id === nextRoot.activeWorkspaceId) ?? nextRoot.workspaces[0]
      syncToSupabase(action, nextActive ?? activeWorkspace, userId)
    }
  }

  const ctx: StoreContextType = {
    state: activeWorkspace as AppState,
    dispatch: wrappedDispatch,
    loading,
    workspaces: rootState.workspaces,
    activeWorkspaceId: rootState.activeWorkspaceId,
    profile: rootState.profile,
    switchWorkspace: (id) => wrappedDispatch({ type: 'SWITCH_WORKSPACE', payload: id }),
    createWorkspace: (ws) => wrappedDispatch({ type: 'CREATE_WORKSPACE', payload: ws }),
    deleteWorkspace: (id) => wrappedDispatch({ type: 'DELETE_WORKSPACE', payload: id }),
    updateProfile: (p) => wrappedDispatch({ type: 'UPDATE_PROFILE', payload: p }),
  }

  return createElement(StoreContext.Provider, { value: ctx }, children)
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
