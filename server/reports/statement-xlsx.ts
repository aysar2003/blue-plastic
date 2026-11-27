import 'server-only'

import { ACCOUNT_SUBTYPE_LABELS, ACCOUNT_TYPE_LABELS } from '@/lib/accounting-labels'
import type { LetterheadSource } from '@/lib/letterhead'
import { Decimal } from '@/lib/money'
import type { CsvCell } from '@/server/reports/csv'
import {
  coverParametersSheet,
  exportPackToXlsx,
} from '@/server/reports/export-table'
import type { ListXlsxColumn, ListXlsxSheet } from '@/server/reports/list-xlsx'
import type { BalanceSheet, CashFlow, ProfitAndLoss } from '@/server/reports/statements'

type StatementMeta = {
  org: LetterheadSource
  title: string
  subtitle: string
  currency?: string
  basis?: string
  exportedAt?: string
  filtersNote?: string
}

function asDecimal(value: unknown): Decimal {
  if (value instanceof Decimal) return value
  if (value == null) return new Decimal(0)
  return new Decimal(String(value))
}

function changeValue(amount: unknown, comparison: unknown): Decimal {
  return asDecimal(amount).minus(asDecimal(comparison))
}

/**
 * Modern ERP financial workbook (Odoo / DualEntry style):
 * Cover (parameters) → Summary → one sheet per statement section.
 * Money stays typed; section totals sit on each sheet; no flat “Section” dump.
 * When compare is on, columns are Amount · Comparison · Change (QBO style).
 */
export async function renderProfitAndLossXlsx(
  data: ProfitAndLoss,
  meta: StatementMeta & { compare: boolean },
): Promise<Uint8Array> {
  const detailCols: ListXlsxColumn[] = [
    { header: 'Code', width: 10 },
    { header: 'Account', width: 32 },
    { header: 'Type', width: 14 },
    { header: 'Detail type', width: 18 },
    { header: 'Amount', width: 14, kind: 'money' },
    ...(meta.compare
      ? [
          { header: 'Comparison', width: 14, kind: 'money' as const },
          { header: 'Change', width: 14, kind: 'money' as const },
        ]
      : []),
    { header: '% of income', width: 12, kind: 'number' },
  ]

  const summaryCols: ListXlsxColumn[] = [
    { header: 'Metric', width: 28 },
    { header: 'Amount', width: 16, kind: 'money' },
    ...(meta.compare
      ? [
          { header: 'Comparison', width: 16, kind: 'money' as const },
          { header: 'Change', width: 16, kind: 'money' as const },
        ]
      : []),
  ]

  const sheets: ListXlsxSheet[] = [
    coverParametersSheet({
      title: meta.title,
      rows: [
        ['Report', meta.title],
        ['Period', meta.subtitle],
        ['Accounting basis', meta.basis ?? ''],
        ['Currency', meta.currency ?? ''],
        ['Comparison', meta.compare ? 'Yes' : 'No'],
        ['Filters', meta.filtersNote ?? 'None'],
        ['Exported', meta.exportedAt ?? new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
      ],
    }),
    {
      name: 'Summary',
      title: meta.title,
      subtitle: meta.subtitle,
      columns: summaryCols,
      rows: [
        summaryMoneyRow('Total income', data.totalIncome, data.comparison?.totalIncome, meta.compare),
        summaryMoneyRow('Cost of goods sold', data.totalCogs, undefined, meta.compare),
        summaryMoneyRow('Gross profit', data.grossProfit, undefined, meta.compare),
        summaryMoneyRow('Operating expenses', data.totalOperatingExpenses, undefined, meta.compare),
        summaryMoneyRow('Operating profit', data.operatingProfit, undefined, meta.compare),
        summaryMoneyRow('Net income', data.netIncome, data.comparison?.netIncome, meta.compare),
      ],
    },
  ]

  for (const section of data.sections) {
    const rows: CsvCell[][] = section.rows.map((row) => [
      row.code,
      row.name,
      ACCOUNT_TYPE_LABELS[row.type],
      ACCOUNT_SUBTYPE_LABELS[row.subtype],
      row.amount,
      ...(meta.compare
        ? [row.comparison ?? null, changeValue(row.amount, row.comparison ?? 0)]
        : []),
      row.percentOfIncome ?? null,
    ])
    rows.push([
      '',
      `Total ${section.label.toLowerCase()}`,
      '',
      '',
      section.total,
      ...(meta.compare
        ? [
            section.comparisonTotal ?? null,
            changeValue(section.total, section.comparisonTotal ?? 0),
          ]
        : []),
      null,
    ])
    sheets.push({
      name: section.label,
      title: section.label,
      subtitle: meta.subtitle,
      columns: detailCols,
      rows,
    })
  }

  return exportPackToXlsx({
    org: meta.org,
    title: meta.title,
    subtitle: meta.subtitle,
    currency: meta.currency,
    sheets,
  })
}

export async function renderBalanceSheetXlsx(
  data: BalanceSheet,
  meta: StatementMeta & { compare: boolean },
): Promise<Uint8Array> {
  const detailCols: ListXlsxColumn[] = [
    { header: 'Code', width: 10 },
    { header: 'Account', width: 32 },
    { header: 'Type', width: 14 },
    { header: 'Detail type', width: 18 },
    { header: 'Amount', width: 14, kind: 'money' },
    ...(meta.compare
      ? [
          { header: 'Comparison', width: 14, kind: 'money' as const },
          { header: 'Change', width: 14, kind: 'money' as const },
        ]
      : []),
  ]

  const sheets: ListXlsxSheet[] = [
    coverParametersSheet({
      title: meta.title,
      rows: [
        ['Report', meta.title],
        ['As at', meta.subtitle],
        ['Accounting basis', meta.basis ?? ''],
        ['Currency', meta.currency ?? ''],
        ['Comparison', meta.compare ? 'Yes' : 'No'],
        ['Filters', meta.filtersNote ?? 'None'],
        ['Exported', meta.exportedAt ?? new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
      ],
    }),
    {
      name: 'Summary',
      title: meta.title,
      subtitle: meta.subtitle,
      columns: [
        { header: 'Metric', width: 40 },
        { header: 'Amount', width: 16, kind: 'money' },
        ...(meta.compare
          ? [
              { header: 'Comparison', width: 16, kind: 'money' as const },
              { header: 'Change', width: 16, kind: 'money' as const },
            ]
          : []),
      ],
      rows: [
        summaryMoneyRow('Total assets', data.totalAssets, data.comparison?.totalAssets, meta.compare),
        summaryMoneyRow(
          'Total liabilities',
          data.totalLiabilities,
          data.comparison?.totalLiabilities,
          meta.compare,
        ),
        summaryMoneyRow(
          'Profit not yet closed to retained earnings',
          data.accumulatedProfit,
          data.comparison?.accumulatedProfit,
          meta.compare,
        ),
        summaryMoneyRow('Total equity', data.totalEquity, data.comparison?.totalEquity, meta.compare),
        summaryMoneyRow('Out of balance by', data.difference, undefined, meta.compare),
      ],
    },
  ]

  for (const section of data.sections) {
    const rows: CsvCell[][] = section.rows.map((row) => [
      row.code,
      row.name,
      ACCOUNT_TYPE_LABELS[row.type],
      ACCOUNT_SUBTYPE_LABELS[row.subtype],
      row.amount,
      ...(meta.compare
        ? [row.comparison ?? null, changeValue(row.amount, row.comparison ?? 0)]
        : []),
    ])
    rows.push([
      '',
      `Total ${section.label.toLowerCase()}`,
      '',
      '',
      section.total,
      ...(meta.compare
        ? [
            section.comparisonTotal ?? null,
            changeValue(section.total, section.comparisonTotal ?? 0),
          ]
        : []),
    ])
    sheets.push({
      name: section.label,
      title: section.label,
      subtitle: meta.subtitle,
      columns: detailCols,
      rows,
    })
  }

  return exportPackToXlsx({
    org: meta.org,
    title: meta.title,
    subtitle: meta.subtitle,
    currency: meta.currency,
    sheets,
  })
}

export async function renderCashFlowXlsx(
  data: CashFlow,
  meta: StatementMeta & { compare: boolean },
): Promise<Uint8Array> {
  const detailCols: ListXlsxColumn[] = [
    { header: 'Movement', width: 40 },
    { header: 'Amount', width: 16, kind: 'money' },
    ...(meta.compare
      ? [
          { header: 'Comparison', width: 16, kind: 'money' as const },
          { header: 'Change', width: 16, kind: 'money' as const },
        ]
      : []),
  ]

  const groups: Array<{ label: string; group: CashFlow['operating'] }> = [
    { label: 'Operating activities', group: data.operating },
    { label: 'Investing activities', group: data.investing },
    { label: 'Financing activities', group: data.financing },
  ]

  const sheets: ListXlsxSheet[] = [
    coverParametersSheet({
      title: meta.title,
      rows: [
        ['Report', meta.title],
        ['Period', meta.subtitle],
        ['Method', 'Indirect'],
        ['Currency', meta.currency ?? ''],
        ['Comparison', meta.compare ? 'Yes' : 'No'],
        ['Filters', meta.filtersNote ?? 'None'],
        ['Exported', meta.exportedAt ?? new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
      ],
    }),
    {
      name: 'Summary',
      title: meta.title,
      subtitle: meta.subtitle,
      columns: detailCols,
      rows: [
        summaryMoneyRow('Net income', data.netIncome, data.comparison?.netIncome, meta.compare),
        summaryMoneyRow(
          'Cash from operating activities',
          data.operating.total,
          data.comparison?.operatingTotal ?? data.operating.comparisonTotal,
          meta.compare,
        ),
        summaryMoneyRow(
          'Cash from investing activities',
          data.investing.total,
          data.comparison?.investingTotal ?? data.investing.comparisonTotal,
          meta.compare,
        ),
        summaryMoneyRow(
          'Cash from financing activities',
          data.financing.total,
          data.comparison?.financingTotal ?? data.financing.comparisonTotal,
          meta.compare,
        ),
        summaryMoneyRow('Net change in cash', data.netChange, data.comparison?.netChange, meta.compare),
        summaryMoneyRow(
          'Cash at the start of the period',
          data.openingCash,
          data.comparison?.openingCash,
          meta.compare,
        ),
        summaryMoneyRow(
          'Cash at the end of the period',
          data.closingCash,
          data.comparison?.closingCash,
          meta.compare,
        ),
      ],
    },
  ]

  for (const { label, group } of groups) {
    const rows: CsvCell[][] =
      label === 'Operating activities'
        ? [
            [
              'Net income',
              data.netIncome,
              ...(meta.compare
                ? [
                    data.comparison?.netIncome ?? null,
                    changeValue(data.netIncome, data.comparison?.netIncome ?? 0),
                  ]
                : []),
            ],
          ]
        : []
    for (const line of group.lines) {
      rows.push([
        line.label,
        line.amount,
        ...(meta.compare
          ? [line.comparison ?? null, changeValue(line.amount, line.comparison ?? 0)]
          : []),
      ])
    }
    rows.push([
      `Cash from ${label.toLowerCase()}`,
      group.total,
      ...(meta.compare
        ? [
            group.comparisonTotal ?? null,
            changeValue(group.total, group.comparisonTotal ?? 0),
          ]
        : []),
    ])
    sheets.push({
      name: label,
      title: label,
      subtitle: meta.subtitle,
      columns: detailCols,
      rows,
    })
  }

  return exportPackToXlsx({
    org: meta.org,
    title: meta.title,
    subtitle: meta.subtitle,
    currency: meta.currency,
    sheets,
  })
}

/** Summary rows for CSV twin of statement packs (same headers as Excel Summary). */
export function statementSummaryTable(
  report: 'profit-loss' | 'balance-sheet' | 'cash-flow',
  data: ProfitAndLoss | BalanceSheet | CashFlow,
  compare: boolean,
): { columns: ListXlsxColumn[]; rows: CsvCell[][] } {
  const columns: ListXlsxColumn[] = [
    { header: 'Metric', width: 40 },
    { header: 'Amount', width: 16, kind: 'money' },
    ...(compare
      ? [
          { header: 'Comparison', width: 16, kind: 'money' as const },
          { header: 'Change', width: 16, kind: 'money' as const },
        ]
      : []),
  ]

  if (report === 'profit-loss') {
    const pl = data as ProfitAndLoss
    return {
      columns,
      rows: [
        summaryMoneyRow('Total income', pl.totalIncome, pl.comparison?.totalIncome, compare),
        summaryMoneyRow('Cost of goods sold', pl.totalCogs, undefined, compare),
        summaryMoneyRow('Gross profit', pl.grossProfit, undefined, compare),
        summaryMoneyRow('Operating expenses', pl.totalOperatingExpenses, undefined, compare),
        summaryMoneyRow('Operating profit', pl.operatingProfit, undefined, compare),
        summaryMoneyRow('Net income', pl.netIncome, pl.comparison?.netIncome, compare),
      ],
    }
  }

  if (report === 'balance-sheet') {
    const bs = data as BalanceSheet
    return {
      columns,
      rows: [
        summaryMoneyRow('Total assets', bs.totalAssets, bs.comparison?.totalAssets, compare),
        summaryMoneyRow('Total liabilities', bs.totalLiabilities, bs.comparison?.totalLiabilities, compare),
        summaryMoneyRow(
          'Profit not yet closed to retained earnings',
          bs.accumulatedProfit,
          bs.comparison?.accumulatedProfit,
          compare,
        ),
        summaryMoneyRow('Total equity', bs.totalEquity, bs.comparison?.totalEquity, compare),
        summaryMoneyRow('Out of balance by', bs.difference, undefined, compare),
      ],
    }
  }

  const cf = data as CashFlow
  return {
    columns,
    rows: [
      summaryMoneyRow('Net income', cf.netIncome, cf.comparison?.netIncome, compare),
      summaryMoneyRow(
        'Cash from operating activities',
        cf.operating.total,
        cf.comparison?.operatingTotal ?? cf.operating.comparisonTotal,
        compare,
      ),
      summaryMoneyRow(
        'Cash from investing activities',
        cf.investing.total,
        cf.comparison?.investingTotal ?? cf.investing.comparisonTotal,
        compare,
      ),
      summaryMoneyRow(
        'Cash from financing activities',
        cf.financing.total,
        cf.comparison?.financingTotal ?? cf.financing.comparisonTotal,
        compare,
      ),
      summaryMoneyRow('Net change in cash', cf.netChange, cf.comparison?.netChange, compare),
      summaryMoneyRow('Cash at the start of the period', cf.openingCash, cf.comparison?.openingCash, compare),
      summaryMoneyRow('Cash at the end of the period', cf.closingCash, cf.comparison?.closingCash, compare),
    ],
  }
}

function summaryMoneyRow(
  label: string,
  amount: unknown,
  comparison: unknown,
  compare: boolean,
): CsvCell[] {
  if (!compare) return [label, amount as CsvCell]
  const prior = comparison ?? null
  return [
    label,
    amount as CsvCell,
    prior as CsvCell,
    prior == null ? null : changeValue(amount, prior),
  ]
}
