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
  keywords?: string[]  // custom keywords for merchant matching (comma-separated in UI)
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

export interface AppState {
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  netWorthHistory: NetWorthEntry[]
  subscriptions: Subscription[]
  settings: AppSettings
  merchantRules: Record<string, string> // merchantKey → categoryId
}
