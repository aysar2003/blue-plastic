import { describe, expect, it } from 'vitest'

import {
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

describe('totals', () => {
  it('sums numeric cells and ignores blanks and labels', () => {
    expect(sumAmounts(['10.5', null, '', '2.25', 'Total'])).toBe('12.75')
    expect(sumAmounts(['-4', '1.5'])).toBe('-2.5')
  })
})
