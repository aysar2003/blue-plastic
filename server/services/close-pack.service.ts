import 'server-only'

import type { CalendarDate } from '@/lib/date'
import { trialBalance } from '@/server/accounting/balances'
import { closeChecklist } from '@/server/accounting/close-checklist'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import type { CsvCell } from '@/server/reports/csv'
import {
  renderMultiSheetXlsx,
  type ListXlsxColumn,
  type ListXlsxSheet,
} from '@/server/reports/list-xlsx'
import { balanceSheet, profitAndLoss } from '@/server/reports/statements'

/**
 * Phase 33: one close binder — TB + P&L + BS + checklist as a multi-sheet Excel.
 */
export async function buildClosePack(
  ctx: OrgContext,
  range: { from: CalendarDate; to: CalendarDate },
): Promise<{ filename: string; body: Uint8Array }> {
  assertPermission(ctx, 'report:export')
  const [tb, pnl, bs, checklist] = await Promise.all([
    trialBalance(ctx.orgId, { from: range.from, to: range.to }),
    profitAndLoss(ctx.orgId, { from: range.from, to: range.to }),
    balanceSheet(ctx.orgId, range.to),
    closeChecklist(ctx, range),
  ])

  const subtitle = `${range.from} — ${range.to}`
  const sheets: ListXlsxSheet[] = [
    {
      name: 'Trial balance',
      title: 'Trial balance',
      subtitle,
      columns: [
        { header: 'Code', width: 12 },
        { header: 'Name', width: 32 },
        { header: 'Debit', width: 14, kind: 'money' },
        { header: 'Credit', width: 14, kind: 'money' },
      ],
      rows: tb.rows.map(
        (row) => [row.code, row.name, row.closingDebit, row.closingCredit] as CsvCell[],
      ),
    },
    {
      name: 'Profit and loss',
      title: 'Profit and loss',
      subtitle,
      columns: [
        { header: 'Account', width: 40 },
        { header: 'Amount', width: 14, kind: 'money' },
      ],
      rows: [
        ...pnl.sections.flatMap((section) =>
          section.rows.map((row) => [`${row.code} ${row.name}`, row.amount] as CsvCell[]),
        ),
        ['Net income', pnl.netIncome],
      ],
    },
    {
      name: 'Balance sheet',
      title: 'Balance sheet',
      subtitle,
      columns: [
        { header: 'Account', width: 40 },
        { header: 'Amount', width: 14, kind: 'money' },
      ],
      rows: bs.sections.flatMap((section) =>
        section.rows.map((row) => [`${row.code} ${row.name}`, row.amount] as CsvCell[]),
      ),
    },
    {
      name: 'Close checklist',
      title: 'Close checklist',
      subtitle,
      columns: [
        { header: 'Key', width: 18 },
        { header: 'Label', width: 36 },
        { header: 'Severity', width: 12 },
        { header: 'Detail', width: 48 },
      ] satisfies ListXlsxColumn[],
      rows: checklist.checks.map(
        (check) => [check.key, check.label, check.severity, check.detail] as CsvCell[],
      ),
    },
  ]

  const body = await renderMultiSheetXlsx({
    org: ctx.organization,
    title: `Close pack ${range.from} — ${range.to}`,
    subtitle,
    currency: ctx.organization.baseCurrency,
    sheets,
  })

  return {
    filename: `close-pack-${range.from}-${range.to}.xlsx`,
    body,
  }
}
