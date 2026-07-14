import { Transaction, Budget, Account, Goal } from '../types'

export function getMonthTransactions(transactions: Transaction[], month: string) {
  return transactions.filter(t => t.date.startsWith(month))
}

export function getMonthIncome(transactions: Transaction[], month: string): number {
  return getMonthTransactions(transactions, month)
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
}

export function getMonthExpenses(transactions: Transaction[], month: string): number {
  return getMonthTransactions(transactions, month)
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
}

export function getCategorySpent(transactions: Transaction[], categoryId: string, month: string): number {
  return getMonthTransactions(transactions, month)
    .filter(t => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amount, 0)
}

export function getBudgetProgress(budget: Budget, transactions: Transaction[]): number {
  return getCategorySpent(transactions, budget.categoryId, budget.month)
}

export function getTotalAssets(accounts: Account[]): number {
  return accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0)
}

export function getTotalLiabilities(accounts: Account[]): number {
  return accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0)
}

export function getNetWorth(accounts: Account[]): number {
  return accounts.reduce((s, a) => s + a.balance, 0)
}

export function getSavingsRate(income: number, expenses: number): number {
  if (income === 0) return 0
  return Math.max(0, Math.round(((income - expenses) / income) * 100))
}

export function getFinancialHealthScore(
  savingsRate: number,
  budgets: Budget[],
  transactions: Transaction[],
  goals: Goal[]
): number {
  let score = 0

  // Savings rate (30 pts)
  if (savingsRate >= 20) score += 30
  else if (savingsRate >= 10) score += 20
  else if (savingsRate >= 5) score += 10

  // Budget adherence (30 pts)
  const month = new Date().toISOString().slice(0, 7)
  const budgetsWithData = budgets.filter(b => b.month === month)
  if (budgetsWithData.length > 0) {
    const onTrack = budgetsWithData.filter(b => {
      const spent = getCategorySpent(transactions, b.categoryId, month)
      return spent <= b.monthlyLimit
    }).length
    score += Math.round((onTrack / budgetsWithData.length) * 30)
  } else {
    score += 15
  }

  // Goal progress (20 pts)
  if (goals.length > 0) {
    const avgProgress = goals.reduce((s, g) => s + (g.currentAmount / g.targetAmount), 0) / goals.length
    score += Math.round(avgProgress * 20)
  } else {
    score += 10
  }

  // Net worth trend (20 pts) — just give points for having positive savings
  if (savingsRate > 0) score += 20

  return Math.min(100, score)
}

export function getSpendingByCategory(transactions: Transaction[], month: string) {
  const map: Record<string, number> = {}
  getMonthTransactions(transactions, month)
    .filter(t => t.type === 'expense')
    .forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount
    })
  return map
}

export function getLast6MonthsCashFlow(transactions: Transaction[]) {
  const result = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const month = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    result.push({
      month,
      label,
      income: getMonthIncome(transactions, month),
      expenses: getMonthExpenses(transactions, month),
    })
  }
  return result
}
