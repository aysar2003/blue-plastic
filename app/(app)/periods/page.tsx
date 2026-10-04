import type { Metadata } from 'next'

import Link from 'next/link'

import { CloseChecklistCard } from '@/components/periods/close-checklist'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PERIOD_STATUS_LABELS } from '@/lib/accounting-labels'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as closeService from '@/server/services/close.service'
import * as periodService from '@/server/services/period.service'
import { MonthPanel, monthLabel } from './month-panel'
import { OpenMonthButton, PeriodToggle } from './period-actions'
import { CloseYearButton, ReopenYearButton } from './year-end-actions'

export const metadata: Metadata = { title: 'Accounting periods' }

export default async function PeriodsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('period:read')
  const params = await searchParams
  const query = parseListQuery(params)
  const openedId = typeof params.month === 'string' ? params.month : undefined
  const source = typeof params.source === 'string' ? params.source : undefined

  // Periods are created on demand by posting; this makes sure the page has
  // something to show before anything has been posted.
  await periodService.ensureCurrentFiscalYear(ctx)
  const years = await periodService.listFiscalYears(ctx)

  const canClose = ctx.permissions.has('period:close')
  const canReopen = ctx.permissions.has('period:reopen')

  // The checklist is run for the period that is actually next in line, because
  // periods close in order and any other one is not a decision the user can make.
  const next = await closeService.nextPeriodToClose(ctx)
  const checklist = next ? await closeService.closeChecklist(ctx, next) : null

  // The earliest year that has finished and has not been closed. Years close in
  // order, so no other one can be next.
  const now = today(ctx.organization.timeZone)
  const closable = [...years]
    .reverse()
    .find((year) => year.status !== 'LOCKED' && toCalendarDate(year.endDate) < now)
  const closingPreview =
    closable && canClose ? await closeService.previewClose(ctx, closable.id).catch(() => null) : null

  return (
    <>
      <PageHeader
        title="Accounting periods"
        description="Closing a period stops anything else being posted into it. Periods close in order and reopen in reverse, so a closed month cannot change through an open earlier one."
      />

      <Card className="mb-6 p-4">
        <p className="text-sm font-medium">Adjust inventory before the year is closed</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Count what is on the shelf, record damage or a higher cost, then read whether each item’s cost rose or fell.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/inventory/adjustments/new" className="text-primary underline-offset-4 hover:underline">
            Year-end count
          </Link>
          <Link href="/inventory/adjustments/new?mode=damage" className="text-primary underline-offset-4 hover:underline">
            Damage or loss
          </Link>
          <Link href="/reports/inventory-cost-change" className="text-primary underline-offset-4 hover:underline">
            Cost up or down
          </Link>
        </div>
      </Card>

      {checklist && next ? (
        <div className="mb-6">
          <CloseChecklistCard
            checklist={checklist}
            label={next.label}
            action={
              closingPreview && closable ? (
                <div className="border-t pt-3">
                  <CloseYearButton
                    fiscalYearId={closable.id}
                    year={closable.year}
                    netIncome={formatMoney(closingPreview.netIncome, ctx.organization.baseCurrency)}
                    blocked={checklist.blocked}
                  />
                </div>
              ) : null
            }
          />
        </div>
      ) : closingPreview && closable ? (
        // Every month is closed, so there is no checklist to show — but the year
        // itself still has to be swept to Retained Earnings.
        <Card className="mb-6 p-4">
          <CloseYearButton
            fiscalYearId={closable.id}
            year={closable.year}
            netIncome={formatMoney(closingPreview.netIncome, ctx.organization.baseCurrency)}
            blocked={false}
          />
        </Card>
      ) : null}

      <div className="space-y-6">
        {years.map((year) => (
          <Card key={year.id} className="overflow-hidden p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/50 px-3 py-2">
              <h2 className="text-sm font-semibold">
                Fiscal year {year.year}
                <span className="ml-2 font-normal text-muted-foreground">
                  {formatDate(toCalendarDate(year.startDate))} — {formatDate(toCalendarDate(year.endDate))}
                </span>
              </h2>
              <Badge variant={year.status === 'OPEN' ? 'success' : 'secondary'}>
                {year.status === 'OPEN' ? 'Year open' : PERIOD_STATUS_LABELS[year.status]}
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-[#d5dde6] hover:bg-[#d5dde6]">
                  <TableHead className="w-48">Period</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="numeric w-24">Entries</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Open</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {year.periods.map((period, index) => {
                  const label = monthLabel(period.periodNumber, period.startDate)
                  const openHref = `/periods?month=${period.id}#opened`
                  const selected = period.id === openedId

                  return (
                    <TableRow
                      key={period.id}
                      className={
                        selected
                          ? 'bg-[#d5dde6] hover:bg-[#d5dde6]'
                          : index % 2 === 1
                            ? 'bg-[#c5dff3] hover:bg-[#c5dff3]'
                            : 'bg-white hover:bg-white'
                      }
                    >
                      <TableCell className="font-medium">
                        <Link href={openHref} className="underline-offset-4 hover:underline">
                          {label}
                        </Link>
                        {period.periodNumber === 0 ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            period 0
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                        {formatDate(toCalendarDate(period.startDate))} —{' '}
                        {formatDate(toCalendarDate(period.endDate))}
                      </TableCell>
                      <TableCell className="numeric tabular">{period.journalCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            period.status === 'OPEN'
                              ? 'success'
                              : period.status === 'CLOSED'
                                ? 'warning'
                                : 'secondary'
                          }
                        >
                          {PERIOD_STATUS_LABELS[period.status].toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <OpenMonthButton
                          href={openHref}
                          periodId={period.id}
                          status={period.status}
                          label={label}
                          canReopen={canReopen}
                        />
                      </TableCell>
                      <TableCell>
                        <PeriodToggle
                          periodId={period.id}
                          status={period.status}
                          label={label}
                          canClose={canClose}
                          canReopen={canReopen}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {year.status === 'LOCKED' && canReopen ? (
              <div className="border-t p-3">
                <ReopenYearButton fiscalYearId={year.id} year={year.year} />
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {openedId ? (
        <div className="mt-8 border-t pt-6">
          <MonthPanel
            periodId={openedId}
            query={query}
            source={source}
            basePath="/periods"
            linkParams={{ month: openedId }}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Choose a month and press Open. Its entries and reports appear below this list.
        </p>
      )}
    </>
  )
}
