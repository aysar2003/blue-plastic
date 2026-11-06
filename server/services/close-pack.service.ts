import 'server-only'

import type { CalendarDate } from '@/lib/date'
import { letterheadLines } from '@/lib/letterhead'
import { trialBalance } from '@/server/accounting/balances'
import { closeChecklist } from '@/server/accounting/close-checklist'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { csvValue, toCsv, type CsvCell } from '@/server/reports/csv'
import { balanceSheet, profitAndLoss } from '@/server/reports/statements'

/**
 * Phase 33: one close binder — TB + P&L + BS + checklist CSV for a period.
 * Not a full audit certification workflow.
 */
export async function buildClosePack(
  ctx: OrgContext,
  range: { from: CalendarDate; to: CalendarDate },
): Promise<{ filename: string; body: string }> {
  assertPermission(ctx, 'report:export')
  const [tb, pnl, bs, checklist] = await Promise.all([
    trialBalance(ctx.orgId, { from: range.from, to: range.to }),
    profitAndLoss(ctx.orgId, { from: range.from, to: range.to }),
    balanceSheet(ctx.orgId, range.to),
    closeChecklist(ctx, range),
  ])

  const header = [
    ...letterheadLines(ctx.organization),
    `Close pack ${range.from} — ${range.to}`,
    '',
  ].join('\n')

  const tbRows: CsvCell[][] = [
    ['code', 'name', 'debit', 'credit'],
    ...tb.rows.map(
      (row) =>
        [
          row.code,
          row.name,
          csvValue(row.closingDebit),
          csvValue(row.closingCredit),
        ] as CsvCell[],
    ),
  ]

  const pnlRows: CsvCell[][] = [
    ['Account', 'Amount'],
    ...pnl.sections.flatMap((section) =>
      section.rows.map((row) => [`${row.code} ${row.name}`, csvValue(row.amount)] as CsvCell[]),
    ),
    ['Net income', csvValue(pnl.netIncome)],
  ]

  const bsRows: CsvCell[][] = [
    ['Account', 'Amount'],
    ...bs.sections.flatMap((section) =>
      section.rows.map((row) => [`${row.code} ${row.name}`, csvValue(row.amount)] as CsvCell[]),
    ),
  ]

  const checkRows: CsvCell[][] = [
    ['key', 'label', 'severity', 'detail'],
    ...checklist.checks.map(
      (check) => [check.key, check.label, check.severity, check.detail] as CsvCell[],
    ),
  ]

  const body = [
    header,
    `# Trial balance\n${toCsv(tbRows)}`,
    `# Profit and loss\n${toCsv(pnlRows)}`,
    `# Balance sheet\n${toCsv(bsRows)}`,
    `# Close checklist\n${toCsv(checkRows)}`,
  ].join('\n\n')

  return {
    filename: `close-pack-${range.from}-${range.to}.csv`,
    body,
  }
}
