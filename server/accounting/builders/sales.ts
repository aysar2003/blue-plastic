import 'server-only'
import type { SalesDocumentType } from '@prisma/client'

import { Decimal } from '@/lib/money'
import type { CalendarDate } from '@/lib/date'
import type { DraftJournal, DraftLine } from '@/server/accounting/posting'
import type { PricedDocument } from '@/server/accounting/sales-pricing'

/**
 * Turning a sales document into a journal.
 *
 * Each builder is a pure function: document in, `DraftJournal` out. Nothing here
 * touches the database or decides whether a posting is allowed — that is the
 * posting engine's job. Purity is what makes the debits and credits testable
 * against a fixed expected journal, which is the only way to know that a change
 * to an invoice screen has not quietly changed the accounting.
 *
 * See docs/02-accounting-design.md §10 for the map these implement.
 */
export type SalesJournalInput = {
  date: CalendarDate
  number: string
  documentId: string
  customerId: string
  priced: PricedDocument
  receivableAccountId: string
  /** Bank or Undeposited Funds, for documents that move cash immediately. */
  depositAccountId?: string | null
  /** When the till splits one sale across several wallets or drawers. */
  paymentSplits?: { accountId: string; amount: Decimal; description?: string | null }[]
  /** Where a line lands when its item names no income account. */
  fallbackIncomeAccountId: string
  /** Contra-revenue account. Required when the document carries a discount. */
  discountAccountId?: string | null
  memo?: string | null
  /**
   * Cost of what was sold, when the document moved tracked stock.
   *
   * Posted in the *same journal* as the revenue, because a sale and its cost are
   * one event. Splitting them into two entries lets a report be run between them
   * and show a gross margin that was never real.
   */
  cogs?: { cogsAccountId: string; inventoryAccountId: string; amount: Decimal }[]
}

/**
 * Invoice: the customer owes us, and we have earned income.
 *
 *   Dr Accounts Receivable        total
 *     Cr Income (per line)          net
 *     Cr Sales Tax Payable          tax, one line per rate
 */
export function buildInvoiceJournal(input: SalesJournalInput): DraftJournal {
  return {
    date: input.date,
    memo: input.memo ?? `Invoice ${input.number}`,
    sourceType: 'INVOICE',
    sourceId: input.documentId,
    lines: [
      {
        accountId: input.receivableAccountId,
        debit: input.priced.total,
        customerId: input.customerId,
        description: `Invoice ${input.number}`,
      },
      ...discountLines(input, 'debit'),
      ...incomeLines(input, 'credit'),
      ...taxLines(input, 'credit'),
      ...cogsLines(input, 'out'),
    ],
  }
}

/**
 * Sales receipt: paid at the point of sale, so it never becomes a receivable.
 *
 *   Dr Bank / Undeposited Funds   total
 *     Cr Income (per line)          net
 *     Cr Sales Tax Payable          tax
 */
export function buildSalesReceiptJournal(input: SalesJournalInput): DraftJournal {
  const depositLines = receiptDepositLines(input)

  return {
    date: input.date,
    memo: input.memo ?? `Sales receipt ${input.number}`,
    sourceType: 'SALES_RECEIPT',
    sourceId: input.documentId,
    lines: [
      ...depositLines,
      ...discountLines(input, 'debit'),
      ...incomeLines(input, 'credit'),
      ...taxLines(input, 'credit'),
      ...cogsLines(input, 'out'),
    ],
  }
}

function receiptDepositLines(input: SalesJournalInput): DraftLine[] {
  const splits = input.paymentSplits?.filter((split) => !new Decimal(split.amount).isZero()) ?? []
  if (splits.length > 0) {
    const total = splits.reduce((sum, split) => sum.plus(split.amount), new Decimal(0))
    if (!total.equals(input.priced.total)) {
      throw new Error('Split payments must add up to the receipt total.')
    }
    return splits.map((split) => ({
      accountId: split.accountId,
      debit: split.amount,
      description: split.description ?? `Sales receipt ${input.number}`,
    }))
  }

  if (!input.depositAccountId) {
    throw new Error('A sales receipt must say which account the money went to.')
  }

  return [
    {
      accountId: input.depositAccountId,
      debit: input.priced.total,
      description: `Sales receipt ${input.number}`,
    },
  ]
}

/**
 * Credit memo: the mirror of an invoice. Income comes back out, tax comes back
 * out, and the customer owes less.
 *
 *   Dr Income (per line)          net
 *   Dr Sales Tax Payable          tax
 *     Cr Accounts Receivable        total
 */
export function buildCreditMemoJournal(input: SalesJournalInput): DraftJournal {
  return {
    date: input.date,
    memo: input.memo ?? `Credit memo ${input.number}`,
    sourceType: 'CREDIT_MEMO',
    sourceId: input.documentId,
    lines: [
      ...discountLines(input, 'credit'),
      ...incomeLines(input, 'debit'),
      ...taxLines(input, 'debit'),
      {
        accountId: input.receivableAccountId,
        credit: input.priced.total,
        customerId: input.customerId,
        description: `Credit memo ${input.number}`,
      },
      // Stock coming back reverses the cost as well as the revenue.
      ...cogsLines(input, 'in'),
    ],
  }
}

/**
 * Refund receipt: money handed back without going through receivables.
 *
 *   Dr Income (per line)          net
 *   Dr Sales Tax Payable          tax
 *     Cr Bank                       total
 */
export function buildRefundReceiptJournal(input: SalesJournalInput): DraftJournal {
  if (!input.depositAccountId) {
    throw new Error('A refund must say which account the money came out of.')
  }

  return {
    date: input.date,
    memo: input.memo ?? `Refund ${input.number}`,
    sourceType: 'REFUND_RECEIPT',
    sourceId: input.documentId,
    lines: [
      ...discountLines(input, 'credit'),
      ...incomeLines(input, 'debit'),
      ...taxLines(input, 'debit'),
      {
        accountId: input.depositAccountId,
        credit: input.priced.total,
        description: `Refund ${input.number}`,
      },
    ],
  }
}

/**
 * Customer payment: cash in, receivable down.
 *
 *   Dr Bank / Undeposited Funds   amount
 *     Cr Accounts Receivable        amount   (carrying the customer)
 *
 * Note what is *not* here: nothing touches income. The revenue was recognised
 * when the invoice was raised; this only moves what the customer owes into the
 * bank. Recognising it again here is the classic double-count.
 */
export function buildCustomerPaymentJournal(input: {
  date: CalendarDate
  number: string
  paymentId: string
  customerId: string
  amount: Decimal.Value
  depositAccountId: string
  receivableAccountId: string
  memo?: string | null
}): DraftJournal {
  return {
    date: input.date,
    memo: input.memo ?? `Payment ${input.number}`,
    sourceType: 'CUSTOMER_PAYMENT',
    sourceId: input.paymentId,
    lines: [
      {
        accountId: input.depositAccountId,
        debit: input.amount,
        description: `Payment ${input.number}`,
      },
      {
        accountId: input.receivableAccountId,
        credit: input.amount,
        customerId: input.customerId,
        description: `Payment ${input.number}`,
      },
    ],
  }
}

/**
 * Cost of goods sold, alongside the revenue that earned it.
 *
 *   selling:   Dr Cost of goods sold · Cr Inventory asset
 *   returning: Dr Inventory asset     · Cr Cost of goods sold
 */
function cogsLines(input: SalesJournalInput, direction: 'out' | 'in'): DraftLine[] {
  if (!input.cogs?.length) return []

  const lines: DraftLine[] = []

  for (const entry of input.cogs) {
    if (entry.amount.isZero()) continue
    if (direction === 'out') {
      lines.push({ accountId: entry.cogsAccountId, debit: entry.amount, description: 'Cost of goods sold' })
      lines.push({ accountId: entry.inventoryAccountId, credit: entry.amount, description: 'Stock issued' })
    } else {
      lines.push({ accountId: entry.inventoryAccountId, debit: entry.amount, description: 'Stock returned' })
      lines.push({ accountId: entry.cogsAccountId, credit: entry.amount, description: 'Cost of goods sold reversed' })
    }
  }

  return lines
}

/** The document discount, posted to Sales Discounts so income stays at the list price. */
function discountLines(input: SalesJournalInput, side: 'debit' | 'credit'): DraftLine[] {
  if (input.priced.discountAmount.isZero()) return []
  if (!input.discountAccountId) {
    throw new Error('A discount needs the Sales Discounts account.')
  }
  const draft: DraftLine = { accountId: input.discountAccountId, description: 'Discount' }
  if (side === 'debit') draft.debit = input.priced.discountAmount
  else draft.credit = input.priced.discountAmount
  return [draft]
}

/** One line per income account, so the profit and loss reads by category. */
function incomeLines(input: SalesJournalInput, side: 'debit' | 'credit'): DraftLine[] {
  const byAccount = new Map<string, { amount: Decimal; description: string }>()

  for (const line of input.priced.lines) {
    if (line.amount.isZero()) continue
    const accountId = line.incomeAccountId ?? input.fallbackIncomeAccountId
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

/** One line per tax rate, so a tax return can be assembled from the ledger. */
function taxLines(input: SalesJournalInput, side: 'debit' | 'credit'): DraftLine[] {
  const lines: DraftLine[] = []

  for (const [, rate] of input.priced.taxByRate) {
    if (rate.amount.isZero()) continue
    if (!rate.salesAccountId) {
      throw new Error(`Tax rate "${rate.name}" has no account to post to.`)
    }
    const draft: DraftLine = { accountId: rate.salesAccountId, description: rate.name }
    if (side === 'debit') draft.debit = rate.amount
    else draft.credit = rate.amount
    lines.push(draft)
  }

  return lines
}

/** Which document types post a journal at all. */
export const POSTS_A_JOURNAL: Record<SalesDocumentType, boolean> = {
  INVOICE: true,
  SALES_RECEIPT: true,
  CREDIT_MEMO: true,
  REFUND_RECEIPT: true,
  /// An estimate is a quotation. Nothing has happened yet, so nothing is posted.
  ESTIMATE: false,
}
