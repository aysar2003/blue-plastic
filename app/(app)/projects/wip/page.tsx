import type { Metadata } from 'next'
import Link from 'next/link'

import { billRetainerAction, billWipAction } from '@/app/(app)/projects/wip/actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as wip from '@/server/services/services-wip.service'

export const metadata: Metadata = { title: 'WIP / utilization' }

export default async function ProjectWipPage() {
  const ctx = await requireOrgContext('report:read')
  const [projects, utilization, serviceItems] = await Promise.all([
    wip.projectWip(ctx),
    wip.utilizationReport(ctx),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        deletedAt: null,
        type: { in: ['SERVICE', 'OTHER_CHARGE', 'NON_INVENTORY'] },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 300,
    }),
  ])
  const currency = ctx.organization.baseCurrency
  const defaultItemId = serviceItems[0]?.id ?? ''

  return (
    <>
      <PageHeader
        title="WIP & utilization"
        description="Bill unbilled time onto an invoice, raise retainers, and review utilization."
        actions={
          <Link href="/projects" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Projects
          </Link>
        }
      />

      <h2 className="mb-2 text-sm font-semibold">Unbilled WIP</h2>
      <Table className="mb-8">
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Entries</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">WIP value</TableHead>
            <TableHead className="text-right">Retainer term</TableHead>
            <TableHead>Bill</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell>
                <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                  {project.number} · {project.name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular">{project.wipEntries}</TableCell>
              <TableCell className="text-right tabular">{project.wipHours}</TableCell>
              <TableCell className="text-right tabular">
                {formatMoney(project.wipAmount, currency)}
              </TableCell>
              <TableCell className="text-right tabular">
                {project.retainerAmount
                  ? formatMoney(project.retainerAmount, currency)
                  : '—'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2 py-1">
                  {project.wipEntries > 0 && defaultItemId ? (
                    <form action={billWipAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="projectId" value={project.id} />
                      <NativeSelect
                        name="itemId"
                        defaultValue={defaultItemId}
                        className="h-8 max-w-[10rem] text-xs"
                      >
                        {serviceItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </NativeSelect>
                      <button type="submit" className={buttonVariants({ size: 'sm' })}>
                        Bill WIP
                      </button>
                    </form>
                  ) : null}
                  {defaultItemId ? (
                    <form action={billRetainerAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="itemId" value={defaultItemId} />
                      <Input
                        name="amount"
                        defaultValue={project.retainerAmount ?? ''}
                        placeholder="Retainer $"
                        className="h-8 w-24 text-xs"
                        required
                      />
                      <button
                        type="submit"
                        className={buttonVariants({ size: 'sm', variant: 'outline' })}
                      >
                        Bill retainer
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted-foreground">Add a service item first</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <h2 className="mb-2 text-sm font-semibold">Utilization</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead className="text-right">Billable hrs</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Util %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {utilization.map((row) => (
            <TableRow key={row.userId}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right tabular">{row.billableHours}</TableCell>
              <TableCell className="text-right tabular">{row.availableHours}</TableCell>
              <TableCell className="text-right tabular">{row.utilization}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
