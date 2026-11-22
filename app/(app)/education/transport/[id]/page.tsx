import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { addRiderAction } from '@/app/(app)/education/ops-actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Transport route' }

export default async function EducationTransportRoutePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const { id } = await params
  let route
  try {
    route = await ops.getTransportRoute(ctx, id)
  } catch {
    notFound()
  }
  const enrollments = await ops.activeEnrollmentsOptions(ctx)

  return (
    <>
      <PageHeader
        title={route.name}
        description={route.vehicleNote || 'Transport route'}
        actions={
          <Link href="/education/transport" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            All routes
          </Link>
        }
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add rider</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addRiderAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="routeId" value={id} />
            <label className="text-sm">
              Student
              <select
                name="enrollmentId"
                required
                className="mt-1 block h-9 w-72 rounded-md border border-input bg-background px-2 text-sm"
              >
                {enrollments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Stop
              <Input name="stopName" className="mt-1 w-48" placeholder="Km4 gate" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Add
            </button>
          </form>
        </CardContent>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Stop</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {route.riders.map((rider) => (
            <TableRow key={rider.id}>
              <TableCell className="font-medium">{rider.enrollment.customer.displayName}</TableCell>
              <TableCell>{rider.stopName ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
