import type { Metadata } from 'next'
import Link from 'next/link'

import { saveCampusAction } from '@/app/(app)/education/ops-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Campuses' }

export default async function EducationCampusesPage() {
  const ctx = await requireOrgContext('invoice:read')
  const campuses = await ops.listCampuses(ctx, { includeInactive: true })

  return (
    <>
      <PageHeader
        title="Campuses"
        description="School sites and boarding/transport fee linkage."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={saveCampusAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Name
              <Input name="name" required className="mt-1 w-56" placeholder="Main campus" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="isActive" value="1" />
              <span className="text-muted-foreground">Active by default</span>
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Save campus
            </button>
          </form>
        </CardContent>
      </Card>

      {campuses.length === 0 ? (
        <EmptyState title="No campuses" description="Add the first campus above." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campuses.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.isActive ? 'Active' : 'Inactive'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}