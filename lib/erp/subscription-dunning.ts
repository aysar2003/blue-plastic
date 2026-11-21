import { remainingUnearned } from '@/lib/erp/deferred-revenue'
import { Decimal, ZERO } from '@/lib/money'

export function isOverdueSubscriptionInvoice(row: {
  status: string
  overdue: boolean
  excludeFromOverdue?: boolean | null
}): boolean {
  if (row.excludeFromOverdue) return false
  if (row.status !== 'OPEN' && row.status !== 'PARTIAL') return false
  return row.overdue
}

/** Remaining unearned to clear when cancelling a schedule. */
export function unearnedToClear(totalAmount: Decimal.Value, recognizedAmount: Decimal.Value): Decimal {
  return remainingUnearned(totalAmount, recognizedAmount)
}

export function canResumeSchedule(isActive: boolean, endOn: string | null, asOf: string): boolean {
  if (isActive) return false
  if (endOn && endOn < asOf) return false
  return true
}

export function reminderSubject(invoiceNumber: string): string {
  return `Payment reminder: invoice ${invoiceNumber}`
}

export function reminderBody(input: {
  customerName: string
  invoiceNumber: string
  amount: string
  dueDate: string
  organizationName: string
}): string {
  return [
    `Hello ${input.customerName},`,
    '',
    `Invoice ${input.invoiceNumber} for ${input.amount} was due ${input.dueDate} and is still unpaid.`,
    'Please arrange payment at your earliest convenience.',
    '',
    input.organizationName,
  ].join('\n')
}

export function upcomingInvoiceLabel(name: string, nextRunOn: string, amount?: string | null): string {
  return amount ? `${name} · ${nextRunOn} · ${amount}` : `${name} · ${nextRunOn}`
}

export { ZERO }
