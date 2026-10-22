'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

import { DeleteMenuItem } from '@/components/data/delete-record'
import { PackActions, packLinks } from '@/components/data/pack-actions'
import { EnteredByToggle } from '@/components/data/entered-by-toggle'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { ConvertSalesDocumentActions } from '@/components/sales/document-actions'
import { CustomerFilter } from '@/components/sales/customer-filter'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AccountPickerOption } from '@/lib/account-options'
import { listHref } from '@/lib/list-filters'

export type SalesOrderRegisterRow = {
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
  canFulfill: boolean
}

/**
 * Sales-order list under the dashboard — fulfill as invoice or sales receipt
 * when the customer collects.
 */
export function SalesOrderRegister({
  rows,
  customers,
  params,
  sort,
  statusOptions,
  dateOptions,
  status,
  date,
  canCreate,
  convertToday,
  depositAccounts,
  total,
}: {
  rows: SalesOrderRegisterRow[]
  customers: { value: string; label: string }[]
  params: Record<string, string | undefined>
  sort: SortState
  statusOptions: { value: string; label: string }[]
  dateOptions: { value: string; label: string }[]
  status: string
  date: string
  canCreate: boolean
  convertToday: string
  depositAccounts: AccountPickerOption[]
  total: number
}) {
  const basePath = '/sales/sales-orders'
  const [selected, setSelected] = useState<string[]>([])
  const visible = rows.map((row) => row.id)
  const allOn = visible.length > 0 && visible.every((id) => selected.includes(id))
  const chosen = rows.filter((row) => selected.includes(row.id))
  const one = chosen.length === 1 ? chosen[0] : null
  const statusLabel = statusOptions.find((option) => option.value === status)?.label ?? 'All'
  const dateLabel = dateOptions.find((option) => option.value === date)?.label ?? 'All dates'
  const pack = {
    area: 'sales' as const,
    slug: 'sales-orders',
    selectedIds: selected,
    partyId: params.customer,
    listParams: params,
    exportSlug: 'sales-orders',
    one: one ? { id: one.id, href: one.href, printHref: one.printHref } : null,
  }
  const links = packLinks(pack)

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
            {links.canPack ? (
              <DropdownMenuItem asChild>
                <Link href={links.viewHref}>{one ? 'View/Edit' : 'View papers'}</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>View/Edit</DropdownMenuItem>
            )}
            {links.canPack ? (
              <DropdownMenuItem asChild>
                <Link href={links.printHref}>Print</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>Print</DropdownMenuItem>
            )}
            {links.canPack ? (
              <DropdownMenuItem asChild>
                <Link href={links.pdfHref}>PDF</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>PDF</DropdownMenuItem>
            )}
            {one && one.canDelete ? (
              <DeleteMenuItem kind="sales" id={one.id} number={one.number} redirectTo={basePath} />
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={links.excelHref}>Excel</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <PackActions {...pack} />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            {statusLabel}
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {statusOptions.map((option) => (
              <DropdownMenuItem key={option.value || 'all'} asChild>
                <Link href={listHref(basePath, { ...params, status: option.value || undefined })}>
                  {option.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            {dateLabel}
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {dateOptions.map((option) => (
              <DropdownMenuItem key={option.value} asChild>
                <Link href={listHref(basePath, { ...params, date: option.value })}>
                  {option.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <CustomerFilter customers={customers} />
        <EnteredByToggle />
        <div className="min-w-[12rem] flex-1">
          <SearchInput placeholder="Search number or customer" />
        </div>

        {canCreate ? (
          <Link
            href={`${basePath}/new`}
            className="ml-auto inline-flex items-center rounded-md bg-[#2ca01c] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#248a18]"
          >
            Create sales order
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">
          No sales orders match that customer, status, or date.
        </p>
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
                    aria-label="Select the sales orders on this list"
                    className="size-3.5 accent-[#2ca01c]"
                  />
                </TableHead>
                <SortableHeader
                  column="date"
                  label="Date"
                  state={sort}
                  basePath={basePath}
                  params={params}
                  className="w-44"
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
                <TableHead className="w-64 print:hidden">Action</TableHead>
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
                  <TableCell className="tabular whitespace-nowrap">{row.date}</TableCell>
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
                    <span className="inline-flex flex-wrap items-center gap-2 whitespace-nowrap text-sm">
                      <Link href={row.editHref ?? row.href} className="font-medium text-[#2ca01c] hover:underline">
                        View/Edit
                      </Link>
                      {row.canFulfill ? (
                        <ConvertSalesDocumentActions
                          id={row.id}
                          number={row.number}
                          sourceType="SALES_ORDER"
                          today={convertToday}
                          depositAccounts={depositAccounts}
                          variant="ghost"
                          compact
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
