import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as reportPackService from '@/server/services/report-pack.service'

export const metadata: Metadata = { title: 'Report packs' }

export default async function ReportPacksPage() {
  const ctx = await requireOrgContext('report:read')
  const packs = await reportPackService.list(ctx)
  const canEdit = ctx.permissions.has('report:export')

  return (
    <>
      <PageHeader
        title="Report packs"
        description="Bundle standard reports on a schedule. Run now to download a combined CSV, or set daily / weekly / monthly email when SMTP is configured."
        actions={
          canEdit ? (
            <Link href="/reports/packs/new" className={buttonVariants({ size: 'sm' })}>
              New pack
            </Link>
          ) : null
        }
      />

      {packs.length === 0 ? (
        <EmptyState
          title="No report packs yet"
          description={
            canEdit
              ? 'Create a pack of Profit & Loss, Balance Sheet, and ageing — then run it or schedule it.'
              : 'Ask someone with report export permission to set packs up.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Reports</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((pack) => (
                  <TableRow key={pack.id}>
                    <TableCell>
                      <Link
                        href={`/reports/packs/${pack.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {pack.name}
                      </Link>
                      {!pack.isActive ? (
                        <Badge variant="secondary" className="ml-2">
                          Paused
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pack.reportKeys.length} report{pack.reportKeys.length === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{pack.cadence}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {pack.lastRunAt ? formatDateTime(pack.lastRunAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/reports/packs/${pack.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        Open
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
