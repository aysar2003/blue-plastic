import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { RunPackButton } from '@/app/(app)/reports/packs/run-pack-button'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as reportPackService from '@/server/services/report-pack.service'

export const metadata: Metadata = { title: 'Report pack' }

export default async function ReportPackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext('report:read')
  const pack = await reportPackService.get(ctx, id).catch(() => null)
  if (!pack) notFound()
  const canRun = ctx.permissions.has('report:export')

  return (
    <>
      <PageHeader
        title={pack.name}
        description={pack.description ?? 'Scheduled report pack'}
        actions={
          <>
            <Link href="/reports/packs" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All packs
            </Link>
            {canRun ? <RunPackButton packId={pack.id} /> : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{pack.cadence}</Badge>
        {!pack.isActive ? <Badge variant="outline">Paused</Badge> : null}
        {pack.emailTo ? <span>Email → {pack.emailTo}</span> : null}
        {pack.lastRunAt ? <span>Last run {formatDateTime(pack.lastRunAt)}</span> : null}
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">Reports</p>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {pack.reportKeys.map((key) => (
              <li key={key}>
                <Link href={`/reports/${key}`} className="text-primary hover:underline">
                  {key}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold">Runs</h2>
      {pack.runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet. Build the pack to download a combined CSV.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28 text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pack.runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{formatDateTime(run.ranAt)}</TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {formatDate(run.fromDate)} → {formatDate(run.toDate)}
                    </TableCell>
                    <TableCell>{run.status}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/api/reports/packs/runs/${run.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        CSV
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}
