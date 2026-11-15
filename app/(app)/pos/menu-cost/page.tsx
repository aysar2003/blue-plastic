import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isMenuMarginLow } from '@/lib/erp/menu-cost'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as hospitalityMenu from '@/server/services/hospitality-menu.service'

export const metadata: Metadata = { title: 'Menu food cost' }

export default async function MenuCostPage() {
  const ctx = await requireOrgContext('report:read')
  const report = await hospitalityMenu.menuCostReport(ctx)
  const currency = report.currency

  return (
    <>
      <PageHeader
        title="Menu food cost"
        description="GROUP menu items: component average cost vs sales price → margin %."
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