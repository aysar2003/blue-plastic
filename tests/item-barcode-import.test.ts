import { describe, expect, it } from 'vitest'

import { ITEM_TEMPLATE, sampleRows } from '@/lib/import-template'
import { matchPosBarcode } from '@/lib/pos-barcode'
import { shapeItem } from '@/lib/spreadsheet'
import { parseCsv } from '@/lib/csv'

describe('item barcode import', () => {
  it('includes Barcode as an optional column on the blank sheet', () => {
    const column = ITEM_TEMPLATE.find((entry) => entry.header === 'Barcode')
    expect(column).toMatchObject({
      required: false,
      example: '5901234123457',
    })
    expect(ITEM_TEMPLATE.findIndex((entry) => entry.header === 'SKU')).toBeLessThan(
      ITEM_TEMPLATE.findIndex((entry) => entry.header === 'Barcode'),
    )
  })

  it('puts a ready barcode on the sample inventory row', () => {
    const rows = sampleRows('item')
    expect(rows[0]).toEqual(expect.arrayContaining(['5901234123457']))
  })

  it('reads a pasted barcode from a simple two-column sheet', () => {
    const { rows } = parseCsv(
      ['Product/Service Name,Barcode', 'Blue drum,5901234123457', 'Delivery,5901234123458'].join('\n'),
    )
    expect(shapeItem(rows[0]!, 'DMY').draft).toMatchObject({
      name: 'Blue drum',
      barcode: '5901234123457',
    })
    expect(shapeItem(rows[1]!, 'DMY').draft).toMatchObject({
      name: 'Delivery',
      barcode: '5901234123458',
    })
  })

  it('lets POS sell after an existing item gets a barcode from import or edit', () => {
    const products = [{ id: 'existing', sku: 'DRM-1', barcode: null as string | null }]
    expect(matchPosBarcode(products, '5901234123457')).toBeNull()

    // Same outcome as Edit → Barcode → scan → Save, or import row matching by name.
    products[0]!.barcode = '5901234123457'
    expect(matchPosBarcode(products, '5901234123457')?.id).toBe('existing')
  })
})
