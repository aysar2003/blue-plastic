import Link from 'next/link'

import { CustomerPicker } from '@/components/snapshots/customer-picker'
import { HBarList, SparkArea } from '@/components/snapshots/snapshot-charts'
import { SnapshotWidget, WidgetBody } from '@/components/snapshots/widget-frame'
import { formatMoney } from '@/lib/money'
import type { CustomerBoard } from '@/server/services/company-snapshot.service'

export function CustomerTab({
  board,
  currency,
  selectedId,
}: {
  board: CustomerBoard
  currency: string
  selectedId: string | null
}) {
  const pickerRows = board.picker.ok ? board.picker.data : []

  return (
    <div className="space-y-4">
      <div className="snapshot-fade-in rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
        {board.picker.ok ? (
          <CustomerPicker customers={pickerRows} selectedId={selectedId} />
        ) : (
          <p role="alert" className="text-sm text-destructive">
            {board.picker.error}
          </p>
        )}
      </div>

      {!selectedId ? (
        <p className="snapshot-fade-in rounded-2xl border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          Choose a customer to open their live 360° snapshot — balance, pay speed, invoices,
          payments, and sales history.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <SnapshotWidget
            title="Customer profile"
            href={selectedId ? `/customers?id=${selectedId}` : undefined}
            className="snapshot-fade-in"
          >
            <WidgetBody result={board.profile} empty="Customer not found in this company.">
              {(profile) =>
                !profile ? null : (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Name</dt>
                      <dd className="text-base font-semibold">{profile.name}</dd>
                    </div>
                    <Stat label="Customer for" value={profile.yearsLabel} />
                    <Stat label="Avg days to pay" value={profile.averageDaysToPay ?? '—'} />
                    <Stat label="Open balance" value={formatMoney(profile.openBalance, currency)} />
                    <Stat
                      label="Credit limit"
                      value={
                        profile.creditLimit != null
                          ? formatMoney(profile.creditLimit, currency)
                          : '—'
                      }
                    />
                    <Stat
                      label="Sales this year"
                      value={formatMoney(profile.salesThisYear, currency)}
                    />
                    <Stat
                      label="Sales last year"
                      value={formatMoney(profile.salesLastYear, currency)}
                    />
                    <Stat label="Invoices" value={String(profile.invoiceCount)} />
                    <Stat label="Payments" value={String(profile.paymentCount)} />
                    <div className="col-span-2 flex flex-wrap gap-3 pt-1">
                      <Link
                        href={`/reports/statements/customer?customerId=${profile.id}&period=all-dates&view=summary`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Full statement
                      </Link>
                      <Link
                        href={`/payments/new?customerId=${profile.id}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Receive payment
                      </Link>
                      <Link
                        href={`/sales/invoices/new?customerId=${profile.id}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        New invoice
                      </Link>
                    </div>
                  </dl>
                )
              }
            </WidgetBody>
          </SnapshotWidget>

          <SnapshotWidget
            title="Recent invoices"
            href="/sales/invoices"
            className="snapshot-fade-in xl:col-span-2"
          >
            <WidgetBody result={board.recentInvoices} empty="No invoices for this customer.">
              {(rows) =>
                rows.length === 0 ? null : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2 font-semibold">Date</th>
                          <th className="pb-2 font-semibold">Due</th>
                          <th className="pb-2 font-semibold">Number</th>
                          <th className="pb-2 text-right font-semibold">Amount</th>
                          <th className="pb-2 text-right font-semibold">Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} className="border-b border-border/60">
                            <td className="py-1.5 tabular text-muted-foreground">{row.date}</td>
                            <td className="py-1.5 tabular text-muted-foreground">
                              {row.dueDate ?? '—'}
                            </td>
                            <td className="py-1.5">
                              <Link href={row.href} className="hover:underline">
                                {row.number}
                              </Link>
                            </td>
                            <td className="py-1.5 text-right tabular">
                              {formatMoney(row.amount, currency)}
                            </td>
                            <td className="py-1.5 text-right tabular font-medium">
                              {formatMoney(row.openBalance, currency)}
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

          <SnapshotWidget title="Recent payments" href="/payments" className="snapshot-fade-in">
            <WidgetBody result={board.recentPayments} empty="No payments for this customer.">
              {(rows) =>
                rows.length === 0 ? null : (
                  <ul className="space-y-1.5 text-sm">
                    {rows.map((row) => (
                      <li key={row.id} className="flex items-baseline justify-between gap-2">
                        <Link href={row.href} className="min-w-0 truncate hover:underline">
                          <span className="tabular text-muted-foreground">{row.date}</span>{' '}
                          {row.number}
                        </Link>
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
            title="Sales history"
            caption="Last 12 months"
            className="snapshot-fade-in"
          >
            <WidgetBody result={board.salesHistory}>
              {(rows) =>
                rows.every((row) => Number(row.amount) === 0) ? null : (
                  <SparkArea rows={rows} currency={currency} />
                )
              }
            </WidgetBody>
          </SnapshotWidget>

          <SnapshotWidget
            title="Best-selling items"
            caption="Last 12 months with this customer"
            className="snapshot-fade-in"
          >
            <WidgetBody result={board.bestItems}>
              {(rows) => (rows.length === 0 ? null : <HBarList rows={rows} currency={currency} />)}
            </WidgetBody>
          </SnapshotWidget>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
  )
}
