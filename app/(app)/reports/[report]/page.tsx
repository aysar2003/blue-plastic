import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { ReportTable } from '@/components/reports/report-table'
import { formatDate } from '@/lib/date'
import { PERIOD_LABELS } from '@/lib/report-periods'
import { requireOrgContext } from '@/server/auth/context'
import { tableReport, TABLE_REPORTS } from '@/server/reports/catalogue'
import { readSettings, type SearchParams } from '../params'
import { ReportControls } from '../report-controls'

/**
 * One page for every table report.
 *
 * The three financial statements keep their own pages, because each has a shape
 * of its own. Everything else is a table over a period, so it is rendered here
 * from the catalogue — which means the period control, the export link and the
 * empty state are the same on all of them, and stay the same when one is added.
 *
 * Static segments win over this dynamic one in Next's router, so
 * `/reports/profit-loss` still reaches its own page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ report: string }>
}): Promise<Metadata> {
  return { title: tableReport((await params).report)?.title ?? 'Report' }
}

export function generateStaticParams() {
  return TABLE_REPORTS.map((report) => ({ report: report.key }))
}

export default async function TableReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>
  searchParams: Promise<SearchParams>
}) {
  const definition = tableReport((await params).report)
  if (!definition) notFound()

  const ctx = await requireOrgContext('report:read')
  const settings = readSettings(await searchParams, ctx.organization)
  const table = await definition.build({ ctx, range: settings.range, asOf: settings.asOf })

  return (
    <>
      <PageHeader
        title={definition.title}
        description={
          definition.mode === 'asOf'
            ? `${definition.description} As at ${formatDate(settings.asOf)}.`
            : `${definition.description} ${formatDate(settings.range.from)} to ${formatDate(
                settings.range.to,
              )}${settings.period === 'custom' ? '' : ` — ${PERIOD_LABELS[settings.period]}`}.`
        }
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: definition.mode, exportAs: definition.key }}
      />

      <ReportTable
        table={table}
        currency={ctx.organization.baseCurrency}
        timeZone={ctx.organization.timeZone}
        storageKey={`bp-report-${definition.key}`}
      />
    </>
  )
}
