import { BUDGET_CONTROL_ACCOUNT_TYPES, budgetCellKey, wouldExceedBudget } from '@/lib/erp/budget-deep'
import { Decimal, ZERO } from '@/lib/money'

export type BudgetControlLine = {
  accountId: string
  accountCode?: string
  accountType: string
  trackingCategoryId: string | null
  /** Absolute spend amount for EXPENSE/COGS (debit-natural). */
  amount: string
}

export type BudgetControlBucket = {
  accountId: string
  accountCode: string
  month: number
  trackingCategoryId: string | null
  budgeted: string
  actualPosted: string
  proposed: string
}

/**
 * Pure check: given approved monthly budget cells and posted actuals for the
 * journal month, return buckets that would go over budget.
 */
export function findOverBudgetBuckets(input: {
  month: number
  lines: BudgetControlLine[]
  /** budgeted keyed by budgetCellKey(accountId, month, classId) */
  budgetByCell: Map<string, { amount: string; accountCode: string }>
  /** posted actual (debit-natural) for same keys */
  actualByCell: Map<string, string>
}): BudgetControlBucket[] {
  const proposedByCell = new Map<string, { amount: Decimal; accountCode: string; classId: string | null }>()
  for (const line of input.lines) {
    if (!(BUDGET_CONTROL_ACCOUNT_TYPES as readonly string[]).includes(line.accountType)) continue
    const spend = new Decimal(line.amount)
    if (spend.isZero()) continue
    const key = budgetCellKey(line.accountId, input.month, line.trackingCategoryId)
    const prev = proposedByCell.get(key)
    if (prev) {
      prev.amount = prev.amount.plus(spend)
    } else {
      proposedByCell.set(key, {
        amount: spend,
        accountCode: line.accountCode ?? line.accountId,
        classId: line.trackingCategoryId,
      })
    }
  }

  const over: BudgetControlBucket[] = []
  for (const [key, proposed] of proposedByCell) {
    const budget = input.budgetByCell.get(key)
    if (!budget) continue
    const actual = input.actualByCell.get(key) ?? '0'
    if (
      wouldExceedBudget({
        budgeted: budget.amount,
        actualPosted: actual,
        proposed: proposed.amount.toFixed(4),
      })
    ) {
      over.push({
        accountId: key.split('|')[0]!,
        accountCode: budget.accountCode || proposed.accountCode,
        month: input.month,
        trackingCategoryId: proposed.classId,
        budgeted: budget.amount,
        actualPosted: actual,
        proposed: proposed.amount.toFixed(4),
      })
    }
  }
  return over
}

export function formatOverBudgetMessage(buckets: BudgetControlBucket[]): string {
  if (buckets.length === 0) return ''
  const first = buckets[0]!
  const more = buckets.length > 1 ? ` (+${buckets.length - 1} more)` : ''
  const used = new Decimal(first.actualPosted).plus(first.proposed)
  return (
    `Budget control: ${first.accountCode} month ${first.month} would be ` +
    `${used.toFixed(2)} against budget ${new Decimal(first.budgeted).toFixed(2)}${more}.`
  )
}

export function debitNaturalActual(input: {
  type: string
  debit: string
  credit: string
}): string {
  const debit = new Decimal(input.debit)
  const credit = new Decimal(input.credit)
  const creditNatural = ['REVENUE', 'EQUITY', 'LIABILITY'].includes(input.type)
  return (creditNatural ? credit.minus(debit) : debit.minus(credit)).toFixed(4)
}

export function sumDecimalStrings(values: string[]): string {
  return values.reduce((s, v) => s.plus(new Decimal(v || '0')), ZERO).toFixed(4)
}
