import { describe, expect, it } from 'vitest'

import {
  parseReportFavourites,
  reportFavouriteKey,
  toggleReportFavourite,
} from '@/lib/report-favourites'

describe('report favourites', () => {
  it('starts empty when nothing is stored', () => {
    expect(parseReportFavourites(null)).toEqual([])
    expect(parseReportFavourites('')).toEqual([])
  })

  it('ignores the older string-key format so the list can reset cleanly', () => {
    expect(parseReportFavourites(JSON.stringify(['/reports/profit-lossProfit and Loss']))).toEqual([])
  })

  it('reads and toggles labelled favourites', () => {
    const row = { href: '/reports/profit-loss', label: 'Profit and Loss' }
    const next = toggleReportFavourite([], row)
    expect(next).toEqual([row])
    expect(reportFavouriteKey(row)).toBe('/reports/profit-lossProfit and Loss')
    expect(toggleReportFavourite(next, row)).toEqual([])
  })
})
