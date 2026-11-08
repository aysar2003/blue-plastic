import { describe, expect, it } from 'vitest'

import {
  budgetVariance,
  canReceiveAsn,
  canReceivePledge,
  clampPercent,
  capacityLoadPercent,
  matchAsnToPoLines,
  progressBillGross,
  progressBillNet,
  retentionHeld,
  routingMinutes,
  utilizationPercent,
  wipFromEntries,
} from '@/lib/erp/verticals-p5'
import { getPack } from '@/lib/packs'

describe('P5 helpers', () => {
  it('computes progress bills with retention', () => {
    const bill = progressBillGross({
      contractValue: '100000',
      alreadyBilledPercent: 20,
      thisBillPercent: 50,
    })
    expect(bill.ok).toBe(true)
    if (bill.ok) {
      expect(bill.gross).toBe('30000.0000')
      expect(retentionHeld(bill.gross, 10)).toBe('3000.0000')
      expect(progressBillNet(bill.gross, 10)).toBe('27000.0000')
    }
    expect(
      progressBillGross({
        contractValue: '100000',
        alreadyBilledPercent: 50,
        thisBillPercent: 40,
      }).ok,
    ).toBe(false)
  })

  it('summarises WIP and utilization', () => {
    const wip = wipFromEntries([
      { hours: '2', billableRate: '50', billable: true },
      { hours: '1', billableRate: '50', billable: true, invoicedAt: 'x' },
      { hours: '3', billableRate: '40', billable: false },
    ])
    expect(wip.entryCount).toBe(1)
    expect(wip.hours).toBe('2.0000')
    expect(wip.amount).toBe('100.0000')
    expect(utilizationPercent(32, 40)).toBe(80)
    expect(clampPercent(150)).toBe(100)
  })

  it('budget variance, routing, asn/pledge gates', () => {
    expect(budgetVariance('1000', '400')).toBe('600.0000')
    expect(routingMinutes([{ minutes: '15' }, { minutes: '45' }])).toBe('60.0000')
    expect(canReceiveAsn('EXPECTED')).toBe(true)
    expect(canReceiveAsn('RECEIVED')).toBe(false)
    expect(canReceivePledge('PLEDGED')).toBe(true)
    expect(canReceivePledge('CANCELLED')).toBe(false)
  })

  it('matches ASN lines onto open PO remaining qty', () => {
    const ok = matchAsnToPoLines({
      asnLines: [{ itemId: 'i1', quantity: '3' }],
      poLines: [
        { lineId: 'l1', itemId: 'i1', ordered: '2', received: '0' },
        { lineId: 'l2', itemId: 'i1', ordered: '5', received: '1' },
      ],
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.lines).toEqual([
        { lineId: 'l1', quantity: '2.0000' },
        { lineId: 'l2', quantity: '1.0000' },
      ])
    }
    expect(
      matchAsnToPoLines({
        asnLines: [{ itemId: 'i1', quantity: '10' }],
        poLines: [{ lineId: 'l1', itemId: 'i1', ordered: '2', received: '0' }],
      }).ok,
    ).toBe(false)
  })

  it('computes work-center capacity load', () => {
    expect(capacityLoadPercent(1200, 2400)).toBe(50)
    expect(capacityLoadPercent(3000, 2400)).toBe(125)
  })
})

describe('P5 packs ready', () => {
  it.each(['ngo', 'professional_services', 'construction', 'manufacturing', 'distribution'] as const)(
    '%s is vertical-ready',
    (id) => {
      expect(getPack(id)?.verticalStatus).toBe('ready')
    },
  )
})
