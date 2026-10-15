import { describe, expect, it } from 'vitest'

import { nextInternalEan13 } from '@/lib/barcode-ean13'
import { matchPosBarcode } from '@/lib/pos-barcode'

/**
 * Invoice / receipt line pickers search the Combobox hint. Barcode must sit in
 * that hint so typing or scanning a package code finds the same item POS sells.
 */
function salesLineHint(item: {
  barcode?: string | null
  sku?: string | null
  onHand?: string | null
}) {
  return (
    [item.barcode, item.sku, item.onHand != null ? `${item.onHand} on hand` : null]
      .filter(Boolean)
      .join(' · ') || undefined
  )
}

function findSalesItemByQuery<T extends { id: string; label: string; hint?: string }>(
  options: readonly T[],
  raw: string,
): T | null {
  const needle = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!needle) return null
  const exactHint = options.find((option) => {
    const hint = option.hint?.toLowerCase().replace(/\s+/g, '') ?? ''
    return hint === needle || hint.startsWith(`${needle}·`) || hint.includes(`·${needle}·`)
  })
  if (exactHint) return exactHint
  return (
    options.find((option) => {
      const hint = option.hint?.toLowerCase().replace(/\s+/g, '') ?? ''
      const label = option.label.toLowerCase()
      return hint.includes(needle) || label.includes(needle)
    }) ?? null
  )
}

describe('sales barcode lookup', () => {
  it('puts the barcode first in the line-picker hint so Combobox can search it', () => {
    expect(
      salesLineHint({ barcode: '2000000000015', sku: 'DRM-1', onHand: '12.00' }),
    ).toBe('2000000000015 · DRM-1 · 12.00 on hand')
    expect(salesLineHint({ barcode: null, sku: 'A4', onHand: null })).toBe('A4')
    expect(salesLineHint({ barcode: '000111', sku: null, onHand: null })).toBe('000111')
  })

  it('finds an invoice line item by the same package code POS would sell', () => {
    const code = nextInternalEan13([])
    const catalogue = [
      { id: 'drum', sku: 'DRM-1', barcode: code },
      { id: 'cap', sku: 'CAP-1', barcode: null as string | null },
    ]
    const options = catalogue.map((item) => ({
      id: item.id,
      label: item.id === 'drum' ? 'Blue drum' : 'Bottle cap',
      hint: salesLineHint(item),
    }))

    expect(matchPosBarcode(catalogue, code)?.id).toBe('drum')
    expect(findSalesItemByQuery(options, code)?.id).toBe('drum')
    expect(findSalesItemByQuery(options, ' 2000 0000 00015 ')?.id).toBe('drum')
    expect(findSalesItemByQuery(options, 'DRM-1')?.id).toBe('drum')
    expect(findSalesItemByQuery(options, 'nope')).toBeNull()
  })

  it('lets every sales surface sell after a barcode is attached later', () => {
    const products = [{ id: 'pipe', sku: 'PVC-4', barcode: null as string | null }]
    const options = [
      {
        id: 'pipe',
        label: 'PVC pipe',
        hint: salesLineHint(products[0]!),
      },
    ]
    expect(matchPosBarcode(products, '5901234123457')).toBeNull()
    expect(findSalesItemByQuery(options, '5901234123457')).toBeNull()

    products[0]!.barcode = '5901234123457'
    options[0]!.hint = salesLineHint(products[0]!)

    expect(matchPosBarcode(products, '5901234123457')?.id).toBe('pipe')
    expect(findSalesItemByQuery(options, '5901234123457')?.id).toBe('pipe')
  })
})
