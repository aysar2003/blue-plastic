import { Decimal } from '@/lib/money'

/** Expense register rows, in the order the list filter offers them. */
export const EXPENSE_KINDS = [
  { value: '', label: 'All transactions' },
  { value: 'BILL', label: 'Bill' },
  { value: 'BILL_PAYMENT', label: 'Bill Payment' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'VENDOR_CREDIT', label: 'Supplier Credit' },
] as const

export type ExpenseKind = Exclude<(typeof EXPENSE_KINDS)[number]['value'], ''>

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  BILL: 'Bill',
  BILL_PAYMENT: 'Bill Payment',
  EXPENSE: 'Expense',
  PURCHASE_ORDER: 'Purchase Order',
  VENDOR_CREDIT: 'Supplier Credit',
}

export function parseExpenseKind(value: string | undefined): ExpenseKind | '' {
  return EXPENSE_KINDS.some((kind) => kind.value === value) ? (value as ExpenseKind | '') : ''
}

export type ExpenseRegisterRow = {
  id: string
  kind: ExpenseKind
  typeLabel: string
  date: string
  number: string
  payee: string
  payeeId: string
  category: string
  subtotal: string
  tax: string
  total: string
  status: string
  href: string
  editHref: string | null
  payHref: string | null
}

/** Payments and supplier credits reduce what the list adds up to. */
export function signedExpenseAmount(kind: ExpenseKind, amount: Decimal.Value): Decimal {
  const value = new Decimal(amount)
  return kind === 'BILL_PAYMENT' || kind === 'VENDOR_CREDIT' ? value.negated() : value
}
