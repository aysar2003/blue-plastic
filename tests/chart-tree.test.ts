import { describe, expect, it } from 'vitest'

import {
  CHART_SUB_INDENT,
  chartSubIndentStyle,
  childDisplayName,
  keepChartFamily,
  linkColonParents,
  nestChartRows,
} from '@/lib/chart-tree'

describe('chart tree', () => {
  const accounts = [
    { id: 'banks', parentId: null, code: '1085', type: 'ASSET' as const, name: 'POS Banks' },
    { id: 'till-a', parentId: 'banks', code: '1086', type: 'ASSET' as const, name: 'Till A' },
    { id: 'till-b', parentId: 'banks', code: '1087', type: 'ASSET' as const, name: 'Till B' },
    { id: 'equity', parentId: null, code: '3000', type: 'EQUITY' as const, name: 'Equity' },
  ]

  it('indents each nested level', () => {
    expect(CHART_SUB_INDENT).toBe('1.25rem')
    expect(chartSubIndentStyle(1)).toEqual({ paddingLeft: 'calc(1.25rem * 1)' })
    expect(chartSubIndentStyle(2)).toEqual({ paddingLeft: 'calc(1.25rem * 2)' })
    expect(chartSubIndentStyle(0)).toBeUndefined()
  })

  it('always keeps children under their parent', () => {
    const rows = nestChartRows(accounts)
    expect(rows.map((row) => row.id)).toEqual(['banks', 'till-a', 'till-b', 'equity'])
    expect(rows.map((row) => row.treeDepth)).toEqual([0, 1, 1, 0])
  })

  it('groups roots by detail type before code, and keeps subs under mains', () => {
    const mixed = [
      {
        id: 'inv',
        parentId: null,
        code: '1200',
        type: 'ASSET' as const,
        subtype: 'INVENTORY' as const,
        name: 'Inventory',
      },
      {
        id: 'cash',
        parentId: null,
        code: '1000',
        type: 'ASSET' as const,
        subtype: 'BANK' as const,
        name: 'Cash',
      },
      {
        id: 'vault',
        parentId: 'cash',
        code: '1001',
        type: 'ASSET' as const,
        subtype: 'BANK' as const,
        name: 'Vault',
      },
      {
        id: 'ar',
        parentId: null,
        code: '1100',
        type: 'ASSET' as const,
        subtype: 'ACCOUNTS_RECEIVABLE' as const,
        name: 'Receivables',
      },
    ]
    expect(nestChartRows(mixed).map((row) => row.id)).toEqual(['cash', 'vault', 'ar', 'inv'])
  })

  it('keeps the parent when a filter matches one sub-account', () => {
    const matched = [accounts[1]!]
    const family = keepChartFamily(accounts, matched)
    expect(family.map((row) => row.id)).toEqual(['banks', 'till-a'])
    expect(nestChartRows(family).map((row) => ({ id: row.id, depth: row.treeDepth }))).toEqual([
      { id: 'banks', depth: 0 },
      { id: 'till-a', depth: 1 },
    ])
  })

  it('keeps every child when a filter matches the heading', () => {
    const matched = [accounts[0]!]
    const family = keepChartFamily(accounts, matched)
    expect(nestChartRows(family).map((row) => row.id)).toEqual(['banks', 'till-a', 'till-b'])
  })

  it('links QBO Parent:Child names when parentId is missing', () => {
    const flat = [
      { id: 'parent', parentId: null, code: '1033', type: 'ASSET' as const, name: 'KALA GUUR' },
      {
        id: 'child',
        parentId: null,
        code: '1058',
        type: 'ASSET' as const,
        name: 'KALA GUUR:ahmed salad bank',
      },
    ]
    const linked = linkColonParents(flat)
    expect(linked.find((row) => row.id === 'child')?.parentId).toBe('parent')
    expect(nestChartRows(linked).map((row) => ({ id: row.id, depth: row.treeDepth }))).toEqual([
      { id: 'parent', depth: 0 },
      { id: 'child', depth: 1 },
    ])
    expect(childDisplayName('KALA GUUR:ahmed salad bank', 'KALA GUUR')).toBe('ahmed salad bank')
  })
})
