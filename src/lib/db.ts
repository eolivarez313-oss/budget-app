import { supabase } from './supabase'
import { AppState, Account, Transaction, Category, Budget, Goal, NetWorthEntry, Subscription, AppSettings } from '../types'

// ── Loaders ──────────────────────────────────────────────────────────────────

export async function loadState(userId: string): Promise<AppState | null> {
  const [accounts, categories, transactions, budgets, goals, netWorthHistory, subscriptions, settingsRow] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('categories').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', userId),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('net_worth_history').select('*').eq('user_id', userId).order('date'),
    supabase.from('subscriptions').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('app_settings').select('*').eq('user_id', userId).single(),
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
    tags: r.tags, isReimbursement: r.is_reimbursement ?? false,
    source: r.source ?? 'manual',
    plaidTransactionId: r.plaid_transaction_id ?? undefined,
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
    theme: s.theme, name: s.name, dashboardWidgets: s.dashboard_widgets ?? [],
    monthlyIncome: s.monthly_income ? Number(s.monthly_income) : undefined,
    payFrequency: s.pay_frequency ?? undefined,
    paycheckDay: s.paycheck_day ?? undefined,
    hourlyRate: s.hourly_rate ? Number(s.hourly_rate) : undefined,
    workDays: s.work_days ?? undefined,
    hoursPerDay: s.hours_per_day ? Number(s.hours_per_day) : undefined,
    filingStatus: (s.filing_status as any) ?? 'single',
    stateCode: s.state_code ?? 'TX',
    preTax401kPct: s.pre_tax_401k_pct ? Number(s.pre_tax_401k_pct) : 0,
    preTaxHealthcareAnnual: s.pre_tax_healthcare_annual ? Number(s.pre_tax_healthcare_annual) : 0,
    netMonthlyIncome: s.net_monthly_income ? Number(s.net_monthly_income) : undefined,
    netHourlyRate: s.net_hourly_rate ? Number(s.net_hourly_rate) : undefined,
    paycheckSource: s.paycheck_source ?? undefined,
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
    reimbursementRules: {},
    dayOverrides: (s?.day_overrides && typeof s.day_overrides === 'object' && !Array.isArray(s.day_overrides))
      ? s.day_overrides as Record<string, number>
      : {},
  }
}

// ── Writers ───────────────────────────────────────────────────────────────────

export async function upsertAccount(a: Account, userId: string) {
  await supabase.from('accounts').upsert({
    id: a.id, name: a.name, type: a.type, balance: a.balance,
    institution: a.institution, color: a.color,
    interest_rate: a.interestRate, return_percent: a.returnPercent,
    user_id: userId,
  })
}

export async function deleteAccount(id: string) {
  await supabase.from('accounts').delete().eq('id', id)
}

export async function upsertTransaction(t: Transaction, userId: string) {
  await supabase.from('transactions').upsert({
    id: t.id, date: t.date, description: t.description, amount: t.amount,
    type: t.type, category_id: t.categoryId, account_id: t.accountId,
    notes: t.notes, is_recurring: t.isRecurring,
    recurring_frequency: t.recurringFrequency, merchant_name: t.merchantName,
    tags: t.tags, is_reimbursement: t.isReimbursement ?? false, user_id: userId,
  })
}

export async function deleteTransaction(id: string) {
  await supabase.from('transactions').delete().eq('id', id)
}

export async function upsertCategory(c: Category, userId: string) {
  await supabase.from('categories').upsert({
    id: c.id, name: c.name, color: c.color, icon: c.icon,
    type: c.type, is_default: c.isDefault, tax_related: c.taxRelated,
    user_id: userId,
  })
}

export async function deleteCategory(id: string) {
  await supabase.from('categories').delete().eq('id', id)
}

export async function upsertBudget(b: Budget, userId: string) {
  await supabase.from('budgets').upsert({
    id: b.id, category_id: b.categoryId, monthly_limit: b.monthlyLimit,
    month: b.month, rollover: b.rollover, user_id: userId,
  })
}

export async function deleteBudget(id: string) {
  await supabase.from('budgets').delete().eq('id', id)
}

export async function upsertGoal(g: Goal, userId: string) {
  await supabase.from('goals').upsert({
    id: g.id, name: g.name, target_amount: g.targetAmount,
    current_amount: g.currentAmount, target_date: g.targetDate,
    type: g.type, color: g.color, account_id: g.accountId,
    notes: g.notes, template: g.template, user_id: userId,
  })
}

export async function deleteGoal(id: string) {
  await supabase.from('goals').delete().eq('id', id)
}

export async function upsertNetWorthEntry(e: NetWorthEntry, userId: string) {
  await supabase.from('net_worth_history').upsert({
    id: e.id, date: e.date, assets: e.assets, liabilities: e.liabilities, user_id: userId,
  })
}

export async function upsertSubscription(s: Subscription, userId: string) {
  await supabase.from('subscriptions').upsert({
    id: s.id, name: s.name, amount: s.amount, frequency: s.frequency,
    category_id: s.categoryId, status: s.status,
    next_billing_date: s.nextBillingDate, transaction_ids: s.transactionIds,
    user_id: userId,
  })
}

export async function deleteSubscription(id: string) {
  await supabase.from('subscriptions').delete().eq('id', id)
}

export async function saveSettings(s: AppSettings, userId: string, dayOverrides?: Record<string, number>) {
  await supabase.from('app_settings').upsert({
    user_id: userId,
    currency: s.currency, currency_symbol: s.currencySymbol,
    theme: s.theme, name: s.name, dashboard_widgets: s.dashboardWidgets,
    monthly_income: s.monthlyIncome ?? null,
    pay_frequency: s.payFrequency ?? null,
    paycheck_day: s.paycheckDay ?? null,
    hourly_rate: s.hourlyRate ?? null,
    work_days: s.workDays ?? null,
    hours_per_day: s.hoursPerDay ?? null,
    day_overrides: dayOverrides ?? {},
    filing_status: s.filingStatus ?? 'single',
    state_code: s.stateCode ?? 'TX',
    pre_tax_401k_pct: s.preTax401kPct ?? 0,
    pre_tax_healthcare_annual: s.preTaxHealthcareAnnual ?? 0,
    net_monthly_income: s.netMonthlyIncome ?? null,
    net_hourly_rate: s.netHourlyRate ?? null,
    paycheck_source: s.paycheckSource ?? null,
  }, { onConflict: 'user_id' })
}

export async function saveDayOverrides(overrides: Record<string, number>, userId: string) {
  await supabase.from('app_settings').upsert({
    user_id: userId,
    day_overrides: overrides,
  }, { onConflict: 'user_id' })
}

export async function seedDatabase(state: AppState, userId: string) {
  await Promise.all([
    ...state.accounts.map(a => upsertAccount(a, userId)),
    ...state.categories.map(c => upsertCategory(c, userId)),
  ])
  await Promise.all([
    ...state.transactions.map(t => upsertTransaction(t, userId)),
    ...state.budgets.map(b => upsertBudget(b, userId)),
    ...state.goals.map(g => upsertGoal(g, userId)),
    ...state.netWorthHistory.map(e => upsertNetWorthEntry(e, userId)),
    ...state.subscriptions.map(s => upsertSubscription(s, userId)),
    saveSettings(state.settings, userId, state.dayOverrides),
  ])
}
