import { AppState } from '../types'
import { uuid } from '../utils/uuid'

export function getInitialData(): AppState {
  const catGroceries = uuid()
  const catDining = uuid()
  const catTransport = uuid()
  const catEntertainment = uuid()
  const catShopping = uuid()
  const catUtilities = uuid()
  const catHealth = uuid()
  const catHousing = uuid()
  const catSalary = uuid()
  const catFreelance = uuid()
  const catInvestmentIncome = uuid()

  const accChecking = uuid()
  const accSavings = uuid()
  const accCredit = uuid()
  const accInvestment = uuid()

  const today = new Date()
  const localDate = (dt: Date) => {
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const d = (daysAgo: number) => {
    const dt = new Date(today)
    dt.setDate(dt.getDate() - daysAgo)
    return localDate(dt)
  }
  const monthStr = (offset = 0) => {
    const dt = new Date(today)
    dt.setMonth(dt.getMonth() - offset)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }

  const transactions = [
    // Income
    { id: uuid(), date: d(1), description: 'Payroll Deposit', amount: 3850, type: 'income' as const, categoryId: catSalary, accountId: accChecking, isRecurring: true, recurringFrequency: 'biweekly' as const },
    { id: uuid(), date: d(15), description: 'Payroll Deposit', amount: 3850, type: 'income' as const, categoryId: catSalary, accountId: accChecking, isRecurring: true, recurringFrequency: 'biweekly' as const },
    { id: uuid(), date: d(30), description: 'Payroll Deposit', amount: 3850, type: 'income' as const, categoryId: catSalary, accountId: accChecking, isRecurring: true, recurringFrequency: 'biweekly' as const },
    { id: uuid(), date: d(45), description: 'Payroll Deposit', amount: 3850, type: 'income' as const, categoryId: catSalary, accountId: accChecking, isRecurring: true, recurringFrequency: 'biweekly' as const },
    { id: uuid(), date: d(10), description: 'Freelance - Web Project', amount: 950, type: 'income' as const, categoryId: catFreelance, accountId: accChecking },
    { id: uuid(), date: d(40), description: 'Dividend Payment', amount: 125, type: 'income' as const, categoryId: catInvestmentIncome, accountId: accInvestment },
    // Expenses - this month
    { id: uuid(), date: d(2), description: 'Whole Foods Market', amount: 142.50, type: 'expense' as const, categoryId: catGroceries, accountId: accCredit, merchantName: 'Whole Foods' },
    { id: uuid(), date: d(3), description: 'Chipotle Mexican Grill', amount: 18.75, type: 'expense' as const, categoryId: catDining, accountId: accCredit, merchantName: 'Chipotle' },
    { id: uuid(), date: d(4), description: 'Netflix', amount: 15.99, type: 'expense' as const, categoryId: catEntertainment, accountId: accCredit, isRecurring: true, recurringFrequency: 'monthly' as const, merchantName: 'Netflix' },
    { id: uuid(), date: d(4), description: 'Spotify Premium', amount: 9.99, type: 'expense' as const, categoryId: catEntertainment, accountId: accCredit, isRecurring: true, recurringFrequency: 'monthly' as const, merchantName: 'Spotify' },
    { id: uuid(), date: d(5), description: 'Shell Gas Station', amount: 68.40, type: 'expense' as const, categoryId: catTransport, accountId: accCredit, merchantName: 'Shell' },
    { id: uuid(), date: d(5), description: 'Rent Payment', amount: 1850, type: 'expense' as const, categoryId: catHousing, accountId: accChecking, isRecurring: true, recurringFrequency: 'monthly' as const },
    { id: uuid(), date: d(6), description: 'Target', amount: 87.23, type: 'expense' as const, categoryId: catShopping, accountId: accCredit, merchantName: 'Target' },
    { id: uuid(), date: d(7), description: 'Starbucks', amount: 6.85, type: 'expense' as const, categoryId: catDining, accountId: accCredit, merchantName: 'Starbucks' },
    { id: uuid(), date: d(8), description: 'Electric Bill', amount: 94.20, type: 'expense' as const, categoryId: catUtilities, accountId: accChecking, isRecurring: true, recurringFrequency: 'monthly' as const },
    { id: uuid(), date: d(9), description: 'Uber', amount: 24.50, type: 'expense' as const, categoryId: catTransport, accountId: accCredit, merchantName: 'Uber' },
    { id: uuid(), date: d(10), description: 'Trader Joe\'s', amount: 93.10, type: 'expense' as const, categoryId: catGroceries, accountId: accCredit, merchantName: 'Trader Joe\'s' },
    { id: uuid(), date: d(11), description: 'Amazon Prime', amount: 14.99, type: 'expense' as const, categoryId: catShopping, accountId: accCredit, isRecurring: true, recurringFrequency: 'monthly' as const, merchantName: 'Amazon' },
    { id: uuid(), date: d(12), description: 'Planet Fitness', amount: 24.99, type: 'expense' as const, categoryId: catHealth, accountId: accCredit, isRecurring: true, recurringFrequency: 'monthly' as const, merchantName: 'Planet Fitness' },
    { id: uuid(), date: d(13), description: 'Panera Bread', amount: 13.45, type: 'expense' as const, categoryId: catDining, accountId: accCredit, merchantName: 'Panera' },
    { id: uuid(), date: d(14), description: 'Internet Service', amount: 79.99, type: 'expense' as const, categoryId: catUtilities, accountId: accChecking, isRecurring: true, recurringFrequency: 'monthly' as const },
    { id: uuid(), date: d(16), description: 'CVS Pharmacy', amount: 34.22, type: 'expense' as const, categoryId: catHealth, accountId: accCredit, merchantName: 'CVS' },
    { id: uuid(), date: d(17), description: 'Apple TV+', amount: 9.99, type: 'expense' as const, categoryId: catEntertainment, accountId: accCredit, isRecurring: true, recurringFrequency: 'monthly' as const, merchantName: 'Apple' },
    { id: uuid(), date: d(18), description: 'Costco', amount: 178.55, type: 'expense' as const, categoryId: catGroceries, accountId: accCredit, merchantName: 'Costco' },
    { id: uuid(), date: d(19), description: 'Sushi Restaurant', amount: 62.00, type: 'expense' as const, categoryId: catDining, accountId: accCredit },
    { id: uuid(), date: d(20), description: 'H&M', amount: 95.40, type: 'expense' as const, categoryId: catShopping, accountId: accCredit, merchantName: 'H&M' },
    // Last month
    { id: uuid(), date: d(35), description: 'Whole Foods Market', amount: 128.90, type: 'expense' as const, categoryId: catGroceries, accountId: accCredit },
    { id: uuid(), date: d(36), description: 'Rent Payment', amount: 1850, type: 'expense' as const, categoryId: catHousing, accountId: accChecking },
    { id: uuid(), date: d(37), description: 'Netflix', amount: 15.99, type: 'expense' as const, categoryId: catEntertainment, accountId: accCredit },
    { id: uuid(), date: d(38), description: 'Electric Bill', amount: 88.50, type: 'expense' as const, categoryId: catUtilities, accountId: accChecking },
    { id: uuid(), date: d(42), description: 'Dining Out', amount: 78.20, type: 'expense' as const, categoryId: catDining, accountId: accCredit },
    { id: uuid(), date: d(50), description: 'Gas Station', amount: 55.00, type: 'expense' as const, categoryId: catTransport, accountId: accCredit },
    // 2 months ago
    { id: uuid(), date: d(65), description: 'Rent Payment', amount: 1850, type: 'expense' as const, categoryId: catHousing, accountId: accChecking },
    { id: uuid(), date: d(67), description: 'Groceries', amount: 156.30, type: 'expense' as const, categoryId: catGroceries, accountId: accCredit },
    { id: uuid(), date: d(70), description: 'Electric Bill', amount: 102.00, type: 'expense' as const, categoryId: catUtilities, accountId: accChecking },
    { id: uuid(), date: d(72), description: 'Dining', amount: 94.50, type: 'expense' as const, categoryId: catDining, accountId: accCredit },
  ]

  const sub1 = uuid()
  const sub2 = uuid()
  const sub3 = uuid()
  const sub4 = uuid()
  const sub5 = uuid()

  return {
    accounts: [
      { id: accChecking, name: 'Chase Checking', type: 'checking', balance: 4821.43, institution: 'Chase Bank', color: '#6366f1' },
      { id: accSavings, name: 'Discover Savings', type: 'savings', balance: 12500.00, institution: 'Discover', color: '#10b981', interestRate: 4.5 },
      { id: accCredit, name: 'Chase Sapphire', type: 'credit', balance: -2340.18, institution: 'Chase Bank', color: '#f59e0b' },
      { id: accInvestment, name: 'Fidelity Brokerage', type: 'investment', balance: 34750.00, institution: 'Fidelity', color: '#8b5cf6', returnPercent: 8.2 },
    ],
    transactions,
    categories: [
      { id: catGroceries, name: 'Groceries', color: '#10b981', icon: '🛒', type: 'expense', isDefault: true },
      { id: catDining, name: 'Dining Out', color: '#f59e0b', icon: '🍽️', type: 'expense', isDefault: true },
      { id: catTransport, name: 'Transportation', color: '#6366f1', icon: '🚗', type: 'expense', isDefault: true },
      { id: catEntertainment, name: 'Entertainment', color: '#ec4899', icon: '🎬', type: 'expense', isDefault: true },
      { id: catShopping, name: 'Shopping', color: '#8b5cf6', icon: '🛍️', type: 'expense', isDefault: true },
      { id: catUtilities, name: 'Utilities', color: '#0ea5e9', icon: '⚡', type: 'expense', isDefault: true },
      { id: catHealth, name: 'Health & Fitness', color: '#ef4444', icon: '💪', type: 'expense', isDefault: true },
      { id: catHousing, name: 'Housing', color: '#64748b', icon: '🏠', type: 'expense', isDefault: true },
      { id: catSalary, name: 'Salary', color: '#10b981', icon: '💰', type: 'income', isDefault: true },
      { id: catFreelance, name: 'Freelance', color: '#6366f1', icon: '💻', type: 'income', isDefault: true },
      { id: catInvestmentIncome, name: 'Investment Income', color: '#8b5cf6', icon: '📈', type: 'income', isDefault: true },
    ],
    budgets: [
      { id: uuid(), categoryId: catGroceries, monthlyLimit: 500, month: monthStr(0) },
      { id: uuid(), categoryId: catDining, monthlyLimit: 200, month: monthStr(0) },
      { id: uuid(), categoryId: catTransport, monthlyLimit: 150, month: monthStr(0) },
      { id: uuid(), categoryId: catEntertainment, monthlyLimit: 100, month: monthStr(0) },
      { id: uuid(), categoryId: catShopping, monthlyLimit: 200, month: monthStr(0) },
      { id: uuid(), categoryId: catUtilities, monthlyLimit: 250, month: monthStr(0) },
      { id: uuid(), categoryId: catHealth, monthlyLimit: 80, month: monthStr(0) },
      { id: uuid(), categoryId: catHousing, monthlyLimit: 2000, month: monthStr(0) },
    ],
    goals: [
      { id: uuid(), name: 'Emergency Fund', targetAmount: 15000, currentAmount: 12500, type: 'emergency_fund', color: '#10b981', accountId: accSavings, template: 'emergency_fund', notes: '3-6 months of expenses' },
      { id: uuid(), name: 'Down Payment', targetAmount: 60000, currentAmount: 18000, type: 'savings', color: '#6366f1', targetDate: '2027-06-01', template: 'down_payment' },
      { id: uuid(), name: 'Pay Off Credit Card', targetAmount: 2340, currentAmount: 0, type: 'debt_payoff', color: '#ef4444', targetDate: '2025-12-31', template: 'debt_payoff' },
      { id: uuid(), name: 'Vacation Fund', targetAmount: 3000, currentAmount: 850, type: 'purchase', color: '#f59e0b', targetDate: '2025-08-01', template: 'vacation' },
    ],
    netWorthHistory: [
      { id: uuid(), date: d(180), assets: 44000, liabilities: 2800 },
      { id: uuid(), date: d(150), assets: 46200, liabilities: 2600 },
      { id: uuid(), date: d(120), assets: 47800, liabilities: 2400 },
      { id: uuid(), date: d(90), assets: 49100, liabilities: 2500 },
      { id: uuid(), date: d(60), assets: 50800, liabilities: 2300 },
      { id: uuid(), date: d(30), assets: 51900, liabilities: 2200 },
      { id: uuid(), date: d(0), assets: 52071.43, liabilities: 2340.18 },
    ],
    subscriptions: [
      { id: sub1, name: 'Netflix', amount: 15.99, frequency: 'monthly', categoryId: catEntertainment, status: 'active', nextBillingDate: d(-4), transactionIds: [] },
      { id: sub2, name: 'Spotify Premium', amount: 9.99, frequency: 'monthly', categoryId: catEntertainment, status: 'active', nextBillingDate: d(-4), transactionIds: [] },
      { id: sub3, name: 'Amazon Prime', amount: 14.99, frequency: 'monthly', categoryId: catShopping, status: 'active', nextBillingDate: d(-11), transactionIds: [] },
      { id: sub4, name: 'Apple TV+', amount: 9.99, frequency: 'monthly', categoryId: catEntertainment, status: 'active', nextBillingDate: d(-17), transactionIds: [] },
      { id: sub5, name: 'Planet Fitness', amount: 24.99, frequency: 'monthly', categoryId: catHealth, status: 'active', nextBillingDate: d(-12), transactionIds: [] },
    ],
    settings: {
      currency: 'USD',
      currencySymbol: '$',
      theme: 'dark',
      name: 'My Budget',
      dashboardWidgets: ['stats', 'health', 'budgets', 'insights', 'cashflow', 'spending', 'upcoming', 'recent'],
    },
  }
}
