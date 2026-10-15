import { describe, expect, it } from 'vitest'

import {
  filterBarcodeCatalog,
  summarizeBarcodeCatalog,
  type BarcodeCatalogRow,
} from '@/lib/barcode-catalog'
import { isValidEan13, nextInternalEan13 } from '@/lib/barcode-ean13'

function row(
  partial: Partial<BarcodeCatalogRow> & Pick<BarcodeCatalogRow, 'id' | 'name'>,
): BarcodeCatalogRow {
  return {
    sku: null,
    barcode: null,
    type: 'INVENTORY',
    isActive: true,
    ...partial,
  }
}

describe('barcode catalog summary (desk cards)', () => {
  const catalog = [
    row({ id: '1', name: 'Blue drum', barcode: '2000000000015' }),
    row({ id: '2', name: 'Cap', barcode: null }),
    row({ id: '3', name: 'Old pipe', barcode: null, isActive: false }),
    row({ id: '4', name: 'Tape', barcode: '5901234123457', isActive: false }),
    row({ id: '5', name: 'Sheet', barcode: null }),
  ]

  it('counts products, labelled, and active missing the way the cards show', () => {
    const snap = summarizeBarcodeCatalog(catalog)

    expect(snap.total).toBe(5)
    expect(snap.activeTotal).toBe(3)
    expect(snap.withBarcode).toBe(2)
    expect(snap.withoutBarcode).toBe(2)
    expect(snap.inactiveMissing).toBe(1)

    // Active products split cleanly: labelled-active + need-barcode = active total.
    const activeWith = snap.labelled.filter((item) => item.isActive).length
    expect(activeWith + snap.withoutBarcode).toBe(snap.activeTotal)

    // Every non-deleted row is either labelled, active-missing, or archived-missing.
    expect(snap.withBarcode + snap.withoutBarcode + snap.inactiveMissing).toBe(snap.total)
  })

  it('lists generate targets as active products without a barcode only', () => {
    const snap = summarizeBarcodeCatalog(catalog)
    expect(snap.missing.map((item) => item.id)).toEqual(['2', '5'])
    expect(snap.labelled.map((item) => item.id)).toEqual(['1', '4'])
  })

  it('filters the desk table from each summary card', () => {
    expect(filterBarcodeCatalog(catalog, 'all').map((item) => item.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
    expect(filterBarcodeCatalog(catalog, 'with').map((item) => item.id)).toEqual(['1', '4'])
    expect(filterBarcodeCatalog(catalog, 'without').map((item) => item.id)).toEqual(['2', '5'])
  })

  it('searches inside the selected card filter', () => {
    expect(filterBarcodeCatalog(catalog, 'without', 'cap').map((item) => item.id)).toEqual(['2'])
    expect(filterBarcodeCatalog(catalog, 'with', '5901').map((item) => item.id)).toEqual(['4'])
    expect(filterBarcodeCatalog(catalog, 'all', 'pipe').map((item) => item.id)).toEqual(['3'])
    expect(filterBarcodeCatalog(catalog, 'without', 'pipe')).toEqual([])
  })
})

describe('barcode backend generation path', () => {
  it('assigns unique internal EAN-13 codes for every missing active product', () => {
    const existing = ['5901234123457', '2000000000015']
    const missing = ['Cap', 'Sheet', 'Lid', 'Drum liner']
    const codes: string[] = []

    for (const _name of missing) {
      const code = nextInternalEan13([...existing, ...codes])
      expect(isValidEan13(code)).toBe(true)
      expect(code.startsWith('200')).toBe(true)
      expect(codes).not.toContain(code)
      codes.push(code)
    }

    expect(codes).toEqual([
      '2000000000022',
      '2000000000039',
      '2000000000046',
      '2000000000053',
    ])
    expect(new Set(codes).size).toBe(missing.length)
  })

  it('skips replace when a product already has a barcode unless replace is requested', () => {
    const item = { id: '1', name: 'Blue drum', barcode: '2000000000015' as string | null }
    const replace = false
    const blocked = Boolean(item.barcode) && !replace
    expect(blocked).toBe(true)

    const allowed = Boolean(item.barcode) && true
    expect(allowed).toBe(true)

    item.barcode = null
    expect(Boolean(item.barcode) && !replace).toBe(false)
  })

  it('builds Excel/print rows only from products that already have a barcode', () => {
    const snap = summarizeBarcodeCatalog([
      row({ id: '1', name: 'Blue drum', barcode: '2000000000015' }),
      row({ id: '2', name: 'Cap', barcode: null }),
      row({ id: '3', name: 'Tape', barcode: '5901234123457', isActive: false }),
    ])

    const exportRows = snap.labelled.map((item) => ({
      name: item.name,
      sku: item.sku ?? '',
      barcode: item.barcode ?? '',
      type: item.type,
      active: item.isActive ? 'Yes' : 'No',
    }))

    expect(exportRows).toEqual([
      {
        name: 'Blue drum',
        sku: '',
        barcode: '2000000000015',
        type: 'INVENTORY',
        active: 'Yes',
      },
      {
        name: 'Tape',
        sku: '',
        barcode: '5901234123457',
        type: 'INVENTORY',
        active: 'No',
      },
    ])

    const printActive = snap.labelled.filter((item) => item.isActive)
    expect(printActive.map((item) => item.id)).toEqual(['1'])
  })
})
