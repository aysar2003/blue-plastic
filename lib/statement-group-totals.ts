import { Decimal } from '@/lib/money'

export type GroupTotalableRow = {
  accountId: string
  name: string
  amount: Decimal
  comparison?: Decimal
  parentId?: string | null
  depth?: number
}

export type GroupTotalLine = {
  kind: 'groupTotal'
  parentId: string
  label: string
  amount: Decimal
  comparison?: Decimal
  depth: number
}

export type StatementLine<T extends GroupTotalableRow> =
  | { kind: 'account'; row: T }
  | GroupTotalLine

/**
 * After each Main that has Subs on the sheet, append a display-only group total
 * (Main own + descendants). Not included in section.total — avoids double-count.
 */
export function linesWithGroupTotals<T extends GroupTotalableRow>(
  rows: T[],
): StatementLine<T>[] {
  const parentIds = new Set(
    rows.map((row) => row.parentId).filter((id): id is string => Boolean(id)),
  )
  const inserts: { afterIndex: number; total: GroupTotalLine }[] = []

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!
    if (!parentIds.has(row.accountId)) continue
    const depth = row.depth ?? 0
    let end = i
    while (end + 1 < rows.length && (rows[end + 1]!.depth ?? 0) > depth) end += 1
    if (end === i) continue

    let amount = row.amount
    let comparison = row.comparison
    for (let k = i + 1; k <= end; k += 1) {
      const child = rows[k]!
      amount = amount.plus(child.amount)
      if (comparison != null || child.comparison != null) {
        comparison = (comparison ?? new Decimal(0)).plus(child.comparison ?? new Decimal(0))
      }
    }
    inserts.push({
      afterIndex: end,
      total: {
        kind: 'groupTotal',
        parentId: row.accountId,
        label: `Total ${row.name}`,
        amount,
        comparison,
        depth,
      },
    })
  }

  const lines: StatementLine<T>[] = rows.map((row) => ({ kind: 'account', row }))
  for (const insert of [...inserts].sort((a, b) => b.afterIndex - a.afterIndex)) {
    lines.splice(insert.afterIndex + 1, 0, insert.total)
  }
  return lines
}
