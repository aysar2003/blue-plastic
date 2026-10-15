import { describe, expect, it } from 'vitest'

import { ITEM_DEFAULT_HIDDEN } from '@/lib/item-table-columns'
import { buildRegisterColumns, defaultRegisterPrefs } from '@/lib/register-table-columns'
import { partitionColumns } from '@/lib/table-fit'

describe('table columns', () => {
  it('hides split account columns by default so the register stays on one clean row', () => {
    const withSplits = buildRegisterColumns([{ code: '4000', name: 'Sales' }]).map((column) => column.id)
    expect(defaultRegisterPrefs(withSplits).hidden).toEqual(['split:4000'])
    expect(withSplits).toContain('contra')
    expect(withSplits).toContain('split:4000')

    const plain = buildRegisterColumns([]).map((column) => column.id)
    expect(defaultRegisterPrefs(plain).hidden).toEqual([])
    expect(plain).toContain('contra')
  })

  it('shows every item column by default', () => {
    expect(ITEM_DEFAULT_HIDDEN).toEqual([])
  })

  it('keeps the ledger figures on the first row and the other accounts underneath', () => {
    const columns = buildRegisterColumns([
      { code: '1200', name: 'Bank Account' },
      { code: '4000', name: 'Sales — Plastic Products' },
      { code: '5000', name: 'Cost of Goods Sold' },
    ])
    const { main, extra } = partitionColumns(columns, [
      'date',
      'entry',
      'type',
      'name',
      'description',
      'document',
      'debit',
      'credit',
      'balance',
    ])

    expect(main.map((column) => column.id)).toEqual([
      'date',
      'entry',
      'type',
      'name',
      'description',
      'document',
      'debit',
      'credit',
      'balance',
    ])
    expect(extra.map((column) => column.label)).toEqual([
      'Contra account',
      'Bank Account',
      'Sales — Plastic Products',
      'Cost of Goods Sold',
    ])
  })
})
