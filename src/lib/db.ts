import { supabase } from './supabase'
import { AppState, Account, Transaction, Category, Budget, Goal, NetWorthEntry, Subscription, AppSettings } from '../types'

// ── Loaders ──────────────────────────────────────────────────────────────────

export async function loadState(): Promise<AppState | null> {
  const [accounts, categories, transactions, budgets, goals, netWorthHistory, subscriptions, settingsRow] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('categories').select('*').order('created_at'),
    supabase.from('transactions').select('*').order('date', { ascending: false }),
    supabase.from('budgets').select('*'),
    supabase.from('goals').select('*').order('created_at'),
    supabase.from('net_worth_history').select('*').order('date'),
    supabase.from('subscriptions').select('*').order('created_at'),
    supabase.from('app_settings').select('*').eq('id', 1).single(),
  ])

  if (accounts.error && accounts.error.code !== 'PGRST116') return null

  const mapAccount = (r: any): Account => ({
    id: r.id, name: r.name, type: r.type, balance: Number(r.balance),
    institution: r.institution, color: r.color,
    interestRate: r.interest_rate ? Number(r.interest_rate) : undefined,
    returnPercent: r.return_percent ? Number(r.return_percent) : undefined,
  })

  const mapCategory = (r: any): Category => ({
    id: r.id, name: r.name, color: r.color, icon: r.icon,
    type: r.type, isDefault: r.is_default, taxRelated: r.tax_related,
  })

  const mapTransaction = (r: any): Transaction => ({
    id: r.id, date: r.date, description: r.description, amount: Number(r.amount),
    type: r.type, categoryId: r.category_id, accountId: r.account_id,
    notes: r.notes, isRecurring: r.is_recurring,
    recurringFrequency: r.recurring_frequency, merchantName: r.merchant_name,
    tags: r.tags,
  })

  const mapBudget = (r: any): Budget => ({
    id: r.id, categoryId: r.category_id, monthlyLimit: Number(r.monthly_limit),
    month: r.month, rollover: r.rollover,
  })

  const mapGoal = (r: any): Goal => ({
    id: r.id, name: r.name, targetAmount: Number(r.target_amount),
    currentAmount: Number(r.current_amount), targetDate: r.target_date,
    type: r.type, color: r.color, accountId: r.account_id,
    notes: r.notes, template: r.template,
  })

  const mapNetWorth = (r: any): NetWorthEntry => ({
    id: r.id, date: r.date, assets: Number(r.assets), liabilities: Number(r.liabilities),
  })

  const mapSubscription = (r: any): Subscription => ({
    id: r.id, name: r.name, amount: Number(r.amount), frequency: r.frequency,
    categoryId: r.category_id, status: r.status,
    nextBillingDate: r.next_billing_date, transactionIds: r.transaction_ids || [],
  })

  const s = settingsRow.data
  const settings: AppSettings = s ? {
    currency: s.currency, currencySymbol: s.currency_symbol,
    theme: s.theme, name: s.name, dashboardWidgets: s.dashboard_widgets,
  } : { currency: 'USD', currencySymbol: '$', theme: 'dark', name: 'My Budget', dashboardWidgets: [] }

  return {
    accounts: (accounts.data || []).map(mapAccount),
    categories: (categories.data || []).map(mapCategory),
    transactions: (transactions.data || []).map(mapTransaction),
    budgets: (budgets.data || []).map(mapBudget),
    goals: (goals.data || []).map(mapGoal),
    netWorthHistory: (netWorthHistory.data || []).map(mapNetWorth),
    subscriptions: (subscriptions.data || []).map(mapSubscription),
    settings,
    merchantRules: {},
  }
}

// ── Writers ───────────────────────────────────────────────────────────────────

export async function upsertAccount(a: Account) {
  await supabase.from('accounts').upsert({
    id: a.id, name: a.name, type: a.type, balance: a.balance,
    institution: a.institution, color: a.color,
    interest_rate: a.interestRate, return_percent: a.returnPercent,
  })
}

export async function deleteAccount(id: string) {
  await supabase.from('accounts').delete().eq('id', id)
}

export async function upsertTransaction(t: Transaction) {
  await supabase.from('transactions').upsert({
    id: t.id, date: t.date, description: t.description, amount: t.amount,
    type: t.type, category_id: t.categoryId, account_id: t.accountId,
    notes: t.notes, is_recurring: t.isRecurring,
    recurring_frequency: t.recurringFrequency, merchant_name: t.merchantName,
    tags: t.tags,
  })
}

export async function deleteTransaction(id: string) {
  await supabase.from('transactions').delete().eq('id', id)
}

export async function upsertCategory(c: Category) {
  await supabase.from('categories').upsert({
    id: c.id, name: c.name, color: c.color, icon: c.icon,
    type: c.type, is_default: c.isDefault, tax_related: c.taxRelated,
  })
}

export async function deleteCategory(id: string) {
  await supabase.from('categories').delete().eq('id', id)
}

export async function upsertBudget(b: Budget) {
  await supabase.from('budgets').upsert({
    id: b.id, category_id: b.categoryId, monthly_limit: b.monthlyLimit,
    month: b.month, rollover: b.rollover,
  })
}

export async function deleteBudget(id: string) {
  await supabase.from('budgets').delete().eq('id', id)
}

export async function upsertGoal(g: Goal) {
  await supabase.from('goals').upsert({
    id: g.id, name: g.name, target_amount: g.targetAmount,
    current_amount: g.currentAmount, target_date: g.targetDate,
    type: g.type, color: g.color, account_id: g.accountId,
    notes: g.notes, template: g.template,
  })
}

export async function deleteGoal(id: string) {
  await supabase.from('goals').delete().eq('id', id)
}

export async function upsertNetWorthEntry(e: NetWorthEntry) {
  await supabase.from('net_worth_history').upsert({
    id: e.id, date: e.date, assets: e.assets, liabilities: e.liabilities,
  })
}

export async function upsertSubscription(s: Subscription) {
  await supabase.from('subscriptions').upsert({
    id: s.id, name: s.name, amount: s.amount, frequency: s.frequency,
    category_id: s.categoryId, status: s.status,
    next_billing_date: s.nextBillingDate, transaction_ids: s.transactionIds,
  })
}

export async function deleteSubscription(id: string) {
  await supabase.from('subscriptions').delete().eq('id', id)
}

export async function saveSettings(s: AppSettings) {
  await supabase.from('app_settings').upsert({
    id: 1, currency: s.currency, currency_symbol: s.currencySymbol,
    theme: s.theme, name: s.name, dashboard_widgets: s.dashboardWidgets,
  })
}

export async function seedDatabase(state: AppState) {
  await Promise.all([
    ...state.accounts.map(upsertAccount),
    ...state.categories.map(upsertCategory),
  ])
  await Promise.all([
    ...state.transactions.map(upsertTransaction),
    ...state.budgets.map(upsertBudget),
    ...state.goals.map(upsertGoal),
    ...state.netWorthHistory.map(upsertNetWorthEntry),
    ...state.subscriptions.map(upsertSubscription),
    saveSettings(state.settings),
  ])
}
