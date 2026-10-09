import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import {
  buildCreditMemoJournal,
  buildCustomerPaymentJournal,
  buildInvoiceJournal,
  buildRefundReceiptJournal,
  buildSalesReceiptJournal,
} from '@/server/accounting/builders/sales'
import { priceDocument } from '@/server/accounting/sales-pricing'
import type { TaxCodeShape } from '@/server/accounting/tax'

/**
 * The builders are pure, so the debits and credits can be checked against a
 * fixed expected journal. This is what makes it safe to change an invoice screen:
 * if the accounting moves, these fail.
 */
const vat: TaxCodeShape = {
  id: 'vat',
  name: 'VAT 16%',
  isInclusive: false,
  components: [
    {
      taxRateId: 'vat-rate',
      name: 'VAT',
      rate: '0.16',
      sequence: 1,
      isCompound: false,
      salesAccountId: 'acct-tax',
      purchaseAccountId: null,
    },
  ],
}

const priced = priceDocument(
  [
    { quantity: '2', unitPrice: '100', taxCodeId: 'vat', incomeAccountId: 'acct-sales' },
    { quantity: '1', unitPrice: '50', taxCodeId: 'vat', incomeAccountId: 'acct-service' },
  ],
  new Map([['vat', vat]]),
  'USD',
)

const base = {
  date: '2026-03-15' as const,
  number: 'INV-00001',
  documentId: 'doc-1',
  customerId: 'cust-1',
  priced,
  receivableAccountId: 'acct-ar',
  fallbackIncomeAccountId: 'acct-uncategorised',
}

/** Sum a side of a draft journal, so balance can be asserted directly. */
function totals(lines: { debit?: unknown; credit?: unknown }[]) {
  let debit = new Decimal(0)
  let credit = new Decimal(0)
  for (const line of lines) {
    if (line.debit) debit = debit.plus(String(line.debit))
    if (line.credit) credit = credit.plus(String(line.credit))
  }
  return { debit, credit }
}

describe('the priced document these builders work from', () => {
  it('is 250 net, 40 tax, 290 total', () => {
    expect(priced.subtotal.toString()).toBe('250')
    expect(priced.taxTotal.toString()).toBe('40')
    expect(priced.total.toString()).toBe('290')
  })
})

describe('invoice', () => {
  const journal = buildInvoiceJournal(base)

  it('debits receivables for the whole total, carrying the customer', () => {
    const ar = journal.lines.find((line) => line.accountId === 'acct-ar')
    expect(ar?.debit?.toString()).toBe('290')
    // R7: an AR line without its customer is refused by the database.
    expect(ar?.customerId).toBe('cust-1')
  })

  it('credits income per account, at the net amount', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-sales')?.credit?.toString()).toBe('200')
    expect(journal.lines.find((l) => l.accountId === 'acct-service')?.credit?.toString()).toBe('50')
  })

  it('credits tax to the rate\'s own account, so a return can be assembled', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-tax')?.credit?.toString()).toBe('40')
  })

  it('balances', () => {
    const { debit, credit } = totals(journal.lines)
    expect(debit.toString()).toBe(credit.toString())
    expect(debit.toString()).toBe('290')
  })
})

describe('sales receipt', () => {
  const journal = buildSalesReceiptJournal({ ...base, depositAccountId: 'acct-bank' })

  it('debits the bank instead of receivables — it never becomes a debt', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-bank')?.debit?.toString()).toBe('290')
    expect(journal.lines.some((l) => l.accountId === 'acct-ar')).toBe(false)
  })

  it('balances', () => {
    const { debit, credit } = totals(journal.lines)
    expect(debit.toString()).toBe(credit.toString())
  })

  it('refuses to build without somewhere for the money to go', () => {
    expect(() => buildSalesReceiptJournal(base)).toThrow(/which account the money went to/i)
  })

  it('splits the debit across several till accounts', () => {
    const journal = buildSalesReceiptJournal({
      ...base,
      depositAccountId: 'acct-bank',
      paymentSplits: [
        { accountId: 'acct-evc', amount: new Decimal('150'), description: 'EVC' },
        { accountId: 'acct-edahab', amount: new Decimal('140'), description: 'Edahab' },
      ],
    })
    expect(journal.lines.find((l) => l.accountId === 'acct-evc')?.debit?.toString()).toBe('150')
    expect(journal.lines.find((l) => l.accountId === 'acct-edahab')?.debit?.toString()).toBe('140')
    const { debit, credit } = totals(journal.lines)
    expect(debit.toString()).toBe(credit.toString())
  })

  it('debits the cash handed over and credits the wallet the change left', () => {
    const sale = priceDocument(
      [{ quantity: '1', unitPrice: '87', incomeAccountId: 'acct-sales' }],
      new Map(),
      'USD',
    )
    const journal = buildSalesReceiptJournal({
      ...base,
      number: 'SR-87',
      priced: sale,
      depositAccountId: 'acct-cash',
      paymentSplits: [{ accountId: 'acct-cash', amount: new Decimal('100'), description: 'Cash' }],
      changeReturns: [{ accountId: 'acct-evc', amount: new Decimal('13'), description: 'Change · EVC' }],
    })
    expect(journal.lines.find((line) => line.accountId === 'acct-cash')?.debit?.toString()).toBe('100')
    expect(journal.lines.find((line) => line.accountId === 'acct-evc')?.credit?.toString()).toBe('13')
    expect(journal.lines.find((line) => line.accountId === 'acct-sales')?.credit?.toString()).toBe('87')
    const { debit, credit } = totals(journal.lines)
    expect(debit.toString()).toBe(credit.toString())
    expect(debit.toString()).toBe('100')
  })

  it('nets change returned from the same cash account', () => {
    const sale = priceDocument(
      [{ quantity: '1', unitPrice: '87', incomeAccountId: 'acct-sales' }],
      new Map(),
      'USD',
    )
    const journal = buildSalesReceiptJournal({
      ...base,
      priced: sale,
      depositAccountId: 'acct-cash',
      paymentSplits: [{ accountId: 'acct-cash', amount: new Decimal('100'), description: 'Cash' }],
      changeReturns: [{ accountId: 'acct-cash', amount: new Decimal('13'), description: 'Change · Cash' }],
    })
    const cashLines = journal.lines.filter((line) => line.accountId === 'acct-cash')
    const debit = cashLines.reduce((sum, line) => sum.plus(String(line.debit ?? 0)), new Decimal(0))
    const credit = cashLines.reduce((sum, line) => sum.plus(String(line.credit ?? 0)), new Decimal(0))
    expect(debit.minus(credit).toString()).toBe('87')
    const { debit: allDebit, credit: allCredit } = totals(journal.lines)
    expect(allDebit.toString()).toBe(allCredit.toString())
  })
})

describe('credit memo', () => {
  const journal = buildCreditMemoJournal(base)

  it('is the mirror of the invoice', () => {
    const invoice = buildInvoiceJournal(base)
    for (const line of invoice.lines) {
      const mirrored = journal.lines.find((l) => l.accountId === line.accountId)
      expect(String(mirrored?.credit ?? 0)).toBe(String(line.debit ?? 0))
      expect(String(mirrored?.debit ?? 0)).toBe(String(line.credit ?? 0))
    }
  })

  it('credits receivables, carrying the customer', () => {
    const ar = journal.lines.find((l) => l.accountId === 'acct-ar')
    expect(ar?.credit?.toString()).toBe('290')
    expect(ar?.customerId).toBe('cust-1')
  })
})

describe('refund receipt', () => {
  it('takes the money out of the bank and reverses the income', () => {
    const journal = buildRefundReceiptJournal({ ...base, depositAccountId: 'acct-bank' })
    expect(journal.lines.find((l) => l.accountId === 'acct-bank')?.credit?.toString()).toBe('290')
    expect(journal.lines.find((l) => l.accountId === 'acct-sales')?.debit?.toString()).toBe('200')
    const { debit, credit } = totals(journal.lines)
    expect(debit.toString()).toBe(credit.toString())
  })
})

describe('customer payment', () => {
  const journal = buildCustomerPaymentJournal({
    date: '2026-04-01',
    number: 'PMT-00001',
    paymentId: 'pay-1',
    customerId: 'cust-1',
    amount: '290',
    depositAccountId: 'acct-bank',
    receivableAccountId: 'acct-ar',
  })

  it('moves the debt into the bank', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-bank')?.debit?.toString()).toBe('290')
    expect(journal.lines.find((l) => l.accountId === 'acct-ar')?.credit?.toString()).toBe('290')
  })

  it('touches no income — the revenue was recognised on the invoice', () => {
    // The classic double-count: recognising revenue again when the cash arrives.
    expect(journal.lines).toHaveLength(2)
    expect(journal.lines.some((l) => l.accountId === 'acct-sales')).toBe(false)
  })

  it('carries the customer on the receivables line', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-ar')?.customerId).toBe('cust-1')
  })
})

describe('income grouping', () => {
  it('merges lines that share an income account into one journal line', () => {
    const twoLinesOneAccount = priceDocument(
      [
        { quantity: '1', unitPrice: '10', incomeAccountId: 'acct-sales' },
        { quantity: '1', unitPrice: '15', incomeAccountId: 'acct-sales' },
      ],
      new Map(),
      'USD',
    )
    const journal = buildInvoiceJournal({ ...base, priced: twoLinesOneAccount })
    const salesLines = journal.lines.filter((l) => l.accountId === 'acct-sales')
    expect(salesLines).toHaveLength(1)
    expect(salesLines[0].credit?.toString()).toBe('25')
  })

  it('falls back to uncategorised income when an item names no account', () => {
    const unmapped = priceDocument([{ quantity: '1', unitPrice: '10' }], new Map(), 'USD')
    const journal = buildInvoiceJournal({ ...base, priced: unmapped })
    expect(journal.lines.find((l) => l.accountId === 'acct-uncategorised')?.credit?.toString()).toBe('10')
  })
})
