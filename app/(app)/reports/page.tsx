import type { Metadata } from 'next'
import Link from 'next/link'

import { GiveFeedback } from '@/components/data/give-feedback'
import { reportSectionsFor } from '@/components/layout/report-apps'
import { CreateReportMenu } from '@/components/reports/create-report-menu'
import { FavouriteReports } from '@/components/reports/favourite-reports'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { ReportsQuickBoards } from '@/components/reports/reports-quick-boards'
import { StandardReportSections } from '@/components/reports/standard-report-sections'
import { statementPicture } from '@/components/reports/figure-chart'
import { canViewBusinessOverview } from '@/lib/business-overview-access'
import { formatDate, today } from '@/lib/date'
import { toMoneyString } from '@/lib/money'
import { resolvePeriod } from '@/lib/report-periods'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss } from '@/server/reports/statements'
import { canViewGroupReports } from '@/server/services/company-group.service'

export const metadata: Metadata = { title: 'Reports' }

/**
 * Modern standard Reports Centre: quick boards, favourites, then the catalogue.
 */
export default async function ReportsIndexPage() {
  const ctx = await requireOrgContext('report:read')
  const showOverview = canViewBusinessOverview(ctx.permissions)
  const now = today(ctx.organization.timeZone)
  const month = resolvePeriod('this-month', now, {
    month: ctx.organization.fiscalYearStartMonth,
    day: ctx.organization.fiscalYearStartDay,
  })
  const [showGroupReports, report] = await Promise.all([
    canViewGroupReports(ctx),
    profitAndLoss(ctx.orgId, { ...month, basis: 'accrual' }),
  ])
  const picture = statementPicture(report.sections, 'total')

  return (
    <div className="relative pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_60%_at_0%_0%,color-mix(in_oklab,#0E7490_10%,transparent),transparent_50%)]"
      />

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {ctx.organization.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Standard report centre · {formatDate(month.from)} → {formatDate(month.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GiveFeedback />
          <CreateReportMenu permissions={[...ctx.permissions]} />
        </div>
      </header>

      {showGroupReports ? (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          {[
            { href: '/reports/companies', label: ctx.isSystemOwner ? 'All companies' : 'Company group' },
            { href: '/reports/group-close', label: 'Group close' },
            { href: '/reports/intercompany', label: 'IC matches' },
            { href: '/reports/consolidation', label: 'Consolidation' },
            { href: '/reports/portfolio', label: 'Portfolio' },
            { href: '/reports/franchise', label: 'Franchise' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <ReportCentreTabs active="standard" />

      <ReportsQuickBoards
        showOverview={showOverview}
        currency={ctx.organization.baseCurrency}
        monthPulse={{
          income: toMoneyString(picture.income, 2),
          expenses: toMoneyString(picture.expenses, 2),
          net: toMoneyString(picture.net, 2),
        }}
      />

      <FavouriteReports />

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">All standard reports</h2>
          <p className="text-sm text-muted-foreground">Grouped by question — search or open a section.</p>
        </div>
      </div>

      <StandardReportSections
        sections={reportSectionsFor(ctx.permissions, { enableTax: ctx.features.enableTax })}
      />
    </div>
  )
}
