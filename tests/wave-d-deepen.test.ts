import { describe, expect, it } from 'vitest'

import { closeApprovalLevels, closeSecondApproverRequired } from '@/lib/erp/close-approver'
import {
  eliminationLines,
  eliminationMemo,
  isEliminationMemo,
  isMatchableIcMemo,
} from '@/lib/erp/ic-elimination'
import {
  equityEventStatementSubtype,
  equityMovementCsv,
  equityMovementTotals,
  shareholderRegisterCsv,
} from '@/lib/erp/equity-csv'
import { brandPnlRollup, franchiseRoyaltyAmount, isFranchisee, royaltyStatementCsv } from '@/lib/erp/franchise'
import { ownedPortfolioKpis, portfolioKpiStrip } from '@/lib/erp/portfolio'
import { isOpenServiceJob, vanStockValue } from '@/lib/erp/snapshot-extras'
import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags } from '@/lib/feature-flags'
import { Decimal } from '@/lib/money'

describe('phase 35 IC elimination', () => {
  it('builds opposite Dr/Cr memo pairs on elim accounts', () => {
    const a = eliminationLines('500', 'dr', 'cr', 'debit-first')
    const b = eliminationLines('500', 'dr', 'cr', 'credit-first')
    expect(a[0]).toMatchObject({ accountId: 'dr', debit: '500.0000', credit: '0' })
    expect(a[1]).toMatchObject({ accountId: 'cr', debit: '0', credit: '500.0000' })
    expect(b[0]).toMatchObject({ accountId: 'cr', debit: '500.0000', credit: '0' })
    expect(eliminationMemo('J-1', 'J-2')).toBe('[IC] ELIM J-1 ↔ J-2')
    expect(isEliminationMemo('[IC] ELIM J-1 ↔ J-2')).toBe(true)
    expect(isMatchableIcMemo('[IC] rent')).toBe(true)
    expect(isMatchableIcMemo('[IC] ELIM J-1 ↔ J-2')).toBe(false)
  })
})

describe('phase 14 equity CSV + statement accounts', () => {
  it('maps events onto statement subtypes', () => {
    expect(equityEventStatementSubtype('CONTRIBUTION')).toBe('OWNERS_EQUITY')
    expect(equityEventStatementSubtype('PATRONAGE')).toBe('OWNERS_EQUITY')
    expect(equityEventStatementSubtype('DRAW')).toBe('DRAWINGS')
    expect(equityEventStatementSubtype('DIVIDEND')).toBe('RETAINED_EARNINGS')
  })

  it('exports shareholder register and period movement', () => {
    const register = shareholderRegisterCsv([
      { name: 'Amina', shares: '60', ownershipPercent: '60.0000', capitalAccount: '3000 Capital' },
    ])
    expect(register.split('\n')[0]).toBe('name,shares,ownershipPercent,capitalAccount')
    expect(register).toContain('Amina')
    const movement = equityMovementCsv([
      {
        date: '2026-03-01',
        kind: 'CONTRIBUTION',
        shareholder: 'Amina',
        amount: '1000.0000',
        memo: 'Seed',
        equityAccount: '3000 Capital',
      },
      {
        date: '2026-06-01',
        kind: 'DRAW',
        shareholder: 'Amina',
        amount: '200.0000',
        memo: 'Draw',
        equityAccount: '3100 Drawings',
      },
    ])
    expect(movement).toContain('DRAW')
    expect(equityMovementTotals([
      { date: '2026-03-01', kind: 'CONTRIBUTION', shareholder: 'A', amount: '1000', memo: '', equityAccount: '' },
      { date: '2026-06-01', kind: 'DRAW', shareholder: 'A', amount: '200', memo: '', equityAccount: '' },
    ]).net).toBe('800.0000')
  })
})

describe('phase 52 portfolio KPIs', () => {
  it('rolls cash/AR/stock/NI at ownership % and compares YoY', () => {
    const current = ownedPortfolioKpis([
      {
        isParent: true,
        ownershipPercent: 100,
        cash: '100',
        ar: '50',
        stock: '20',
        ni: '40',
      },
      {
        isParent: false,
        ownershipPercent: 80,
        cash: '100',
        ar: '50',
        stock: '20',
        ni: '40',
      },
    ])
    expect(new Decimal(current.cash).toFixed(0)).toBe('180')
    expect(new Decimal(current.ni).toFixed(0)).toBe('72')
    const strip = portfolioKpiStrip(current, {
      cash: '100',
      ar: '10',
      stock: '5',
      ni: '20',
    })
    expect(strip).toHaveLength(4)
    expect(strip.find((row) => row.key === 'cash')?.change).toBe('80.0000')
  })
})

describe('phase 51 franchise royalty statement + brand P&L', () => {
  it('flags franchisees and rolls brand P&L', () => {
    expect(isFranchisee('5')).toBe(true)
    expect(isFranchisee('0')).toBe(false)
    expect(franchiseRoyaltyAmount('20000', '4').toFixed(0)).toBe('800')
    const csv = royaltyStatementCsv([
      { name: 'Branch A', royaltyPercent: '5', sales: '10000.0000', royaltyDue: '500.0000' },
    ])
    expect(csv).toContain('Branch A')
    const rollup = brandPnlRollup([
      { income: '100', expense: '40', net: '60', royaltyDue: '5' },
      { income: '50', expense: '10', net: '40', royaltyDue: '2' },
    ])
    expect(rollup.net).toBe('100.0000')
    expect(rollup.royaltyDue).toBe('7.0000')
  })
})

describe('phase 33 close second approver', () => {
  it('requires two approvers only when hard gates and the flag are on', () => {
    expect(closeSecondApproverRequired(DEFAULT_FEATURE_FLAGS)).toBe(false)
    expect(
      closeSecondApproverRequired({ closeHardGates: true, closeSecondApprover: true }),
    ).toBe(true)
    expect(closeSecondApproverRequired({ closeHardGates: true, closeSecondApprover: false })).toBe(
      false,
    )
    expect(closeApprovalLevels()).toBe(2)
    expect(parseFeatureFlags({ closeSecondApprover: true }).closeSecondApprover).toBe(true)
  })
})

describe('phase 30/32 snapshot extras', () => {
  it('values van stock and treats draft/scheduled jobs as open', () => {
    expect(isOpenServiceJob('SCHEDULED')).toBe(true)
    expect(isOpenServiceJob('DONE')).toBe(false)
    expect(vanStockValue([{ quantity: '2', averageCost: '10' }]).toFixed(0)).toBe('20')
  })
})
