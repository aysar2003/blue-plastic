import { describe, expect, it } from 'vitest'

import {
  canBillMilestone,
  contractBilledRemaining,
  effectiveContractValue,
  milestoneAmount,
  milestonePercentsValid,
} from '@/lib/erp/contracts'

describe('contract milestones', () => {
  it('rejects billing inactive or billed milestones', () => {
    expect(
      canBillMilestone({
        contractStatus: 'DRAFT',
        milestoneBilledAt: null,
        milestonePercent: '25',
      }).ok,
    ).toBe(false)
    expect(
      canBillMilestone({
        contractStatus: 'ACTIVE',
        milestoneBilledAt: new Date(),
        milestonePercent: '25',
      }).ok,
    ).toBe(false)
    expect(
      canBillMilestone({
        contractStatus: 'ACTIVE',
        milestoneBilledAt: null,
        milestonePercent: '25',
      }).ok,
    ).toBe(true)
  })

  it('computes milestone amount', () => {
    expect(milestoneAmount('10000', '25')).toBe('2500.0000')
  })

  it('validates percent sum', () => {
    expect(milestonePercentsValid(['50', '50'])).toBe(true)
    expect(milestonePercentsValid(['60', '50'])).toBe(false)
  })

  it('adds change orders to remaining', () => {
    expect(effectiveContractValue('10000', '1500')).toBe('11500.0000')
    const remaining = contractBilledRemaining({
      contractValue: '10000',
      changeOrderAmount: '1500',
      billedAmount: '2500',
    })
    expect(remaining.effective).toBe('11500.0000')
    expect(remaining.remaining).toBe('9000.0000')
  })
})