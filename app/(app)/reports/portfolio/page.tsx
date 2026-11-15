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
        description="Subsidiaries with ownership %, rolled net income, and NCI."
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