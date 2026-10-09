import { describe, expect, it } from 'vitest'

import {
  columnMinWidth,
  columnShareWeights,
  columnsForViewport,
  compareSortValues,
  mergeGridLayout,
  moveItem,
  nextSort,
  sumAmounts,
} from './interactive-grid'

describe('column sort', () => {
  it('starts amounts high to low and text from A to Z', () => {
    expect(nextSort(null, 'debit', true)).toEqual({ id: 'debit', dir: 'desc' })
    expect(nextSort(null, 'name', false)).toEqual({ id: 'name', dir: 'asc' })
  })

  it('flips direction on the same column and starts over on a new one', () => {
    expect(nextSort({ id: 'name', dir: 'asc' }, 'name', false)).toEqual({ id: 'name', dir: 'desc' })
    expect(nextSort({ id: 'name', dir: 'desc' }, 'date', false)).toEqual({ id: 'date', dir: 'asc' })
  })

  it('keeps blank cells at the bottom', () => {
    expect(compareSortValues(null, 'B', 'asc', false)).toBe(1)
    expect(compareSortValues(null, 'B', 'desc', false)).toBe(1)
    expect(compareSortValues('A', '', 'desc', false)).toBe(-1)
  })

  it('orders numbers by value, not by their text', () => {
    expect(compareSortValues('9', '10', 'asc', true)).toBeLessThan(0)
    expect(compareSortValues('-4', '2', 'desc', true)).toBeGreaterThan(0)
  })
})

describe('column layout', () => {
  it('moves a column to the drop position', () => {
    expect(moveItem(['date', 'type', 'name'], 'date', 'name')).toEqual(['type', 'name', 'date'])
    expect(moveItem(['date', 'type'], 'date', 'date')).toEqual(['date', 'type'])
  })

  it('keeps a saved order, appends new columns, and drops ones that no longer exist', () => {
    const layout = mergeGridLayout(
      { order: ['name', 'gone', 'date'], hidden: ['gone', 'name'], widths: { date: 200 } },
      ['date', 'name', 'amount'],
      [],
      { date: 120, name: 160, amount: 128 },
    )
    expect(layout.order).toEqual(['name', 'date', 'amount'])
    expect(layout.hidden).toEqual(['name'])
    expect(layout.widths.date).toBe(200)
    expect(layout.widths.amount).toBe(128)
  })
})

describe('fitted columns', () => {
  const ledger = [
    { id: 'date', kind: 'datetime' as const },
    { id: 'entry', kind: 'text' as const },
    { id: 'type', kind: 'text' as const },
    { id: 'name', kind: 'text' as const },
    { id: 'description', kind: 'text' as const },
    { id: 'document', kind: 'text' as const },
    { id: 'contra', kind: 'text' as const },
    { id: 'split:1010', kind: 'money' as const },
    { id: 'split:4000', kind: 'money' as const },
    { id: 'split:5000', kind: 'money' as const },
    { id: 'debit', kind: 'money' as const },
    { id: 'credit', kind: 'money' as const },
    { id: 'balance', kind: 'money' as const },
  ]
  const preferred: Record<string, number> = {
    date: 188,
    entry: 128,
    type: 148,
    name: 168,
    description: 240,
    document: 128,
    contra: 180,
    'split:1010': 150,
    'split:4000': 150,
    'split:5000': 150,
    debit: 120,
    credit: 120,
    balance: 136,
  }

  it('keeps the ledger on one row and the other accounts underneath', () => {
    const { main, extra } = columnsForViewport(ledger, preferred, 1180)
    expect(main.map((column) => column.id)).toEqual([
      'date',
      'entry',
      'type',
      'name',
      'description',
      'document',
      'contra',
      'debit',
      'credit',
      'balance',
    ])
    expect(extra.map((column) => column.id)).toEqual(['split:1010', 'split:4000', 'split:5000'])
  })

  it('gives every amount a readable share of a laptop page', () => {
    const main = ledger.filter((column) => !column.id.startsWith('split:'))
    const weights = columnShareWeights(main, preferred, 1180)
    const sum = weights.reduce((total, weight) => total + weight, 0)
    for (const [index, column] of main.entries()) {
      const pixels = ((weights[index] ?? 0) / sum) * 1180
      expect(pixels).toBeGreaterThanOrEqual(columnMinWidth(column.kind) - 0.5)
    }
  })

  it('moves the widest note under the row when the page cannot hold it', () => {
    const { main, extra } = columnsForViewport(ledger, preferred, 700)
    expect(main.map((column) => column.id)).not.toContain('description')
    expect(extra.map((column) => column.id)).toContain('description')
    expect(main.map((column) => column.id)).toEqual(expect.arrayContaining(['debit', 'credit', 'balance']))
  })
})

describe('totals', () => {
  it('sums numeric cells and ignores blanks and labels', () => {
    expect(sumAmounts(['10.5', null, '', '2.25', 'Total'])).toBe('12.75')
    expect(sumAmounts(['-4', '1.5'])).toBe('-2.5')
  })
})
