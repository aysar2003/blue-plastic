import type { Metadata } from 'next'
import Link from 'next/link'

import { linkLotSeasonAction } from '@/app/(app)/agriculture/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as agriculture from '@/server/services/agriculture.service'

export const metadata: Metadata = { title: 'Agriculture' }

export default async function AgriculturePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; origin?: string; project?: string; class?: string }>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const [report, projects, classes] = await Promise.all([
    agriculture.seasonalCostReport(ctx, {
      storeId: query.store || null,
      originQuery: query.origin || null,
      projectId: query.project || null,
      trackingCategoryId: query.class || null,
    }),
    db.project.findMany({
      where: { orgId: ctx.orgId },
      select: { id: true, number: true, name: true },
      orderBy: { number: 'asc' },
      take: 200,
    }),
    db.trackingCategory.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  const currency = ctx.organization.baseCurrency
  const canLink = ctx.permissions.has('item:update')

  return (
    <>
      <PageHeader
        title="Seasonal lot cost"
        description="Lot qty × average cost on farm stores. Season = project or class filter on harvest lots."
        actions={
          <Link href="/stores" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Stores
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <label className="text-xs">
          Farm store
          <NativeSelect name="store" defaultValue={query.store ?? ''} className="mt-1 w-48">
            <option value="">All farm stores</option>
            {report.farmStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="text-xs">
          Origin contains
          <Input
            name="origin"
            defaultValue={query.origin ?? ''}
            placeholder="Field / region"
            className="mt-1 w-40"
          />
        </label>
        <label className="text-xs">
          Season project
          <NativeSelect name="project" defaultValue={query.project ?? ''} className="mt-1 w-48">
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.number} {project.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="text-xs">
          Season class
          <NativeSelect name="class" defaultValue={query.class ?? ''} className="mt-1 w-48">
            <option value="">All classes</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          Filter
        </button>
      </form>

      <p className="mb-4 text-sm text-muted-foreground">
        {report.farmStoreCount} farm store{report.farmStoreCount === 1 ? '' : 's'} · total{' '}
        {formatMoney(report.totalCost, currency)}
      </p>

      {report.rows.length === 0 ? (
        <EmptyState
          title="No seasonal stock"
          description="Enable lots on products, receive into farm stores, and optional origin labels on lots."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead>Farm</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Extended cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={`${row.lotId}-${row.storeId}`}>
                    <TableCell>
                      {row.itemName} · {row.lotNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.originLabel ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.projectId || row.trackingCategoryId ? 'Linked' : '—'}
                    </TableCell>
                    <TableCell>{row.storeName}</TableCell>
                    <TableCell className="text-right tabular">{row.quantity}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(
                        (Number(row.quantity) * Number(row.averageCost)).toFixed(2),
                        currency,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {canLink && report.rows.length > 0 ? (
        <Card className="mt-6">
          <CardContent className="p-4">
            <form action={linkLotSeasonAction} className="flex flex-wrap items-end gap-2">
              <label className="text-xs">
                Lot
                <NativeSelect name="lotId" required className="mt-1 w-56">
                  {report.rows.map((row) => (
                    <option key={row.lotId} value={row.lotId}>
                      {row.itemName} · {row.lotNumber}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="text-xs">
                Project
                <NativeSelect name="projectId" className="mt-1 w-48">
                  <option value="">None</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.number} {project.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="text-xs">
                Class
                <NativeSelect name="trackingCategoryId" className="mt-1 w-48">
                  <option value="">None</option>
                  {classes.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Link season
              </button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}