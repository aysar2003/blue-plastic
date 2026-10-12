import { describe, expect, it } from 'vitest'

import {
  ENABLED_ITEM_TYPES,
  ITEM_TYPE_PROFILES,
  isStockTracked,
  profileForType,
  skipsIncomeAccount,
  usesCogsCost,
  usesOperatingExpense,
} from '@/lib/item-types'
import { itemSchema } from '@/lib/validation/master-data'

describe('item type profiles', () => {
  it('exposes every QuickBooks-style type', () => {
    expect(ENABLED_ITEM_TYPES).toEqual([
      'SERVICE',
      'INVENTORY',
      'INVENTORY_ASSEMBLY',
      'NON_INVENTORY',
      'OTHER_CHARGE',
      'SUBTOTAL',
      'GROUP',
      'DISCOUNT',
      'PAYMENT',
    ])
    expect(ITEM_TYPE_PROFILES).toHaveLength(9)
  })

  it('classifies stock, COGS, expense, and income skips correctly', () => {
    expect(isStockTracked('INVENTORY')).toBe(true)
    expect(isStockTracked('INVENTORY_ASSEMBLY')).toBe(true)
    expect(isStockTracked('NON_INVENTORY')).toBe(false)
    expect(usesCogsCost('NON_INVENTORY')).toBe(true)
    expect(usesOperatingExpense('SERVICE')).toBe(true)
    expect(usesOperatingExpense('OTHER_CHARGE')).toBe(true)
    expect(skipsIncomeAccount('SUBTOTAL')).toBe(true)
    expect(skipsIncomeAccount('GROUP')).toBe(true)
    expect(skipsIncomeAccount('PAYMENT')).toBe(true)
    expect(skipsIncomeAccount('SERVICE')).toBe(false)
    expect(profileForType('GROUP').components).toBe(true)
    expect(profileForType('INVENTORY_ASSEMBLY').components).toBe(true)
    expect(profileForType('PAYMENT').accounts.deposit).toBe(true)
  })
})

describe('itemSchema by type', () => {
  const income = 'clxxxxxxxxxxxxxxxxxxxxxxxxx1'
  const inventory = 'clxxxxxxxxxxxxxxxxxxxxxxxxx2'
  const cogs = 'clxxxxxxxxxxxxxxxxxxxxxxxxx3'
  const deposit = 'clxxxxxxxxxxxxxxxxxxxxxxxxx4'

  it('accepts Service with income only', () => {
    const parsed = itemSchema.safeParse({
      name: 'Consulting',
      type: 'SERVICE',
      incomeAccountId: income,
      salesPrice: '100',
    })
    expect(parsed.success).toBe(true)
  })

  it('requires income for Inventory Part and COGS+inventory', () => {
    const missing = itemSchema.safeParse({
      name: 'Pipe',
      type: 'INVENTORY',
      incomeAccountId: income,
    })
    expect(missing.success).toBe(false)

    const ok = itemSchema.safeParse({
      name: 'Pipe',
      type: 'INVENTORY',
      incomeAccountId: income,
      inventoryAccountId: inventory,
      cogsAccountId: cogs,
      salesPrice: '10',
      purchaseCost: '6',
    })
    expect(ok.success).toBe(true)
  })

  it('accepts Non-inventory without stock accounts', () => {
    const parsed = itemSchema.safeParse({
      name: 'Office supplies',
      type: 'NON_INVENTORY',
      incomeAccountId: income,
      salesPrice: '5',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts Discount with discount income account', () => {
    const parsed = itemSchema.safeParse({
      name: '10% off',
      type: 'DISCOUNT',
      incomeAccountId: income,
      salesPrice: '10',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts Subtotal and Group without income', () => {
    expect(
      itemSchema.safeParse({ name: 'Subtotal', type: 'SUBTOTAL' }).success,
    ).toBe(true)
    expect(
      itemSchema.safeParse({
        name: 'Starter kit',
        type: 'GROUP',
        printGroupItems: 'true',
        componentsJson: JSON.stringify([{ itemId: income, quantity: '1' }]),
      }).success,
    ).toBe(true)
  })

  it('requires deposit account for Payment', () => {
    const missing = itemSchema.safeParse({
      name: ' partial',
      type: 'PAYMENT',
      itemPaymentMethod: 'CASH',
    })
    expect(missing.success).toBe(false)

    const ok = itemSchema.safeParse({
      name: 'Partial payment',
      type: 'PAYMENT',
      itemPaymentMethod: 'CASH',
      depositAccountId: deposit,
    })
    expect(ok.success).toBe(true)
  })

  it('rejects opening stock on non-tracked types', () => {
    const parsed = itemSchema.safeParse({
      name: 'Service',
      type: 'SERVICE',
      incomeAccountId: income,
      openingQuantity: '5',
    })
    expect(parsed.success).toBe(false)
  })
})
