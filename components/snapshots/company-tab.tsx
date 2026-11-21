import Link from 'next/link'

import {
  DualBarChart,
  ExpenseDonut,
  HBarList,
  YearBars,
} from '@/components/snapshots/snapshot-charts'
import { SnapshotWidget, WidgetBody } from '@/components/snapshots/widget-frame'
import { formatMoney } from '@/lib/money'
import type { CompanyBoard } from '@/server/services/company-snapshot.service'

export function CompanyTab({ board, currency }: { board: CompanyBoard; currency: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <SnapshotWidget
        title="Income and expense trend"
        caption="This year · ledger"
        href="/reports/profit-loss"
        className="snapshot-fade-in xl:col-span-2"
      >
        <WidgetBody result={board.incomeExpense}>
          {(data) => (
            <DualBarChart
              rows={data.months.map((m) => ({ label: m.label, a: m.income, b: m.expense }))}
              currency={currency}
              aLabel="Income"
              bLabel="Expense"
            />
          )}
        </WidgetBody>
      </SnapshotWidget>

      <SnapshotWidget
        title="Prev year income comparison"
        caption="By quarter"
        href="/reports/profit-loss"
        className="snapshot-fade-in"
      >
        <WidgetBody result={board.incomeYoY}>
          {(data) => (
            <DualBarChart
              rows={data.quarters.map((q) => ({
                label: q.label,
                a: q.lastYear,
                b: q.thisYear,
              }))}
              currency={currency}
              aLabel={data.lastYear}
              bLabel={data.thisYear}
              aColor="#94A3B8"
              bColor="#0F766E"
            />
          )}
        </WidgetBody>
      </SnapshotWidget>

      <SnapshotWidget
        title="Customers who owe money"
        href="/reports/ar-aging"
        hrefLabel="A/R aging"
        className="snapshot-fade-in xl:col-span-2"
      >
        <WidgetBody result={board.customersWhoOwe} empty="Nobody owes you right now.">
          {(rows) => (rows.length === 0 ? null : <WhoOwesTable rows={rows} currency={currency} />)}
        </WidgetBody>
      </SnapshotWidget>

      <SnapshotWidget
        title="Account balances"
        href="/accounts"
        hrefLabel="Chart"
        className="snapshot-fade-in"
      >
        <WidgetBody result={board.accountBalances} empty="No account balances.">
          {(rows) =>
            rows.length === 0 ? null : (
              <ul className="divide-y text-sm">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-baseline justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">{row.name}</span>
                    <span className="shrink-0 tabular font-medium">
                      {formatMoney(row.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </WidgetBody>
      </SnapshotWidget>

      <SnapshotWidget
        title="Top customers by sales"
        caption="Last ~3 months"
        href="/reports/sales-by-customer"
        className="snapshot-fade-in"
      >
        <WidgetBody result={board.topCustomers}>
          {(rows) => (rows.length === 0 ? null : <HBarList rows={rows} currency={currency} />)}
        </WidgetBody>
      </SnapshotWidget>

      <SnapshotWidget
        title="Prev year expense comparison"
        caption="Annual expenses"
        href="/reports/expenses-by-category"
        className="snapshot-fade-in"
      >
        <WidgetBody result={board.expenseYoY}>
          {(data) => <YearBars years={data.years} currency={currency} />}
        </WidgetBody>
      </SnapshotWidget>

      <SnapshotWidget
        title="Expense breakdown"
        caption="Year to date"
        href="/reports/expenses-by-category"
        className="snapshot-fade-in"
      >
        <WidgetBody result={board.expenseBreakdown}>
          {(data) => <ExpenseDonut rows={data.rows} total={data.total} currency={currency} />}
        </WidgetBody>
      </SnapshotWidget>
    </div>
  )
}

export function WhoOwesTable({
  rows,
  currency,
}: {
  rows: { id: string; name: string; amount: string; dueDate?: string | null; overdue?: boolean }[]
  currency: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-semibold">Customer</th>
            <th className="pb-2 font-semibold">Due</th>
            <th className="pb-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60">
              <td className="py-1.5">
                <Link href={`/customers?id=${row.id}`} className="hover:underline">
                  {row.name}
                </Link>
              </td>
              <td
                className={`py-1.5 tabular ${row.overdue ? 'font-medium text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}
              >
                {row.dueDate ?? '—'}
              </td>
              <td className="py-1.5 text-right tabular font-medium">
                {formatMoney(row.amount, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
