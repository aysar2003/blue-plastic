import type { Metadata } from 'next'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { InteractiveGrid } from '@/components/data/interactive-grid'
import { PageHeader } from '@/components/data/page-header'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { readSettings } from '../params'
import { ReportControls } from '../report-controls'
import { AGING_BUCKETS, BUCKET_LABELS, aging } from '@/server/services/payables.service'

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

  return (
    <>
      <PageHeader
        className="print:hidden"
        title="A/P Aging Summary"
        description={`Unpaid bills as at ${formatDate(asOf)}, bucketed by how long they have been due.`}
        actions={
          <PrintButton
            paper="A/P aging"
            defaultSubject={`A/P Aging — ${ctx.organization.name}`}
            defaultBody={`A/P Aging Summary\n${ctx.organization.name}\nAs at ${formatDate(asOf)}`}
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
        controls={{ mode: 'asOf', exportAs: 'ap-aging' }}
      />

      {report.rows.length === 0 ? (
        <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing outstanding.
        </div>
      ) : (
        <InteractiveGrid
          storageKey="bp-ap-aging"
          currency={currency}
          customizable
          initialSort={{ id: 'total', dir: 'desc' }}
          columns={[
            { id: 'name', label: 'Vendor', defaultWidth: 220 },
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
            id: row.vendorId,
            cells: {
              name: { value: row.vendorName, href: vendorStatement(row.vendorId) },
              ...Object.fromEntries(
                AGING_BUCKETS.map((bucket) => [
                  bucket,
                  {
                    value: row.buckets[bucket].isZero() ? null : row.buckets[bucket].toString(),
                    href: vendorStatement(row.vendorId),
                  },
                ]),
              ),
              total: { value: row.total.toString(), href: vendorStatement(row.vendorId) },
            },
          }))}
        />
      )}

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
