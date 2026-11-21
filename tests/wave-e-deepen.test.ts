import { describe, expect, it } from 'vitest'

import { filterSeasonalRows } from '@/lib/erp/agriculture'
import { feeInvoiceLinesWithWaiver, scholarshipDiscountAmount } from '@/lib/erp/education'
import {
  canApplyClaimRemittance,
  canSubmitClaim,
  claimsToCsv,
  type ClaimExportRow,
} from '@/lib/erp/hospital'
import { sellerStatements, settlementTotals } from '@/lib/erp/marketplace-settlement'
import { periodFoodCostPercent, recipeVsActualVariance } from '@/lib/erp/menu-cost'
import { donorPledgeCsvRows, grantBvaCsvRows, pledgeReceiptNote } from '@/lib/erp/ngo-funds'
import { allocatePatronage, patronageMemberCsvRows } from '@/lib/erp/patronage'
import { Decimal } from '@/lib/money'

describe('phase 42 period food-cost', () => {
  it('computes food-cost % and recipe vs actual variance', () => {
    expect(periodFoodCostPercent('30', '100')).toBe('30.00')
    expect(periodFoodCostPercent('10', '0')).toBeNull()
    expect(recipeVsActualVariance('8', '10')).toBe('2.0000')
  })
})

describe('phase 47 NGO pledge receipt + donor CSV', () => {
  it('builds a receipt note and donor CSV when pledges exist', () => {
    expect(
      pledgeReceiptNote({
        donorName: 'Amina',
        amount: '250.0000',
        fundName: 'Health',
        purpose: 'Wells',
      }),
    ).toBe('Donor receipt · Amina · 250.0000 · fund Health · Wells')
    const csv = donorPledgeCsvRows([
      {
        donorName: 'Amina',
        fund: 'Health',
        amount: '250.00',
        status: 'RECEIVED',
        pledgedAt: '2026-11-01',
        receiptNote: 'Donor receipt · Amina',
      },
    ])
    expect(csv[0]?.[0]).toBe('Donor')
    expect(csv[1]?.[0]).toBe('Amina')
    expect(
      grantBvaCsvRows([
        {
          fund: 'Health',
          budgeted: '1000',
          actual: '400',
          encumbered: '100',
          remaining: '500',
        },
      ])[1]?.[0],
    ).toBe('Health')
  })
})

describe('phase 50 agriculture season filter', () => {
  it('filters seasonal lots by project and class', () => {
    const rows = [
      {
        lotId: '1',
        lotNumber: 'L1',
        originLabel: 'North',
        itemId: 'i',
        itemName: 'Corn',
        storeId: 's',
        storeName: 'North farm',
        quantity: '2',
        averageCost: '3',
        projectId: 'p1',
        trackingCategoryId: 'c1',
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
        projectId: 'p2',
        trackingCategoryId: null,
      },
    ]
    expect(filterSeasonalRows(rows, { projectId: 'p1' })).toHaveLength(1)
    expect(filterSeasonalRows(rows, { trackingCategoryId: 'c1' })[0]?.lotId).toBe('1')
  })
})

describe('phase 56 seller statement', () => {
  it('splits settlement totals per seller', () => {
    const statements = sellerStatements([
      { vendorId: 'a', lineAmount: '100', commissionPercent: '10' },
      { vendorId: 'b', lineAmount: '50', commissionPercent: '20' },
      { vendorId: 'a', lineAmount: '50', commissionPercent: '10' },
    ])
    const a = statements.find((row) => row.vendorId === 'a')
    const b = statements.find((row) => row.vendorId === 'b')
    expect(a?.grossSales).toBe('150.0000')
    expect(a?.commission).toBe('15.0000')
    expect(a?.sellerPayable).toBe('135.0000')
    expect(b?.sellerPayable).toBe('40.0000')
    expect(settlementTotals([
      { vendorId: 'a', lineAmount: '100', commissionPercent: '10' },
      { vendorId: 'b', lineAmount: '50', commissionPercent: '20' },
      { vendorId: 'a', lineAmount: '50', commissionPercent: '10' },
    ]).grossSales).toBe('200.0000')
  })
})

describe('phase 54 patronage equity CSV', () => {
  it('allocates from member purchases and emits member CSV', () => {
    const result = allocatePatronage(
      [
        {
          shareholderId: 'a',
          name: 'A',
          memberKind: 'MEMBER',
          customerId: 'c1',
          weight: new Decimal(75),
        },
        {
          shareholderId: 'b',
          name: 'B',
          memberKind: 'MEMBER',
          customerId: 'c2',
          weight: new Decimal(25),
        },
      ],
      '1000',
      '10',
    )
    expect(result.shares[0]?.amount).toBe('75.0000')
    expect(patronageMemberCsvRows(result.shares)[0]?.[0]).toBe('shareholderId')
    expect(patronageMemberCsvRows(result.shares)[1]?.[3]).toBe('75.0000')
  })
})

describe('phase 48 scholarship fee waiver line', () => {
  it('appends a waiver line for a scholarship award', () => {
    const lines = [
      { itemId: 'tuition', quantity: '1', unitPrice: '1000', description: 'Tuition' },
    ]
    const waived = scholarshipDiscountAmount('1000', 10)
    expect(waived).toBe('100.0000')
    const withWaiver = feeInvoiceLinesWithWaiver(lines, {
      itemId: 'waiver',
      amount: waived,
      description: 'Scholarship waiver 10%',
    })
    expect(withWaiver).toHaveLength(2)
    expect(withWaiver[1]?.itemId).toBe('waiver')
    expect(feeInvoiceLinesWithWaiver(lines, { itemId: 'waiver', amount: '0', description: 'x' })).toHaveLength(
      1,
    )
  })
})

describe('phase 49 hospital claim remittance', () => {
  it('gates submit and remittance, and CSV includes claim status', () => {
    expect(canSubmitClaim({ visitStatus: 'CLOSED', claimStatus: 'OPEN' })).toBe(true)
    expect(canSubmitClaim({ visitStatus: 'OPEN', claimStatus: 'OPEN' })).toBe(false)
    expect(
      canApplyClaimRemittance({ visitStatus: 'CLOSED', claimStatus: 'SUBMITTED', hasInvoice: true }),
    ).toBe(true)
    expect(
      canApplyClaimRemittance({ visitStatus: 'CLOSED', claimStatus: 'PAID', hasInvoice: true }),
    ).toBe(false)
    const rows: ClaimExportRow[] = [
      {
        visitId: 'v1',
        patientName: 'Amina Ali',
        openedAt: '2026-11-07T10:00:00.000Z',
        closedAt: '2026-11-07T12:00:00.000Z',
        payerName: 'Self-pay',
        payerRef: null,
        department: 'OPD',
        invoiceNumber: 'INV-1',
        exportBatchId: 'CLM-ABC',
        claimsExportedAt: '2026-11-07T13:00:00.000Z',
        claimStatus: 'SUBMITTED',
        billCode: 'CONSULT',
        description: 'Consultation',
        quantity: '1',
        unitPrice: '25.0000',
        amount: '25.0000',
      },
    ]
    const csv = claimsToCsv(rows)
    expect(csv).toContain('claimStatus')
    expect(csv).toContain('SUBMITTED')
  })
})
