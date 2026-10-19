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
import { isDocumentKindEnabled, isModuleEnabled } from '@/lib/feature-flags'
import { formatMoney } from '@/lib/money'
import { purchaseByType } from '@/lib/purchase-types'
import { byType as salesByType, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { PROJECT_STATUS_LABELS } from '@/lib/validation/project'
import type { Permission } from '@/server/auth/permissions'
import { requireOrgContext } from '@/server/auth/context'
import * as projectService from '@/server/services/project.service'

import * as projectTaskService from '@/server/services/project-task.service'
import * as userHistoryService from '@/server/services/user-history.service'
import { DeleteProjectButton } from './delete-button'
import { ProjectStatusForm } from './status-form'
import { ProjectTaskBoard } from './task-board'

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
  const [tasks, members] = await Promise.all([
    projectTaskService.listForProject(ctx, project.id),
    userHistoryService.listMembers(ctx),
  ])

  const currency = ctx.organization.baseCurrency
  const salesOn = isModuleEnabled(ctx.features, 'sales')
  const purchasesOn = isModuleEnabled(ctx.features, 'purchases')
  const canCreateSales = ctx.permissions.has('invoice:create') && salesOn
  const canCreatePurchases =
    (ctx.permissions.has('bill:create') || ctx.permissions.has('expense:create')) && purchasesOn
  const canUpdate = ctx.permissions.has('project:update')
  const job = `project=${project.id}&customer=${project.customer.id}`
  const salesLinks = [
    {
      href: `/sales/estimates/new?${job}`,
      label: 'New estimate',
      kind: 'ESTIMATE',
      primary: true,
    },
    { href: `/sales/quotations/new?${job}`, label: 'New quotation', kind: 'QUOTATION' },
    { href: `/sales/sales-orders/new?${job}`, label: 'New sales order', kind: 'SALES_ORDER' },
    { href: `/sales/invoices/new?${job}`, label: 'New invoice', kind: 'INVOICE' },
    { href: `/sales/sales-receipts/new?${job}`, label: 'New sales receipt', kind: 'SALES_RECEIPT' },
  ].filter((link) => isDocumentKindEnabled(ctx.features, 'sales', link.kind))
  const purchaseLinkOptions: {
    href: string
    label: string
    kind: 'PURCHASE_ORDER' | 'BILL' | 'EXPENSE'
    permission: Permission
  }[] = [
    {
      href: `/purchases/purchase-orders/new?project=${project.id}`,
      label: 'New purchase order',
      kind: 'PURCHASE_ORDER',
      permission: 'bill:create',
    },
    {
      href: `/purchases/bills/new?project=${project.id}`,
      label: 'New bill',
      kind: 'BILL',
      permission: 'bill:create',
    },
    {
      href: `/purchases/expenses/new?project=${project.id}`,
      label: 'New expense',
      kind: 'EXPENSE',
      permission: 'expense:create',
    },
  ]
  const purchaseLinks = purchaseLinkOptions.filter(
    (link) =>
      ctx.permissions.has(link.permission) &&
      isDocumentKindEnabled(ctx.features, 'purchases', link.kind),
  )

  return (
    <>
      <PageHeader
        title={`${project.number} · ${project.name}`}
        description={`${project.customer.displayName}${project.siteLocation ? ` · ${project.siteLocation}` : ''}`}
        actions={
          <>
            {canCreateSales && salesLinks[0] ? (
              <Link href={salesLinks[0].href} className={buttonVariants({ size: 'sm' })}>
                <PlusIcon /> {salesLinks[0].label}
              </Link>
            ) : null}
            {canUpdate ? (
              <Link
                href={`/projects/${project.id}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <PencilIcon /> Edit
              </Link>
            ) : null}
            {canUpdate ? <DeleteProjectButton id={project.id} name={project.name} /> : null}
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
        <Link
          href={`/customers/${project.customer.id}`}
          className="text-sm text-primary hover:underline"
        >
          {project.customer.displayName}
        </Link>
      </div>

      {project.description ? (
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{project.description}</p>
      ) : null}

      <ProjectTaskBoard
        projectId={project.id}
        tasks={tasks}
        members={members}
        canEdit={canUpdate}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MoneyCard label="Quoted" value={formatMoney(project.totals.quoted, currency)} />
        <MoneyCard label="Ordered" value={formatMoney(project.totals.ordered, currency)} />
        <MoneyCard label="Invoiced" value={formatMoney(project.totals.invoiced, currency)} />
        <MoneyCard label="POs" value={formatMoney(project.totals.purchaseOrders, currency)} />
        <MoneyCard label="Billed" value={formatMoney(project.totals.billed, currency)} />
        <MoneyCard label="Profit" value={formatMoney(project.totals.profit, currency)} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Sales</h2>
          {canCreateSales ? (
            <div className="flex flex-wrap gap-1">
              {salesLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  {link.label}
                </Link>
              ))}
            </div>
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Purchases</h2>
          {canCreatePurchases ? (
            <div className="flex flex-wrap gap-1">
              {purchaseLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
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
