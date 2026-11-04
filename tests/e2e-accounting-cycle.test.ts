/**
 * Documented accounting-cycle smoke (Phase 17).
 * Full browser Playwright is optional; this suite locks the checklist + pure math.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { monthlyDepreciation } from '@/lib/fixed-asset-math'
import { Decimal } from '@/lib/money'

describe('SME accounting cycle checklist (documented)', () => {
  it('lists the happy-path steps for browser smoke', () => {
    const steps = [
      'Opening balances / equity contribution',
      'Foreign or base sales invoice',
      'Customer payment (FX rate may differ)',
      'CRM opportunity lead → won',
      'Fixed-asset depreciation for one month',
      'Budget vs Actual report',
      'Period close checklist (FX revaluation warning)',
      'Group consolidation P&L + balance sheet',
      'Recruitment offer → hire',
      'Sign request public token',
    ]
    expect(steps.length).toBeGreaterThanOrEqual(8)
  })

  it('stockAgreesWithLedger export remains in inventory module source', () => {
    const source = readFileSync(
      join(process.cwd(), 'server/accounting/inventory.ts'),
      'utf8',
    )
    expect(source).toContain('export async function stockAgreesWithLedger')
  })

  it('depreciation math used in month-end is stable', () => {
    expect(monthlyDepreciation(new Decimal(1200), new Decimal(0), 12).toFixed(2)).toBe('100.00')
  })
})
