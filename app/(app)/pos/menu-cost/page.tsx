import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { today } from '@/lib/date'
import { isMenuMarginLow } from '@/lib/erp/menu-cost'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as hospitalityMenu from '@/server/services/hospitality-menu.service'

export const metadata: Metadata = { title: 'Menu food cost' }

export default async function MenuCostPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const [report, period] = await Promise.all([
    hospitalityMenu.menuCostReport(ctx),
    hospitalityMenu.periodFoodCostReport(ctx, { from: query.from, to: query.to }),
  ])
  const currency = report.currency
  const defaultTo = query.to || today(ctx.organization.timeZone)
  const defaultFrom = query.from || `${defaultTo.slice(0, 8)}01`

  return (
    <>
      <PageHeader
        title="Menu food cost"
        description="GROUP menu items: component average cost vs sales price → margin %. Period food-cost % from component issues vs GROUP/POS sales."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/pos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              POS
            </Link>
            <Link href="/hospitality" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Hospitality hub
            </Link>
            <Link href="/pos/kitchen" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Kitchen display
            </Link>
          </div>
        }
      />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Period food-cost %</CardTitle>
          <CardDescription>
            Component SALE issues versus GROUP invoice/POS sales in the window. Variance is actual
            issues minus recipe expected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-2" method="get">
            <label className="text-xs">
              From
              <Input name="from" type="date" defaultValue={defaultFrom} className="mt-1 w-40" />
            </label>
            <label className="text-xs">
              To
              <Input name="to" type="date" defaultValue={defaultTo} className="mt-1 w-40" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Run
            </button>
          </form>
          <p className="text-sm">
            {period.from} → {period.to} · sales {formatMoney(period.groupSales, currency)}
            {Number(period.posSales) > 0 ? ` (POS ${formatMoney(period.posSales, currency)})` : ''} ·
            issues {formatMoney(period.actualIssues, currency)} · food-cost{' '}
            <span className="font-medium tabular">
              {period.foodCostPercent != null ? `${period.foodCostPercent}%` : '—'}
            </span>
            {' · '}recipe {formatMoney(period.recipeExpected, currency)} · variance{' '}
            {formatMoney(period.variance, currency)}
          </p>
          {period.componentRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Recipe qty</TableHead>
                  <TableHead className="text-right">Issued qty</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {period.componentRows.map((row) => (
                  <TableRow key={row.componentItemId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right tabular">{row.recipeQuantity}</TableCell>
                    <TableCell className="text-right tabular">{row.actualQuantity}</TableCell>
                    <TableCell className="text-right tabular">{row.varianceQuantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No GROUP sales or component issues in this period.</p>
          )}
        </CardContent>
      </Card>

      {report.rows.length === 0 ? (
        <EmptyState
          title="No GROUP menu items"
          description="Add products with type GROUP and BOM components to see food cost vs price."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Food cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => {
                  const lowMargin = isMenuMarginLow(row.marginPercent)
                  return (
                  <TableRow
                    key={row.itemId}
                    className={cn(lowMargin && 'bg-destructive/10')}
                  >
                    <TableCell className="font-medium">
                      {row.name}
                      {row.sku ? ` · ${row.sku}` : ''}
                      {lowMargin ? (
                        <span className="ml-2 text-xs font-normal text-destructive">Low margin</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.foodCost, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {row.salesPrice ? formatMoney(row.salesPrice, currency) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular',
                        lowMargin && 'font-medium text-destructive',
                      )}
                    >
                      {row.marginPercent != null ? `${row.marginPercent}%` : '—'}
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}