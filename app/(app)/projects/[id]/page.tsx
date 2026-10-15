import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PencilIcon, PlusIcon } from 'lucide-react'
import type { ProjectStatus } from '@prisma/client'

import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { purchaseByType } from '@/lib/purchase-types'
import { byType as salesByType, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { PROJECT_STATUS_LABELS } from '@/lib/validation/project'
import { requireOrgContext } from '@/server/auth/context'
import * as projectService from '@/server/services/project.service'

import { ProjectStatusForm } from './status-form'

export const metadata: Metadata = { title: 'Project' }

function statusVariant(status: ProjectStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'success' as const
    case 'ON_HOLD':
      return 'warning' as const
    case 'DONE':
      return 'secondary' as const
    case 'CANCELLED':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext('project:read')
  const project = await projectService.get(ctx, id).catch(() => null)
  if (!project) notFound()

  const currency = ctx.organization.baseCurrency
  const canCreateSales = ctx.permissions.has('invoice:create')
  const canUpdate = ctx.permissions.has('project:update')
  const estimateHref = `/sales/estimates/new?project=${project.id}&customer=${project.customer.id}`
  const quotationHref = `/sales/quotations/new?project=${project.id}&customer=${project.customer.id}`
  const orderHref = `/sales/sales-orders/new?project=${project.id}&customer=${project.customer.id}`

  return (
    <>
      <PageHeader
        title={`${project.number} · ${project.name}`}
        description={`${project.customer.displayName}${project.siteLocation ? ` · ${project.siteLocation}` : ''}`}
        actions={
          <>
            {canCreateSales ? (
              <>
                <Link href={estimateHref} className={buttonVariants({ size: 'sm' })}>
                  <PlusIcon /> New estimate
                </Link>
                <Link
                  href={quotationHref}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  New quotation
                </Link>
                <Link
                  href={orderHref}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  New sales order
                </Link>
              </>
            ) : null}
            {canUpdate ? (
              <Link
                href={`/projects/${project.id}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <PencilIcon /> Edit
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant={statusVariant(project.status)}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
        {project.startDate || project.endDate ? (
          <span className="text-sm text-muted-foreground">
            {project.startDate ? formatDate(project.startDate) : '—'}
            {project.endDate ? ` → ${formatDate(project.endDate)}` : ''}
          </span>
        ) : null}
        {canUpdate ? <ProjectStatusForm id={project.id} status={project.status} /> : null}
      </div>

      {project.description ? (
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{project.description}</p>
      ) : null}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MoneyCard label="Quoted" value={formatMoney(project.totals.quoted, currency)} />
        <MoneyCard label="Ordered" value={formatMoney(project.totals.ordered, currency)} />
        <MoneyCard label="Invoiced" value={formatMoney(project.totals.invoiced, currency)} />
        <MoneyCard label="POs" value={formatMoney(project.totals.purchaseOrders, currency)} />
        <MoneyCard label="Billed" value={formatMoney(project.totals.billed, currency)} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Sales</h2>
          {canCreateSales ? (
            <Link
              href={estimateHref}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              New estimate
            </Link>
          ) : null}
        </div>
        {project.sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sales documents on this job yet. Start with an estimate.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.sales.map((row) => {
                  const config = salesByType(row.type)
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/sales/${config.slug}/${row.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{config.singular}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatMoney(row.total, currency)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Purchases</h2>
        {project.purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase documents linked yet.</p>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.purchases.map((row) => {
                  const config = purchaseByType(row.type)
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/purchases/${config.slug}/${row.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{config.singular}</TableCell>
                      <TableCell>{row.vendor.displayName}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatMoney(row.total, currency)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </>
  )
}

function MoneyCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 tabular text-lg font-semibold">{value}</p>
    </Card>
  )
}
