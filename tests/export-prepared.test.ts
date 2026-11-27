import { describe, expect, it } from 'vitest'

import { HOURS_HEADERS, PORTFOLIO_HEADERS, SHAREHOLDER_REGISTER_HEADERS } from '@/lib/erp/export-headers'
import { hoursFileCsv } from '@/lib/erp/hours-export'
import { portfolioCsv } from '@/lib/erp/portfolio'
import { shareholderRegisterCsv } from '@/lib/erp/equity-csv'
import {
  coverParametersSheet,
  exportPackToXlsx,
  exportTableHeaders,
  exportTableToCsv,
  type ExportTable,
} from '@/server/reports/export-table'
import {
  renderCashFlowXlsx,
  renderProfitAndLossXlsx,
  statementSummaryTable,
} from '@/server/reports/statement-xlsx'
import { Decimal, ZERO } from '@/lib/money'
import ExcelJS from 'exceljs'

function headerRow(sheet: ExcelJS.Worksheet): string[] {
  let found: string[] = []
  sheet.eachRow((row) => {
    const cells = (row.values as unknown[])
      .slice(1)
      .map((cell) => String(cell ?? ''))
      .filter(Boolean)
    if (cells.some((cell) => /^(Amount|Metric|Movement|Code)\b/i.test(cell))) {
      found = cells
    }
  })
  return found
}

describe('prepared export headers', () => {
  it('CSV builders use human Title Case headers', () => {
    expect(shareholderRegisterCsv([]).split('\n')[0]).toBe(SHAREHOLDER_REGISTER_HEADERS.join(','))
    expect(portfolioCsv([]).split('\n')[0]).toBe(PORTFOLIO_HEADERS.join(','))
    expect(hoursFileCsv([]).split('\r\n')[0]).toBe(HOURS_HEADERS.join(','))
  })

  it('export-table CSV headers match column contract', () => {
    const table: ExportTable = {
      columns: [
        { header: 'Customer', width: 20 },
        { header: 'Amount', width: 12, kind: 'money' },
      ],
      rows: [['Acme', '10.00']],
    }
    expect(exportTableHeaders(table)).toEqual(['Customer', 'Amount'])
    expect(exportTableToCsv(table)).toContain('Customer,Amount')
    expect(exportTableToCsv(table)).toContain('Acme')
  })
})

describe('statement multi-sheet workbook', () => {
  it('P&L workbook has Cover, Summary, and section sheets', async () => {
    const bytes = await renderProfitAndLossXlsx(
      {
        range: { from: '2026-01-01', to: '2026-01-31', basis: 'accrual' },
        sections: [
          {
            key: 'income',
            label: 'Income',
            rows: [
              {
                accountId: 'a1',
                code: '4000',
                name: 'Sales',
                type: 'REVENUE',
                subtype: 'INCOME',
                amount: new Decimal(100),
                depth: 0,
                percentOfIncome: new Decimal(100),
              },
            ],
            total: new Decimal(100),
          },
          {
            key: 'cogs',
            label: 'Cost of goods sold',
            rows: [],
            total: ZERO,
          },
          {
            key: 'expenses',
            label: 'Operating expenses',
            rows: [],
            total: ZERO,
          },
          {
            key: 'otherIncome',
            label: 'Other income',
            rows: [],
            total: ZERO,
          },
          {
            key: 'otherExpense',
            label: 'Other expenses',
            rows: [],
            total: ZERO,
          },
        ],
        totalIncome: new Decimal(100),
        totalCogs: ZERO,
        grossProfit: new Decimal(100),
        totalOperatingExpenses: ZERO,
        operatingProfit: new Decimal(100),
        netIncome: new Decimal(100),
      },
      {
        org: { name: 'Blue Plastic' },
        title: 'Profit and loss (accrual basis)',
        subtitle: '2026-01-01 to 2026-01-31',
        currency: 'USD',
        basis: 'Accrual',
        compare: false,
      },
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Uint8Array.from(bytes) as never)
    const names = workbook.worksheets.map((sheet) => sheet.name)
    expect(names[0]).toBe('Cover')
    expect(names).toContain('Summary')
    expect(names).toContain('Income')
    expect(names).toContain('Cost of goods sold')
    expect(names.length).toBeGreaterThanOrEqual(3)
  })

  it('P&L workbook with compare includes Comparison and Change headers', async () => {
    const bytes = await renderProfitAndLossXlsx(
      {
        range: { from: '2026-02-01', to: '2026-02-28', basis: 'accrual' },
        sections: [
          {
            key: 'income',
            label: 'Income',
            rows: [
              {
                accountId: 'a1',
                code: '4000',
                name: 'Sales',
                type: 'REVENUE',
                subtype: 'INCOME',
                amount: new Decimal(120),
                comparison: new Decimal(100),
                depth: 0,
                percentOfIncome: new Decimal(100),
              },
            ],
            total: new Decimal(120),
            comparisonTotal: new Decimal(100),
          },
          { key: 'cogs', label: 'Cost of goods sold', rows: [], total: ZERO, comparisonTotal: ZERO },
          { key: 'expenses', label: 'Operating expenses', rows: [], total: ZERO, comparisonTotal: ZERO },
          { key: 'otherIncome', label: 'Other income', rows: [], total: ZERO, comparisonTotal: ZERO },
          { key: 'otherExpense', label: 'Other expenses', rows: [], total: ZERO, comparisonTotal: ZERO },
        ],
        totalIncome: new Decimal(120),
        totalCogs: ZERO,
        grossProfit: new Decimal(120),
        totalOperatingExpenses: ZERO,
        operatingProfit: new Decimal(120),
        netIncome: new Decimal(120),
        comparison: { netIncome: new Decimal(100), totalIncome: new Decimal(100) },
      },
      {
        org: { name: 'Blue Plastic' },
        title: 'Profit and loss (accrual basis)',
        subtitle: '2026-02-01 to 2026-02-28',
        currency: 'USD',
        basis: 'Accrual',
        compare: true,
      },
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Uint8Array.from(bytes) as never)
    const income = workbook.getWorksheet('Income')
    expect(income).toBeTruthy()
    const headers = headerRow(income!).join(' | ')
    expect(headers).toMatch(/Comparison/)
    expect(headers).toMatch(/Change/)
  })

  it('cash-flow workbook supports compare columns and Cover', async () => {
    const bytes = await renderCashFlowXlsx(
      {
        range: { from: '2026-02-01', to: '2026-02-28' },
        netIncome: new Decimal(50),
        operating: {
          lines: [{ accountId: 'r1', label: '1100 Receivables', amount: new Decimal(-10), comparison: ZERO }],
          total: new Decimal(40),
          comparisonTotal: new Decimal(20),
        },
        investing: { lines: [], total: ZERO, comparisonTotal: ZERO },
        financing: { lines: [], total: ZERO, comparisonTotal: ZERO },
        netChange: new Decimal(40),
        openingCash: new Decimal(10),
        closingCash: new Decimal(50),
        reconciles: true,
        difference: ZERO,
        comparison: {
          netIncome: new Decimal(20),
          operatingTotal: new Decimal(20),
          investingTotal: ZERO,
          financingTotal: ZERO,
          netChange: new Decimal(20),
          openingCash: ZERO,
          closingCash: new Decimal(20),
        },
      },
      {
        org: { name: 'Blue Plastic' },
        title: 'Statement of cash flows (indirect method)',
        subtitle: '2026-02-01 to 2026-02-28',
        currency: 'USD',
        compare: true,
      },
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Uint8Array.from(bytes) as never)
    expect(workbook.worksheets.map((sheet) => sheet.name)[0]).toBe('Cover')
    const summary = workbook.getWorksheet('Summary')
    expect(summary).toBeTruthy()
    const headers = headerRow(summary!).join(' | ')
    expect(headers).toMatch(/Comparison/)
    expect(headers).toMatch(/Change/)
  })

  it('catalogue-style pack has Cover and Data sheets', async () => {
    const bytes = await exportPackToXlsx({
      org: { name: 'Blue Plastic' },
      title: 'Sales by customer',
      subtitle: '2026-01-01 to 2026-01-31',
      currency: 'USD',
      sheets: [
        coverParametersSheet({
          title: 'Sales by customer',
          rows: [
            ['Report', 'Sales by customer'],
            ['Period', '2026-01-01 to 2026-01-31'],
            ['Currency', 'USD'],
            ['Filters', 'None'],
            ['Exported', '2026-01-31'],
          ],
        }),
        {
          name: 'Data',
          title: 'Sales by customer',
          subtitle: '2026-01-01 to 2026-01-31',
          columns: [
            { header: 'Customer', width: 24 },
            { header: 'Amount', width: 14, kind: 'money' },
          ],
          rows: [['Acme', new Decimal(25)]],
        },
      ],
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Uint8Array.from(bytes) as never)
    const names = workbook.worksheets.map((sheet) => sheet.name)
    expect(names).toEqual(['Cover', 'Data'])
  })

  it('statement CSV twin uses the same Summary headers as Excel', () => {
    const table = statementSummaryTable(
      'cash-flow',
      {
        range: { from: '2026-01-01', to: '2026-01-31' },
        netIncome: new Decimal(10),
        operating: { lines: [], total: new Decimal(10) },
        investing: { lines: [], total: ZERO },
        financing: { lines: [], total: ZERO },
        netChange: new Decimal(10),
        openingCash: ZERO,
        closingCash: new Decimal(10),
        reconciles: true,
        difference: ZERO,
      },
      false,
    )
    expect(exportTableHeaders(table)).toEqual(['Metric', 'Amount'])
    expect(exportTableToCsv(table)).toContain('Metric,Amount')
    expect(exportTableToCsv(table)).toContain('Net income')

    const compared = statementSummaryTable(
      'profit-loss',
      {
        range: { from: '2026-02-01', to: '2026-02-28', basis: 'accrual' },
        sections: [],
        totalIncome: new Decimal(120),
        totalCogs: ZERO,
        grossProfit: new Decimal(120),
        totalOperatingExpenses: ZERO,
        operatingProfit: new Decimal(120),
        netIncome: new Decimal(120),
        comparison: { netIncome: new Decimal(100), totalIncome: new Decimal(100) },
      },
      true,
    )
    expect(exportTableHeaders(compared)).toEqual(['Metric', 'Amount', 'Comparison', 'Change'])
  })
})
