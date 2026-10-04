import { NextResponse } from 'next/server'

import { readSettings, type SearchParams } from '@/app/(app)/reports/params'
import { ACCOUNT_SUBTYPE_LABELS, ACCOUNT_TYPE_LABELS } from '@/lib/accounting-labels'
import { formatDate } from '@/lib/date'
import { letterheadLines } from '@/lib/letterhead'
import { PERIOD_LABELS } from '@/lib/report-periods'
import { requireOrgContext, type OrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { csvResponse, type CsvCell } from '@/server/reports/csv'
import {
  expensesByCategory,
  purchasesByVendor,
  salesByCustomer,
  salesByItem,
  taxSummary,
} from '@/server/reports/business'
import { tableReport } from '@/server/reports/catalogue'
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

/**
 * CSV export.
 *
 * One handler for every report, reading the same settings from the same query
 * string the page did — so the file is the report on screen, not a second
 * implementation of it that drifts.
 */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  try {
    const { report } = await params
    const fromCatalogue = tableReport(report)

    if (!fromCatalogue && !REPORTS.includes(report as ReportKey)) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown report.' } }, { status: 404 })
    }

    const ctx = await requireOrgContext('report:read')
    const query = Object.fromEntries(new URL(request.url).searchParams) as SearchParams
    const settings = readSettings(query, ctx.organization)

    // A table report is the same builder the page used, flattened. One
    // implementation, so the file and the screen cannot disagree.
    if (fromCatalogue) {
      const table = await fromCatalogue.build({
        ctx,
        range: settings.range,
        asOf: settings.asOf,
      })

      const rows: CsvCell[][] = [
        ...letterheadLines(ctx.organization).map((line) => [line]),
        [fromCatalogue.title],
        [
          fromCatalogue.mode === 'asOf'
            ? `As at ${formatDate(settings.asOf)}`
            : `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}${
                settings.period === 'custom' ? '' : ` (${PERIOD_LABELS[settings.period]})`
              }`,
        ],
        [`Currency: ${ctx.organization.baseCurrency}`],
        [],
        table.columns.map((column) => column.label),
        ...table.rows.map((row) => table.columns.map((column) => row.cells[column.key] ?? '')),
      ]

      if (table.totals) {
        rows.push([])
        rows.push(table.columns.map((column) => table.totals?.[column.key] ?? ''))
      }

      return csvResponse(`${report}-${settings.range.to}.csv`, rows)
    }

    const heading = (title: string): CsvCell[][] => [
      ...letterheadLines(ctx.organization).map((line) => [line]),
      [title],
      [
        report === 'balance-sheet'
          ? `As at ${formatDate(settings.asOf)}`
          : `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}${
              settings.period === 'custom' ? '' : ` (${PERIOD_LABELS[settings.period]})`
            }`,
      ],
      [`Currency: ${ctx.organization.baseCurrency}`],
      [],
    ]

    const rows = await build(report as ReportKey, ctx.orgId, settings, heading, ctx)
    return csvResponse(`${report}-${settings.range.to}.csv`, rows)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/reports]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}

async function build(
  report: ReportKey,
  orgId: string,
  settings: ReturnType<typeof readSettings>,
  heading: (title: string) => CsvCell[][],
  ctx: OrgContext,
): Promise<CsvCell[][]> {
  switch (report) {
    case 'profit-loss': {
      const data = await profitAndLoss(orgId, { ...settings.range, basis: settings.basis }, {
        comparison: settings.comparisonRange,
      })
      const compare = Boolean(settings.comparisonRange)

      const rows: CsvCell[][] = heading(
        `Profit and loss (${settings.basis === 'cash' ? 'cash' : 'accrual'} basis)`,
      )
      rows.push([
        'Section',
        'Code',
        'Account',
        'Type',
        'Amount',
        ...(compare ? ['Comparison'] : []),
        '% of income',
      ])

      for (const section of data.sections) {
        for (const row of section.rows) {
          rows.push([
            section.label,
            row.code,
            row.name,
            `${ACCOUNT_TYPE_LABELS[row.type]} · ${ACCOUNT_SUBTYPE_LABELS[row.subtype]}`,
            row.amount,
            ...(compare ? [row.comparison ?? null] : []),
            row.percentOfIncome ?? null,
          ])
        }
        rows.push([section.label, '', `Total ${section.label.toLowerCase()}`, '', section.total])
      }

      rows.push([])
      rows.push(['', '', 'Gross profit', '', data.grossProfit])
      rows.push(['', '', 'Operating profit', '', data.operatingProfit])
      rows.push(['', '', 'Net income', '', data.netIncome])
      return rows
    }

    case 'balance-sheet': {
      const data = await balanceSheet(orgId, settings.asOf, { basis: settings.basis })
      const rows: CsvCell[][] = heading('Balance sheet')
      rows.push(['Section', 'Code', 'Account', 'Type', 'Amount'])

      for (const section of data.sections) {
        for (const row of section.rows) {
          rows.push([
            section.label,
            row.code,
            row.name,
            `${ACCOUNT_TYPE_LABELS[row.type]} · ${ACCOUNT_SUBTYPE_LABELS[row.subtype]}`,
            row.amount,
          ])
        }
        rows.push([section.label, '', `Total ${section.label.toLowerCase()}`, '', section.total])
      }

      rows.push([])
      rows.push(['', '', 'Total assets', '', data.totalAssets])
      rows.push(['', '', 'Total liabilities', '', data.totalLiabilities])
      rows.push(['', '', 'Profit not yet closed to retained earnings', '', data.accumulatedProfit])
      rows.push(['', '', 'Total equity', '', data.totalEquity])
      rows.push(['', '', 'Out of balance by', '', data.difference])
      return rows
    }

    case 'cash-flow': {
      const data = await cashFlow(orgId, settings.range)
      const rows: CsvCell[][] = heading('Statement of cash flows (indirect method)')
      rows.push(['Section', 'Movement', 'Amount'])
      rows.push(['Operating activities', 'Net income', data.netIncome])

      for (const [label, group] of [
        ['Operating activities', data.operating],
        ['Investing activities', data.investing],
        ['Financing activities', data.financing],
      ] as const) {
        for (const line of group.lines) rows.push([label, line.label, line.amount])
        rows.push([label, `Cash from ${label.toLowerCase()}`, group.total])
      }

      rows.push([])
      rows.push(['', 'Net change in cash', data.netChange])
      rows.push(['', 'Cash at the start of the period', data.openingCash])
      rows.push(['', 'Cash at the end of the period', data.closingCash])
      return rows
    }

    case 'ar-aging':
    case 'ap-aging': {
      const receivable = report === 'ar-aging'
      const data = receivable
        ? await receivablesAging(ctx, settings.asOf)
        : await payablesAging(ctx, settings.asOf)

      const rows: CsvCell[][] = heading(
        receivable ? 'Accounts receivable ageing' : 'Accounts payable ageing',
      )
      rows.push([receivable ? 'Customer' : 'Vendor', ...AGING_BUCKETS.map((b) => BUCKET_LABELS[b]), 'Total'])

      for (const row of data.rows) {
        rows.push([
          'customerName' in row ? row.customerName : row.vendorName,
          ...AGING_BUCKETS.map((bucket) => row.buckets[bucket]),
          row.total,
        ])
      }

      rows.push([])
      rows.push(['Total', ...AGING_BUCKETS.map((bucket) => data.totals[bucket]), data.grandTotal])
      rows.push([])
      rows.push([
        data.agrees
          ? 'Agrees with the control account.'
          : `Does NOT agree with the control account (${data.controlBalance.toFixed(2)}).`,
      ])
      return rows
    }

    case 'tax-summary': {
      const data = await taxSummary(orgId, settings.range)
      const rows: CsvCell[][] = heading('Tax summary')
      rows.push([
        'Rate',
        'Agency',
        'Rate %',
        'Taxable sales',
        'Tax on sales',
        'Taxable purchases',
        'Tax on purchases',
        'Net owed',
      ])
      for (const row of data.rows) {
        rows.push([
          row.rateName,
          row.agencyName,
          row.ratePercent,
          row.salesNet,
          row.salesTax,
          row.purchaseNet,
          row.purchaseTax,
          row.net,
        ])
      }
      rows.push([])
      rows.push(['Net owed to tax agencies', '', '', '', '', '', '', data.totalNet])
      return rows
    }

    default: {
      const [title, nameHeader, data] = await rankedReport(report, orgId, settings)
      const rows: CsvCell[][] = heading(title)
      const quantities = data.rows.some((row) => 'quantity' in row)

      rows.push([nameHeader, 'Documents', ...(quantities ? ['Quantity'] : []), 'Amount', 'Share %'])
      for (const row of data.rows) {
        rows.push([
          row.name,
          row.count,
          ...(quantities ? [(row as { quantity?: unknown }).quantity as CsvCell] : []),
          row.amount,
          row.share,
        ])
      }
      rows.push([])
      rows.push(['Total', '', ...(quantities ? [''] : []), data.total])
      return rows
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
) {
  switch (report) {
    case 'sales-by-customer':
      return ['Sales by customer', 'Customer', await salesByCustomer(orgId, settings.range)] as const
    case 'sales-by-item':
      return ['Sales by product or service', 'Item', await salesByItem(orgId, settings.range)] as const
    case 'purchases-by-vendor':
      return ['Purchases by vendor', 'Vendor', await purchasesByVendor(orgId, settings.range)] as const
    case 'expenses-by-category':
      return ['Expenses by category', 'Account', await expensesByCategory(orgId, settings.range)] as const
  }
}
