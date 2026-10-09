import { describe, expect, it } from 'vitest'

import { ITEM_DEFAULT_HIDDEN, ITEM_MAIN_COLUMN_IDS } from '@/lib/item-table-columns'
import { buildRegisterColumns, defaultRegisterPrefs } from '@/lib/register-table-columns'
import { partitionColumns } from '@/lib/table-fit'

describe('table columns', () => {
  it('shows every register column by default, including the contra account', () => {
    const ids = buildRegisterColumns([{ code: '4000', name: 'Sales' }]).map((column) => column.id)
    expect(defaultRegisterPrefs(ids).hidden).toEqual([])
    expect(ids).toContain('contra')
    expect(ids).toContain('split:4000')
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

  it('keeps item money on the first row', () => {
    const columns = [
      { id: 'name', label: 'Item' },
      { id: 'sku', label: 'SKU' },
      { id: 'price', label: 'Price' },
      { id: 'store:1', label: 'Xafiiska' },
    ]
    const { main, extra } = partitionColumns(columns, ITEM_MAIN_COLUMN_IDS)
    expect(main.map((column) => column.id)).toEqual(['name', 'price'])
    expect(extra.map((column) => column.id)).toEqual(['sku', 'store:1'])
  })
})
