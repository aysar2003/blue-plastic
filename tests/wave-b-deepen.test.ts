import { describe, expect, it } from 'vitest'

import { asnPoDiscrepancy, groupAsnByDockDay } from '@/lib/erp/asn'
import {
  capaCsvRows,
  capaExportBucket,
  isCapaOverdue,
} from '@/lib/erp/capa'
import {
  commitmentVsBudget,
  outstandingPoAmount,
  poStillEncumbered,
  remainingAfterCommitments,
} from '@/lib/erp/commitment-budget'
import {
  capacityAfterExceptions,
  weekdayIndexMon0,
} from '@/lib/erp/routing-capacity'
import { computeSovLine, siteStoreIssueValue } from '@/lib/erp/sov'
import {
  replenishRetainerRemaining,
  utilizationAvailableHours,
  utilizationPercent,
  wipAgeBucket,
} from '@/lib/erp/verticals-p5'
import { wavePackingCsvRows } from '@/lib/erp/wms-bin'

describe('phase 45 ASN / packing', () => {
  it('groups dock appointments by calendar day', () => {
    const days = groupAsnByDockDay([
      {
        id: '1',
        number: 'ASN-2',
        vendorName: 'Acme',
        dockName: 'Bay A',
        dockAt: new Date('2026-11-22T09:30:00.000Z'),
        expectedAt: null,
        status: 'EXPECTED',
      },
      {
        id: '2',
        number: 'ASN-1',
        vendorName: 'Acme',
        dockName: null,
        dockAt: null,
        expectedAt: new Date('2026-11-22T00:00:00.000Z'),
        status: 'EXPECTED',
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.date).toBe('2026-11-22')
    expect(days[0]?.slots).toHaveLength(2)
  })

  it('flags ASN vs PO over and short', () => {
    const rows = asnPoDiscrepancy({
      asnLines: [{ itemId: 'i1', quantity: '5', itemName: 'Widget' }],
      poLines: [{ itemId: 'i1', ordered: '10', received: '8', itemName: 'Widget' }],
    })
    expect(rows[0]?.kind).toBe('over')
    expect(rows[0]?.poOpen).toBe('2.0000')
    expect(
      asnPoDiscrepancy({
        asnLines: [{ itemId: 'i1', quantity: '1', itemName: 'Widget' }],
        poLines: [{ itemId: 'i1', ordered: '10', received: '0', itemName: 'Widget' }],
      })[0]?.kind,
    ).toBe('short')
  })

  it('emits packing csv rows', () => {
    expect(
      wavePackingCsvRows([
        {
          waveNumber: 'WV-1',
          pickStatus: 'PICKED',
          binCode: 'A-01',
          itemName: 'Widget',
          sku: 'W1',
          qty: '2',
          orderNumber: 'SO-1',
          customerName: 'Acme',
        },
      ])[0],
    ).toEqual(['WV-1', 'PICKED', 'A-01', 'Widget', 'W1', '2', 'SO-1', 'Acme'])
  })
})

describe('phase 43 SOV / site store', () => {
  it('computes this bill, retainage, remaining', () => {
    const line = computeSovLine({
      budgetAmount: '1000',
      percentComplete: 40,
      billedPercent: 10,
      retainagePercent: 10,
    })
    expect(line.thisBillGross).toBe('300.0000')
    expect(line.retainage).toBe('30.0000')
    expect(line.thisBillNet).toBe('270.0000')
    expect(line.remaining).toBe('600.0000')
  })

  it('sums site-store issues (negative qty)', () => {
    expect(
      siteStoreIssueValue([
        { quantity: '-2', value: '-50' },
        { quantity: '3', value: '20' },
      ]),
    ).toBe('50.0000')
  })
})

describe('phase 46 utilization / aging / replenish', () => {
  it('uses logged hours as available when they exist', () => {
    expect(utilizationAvailableHours(32, 40)).toBe(32)
    expect(utilizationAvailableHours(0, 40)).toBe(40)
    expect(utilizationPercent(16, 32)).toBe(50)
  })

  it('buckets unbilled WIP by age', () => {
    expect(wipAgeBucket('2026-11-01', '2026-11-21')).toBe('0-30')
    expect(wipAgeBucket('2026-09-01', '2026-11-21')).toBe('61-90')
    expect(wipAgeBucket('2026-01-01', '2026-11-21')).toBe('90+')
  })

  it('tops up retainer remaining', () => {
    expect(replenishRetainerRemaining('20', '80')).toBe('100.0000')
  })
})

describe('phase 39 CAPA export', () => {
  it('marks overdue vs closed buckets', () => {
    expect(isCapaOverdue({ status: 'OPEN', dueDate: '2026-11-01', asOf: '2026-11-21' })).toBe(true)
    expect(isCapaOverdue({ status: 'CLOSED', dueDate: '2026-11-01', asOf: '2026-11-21' })).toBe(false)
    expect(capaExportBucket({ status: 'IN_PROGRESS', dueDate: '2026-11-01', asOf: '2026-11-21' })).toBe(
      'overdue',
    )
    expect(capaCsvRows([{
      number: 'CAP-1',
      title: 'Leak',
      status: 'OPEN',
      bucket: 'overdue',
      ownerName: 'Ali',
      dueDate: '2026-11-01',
      rootCause: 'Seal',
      effectivenessDate: null,
      vendorName: 'Acme',
      lotNumber: 'L1',
    }])[0]?.[3]).toBe('overdue')
  })
})

describe('phase 53 remaining / de-encumber', () => {
  it('remaining = budget − encumbered − actual', () => {
    expect(remainingAfterCommitments({ budget: '1000', encumbered: '300', actual: '200' })).toBe(
      '500.0000',
    )
    const rows = commitmentVsBudget({
      openPoByCategory: [{ trackingCategoryId: 'c1', total: '300' }],
      budgetByCategory: [{ trackingCategoryId: 'c1', amount: '1000' }],
      actualByCategory: [{ trackingCategoryId: 'c1', total: '100' }],
      categoryNames: new Map([['c1', 'Ops']]),
    })
    expect(rows[0]?.remaining).toBe('600.0000')
    expect(rows[0]?.actual).toBe('100.0000')
  })

  it('outstanding PO amount and encumbered flag', () => {
    expect(
      outstandingPoAmount([
        { quantity: '10', quantityReceived: '4', amount: '100' },
      ]),
    ).toBe('60.0000')
    expect(poStillEncumbered('PARTIAL')).toBe(true)
    expect(poStillEncumbered('CLOSED')).toBe(false)
  })
})

describe('phase 44 holiday capacity', () => {
  it('zeros a weekday on a holiday exception', () => {
    expect(weekdayIndexMon0('2026-11-23')).toBe(0)
    expect(capacityAfterExceptions(700, [100, 100, 100, 100, 100, 100, 100], ['2026-11-23'])).toBe(600)
    expect(capacityAfterExceptions(700, null, ['2026-11-23'])).toBe(600)
  })
})
