import { describe, expect, it } from 'vitest'

import {
  addLaborCost,
  addPurchaseCost,
  addSalesIncome,
  addStockCost,
  emptySlice,
  profitOf,
  toBaseAmount,
} from '@/lib/project-profitability'

describe('project profitability', () => {
  it('computes a known margin from sales, purchases, stock, and labor', () => {
    let slice = emptySlice()
    slice = addSalesIncome(slice, 'INVOICE', '1000')
    slice = addSalesIncome(slice, 'CREDIT_MEMO', '50')
    slice = addPurchaseCost(slice, 'BILL', '200')
    slice = addPurchaseCost(slice, 'VENDOR_CREDIT', '20')
    slice = addStockCost(slice, '-120') // COGS movement value
    slice = addLaborCost(slice, '10', '15') // 150

    // Income 950, purchases 180, stock 120, labor 150 → profit 500
    expect(slice.income.toFixed(0)).toBe('950')
    expect(slice.purchaseCost.toFixed(0)).toBe('180')
    expect(slice.stockCost.toFixed(0)).toBe('120')
    expect(slice.laborCost.toFixed(0)).toBe('150')
    expect(profitOf(slice).toFixed(0)).toBe('500')
  })

  it('skips labor when no rate', () => {
    const slice = addLaborCost(emptySlice(), '8', null)
    expect(slice.laborCost.equals(0)).toBe(true)
  })

  it('converts foreign subtotals to org base using exchangeRate', () => {
    expect(toBaseAmount('100', '1.5').toFixed(0)).toBe('150')
    expect(toBaseAmount('100', null).toFixed(0)).toBe('100')
    expect(toBaseAmount('100', '0').toFixed(0)).toBe('100')

    let slice = emptySlice()
    slice = addSalesIncome(slice, 'INVOICE', '100', '1.5')
    slice = addSalesIncome(slice, 'CREDIT_MEMO', '10', '1.5')
    slice = addPurchaseCost(slice, 'BILL', '40', '1.5')
    slice = addPurchaseCost(slice, 'VENDOR_CREDIT', '4', '1.5')

    expect(slice.income.toFixed(0)).toBe('135')
    expect(slice.purchaseCost.toFixed(0)).toBe('54')
    expect(profitOf(slice).toFixed(0)).toBe('81')
  })
})
