export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'cash' | '401k' | 'ira'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  institution?: string
  color: string
  interestRate?: number
  returnPercent?: number
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: TransactionType
  categoryId: string
  accountId: string
  notes?: string
  isRecurring?: boolean
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  merchantName?: string
  tags?: string[]
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  type: 'income' | 'expense'
  isDefault?: boolean
  taxRelated?: boolean
  keywords?: string[]
}

export interface Budget {
  id: string
  categoryId: string
  monthlyLimit: number
  month: string
  rollover?: boolean
}

export type GoalType = 'savings' | 'debt_payoff' | 'emergency_fund' | 'purchase' | 'retirement' | 'investment'

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate?: string
  type: GoalType
  color: string
  accountId?: string
  notes?: string
  template?: string
}

export interface NetWorthEntry {
  id: string
  date: string
  assets: number
  liabilities: number
}

export interface Subscription {
  id: string
  name: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'yearly'
  categoryId: string
  status: 'active' | 'negotiating' | 'cancelled'
  nextBillingDate?: string
  transactionIds: string[]
}

export interface AppSettings {
  currency: string
  currencySymbol: string
  theme: 'dark' | 'light'
  name: string
  dashboardWidgets: string[]
  monthlyIncome?: number
  monthlySavings?: number
  payFrequency?: 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly'
  paycheckAmount?: number
}

// Legacy single-workspace state (kept for backward compat / AppState within a Workspace)
export interface AppState {
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  netWorthHistory: NetWorthEntry[]
  subscriptions: Subscription[]
  settings: AppSettings
  merchantRules: Record<string, string>
}

// ── Multi-workspace additions ────────────────────────────────────────────────

export interface UserProfile {
  name: string
  avatarUrl?: string
}

export type PayFrequency = 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly'

export interface Contributor {
  id: string
  name: string
  incomeAmount: number
  payFrequency: PayFrequency
}

export interface Workspace extends AppState {
  id: string
  name: string
  type: 'personal' | 'household'
  contributors: Contributor[]
  createdAt: string
}

export interface RootState {
  workspaces: Workspace[]
  activeWorkspaceId: string
  profile: UserProfile
}
