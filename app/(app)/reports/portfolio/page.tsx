import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { portfolioReport } from '@/server/reports/portfolio'

export const metadata: Metadata = { title: 'Portfolio' }

export default async function PortfolioPage() {
  const ctx = await requireOrgContext('report:read')
  const report = await portfolioReport(ctx)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Holding portfolio"
        description="Group strip at ownership %: cash, AR, stock, and net income, with prior-year compare."
        actions={
          <>
            <Link href="/reports/consolidation" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Consolidation
            </Link>
            <a
              href="/api/reports/portfolio/export"
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              Export CSV
            </a>
          </>
        }
      />

      <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {report.kpis.map((kpi) => (
          <li key={kpi.key} className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(kpi.current, currency)}</p>
            {kpi.priorYear != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Prior year {formatMoney(kpi.priorYear, currency)}
                {kpi.change != null ? ` · Δ ${formatMoney(kpi.change, currency)}` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <Card className="mb-4 grid max-w-xl gap-1 p-4 text-sm">
        <p>
          Rolled net (group): <strong>{formatMoney(report.rollup.net, currency)}</strong>
        </p>
        <p className="text-muted-foreground">NCI total: {formatMoney(report.rollup.nci, currency)}</p>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subsidiary</TableHead>
            <TableHead className="text-right">Ownership %</TableHead>
            <TableHead className="text-right">Rolled NI</TableHead>
            <TableHead className="text-right">NCI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.subsidiaries.map((row) => (
            <TableRow key={row.orgId}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right">{row.ownershipPercent}</TableCell>
              <TableCell className="text-right">{formatMoney(row.netIncome, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.nci, currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}