import { describe, expect, it } from 'vitest'

import { accentWashRgb, hexToPdfRgb, merchantPdfLetterhead } from './merchant-pdf'

describe('merchant-pdf', () => {
  it('parses a hex accent into PDF RGB', () => {
    expect(hexToPdfRgb('#1eb8ae')).toEqual([
      30 / 255,
      184 / 255,
      174 / 255,
    ])
  })

  it('washes the accent toward white for row stripes', () => {
    const wash = accentWashRgb([1, 0, 0])
    expect(wash[0]).toBeCloseTo(0.16 + 0.84, 5)
    expect(wash[1]).toBeCloseTo(0.84, 5)
  })

  it('puts the company name in the template accent colour', () => {
    const rows = merchantPdfLetterhead({
      orgName: 'AL FURAAT',
      orgPhone: '252-1',
      accent: hexToPdfRgb('#1eb8ae'),
    })
    expect(rows[0]?.runs[0]?.text).toBe('AL FURAAT')
    expect(rows[0]?.runs[0]?.color).toEqual(hexToPdfRgb('#1eb8ae'))
    expect(rows.some((row) => row.runs.some((run) => run.text.includes('TEL:')))).toBe(true)
  })

  it('joins street, city, and country into one ADDR line', () => {
    const rows = merchantPdfLetterhead({
      orgName: 'AL FURAAT',
      orgAddress: ['Furaat Store, Balcad Street', 'Kismaayo, SOMALIA', 'US'],
    })
    const addr = rows.flatMap((row) => row.runs.map((run) => run.text)).filter((text) => text.startsWith('ADDR:'))
    expect(addr).toEqual(['ADDR: Furaat Store, Balcad Street, Kismaayo, SOMALIA, US'])
  })
})
