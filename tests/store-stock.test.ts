import { describe, expect, it } from 'vitest'

import {
  foldStoreQuantities,
  negativeStockWarning,
  shortStockNote,
  stockWarningText,
  type StoreChoice,
} from '@/lib/store-stock'

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
    expect(shortStockNote(stores, stock, 'tabo', 'office', '1')).toBe('Also in Store 2 (250).')
  })

  it('stays quiet when the chosen store has enough', () => {
    expect(shortStockNote(stores, stock, 'tabo', 'two', '10')).toBeNull()
  })

  it('leaves the below-zero message to the line warning when nowhere else has it', () => {
    expect(shortStockNote(stores, { tabo: { office: '0.00', two: '0.00' } }, 'tabo', 'office', '2')).toBeNull()
  })
})

describe('negativeStockWarning', () => {
  it('stays quiet while the store still covers the sale', () => {
    expect(negativeStockWarning(5, 5, 'Xafiiska')).toBeNull()
    expect(negativeStockWarning(5, 2, 'Xafiiska')).toBeNull()
  })

  it('warns at zero even before a quantity is typed', () => {
    const warning = negativeStockWarning(0, Number(''), 'Xafiiska')
    expect(warning).toEqual({ storeName: 'Xafiiska', onHand: 0, after: 0 })
    expect(stockWarningText(warning!)).toBe('Stock: 0 at Xafiiska. Will go negative.')
  })

  it('shows store quantity and the quantity after the sale', () => {
    const warning = negativeStockWarning(3, 5, 'Store 2')
    expect(stockWarningText(warning!)).toBe('Stock: 3 at Store 2 \u2192 \u22122 after this sale. Will go negative.')
  })

  it('says when the store is already below zero', () => {
    expect(stockWarningText(negativeStockWarning(-1.5, 1, 'Xafiiska')!)).toBe(
      'Stock: \u22121.50 at Xafiiska \u2192 \u22122.50 after this sale. Already below zero.',
    )
  })
})
