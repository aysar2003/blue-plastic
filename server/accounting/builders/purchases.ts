import 'server-only'
import type { PurchaseDocumentType } from '@prisma/client'

import { Decimal } from '@/lib/money'
import type { CalendarDate } from '@/lib/date'
import type { DraftJournal, DraftLine } from '@/server/accounting/posting'
import type { PricedDocument } from '@/server/accounting/sales-pricing'

/**
 * Turning a purchase document into a journal — the mirror of `builders/sales.ts`.
 *
 * Pure functions, tested against fixed expected journals, for the same reason:
 * a change to a bill screen must not be able to change the accounting quietly.
 */
export type PurchaseJournalInput = {
  date: CalendarDate
  number: string
  documentId: string
  vendorId: string
  priced: PricedDocument
  /** Payables control account. */
  payableAccountId: string
  /** Bank or credit card, for a purchase paid at once. */
  paymentAccountId?: string | null
  /** Where a line lands when nothing else says. */
  fallbackExpenseAccountId: string
  memo?: string | null
  /**
   * Stock received. Its cost goes to the inventory asset rather than to expense —
   * the business has swapped cash for goods, it has not spent anything yet. The
   * expense arrives when the goods are sold, as cost of goods sold.
   */
  stock?: { inventoryAccountId: string; amount: Decimal }[]
  /**
   * On a vendor credit, stock leaves at average cost while the credit is at the
   * price on the document. The difference must land somewhere or the journal
   * will not balance. Positive means the books cost more than the credit.
   */
  stockCostDifference?: Decimal
}

/**
 * Bill: we owe the vendor, and we have incurred a cost.
 *
 *   Dr Expense / Asset (per line)   net
 *   Dr Tax recoverable              tax, one line per rate
 *     Cr Accounts Payable             total   (carrying the vendor)
 */
export function buildBillJournal(input: PurchaseJournalInput): DraftJournal {
  return {
    date: input.date,
    memo: input.memo ?? `Bill ${input.number}`,
    sourceType: 'BILL',
    sourceId: input.documentId,
    lines: [
      ...expenseLines(input, 'debit'),
      ...stockLines(input, 'debit'),
      ...taxLines(input, 'debit'),
      {
        accountId: input.payableAccountId,
        credit: input.priced.total,
        vendorId: input.vendorId,
        description: `Bill ${input.number}`,
      },
    ],
  }
}

/**
 * Expense: bought and paid at once, so it never becomes a payable.
 *
 *   Dr Expense / Asset (per line)   net
 *   Dr Tax recoverable              tax
 *     Cr Bank / Credit card           total
 */
export function buildExpenseJournal(input: PurchaseJournalInput): DraftJournal {
  if (!input.paymentAccountId) {
    throw new Error('An expense must say which account it was paid from.')
  }

  return {
    date: input.date,
    memo: input.memo ?? `Expense ${input.number}`,
    sourceType: 'EXPENSE',
    sourceId: input.documentId,
    lines: [
      ...expenseLines(input, 'debit'),
      ...stockLines(input, 'debit'),
      ...taxLines(input, 'debit'),
      {
        accountId: input.paymentAccountId,
        credit: input.priced.total,
        description: `Expense ${input.number}`,
      },
    ],
  }
}

/**
 * Vendor credit: the mirror of a bill. The cost comes back out and we owe less.
 *
 *   Dr Accounts Payable             total   (carrying the vendor)
 *     Cr Expense / Asset (per line)   net
 *     Cr Tax recoverable              tax
 */
export function buildVendorCreditJournal(input: PurchaseJournalInput): DraftJournal {
  return {
    date: input.date,
    memo: input.memo ?? `Vendor credit ${input.number}`,
    sourceType: 'VENDOR_CREDIT',
    sourceId: input.documentId,
    lines: [
      {
        accountId: input.payableAccountId,
        debit: input.priced.total,
        vendorId: input.vendorId,
        description: `Vendor credit ${input.number}`,
      },
      ...expenseLines(input, 'credit'),
      ...stockLines(input, 'credit'),
      ...taxLines(input, 'credit'),
      ...stockCostDifferenceLines(input),
    ],
  }
}

/**
 * Bill payment: cash out, payable down.
 *
 *   Dr Accounts Payable   amount   (carrying the vendor)
 *     Cr Bank               amount
 *
 * As with a customer payment, nothing touches expense. The cost was recognised
 * when the bill was entered; this only settles it.
 */
export function buildBillPaymentJournal(input: {
  date: CalendarDate
  number: string
  paymentId: string
  vendorId: string
  amount: Decimal.Value
  paymentAccountId: string
  payableAccountId: string
  memo?: string | null
}): DraftJournal {
  return {
    date: input.date,
    memo: input.memo ?? `Bill payment ${input.number}`,
    sourceType: 'BILL_PAYMENT',
    sourceId: input.paymentId,
    lines: [
      {
        accountId: input.payableAccountId,
        debit: input.amount,
        vendorId: input.vendorId,
        description: `Bill payment ${input.number}`,
      },
      {
        accountId: input.paymentAccountId,
        credit: input.amount,
        description: `Bill payment ${input.number}`,
      },
    ],
  }
}

/**
 * Stock received, held as an asset until it is sold.
 *
 * The cost of tracked goods is deliberately kept out of `expenseLines`: putting
 * it in expense would charge the whole purchase to profit on the day it arrived,
 * and then charge it again as cost of goods sold when it left.
 */
function stockLines(input: PurchaseJournalInput, side: 'debit' | 'credit'): DraftLine[] {
  if (!input.stock?.length) return []

  const byAccount = new Map<string, Decimal>()
  for (const entry of input.stock) {
    if (entry.amount.isZero()) continue
    byAccount.set(
      entry.inventoryAccountId,
      (byAccount.get(entry.inventoryAccountId) ?? new Decimal(0)).plus(entry.amount),
    )
  }

  return [...byAccount.entries()].map(([accountId, amount]) => {
    const draft: DraftLine = { accountId, description: 'Stock received' }
    if (side === 'debit') draft.debit = amount
    else draft.credit = amount
    return draft
  })
}

/** Plug the gap when returned stock leaves at average cost, not at the credit price. */
function stockCostDifferenceLines(input: PurchaseJournalInput): DraftLine[] {
  const difference = input.stockCostDifference
  if (!difference || difference.isZero()) return []

  const draft: DraftLine = {
    accountId: input.fallbackExpenseAccountId,
    description: 'Difference between credit price and stock cost',
  }
  // Books cost more than the credit → inventory was credited high → debit the gap.
  if (difference.isPositive()) draft.debit = difference
  else draft.credit = difference.abs()
  return [draft]
}

/** One line per expense account, so the profit and loss reads by category. */
function expenseLines(input: PurchaseJournalInput, side: 'debit' | 'credit'): DraftLine[] {
  const byAccount = new Map<string, { amount: Decimal; description: string }>()

  for (const line of input.priced.lines) {
    if (line.amount.isZero()) continue
    // Tracked stock is handled by `stockLines`. Letting it fall through to the
    // fallback expense account here would debit the same purchase twice.
    if (line.isStock) continue
    const accountId = line.incomeAccountId ?? input.fallbackExpenseAccountId
    const existing = byAccount.get(accountId)
    if (existing) {
      existing.amount = existing.amount.plus(line.amount)
    } else {
      byAccount.set(accountId, { amount: line.amount, description: line.source.description ?? '' })
    }
  }

  return [...byAccount.entries()].map(([accountId, entry]) => {
    const draft: DraftLine = { accountId, description: entry.description || null }
    if (side === 'debit') draft.debit = entry.amount
    else draft.credit = entry.amount
    return draft
  })
}

/**
 * Tax on a purchase, one line per rate.
 *
 * Where the tax lands depends on whether it can be reclaimed, and that is a
 * decision about the tax rate rather than about this bill:
 *
 *   recoverable      -> the rate's own purchase account, an asset
 *   not recoverable  -> point the rate's purchase account at an expense account
 *
 * Making it a property of the rate keeps the decision in the chart of accounts,
 * where an accountant can see and change it, rather than buried in a code path.
 * A rate used on a purchase with no purchase account at all is refused, because
 * silently dropping the tax would understate the cost.
 */
function taxLines(input: PurchaseJournalInput, side: 'debit' | 'credit'): DraftLine[] {
  const lines: DraftLine[] = []

  for (const [, rate] of input.priced.taxByRate) {
    if (rate.amount.isZero()) continue
    if (!rate.purchaseAccountId) {
      throw new Error(
        `Tax rate "${rate.name}" has no purchase account. Set one — an asset if the tax is ` +
          `reclaimable, an expense account if it is not — before using it on a bill.`,
      )
    }
    const draft: DraftLine = { accountId: rate.purchaseAccountId, description: rate.name }
    if (side === 'debit') draft.debit = rate.amount
    else draft.credit = rate.amount
    lines.push(draft)
  }

  return lines
}

/** Which document types post a journal at all. */
export const PURCHASE_POSTS_A_JOURNAL: Record<PurchaseDocumentType, boolean> = {
  BILL: true,
  EXPENSE: true,
  VENDOR_CREDIT: true,
  /// An order placed is not a transaction. Nothing is posted until it arrives.
  PURCHASE_ORDER: false,
}
