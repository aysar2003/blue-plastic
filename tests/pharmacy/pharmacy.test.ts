import { describe, expect, it } from 'vitest'

import {
  assertPharmacyIssue,
  daysUntilExpiry,
  isLotExpired,
} from '@/lib/erp/pharmacy'
import { getPack } from '@/lib/packs'

describe('pharmacy lot helpers', () => {
  it('treats expiry day as still valid', () => {
    expect(isLotExpired('2026-11-07', '2026-11-07')).toBe(false)
    expect(isLotExpired('2026-11-06', '2026-11-07')).toBe(true)
    expect(isLotExpired(null, '2026-11-07')).toBe(false)
  })

  it('counts days until expiry', () => {
    expect(daysUntilExpiry('2026-11-10', '2026-11-07')).toBe(3)
    expect(daysUntilExpiry('2026-11-05', '2026-11-07')).toBe(-2)
    expect(daysUntilExpiry(null, '2026-11-07')).toBeNull()
  })

  it('requires a lot for controlled items and refuses expired lots', () => {
    expect(
      assertPharmacyIssue({
        item: { name: 'Amox', trackLots: true, pharmacyControlled: true },
        lotNumber: null,
        lotExpiry: '2027-01-01',
        asOf: '2026-11-07',
      }),
    ).toMatch(/requires a lot/i)

    expect(
      assertPharmacyIssue({
        item: { name: 'Amox', trackLots: true, pharmacyControlled: true },
        lotNumber: 'L1',
        lotExpiry: '2026-01-01',
        asOf: '2026-11-07',
      }),
    ).toMatch(/expired/i)

    expect(
      assertPharmacyIssue({
        item: { name: 'Amox', trackLots: true, pharmacyControlled: true },
        lotNumber: 'L1',
        lotExpiry: '2027-01-01',
        asOf: '2026-11-07',
      }),
    ).toBeNull()
  })
})

describe('pharmacy pack', () => {
  it('is vertical-ready with expiry checklist', () => {
    const pack = getPack('pharmacy')
    expect(pack?.verticalStatus).toBe('ready')
    expect(pack?.setupChecklist.some((row) => row.id === 'expiry')).toBe(true)
    expect(pack?.inScope.some((line) => /expiry/i.test(line))).toBe(true)
  })
})
