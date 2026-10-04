import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { readVendorFilter, vendorEntryVisible } from '@/lib/vendor-statement'

describe('vendor statement filters', () => {
  it('keeps purchase orders off the full statement until that type is chosen', () => {
    const order = { kind: 'PURCHASE_ORDER' as const, openAmount: new Decimal(0), dueDate: null }
    const bill = {
      kind: 'BILL' as const,
      openAmount: new Decimal(1800),
      dueDate: new Date('2026-10-02T00:00:00Z'),
    }
    expect(vendorEntryVisible(order, readVendorFilter({}), '2026-10-03')).toBe(false)
    expect(vendorEntryVisible(bill, readVendorFilter({}), '2026-10-03')).toBe(true)
    expect(vendorEntryVisible(order, readVendorFilter({ type: 'order' }), '2026-10-03')).toBe(true)
  })

  it('reads the three paper styles and treats an open bill as overdue', () => {
    expect(readVendorFilter({ view: 'arrow' }).view).toBe('arrow')
    expect(readVendorFilter({ view: 'group' }).view).toBe('regular')
    const bill = {
      kind: 'BILL' as const,
      openAmount: new Decimal('1800'),
      dueDate: new Date('2026-10-01T00:00:00Z'),
    }
    expect(vendorEntryVisible(bill, readVendorFilter({ status: 'overdue' }), '2026-10-03')).toBe(true)
    expect(vendorEntryVisible({ ...bill, openAmount: new Decimal(0) }, readVendorFilter({ status: 'paid' }), '2026-10-03')).toBe(
      true,
    )
  })
})
