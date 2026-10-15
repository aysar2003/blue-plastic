import { describe, expect, it } from 'vitest'

import { parsePrintInk, toMonoRgb, withPrintInk } from '@/lib/print-ink'

describe('print ink', () => {
  it('parses mono and defaults to color', () => {
    expect(parsePrintInk('mono')).toBe('mono')
    expect(parsePrintInk('color')).toBe('color')
    expect(parsePrintInk(null)).toBe('color')
    expect(parsePrintInk('other')).toBe('color')
  })

  it('greys RGB for black-and-white PDFs', () => {
    expect(toMonoRgb([1, 0, 0])).toEqual([0.299, 0.299, 0.299])
    expect(toMonoRgb([0, 0, 0])).toEqual([0, 0, 0])
    expect(toMonoRgb([1, 1, 1])[0]).toBeCloseTo(1, 10)
  })

  it('appends ink to relative PDF URLs', () => {
    expect(withPrintInk('/api/sales/abc/pdf', 'mono')).toBe('/api/sales/abc/pdf?ink=mono')
    expect(withPrintInk('/api/sales/abc/pdf?x=1', 'color')).toBe('/api/sales/abc/pdf?x=1&ink=color')
  })
})
