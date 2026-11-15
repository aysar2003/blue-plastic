import { describe, expect, it } from 'vitest'

import {
  assertPharmacyIssue,
  controlledMovementsToCsv,
  daysUntilExpiry,
  isLotExpired,
  pickFefoLot,
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

  it('picks earliest non-expired lot with stock (FEFO)', () => {
    const pick = pickFefoLot(
      [
        { lotId: '1', lotNumber: 'B', expiryDate: '2027-06-01', quantity: '5' },
        { lotId: '2', lotNumber: 'A', expiryDate: '2027-03-01', quantity: '2' },
        { lotId: '3', lotNumber: 'C', expiryDate: '2026-01-01', quantity: '1' },
      ],
      '2026-11-07',
    )
    expect(pick?.lotNumber).toBe('A')
    expect(pickFefoLot([{ lotId: 'x', lotNumber: 'X', expiryDate: '2025-01-01', quantity: '1' }], '2026-11-07')).toBeNull()
  })

  it('exports controlled movement audit CSV', () => {
    const csv = controlledMovementsToCsv([
      {
        id: 'm1',
        date: '2026-11-01',
        type: 'SALE',
        quantity: '-2',
        lotNumber: 'L1',
        itemId: 'i1',
        itemName: 'Amox',
        sku: 'AMX',
        journalId: null,
        journalNumber: null,
      },
    ])
    expect(csv).toContain('date,itemName,sku')
    expect(csv).toContain('2026-11-01,Amox,AMX,L1,SALE,-2')
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
  it('is vertical-ready with expiry checklist and controlled movement scope', () => {
    const pack = getPack('pharmacy')
    expect(pack?.verticalStatus).toBe('ready')
    expect(pack?.setupChecklist.some((row) => row.id === 'expiry')).toBe(true)
    expect(pack?.inScope.some((line) => /expiry/i.test(line))).toBe(true)
    expect(pack?.inScope.some((line) => /controlled lot movement/i.test(line))).toBe(true)
  })
})
