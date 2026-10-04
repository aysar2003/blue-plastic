import { describe, expect, it } from 'vitest'

import { foldStoreQuantities, shortStockNote, type StoreChoice } from '@/lib/store-stock'

const stores: StoreChoice[] = [
  { id: 'office', name: 'Xafiiska', isOffice: true },
  { id: 'two', name: 'Store 2', isOffice: false },
]

describe('foldStoreQuantities', () => {
  it('counts stock with no store at the office and keeps the columns adding up', () => {
    const folded = foldStoreQuantities(
      [
        { itemId: 'tabo', storeId: null, quantity: '1000' },
        { itemId: 'tabo', storeId: 'two', quantity: '250' },
      ],
      'office',
    )
    expect(folded.tabo).toEqual({ office: '1000.00', two: '250.00' })
  })

  it('adds a later receipt in the same store onto what is already there', () => {
    const folded = foldStoreQuantities(
      [
        { itemId: 'tabo', storeId: 'office', quantity: '1000' },
        { itemId: 'tabo', storeId: null, quantity: '-10' },
      ],
      'office',
    )
    expect(folded.tabo?.office).toBe('990.00')
  })
})

describe('shortStockNote', () => {
  const stock = { tabo: { office: '0.00', two: '250.00' } }

  it('names the store that still has the item when the office is out', () => {
    expect(shortStockNote(stores, stock, 'tabo', 'office', '1')).toBe(
      'Xafiiska has 0.00. Store 2 has 250.00.',
    )
  })

  it('stays quiet when the chosen store has enough', () => {
    expect(shortStockNote(stores, stock, 'tabo', 'two', '10')).toBeNull()
  })

  it('says the store may go below zero when nowhere else has it', () => {
    expect(shortStockNote(stores, { tabo: { office: '0.00', two: '0.00' } }, 'tabo', 'office', '2')).toBe(
      'Xafiiska has 0.00. This store can go below zero. A later bill fills it.',
    )
  })
})
