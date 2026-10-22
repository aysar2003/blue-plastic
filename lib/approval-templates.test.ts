import { describe, expect, it } from 'vitest'

import {
  approvalPack,
  APPROVAL_PACKS,
  isCatchAllRule,
  isFamilyWideKindRule,
} from '@/lib/approval-templates'

describe('approval packs', () => {
  it('ships a standard checker pack and an amount-band pack', () => {
    expect(APPROVAL_PACKS.map((pack) => pack.key)).toEqual(['standard', 'amount-bands'])
    expect(approvalPack('standard')?.rules.length).toBeGreaterThan(5)
    expect(approvalPack('amount-bands')?.rules.some((rule) => rule.levels === 2)).toBe(true)
  })

  it('treats family-wide zero-to-unlimited rules as catch-alls', () => {
    expect(
      isCatchAllRule({ documentKind: null, minAmount: '0', maxAmount: null }),
    ).toBe(true)
    expect(
      isCatchAllRule({ documentKind: 'INVOICE', minAmount: '0', maxAmount: null }),
    ).toBe(false)
    expect(
      isCatchAllRule({ documentKind: null, minAmount: '1000', maxAmount: null }),
    ).toBe(false)
  })

  it('treats blank-kind sales/purchases rules as family-wide even with an amount floor', () => {
    expect(
      isFamilyWideKindRule({ entityType: 'SALES_DOCUMENT', documentKind: null }),
    ).toBe(true)
    expect(
      isFamilyWideKindRule({ entityType: 'SALES_DOCUMENT', documentKind: 'INVOICE' }),
    ).toBe(false)
    expect(
      isFamilyWideKindRule({ entityType: 'CUSTOMER_PAYMENT', documentKind: null }),
    ).toBe(false)
  })
})
