import Link from 'next/link'

import { WhoOwesTable } from '@/components/snapshots/company-tab'
import { AgingBars, StatusPie } from '@/components/snapshots/snapshot-charts'
import { SnapshotWidget, WidgetBody } from '@/components/snapshots/widget-frame'
import { formatMoney } from '@/lib/money'
import type { PaymentsBoard } from '@/server/services/company-snapshot.service'

const RECEIVABLES_LINKS = [
  {
    title: 'Customer Balance',
    summary: '/reports/customer-balances',
    detail: '/reports/statements/customer',
  },
  {
    title: 'A/R Aging',
    summary: '/reports/ar-aging',
    detail: '/reports/ar-aging-detail',
  },
  {
    title: 'Sales by Customer',
    summary: '/reports/sales-by-customer',
    detail: '/reports/sales-by-customer',
  },
  {
    title: 'Deposit Detail',
    summary: '/reports/deposit-detail',
    detail: '/banking/deposits/new',
  },
  {
    title: 'Unbilled work',
    summary: '/projects/wip',
    detail: '/reports/open-invoices',
  },
] as const

export function PaymentsTab({ board, currency }: { board: PaymentsBoard; currency: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 snapshot-fade-in">
        <QuickLink href="/payments/new" label="Receive payment" />
        <QuickLink href="/sales/sales-receipts/new" label="Create sales receipt" />
        <QuickLink href="/sales/credit-memos/new" label="Credits & refunds" />
        <QuickLink href="/reports/collections" label="Collections" />
        <QuickLink href="/banking/deposits/new" label="Record deposit" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SnapshotWidget
          title="Invoice payment status"
          caption="Collected this month vs still open"
          className="snapshot-fade-in"
        >
          <WidgetBody result={board.paymentStatus}>
            {(data) => (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">{data.label}</p>
                <StatusPie
                  paid={data.paid}
                  unpaid={data.unpaid}
                  overdue={data.overdue}
                  currency={currency}
                />
              </div>
            )}
          </WidgetBody>
        </SnapshotWidget>

        <SnapshotWidget
          title="Receivables reports"
          caption="Jump to the full report"
          className="snapshot-fade-in"
        >
          <ul className="space-y-2 text-sm">
            {RECEIVABLES_LINKS.map((row) => (
              <li
                key={row.title}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
              >
                <span className="font-medium">{row.title}</span>
                <span className="flex gap-2 text-xs font-semibold uppercase tracking-wide">
                  <Link href={row.summary} className="text-primary hover:underline">
                    Summary
                  </Link>
                  <Link href={row.detail} className="text-muted-foreground hover:underline">
                    Detail
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </SnapshotWidget>

        <SnapshotWidget
          title="A/R by aging period"
          href="/reports/ar-aging"
          hrefLabel="Detail"
          className="snapshot-fade-in"
        >
          <WidgetBody result={board.arAging}>
            {(data) => (
              <div>
                {!data.agrees ? (
                  <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-100">
                    Aging and the receivables control differ slightly — open the full report to
                    reconcile.
                  </p>
                ) : null}
                <p className="mb-2 text-xs text-muted-foreground">
                  As of {data.asOf} · total {formatMoney(data.grandTotal, currency)}
                </p>
                <AgingBars slices={data.slices} currency={currency} />
              </div>
            )}
          </WidgetBody>
        </SnapshotWidget>

        <SnapshotWidget title="Payment reminders" href="/reports/collections" className="snapshot-fade-in">
          <WidgetBody result={board.reminders}>
            {(data) => (
              <ul className="space-y-3 text-sm">
                <ReminderCard
                  tone="danger"
                  label={`Overdue invoices (${data.overdueCount})`}
                  amount={formatMoney(data.overdueAmount, currency)}
                  href="/reports/collections"
                />
                <ReminderCard
                  tone="neutral"
                  label={`Open invoices (${data.openInvoiceCount})`}
                  amount={formatMoney(data.openInvoiceAmount, currency)}
                  href="/reports/open-invoices"
                />
                <ReminderCard
                  tone="warn"
                  label={`Drafts to finish (${data.draftCount})`}
                  amount={formatMoney(data.draftAmount, currency)}
                  href="/sales/invoices?status=draft"
                  hint="Modern stand-in for QB “to print” — unfinished invoices & credits"
                />
              </ul>
            )}
          </WidgetBody>
        </SnapshotWidget>

        <SnapshotWidget
          title="Customers who owe money"
          href="/reports/ar-aging"
          className="snapshot-fade-in xl:col-span-2"
        >
          <WidgetBody result={board.customersWhoOwe} empty="Nobody owes you right now.">
            {(rows) => (rows.length === 0 ? null : <WhoOwesTable rows={rows} currency={currency} />)}
          </WidgetBody>
        </SnapshotWidget>

        <SnapshotWidget
          title="Recent transactions"
          href="/sales/invoices"
          className="snapshot-fade-in lg:col-span-2 xl:col-span-3"
        >
          <WidgetBody result={board.recentTransactions} empty="No recent sales activity.">
            {(rows) =>
              rows.length === 0 ? null : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 font-semibold">Date</th>
                        <th className="pb-2 font-semibold">Type</th>
                        <th className="pb-2 font-semibold">Party</th>
                        <th className="pb-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.kind}-${row.id}`} className="border-b border-border/60">
                          <td className="py-1.5 tabular text-muted-foreground">{row.date}</td>
                          <td className="py-1.5">
                            <Link href={row.href} className="hover:underline">
                              {row.kind} {row.number}
                            </Link>
                          </td>
                          <td className="max-w-[14rem] truncate py-1.5">{row.party}</td>
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
          </WidgetBody>
        </SnapshotWidget>
      </div>
    </div>
  )
}

function ReminderCard({
  tone,
  label,
  amount,
  href,
  hint,
}: {
  tone: 'danger' | 'warn' | 'neutral'
  label: string
  amount: string
  href: string
  hint?: string
}) {
  return (
    <li>
      <Link
        href={href}
        className={
          tone === 'danger'
            ? 'block rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 transition hover:bg-destructive/10'
            : tone === 'warn'
              ? 'block rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 transition hover:bg-amber-500/10'
              : 'block rounded-xl border px-3 py-2.5 transition hover:bg-muted/50'
        }
      >
        <p
          className={
            tone === 'danger'
              ? 'text-xs font-semibold uppercase tracking-wide text-destructive'
              : 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'
          }
        >
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold tabular">{amount}</p>
        {hint ? <p className="mt-1 text-[0.7rem] text-muted-foreground">{hint}</p> : null}
      </Link>
    </li>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow"
    >
      {label}
    </Link>
  )
}
