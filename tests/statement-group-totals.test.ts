import { describe, expect, it } from 'vitest'
import type { AccountSubtype, AccountType } from '@prisma/client'

import { Decimal } from '@/lib/money'
import { linesWithGroupTotals } from '@/lib/statement-group-totals'
import type { StatementRow } from '@/server/reports/statements'

function row(
  partial: Pick<StatementRow, 'accountId' | 'code' | 'name' | 'amount' | 'parentId' | 'depth'> & {
    comparison?: Decimal
  },
): StatementRow {
  return {
    type: 'COGS' as AccountType,
    subtype: 'COST_OF_GOODS_SOLD' as AccountSubtype,
    ...partial,
  }
}

describe('linesWithGroupTotals', () => {
  it('adds a display Total after Main + Subs without changing own amounts', () => {
    const rows = [
      row({
        accountId: 'main',
        code: '5000',
        name: 'Cost of Goods Sold',
        amount: new Decimal(100),
        parentId: null,
        depth: 0,
      }),
      row({
        accountId: 'sub-a',
        code: '5010',
        name: 'Merchandise',
        amount: new Decimal(200),
        parentId: 'main',
        depth: 1,
      }),
      row({
        accountId: 'sub-b',
        code: '5020',
        name: 'Freight',
        amount: new Decimal(50),
        parentId: 'main',
        depth: 1,
      }),
    ]

    const lines = linesWithGroupTotals(rows)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toMatchObject({ kind: 'account', row: { accountId: 'main' } })
    expect(lines[1]).toMatchObject({ kind: 'account', row: { accountId: 'sub-a' } })
    expect(lines[2]).toMatchObject({ kind: 'account', row: { accountId: 'sub-b' } })
    expect(lines[3]).toMatchObject({
      kind: 'groupTotal',
      parentId: 'main',
      label: 'Total Cost of Goods Sold',
    })
    if (lines[3]?.kind === 'groupTotal') {
      expect(lines[3].amount.toString()).toBe('350')
    }

    // Section total must still be sum of own rows only (no double-count).
    const sectionTotal = rows.reduce((sum, r) => sum.plus(r.amount), new Decimal(0))
    expect(sectionTotal.toString()).toBe('350')
  })

  it('nests group totals for deeper Main > Mid > Leaf trees', () => {
    const rows = [
      row({
        accountId: 'main',
        code: '5000',
        name: 'COGS',
        amount: new Decimal(10),
        parentId: null,
        depth: 0,
      }),
      row({
        accountId: 'mid',
        code: '5010',
        name: 'Merchandise',
        amount: new Decimal(20),
        parentId: 'main',
        depth: 1,
      }),
      row({
        accountId: 'leaf',
        code: '5011',
        name: 'Widgets',
        amount: new Decimal(30),
        parentId: 'mid',
        depth: 2,
      }),
    ]

    const lines = linesWithGroupTotals(rows)
    const totals = lines.filter((line) => line.kind === 'groupTotal')
    expect(totals).toHaveLength(2)
    expect(totals[0]).toMatchObject({ parentId: 'mid', label: 'Total Merchandise' })
    expect(totals[1]).toMatchObject({ parentId: 'main', label: 'Total COGS' })
    if (totals[0]?.kind === 'groupTotal' && totals[1]?.kind === 'groupTotal') {
      expect(totals[0].amount.toString()).toBe('50')
      expect(totals[1].amount.toString()).toBe('60')
    }
  })
})
