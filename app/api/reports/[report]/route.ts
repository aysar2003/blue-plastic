import { NextResponse } from 'next/server'

import { readEntityFilters, readSettings, type SearchParams } from '@/app/(app)/reports/params'
import { ACCOUNT_SUBTYPE_LABELS, ACCOUNT_TYPE_LABELS } from '@/lib/accounting-labels'
import { formatDate } from '@/lib/date'
import { PERIOD_LABELS } from '@/lib/report-periods'
import { requireOrgContext, type OrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import type { CsvCell } from '@/server/reports/csv'
import {
  coverParametersSheet,
  exportPackToXlsx,
  exportTableCsvResponse,
} from '@/server/reports/export-table'
import {
  xlsxResponse,
  type ListXlsxColumn,
} from '@/server/reports/list-xlsx'
import {
  expensesByCategory,
  purchasesByVendor,
  salesByCustomer,
  salesByItem,
  taxSummary,
} from '@/server/reports/business'
import { tableReport } from '@/server/reports/catalogue'
import {
  renderBalanceSheetXlsx,
  renderCashFlowXlsx,
  renderProfitAndLossXlsx,
  statementSummaryTable,
} from '@/server/reports/statement-xlsx'
import { AGING_BUCKETS, BUCKET_LABELS, aging as receivablesAging } from '@/server/services/receivables.service'
import { aging as payablesAging } from '@/server/services/payables.service'
import { balanceSheet, cashFlow, profitAndLoss } from '@/server/reports/statements'

export const dynamic = 'force-dynamic'

const REPORTS = [
  'profit-loss',
  'balance-sheet',
  'cash-flow',
  'sales-by-customer',
  'sales-by-item',
  'purchases-by-vendor',
  'expenses-by-category',
  'tax-summary',
  'ar-aging',
  'ap-aging',
] as const

type ReportKey = (typeof REPORTS)[number]

type BuiltReport = {
  title: string
  subtitle: string
  columns: ListXlsxColumn[]
  rows: CsvCell[][]
}

type BuiltPack = {
  kind: 'pack'
  filenameDate: string
  bytes: Uint8Array
  summary: { columns: ListXlsxColumn[]; rows: CsvCell[][] }
}

/**
 * Excel (default) or CSV export for every standard report — same filters as the
 * on-screen view. Financial statements use a modern multi-sheet pack
 * (Cover + Summary + sections). Catalogue / aging / business reports use
 * Cover + Data. `?format=csv` returns Summary (statements) or Data (tables)
 * with the same human headers as Excel.
 */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  try {
    const { report } = await params
    const fromCatalogue = tableReport(report)

    if (!fromCatalogue && !REPORTS.includes(report as ReportKey)) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown report.' } }, { status: 404 })
    }

    const ctx = await requireOrgContext('report:read')
    const url = new URL(request.url)
    const query = Object.fromEntries(url.searchParams) as SearchParams
    const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
    const settings = readSettings(query, ctx.organization)
    const filters = readEntityFilters(query)
    const filtersNote = Object.entries(filters)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')

    if (!fromCatalogue && (report === 'profit-loss' || report === 'balance-sheet' || report === 'cash-flow')) {
      const pack = await buildStatementPack(
        report,
        ctx,
        settings,
        filters,
        filtersNote || undefined,
      )
      if (format === 'csv') {
        return exportTableCsvResponse(`${report}-${pack.filenameDate}.csv`, {
          columns: pack.summary.columns,
          rows: pack.summary.rows,
        })
      }
      return xlsxResponse(`${report}-${pack.filenameDate}.xlsx`, pack.bytes)
    }

    let built: BuiltReport

    if (fromCatalogue) {
      const table = await fromCatalogue.build({
        ctx,
        range: settings.range,
        asOf: settings.asOf,
        filters,
      })
      const subtitle =
        fromCatalogue.mode === 'asOf'
          ? `As at ${formatDate(settings.asOf)}`
          : `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}${
              settings.period === 'custom' ? '' : ` (${PERIOD_LABELS[settings.period]})`
            }`
      const columns: ListXlsxColumn[] = table.columns.map((column) => {
        const formatKind = column.kind ?? column.format
        return {
          header: column.label,
          width: Math.min(36, Math.max(12, column.label.length + 4)),
          kind:
            formatKind === 'money' || formatKind === 'signed'
              ? 'money'
              : formatKind === 'number'
                ? 'number'
                : formatKind === 'date' || formatKind === 'datetime'
                  ? 'date'
                  : 'text',
        }
      })
      const rows: CsvCell[][] = table.rows.map((row) =>
        table.columns.map((column) => row.cells[column.key] ?? ''),
      )
      if (table.totals) {
        rows.push(table.columns.map((column) => table.totals?.[column.key] ?? ''))
      }
      built = { title: fromCatalogue.title, subtitle, columns, rows }
    } else {
      built = await build(report as ReportKey, ctx.orgId, settings, ctx, filters)
    }

    const filenameDate =
      report === 'balance-sheet' || report === 'ar-aging' || report === 'ap-aging'
        ? settings.asOf
        : settings.range.to

    if (format === 'csv') {
      return exportTableCsvResponse(`${report}-${filenameDate}.csv`, {
        columns: built.columns,
        rows: built.rows,
      })
    }

    const exportedAt =
      report === 'balance-sheet' || report === 'ar-aging' || report === 'ap-aging'
        ? formatDate(settings.asOf)
        : formatDate(settings.range.to)

    const bytes = await exportPackToXlsx({
      org: ctx.organization,
      title: built.title,
      subtitle: built.subtitle,
      currency: ctx.organization.baseCurrency,
      sheets: [
        coverParametersSheet({
          title: built.title,
          rows: [
            ['Report', built.title],
            ['Period', built.subtitle],
            ['Currency', ctx.organization.baseCurrency],
            ['Filters', filtersNote || 'None'],
            ['Exported', exportedAt],
          ],
        }),
        {
          name: 'Data',
          title: built.title,
          subtitle: built.subtitle,
          columns: built.columns,
          rows: built.rows,
        },
      ],
    })
    return xlsxResponse(`${report}-${filenameDate}.xlsx`, bytes)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/reports]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}

async function buildStatementPack(
  report: 'profit-loss' | 'balance-sheet' | 'cash-flow',
  ctx: OrgContext,
  settings: ReturnType<typeof readSettings>,
  filters: ReturnType<typeof readEntityFilters>,
  filtersNote?: string,
): Promise<BuiltPack> {
  const subtitle = periodSubtitle(report, settings)
  const basis = settings.basis === 'cash' ? 'Cash' : 'Accrual'
  const meta = {
    org: ctx.organization,
    subtitle,
    currency: ctx.organization.baseCurrency,
    basis,
    exportedAt: formatDate(settings.range.to),
    filtersNote,
  }

  if (report === 'profit-loss') {
    const compare = Boolean(settings.comparisonRange)
    const data = await profitAndLoss(ctx.orgId, { ...settings.range, basis: settings.basis }, {
      comparison: settings.comparisonRange,
      filters,
    })
    const bytes = await renderProfitAndLossXlsx(data, {
      ...meta,
      title: `Profit and loss (${settings.basis === 'cash' ? 'cash' : 'accrual'} basis)`,
      compare,
    })
    return {
      kind: 'pack',
      filenameDate: settings.range.to,
      bytes,
      summary: statementSummaryTable('profit-loss', data, compare),
    }
  }

  if (report === 'balance-sheet') {
    const compareAsOf =
      settings.comparison !== 'none' && settings.comparisonRange
        ? settings.comparisonRange.to
        : undefined
    const compare = Boolean(compareAsOf)
    const data = await balanceSheet(ctx.orgId, settings.asOf, {
      basis: settings.basis,
      filters,
      comparisonAsOf: compareAsOf,
    })
    const bytes = await renderBalanceSheetXlsx(data, {
      ...meta,
      title: 'Balance sheet',
      exportedAt: formatDate(settings.asOf),
      compare,
    })
    return {
      kind: 'pack',
      filenameDate: settings.asOf,
      bytes,
      summary: statementSummaryTable('balance-sheet', data, compare),
    }
  }

  const compare = Boolean(settings.comparisonRange)
  const data = await cashFlow(ctx.orgId, settings.range, {
    filters,
    comparison: settings.comparisonRange,
  })
  const bytes = await renderCashFlowXlsx(data, {
    ...meta,
    title: 'Statement of cash flows (indirect method)',
    compare,
  })
  return {
    kind: 'pack',
    filenameDate: settings.range.to,
    bytes,
    summary: statementSummaryTable('cash-flow', data, compare),
  }
}

function periodSubtitle(
  report: ReportKey,
  settings: ReturnType<typeof readSettings>,
): string {
  if (report === 'balance-sheet' || report === 'ar-aging' || report === 'ap-aging') {
    return `As at ${formatDate(settings.asOf)}`
  }
  return `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}${
    settings.period === 'custom' ? '' : ` (${PERIOD_LABELS[settings.period]})`
  }`
}

async function build(
  report: ReportKey,
  orgId: string,
  settings: ReturnType<typeof readSettings>,
  ctx: OrgContext,
  filters: ReturnType<typeof readEntityFilters> = {},
): Promise<BuiltReport> {
  const subtitle = periodSubtitle(report, settings)

  switch (report) {
    case 'profit-loss': {
      const data = await profitAndLoss(orgId, { ...settings.range, basis: settings.basis }, {
        comparison: settings.comparisonRange,
        filters,
      })
      const compare = Boolean(settings.comparisonRange)
      const columns: ListXlsxColumn[] = [
        { header: 'Section', width: 18, kind: 'text' },
        { header: 'Code', width: 10, kind: 'text' },
        { header: 'Account', width: 28, kind: 'text' },
        { header: 'Type', width: 14, kind: 'text' },
        { header: 'Detail type', width: 18, kind: 'text' },
        { header: 'Amount', width: 14, kind: 'money' },
        ...(compare
          ? [
              { header: 'Comparison', width: 14, kind: 'money' as const },
              { header: 'Change', width: 14, kind: 'money' as const },
            ]
          : []),
        { header: '% of income', width: 12, kind: 'number' },
      ]
      const rows: CsvCell[][] = []
      for (const section of data.sections) {
        for (const row of section.rows) {
          const prior = row.comparison ?? null
          rows.push([
            section.label,
            row.code,
            row.name,
            ACCOUNT_TYPE_LABELS[row.type],
            ACCOUNT_SUBTYPE_LABELS[row.subtype],
            row.amount,
            ...(compare
              ? [prior, prior == null ? null : row.amount.minus(prior)]
              : []),
            row.percentOfIncome ?? null,
          ])
        }
        const sectionPrior = section.comparisonTotal ?? null
        rows.push([
          section.label,
          '',
          `Total ${section.label.toLowerCase()}`,
          '',
          '',
          section.total,
          ...(compare
            ? [sectionPrior, sectionPrior == null ? null : section.total.minus(sectionPrior)]
            : []),
          null,
        ])
      }
      rows.push([])
      rows.push(['', '', 'Gross profit', '', '', data.grossProfit, ...(compare ? [null, null] : []), null])
      rows.push(['', '', 'Operating profit', '', '', data.operatingProfit, ...(compare ? [null, null] : []), null])
      rows.push([
        '',
        '',
        'Net income',
        '',
        '',
        data.netIncome,
        ...(compare
          ? [
              data.comparison?.netIncome ?? null,
              data.comparison ? data.netIncome.minus(data.comparison.netIncome) : null,
            ]
          : []),
        null,
      ])
      return {
        title: `Profit and loss (${settings.basis === 'cash' ? 'cash' : 'accrual'} basis)`,
        subtitle,
        columns,
        rows,
      }
    }

    case 'balance-sheet': {
      const compareAsOf =
        settings.comparison !== 'none' && settings.comparisonRange
          ? settings.comparisonRange.to
          : undefined
      const data = await balanceSheet(orgId, settings.asOf, {
        basis: settings.basis,
        filters,
        comparisonAsOf: compareAsOf,
      })
      const compare = Boolean(compareAsOf)
      const columns: ListXlsxColumn[] = [
        { header: 'Section', width: 18, kind: 'text' },
        { header: 'Code', width: 10, kind: 'text' },
        { header: 'Account', width: 32, kind: 'text' },
        { header: 'Type', width: 14, kind: 'text' },
        { header: 'Detail type', width: 18, kind: 'text' },
        { header: 'Amount', width: 14, kind: 'money' },
        ...(compare
          ? [
              { header: 'Comparison', width: 14, kind: 'money' as const },
              { header: 'Change', width: 14, kind: 'money' as const },
            ]
          : []),
      ]
      const rows: CsvCell[][] = []
      for (const section of data.sections) {
        for (const row of section.rows) {
          const prior = row.comparison ?? null
          rows.push([
            section.label,
            row.code,
            row.name,
            ACCOUNT_TYPE_LABELS[row.type],
            ACCOUNT_SUBTYPE_LABELS[row.subtype],
            row.amount,
            ...(compare
              ? [prior, prior == null ? null : row.amount.minus(prior)]
              : []),
          ])
        }
        const sectionPrior = section.comparisonTotal ?? null
        rows.push([
          section.label,
          '',
          `Total ${section.label.toLowerCase()}`,
          '',
          '',
          section.total,
          ...(compare
            ? [sectionPrior, sectionPrior == null ? null : section.total.minus(sectionPrior)]
            : []),
        ])
      }
      rows.push([])
      const pushCompared = (label: string, amount: (typeof data)['totalAssets'], prior?: (typeof data)['totalAssets'] | null) => {
        rows.push([
          '',
          '',
          label,
          '',
          '',
          amount,
          ...(compare
            ? [prior ?? null, prior == null ? null : amount.minus(prior)]
            : []),
        ])
      }
      pushCompared('Total assets', data.totalAssets, data.comparison?.totalAssets)
      pushCompared('Total liabilities', data.totalLiabilities, data.comparison?.totalLiabilities)
      pushCompared(
        'Profit not yet closed to retained earnings',
        data.accumulatedProfit,
        data.comparison?.accumulatedProfit,
      )
      pushCompared('Total equity', data.totalEquity, data.comparison?.totalEquity)
      rows.push(['', '', 'Out of balance by', '', '', data.difference, ...(compare ? [null, null] : [])])
      return { title: 'Balance sheet', subtitle, columns, rows }
    }

    case 'cash-flow': {
      const compare = Boolean(settings.comparisonRange)
      const data = await cashFlow(orgId, settings.range, {
        filters,
        comparison: settings.comparisonRange,
      })
      const columns: ListXlsxColumn[] = [
        { header: 'Section', width: 22, kind: 'text' },
        { header: 'Movement', width: 36, kind: 'text' },
        { header: 'Amount', width: 14, kind: 'money' },
        ...(compare
          ? [
              { header: 'Comparison', width: 14, kind: 'money' as const },
              { header: 'Change', width: 14, kind: 'money' as const },
            ]
          : []),
      ]
      const moneyCells = (amount: (typeof data)['netIncome'], prior?: (typeof data)['netIncome'] | null) =>
        compare
          ? [amount, prior ?? null, prior == null ? null : amount.minus(prior)]
          : [amount]
      const rows: CsvCell[][] = [
        ['Operating activities', 'Net income', ...moneyCells(data.netIncome, data.comparison?.netIncome)],
      ]
      for (const [label, group] of [
        ['Operating activities', data.operating],
        ['Investing activities', data.investing],
        ['Financing activities', data.financing],
      ] as const) {
        for (const line of group.lines) {
          rows.push([label, line.label, ...moneyCells(line.amount, line.comparison)])
        }
        rows.push([
          label,
          `Cash from ${label.toLowerCase()}`,
          ...moneyCells(group.total, group.comparisonTotal),
        ])
      }
      rows.push([])
      rows.push(['', 'Net change in cash', ...moneyCells(data.netChange, data.comparison?.netChange)])
      rows.push([
        '',
        'Cash at the start of the period',
        ...moneyCells(data.openingCash, data.comparison?.openingCash),
      ])
      rows.push([
        '',
        'Cash at the end of the period',
        ...moneyCells(data.closingCash, data.comparison?.closingCash),
      ])
      return { title: 'Statement of cash flows (indirect method)', subtitle, columns, rows }
    }

    case 'ar-aging':
    case 'ap-aging': {
      const receivable = report === 'ar-aging'
      const data = receivable
        ? await receivablesAging(ctx, settings.asOf)
        : await payablesAging(ctx, settings.asOf)
      const columns: ListXlsxColumn[] = [
        { header: receivable ? 'Customer' : 'Vendor', width: 28, kind: 'text' },
        ...AGING_BUCKETS.map((bucket) => ({
          header: BUCKET_LABELS[bucket],
          width: 12,
          kind: 'money' as const,
        })),
        { header: 'Total', width: 14, kind: 'money' },
      ]
      const rows: CsvCell[][] = data.rows.map((row) => [
        'customerName' in row ? row.customerName : row.vendorName,
        ...AGING_BUCKETS.map((bucket) => row.buckets[bucket]),
        row.total,
      ])
      rows.push([])
      rows.push(['Total', ...AGING_BUCKETS.map((bucket) => data.totals[bucket]), data.grandTotal])
      rows.push([])
      rows.push([
        data.agrees
          ? 'Agrees with the control account.'
          : `Does NOT agree with the control account (${data.controlBalance.toFixed(2)}).`,
        ...AGING_BUCKETS.map(() => ''),
        '',
      ])
      return {
        title: receivable ? 'Accounts receivable ageing' : 'Accounts payable ageing',
        subtitle,
        columns,
        rows,
      }
    }

    case 'tax-summary': {
      const data = await taxSummary(orgId, settings.range)
      const columns: ListXlsxColumn[] = [
        { header: 'Rate', width: 18, kind: 'text' },
        { header: 'Agency', width: 18, kind: 'text' },
        { header: 'Rate %', width: 10, kind: 'number' },
        { header: 'Taxable sales', width: 14, kind: 'money' },
        { header: 'Tax on sales', width: 14, kind: 'money' },
        { header: 'Taxable purchases', width: 14, kind: 'money' },
        { header: 'Tax on purchases', width: 14, kind: 'money' },
        { header: 'Net owed', width: 14, kind: 'money' },
      ]
      const rows: CsvCell[][] = data.rows.map((row) => [
        row.rateName,
        row.agencyName,
        row.ratePercent,
        row.salesNet,
        row.salesTax,
        row.purchaseNet,
        row.purchaseTax,
        row.net,
      ])
      rows.push([])
      rows.push(['Net owed to tax agencies', '', '', '', '', '', '', data.totalNet])
      return { title: 'Tax summary', subtitle, columns, rows }
    }

    default: {
      const [title, nameHeader, data] = await rankedReport(report, orgId, settings, filters)
      const quantities = data.rows.some((row) => 'quantity' in row)
      const columns: ListXlsxColumn[] = [
        { header: nameHeader, width: 28, kind: 'text' },
        { header: 'Documents', width: 12, kind: 'number' },
        ...(quantities ? [{ header: 'Quantity', width: 12, kind: 'number' as const }] : []),
        { header: 'Amount', width: 14, kind: 'money' },
        { header: 'Share %', width: 10, kind: 'number' },
      ]
      const rows: CsvCell[][] = data.rows.map((row) => [
        row.name,
        row.count,
        ...(quantities ? [(row as { quantity?: unknown }).quantity as CsvCell] : []),
        row.amount,
        row.share,
      ])
      rows.push([])
      rows.push(['Total', '', ...(quantities ? [''] : []), data.total, ''])
      return { title, subtitle, columns, rows }
    }
  }
}

async function rankedReport(
  report: Extract<
    ReportKey,
    'sales-by-customer' | 'sales-by-item' | 'purchases-by-vendor' | 'expenses-by-category'
  >,
  orgId: string,
  settings: ReturnType<typeof readSettings>,
  filters: ReturnType<typeof readEntityFilters> = {},
) {
  switch (report) {
    case 'sales-by-customer':
      return [
        'Sales by customer',
        'Customer',
        await salesByCustomer(orgId, settings.range, { customerId: filters.customerId }),
      ] as const
    case 'sales-by-item':
      return [
        'Sales by product or service',
        'Item',
        await salesByItem(orgId, settings.range, {
          itemId: filters.itemId,
          customerId: filters.customerId,
        }),
      ] as const
    case 'purchases-by-vendor':
      return [
        'Purchases by vendor',
        'Vendor',
        await purchasesByVendor(orgId, settings.range, { vendorId: filters.vendorId }),
      ] as const
    case 'expenses-by-category':
      return ['Expenses by category', 'Account', await expensesByCategory(orgId, settings.range)] as const
  }
}
