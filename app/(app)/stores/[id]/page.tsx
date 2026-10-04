import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as storeService from '@/server/services/store.service'
import type { StoreView } from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Store' }

const VIEWS: { value: StoreView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'In stock' },
  { value: 'zero', label: 'Zero' },
  { value: 'negative', label: 'Below zero' },
]

function readView(value: string | string[] | undefined): StoreView {
  if (value === 'in' || value === 'zero' || value === 'negative') return value
  return 'all'
}

export default async function StoreDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const { id } = await params
  const view = readView((await searchParams).view)
  const report = await storeService.report(ctx, id, view).catch(() => null)
  if (!report) notFound()

  const currency = ctx.organization.baseCurrency
  const chips = [
    { label: 'In stock', value: report.counts.inStock, className: 'text-[#0F766E]' },
    { label: 'Zero', value: report.counts.zero, className: '' },
    { label: 'Below zero', value: report.counts.negative, className: 'text-[#C2410C]' },
  ]

  return (
    <>
      <PageHeader
        title={report.store.name}
        description={
          report.store.isOffice
            ? `Office. Stock recorded before stores were named is counted here. Account ${report.store.account.code} ${report.store.account.name} holds what has been posted to this store.`
            : `Account ${report.store.account.code} ${report.store.account.name}. Bills received here add quantity. Sales taken from here reduce it.`
        }
        actions={
          <div className="flex gap-3 text-sm">
            <Link href="/stores" className="text-primary underline-offset-4 hover:underline">
              All stores
            </Link>
            <Link href="/purchases/bill/new" className="text-primary underline-offset-4 hover:underline">
              Receive
            </Link>
            <Link href="/sales/invoice/new" className="text-primary underline-offset-4 hover:underline">
              Sell
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {chips.map((chip) => (
          <Card key={chip.label} className="p-4">
            <p className="text-xs text-muted-foreground">{chip.label}</p>
            <p className={cn('tabular mt-0.5 text-lg font-semibold', chip.className)}>{chip.value}</p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Store account</p>
          <p className="tabular mt-0.5 text-lg font-semibold">{formatMoney(report.accountBalance, currency)}</p>
        </Card>
      </div>

      <div className="mb-3 flex gap-1">
        {VIEWS.map((item) => {
          const active = view === item.value
          return (
            <Link
              key={item.value}
              href={item.value === 'all' ? `/stores/${id}` : `/stores/${id}?view=${item.value}`}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm transition-colors',
                active ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#d5dde6] hover:bg-[#d5dde6]">
                <TableHead>Item</TableHead>
                <TableHead className="numeric w-32">In this store</TableHead>
                <TableHead className="numeric w-32">Value at average</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    Nothing in this view.
                  </TableCell>
                </TableRow>
              ) : (
                report.items.map((item, index) => (
                  <TableRow
                    key={item.itemId}
                    className={index % 2 === 1 ? 'bg-[#c5dff3] hover:bg-[#c5dff3]' : 'bg-white hover:bg-white'}
                  >
                    <TableCell>
                      <Link href={`/inventory/${item.itemId}`} className="font-medium underline-offset-4 hover:underline">
                        {item.name}
                      </Link>
                      {item.sku ? <span className="block text-xs text-muted-foreground">{item.sku}</span> : null}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'numeric tabular',
                        item.quantity.isNegative() && 'text-[#C2410C]',
                        item.quantity.isZero() && 'text-muted-foreground',
                      )}
                    >
                      {item.quantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="numeric tabular">{formatMoney(item.value, currency)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  )
}
