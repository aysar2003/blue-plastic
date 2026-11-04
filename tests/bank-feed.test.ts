import { describe, expect, it } from 'vitest'

import { groupKey, ruleFor } from '@/lib/bank-feed'

describe('bank feed helpers', () => {
  it('groups a payee by its words, ignoring the amount', () => {
    expect(groupKey('SLACK T8K2 29.00')).toBe('slack')
    expect(groupKey('Slack')).toBe('slack')
  })

  it('uses the first rule whose text is inside the description', () => {
    const rules = [
      {
        id: '1',
        name: 'Slack',
        contains: 'slack',
        accountId: null,
        categoryAccountId: 'software',
        vendorId: 'v',
        customerId: null,
      },
    ]
    expect(ruleFor('POS SLACK*HQ', 'bank', rules)?.name).toBe('Slack')
    expect(ruleFor('AMAZON', 'bank', rules)).toBeNull()
  })

  it('prefers a rule for this bank over one that applies everywhere', () => {
    const shared = {
      contains: 'slack',
      categoryAccountId: 'software',
      vendorId: 'v',
      customerId: null,
    }
    const rules = [
      { id: 'g', name: 'Anywhere', accountId: null, ...shared },
      { id: 'b', name: 'This bank', accountId: 'bank', ...shared },
      { id: 'z', name: 'Zebra bank', accountId: 'bank', ...shared },
    ]
    expect(ruleFor('POS SLACK', 'bank', rules)?.name).toBe('This bank')
    expect(ruleFor('POS SLACK', 'other', rules)?.name).toBe('Anywhere')
  })
})
