import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import {
  buildBillJournal,
  buildBillPaymentJournal,
  buildExpenseJournal,
  buildVendorCreditJournal,
} from '@/server/accounting/builders/purchases'
import { buildInvoiceJournal } from '@/server/accounting/builders/sales'
import { priceDocument } from '@/server/accounting/sales-pricing'
import type { TaxCodeShape } from '@/server/accounting/tax'

const vatRecoverable: TaxCodeShape = {
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
      salesAccountId: 'acct-tax-payable',
      purchaseAccountId: 'acct-tax-receivable',
    },
  ],
}

const vatNoPurchaseAccount: TaxCodeShape = {
  ...vatRecoverable,
  id: 'vat-broken',
  components: [{ ...vatRecoverable.components[0], purchaseAccountId: null }],
}

const priced = priceDocument(
  [
    { quantity: '2', unitPrice: '100', taxCodeId: 'vat', incomeAccountId: 'acct-rent' },
    { quantity: '1', unitPrice: '50', taxCodeId: 'vat', incomeAccountId: 'acct-utilities' },
  ],
  new Map([['vat', vatRecoverable]]),
  'USD',
)

const base = {
  date: '2026-03-15' as const,
  number: 'BILL-00001',
  documentId: 'doc-1',
  vendorId: 'vend-1',
  priced,
  payableAccountId: 'acct-ap',
  fallbackExpenseAccountId: 'acct-uncategorised',
}

function totals(lines: { debit?: unknown; credit?: unknown }[]) {
  let debit = new Decimal(0)
  let credit = new Decimal(0)
  for (const line of lines) {
    if (line.debit) debit = debit.plus(String(line.debit))
    if (line.credit) credit = credit.plus(String(line.credit))
  }
  return { debit, credit }
}

describe('bill', () => {
  const journal = buildBillJournal(base)

  it('credits payables for the whole total, carrying the vendor', () => {
    const ap = journal.lines.find((line) => line.accountId === 'acct-ap')
    expect(ap?.credit?.toString()).toBe('290')
    // R7: an AP line without its vendor is refused by the database.
    expect(ap?.vendorId).toBe('vend-1')
  })

  it('debits each cost account at the net amount', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-rent')?.debit?.toString()).toBe('200')
    expect(journal.lines.find((l) => l.accountId === 'acct-utilities')?.debit?.toString()).toBe('50')
  })

  it('debits recoverable tax to the rate\'s purchase account, not the sales one', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-tax-receivable')?.debit?.toString()).toBe('40')
    expect(journal.lines.some((l) => l.accountId === 'acct-tax-payable')).toBe(false)
  })

  it('balances', () => {
    const { debit, credit } = totals(journal.lines)
    expect(debit.toString()).toBe(credit.toString())
    expect(debit.toString()).toBe('290')
  })

  it('is the exact mirror of an invoice for the same amounts', () => {
    const invoice = buildInvoiceJournal({
      ...base,
      customerId: 'cust-1',
      receivableAccountId: 'acct-ar',
      fallbackIncomeAccountId: 'acct-uncategorised',
      number: 'INV-00001',
    })
    // The invoice debits AR and credits income; the bill credits AP and debits
    // cost. Same shape, opposite sides.
    expect(invoice.lines.find((l) => l.accountId === 'acct-ar')?.debit?.toString()).toBe('290')
    expect(journal.lines.find((l) => l.accountId === 'acct-ap')?.credit?.toString()).toBe('290')
  })
})

describe('expense', () => {
  const journal = buildExpenseJournal({ ...base, paymentAccountId: 'acct-bank' })

  it('credits the bank instead of payables — it never becomes a debt', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-bank')?.credit?.toString()).toBe('290')
    expect(journal.lines.some((l) => l.accountId === 'acct-ap')).toBe(false)
  })

  it('refuses to build without saying what it was paid from', () => {
    expect(() => buildExpenseJournal(base)).toThrow(/which account it was paid from/i)
  })
})

describe('vendor credit', () => {
  it('is the mirror of the bill', () => {
    const bill = buildBillJournal(base)
    const credit = buildVendorCreditJournal(base)

    for (const line of bill.lines) {
      const mirrored = credit.lines.find((l) => l.accountId === line.accountId)
      expect(String(mirrored?.credit ?? 0)).toBe(String(line.debit ?? 0))
      expect(String(mirrored?.debit ?? 0)).toBe(String(line.credit ?? 0))
    }

    expect(credit.lines.find((l) => l.accountId === 'acct-ap')?.vendorId).toBe('vend-1')
  })

  it('posts the gap when returned stock leaves at a higher book cost than the credit', () => {
    const stockPriced = priceDocument(
      [
        {
          quantity: '10',
          unitPrice: '280',
          taxCodeId: 'vat',
          isStock: true,
        },
      ],
      new Map([['vat', vatRecoverable]]),
      'USD',
    )
    // Document net 2800 + tax 448 = 3248. Stock on the books costs 2868.60.
    const credit = buildVendorCreditJournal({
      ...base,
      number: 'VC-00001',
      priced: stockPriced,
      stock: [{ inventoryAccountId: 'acct-inventory', amount: new Decimal('2868.60') }],
      stockCostDifference: new Decimal('68.60'),
    })

    expect(credit.lines.find((l) => l.accountId === 'acct-ap')?.debit?.toString()).toBe(
      stockPriced.total.toString(),
    )
    expect(credit.lines.find((l) => l.accountId === 'acct-inventory')?.credit?.toString()).toBe(
      '2868.6',
    )
    expect(
      credit.lines.find((l) => l.accountId === 'acct-uncategorised')?.debit?.toString(),
    ).toBe('68.6')

    const { debit, credit: creditTotal } = totals(credit.lines)
    expect(debit.toString()).toBe(creditTotal.toString())
  })
})

describe('bill payment', () => {
  const journal = buildBillPaymentJournal({
    date: '2026-04-01',
    number: 'BP-00001',
    paymentId: 'pay-1',
    vendorId: 'vend-1',
    amount: '290',
    paymentAccountId: 'acct-bank',
    payableAccountId: 'acct-ap',
  })

  it('takes the debt out of the bank', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-ap')?.debit?.toString()).toBe('290')
    expect(journal.lines.find((l) => l.accountId === 'acct-bank')?.credit?.toString()).toBe('290')
  })

  it('touches no expense account — the cost was recognised on the bill', () => {
    expect(journal.lines).toHaveLength(2)
    expect(journal.lines.some((l) => l.accountId === 'acct-rent')).toBe(false)
  })

  it('carries the vendor on the payables line', () => {
    expect(journal.lines.find((l) => l.accountId === 'acct-ap')?.vendorId).toBe('vend-1')
  })
})

describe('tax with no purchase account', () => {
  it('refuses rather than silently dropping the tax', () => {
    // Dropping it would understate the cost of everything bought under that rate.
    const brokenPricing = priceDocument(
      [{ quantity: '1', unitPrice: '100', taxCodeId: 'vat-broken', incomeAccountId: 'acct-rent' }],
      new Map([['vat-broken', vatNoPurchaseAccount]]),
      'USD',
    )
    expect(() => buildBillJournal({ ...base, priced: brokenPricing })).toThrow(
      /has no purchase account/i,
    )
  })
})

describe('cost grouping', () => {
  it('merges lines that share a cost account', () => {
    const shared = priceDocument(
      [
        { quantity: '1', unitPrice: '10', incomeAccountId: 'acct-rent' },
        { quantity: '1', unitPrice: '15', incomeAccountId: 'acct-rent' },
      ],
      new Map(),
      'USD',
    )
    const journal = buildBillJournal({ ...base, priced: shared })
    const rentLines = journal.lines.filter((l) => l.accountId === 'acct-rent')
    expect(rentLines).toHaveLength(1)
    expect(rentLines[0].debit?.toString()).toBe('25')
  })

  it('falls back to uncategorised expense, where it will be conspicuous', () => {
    const unmapped = priceDocument([{ quantity: '1', unitPrice: '10' }], new Map(), 'USD')
    const journal = buildBillJournal({ ...base, priced: unmapped })
    expect(journal.lines.find((l) => l.accountId === 'acct-uncategorised')?.debit?.toString()).toBe('10')
  })
})
