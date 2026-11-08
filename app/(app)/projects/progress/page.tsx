import type { Metadata } from 'next'
import Link from 'next/link'

import {
  billProgressAction,
  releaseRetentionAction,
  saveContractAction,
} from '@/app/(app)/projects/progress/actions'
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

export const metadata: Metadata = { title: 'Progress billing' }

export default async function ProjectProgressPage() {
  const ctx = await requireOrgContext('invoice:create')
  const [projects, items, retentionInvoices] = await Promise.all([
    db.project.findMany({
      where: { orgId: ctx.orgId, status: { in: ['DRAFT', 'ACTIVE', 'ON_HOLD'] } },
      select: {
        id: true,
        number: true,
        name: true,
        contractValue: true,
        retentionPercent: true,
        billedPercent: true,
        retainerAmount: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    db.salesDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type: 'INVOICE',
        deletedAt: null,
        status: { not: 'VOID' },
        retentionAmount: { gt: 0 },
        retentionReleasedAt: null,
      },
      select: {
        id: true,
        number: true,
        retentionAmount: true,
        project: { select: { number: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    }),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Progress & retention"
        description="Set contract value and retention, then bill progress % into an invoice."
        actions={
          <Link href="/projects" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Projects
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState title="No open projects" description="Create a job under Projects first." />
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {project.number} · {project.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Billed {project.billedPercent.toString()}%
                    {project.contractValue
                      ? ` · contract ${formatMoney(project.contractValue.toString(), currency)}`
                      : ''}
                  </p>
                </div>

                <form action={saveContractAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <label className="text-xs">
                    Contract
                    <Input
                      name="contractValue"
                      className="mt-1 w-32"
                      defaultValue={project.contractValue?.toString() ?? ''}
                    />
                  </label>
                  <label className="text-xs">
                    Retention %
                    <Input
                      name="retentionPercent"
                      className="mt-1 w-24"
                      defaultValue={project.retentionPercent?.toString() ?? ''}
                    />
                  </label>
                  <label className="text-xs">
                    Retainer held
                    <Input
                      name="retainerAmount"
                      className="mt-1 w-28"
                      defaultValue={project.retainerAmount?.toString() ?? ''}
                    />
                  </label>
                  <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                    Save
                  </button>
                </form>

                <form action={billProgressAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <label className="text-xs">
                    Bill to %
                    <Input name="toPercent" required className="mt-1 w-24" placeholder="e.g. 40" />
                  </label>
                  <label className="text-xs">
                    Item
                    <NativeSelect name="itemId" required className="mt-1">
                      <option value="">Choose…</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <button type="submit" className={buttonVariants({ size: 'sm' })}>
                    Progress invoice
                  </button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Contract</TableHead>
              <TableHead className="text-right">Billed %</TableHead>
              <TableHead className="text-right">Retention %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={`sum-${project.id}`}>
                <TableCell>
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.number}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular">
                  {project.contractValue
                    ? formatMoney(project.contractValue.toString(), currency)
                    : '—'}
                </TableCell>
                <TableCell className="text-right tabular">{project.billedPercent.toString()}</TableCell>
                <TableCell className="text-right tabular">
                  {project.retentionPercent?.toString() ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {retentionInvoices.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">Open retention (release into AR)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Held</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {retentionInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link href={`/sales/invoices/${invoice.id}`} className="hover:underline">
                      {invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {invoice.project
                      ? `${invoice.project.number} · ${invoice.project.name}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatMoney(invoice.retentionAmount?.toString() ?? '0', currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={releaseRetentionAction}>
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <button type="submit" className={buttonVariants({ size: 'sm' })}>
                        Release
                      </button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  )
}
