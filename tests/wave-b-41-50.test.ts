import { describe, expect, it } from 'vitest'

import { filterSeasonalRows, totalSeasonalCost } from '@/lib/erp/agriculture'
import { grantOverBudget } from '@/lib/erp/commitment-budget'
import { groupFoodCost, isMenuMarginLow, menuMarginPercent } from '@/lib/erp/menu-cost'
import { requiresRestrictedFundClass } from '@/lib/erp/ngo-funds'
import {
  belowReorder,
  capReplenishmentBySource,
  suggestedReplenishmentQty,
} from '@/lib/erp/replenishment'
import {
  capacityReportCsvRows,
  effectiveWeeklyCapacity,
  isWorkCenterOverloaded,
  loadPercent,
} from '@/lib/erp/routing-capacity'
import { scholarshipSummaryCsvRows, scholarshipSummaryTotals } from '@/lib/erp/scholarship-summary'
import { waveLabelCsvRows } from '@/lib/erp/wms-bin'
import { isRetainerLowWatermark, jobCostOverBudget } from '@/lib/erp/verticals-p5'

describe('phase 41 replenishment', () => {
  it('suggests qty to reach reorder', () => {
    expect(suggestedReplenishmentQty('10', '3')).toBe('7.0000')
    expect(suggestedReplenishmentQty('10', '12')).toBe('0.0000')
    expect(belowReorder('5', '5')).toBe(true)
  })

  it('caps transfer qty by source on-hand', () => {
    expect(capReplenishmentBySource('7', '4')).toBe('4.0000')
    expect(capReplenishmentBySource('7', '12')).toBe('7.0000')
    expect(capReplenishmentBySource('7', '0')).toBe('0.0000')
  })
})

describe('phase 42 menu cost', () => {
  it('sums components and margin', () => {
    const cost = groupFoodCost([
      { componentItemId: 'a', quantity: '2', averageCost: '1.5' },
      { componentItemId: 'b', quantity: '1', averageCost: '4' },
    ])
    expect(cost).toBe('7.0000')
    expect(menuMarginPercent('10', cost)).toBe('30.00')
    expect(isMenuMarginLow('20.00')).toBe(true)
    expect(isMenuMarginLow('30.00')).toBe(false)
  })
})

describe('phase 44 capacity', () => {
  it('uses weekday sum when present', () => {
    expect(effectiveWeeklyCapacity('100', [10, 10, 10, 10, 10, 10, 10])).toBe(70)
    expect(loadPercent(80, 100)).toBe(80)
    expect(isWorkCenterOverloaded(101, 100)).toBe(true)
    expect(
      capacityReportCsvRows([
        {
          centerName: 'Cell A',
          storeName: 'Plant',
          capacityMinutes: '100',
          demandMinutes: '120',
          loadPercent: 120,
          workOrderNumbers: ['WO-1', 'WO-2'],
        },
      ])[0]?.[5],
    ).toBe('WO-1; WO-2')
  })
})

describe('phase 47 restricted funds', () => {
  it('requires class on bill when org restricted', () => {
    expect(requiresRestrictedFundClass(true, null, 'BILL', false)).toBe(true)
    expect(requiresRestrictedFundClass(true, 'cls', 'BILL', false)).toBe(false)
    expect(requiresRestrictedFundClass(true, null, 'BILL', true)).toBe(false)
  })
})

describe('phase 48 scholarship summary', () => {
  it('aggregates gross waived net', () => {
    const summary = scholarshipSummaryTotals([
      { status: 'ENROLLED', feeSubtotal: '1000', scholarshipPercent: '10' },
      { status: 'WITHDRAWN', feeSubtotal: '500', scholarshipPercent: '0' },
    ])
    expect(summary.enrollmentCount).toBe(1)
    expect(summary.gross).toBe('1000.00')
    expect(summary.scholarshipWaived).toBe('100.00')
    expect(summary.net).toBe('900.00')
    expect(
      scholarshipSummaryCsvRows([
        {
          termName: 'Fall',
          enrollmentCount: 1,
          gross: '1000.00',
          scholarshipWaived: '100.00',
          net: '900.00',
        },
      ])[0]?.[0],
    ).toBe('Fall')
  })
})

describe('phase 50 agriculture', () => {
  it('totals seasonal extended cost', () => {
    const rows = [
      {
        lotId: '1',
        lotNumber: 'L1',
        originLabel: 'North field',
        itemId: 'i',
        itemName: 'Corn',
        storeId: 's',
        storeName: 'North',
        quantity: '2',
        averageCost: '3',
      },
      {
        lotId: '2',
        lotNumber: 'L2',
        originLabel: null,
        itemId: 'i2',
        itemName: 'Beans',
        storeId: 's2',
        storeName: 'South',
        quantity: '1',
        averageCost: '4',
      },
    ]
    expect(totalSeasonalCost(rows)).toBe('10.00')
    expect(filterSeasonalRows(rows, { storeId: 's' })).toHaveLength(1)
    expect(filterSeasonalRows(rows, { originQuery: 'north' })).toHaveLength(1)
  })
})

describe('vertical deepen helpers', () => {
  it('flags grant and job cost over budget', () => {
    expect(grantOverBudget({ budgeted: '100', actual: '60', encumbered: '50' })).toBe(true)
    expect(
      jobCostOverBudget({ budget: '100', costs: '70', committed: '20' }),
    ).toBe(false)
    expect(
      jobCostOverBudget({ budget: '100', costs: '70', committed: '40' }),
    ).toBe(true)
  })

  it('flags low retainer and wave label csv', () => {
    expect(isRetainerLowWatermark('20', '100')).toBe(true)
    expect(isRetainerLowWatermark('80', '100')).toBe(false)
    expect(
      waveLabelCsvRows([
        {
          waveNumber: 'WV-1',
          orderNumber: 'SO-1',
          customerName: 'Acme',
          shipTo: 'Main',
          carrier: 'DHL',
          itemName: 'Widget',
          sku: 'W1',
          qty: '2',
        },
      ])[0]?.[0],
    ).toBe('WV-1')
  })
})