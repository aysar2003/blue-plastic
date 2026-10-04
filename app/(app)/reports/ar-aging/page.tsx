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
import { ShareBar } from '@/components/reports/figure-chart'
import { AGING_BUCKETS, BUCKET_LABELS, aging, type AgingBucket } from '@/server/services/receivables.service'

const AGING_COLORS: Record<AgingBucket, string> = {
  unapplied: '#64748B',
  current: '#0F766E',
  d1_30: '#0369A1',
  d31_60: '#B45309',
  d61_90: '#C2410C',
  d90_plus: '#BE123C',
}

const SORTABLE = ['name', 'total', ...AGING_BUCKETS] as const

export const metadata: Metadata = { title: 'A/R Aging Summary' }

/**
 * Who owes what, and for how long.
 *
 * Every figure comes from the same rows as the receivables control account, so
 * the two cannot disagree — and the report says so at the bottom rather than
 * leaving it to be assumed.
 */
export default async function AgingPage({
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
    if (sort.sort === 'name') return direction * a.customerName.localeCompare(b.customerName)
    if (sort.sort === 'total') return direction * a.total.comparedTo(b.total)
    const bucket = sort.sort as (typeof AGING_BUCKETS)[number]
    return direction * a.buckets[bucket].comparedTo(b.buckets[bucket])
  })

  return (
    <>
      <PageHeader
        title="A/R Aging Summary"
        description={`Outstanding invoices as at ${formatDate(asOf)}, bucketed by how long they have been due.`}
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'asOf', exportAs: 'ar-aging' }}
      />

      {report.grandTotal.isZero() ? null : (
        <div className="mb-4">
          <ShareBar
            caption="How long the money owed to you has been waiting"
            currency={currency}
            segments={AGING_BUCKETS.map((bucket) => ({
              label: BUCKET_LABELS[bucket],
              value: report.totals[bucket],
              color: AGING_COLORS[bucket],
            }))}
          />
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="name" label="Customer" state={sort} basePath="/reports/ar-aging" params={linkParams} />
              {AGING_BUCKETS.map((bucket) => (
                <SortableHeader
                  key={bucket}
                  column={bucket}
                  label={BUCKET_LABELS[bucket]}
                  state={sort}
                  basePath="/reports/ar-aging"
                  params={linkParams}
                  className="w-32"
                  numeric
                  defaultDirection="desc"
                />
              ))}
              <SortableHeader column="total" label="Total" state={sort} basePath="/reports/ar-aging" params={linkParams} className="w-32" numeric defaultDirection="desc" />
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
                <ClickableRow key={row.customerId} href={customerStatement(row.customerId)}>
                  <TableCell>
                    <Link
                      href={customerStatement(row.customerId)}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.customerName}
                    </Link>
                  </TableCell>
                  {AGING_BUCKETS.map((bucket) => (
                    <TableCell key={bucket} className="numeric tabular">
                      {row.buckets[bucket].isZero() ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Link
                          href={customerStatement(row.customerId, bucket === 'current' || bucket === 'unapplied' ? 'open' : 'overdue')}
                          className="underline-offset-4 hover:underline"
                        >
                          {formatMoney(row.buckets[bucket], currency)}
                        </Link>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="numeric tabular font-medium">
                    <Link href={customerStatement(row.customerId, 'open')} className="underline-offset-4 hover:underline">
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
                Agrees with the receivables control account at{' '}
                <span className="tabular">{formatMoney(report.controlBalance, currency)}</span>. The aging
                report and the ledger are the same rows read two ways.
              </span>
            </>
          ) : (
            <>
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                This report totals{' '}
                <strong className="tabular">{formatMoney(report.grandTotal, currency)}</strong> but the
                receivables control account holds{' '}
                <strong className="tabular">{formatMoney(report.controlBalance, currency)}</strong>. That
                should be impossible — investigate before relying on either figure.
              </span>
            </>
          )}
        </div>
      </Card>
    </>
  )
}

/** Aging opens the statement of that customer, with each invoice written out. */
function customerStatement(customerId: string, status: 'open' | 'overdue' = 'open') {
  const params = new URLSearchParams({
    customerId,
    view: 'detail',
    status,
    period: 'all-dates',
  })
  return `/reports/statements/customer?${params.toString()}`
}
