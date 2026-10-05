'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExpenseRegisterRow } from '@/lib/expense-kinds'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'

export function ExpenseTable({
  rows,
  currency,
  totals,
  canEdit,
}: {
  rows: ExpenseRegisterRow[]
  currency: string
  totals: { subtotal: string; tax: string; total: string }
  canEdit: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])
  const allOn = rows.length > 0 && selected.length === rows.length

  const selectedTotals = useMemo(() => {
    const chosen = new Set(selected)
    return rows
      .filter((row) => chosen.has(row.id))
      .reduce(
        (sum, row) => ({
          subtotal: sum.subtotal.plus(row.subtotal),
          tax: sum.tax.plus(row.tax),
          total: sum.total.plus(row.total),
        }),
        { subtotal: ZERO, tax: ZERO, total: ZERO },
      )
  }, [rows, selected])

  const showing = selected.length > 0 ? selectedTotals : {
    subtotal: new Decimal(totals.subtotal),
    tax: new Decimal(totals.tax),
    total: new Decimal(totals.total),
  }

  function toggleAll() {
    setSelected(allOn ? [] : rows.map((row) => row.id))
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10 print:hidden">
            <input type="checkbox" aria-label="Select all" checked={allOn} onChange={toggleAll} />
          </TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>No.</TableHead>
          <TableHead>Payee</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="numeric">Total before sales tax</TableHead>
          <TableHead className="numeric">Sales tax</TableHead>
          <TableHead className="numeric">Total</TableHead>
          <TableHead>Bill approval</TableHead>
          <TableHead className="w-36 print:hidden">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.kind}-${row.id}`} data-state={selected.includes(row.id) ? 'selected' : undefined}>
            <TableCell className="print:hidden">
              <input
                type="checkbox"
                aria-label={`Select ${row.typeLabel} ${row.number}`}
                checked={selected.includes(row.id)}
                onChange={() => toggle(row.id)}
              />
            </TableCell>
            <TableCell className="tabular whitespace-nowrap text-muted-foreground">{row.date}</TableCell>
            <TableCell className="whitespace-nowrap">{row.typeLabel}</TableCell>
            <TableCell>
              <Link href={row.href} className="tabular font-medium hover:underline">
                {row.number}
              </Link>
            </TableCell>
            <TableCell>{row.payee}</TableCell>
            <TableCell className="text-muted-foreground">{row.category}</TableCell>
            <TableCell className="numeric tabular">{formatMoney(row.subtotal, currency)}</TableCell>
            <TableCell className="numeric tabular">{formatMoney(row.tax, currency)}</TableCell>
            <TableCell className="numeric tabular font-medium">{formatMoney(row.total, currency)}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            </TableCell>
            <TableCell className="print:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  {row.payHref ? 'Mark as paid' : 'View/Edit'}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={row.href}>View</Link>
                  </DropdownMenuItem>
                  {canEdit && row.editHref ? (
                    <DropdownMenuItem asChild>
                      <Link href={row.editHref}>Edit</Link>
                    </DropdownMenuItem>
                  ) : null}
                  {row.payHref ? (
                    <DropdownMenuItem asChild>
                      <Link href={row.payHref}>Mark as paid</Link>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="print:hidden" />
          <TableCell colSpan={5} className="font-medium">
            {selected.length > 0 ? `Selected ${selected.length}` : 'Total'}
          </TableCell>
          <TableCell className="numeric tabular">{formatMoney(showing.subtotal, currency)}</TableCell>
          <TableCell className="numeric tabular">{formatMoney(showing.tax, currency)}</TableCell>
          <TableCell className="numeric tabular font-semibold">{formatMoney(showing.total, currency)}</TableCell>
          <TableCell />
          <TableCell className="print:hidden" />
        </TableRow>
      </TableFooter>
    </Table>
  )
}
