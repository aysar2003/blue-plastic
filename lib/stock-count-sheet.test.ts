import { describe, expect, it } from 'vitest'

import { normaliseHeader } from '@/lib/csv'
import { parseStockCountRows } from '@/lib/stock-count-sheet'

function row(cells: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(cells)) out[normaliseHeader(key)] = value
  return out
}

const catalog = [
  { id: 'i1', label: 'A4 — Paper', sku: 'A4', onHand: '10.00' },
  { id: 'i2', label: 'Tape', sku: null, onHand: '5.00' },
]

describe('parseStockCountRows', () => {
  it('imports only rows with a different count', () => {
    const result = parseStockCountRows(
      [
        row({ 'Item ID': 'i1', SKU: 'A4', Name: 'Paper', 'Books say': '10', 'Count found': '8', Note: 'short' }),
        row({ 'Item ID': 'i2', Name: 'Tape', 'Books say': '5', 'Count found': '', Note: '' }),
        row({ 'Item ID': 'i2', Name: 'Tape', 'Books say': '5', 'Count found': '5', Note: '' }),
      ],
      catalog,
    )
    expect(result.lines).toEqual([
      { itemId: 'i1', label: 'A4 — Paper', counted: '8', description: 'short', booksSay: '10.00' },
    ])
    expect(result.skipped).toBe(2)
    expect(result.issues).toHaveLength(0)
  })

  it('matches by SKU when Item ID is missing', () => {
    const result = parseStockCountRows(
      [row({ SKU: 'A4', 'Count found': '12' })],
      catalog,
    )
    expect(result.lines[0]?.itemId).toBe('i1')
    expect(result.lines[0]?.counted).toBe('12')
  })
})
