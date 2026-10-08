import { describe, expect, it } from 'vitest'

import {
  foldStoreQuantities,
  negativeStockWarning,
  shortStockNote,
  formatStockQty,
  stockWarningTitle,
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
  it('stays quiet while on hand covers the sale', () => {
    expect(negativeStockWarning(5, 5, 'Xafiiska')).toBeNull()
    expect(negativeStockWarning(5, 2, 'Xafiiska')).toBeNull()
    expect(negativeStockWarning(0, Number(''), 'Xafiiska')).toBeNull()
  })

  it('gives the quantity left after the sale when it is below zero', () => {
    expect(negativeStockWarning(-7, 2, 'Xafiiska')).toEqual({ storeName: 'Xafiiska', onHand: -7, after: -9 })
    expect(negativeStockWarning(100, 150, 'Xafiiska')?.after).toBe(-50)
    expect(negativeStockWarning(0, 1, 'Xafiiska')?.after).toBe(-1)
  })

  it('formats the bare number with a minus sign and a hover description', () => {
    expect(formatStockQty(-9)).toBe('\u22129')
    expect(formatStockQty(-102)).toBe('\u2212102')
    expect(formatStockQty(-2.5)).toBe('\u22122.50')
    expect(stockWarningTitle(negativeStockWarning(-7, 2, 'Xafiiska')!)).toBe(
      'Xafiiska after this sale: \u22129 (on hand \u22127)',
    )
  })
})
