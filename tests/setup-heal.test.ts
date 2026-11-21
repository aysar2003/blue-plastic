import { describe, expect, it } from 'vitest'

import { skuFromName } from '@/lib/sku'
import { localizationPackById } from '@/lib/localization/packs'
import { formatShipToWorkSite } from '@/lib/postal-address'
import { shouldHealReorderPoint, SETUP_HEALTH_GAP_HEADERS, type SetupHealthGapRow } from '@/lib/setup-heal'
import { setupHealthGapsCsv } from '@/server/services/setup-health.service'

describe('master-data heal helpers', () => {
  it('skuFromName fills blanks uniquely', () => {
    const taken = new Set<string>()
    const a = skuFromName('Biyo 1.5L', taken)
    taken.add(a.toLowerCase())
    const b = skuFromName('Biyo 1.5L', taken)
    expect(a).toBe('BIYO-15L')
    expect(b).toBe('BIYO-15L-2')
  })

  it('pack country is available for org heal', () => {
    expect(localizationPackById('so')?.country).toBe('SO')
    expect(localizationPackById('ke')?.country).toBe('KE')
  })

  it('reorder heal never overwrites a clerk value', () => {
    expect(shouldHealReorderPoint(null)).toBe(true)
    expect(shouldHealReorderPoint('')).toBe(true)
    expect(shouldHealReorderPoint('1')).toBe(false)
    expect(shouldHealReorderPoint('0')).toBe(false)
    expect(shouldHealReorderPoint(12)).toBe(false)
  })

  it('heal report CSV lists remaining gaps', () => {
    const gaps: SetupHealthGapRow[] = [
      { kind: 'item_missing_sku', name: 'Pipe', sku: null, id: 'i1', detail: 'Active item has no SKU' },
      { kind: 'stock_missing_reorder', name: 'Cement', sku: 'CEM', id: 'i2', detail: 'Stock item has no reorder point' },
    ]
    const csv = setupHealthGapsCsv(gaps)
    expect(csv).toContain(SETUP_HEALTH_GAP_HEADERS[0])
    expect(csv).toContain('item_missing_sku')
    expect(csv).toContain('Pipe')
    expect(csv).toContain('stock_missing_reorder')
  })

  it('formats extra ship-to as work site', () => {
    expect(
      formatShipToWorkSite({
        label: 'Alanley villa',
        line1: 'Wadada 1',
        city: 'Mogadishu',
        country: 'SO',
      }),
    ).toBe('Alanley villa — Wadada 1, Mogadishu, SO')
  })
})
