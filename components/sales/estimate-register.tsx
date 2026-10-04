'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

import { DeleteMenuItem } from '@/components/data/delete-record'
import { EnteredByToggle } from '@/components/data/entered-by-toggle'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { ConvertEstimateButton } from '@/components/sales/document-actions'
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

export type EstimateRegisterRow = {
  id: string
  number: string
  date: string
  customer: string
  amount: string
  statusText: string
  href: string
  editHref: string | null
  printHref: string
  recorded: string | null
  canDelete: boolean
  canConvert: boolean
}

function sheetDate(iso: string) {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${Number(month)}/${Number(day)}/${year.slice(2)}`
}

/**
 * Quotation list under the dashboard — same register shape as invoices and
 * sales receipts, with Create invoice when a quote can still become a sale.
 */
export function EstimateRegister({
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
  convertToday,
  total,
}: {
  rows: EstimateRegisterRow[]
  customers: { value: string; label: string }[]
  basePath: string
  params: Record<string, string | undefined>
  sort: SortState
  statusOptions: { value: string; label: string }[]
  dateOptions: { value: string; label: string }[]
  status: string
  date: string
  canCreate: boolean
  convertToday: string
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
            {one ? (
              <DropdownMenuItem asChild>
                <Link href={one.printHref}>Print</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>Print</DropdownMenuItem>
            )}
            {one && one.canDelete ? (
              <DeleteMenuItem kind="sales" id={one.id} number={one.number} redirectTo={basePath} />
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={`/api/exports/estimates?${new URLSearchParams(
                  Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
                )}`}
              >
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
                <Link href={listHref(basePath, { ...params, status: option.value || undefined })}>
                  {option.label}
                </Link>
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
          <Link
            href="/sales/estimates/new"
            className="ml-auto inline-flex items-center rounded-md bg-[#2ca01c] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#248a18]"
          >
            Create quotation
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">No quotations match that customer, status, or date.</p>
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
                    aria-label="Select the quotations on this list"
                    className="size-3.5 accent-[#2ca01c]"
                  />
                </TableHead>
                <SortableHeader
                  column="date"
                  label="Date"
                  state={sort}
                  basePath={basePath}
                  params={params}
                  className="w-24"
                  defaultDirection="desc"
                />
                <SortableHeader column="number" label="No." state={sort} basePath={basePath} params={params} className="w-28" />
                <SortableHeader column="customer" label="Customer" state={sort} basePath={basePath} params={params} />
                <SortableHeader
                  column="total"
                  label="Amount"
                  state={sort}
                  basePath={basePath}
                  params={params}
                  className="w-28"
                  numeric
                  defaultDirection="desc"
                />
                <SortableHeader
                  column="status"
                  label="Status"
                  state={sort}
                  basePath={basePath}
                  params={params}
                  className="w-28"
                />
                <TableHead data-column="entered-by" className="w-44">
                  Entered by
                </TableHead>
                <TableHead className="w-48 print:hidden">Action</TableHead>
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
                  <TableCell className="text-muted-foreground">{row.statusText}</TableCell>
                  <TableCell data-column="entered-by">{row.recorded ?? '—'}</TableCell>
                  <TableCell className="print:hidden">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                      <Link href={row.editHref ?? row.href} className="font-medium text-[#2ca01c] hover:underline">
                        View/Edit
                      </Link>
                      {row.canConvert ? (
                        <ConvertEstimateButton
                          id={row.id}
                          number={row.number}
                          today={convertToday}
                          variant="ghost"
                          label="Invoice"
                        />
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
