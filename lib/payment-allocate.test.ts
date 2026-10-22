import { describe, expect, it } from 'vitest'

import { allocatePaymentToInvoices, sortInvoicesForAllocation } from '@/lib/payment-allocate'

describe('receive payment auto-allocation', () => {
  it('pays overdue invoices before later current ones, oldest first', () => {
    const invoices = [
      { id: 'current-old', number: 'INV-1', date: '2026-01-10', balance: '80.00', overdue: false },
      { id: 'overdue-new', number: 'INV-3', date: '2026-06-01', balance: '40.00', overdue: true },
      { id: 'overdue-old', number: 'INV-2', date: '2026-03-01', balance: '100.00', overdue: true },
    ]

    expect(sortInvoicesForAllocation(invoices).map((row) => row.id)).toEqual([
      'overdue-old',
      'overdue-new',
      'current-old',
    ])

    expect(allocatePaymentToInvoices('150', invoices)).toEqual([
      { invoiceId: 'overdue-old', amount: '100.00' },
      { invoiceId: 'overdue-new', amount: '40.00' },
      { invoiceId: 'current-old', amount: '10.00' },
    ])
  })

  it('puts a partial payment on the first overdue invoice and leaves the rest open', () => {
    expect(
      allocatePaymentToInvoices('30', [
        { id: 'a', number: 'INV-1', date: '2026-04-01', balance: '100.00', overdue: true },
        { id: 'b', number: 'INV-2', date: '2026-05-01', balance: '50.00', overdue: true },
      ]),
    ).toEqual([{ invoiceId: 'a', amount: '30.00' }])
  })

  it('continues leftover onto the next invoices after the first is settled', () => {
    expect(
      allocatePaymentToInvoices('120', [
        { id: 'a', number: 'INV-1', date: '2026-04-01', balance: '100.00', overdue: true },
        { id: 'b', number: 'INV-2', date: '2026-05-01', balance: '80.00', overdue: false },
      ]),
    ).toEqual([
      { invoiceId: 'a', amount: '100.00' },
      { invoiceId: 'b', amount: '20.00' },
    ])
  })

  it('leaves leftover unallocated when every invoice is settled', () => {
    expect(
      allocatePaymentToInvoices('500', [
        { id: 'a', number: 'INV-1', date: '2026-04-01', balance: '40.00', overdue: true },
      ]),
    ).toEqual([{ invoiceId: 'a', amount: '40.00' }])
  })
})
