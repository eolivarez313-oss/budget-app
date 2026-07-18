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
  isReimbursement?: boolean
  source?: 'manual' | 'plaid' | 'import'
  plaidTransactionId?: string
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

export type WorkDay = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'

export type FilingStatus = 'single' | 'married' | 'hoh'

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
  paycheckDay?: string       // 'Mon'–'Sun' for weekly/biweekly, '1'–'28' for monthly
  hourlyRate?: number
  workDays?: WorkDay[]       // e.g. ['Mon','Tue','Wed','Thu','Fri']
  hoursPerDay?: number
  // Tax withholding inputs
  filingStatus?: FilingStatus
  stateCode?: string         // 2-letter US state code e.g. 'TX'
  preTax401kPct?: number     // 401k contribution as a % of gross, e.g. 6
  preTaxHealthcareAnnual?: number  // annual pre-tax health/dental/vision premium
  // Computed net figures (cached from last tax calculation)
  netMonthlyIncome?: number
  netHourlyRate?: number
  // Paystub confirmation source label (e.g. "Paystub — ACME Corp, Jan 15 2026")
  paycheckSource?: string
}

// ── Paystub types ─────────────────────────────────────────────────────────────

export interface PaystubDeduction {
  name: string
  current: number | null
  ytd: number | null
}

export interface Paystub {
  id: string
  jobId?: string | null
  employerName?: string
  payDate?: string
  periodStart?: string
  periodEnd?: string
  grossPay?: number | null
  federalTax?: number | null
  stateTax?: number | null
  socialSecurity?: number | null
  medicare?: number | null
  netPay?: number | null
  ytdGross?: number | null
  ytdFederalTax?: number | null
  ytdStateTax?: number | null
  ytdSocialSecurity?: number | null
  ytdMedicare?: number | null
  ytdNet?: number | null
  preTaxDeductions: PaystubDeduction[]
  postTaxDeductions: PaystubDeduction[]
  ptoAccrued?: number | null
  ptoUsed?: number | null
  ptoRemaining?: number | null
  rawText?: string
  isConfirmed?: boolean
  createdAt?: string
}

export interface PaystubJob {
  id: string
  employerName: string
  isActive: boolean
  payFrequency?: string
  createdAt?: string
}

// Legacy single-workspace state
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
  reimbursementRules: Record<string, boolean>  // merchantKey → always flag as reimbursement
  dayOverrides: Record<string, number>   // 'YYYY-MM-DD' → hours worked that day
}

// ── Multi-workspace additions ────────────────────────────────────────────────

export interface UserProfile {
  name: string
  avatarUrl?: string
  myContributorId?: string
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
