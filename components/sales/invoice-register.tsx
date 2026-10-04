'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon, ClockIcon } from 'lucide-react'

import { DeleteMenuItem } from '@/components/data/delete-record'
import { EnteredByToggle } from '@/components/data/entered-by-toggle'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { CustomerFilter } from '@/components/sales/customer-filter'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listHref } from '@/lib/list-filters'

export type InvoiceRegisterRow = {
  id: string
  number: string
  date: string
  due: string | null
  customer: string
  amount: string
  balance: string
  statusText: string
  overdue: boolean
  href: string
  editHref: string | null
  printHref: string
  payHref: string | null
  recorded: string | null
  canDelete: boolean
}

function sheetDate(iso: string) {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${Number(month)}/${Number(day)}/${year.slice(2)}`
}

/**
 * The invoice list under the dashboard, in the shape QuickBooks uses:
 * batch actions, status, date, and Create invoice on one bar, then
 * date, number, customer, amount, balance, due date, status, and the row actions.
 */
export function InvoiceRegister({
  rows,
  customers,
  basePath,
  params,
  sort,
  statusOptions,
  dateOptions,
  status,
  date,
  canCreate,
  canPay,
  total,
}: {
  rows: InvoiceRegisterRow[]
  customers: { value: string; label: string }[]
  basePath: string
  params: Record<string, string | undefined>
  sort: SortState
  statusOptions: { value: string; label: string }[]
  dateOptions: { value: string; label: string }[]
  status: string
  date: string
  canCreate: boolean
  canPay: boolean
  page?: number
  pageCount?: number
  total: number
  pageSize?: number
}) {
  const [selected, setSelected] = useState<string[]>([])
  const visible = rows.map((row) => row.id)
  const allOn = visible.length > 0 && visible.every((id) => selected.includes(id))
  const chosen = rows.filter((row) => selected.includes(row.id))
  const one = chosen.length === 1 ? chosen[0] : null
  const statusLabel = statusOptions.find((option) => option.value === status)?.label ?? 'All'
  const dateLabel = dateOptions.find((option) => option.value === date)?.label ?? 'All dates'

  const toggleAll = () => setSelected(allOn ? [] : visible)
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            Batch actions
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {one ? (
              <DropdownMenuItem asChild>
                <Link href={one.href}>View/Edit</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>View/Edit</DropdownMenuItem>
            )}
            {canPay ? (
              one?.payHref ? (
                <DropdownMenuItem asChild>
                  <Link href={one.payHref}>Receive payment</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>Receive payment</DropdownMenuItem>
              )
            ) : null}
            {one ? (
              <DropdownMenuItem asChild>
                <Link href={one.printHref}>Print</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>Print</DropdownMenuItem>
            )}
            {one && one.canDelete ? <DeleteMenuItem kind="sales" id={one.id} number={one.number} redirectTo={basePath} /> : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/api/exports/invoices?${new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])))}`}>
                Export this list
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex min-w-28 items-center justify-between gap-3 rounded-md border bg-card px-3 py-1.5 text-sm">
            <span>Status</span>
            <span className="text-muted-foreground">{statusLabel}</span>
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {statusOptions.map((option) => (
              <DropdownMenuItem key={option.label} asChild>
                <Link href={listHref(basePath, { ...params, status: option.value || undefined })}>{option.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex min-w-36 items-center justify-between gap-3 rounded-md border bg-card px-3 py-1.5 text-sm">
            <span>Date</span>
            <span className="text-muted-foreground">{dateLabel}</span>
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {dateOptions.map((option) => (
              <DropdownMenuItem key={option.label} asChild>
                <Link href={listHref(basePath, { ...params, date: option.value })}>{option.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <CustomerFilter customers={customers} />
        <EnteredByToggle />

        <div className="min-w-40 flex-1">
          <SearchInput placeholder="Search number or customer" />
        </div>

        {canCreate ? (
          <div className="ml-auto inline-flex">
            <Link
              href="/sales/invoices/new"
              className="inline-flex items-center rounded-l-md bg-[#2ca01c] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#248a18]"
            >
              Create invoice
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center rounded-r-md border-l border-white/30 bg-[#2ca01c] px-2 text-white hover:bg-[#248a18]"
                aria-label="More ways to create"
              >
                <ChevronDownIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/sales/invoices/new">Invoice</Link>
                </DropdownMenuItem>
                {canPay ? (
                  <DropdownMenuItem asChild>
                    <Link href="/payments/new">Receive payment</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href="/sales/sales-receipts/new">Sales receipt</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/sales/estimates/new">Quotation</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/sales/credit-memos/new">Credit memo</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/sales/refunds/new">Refund</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">No invoices match that status or date.</p>
      ) : (
        <ScrollSheet>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={toggleAll}
                  aria-label="Select the invoices on this list"
                  className="size-3.5 accent-[#2ca01c]"
                />
              </TableHead>
              <SortableHeader column="date" label="Date" state={sort} basePath={basePath} params={params} className="w-24" defaultDirection="desc" />
              <SortableHeader column="number" label="No." state={sort} basePath={basePath} params={params} className="w-28" />
              <SortableHeader column="customer" label="Customer" state={sort} basePath={basePath} params={params} />
              <SortableHeader column="total" label="Amount" state={sort} basePath={basePath} params={params} className="w-28" numeric defaultDirection="desc" />
              <TableHead className="numeric w-28">Balance</TableHead>
              <SortableHeader column="dueDate" label="Due date" state={sort} basePath={basePath} params={params} className="w-28" />
              <SortableHeader column="status" label="Status" state={sort} basePath={basePath} params={params} className="w-40" />
              <TableHead data-column="entered-by" className="w-44">Entered by</TableHead>
              <TableHead className="w-56 print:hidden">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-state={selected.includes(row.id) ? 'selected' : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.number}`}
                    className="size-3.5 accent-[#2ca01c]"
                  />
                </TableCell>
                <TableCell className="tabular whitespace-nowrap">{sheetDate(row.date)}</TableCell>
                <TableCell>
                  <Link href={row.href} className="font-medium text-[#2ca01c] hover:underline">
                    {row.number}
                  </Link>
                </TableCell>
                <TableCell className="uppercase">{row.customer}</TableCell>
                <TableCell className="numeric tabular">{row.amount}</TableCell>
                <TableCell className="numeric tabular">{row.balance}</TableCell>
                <TableCell className="tabular whitespace-nowrap">{row.due ? sheetDate(row.due) : '—'}</TableCell>
                <TableCell>
                  {row.overdue ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#c2410c]">
                      <ClockIcon className="size-3.5" aria-hidden />
                      {row.statusText}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{row.statusText}</span>
                  )}
                </TableCell>
                <TableCell data-column="entered-by">{row.recorded ?? '—'}</TableCell>
                <TableCell className="print:hidden">
                  <span className="inline-flex items-center gap-3 whitespace-nowrap text-sm">
                    <Link href={row.editHref ?? row.href} className="font-medium text-[#2ca01c] hover:underline">
                      View/Edit
                    </Link>
                    {row.payHref ? (
                      <Link href={row.payHref} className="font-medium text-[#2ca01c] hover:underline">
                        Receive payment
                      </Link>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="text-[#2ca01c]" aria-label={`More actions for ${row.number}`}>
                        <ChevronDownIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={row.href}>View</Link>
                        </DropdownMenuItem>
                        {row.editHref ? (
                          <DropdownMenuItem asChild>
                            <Link href={row.editHref}>Edit</Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem asChild>
                          <Link href={row.printHref}>Print</Link>
                        </DropdownMenuItem>
                        {row.payHref ? (
                          <DropdownMenuItem asChild>
                            <Link href={row.payHref}>Receive payment</Link>
                          </DropdownMenuItem>
                        ) : null}
                        {row.canDelete ? (
                          <DeleteMenuItem kind="sales" id={row.id} number={row.number} redirectTo={basePath} />
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </ScrollSheet>
      )}

      <div className="flex items-center justify-end gap-1 border-t px-3 py-2 text-sm">
        <span className="px-2 tabular text-muted-foreground">
          {total} {total === 1 ? 'row' : 'rows'}
        </span>
      </div>
    </div>
  )
}
