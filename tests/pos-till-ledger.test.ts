import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { rollupParentBalances } from '@/lib/pos-till-ledger'

describe('pos till ledger rollup', () => {
  it('rolls child balances onto the parent for display', () => {
    const rolled = rollupParentBalances([
      { id: 'banks', parentId: null, balance: new Decimal(0) },
      { id: 'till-a', parentId: 'banks', balance: new Decimal(40) },
      { id: 'till-b', parentId: 'banks', balance: new Decimal(15) },
    ])
    expect(rolled.get('banks')?.toString()).toBe('55')
    expect(rolled.get('till-a')?.toString()).toBe('40')
  })

  it('rolls nested sub-accounts up through every parent', () => {
    const rolled = rollupParentBalances([
      { id: 'root', parentId: null, balance: new Decimal(0) },
      { id: 'mid', parentId: 'root', balance: new Decimal(1) },
      { id: 'leaf', parentId: 'mid', balance: new Decimal(10) },
    ])
    expect(rolled.get('leaf')?.toString()).toBe('10')
    expect(rolled.get('mid')?.toString()).toBe('11')
    expect(rolled.get('root')?.toString()).toBe('11')
  })
})
