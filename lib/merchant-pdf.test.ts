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
})
