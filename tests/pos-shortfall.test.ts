import { describe, expect, it } from 'vitest'

import { POS_SHORTFALL_DISCOUNT_MAX, settlePaymentShortfall } from '@/lib/pos-shortfall'

describe('settlePaymentShortfall', () => {
  it('treats a tiny unpaid remainder as a discount', () => {
    expect(settlePaymentShortfall(54, 53.95)).toEqual({ status: 'discount', amount: 0.05 })
    expect(settlePaymentShortfall(10, 9.9)).toEqual({ status: 'discount', amount: 0.1 })
  })

  it('blocks a shortfall larger than ten cents', () => {
    expect(settlePaymentShortfall(54, 53)).toEqual({ status: 'short', amount: 1 })
    expect(settlePaymentShortfall(10, 9.89)).toEqual({ status: 'short', amount: 0.11 })
  })

  it('accepts an exact match and refuses overpayment here', () => {
    expect(settlePaymentShortfall(54, 54)).toEqual({ status: 'exact' })
    expect(settlePaymentShortfall(54, 54.5)).toEqual({ status: 'over', amount: 0.5 })
  })

  it('caps the waiveable gap at ten cents', () => {
    expect(POS_SHORTFALL_DISCOUNT_MAX).toBe(0.1)
  })
})
