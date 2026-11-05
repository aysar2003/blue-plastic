import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { evaluateThreeWayMatch } from '@/lib/purchase-three-way-match'

const po = (overrides: Partial<{ qty: string; received: string; price: string; itemId: string }> = {}) => ({
  itemId: overrides.itemId ?? 'item-1',
  description: 'Cement',
  quantity: new Decimal(overrides.qty ?? '10'),
  quantityReceived: new Decimal(overrides.received ?? '10'),
  unitPrice: new Decimal(overrides.price ?? '25'),
})

const bill = (overrides: Partial<{ qty: string; price: string; itemId: string }> = {}) => ({
  itemId: overrides.itemId ?? 'item-1',
  description: 'Cement',
  quantity: new Decimal(overrides.qty ?? '10'),
  unitPrice: new Decimal(overrides.price ?? '25'),
})

describe('evaluateThreeWayMatch', () => {
  it('accepts a bill that matches ordered, received, and price', () => {
    const result = evaluateThreeWayMatch({
      poLines: [po()],
      billLines: [bill()],
      siblingBillLines: [],
    })
    expect(result).toEqual({ ok: true })
  })

  it('holds when the bill price differs from the PO', () => {
    const result = evaluateThreeWayMatch({
      poLines: [po()],
      billLines: [bill({ price: '30' })],
      siblingBillLines: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons[0]).toMatch(/Price/)
  })

  it('holds when billed quantity exceeds received', () => {
    const result = evaluateThreeWayMatch({
      poLines: [po({ received: '4' })],
      billLines: [bill({ qty: '5' })],
      siblingBillLines: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.some((r) => /received/.test(r))).toBe(true)
  })

  it('holds when billed quantity exceeds ordered', () => {
    const result = evaluateThreeWayMatch({
      poLines: [po({ qty: '5', received: '8' })],
      billLines: [bill({ qty: '8' })],
      siblingBillLines: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.some((r) => /ordered/.test(r))).toBe(true)
  })

  it('counts sibling bills toward the billed total', () => {
    const result = evaluateThreeWayMatch({
      poLines: [po({ qty: '10', received: '10' })],
      billLines: [bill({ qty: '4' })],
      siblingBillLines: [{ itemId: 'item-1', description: 'Cement', quantity: new Decimal('7') }],
    })
    expect(result.ok).toBe(false)
  })
})
