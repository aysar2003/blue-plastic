import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as franchise from '@/server/services/franchise.service'

import { accrueFranchiseRoyalty, catalogPushToChild, setFranchiseRoyalty } from './actions'

export const metadata: Metadata = { title: 'Franchise' }

export default async function FranchiseReportPage() {
  const ctx = await requireOrgContext('report:read')
  const month = today(ctx.organization.timeZone).slice(0, 7) + '-01'
  const summary = await franchise.franchiseSummary(ctx, month)
  const currency = ctx.organization.baseCurrency
  const canManage = ctx.permissions.has('journal:post')

  return (
    <>
      <PageHeader
        title="Franchise"
        description="Child royalty %, catalog push, and monthly royalty accrual."
        actions={
          <Link href="/reports/companies" className="text-sm text-primary underline-offset-4 hover:underline">
            Company group
          </Link>
        }
      />

      <Card className="mb-6 p-4 text-sm">
        <p className="text-muted-foreground">
          As of month {summary.asOfMonth} · set royalty % on each franchisee, push the parent catalog,
          then accrue royalty from child sales.
        </p>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Franchisee</TableHead>
            <TableHead className="text-right">Royalty %</TableHead>
            <TableHead className="text-right">Sales</TableHead>
            <TableHead className="text-right">Royalty due</TableHead>
            {canManage ? <TableHead>Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.children.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right">{row.royaltyPercent ?? '—'}</TableCell>
              <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.royaltyDue, currency)}</TableCell>
              {canManage ? (
                <TableCell>
                  <form action={setFranchiseRoyalty} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="childOrgId" value={row.id} />
                    <div>
                      <Label className="sr-only" htmlFor={`pct-${row.id}`}>
                        Royalty %
                      </Label>
                      <Input
                        id={`pct-${row.id}`}
                        name="percent"
                        className="h-8 w-20"
                        placeholder="%"
                        defaultValue={row.royaltyPercent ?? ''}
                      />
                    </div>
                    <Button type="submit" size="sm" variant="outline">
                      Save %
                    </Button>
                  </form>
                  <form action={catalogPushToChild} className="mt-2">
                    <input type="hidden" name="childOrgId" value={row.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Push catalog
                    </Button>
                  </form>
                  <form action={accrueFranchiseRoyalty} className="mt-2">
                    <input type="hidden" name="childOrgId" value={row.id} />
                    <input type="hidden" name="asOfMonth" value={month} />
                    <Button type="submit" size="sm">
                      Accrue royalty
                    </Button>
                  </form>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}