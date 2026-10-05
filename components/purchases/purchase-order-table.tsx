'use client'

import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

import { TableColumnCustomize } from '@/components/data/table-column-customize'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { useTableColumnPrefs } from '@/lib/use-table-column-prefs'

type ColumnId =
  | 'supplier'
  | 'number'
  | 'date'
  | 'category'
  | 'class'
  | 'location'
  | 'memo'
  | 'subtotal'
  | 'tax'
  | 'total'
  | 'due'
  | 'status'
  | 'email'
  | 'lastEmail'
  | 'attachments'

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'supplier', label: 'Supplier' },
  { id: 'number', label: 'Order no.' },
  { id: 'date', label: 'Order date' },
  { id: 'category', label: 'Category' },
  { id: 'class', label: 'Class' },
  { id: 'location', label: 'Location' },
  { id: 'memo', label: 'Memo' },
  { id: 'subtotal', label: 'Total before sales tax' },
  { id: 'tax', label: 'Sales tax' },
  { id: 'total', label: 'Total amount' },
  { id: 'due', label: 'Due date' },
  { id: 'status', label: 'Status' },
  { id: 'email', label: 'Email' },
  { id: 'lastEmail', label: 'Last email sent' },
  { id: 'attachments', label: 'Attachments' },
]

export type PurchaseOrderBoardRow = {
  id: string
  number: string
  date: string
  dueDate: string | null
  status: string
  memo: string | null
  subtotal: string
  taxTotal: string
  total: string
  vendorName: string
  email: string | null
  category: string
  location: string
  attachments: number
}

const NUMERIC = new Set<ColumnId>(['subtotal', 'tax', 'total', 'attachments'])
const PO_DEFAULT_HIDDEN: string[] = []

export function PurchaseOrderTable({
  rows,
  currency,
  canEdit,
  canReceive,
}: {
  rows: PurchaseOrderBoardRow[]
  currency: string
  canEdit: boolean
  canReceive: boolean
}) {
  const { prefs, visible, toggle, reorder } = useTableColumnPrefs('bpc.poColumns', COLUMNS, PO_DEFAULT_HIDDEN)
  const shown = new Set(visible.map((column) => column.id as ColumnId))

  return (
    <div>
      <div className="mb-3 flex justify-end print:hidden">
        <TableColumnCustomize columns={COLUMNS} prefs={prefs} onToggle={toggle} onReorder={reorder} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.filter((column) => shown.has(column.id)).map((column) => (
              <TableHead key={column.id} className={NUMERIC.has(column.id) ? 'numeric' : undefined}>
                {column.label}
              </TableHead>
            ))}
            <TableHead className="w-28 print:hidden">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const cells: Record<ColumnId, string> = {
              supplier: row.vendorName,
              number: row.number,
              date: row.date,
              category: row.category,
              class: '—',
              location: row.location,
              memo: row.memo?.trim() || '—',
              subtotal: formatMoney(row.subtotal, currency),
              tax: formatMoney(row.taxTotal, currency),
              total: formatMoney(row.total, currency),
              due: row.dueDate ?? '—',
              status: STATUS_LABELS[row.status] ?? row.status,
              email: row.email ?? '—',
              lastEmail: '—',
              attachments: row.attachments === 0 ? '—' : String(row.attachments),
            }
            const receivable = canReceive && row.status !== 'VOID' && row.status !== 'DRAFT' && row.status !== 'CLOSED'
            return (
              <TableRow key={row.id}>
                {COLUMNS.filter((column) => shown.has(column.id)).map((column) => (
                  <TableCell
                    key={column.id}
                    className={NUMERIC.has(column.id) ? 'numeric tabular whitespace-nowrap' : 'whitespace-nowrap'}
                  >
                    {column.id === 'status' ? (
                      <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>{cells.status}</Badge>
                    ) : column.id === 'number' ? (
                      <Link href={`/purchases/purchase-orders/${row.id}`} className="font-medium hover:underline">
                        {row.number}
                      </Link>
                    ) : (
                      cells[column.id]
                    )}
                  </TableCell>
                ))}
                <TableCell className="print:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                      View/Edit
                      <ChevronDownIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/purchases/purchase-orders/${row.id}`}>View</Link>
                      </DropdownMenuItem>
                      {canEdit && row.status !== 'VOID' ? (
                        <DropdownMenuItem asChild>
                          <Link href={`/purchases/purchase-orders/${row.id}/edit`}>Edit</Link>
                        </DropdownMenuItem>
                      ) : null}
                      {receivable ? (
                        <DropdownMenuItem asChild>
                          <Link href={`/purchases/purchase-orders/${row.id}/receive`}>Receive</Link>
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
