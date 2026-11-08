import type { Metadata } from 'next'
import Link from 'next/link'

import { saveFeePlan } from '@/app/(app)/education/actions'
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
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Fee plans' }

export default async function EducationFeesPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [plans, programs, items] = await Promise.all([
    education.listFeePlans(ctx),
    education.listPrograms(ctx),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true, salesPrice: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Fee plans"
        description="One or more billable items. University multi-fee plans can stack several lines later; start with a primary fee item."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={saveFeePlan} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              Plan name
              <Input name="name" required className="mt-1" placeholder="Term tuition" />
            </label>
            <label className="text-sm">
              Program (optional)
              <NativeSelect name="programId" className="mt-1">
                <option value="">Any program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Fee item
              <NativeSelect name="itemId" required className="mt-1">
                <option value="">Choose…</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.salesPrice != null
                      ? ` · ${formatMoney(item.salesPrice.toString(), currency)}`
                      : ''}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Quantity
              <Input name="quantity" defaultValue="1" className="mt-1" />
            </label>
            <label className="text-sm">
              Unit price override
              <Input name="unitPrice" className="mt-1" placeholder="Blank = item price" />
            </label>
            <label className="text-sm sm:col-span-2 lg:col-span-3">
              Description
              <Input name="description" className="mt-1" placeholder="Optional line text" />
            </label>
            <label className="text-sm">
              Extra fee item (optional)
              <NativeSelect name="itemId2" className="mt-1">
                <option value="">None</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Extra qty
              <Input name="quantity2" defaultValue="1" className="mt-1" />
            </label>
            <label className="text-sm">
              Extra price override
              <Input name="unitPrice2" className="mt-1" placeholder="Blank = item price" />
            </label>
            <div className="flex items-end">
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Add fee plan
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {plans.length === 0 ? (
        <EmptyState
          title="No fee plans"
          description="Create a fee item under Products, then add a plan here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Lines</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>{plan.program?.name ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {plan.lines
                    .map(
                      (line) =>
                        `${line.item.name} × ${line.quantity.toString()}` +
                        (line.unitPrice
                          ? ` @ ${formatMoney(line.unitPrice.toString(), currency)}`
                          : ''),
                    )
                    .join(' · ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
