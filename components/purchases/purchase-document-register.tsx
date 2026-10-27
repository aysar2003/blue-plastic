'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

import { PdfMenuDownload } from '@/components/print/print-ink-menu'
import { DeleteMenuItem } from '@/components/data/delete-record'
import { PackActions, packLinks } from '@/components/data/pack-actions'
import { EnteredByToggle } from '@/components/data/entered-by-toggle'
import { EnteredByCell, EnteredByHead } from '@/components/data/recorded-by'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { VendorFilter } from '@/components/purchases/vendor-filter'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listHref } from '@/lib/list-filters'
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import type { Trail } from '@/server/services/audit.service'

export type PurchaseDocumentRegisterRow = {
  id: string
  number: string
  date: string
  vendor: string
  reference: string | null
  due: string | null
  overdue: boolean
  amount: string
  balance: string | null
  status: string
  href: string
  editHref: string | null
  printHref: string
  canDelete: boolean
  trail?: Trail
}

export function PurchaseDocumentRegister({
  rows,
  vendors,
  basePath,
  params,
  sort,
  statusOptions,
  dateOptions,
  status,
  date,
  canCreate,
  singular,
  plural,
  exportSlug,
  showBalance = false,
  showDue = false,
}: {
  rows: PurchaseDocumentRegisterRow[]
  vendors: { value: string; label: string }[]
  basePath: string
  params: Record<string, string | undefined>
  sort: SortState
  statusOptions: { value: string; label: string }[]
  dateOptions: { value: string; label: string }[]
  status: string
  date: string
  canCreate: boolean
  singular: string
  plural: string
  exportSlug: string
  showBalance?: boolean
  showDue?: boolean
}) {
  const unit = singular.toLowerCase()
  const units = plural.toLowerCase()
  const [selected, setSelected] = useState<string[]>([])
  const visible = rows.map((row) => row.id)
  const allOn = visible.length > 0 && visible.every((id) => selected.includes(id))
  const chosen = rows.filter((row) => selected.includes(row.id))
  const one = chosen.length === 1 ? chosen[0] : null
  const statusLabel = statusOptions.find((option) => option.value === status)?.label ?? 'All'
  const dateLabel = dateOptions.find((option) => option.value === date)?.label ?? 'All dates'
  const pack = {
    area: 'purchases' as const,
    slug: exportSlug,
    selectedIds: selected,
    partyId: params.vendorId,
    partyParam: 'vendorId' as const,
    listParams: params,
    exportSlug,
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
              <PdfMenuDownload href={links.pdfHref} />
            ) : (
              <DropdownMenuItem disabled>PDF</DropdownMenuItem>
            )}
            {one && one.canDelete ? (
              <DeleteMenuItem kind="purchase" id={one.id} number={one.number} redirectTo={basePath} />
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={links.excelHref}>Excel</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <PackActions {...pack} />

        {statusOptions.length ? (
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
        ) : null}

        {dateOptions.length ? (
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
        ) : null}

        <VendorFilter vendors={vendors} />
        <EnteredByToggle />

        <div className="min-w-40 flex-1">
          <SearchInput placeholder="Search number or vendor" />
        </div>

        {canCreate ? (
          <Link
            href={`${basePath}/new`}
            className="ml-auto inline-flex items-center rounded-md bg-[#2ca01c] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#248a18]"
          >
            Create {unit}
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">
          No {units} match that vendor, status, or date.
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
                    aria-label={`Select the ${units} on this list`}
                    className="size-3.5 accent-[#2ca01c]"
                  />
                </TableHead>
                <SortableHeader column="date" label="Date" state={sort} basePath={basePath} params={params} className="w-44" defaultDirection="desc" />
                <SortableHeader column="number" label="No." state={sort} basePath={basePath} params={params} className="w-28" />
                <SortableHeader column="vendor" label="Vendor" state={sort} basePath={basePath} params={params} />
                {showDue ? (
                  <SortableHeader column="dueDate" label="Due" state={sort} basePath={basePath} params={params} className="w-28" />
                ) : null}
                <SortableHeader column="total" label="Amount" state={sort} basePath={basePath} params={params} className="w-28" numeric defaultDirection="desc" />
                {showBalance ? <TableHead className="numeric w-28">Owing</TableHead> : null}
                <SortableHeader column="status" label="Status" state={sort} basePath={basePath} params={params} className="w-28" />
                <EnteredByHead />
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
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">{row.date}</TableCell>
                  <TableCell>
                    <Link href={row.href} className="tabular font-medium hover:underline">
                      {row.number}
                    </Link>
                  </TableCell>
                  <TableCell>{row.vendor}</TableCell>
                  {showDue ? (
                    <TableCell className={row.overdue ? 'tabular font-medium text-destructive' : 'tabular text-muted-foreground'}>
                      {row.due ?? '—'}
                    </TableCell>
                  ) : null}
                  <TableCell className="numeric tabular">{row.amount}</TableCell>
                  {showBalance ? (
                    <TableCell className="numeric tabular font-medium">{row.balance ?? '—'}</TableCell>
                  ) : null}
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <EnteredByCell trail={row.trail} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollSheet>
      )}
    </div>
  )
}
