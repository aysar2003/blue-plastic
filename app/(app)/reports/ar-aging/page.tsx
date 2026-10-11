import type { Metadata } from 'next'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { AgingExplorer } from '@/components/reports/aging-explorer'
import { Card } from '@/components/ui/card'
import { AGING_COLORS, readAgingBucket } from '@/lib/aging'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { readSettings } from '../params'
import { ReportControls } from '../report-controls'
import { AGING_BUCKETS, BUCKET_LABELS, aging } from '@/server/services/receivables.service'

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
  const activeBucket = readAgingBucket(params.bucket)

  const report = await aging(ctx, asOf)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="A/R Aging Summary"
        description={`Outstanding invoices as at ${formatDate(asOf)}, bucketed by how long they have been due.`}
        actions={
          <PrintButton
            paper="A/R aging"
            defaultSubject={`A/R Aging — ${ctx.organization.name}`}
            defaultBody={`A/R Aging Summary\n${ctx.organization.name}\nAs at ${formatDate(asOf)}`}
          />
        }
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

      <AgingExplorer
        caption="How long the money owed to you has been waiting"
        currency={currency}
        storageKey="bp-ar-aging"
        path="/reports/ar-aging"
        params={params}
        activeBucket={activeBucket}
        rowNoun="customer"
        segments={AGING_BUCKETS.map((bucket) => ({
          id: bucket,
          label: BUCKET_LABELS[bucket],
          amount: report.totals[bucket].toString(),
          color: AGING_COLORS[bucket],
          count: report.rows.filter((row) => !row.buckets[bucket].isZero()).length,
        }))}
        columns={[
          { id: 'name', label: 'Customer', defaultWidth: 220 },
          ...AGING_BUCKETS.map((bucket) => ({
            id: bucket,
            label: BUCKET_LABELS[bucket],
            kind: 'money' as const,
            total: true,
            defaultWidth: 128,
          })),
          { id: 'total', label: 'Total', kind: 'money' as const, total: true, defaultWidth: 128 },
        ]}
        rows={report.rows.map((row) => ({
          id: row.customerId,
          cells: {
            name: { value: row.customerName, href: customerStatement(row.customerId) },
            ...Object.fromEntries(
              AGING_BUCKETS.map((bucket) => [
                bucket,
                {
                  value: row.buckets[bucket].isZero() ? null : row.buckets[bucket].toString(),
                  href: customerStatement(
                    row.customerId,
                    bucket === 'current' || bucket === 'unapplied' ? 'open' : 'overdue',
                  ),
                },
              ]),
            ),
            total: { value: row.total.toString(), href: customerStatement(row.customerId, 'open') },
          },
        }))}
      />

      <Card className="mt-4 overflow-hidden p-0">
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
