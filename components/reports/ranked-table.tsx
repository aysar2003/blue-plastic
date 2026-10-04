import Link from 'next/link'

import { ClickableRow } from '@/components/reports/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Decimal, formatMoney } from '@/lib/money'
import type { RankedRow } from '@/server/reports/business'

/**
 * A "who and how much" report: rows ordered by size, each with its share of the
 * total and a bar to make the shape readable at a glance. Ordering by amount
 * rather than by name is the point — the question is always which few names
 * account for most of the number.
 */
export function RankedTable({
  rows,
  total,
  currency,
  nameHeader,
  countHeader,
  linkTo,
  quantities,
  empty,
  sort,
  basePath,
  linkParams,
}: {
  rows: (RankedRow & { quantity?: Decimal })[]
  total: Decimal
  currency: string
  nameHeader: string
  countHeader: string
  linkTo?: (id: string) => string
  quantities?: boolean
  empty: string
  sort: SortState
  basePath: string
  linkParams: Record<string, string | undefined>
}) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing to report" description={empty} />
  }

  const direction = sort.dir === 'asc' ? 1 : -1
  const ordered = [...rows].sort((a, b) => {
    switch (sort.sort) {
      case 'name':
        return direction * a.name.localeCompare(b.name)
      case 'count':
        return direction * (a.count - b.count)
      case 'quantity':
        return direction * (a.quantity ?? new Decimal(0)).comparedTo(b.quantity ?? new Decimal(0))
      default:
        return direction * a.amount.comparedTo(b.amount)
    }
  })

  const largest = rows.reduce((max, row) => (row.amount.abs().greaterThan(max) ? row.amount.abs() : max), new Decimal(0))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader column="name" label={nameHeader} state={sort} basePath={basePath} params={linkParams} />
          <SortableHeader column="count" label={countHeader} state={sort} basePath={basePath} params={linkParams} className="w-24" numeric defaultDirection="desc" />
          {quantities ? (
            <SortableHeader column="quantity" label="Quantity" state={sort} basePath={basePath} params={linkParams} className="w-28" numeric defaultDirection="desc" />
          ) : null}
          <SortableHeader column="amount" label="Amount" state={sort} basePath={basePath} params={linkParams} className="w-40" numeric defaultDirection="desc" />
          <TableHead className="w-48">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordered.map((row) => (
          <ClickableRow key={row.id} href={linkTo?.(row.id)}>
            <TableCell className="font-medium">
              {linkTo ? (
                <Link href={linkTo(row.id)} className="underline-offset-4 hover:underline">
                  {row.name}
                </Link>
              ) : (
                row.name
              )}
            </TableCell>
            <TableCell className="numeric tabular text-muted-foreground">{row.count}</TableCell>
            {quantities ? (
              <TableCell className="numeric tabular text-muted-foreground">
                {row.quantity?.toDecimalPlaces(2).toString() ?? '—'}
              </TableCell>
            ) : null}
            <TableCell className="numeric tabular">
              {linkTo ? (
                <Link href={linkTo(row.id)} className="underline-offset-4 hover:underline">
                  {formatMoney(row.amount, currency)}
                </Link>
              ) : (
                formatMoney(row.amount, currency)
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{
                      width: largest.isZero()
                        ? '0%'
                        : `${row.amount.abs().dividedBy(largest).times(100).toNumber().toFixed(1)}%`,
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular text-muted-foreground">
                  {row.share.toFixed(1)}%
                </span>
              </div>
            </TableCell>
          </ClickableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell />
          {quantities ? <TableCell /> : null}
          <TableCell className="numeric tabular font-semibold">{formatMoney(total, currency)}</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}
