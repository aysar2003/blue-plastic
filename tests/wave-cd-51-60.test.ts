import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { commitmentVsBudget } from '@/lib/erp/commitment-budget'
import { assertTrustedExtension, isTrustedExtension } from '@/lib/erp/extensions/registry'
import { franchiseRoyaltyAmount } from '@/lib/erp/franchise'
import { generateLoanSchedule, scheduleLineTotal } from '@/lib/erp/loan-schedule'
import { settlementTotals } from '@/lib/erp/marketplace-settlement'
import { allocatePatronage } from '@/lib/erp/patronage'
import { portfolioCsv, portfolioRowsFromConsol } from '@/lib/erp/portfolio'
import {
  liveLedgerWindowYears,
  liveYearWindowLabel,
  partitionKeyForOrg,
  REPORT_PACK_LIVE_YEAR_WARNING,
} from '@/lib/erp/scale-ops'
import { dispatchSignWebhook, parseSignProvider } from '@/lib/erp/sign-provider'
import { Decimal } from '@/lib/money'
import { ownedShare, type ConsolCompanyRow } from '@/lib/erp/consolidation-ownership'

describe('phase 51 franchise', () => {
  it('computes royalty from sales', () => {
    expect(franchiseRoyaltyAmount('10000', '5').toFixed(4)).toBe('500.0000')
    expect(franchiseRoyaltyAmount('10000', null).toFixed(4)).toBe('0.0000')
  })
})

describe('phase 52 portfolio', () => {
  it('rolls subsidiary NI and CSV', () => {
    const rows: ConsolCompanyRow[] = [
      {
        orgId: 'p',
        isParent: true,
        ownershipPercent: new Decimal(100),
        income: new Decimal(0),
        expense: new Decimal(0),
        net: new Decimal(0),
        assets: new Decimal(0),
        liabilities: new Decimal(0),
        equity: new Decimal(0),
      },
      {
        orgId: 's',
        isParent: false,
        ownershipPercent: new Decimal(80),
        income: new Decimal(100),
        expense: new Decimal(40),
        net: new Decimal(60),
        assets: new Decimal(0),
        liabilities: new Decimal(0),
        equity: new Decimal(100),
      },
    ]
    const subsidiaries = portfolioRowsFromConsol(rows, new Map([['s', 'SubCo']]))
    expect(subsidiaries[0]?.netIncome).toBe(ownedShare(60, 80).toFixed(4))
    expect(portfolioCsv(subsidiaries)).toContain('SubCo')
  })
})

describe('phase 53 commitment', () => {
  it('compares PO to budget by category', () => {
    const rows = commitmentVsBudget({
      openPoByCategory: [{ trackingCategoryId: 'c1', total: '300' }],
      budgetByCategory: [{ trackingCategoryId: 'c1', amount: '1000' }],
      categoryNames: new Map([['c1', 'Ops']]),
    })
    expect(rows[0]?.remaining).toBe('700.0000')
  })
})

describe('phase 54 patronage', () => {
  it('splits pool among members', () => {
    const result = allocatePatronage(
      [
        {
          shareholderId: 'a',
          name: 'A',
          memberKind: 'MEMBER',
          customerId: 'c1',
          weight: new Decimal(2),
        },
        {
          shareholderId: 'b',
          name: 'B',
          memberKind: 'MEMBER',
          customerId: 'c2',
          weight: new Decimal(1),
        },
      ],
      '1000',
      '10',
    )
    expect(result.pool).toBe('100.0000')
    expect(result.shares[0]?.amount).toBe('66.6667')
  })
})

describe('phase 55 scale', () => {
  it('scale.md exists and helpers stable', () => {
    const path = resolve(process.cwd(), 'docs/ops/scale.md')
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf8')).toContain('orgId')
    expect(liveLedgerWindowYears()).toBeGreaterThan(0)
    expect(partitionKeyForOrg('abc')).toBe('org:abc')
    expect(liveYearWindowLabel(2022, 2026, 5)).toContain('2022')
    expect(REPORT_PACK_LIVE_YEAR_WARNING).toMatch(/report packs/i)
  })
})

describe('phase 56 marketplace settlement', () => {
  it('totals commission', () => {
    const t = settlementTotals([
      { vendorId: 'v', lineAmount: '100', commissionPercent: '10' },
      { vendorId: 'v', lineAmount: '50', commissionPercent: '10' },
    ])
    expect(t.commission).toBe('15.0000')
    expect(t.sellerPayable).toBe('135.0000')
  })
})

describe('phase 57 loans', () => {
  it('generates schedule lines', () => {
    const lines = generateLoanSchedule('1200', '12', 3, '2026-01-01')
    expect(lines).toHaveLength(3)
    expect(scheduleLineTotal(lines[0]!)).toBeTruthy()
  })
})

describe('phase 59 sign provider', () => {
  it('parses config and mocks webhook', async () => {
    expect(parseSignProvider({ kind: 'webhook', webhookUrl: 'https://x' }).kind).toBe('webhook')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ externalId: 'ext-1' }),
    })
    const result = await dispatchSignWebhook(
      { kind: 'webhook', webhookUrl: 'https://hooks.example/sign' },
      {
        requestId: 'r1',
        title: 'T',
        token: 'tok',
        signerEmail: 'a@b.co',
        organizationName: 'Org',
      },
      fetchMock as unknown as typeof fetch,
    )
    expect(result.externalId).toBe('ext-1')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('phase 60 trusted extensions', () => {
  it('rejects unknown extension id', () => {
    expect(isTrustedExtension('som.capabilities')).toBe(true)
    expect(() => assertTrustedExtension('evil.plugin')).toThrow(/Untrusted/)
  })
})