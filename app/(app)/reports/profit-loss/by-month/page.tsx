import type { Metadata } from 'next'

import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { InteractiveGrid } from '@/components/data/interactive-grid'
import { PageHeader } from '@/components/data/page-header'
import { endOfMonth, today } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss } from '@/server/reports/statements'

export const metadata: Metadata = { title: 'Profit and Loss by Month' }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default async function ProfitAndLossByMonthPage() {
  const ctx = await requireOrgContext('report:read')
  const now = today(ctx.organization.timeZone)
  const year = now.slice(0, 4)
  const currency = ctx.organization.baseCurrency

  const reports = await Promise.all(
    MONTHS.map((_, index) => {
      const from = `${year}-${String(index + 1).padStart(2, '0')}-01`
      return profitAndLoss(ctx.orgId, { from, to: endOfMonth(from), basis: 'accrual' })
    }),
  )

  const rows = reports.map((report, index) => ({
    label: MONTHS[index] ?? '',
    income: report.totalIncome,
    expenses: report.totalCogs.plus(report.totalOperatingExpenses).plus(
      report.sections.find((section) => section.key === 'otherExpense')?.total ?? ZERO,
    ),
    net: report.netIncome,
  }))
  return (
    <>
      <PageHeader
        className="print:hidden"
        title="Profit and Loss by Month"
        description={`Accrual basis for ${year}. Each month is read from the ledger on its own.`}
        actions={
          <PrintButton
            paper="profit and loss by month"
            defaultSubject={`Profit and Loss by Month — ${ctx.organization.name}`}
            defaultBody={`Profit and Loss by Month\n${ctx.organization.name}\n${year}`}
          />
        }
      />
      <InteractiveGrid
        storageKey="bp-pl-by-month"
        currency={currency}
        columns={[
          { id: 'month', label: 'Month', defaultWidth: 160 },
          { id: 'income', label: 'Income', kind: 'money', total: true, defaultWidth: 140 },
          { id: 'expenses', label: 'Expenses', kind: 'money', total: true, defaultWidth: 140 },
          { id: 'net', label: 'Net income', kind: 'money', total: true, defaultWidth: 140 },
        ]}
        rows={rows.map((row) => ({
          id: row.label,
          cells: {
            month: { value: row.label, sort: String(MONTHS.indexOf(row.label)).padStart(2, '0') },
            income: { value: row.income.toString() },
            expenses: { value: row.expenses.toString() },
            net: { value: row.net.toString() },
          },
        }))}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Expenses here are cost of goods sold, operating expenses, and other expenses. A month with no postings shows {formatMoney(new Decimal(0), currency)}.
      </p>
    </>
  )
}
