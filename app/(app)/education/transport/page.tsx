import type { Metadata } from 'next'
import Link from 'next/link'

import { saveTransportRouteAction } from '@/app/(app)/education/ops-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Transport' }

export default async function EducationTransportPage() {
  const ctx = await requireOrgContext('invoice:read')
  const routes = await ops.listTransportRoutes(ctx)

  return (
    <>
      <PageHeader
        title="Transport"
        description="Bus and van routes — assign enrolled students to a route and stop."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />
      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={saveTransportRouteAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Route name
              <Input name="name" required className="mt-1 w-56" placeholder="North route" />
            </label>
            <label className="text-sm">
              Vehicle note
              <Input name="vehicleNote" className="mt-1 w-56" placeholder="Bus 2 · plate…" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Add route
            </button>
          </form>
        </CardContent>
      </Card>
      {routes.length === 0 ? (
        <EmptyState title="No routes" description="Add the first transport route." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Riders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/education/transport/${row.id}`} className="underline underline-offset-4">
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.vehicleNote ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{row._count.riders}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
