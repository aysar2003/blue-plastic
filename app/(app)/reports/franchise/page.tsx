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
  const [summary, brand] = await Promise.all([
    franchise.franchiseSummary(ctx, month),
    franchise.brandProfitAndLoss(ctx, month),
  ])
  const currency = ctx.organization.baseCurrency
  const canManage = ctx.permissions.has('journal:post')

  return (
    <>
      <PageHeader
        title="Franchise"
        description="Royalty statement per franchisee (sales × %) and brand P&L roll-up."
        actions={
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/reports/franchise/export?month=${month}`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Royalty Excel
            </a>
            <a
              href={`/api/reports/franchise/export?month=${month}&format=csv`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              CSV
            </a>
            <Link href="/reports/companies" className="text-sm text-primary underline-offset-4 hover:underline">
              Company group
            </Link>
          </div>
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

      {brand.hasFranchisees ? (
        <Card className="mt-8 p-4">
          <h2 className="mb-1 font-medium">Brand P&amp;L roll-up</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Franchisees with a royalty % · month {brand.asOfMonth}. Income and expense from each
            child&apos;s books (IC memos skipped).
          </p>
          <p className="mb-4 text-sm">
            Brand income {formatMoney(brand.rollup.income, currency)} · expense{' '}
            {formatMoney(brand.rollup.expense, currency)} · net{' '}
            <strong>{formatMoney(brand.rollup.net, currency)}</strong> · royalty due{' '}
            {formatMoney(brand.rollup.royaltyDue, currency)}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Franchisee</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expense</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Royalty due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brand.children.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.income, currency)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.expense, currency)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.net, currency)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.royaltyDue, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Brand P&amp;L appears when a child company has a franchise royalty percent.
        </p>
      )}
    </>
  )
}