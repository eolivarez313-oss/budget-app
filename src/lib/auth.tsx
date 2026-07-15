import { createContext, useContext, useEffect, useState, ReactNode, createElement } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsVerification: boolean }>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>
  resendVerification: (email: string) => Promise<{ error: string | null }>
  deleteAccount: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }

    if (error.message.includes('Email not confirmed')) {
      return { error: 'EMAIL_NOT_CONFIRMED' }
    }
    if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
      return { error: 'Incorrect email or password.' }
    }
    if (error.message.includes('rate') || error.status === 429) {
      return { error: 'Too many attempts. Please wait a moment before trying again.' }
    }
    return { error: error.message }
  }

  async function signUp(email: string, password: string): Promise<{ error: string | null; needsVerification: boolean }> {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        return { error: 'EMAIL_EXISTS', needsVerification: false }
      }
      return { error: error.message, needsVerification: false }
    }
    // If identities is empty, the email already exists (Supabase returns success but no identity)
    if (data.user && data.user.identities?.length === 0) {
      return { error: 'EMAIL_EXISTS', needsVerification: false }
    }
    return { error: null, needsVerification: true }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  async function sendPasswordReset(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }

  async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  }

  async function updateEmail(newEmail: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    return { error: error?.message ?? null }
  }

  async function resendVerification(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return { error: error?.message ?? null }
  }

  async function deleteAccount(): Promise<{ error: string | null }> {
    if (!user) return { error: 'Not authenticated' }
    // Delete all user data first, then the account via edge function / admin API
    // Since we can't call admin API from client, we use a Supabase RPC or soft-delete approach.
    // Here we sign out and cascade delete happens via RLS/FK when admin deletes the auth user.
    // For now, we clear all data and sign out — full hard-delete requires a server function.
    const uid = user.id
    await Promise.allSettled([
      supabase.from('transactions').delete().eq('user_id', uid),
      supabase.from('budgets').delete().eq('user_id', uid),
      supabase.from('goals').delete().eq('user_id', uid),
      supabase.from('net_worth_history').delete().eq('user_id', uid),
      supabase.from('subscriptions').delete().eq('user_id', uid),
      supabase.from('app_settings').delete().eq('user_id', uid),
    ])
    await supabase.from('accounts').delete().eq('user_id', uid)
    await supabase.from('categories').delete().eq('user_id', uid)
    // Clear local storage for this user
    localStorage.removeItem(`budget_root_v1_${uid}`)
    localStorage.removeItem('budget_onboarding_done')
    await supabase.auth.signOut()
    return { error: null }
  }

  const ctx: AuthContextType = {
    user, session, loading,
    signIn, signUp, signOut,
    sendPasswordReset, updatePassword, updateEmail,
    resendVerification, deleteAccount,
  }

  return createElement(AuthContext.Provider, { value: ctx }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
