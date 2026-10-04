import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { ClickableRow } from '@/components/reports/clickable-row'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { readSettings } from '../params'
import { ReportControls } from '../report-controls'
import { AGING_BUCKETS, BUCKET_LABELS, aging } from '@/server/services/payables.service'

const SORTABLE = ['name', 'total', ...AGING_BUCKETS] as const

export const metadata: Metadata = { title: 'A/P Aging Summary' }

export default async function PayablesAgingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('report:read')
  const params = await searchParams
  // The same period control every other report has, so "as at the end of last
  // quarter" is one click rather than a date typed by hand.
  const settings = readSettings(params, ctx.organization, 'this-fiscal-year')
  const asOf = settings.asOf

  const report = await aging(ctx, asOf)
  const currency = ctx.organization.baseCurrency

  // "Who owes the most" and "who is furthest overdue" are the two questions this
  // report exists to answer, so every bucket is sortable, not only the total.
  const sort = readSort(params, SORTABLE, { sort: 'total', dir: 'desc' })
  const linkParams = { asOf, sort: sort.sort, dir: sort.dir }
  const direction = sort.dir === 'asc' ? 1 : -1
  const rows = [...report.rows].sort((a, b) => {
    if (sort.sort === 'name') return direction * a.vendorName.localeCompare(b.vendorName)
    if (sort.sort === 'total') return direction * a.total.comparedTo(b.total)
    const bucket = sort.sort as (typeof AGING_BUCKETS)[number]
    return direction * a.buckets[bucket].comparedTo(b.buckets[bucket])
  })

  return (
    <>
      <PageHeader
        title="A/P Aging Summary"
        description={`Unpaid bills as at ${formatDate(asOf)}, bucketed by how long they have been due.`}
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'asOf', exportAs: 'ap-aging' }}
      />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="name" label="Vendor" state={sort} basePath="/reports/ap-aging" params={linkParams} />
              {AGING_BUCKETS.map((bucket) => (
                <SortableHeader
                  key={bucket}
                  column={bucket}
                  label={BUCKET_LABELS[bucket]}
                  state={sort}
                  basePath="/reports/ap-aging"
                  params={linkParams}
                  className="w-32"
                  numeric
                  defaultDirection="desc"
                />
              ))}
              <SortableHeader column="total" label="Total" state={sort} basePath="/reports/ap-aging" params={linkParams} className="w-32" numeric defaultDirection="desc" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nothing outstanding.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <ClickableRow key={row.vendorId} href={vendorStatement(row.vendorId)}>
                  <TableCell>
                    <Link
                      href={vendorStatement(row.vendorId)}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.vendorName}
                    </Link>
                  </TableCell>
                  {AGING_BUCKETS.map((bucket) => (
                    <TableCell key={bucket} className="numeric tabular">
                      {row.buckets[bucket].isZero() ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Link href={vendorStatement(row.vendorId)} className="underline-offset-4 hover:underline">
                          {formatMoney(row.buckets[bucket], currency)}
                        </Link>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="numeric tabular font-medium">
                    <Link href={vendorStatement(row.vendorId)} className="underline-offset-4 hover:underline">
                      {formatMoney(row.total, currency)}
                    </Link>
                  </TableCell>
                </ClickableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              {AGING_BUCKETS.map((bucket) => (
                <TableCell key={bucket} className="numeric tabular font-semibold">
                  {formatMoney(report.totals[bucket], currency)}
                </TableCell>
              ))}
              <TableCell className="numeric tabular font-semibold">
                {formatMoney(report.grandTotal, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <div
          className={`flex items-start gap-2 border-t px-3 py-2.5 text-sm ${
            report.agrees ? 'text-success' : 'text-destructive'
          }`}
        >
          {report.agrees ? (
            <>
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
              <span>
                Agrees with the payables control account at{' '}
                <span className="tabular">{formatMoney(report.controlBalance, currency)}</span>.
              </span>
            </>
          ) : (
            <>
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                This report totals{' '}
                <strong className="tabular">{formatMoney(report.grandTotal, currency)}</strong> but the
                payables control account holds{' '}
                <strong className="tabular">{formatMoney(report.controlBalance, currency)}</strong>.
                Investigate before relying on either figure.
              </span>
            </>
          )}
        </div>
      </Card>
    </>
  )
}

/** Aging opens that vendor's statement, the next page of the same figure. */
function vendorStatement(vendorId: string) {
  return `/reports/statements/vendor?vendorId=${vendorId}&period=all-dates`
}
