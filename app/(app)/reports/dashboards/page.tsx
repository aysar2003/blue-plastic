import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as dashboardBoard from '@/server/services/dashboard-board.service'

export const metadata: Metadata = { title: 'Dashboards' }

export default async function DashboardsPage() {
  const ctx = await requireOrgContext('report:read')
  const boards = await dashboardBoard.list(ctx)
  const canEdit = ctx.permissions.has('report:export')

  return (
    <>
      <PageHeader
        title="Dashboards"
        description="SME boards from existing KPIs and reports — not a data warehouse."
        actions={
          canEdit ? (
            <Link href="/reports/dashboards/new" className={buttonVariants({ size: 'sm' })}>
              New dashboard
            </Link>
          ) : null
        }
      />

      {boards.length === 0 ? (
        <EmptyState
          title="No dashboards yet"
          description={
            canEdit
              ? 'Create a board of KPI tiles, report links, and spark metrics from the books you already have.'
              : 'Ask someone with report export permission to set dashboards up.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tiles</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {boards.map((board) => (
                  <TableRow key={board.id}>
                    <TableCell>
                      <Link
                        href={`/reports/dashboards/${board.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {board.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{board._count.tiles}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/reports/dashboards/${board.id}`}
                        className={buttonVariants({ size: 'sm', variant: 'ghost' })}
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
