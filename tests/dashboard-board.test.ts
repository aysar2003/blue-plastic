import { describe, expect, it } from 'vitest'

import {
  reportHref,
  thresholdBreached,
  tileTitle,
} from '@/lib/erp/dashboard-board'

describe('dashboard board helpers', () => {
  it('titles KPI and report tiles', () => {
    expect(tileTitle('KPI', 'profitMtd')).toBe('P&L this month')
    expect(tileTitle('REPORT', 'profit-and-loss')).toMatch(/Profit/i)
    expect(tileTitle('KPI', 'openAr', 'AR watch')).toBe('AR watch')
  })

  it('builds report hrefs', () => {
    expect(reportHref('vat-return')).toBe('/reports/vat-return')
  })

  it('flags threshold breaches for watch banners', () => {
    expect(thresholdBreached('1200.00', '1000')).toBe(true)
    expect(thresholdBreached('50', '100')).toBe(false)
    expect(thresholdBreached(null, '10')).toBe(false)
  })
})
